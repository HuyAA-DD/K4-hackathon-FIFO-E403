import * as pdfjsLib from "/vendor/pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";

const PDF_URL = "/slides/d1-slide-hackathon.pdf";
const BASE_SCALE = 1.2;

const wrap = document.getElementById("pdf-page-wrap");
const canvas = document.getElementById("pdf-canvas");
const textLayerDiv = document.getElementById("text-layer");
const annotCanvas = document.getElementById("annot-canvas");
const popover = document.getElementById("selection-popover");
const askSelectionBtn = document.getElementById("ask-selection");
const pageIndicator = document.getElementById("page-indicator");
const pageFooterLabel = document.getElementById("page-footer-label");
const zoomLabel = document.getElementById("zoom-label");
const toolCaption = document.getElementById("tool-caption");

const readBtn = document.getElementById("tool-read");
const penBtn = document.getElementById("tool-pen");
const highlightBtn = document.getElementById("tool-highlight");
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

const toolButtons = { read: readBtn, pen: penBtn, highlight: highlightBtn };

let pdfDoc = null;
let numPages = 1;
let currentPage = 1;
let scale = BASE_SCALE;
let currentTool = "read";
let drawing = false;
let currentStroke = null;
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

// ---------------- PDF rendering ----------------
async function renderPage(pageNum) {
  hidePopover();
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  wrap.style.width = `${viewport.width}px`;
  wrap.style.height = `${viewport.height}px`;
  wrap.style.setProperty("--scale-factor", String(scale));
  wrap.style.setProperty("--total-scale-factor", String(scale));
  wrap.style.setProperty("--user-unit", "1");
  wrap.style.setProperty("--min-font-size", "1");
  wrap.style.setProperty("--scale-round-x", "1px");
  wrap.style.setProperty("--scale-round-y", "1px");

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;

  textLayerDiv.replaceChildren();
  textLayerDiv.style.width = `${viewport.width}px`;
  textLayerDiv.style.height = `${viewport.height}px`;
  const textContent = await page.getTextContent();
  const textLayer = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport });
  await textLayer.render();

  annotCanvas.width = viewport.width;
  annotCanvas.height = viewport.height;

  currentPage = pageNum;
  redrawAnnotations();
  pageIndicator.textContent = `Trang ${pageNum} · Tài liệu bài giảng`;
  pageFooterLabel.textContent = `Slide ${pageNum}/${numPages} · từ data pack`;
  zoomLabel.textContent = `${Math.round((scale / BASE_SCALE) * 100)}%`;
}

function goToPage(n) {
  if (n < 1 || n > numPages || n === currentPage) return;
  renderPage(n);
}
prevPageBtn.addEventListener("click", () => goToPage(currentPage - 1));
nextPageBtn.addEventListener("click", () => goToPage(currentPage + 1));

zoomInBtn.addEventListener("click", () => {
  scale = Math.min(scale + 0.18, BASE_SCALE * 2.2);
  renderPage(currentPage);
});
zoomOutBtn.addEventListener("click", () => {
  scale = Math.max(scale - 0.18, BASE_SCALE * 0.6);
  renderPage(currentPage);
});

// ---------------- Tools ----------------
function setTool(tool) {
  currentTool = tool;
  Object.entries(toolButtons).forEach(([key, btn]) => btn.classList.toggle("active", key === tool));
  wrap.classList.toggle("tool-pen", tool === "pen");
  toolCaption.textContent =
    tool === "pen"
      ? "Chế độ vẽ ghi chú tay"
      : tool === "highlight"
        ? "Bôi đen đoạn cần hỏi — sẽ lưu highlight trên trang"
        : "Đang xem PDF · Day 1 Foundation";
  hidePopover();
}
readBtn.addEventListener("click", () => setTool("read"));
penBtn.addEventListener("click", () => setTool("pen"));
highlightBtn.addEventListener("click", () => setTool("highlight"));
clearBtn.addEventListener("click", () => {
  annotationsByPage.delete(currentPage);
  redrawAnnotations();
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

function redrawAnnotations() {
  const ctx = annotCanvas.getContext("2d");
  ctx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);
  const data = annotationsByPage.get(currentPage);
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
  if (drawing && currentStroke && currentStroke.length > 1) {
    ctx.strokeStyle = "#e6333e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawStroke(ctx, currentStroke);
  }
}

function addPoint(e) {
  const rect = annotCanvas.getBoundingClientRect();
  currentStroke.push([(e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale]);
}
annotCanvas.addEventListener("pointerdown", (e) => {
  if (currentTool !== "pen") return;
  drawing = true;
  currentStroke = [];
  addPoint(e);
});
annotCanvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  addPoint(e);
  redrawAnnotations();
});
window.addEventListener("pointerup", () => {
  if (drawing && currentStroke && currentStroke.length > 1) {
    getPageAnnotations(currentPage).pen.push(currentStroke);
  }
  drawing = false;
  currentStroke = null;
  redrawAnnotations();
});

// ---------------- Highlight-to-ask ----------------
function getPdfSpaceRects(range) {
  const wrapRect = wrap.getBoundingClientRect();
  return Array.from(range.getClientRects()).map((r) => [
    (r.left - wrapRect.left) / scale,
    (r.top - wrapRect.top) / scale,
    r.width / scale,
    r.height / scale
  ]);
}
function hidePopover() {
  popover.classList.add("is-hidden");
}
function showPopoverForSelection(sel) {
  const range = sel.getRangeAt(0);
  const rangeRect = range.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  popover.style.left = `${rangeRect.left - wrapRect.left + rangeRect.width / 2}px`;
  popover.style.top = `${rangeRect.top - wrapRect.top}px`;
  popover.classList.remove("is-hidden");
}
wrap.addEventListener("pointerdown", (e) => {
  if (e.target !== askSelectionBtn) hidePopover();
});
document.addEventListener("pointerup", (e) => {
  if (currentTool === "pen" || e.target === askSelectionBtn) return;
  setTimeout(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      hidePopover();
      return;
    }
    const anchor = sel.anchorNode;
    const anchorEl = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentNode);
    if (!anchorEl || !textLayerDiv.contains(anchorEl)) {
      hidePopover();
      return;
    }
    showPopoverForSelection(sel);
  }, 0);
});
askSelectionBtn.addEventListener("click", () => {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const text = sel.toString().trim();
  if (!text) return;
  if (currentTool === "highlight") {
    const range = sel.getRangeAt(0);
    getPageAnnotations(currentPage).highlights.push({ rects: getPdfSpaceRects(range), text });
    redrawAnnotations();
  }
  sel.removeAllRanges();
  hidePopover();
  sendQuestion(`Giải thích đoạn mình vừa bôi đen trên trang ${currentPage}.`, text);
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
    btn.addEventListener("click", () => goToPage(Number(btn.dataset.page)));
  });
  messagesEl.append(el);
  scrollMessages();
}

function setComposerDisabled(disabled) {
  form.classList.toggle("is-disabled", disabled);
}

async function sendQuestion(question, selectionText) {
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
        page: currentPage,
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
  pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;
  numPages = pdfDoc.numPages;
  await renderPage(1);
}
init().catch((err) => {
  console.error(err);
  appendErrorMessage(`Không tải được PDF slide: ${err.message}`);
});
