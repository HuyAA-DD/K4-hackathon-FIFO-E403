import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evalDir = path.resolve(root, "..", "..", "eval");
const port = Number(process.env.GOLDEN_SET_PORT || 4198);
const baseUrl = `http://127.0.0.1:${port}`;
const runName = process.env.GOLDEN_SET_RUN || "golden-set-v0-run-01";

function readCases() {
  const source = fs.readFileSync(path.join(evalDir, "run-golden-set.mjs"), "utf8");
  const match = source.match(/const cases = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error("Không thể đọc danh sách case từ eval/run-golden-set.mjs.");
  return Function(`return (${match[1]});`)();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw new Error(`Server không khởi động được: ${lastError?.message || "timeout"}`);
}

function markdownReport(results, startedAt, completedAt) {
  const successful = results.filter((item) => item.status === 200);
  const routes = successful.reduce((counts, item) => {
    const route = item.response?.route || "unknown";
    counts[route] = (counts[route] || 0) + 1;
    return counts;
  }, {});
  const rows = results.map((item) => {
    const citations = item.response?.citations?.map((citation) => citation.page).join(", ") || "-";
    return `| ${item.id} | ${item.status || "ERROR"} | ${item.response?.route || "-"} | ${citations} | ${item.ms ?? "-"} |`;
  }).join("\n");

  return `# Golden set — Working Prototype v0\n\n`
    + `- Run: \`${runName}\`\n`
    + `- Thời gian: ${startedAt} → ${completedAt}\n`
    + `- Đích test: \`POST /api/chat\` tại ${baseUrl}\n`
    + `- Bộ case: \`eval/golden-set.md\` (27 case)\n`
    + `- Kết quả HTTP: **${successful.length}/${results.length}** request trả 200.\n`
    + `- Phân bố route: ${Object.entries(routes).map(([route, count]) => `\`${route}\`: ${count}`).join(", ") || "không có"}.\n\n`
    + `## Lưu ý phạm vi\n\n`
    + `Golden set được viết cho hợp đồng \`CP3-test/final_answer\`. Bản v0 dùng hợp đồng \`route/answer/citations\` và không nhận \`selection\`; runner chỉ gửi \`question\` và \`currentPage\`. Vì vậy báo cáo này là kết quả thực thi/API, không tự gán đạt-không đạt theo rubric CP3.\n\n`
    + `## Kết quả từng case\n\n`
    + `| ID | HTTP | Route | Citation slide | Thời gian (ms) |\n| --- | ---: | --- | --- | ---: |\n${rows}\n\n`
    + `Raw response đầy đủ: \`${runName}-raw.json\`.\n`;
}

async function run() {
  const cases = readCases();
  const startedAt = new Date().toISOString();
  const server = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let serverError = "";
  server.stderr.on("data", (chunk) => { serverError += chunk.toString(); });

  try {
    await waitForServer();
    const results = [];
    for (const testCase of cases) {
      const started = Date.now();
      try {
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: testCase.question, currentPage: testCase.page, selection: testCase.selection, previousTopic: "" })
        });
        const data = await response.json();
        results.push({
          id: testCase.id,
          input: { ...testCase, selection: testCase.selection ? "[không hỗ trợ bởi v0]" : null },
          status: response.status,
          response: data,
          ms: Date.now() - started
        });
        console.error(`[${testCase.id}] ${response.status} in ${results.at(-1).ms}ms`);
      } catch (error) {
        results.push({ id: testCase.id, input: testCase, error: String(error), ms: Date.now() - started });
        console.error(`[${testCase.id}] ERROR ${error.message}`);
      }
    }
    const completedAt = new Date().toISOString();
    const rawPath = path.join(evalDir, `${runName}-raw.json`);
    const reportPath = path.join(evalDir, `${runName}.md`);
    fs.writeFileSync(rawPath, JSON.stringify({ startedAt, completedAt, target: baseUrl, results }, null, 2));
    fs.writeFileSync(reportPath, markdownReport(results, startedAt, completedAt));
    console.log(JSON.stringify({ rawPath, reportPath, total: results.length, ok: results.filter((item) => item.status === 200).length }));
  } finally {
    server.kill();
    if (serverError) console.error(serverError.trim());
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
