const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function toPlainText(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}(?:[-*+•]|\d+[.)])\s+/gm, "")
    .replace(/`{1,3}/g, "")
    .replace(/\*{1,3}|_{1,3}/g, "")
    .replace(/\uE200cite\uE202[^\uE201]+\uE201/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractOutput(payload) {
  const messageBlocks = (payload.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text");

  const text = toPlainText(messageBlocks.map((block) => block.text || "").join("\n").trim()
    || String(payload.output_text || "").trim());
  const annotations = messageBlocks.flatMap((block) => block.annotations || []);
  return { text, annotations };
}

async function respond({ input, useWebSearch = false }) {
  if (!isConfigured()) {
    const error = new Error("Chưa tìm thấy OPENAI_API_KEY. Sao chép .env.example thành .env rồi điền API key.");
    error.code = "OPENAI_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4",
      input,
      text: { verbosity: "low" },
      ...(useWebSearch ? {
        reasoning: { effort: "low" },
        tools: [{ type: "web_search", search_context_size: "medium" }],
        tool_choice: "required"
      } : {})
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || "OpenAI API trả về lỗi.");
    error.status = response.status;
    throw error;
  }
  return extractOutput(payload);
}

async function classifyRoute({ question, previousTopic, currentPage, candidates }) {
  if (!isConfigured()) {
    const error = new Error("Chưa tìm thấy OPENAI_API_KEY. Sao chép .env.example thành .env rồi điền API key.");
    error.code = "OPENAI_NOT_CONFIGURED";
    throw error;
  }

  const candidateSummary = (candidates || []).slice(0, 3).map((page) => ({
    page: page.page,
    title: page.title,
    excerpt: String(page.excerpt || page.text || "").slice(0, 180)
  }));
  const input = `Bạn là bộ phân loại route cho VLearn Tutor. Chỉ trả JSON theo schema.
Chọn slide nếu câu hỏi có thể trả lời dựa trên một trong các slide ứng viên hoặc ngữ cảnh trang hiện tại.
Chọn external nếu câu hỏi liên quan trực tiếp nội dung học tập/AI và cần kiến thức ngoài slide.
Chọn irrelevant nếu câu hỏi là đời sống, tin tức, thời tiết, thể thao, giải trí hoặc không liên quan bài học.
Không chọn external chỉ vì thiếu keyword; ưu tiên slide khi có căn cứ.

Câu hỏi: ${question}
Chủ đề trước đó: ${previousTopic || "(không có)"}
Trang người học đang xem: ${currentPage}
Slide ứng viên: ${JSON.stringify(candidateSummary)}`;

  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4",
      input,
      reasoning: { effort: "low" },
      max_output_tokens: 120,
      text: {
        format: {
          type: "json_schema",
          name: "vlearn_route",
          strict: true,
          schema: {
            type: "object",
            properties: {
              route: { type: "string", enum: ["slide", "external", "irrelevant"] },
              confidence: { type: "string", enum: ["high", "medium", "low"] }
            },
            required: ["route", "confidence"],
            additionalProperties: false
          }
        }
      }
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || "OpenAI API trả về lỗi khi phân loại câu hỏi.");
    error.status = response.status;
    throw error;
  }

  try {
    const classification = JSON.parse(extractOutput(payload).text);
    if (["slide", "external", "irrelevant"].includes(classification.route)) return classification;
  } catch { /* Fall through to the safe route below. */ }
  return { route: "irrelevant", confidence: "low" };
}

function getWebCitations(annotations) {
  const seen = new Set();
  return annotations
    .filter((item) => item.type === "url_citation" && item.url)
    .map((item) => ({ type: "external", title: item.title || new URL(item.url).hostname, url: item.url }))
    .filter((item) => !seen.has(item.url) && seen.add(item.url))
    .slice(0, 5);
}

module.exports = { isConfigured, respond, classifyRoute, getWebCitations, toPlainText };
