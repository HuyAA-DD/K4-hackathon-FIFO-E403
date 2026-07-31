const FOLLOW_UP = /\b(lam ro|lam ro hon|giai thich|giai thich ro hon|giai thich them|chi tiet hon|vi du them|them ve)\b/i;
const EXPLICIT_WEB = /\b(mo rong|dao sau|bo sung|nguon ngoai|tim web|tim kiem|tra cuu|cap nhat|tham khao)\b/i;
const CURRENT_PAGE = /\b(slide nay|trang nay|noi dung nay|cai nay|doan nay|y nay)\b/i;
const MULTI_SLIDE = /\b(cac slide|nhieu slide|cac trang|nhieu trang|tu slide|tu trang|toan bo bai giang|toan bo tai lieu|tat ca slide|tat ca cac slide)\b/i;
// A request for model parameters is a separate factual aspect, not just a
// synonym for “LLM”. Treat it as a multi-slide query so its dedicated source
// page remains in the context and is returned as a citation.
const PARAMETER_DETAIL = /\b(?:tham so|parameters?)\b/i;
const FULL_DECK = /(?:\b(?:toan bo (?:slide|bai giang|tai lieu)|tat ca (?:slide|cac slide|trang|cac trang))\b|\btom tat (?:cac|nhieu) slide(?: bai giang)?\s*$)/i;
const PAGE_REFERENCE = /\b(?:slide|trang|page)\s*(?:so\s*)?(\d{1,3})\b/i;
const CLEARLY_UNRELATED = /\b(thoi tiet|nhiet do|bong da|the thao|gia vang|chung khoan|nau an|phim|am nhac|tu vi)\b/i;
const TECHNICAL_ERROR = /failed to fetch|chua co pdf|khong co pdf|khong tai duoc|network error|loi (?:he thong|ky thuat)/i;
const SECRET_LIKE_INPUT = /(?:^|\s)(?:sk|pk)[-_]\S{2,}/i;
const SYSTEM_IMPLEMENTATION_QUERY = /\b(?:ban|toi|he thong|tutor)\b[\s\S]*\b(?:gemini|gpt|claude|mo hinh|model)\b|\b(?:gemini|gpt|claude|mo hinh|model)\b[\s\S]*\b(?:ban|toi|he thong|tutor)\b/i;
const ENGLISH_WORDS = new Set(["a", "an", "and", "are", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "with"]);

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

function hasUnsupportedSelectionLanguage(selection) {
  const words = String(selection || "").toLowerCase().match(/[a-zà-ỹ]+/gi) || [];
  if (words.length < 7 || /[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/i.test(selection)) return false;
  const englishWordCount = words.filter((word) => ENGLISH_WORDS.has(word)).length;
  return englishWordCount <= Math.max(1, Math.floor(words.length * 0.15));
}

function insufficient(reason, answer) {
  return { route: "insufficient", results: [], query: "", reason, confidence: "exact", answer };
}

function routeQuestion({ question, previousTopic, currentPage, selection, pages, searchPages }) {
  const normalized = normalize(question);
  const selectedText = String(selection || "").trim();
  const pageSelection = parsePageSelection(question, pages);
  const requestedPage = parsePageReference(question);
  const current = pages.find((page) => page.page === Number(currentPage));
  const isFollowUp = FOLLOW_UP.test(normalized);
  const query = isFollowUp && previousTopic ? `${question} ${previousTopic}` : question;
  const asksForMultipleSlides = Boolean(pageSelection) || MULTI_SLIDE.test(normalized) || PARAMETER_DETAIL.test(normalized);
  const rawResults = searchPages(query, pages, asksForMultipleSlides ? 10 : 7);
  const results = keepRelevantResults(rawResults, asksForMultipleSlides);
  const confidence = retrievalConfidence(results);
  const asksForWeb = EXPLICIT_WEB.test(normalized);

  if (SECRET_LIKE_INPUT.test(question)) {
    return insufficient("secret-like-input", "Mình không thể xử lý chuỗi trông giống thông tin nhạy cảm như một câu hỏi học tập. Bạn hãy viết lại câu hỏi về nội dung slide, không gửi khóa hay cấu hình.");
  }
  if (SYSTEM_IMPLEMENTATION_QUERY.test(normalized)) {
    return insufficient("system-implementation", "Mình không xác nhận hay suy đoán về model nền hoặc hạ tầng của chính Tutor. Mình có thể hỗ trợ giải thích nội dung slide về các mô hình AI nếu bạn muốn.");
  }
  if (TECHNICAL_ERROR.test(selectedText || question)) {
    return insufficient("technical-error", "Đây có vẻ là thông báo lỗi kỹ thuật, không phải nội dung bài giảng. Bạn hãy tải lại tài liệu hoặc kiểm tra kết nối, rồi gửi lại câu hỏi nếu vẫn cần hỗ trợ.");
  }
  if (selectedText && hasUnsupportedSelectionLanguage(selectedText)) {
    return insufficient("unsupported-selection-language", "Đoạn bôi đen chưa đủ rõ để mình giải thích đáng tin cậy. Bạn có thể gửi lại đoạn tiếng Việt hoặc tiếng Anh, hoặc cho biết ngữ cảnh của đoạn này không?");
  }

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

  if (selectedText && current) {
    return { route: "slide", results: [{ ...current, score: 100, matchedTerms: ["selection"] }], query, reason: "selection-current-page", confidence: "exact" };
  }
  if (CURRENT_PAGE.test(normalized) && current) {
    return { route: "slide", results: [{ ...current, score: 100, matchedTerms: ["current-page"] }], query, reason: "current-page-deictic", confidence: "exact" };
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
