const http = require("http");
const fs = require("fs");
const path = require("path");
const { searchPages, searchSlidesByPrompt } = require("./src/retrieval");
const { SYSTEM_PROMPT, routeQuestion, normalize } = require("./src/chat-policy");
const {
  respond,
  classifyRoute,
  getWebCitations,
  rewriteWithVerifiedSources,
  harmonizeSourceCount
} = require("./src/providers/openai");

const root = __dirname;
const publicDir = path.join(root, "public");
const slideIndex = path.join(root, "data", "slide-index.json");
const slidePdf = path.resolve(root, "../../data/vlearn-pack/slides/d1-slide-hackathon.pdf");
const port = Number(process.env.PORT || 4180);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch { /* .env is optional until OpenAI is configured. */ }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.code === "ENOENT" ? "Không tìm thấy tài nguyên." : "Không thể đọc tài nguyên.");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 100_000) reject(new Error("Nội dung yêu cầu quá lớn."));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("JSON không hợp lệ.")); }
    });
    req.on("error", reject);
  });
}

function readIndex() {
  return JSON.parse(fs.readFileSync(slideIndex, "utf8"));
}

function formatSlideContext(results) {
  return results.map((page) => `TRANG ${page.page} — ${page.title}\n${page.text}`).join("\n\n---\n\n");
}

function slideCitations(results, document) {
  return results.map((page) => ({
    type: "slide",
    document,
    page: page.page,
    title: page.title,
    quote: page.excerpt
  }));
}

function webSourceOptions(question) {
  const normalized = normalize(question);
  const exactCount = normalized.match(/\b(\d{1,2})\s+(?:nguon|tai lieu|bai viet|paper)\b/i);
  return {
    limit: exactCount ? Math.min(Math.max(Number(exactCount[1]), 1), 8) : 6,
    listSources: /\b(nguon|tai lieu|bai viet|paper|tham khao|doc them)\b/i.test(normalized)
  };
}

async function handleChat(req, res) {
  const body = await readBody(req);
  const question = String(body.question || "").trim();
  const currentPage = Number(body.currentPage || 1);
  const previousTopic = String(body.previousTopic || "").trim();
  const selection = String(body.selection || "").trim();
  if (!question) return sendJson(res, 400, { error: "Bạn chưa nhập câu hỏi." });

  const index = readIndex();
  let decision = routeQuestion({ question, previousTopic, currentPage, selection, pages: index.pages, searchPages });
  if (decision.route === "invalid-page") {
    return sendJson(res, 200, {
      route: "invalid-page",
      answer: `Tài liệu hiện không có slide/trang ${decision.requestedPage}. Bạn có thể chọn một trang từ 1 đến ${index.pages.length}.`,
      citations: []
    });
  }
  if (decision.route === "ambiguous") {
    const classification = await classifyRoute({
      question,
      previousTopic,
      currentPage,
      candidates: decision.results
    });
    decision = {
      ...decision,
      route: classification.route,
      reason: "model-classifier",
      confidence: classification.confidence
    };
  }
  if (decision.route === "irrelevant") {
    return sendJson(res, 200, {
      route: "irrelevant",
      answer: "Câu hỏi này chưa liên quan trực tiếp đến nội dung AI/LLM trong bài giảng hiện tại, nên mình không trả lời để tránh làm loãng việc học.",
      citations: []
    });
  }

  if (decision.route === "insufficient") {
    return sendJson(res, 200, {
      route: "insufficient",
      answer: decision.answer || "Mình chưa có đủ ngữ cảnh để trả lời đáng tin cậy. Bạn có thể nói rõ hơn không?",
      citations: []
    });
  }

  if (decision.route === "slide") {
    decision.results = decision.results.map((page, index) => {
      if (index !== 0 || (!selection && decision.reason !== "current-page-deictic")) return page;
      const additions = [
        selection ? `SELECTED TEXT ON THIS PAGE:\n${selection}` : "",
        decision.reason === "current-page-deictic"
          ? "INSTRUCTION: Summarize every main point on this page; do not answer with only one partial idea."
          : ""
      ].filter(Boolean).join("\n\n");
      return { ...page, text: `${page.text}\n\n${additions}` };
    });
    const pageScope = decision.results.map((page) => page.page).join(", ");
    const response = await respond({
      input: `${SYSTEM_PROMPT}\n\nROUTE: SLIDE\nTrang người học đang xem: ${currentPage}.\nCác trang được retrieval chọn: ${pageScope}.\n\nCONTEXT SLIDE ĐƯỢC PHÉP DÙNG:\n${formatSlideContext(decision.results)}\n\nCÂU HỎI: ${question}\n\nTrả lời bằng tiếng Việt, ngắn gọn. Chỉ dùng CONTEXT SLIDE; nếu có nhiều trang thì phải tổng hợp thông tin xuyên trang. Không tự ghi citation trong phần văn bản.`
    });
    if (!response.text) throw new Error("OpenAI không trả về nội dung từ slide.");
    return sendJson(res, 200, {
      route: "slide",
      answer: response.text,
      citations: slideCitations(decision.results, index.document),
      topic: decision.query
    });
  }

  const localContext = decision.results.length ? formatSlideContext(decision.results) : "Không tìm thấy đoạn slide đủ thông tin.";
  const sourceOptions = webSourceOptions(question);
  const response = await respond({
    useWebSearch: true,
    input: `${SYSTEM_PROMPT}\n\nROUTE: WEB\nBối cảnh bài học/slide liên quan:\n${localContext}\n\nCÂU HỎI: ${question}\n\nBắt buộc dùng Web Search trước khi trả lời, kể cả khi slide đã có nội dung nền. Dùng tối đa ${sourceOptions.limit} nguồn mạnh, ưu tiên tài liệu chính thức hoặc học thuật. Mỗi nguồn được nhắc tên trong câu trả lời phải có một URL citation annotation tương ứng; không được nói đã đọc hoặc tìm thấy nhiều nguồn hơn số nguồn thực sự được citation. Không tự ghi URL trong phần văn bản; hệ thống sẽ hiển thị citation từ metadata.`
  });
  const citations = getWebCitations(response.annotations, sourceOptions.limit);
  if (!response.text || !citations.length) {
    return sendJson(res, 200, {
      route: "insufficient",
      answer: "Mình chưa tìm được nguồn ngoài có thể trích dẫn rõ ràng cho phần mở rộng này, nên không đưa ra câu trả lời suy đoán.",
      citations: []
    });
  }
  let verifiedAnswer;
  try {
    verifiedAnswer = await rewriteWithVerifiedSources({
      question,
      answer: response.text,
      citations,
      listSources: sourceOptions.listSources
    });
  } catch (error) {
    console.warn("Không thể chạy bước đối soát citation; dùng câu trả lời web ban đầu.", error.message);
    verifiedAnswer = harmonizeSourceCount(response.text, citations.length);
  }
  return sendJson(res, 200, { route: "external", answer: verifiedAnswer, citations, topic: decision.query });
}

loadEnv();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, version: "v0", providers: { localIndex: true, openai: Boolean(process.env.OPENAI_API_KEY), webSearch: Boolean(process.env.OPENAI_API_KEY) } });
    }

    if (pathname === "/api/search") {
      const query = url.searchParams.get("q") || "";
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 5, 1), 10);
      const results = searchSlidesByPrompt(query, readIndex().pages, limit);
      return sendJson(res, 200, {
        query,
        route: results.length ? "slide" : "insufficient",
        results,
        message: results.length ? `Tìm thấy ${results.length} slide phù hợp.` : "Chưa tìm thấy slide khớp với prompt này."
      });
    }

    if (pathname === "/api/chat" && req.method === "POST") return await handleChat(req, res);
    if (pathname === "/slides/d1-slide-hackathon.pdf") return sendFile(res, slidePdf, "application/pdf");
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(publicDir, relativePath);
    if (!filePath.startsWith(publicDir + path.sep) && filePath !== path.join(publicDir, "index.html")) {
      return sendJson(res, 403, { error: "Forbidden" });
    }
    return sendFile(res, filePath, mimeTypes[path.extname(filePath)] || "application/octet-stream");
  } catch (error) {
    const status = error.code === "OPENAI_NOT_CONFIGURED" ? 503 : (error.status || 500);
    const message = status === 429
      ? "OpenAI API đã chạm quota hoặc giới hạn thanh toán. Hãy kiểm tra Usage/Billing rồi thử lại; Tutor sẽ không trả lời khi chưa có nguồn xác thực."
      : (error.message || "Không thể xử lý câu hỏi.");
    return sendJson(res, status, { error: message });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") console.error(`Port ${port} đang được dùng. Chạy lại với PORT=4181 npm start.`);
  else console.error(error);
  process.exit(1);
});

server.listen(port, () => console.log(`Working Prototype v0: http://localhost:${port}`));
