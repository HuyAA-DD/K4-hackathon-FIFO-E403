import * as pdfjsLib from "/vendor/pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";

const PDF_URL = "/slides/d1-slide-hackathon.pdf";
const BASE_SCALE = 1.2;

const pdfStage = document.getElementById("pdf-stage");
const pdfScroll = document.getElementById("pdf-scroll");
const applyHighlightBtn = document.getElementById("apply-highlight");
const askSelectionBtn = document.getElementById("ask-selection");
const pageIndicator = document.getElementById("page-indicator");
const pageFooterLabel = document.getElementById("page-footer-label");
const zoomLabel = document.getElementById("zoom-label");
const toolCaption = document.getElementById("tool-caption");

const readBtn = document.getElementById("tool-read");
const penBtn = document.getElementById("tool-pen");
const clearBtn = document.getElementById("clear-annotations");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");

const panel = document.getElementById("tutor-panel");
const panelToggle = document.getElementById("tutor-toggle");
const closePanelBtn = document.getElementById("close-tutor");
const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("question-input");

const toolButtons = { read: readBtn, pen: penBtn };

let pdfDoc = null;
let numPages = 1;
let currentPage = 1;
let scale = BASE_SCALE;
let currentTool = "read";
let isRendering = false;
let drawing = false;
let drawingPage = null;
let currentStroke = null;
let pageObserver = null;

const wrapsByPage = new Map(); // page -> { page, wrapEl, canvasEl, textLayerEl, annotCanvasEl }
const annotationsByPage = new Map();
const conversationHistory = [];

// ---------------- Panel ----------------
function setPanel(open) {
  panel.classList.toggle("is-hidden", !open);
  panelToggle.classList.toggle("is-collapsed", !open);
  panelToggle.textContent = open ? "›" : "‹";
  panelToggle.setAttribute("aria-expanded", String(open));
}
panelToggle.addEventListener("click", () => setPanel(panel.classList.contains("is-hidden")));
closePanelBtn.addEventListener("click", () => setPanel(false));

// ---------------- PDF viewer: build + render all pages (scrollable) ----------------
function buildPageShells() {
  pdfScroll.replaceChildren();
  wrapsByPage.clear();
  for (let p = 1; p <= numPages; p++) {
    const wrapEl = document.createElement("div");
    wrapEl.className = "pdf-page-wrap";
    wrapEl.dataset.page = String(p);
    wrapEl.innerHTML = `<canvas class="pdf-canvas"></canvas><div class="textLayer"></div><canvas class="annot-canvas"></canvas>`;
    pdfScroll.appendChild(wrapEl);
    wrapsByPage.set(p, {
      page: p,
      wrapEl,
      canvasEl: wrapEl.querySelector(".pdf-canvas"),
      textLayerEl: wrapEl.querySelector(".textLayer"),
      annotCanvasEl: wrapEl.querySelector(".annot-canvas")
    });
  }
}

async function renderPage(pageNum) {
  const entry = wrapsByPage.get(pageNum);
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  entry.wrapEl.style.width = `${viewport.width}px`;
  entry.wrapEl.style.height = `${viewport.height}px`;
  entry.wrapEl.style.setProperty("--scale-factor", String(scale));
  entry.wrapEl.style.setProperty("--total-scale-factor", String(scale));
  entry.wrapEl.style.setProperty("--user-unit", "1");
  entry.wrapEl.style.setProperty("--min-font-size", "1");
  entry.wrapEl.style.setProperty("--scale-round-x", "1px");
  entry.wrapEl.style.setProperty("--scale-round-y", "1px");

  entry.canvasEl.width = viewport.width;
  entry.canvasEl.height = viewport.height;
  await page.render({ canvasContext: entry.canvasEl.getContext("2d"), viewport }).promise;

  entry.textLayerEl.replaceChildren();
  entry.textLayerEl.style.width = `${viewport.width}px`;
  entry.textLayerEl.style.height = `${viewport.height}px`;
  const textContent = await page.getTextContent();
  const textLayer = new pdfjsLib.TextLayer({ textContentSource: textContent, container: entry.textLayerEl, viewport });
  await textLayer.render();

  entry.annotCanvasEl.width = viewport.width;
  entry.annotCanvasEl.height = viewport.height;
  redrawAnnotationsForPage(pageNum);
}

async function renderAllPages() {
  for (let p = 1; p <= numPages; p++) {
    pageIndicator.textContent = `Đang tải trang ${p}/${numPages}...`;
    await renderPage(p);
  }
  updatePageLabel();
  zoomLabel.textContent = `${Math.round((scale / BASE_SCALE) * 100)}%`;
}

function setupIntersectionObserver() {
  if (pageObserver) pageObserver.disconnect();
  pageObserver = new IntersectionObserver(
    (entries) => {
      let best = null;
      for (const e of entries) {
        if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e;
      }
      if (best) {
        const p = Number(best.target.dataset.page);
        if (p && p !== currentPage) {
          currentPage = p;
          updatePageLabel();
        }
      }
    },
    { root: pdfStage, threshold: [0.25, 0.5, 0.75] }
  );
  wrapsByPage.forEach((entry) => pageObserver.observe(entry.wrapEl));
}

function updatePageLabel() {
  pageIndicator.textContent = `Trang ${currentPage} · Tài liệu bài giảng`;
  pageFooterLabel.textContent = `Slide ${currentPage}/${numPages} · từ data pack`;
}

function scrollToPage(pageNum, { smooth = false } = {}) {
  const entry = wrapsByPage.get(pageNum);
  if (!entry) return;
  entry.wrapEl.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}

prevPageBtn.addEventListener("click", () => scrollToPage(Math.max(1, currentPage - 1), { smooth: true }));
nextPageBtn.addEventListener("click", () => scrollToPage(Math.min(numPages, currentPage + 1), { smooth: true }));

async function applyZoom(newScale) {
  if (isRendering) return;
  isRendering = true;
  scale = newScale;
  const anchorPage = currentPage;
  await renderAllPages();
  scrollToPage(anchorPage);
  isRendering = false;
}
zoomInBtn.addEventListener("click", () => applyZoom(Math.min(scale + 0.18, BASE_SCALE * 2.2)));
zoomOutBtn.addEventListener("click", () => applyZoom(Math.max(scale - 0.18, BASE_SCALE * 0.6)));

// ---------------- Tools ----------------
function setTool(tool) {
  currentTool = tool;
  Object.entries(toolButtons).forEach(([key, btn]) => btn.classList.toggle("active", key === tool));
  pdfScroll.classList.toggle("tool-pen", tool === "pen");
  toolCaption.textContent =
    tool === "pen" ? "Chế độ vẽ ghi chú tay" : "Bôi đen đoạn slide, rồi bấm Highlight hoặc Hỏi AI trên toolbar";
}
readBtn.addEventListener("click", () => setTool("read"));
penBtn.addEventListener("click", () => setTool("pen"));
clearBtn.addEventListener("click", () => {
  annotationsByPage.delete(currentPage);
  redrawAnnotationsForPage(currentPage);
});

function getPageAnnotations(page) {
  if (!annotationsByPage.has(page)) annotationsByPage.set(page, { pen: [], highlights: [] });
  return annotationsByPage.get(page);
}

function drawStroke(ctx, stroke) {
  ctx.beginPath();
  stroke.forEach(([x, y], i) => {
    const px = x * scale;
    const py = y * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function redrawAnnotationsForPage(pageNum) {
  const entry = wrapsByPage.get(pageNum);
  if (!entry) return;
  const ctx = entry.annotCanvasEl.getContext("2d");
  ctx.clearRect(0, 0, entry.annotCanvasEl.width, entry.annotCanvasEl.height);
  const data = annotationsByPage.get(pageNum);
  if (data) {
    ctx.fillStyle = "rgba(255,214,0,0.38)";
    for (const h of data.highlights) {
      for (const [x, y, w, hgt] of h.rects) {
        ctx.fillRect(x * scale, y * scale, w * scale, hgt * scale);
      }
    }
    ctx.strokeStyle = "#e6333e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of data.pen) drawStroke(ctx, stroke);
  }
  if (drawing && drawingPage === pageNum && currentStroke && currentStroke.length > 1) {
    ctx.strokeStyle = "#e6333e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawStroke(ctx, currentStroke);
  }
}

function addPoint(e, canvasEl) {
  const rect = canvasEl.getBoundingClientRect();
  currentStroke.push([(e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale]);
}
pdfScroll.addEventListener("pointerdown", (e) => {
  if (currentTool !== "pen") return;
  const canvasEl = e.target.closest(".annot-canvas");
  if (!canvasEl) return;
  const wrapEl = canvasEl.closest(".pdf-page-wrap");
  drawingPage = Number(wrapEl.dataset.page);
  drawing = true;
  currentStroke = [];
  addPoint(e, canvasEl);
});
pdfScroll.addEventListener("pointermove", (e) => {
  if (!drawing || !drawingPage) return;
  const entry = wrapsByPage.get(drawingPage);
  if (!entry) return;
  addPoint(e, entry.annotCanvasEl);
  redrawAnnotationsForPage(drawingPage);
});
window.addEventListener("pointerup", () => {
  if (drawing && drawingPage && currentStroke && currentStroke.length > 1) {
    getPageAnnotations(drawingPage).pen.push(currentStroke);
  }
  const finishedPage = drawingPage;
  drawing = false;
  currentStroke = null;
  drawingPage = null;
  if (finishedPage) redrawAnnotationsForPage(finishedPage);
});

// ---------------- Highlight & Hỏi AI (nút trên toolbar, tác động lên đoạn đang bôi đen) ----------------
function getPageWrapFromNode(node) {
  const el = node && (node.nodeType === 1 ? node : node.parentNode);
  const wrapEl = el && el.closest && el.closest(".pdf-page-wrap");
  return wrapEl ? wrapsByPage.get(Number(wrapEl.dataset.page)) : null;
}
function getPdfSpaceRects(range, wrapEl) {
  const wrapRect = wrapEl.getBoundingClientRect();
  return Array.from(range.getClientRects()).map((r) => [
    (r.left - wrapRect.left) / scale,
    (r.top - wrapRect.top) / scale,
    r.width / scale,
    r.height / scale
  ]);
}
function getActiveSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return null;
  const text = sel.toString().trim();
  if (!text) return null;
  const entry = getPageWrapFromNode(sel.anchorNode);
  if (!entry) return null;
  return { sel, text, entry };
}
function flashCaption(message) {
  const previous = toolCaption.textContent;
  toolCaption.textContent = message;
  setTimeout(() => {
    toolCaption.textContent = previous;
  }, 1800);
}
applyHighlightBtn.addEventListener("click", () => {
  const info = getActiveSelection();
  if (!info) {
    flashCaption("⚠ Hãy bôi đen một đoạn trên slide trước");
    return;
  }
  const range = info.sel.getRangeAt(0);
  getPageAnnotations(info.entry.page).highlights.push({ rects: getPdfSpaceRects(range, info.entry.wrapEl), text: info.text });
  redrawAnnotationsForPage(info.entry.page);
  info.sel.removeAllRanges();
});
askSelectionBtn.addEventListener("click", () => {
  const info = getActiveSelection();
  if (!info) {
    flashCaption("⚠ Hãy bôi đen một đoạn trên slide trước");
    return;
  }
  const pageNum = info.entry.page;
  info.sel.removeAllRanges();
  sendQuestion(`Giải thích đoạn mình vừa bôi đen trên trang ${pageNum}.`, info.text, pageNum);
});

// ---------------- Chat ----------------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function scrollMessages() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function appendUserMessage(text) {
  const el = document.createElement("article");
  el.className = "message user-message";
  el.textContent = text;
  messagesEl.append(el);
  scrollMessages();
}
function appendTypingMessage() {
  const el = document.createElement("article");
  el.className = "message tutor-message is-typing";
  el.innerHTML = `Đang đọc slide và soạn câu trả lời <span class="typing-dots"><span></span><span></span><span></span></span>`;
  messagesEl.append(el);
  scrollMessages();
  return el;
}
function appendErrorMessage(msg) {
  const el = document.createElement("article");
  el.className = "message tutor-message";
  el.innerHTML = `<p>⚠ ${escapeHtml(msg)}</p>`;
  messagesEl.append(el);
  scrollMessages();
}
function appendTutorMessage(result, trace) {
  const el = document.createElement("article");
  el.className = "message tutor-message";
  const parts = [`<p>${escapeHtml(result.answer || "")}</p>`];

  if (result.source_type === "slide") {
    const lines =
      (result.citations || [])
        .map(
          (c) =>
            `<p class="citation-quote">Trang ${Number(c.page) || "?"}: “${escapeHtml(c.quote || "")}”<button type="button" class="jump-page" data-page="${Number(c.page) || 1}">→ Xem trang ${Number(c.page) || "?"}</button></p>`
        )
        .join("") || `<p class="citation-quote">(không có trích dẫn cụ thể)</p>`;
    parts.push(`<div class="citation"><span>Trong tài liệu</span>${lines}</div>`);
  } else if (result.source_type === "external") {
    const name = escapeHtml(result.external_source?.name || "Nguồn ngoài không xác định");
    const note = result.external_source?.note ? `<p class="citation-quote">${escapeHtml(result.external_source.note)}</p>` : "";
    parts.push(`<div class="citation external"><span>Nguồn ngoài</span><strong>${name}</strong>${note}</div>`);
  } else {
    const q = result.clarifying_question
      ? `<p class="citation-quote"><strong>Hỏi lại:</strong> ${escapeHtml(result.clarifying_question)}</p>`
      : `<p class="citation-quote">Chưa tìm thấy căn cứ đáng tin trong slide.</p>`;
    parts.push(`<div class="citation insufficient"><span>Chưa đủ căn cứ</span>${q}</div>`);
  }

  if (result.scope_note) parts.push(`<p class="scope-note">${escapeHtml(result.scope_note)}</p>`);

  if (Array.isArray(trace) && trace.length) {
    const items = trace
      .map((t) => {
        if (t.tool === "search_slides") {
          return `<li>🔍 Tìm “${escapeHtml(t.query || "")}” → trang ${(t.result_pages || []).join(", ") || "—"}</li>`;
        }
        if (t.tool === "final_answer") {
          return `<li>✅ Trả lời với source_type = ${escapeHtml(t.args?.source_type || "?")}</li>`;
        }
        return "";
      })
      .join("");
    parts.push(`<details class="trace-details"><summary>Vì sao Tutor trả lời vậy?</summary><ul>${items}</ul></details>`);
  }

  el.innerHTML = parts.join("");
  el.querySelectorAll(".jump-page").forEach((btn) => {
    btn.addEventListener("click", () => scrollToPage(Number(btn.dataset.page), { smooth: true }));
  });
  messagesEl.append(el);
  scrollMessages();
}

function setComposerDisabled(disabled) {
  form.classList.toggle("is-disabled", disabled);
}

async function sendQuestion(question, selectionText, pageOverride) {
  const trimmed = (question || "").trim();
  if (!trimmed) return;
  if (panel.classList.contains("is-hidden")) setPanel(true);
  appendUserMessage(trimmed);
  const typingEl = appendTypingMessage();
  setComposerDisabled(true);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: trimmed,
        page: pageOverride || currentPage,
        selection: selectionText || null,
        history: conversationHistory
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Lỗi máy chủ (${response.status})`);
    typingEl.remove();
    appendTutorMessage(data.result, data.trace);
    conversationHistory.push({ role: "user", content: trimmed });
    conversationHistory.push({ role: "assistant", content: data.result.answer || "" });
    if (conversationHistory.length > 12) conversationHistory.splice(0, conversationHistory.length - 12);
  } catch (err) {
    typingEl.remove();
    appendErrorMessage(err.message || "Không gọi được AI lúc này.");
  } finally {
    setComposerDisabled(false);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  input.value = "";
  sendQuestion(question, null);
});
document.querySelectorAll("[data-question]").forEach((btn) => {
  btn.addEventListener("click", () => sendQuestion(btn.dataset.question, null));
});

// ---------------- Boot ----------------
async function init() {
  pdfDoc = await pdfjsLib.getDocument({ url: PDF_URL }).promise;
  numPages = pdfDoc.numPages;
  buildPageShells();
  await renderAllPages();
  setupIntersectionObserver();
}
init().catch((err) => {
  console.error(err);
  appendErrorMessage(`Không tải được PDF slide: ${err.message}`);
});
