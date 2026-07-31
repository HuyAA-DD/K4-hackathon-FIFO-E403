const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function extractOutput(payload) {
  const blocks = (payload.steps || [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content || [])
    .filter((block) => block.type === "text");

  return {
    text: blocks.map((block) => block.text || "").join("\n").trim(),
    annotations: blocks.flatMap((block) => block.annotations || [])
  };
}

async function interact({ input, useGoogleSearch = false }) {
  if (!isConfigured()) {
    const error = new Error("Chưa tìm thấy GEMINI_API_KEY. Sao chép .env.example thành .env và điền key.");
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      input,
      ...(useGoogleSearch ? { tools: [{ type: "google_search" }] } : {})
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || "Gemini API trả về lỗi.");
    error.status = response.status;
    throw error;
  }
  return extractOutput(payload);
}

function getWebCitations(annotations) {
  const seen = new Set();
  return annotations
    .filter((item) => item.type === "url_citation" && item.url)
    .map((item) => ({ type: "external", title: item.title || new URL(item.url).hostname, url: item.url }))
    .filter((item) => !seen.has(item.url) && seen.add(item.url));
}

module.exports = { isConfigured, interact, getWebCitations };
