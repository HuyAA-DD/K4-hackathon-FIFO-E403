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

function cleanCitationUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || ["ref", "source"].includes(key.toLowerCase())) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return value;
  }
}

function getWebCitations(annotations, limit = 8) {
  const seen = new Set();
  return annotations
    .filter((item) => item.type === "url_citation" && item.url)
    .map((item) => {
      const url = cleanCitationUrl(item.url);
      return { type: "external", title: item.title || new URL(url).hostname, url };
    })
    .filter((item) => !seen.has(item.url) && seen.add(item.url))
    .slice(0, Math.max(1, limit));
}

function harmonizeSourceCount(value, count) {
  return toPlainText(value).replace(/\b\d+\s+nguồn\b/giu, `${count} nguồn`);
}

async function rewriteWithVerifiedSources({ question, answer, citations, listSources = false }) {
  if (!citations?.length) return "";
  const verifiedSources = citations.map((citation, index) => `${index + 1}. ${citation.title} — ${citation.url}`).join("\n");
  const rewrite = await respond({
    input: `Bạn là biên tập viên câu trả lời của VLearn Tutor.
Viết lại câu trả lời nháp thành văn bản tiếng Việt thuần, tối đa 2 đoạn và khoảng 120 từ.
Chỉ được nhắc tên tài liệu/website nằm trong DANH SÁCH NGUỒN ĐÃ XÁC MINH. Không thêm nguồn mới, không chèn URL, Markdown, bullet hoặc đánh số.
Số nguồn được nói trong nội dung phải đúng bằng ${citations.length}. ${listSources ? "Người học đang yêu cầu tài liệu tham khảo: hãy nhắc tên lần lượt đủ các nguồn đã xác minh, mỗi nguồn đúng một lần." : "Chỉ dùng các nguồn đã xác minh để củng cố câu trả lời."}

CÂU HỎI: ${question}

CÂU TRẢ LỜI NHÁP:
${answer}

DANH SÁCH NGUỒN ĐÃ XÁC MINH:
${verifiedSources}`
  });
  return harmonizeSourceCount(rewrite.text || answer, citations.length);
}

module.exports = {
  isConfigured,
  respond,
  classifyRoute,
  getWebCitations,
  rewriteWithVerifiedSources,
  harmonizeSourceCount,
  toPlainText
};
