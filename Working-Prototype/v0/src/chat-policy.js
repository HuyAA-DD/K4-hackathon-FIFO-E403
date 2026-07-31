const FOLLOW_UP = /\b(lam ro|lam ro hon|giai thich|giai thich ro hon|giai thich them|chi tiet hon|vi du them|them ve)\b/i;
const EXPLICIT_WEB = /\b(mo rong|dao sau|bo sung|nguon ngoai|tim web|tim kiem|tra cuu|cap nhat|tham khao)\b/i;
const CURRENT_PAGE = /\b(slide nay|trang nay|noi dung nay)\b/i;
const MULTI_SLIDE = /\b(cac slide|nhieu slide|cac trang|nhieu trang|tu slide|tu trang|toan bo bai giang|toan bo tai lieu|tat ca slide|tat ca cac slide)\b/i;
const FULL_DECK = /(?:\b(?:toan bo (?:slide|bai giang|tai lieu)|tat ca (?:slide|cac slide|trang|cac trang))\b|\btom tat (?:cac|nhieu) slide(?: bai giang)?\s*$)/i;
const PAGE_REFERENCE = /\b(?:slide|trang|page)\s*(?:so\s*)?(\d{1,3})\b/i;
const CLEARLY_UNRELATED = /\b(thoi tiet|nhiet do|bong da|the thao|gia vang|chung khoan|nau an|phim|am nhac|tu vi)\b/i;

const SYSTEM_PROMPT = `Bạn là VLearn Tutor, trả lời bằng tiếng Việt.
- Ưu tiên tuyệt đối nội dung slide được cung cấp. Với route SLIDE, chỉ dùng CONTEXT SLIDE và có thể tổng hợp đồng thời nhiều trang.
- Không tự tạo số trang, tên tài liệu, URL hoặc citation. Hệ thống gắn nguồn sau câu trả lời.
- Trả lời ngắn: tối đa 2 đoạn, khoảng 120 từ. Nếu người học yêu cầu tổng hợp nhiều slide, nêu các ý chung và khác biệt quan trọng thay vì trả lời từng trang máy móc.
- Chỉ trả về văn bản thuần: không dùng Markdown, tiêu đề, bullet, đánh số, bảng, ký tự #, *, >, backtick hoặc link Markdown.
- Với route WEB, phải dùng Web Search trước khi trả lời; chỉ mở rộng kiến thức liên quan trực tiếp bài học. Chỉ nhắc đến nguồn có URL citation thật trong kết quả tìm kiếm và không tuyên bố số nguồn lớn hơn số nguồn đã trích dẫn.`;

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePageExpression(value) {
  return String(value || "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9,\-/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePageReference(question) {
  const match = normalize(question).match(PAGE_REFERENCE);
  return match ? Number(match[1]) : null;
}

function exactPages(pageNumbers, pages) {
  const unique = [...new Set(pageNumbers)];
  const invalid = unique.find((page) => page < 1 || page > pages.length);
  if (invalid) return { type: "invalid", requestedPage: invalid, pages: [] };
  return {
    type: "multiple",
    pages: unique.map((number) => ({ ...pages[number - 1], score: 100, matchedTerms: ["page-selection"] }))
  };
}

function parsePageSelection(question, pages) {
  const normalized = normalize(question);
  if (FULL_DECK.test(normalized)) {
    return {
      type: "all",
      pages: pages.map((page) => ({ ...page, score: 100, matchedTerms: ["full-deck"] }))
    };
  }

  const expression = normalizePageExpression(question);
  const range = expression.match(/\b(?:slide|trang|page)\s*(?:so\s*)?(\d{1,3})\s*(?:-|den|toi)\s*(?:(?:slide|trang|page)\s*)?(?:so\s*)?(\d{1,3})\b/i);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    const first = Math.min(start, end);
    const last = Math.max(start, end);
    return exactPages(Array.from({ length: last - first + 1 }, (_, index) => first + index), pages);
  }

  const list = expression.match(/\b(?:slide|trang|page)\s*((?:\d{1,3}\s*(?:,|\/|va)\s*)+\d{1,3})\b/i);
  if (list) {
    const numbers = [...list[1].matchAll(/\d{1,3}/g)].map((match) => Number(match[0]));
    if (numbers.length > 1) return exactPages(numbers, pages);
  }
  return null;
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

function keepRelevantResults(results, multiSlide) {
  if (!results.length) return results;
  const topScore = results[0].score;
  const relativeFloor = multiSlide ? Math.max(1, Math.floor(topScore * 0.25)) : Math.max(2, Math.floor(topScore * 0.4));
  return results.filter((page, index) => index === 0 || page.score >= relativeFloor);
}

function routeQuestion({ question, previousTopic, currentPage, pages, searchPages }) {
  const normalized = normalize(question);
  const pageSelection = parsePageSelection(question, pages);
  const requestedPage = parsePageReference(question);
  const current = pages.find((page) => page.page === Number(currentPage));
  const isFollowUp = FOLLOW_UP.test(normalized);
  const query = isFollowUp && previousTopic ? `${question} ${previousTopic}` : question;
  const asksForMultipleSlides = Boolean(pageSelection) || MULTI_SLIDE.test(normalized);
  const rawResults = searchPages(query, pages, asksForMultipleSlides ? 10 : 7);
  const results = keepRelevantResults(rawResults, asksForMultipleSlides);
  const confidence = retrievalConfidence(results);
  const asksForWeb = EXPLICIT_WEB.test(normalized);

  if (pageSelection?.type === "invalid") {
    return { route: "invalid-page", results: [], query, reason: "page-selection-invalid", requestedPage: pageSelection.requestedPage, confidence: "exact" };
  }
  if (pageSelection?.pages?.length) {
    return { route: "slide", results: pageSelection.pages, query, reason: `page-selection-${pageSelection.type}`, confidence: "exact" };
  }

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
  if (confidence === "high" || (asksForMultipleSlides && results.length)) {
    return { route: "slide", results, query, reason: asksForMultipleSlides ? "multi-slide-retrieval" : "high-confidence-retrieval", confidence };
  }

  return {
    route: "ambiguous",
    results: results.length ? results : (current ? [{ ...current, score: 0, matchedTerms: [] }] : []),
    query,
    reason: "needs-model-classifier",
    confidence
  };
}

module.exports = {
  SYSTEM_PROMPT,
  routeQuestion,
  normalize,
  parsePageReference,
  parsePageSelection,
  retrievalConfidence,
  keepRelevantResults
};
