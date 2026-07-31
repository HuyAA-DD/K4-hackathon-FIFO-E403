const FOLLOW_UP = /\b(lam ro|lam ro hon|giai thich|giai thich ro hon|giai thich them|chi tiet hon|vi du them|them ve)\b/i;
const EXPLICIT_WEB = /\b(mo rong|dao sau|bo sung|nguon ngoai|tim web|tim kiem|tra cuu|cap nhat|tham khao)\b/i;
const CURRENT_PAGE = /\b(slide nay|trang nay|noi dung nay|tom tat)\b/i;
const PAGE_REFERENCE = /\b(?:slide|trang|page)\s*(?:so\s*)?(\d{1,3})\b/i;
const CLEARLY_UNRELATED = /\b(thoi tiet|nhiet do|bong da|the thao|gia vang|chung khoan|nau an|phim|am nhac|tu vi)\b/i;

const SYSTEM_PROMPT = `Bạn là VLearn Tutor, trả lời bằng tiếng Việt.
- Ưu tiên tuyệt đối nội dung slide được cung cấp. Với route SLIDE, chỉ dùng CONTEXT SLIDE.
- Không tự tạo số trang, tên tài liệu, URL hoặc citation. Hệ thống gắn nguồn sau câu trả lời.
- Trả lời ngắn: tối đa 2 đoạn, khoảng 120 từ. Nêu rõ giới hạn nếu ngữ cảnh chưa đủ.
- Chỉ trả về văn bản thuần: không dùng Markdown, không dùng tiêu đề, bullet, đánh số, bảng, ký tự #, *, >, backtick hoặc link Markdown.
- Với route WEB, phải dùng Web Search trước khi trả lời; chỉ mở rộng kiến thức liên quan trực tiếp bài học. Có thể đối chiếu tối đa 5 nguồn đáng tin cậy, không lặp lại cùng một ý.`;

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePageReference(question) {
  const match = normalize(question).match(PAGE_REFERENCE);
  return match ? Number(match[1]) : null;
}

function retrievalConfidence(results) {
  const top = results[0];
  if (!top) return "none";
  const second = results[1];
  const matched = top.matchedTerms?.length || 0;
  const margin = top.score - (second?.score || 0);
  if (matched >= 3 || (matched >= 2 && top.score >= 7 && margin >= 2)) return "high";
  if (matched >= 2 || top.score >= 4) return "medium";
  return "low";
}

function routeQuestion({ question, previousTopic, currentPage, pages, searchPages }) {
  const normalized = normalize(question);
  const requestedPage = parsePageReference(question);
  const current = pages.find((page) => page.page === Number(currentPage));
  const isFollowUp = FOLLOW_UP.test(normalized);
  const query = isFollowUp && previousTopic ? `${question} ${previousTopic}` : question;
  const results = searchPages(query, pages, 3);
  const confidence = retrievalConfidence(results);
  const asksForWeb = EXPLICIT_WEB.test(normalized);

  if (requestedPage !== null) {
    const page = pages.find((item) => item.page === requestedPage);
    return page
      ? { route: "slide", results: [{ ...page, score: 100, matchedTerms: ["page-reference"] }], query, reason: "page-reference", confidence: "exact" }
      : { route: "invalid-page", results: [], query, reason: "page-not-found", requestedPage, confidence: "exact" };
  }

  if (CURRENT_PAGE.test(normalized) && current) {
    return { route: "slide", results: [{ ...current, score: 100, matchedTerms: ["current-page"] }], query, reason: "current-page", confidence: "exact" };
  }

  if (CLEARLY_UNRELATED.test(normalized)) {
    return { route: "irrelevant", results: [], query, reason: "clearly-unrelated", confidence };
  }

  if (asksForWeb && (confidence === "high" || confidence === "medium" || previousTopic)) {
    return { route: "external", results, query, reason: "explicit-web-request", confidence };
  }

  if (confidence === "high") {
    return { route: "slide", results, query, reason: "high-confidence-retrieval", confidence };
  }

  return {
    route: "ambiguous",
    results: results.length ? results : (current ? [{ ...current, score: 0, matchedTerms: [] }] : []),
    query,
    reason: "needs-model-classifier",
    confidence
  };
}

module.exports = { SYSTEM_PROMPT, routeQuestion, normalize, parsePageReference, retrievalConfidence };
