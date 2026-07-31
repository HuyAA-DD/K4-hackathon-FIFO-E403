const STOP_WORDS = new Set([
  "anh", "chi", "cho", "cua", "cung", "dang", "day", "de", "duoc", "em", "hay", "hom", "la",
  "lam", "minh", "mot", "nay", "nhung", "noi", "o", "roi", "se", "the", "thi", "va", "ve", "voi",
  "gi", "nao", "tai", "sao", "khong", "co", "tu", "trong", "nhu", "them", "hon", "giup", "ve", "cua"
]);

const CONCEPT_ALIASES = {
  llm: ["large language model", "large language models", "language model", "mo hinh ngon ngu lon"],
  "large language model": ["llm", "mo hinh ngon ngu lon"],
  genai: ["generative ai", "generative", "ai tao sinh"],
  "generative ai": ["genai", "ai tao sinh"],
  rag: ["retrieval augmented generation", "retrieval", "augmented generation"],
  transformer: ["attention", "self attention", "transformer architecture"],
  attention: ["self attention", "transformer"],
  prompt: ["prompt engineering", "prompting"],
  agent: ["ai agent", "agentic", "autonomous agent"],
  hallucination: ["hallucinate", "ao giac ai"],
  embedding: ["vector embedding", "vector"],
  "fine tuning": ["finetuning", "fine tune"],
  api: ["application programming interface"]
};

function normalizePhrase(value) {
  return String(value || "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return normalizePhrase(value)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function hasWord(text, word) {
  return new RegExp(`(^|\\s)${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`).test(text);
}

function expandQuery(query) {
  const phrase = normalizePhrase(query);
  const additions = Object.entries(CONCEPT_ALIASES)
    .filter(([concept]) => phrase.includes(concept))
    .flatMap(([, aliases]) => aliases);
  return [...new Set([...normalize(query), ...additions.flatMap(normalize)])];
}

function matchingPhrases(query) {
  const tokens = normalize(query);
  const phrases = [];
  for (let size = 2; size <= Math.min(4, tokens.length); size += 1) {
    for (let start = 0; start <= tokens.length - size; start += 1) phrases.push(tokens.slice(start, start + size).join(" "));
  }
  return [...new Set(phrases.filter((phrase) => phrase.length >= 5))];
}

function searchPages(query, pages, limit = 6) {
  const tokens = expandQuery(query);
  if (!tokens.length) return [];
  const phrases = matchingPhrases(query);

  return pages
    .map((page) => {
      const title = normalizePhrase(page.title);
      const content = normalizePhrase(`${page.title} ${page.text} ${(page.keywords || []).join(" ")}`);
      const matchedTerms = tokens.filter((token) => hasWord(content, token));
      const titleMatches = tokens.filter((token) => hasWord(title, token)).length;
      const phraseMatches = phrases.filter((phrase) => content.includes(phrase)).length;
      const score = matchedTerms.length + titleMatches * 3 + phraseMatches * 5;
      return { ...page, score, matchedTerms, excerpt: String(page.text || "").slice(0, 460) };
    })
    .filter((page) => page.score > 0)
    .sort((a, b) => b.score - a.score || b.matchedTerms.length - a.matchedTerms.length || a.page - b.page)
    .slice(0, limit);
}

// The search panel follows CP3-test's multi-slide rule: return pages that
// match every meaningful prompt term first; only then fall back to partial matches.
function searchSlidesByPrompt(query, pages, limit = 5) {
  const terms = [...new Set(normalize(query))];
  if (!terms.length) return [];

  const scored = pages
    .map((page) => {
      const searchable = normalizePhrase(`${page.title || ""} ${page.text || ""} ${(page.keywords || []).join(" ")}`);
      const matchedTerms = terms.filter((term) => hasWord(searchable, term));
      return {
        ...page,
        score: matchedTerms.length,
        matchedTerms,
        excerpt: String(page.text || "").slice(0, 260)
      };
    })
    .filter((page) => page.score > 0);

  const fullMatches = scored.filter((page) => page.score === terms.length);
  const results = (fullMatches.length ? fullMatches : scored)
    .sort((a, b) => b.score - a.score || a.page - b.page)
    .slice(0, Math.min(Math.max(Number(limit) || 5, 1), 10));

  return results.map((page) => ({ ...page, matchType: fullMatches.length ? "all-terms" : "partial" }));
}

module.exports = { searchPages, searchSlidesByPrompt, normalizePhrase };
