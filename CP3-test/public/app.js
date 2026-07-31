import * as pdfjsLib from "/vendor/pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";

const BASE_SCALE = 1.2;

// ---------------- Deck registry: 2 bộ slide mặc định (đọc được cả server-side cho AI) + slide tự thêm (chỉ cache trình duyệt) ----------------
const BUILTIN_DECKS = {
  d1: { id: "d1", kind: "builtin", label: "Day 1 · AI & LLM Foundation", file: "d1-slide-hackathon.pdf", url: "/slides/d1-slide-hackathon.pdf" },
  d2: { id: "d2", kind: "builtin", label: "Day 2 · Xác định bài toán cho AI", file: "d2-slide-hackathon.pdf", url: "/slides/d2-slide-hackathon.pdf" }
};
const LAST_DECK_KEY = "vlearn:lastDeck";
const DECK_LABELS = { d1: "Day 1", d2: "Day 2" };

const pdfStage = document.getElementById("pdf-stage");
const pdfScroll = document.getElementById("pdf-scroll");
const selectionPopup = document.getElementById("selection-popup");
const popupHighlightBtn = document.getElementById("popup-highlight");
const popupAskBtn = document.getElementById("popup-ask");
const popupDeleteBtn = document.getElementById("popup-delete");
const pageIndicator = document.getElementById("page-indicator");
const pageFooterLabel = document.getElementById("page-footer-label");
const zoomLabel = document.getElementById("zoom-label");
const toolCaption = document.getElementById("tool-caption");
const topbarFilenameEl = document.getElementById("topbar-filename");
const slideDocNameEl = document.getElementById("slide-doc-name");
const tutorContextEl = document.getElementById("tutor-context");

const docSidebar = document.getElementById("doc-sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const docListEl = document.getElementById("doc-list");
const addSlideBtn = document.getElementById("add-slide-btn");
const addSlideInput = document.getElementById("add-slide-input");

const readBtn = document.getElementById("tool-read");
const highlightToolBtn = document.getElementById("tool-highlight");
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

const toolButtons = { read: readBtn, highlight: highlightToolBtn, pen: penBtn };
const FREE_HIGHLIGHT_WIDTH = 16; // độ dày highlighter tự do, tính theo đơn vị PDF (không nhân scale)

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
let activeDeckId = localStorage.getItem(LAST_DECK_KEY) || "d1";
let customDecks = []; // [{ id, name, addedAt, size, blob, arrayBuffer }]
let deckLoadToken = 0; // tăng mỗi lần switchDeck() để huỷ các lượt render dở dang của deck cũ

const wrapsByPage = new Map(); // page -> { page, wrapEl, canvasEl, textLayerEl, annotCanvasEl }
const annotationsByPage = new Map();
const conversationHistory = [];
const deckDocCache = new Map(); // deckId -> Promise<PDFDocumentProxy>
const deckNumPages = new Map(); // deckId -> number
const pageTextCache = new Map(); // "deckId:page" -> extracted text

// ---------------- Slide cache trình duyệt (IndexedDB) — tài liệu tự thêm KHÔNG gửi lên server ----------------
const IDB_NAME = "vlearn-tutor-cache";
const IDB_STORE = "customSlides";

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGetAll() {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(record) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDelete(id) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------- Deck helpers ----------------
function getDeckMetaById(id) {
  if (BUILTIN_DECKS[id]) return BUILTIN_DECKS[id];
  const custom = customDecks.find((d) => d.id === id);
  if (custom) return { id: custom.id, kind: "custom", label: custom.name, file: custom.name, arrayBuffer: custom.arrayBuffer };
  return BUILTIN_DECKS.d1;
}
function deckRegistryList() {
  const builtin = Object.values(BUILTIN_DECKS).map((d) => ({ id: d.id, label: d.label, kind: "builtin", numPages: deckNumPages.get(d.id) }));
  const custom = customDecks.map((d) => ({ id: d.id, label: d.name, kind: "custom", numPages: deckNumPages.get(d.id) }));
  return [...builtin, ...custom];
}
function getDeckDocument(meta) {
  if (!deckDocCache.has(meta.id)) {
    const loadingTask =
      meta.kind === "custom" ? pdfjsLib.getDocument({ data: meta.arrayBuffer.slice(0) }) : pdfjsLib.getDocument({ url: meta.url });
    deckDocCache.set(
      meta.id,
      loadingTask.promise.then((doc) => {
        deckNumPages.set(meta.id, doc.numPages);
        renderDocList();
        return doc;
      })
    );
  }
  return deckDocCache.get(meta.id);
}

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
  pageTextCache.set(
    `${activeDeckId}:${pageNum}`,
    textContent.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim()
  );

  entry.annotCanvasEl.width = viewport.width;
  entry.annotCanvasEl.height = viewport.height;
  redrawAnnotationsForPage(pageNum);
}

async function renderAllPages() {
  const token = deckLoadToken; // huỷ giữa chừng nếu người dùng chuyển sang deck khác trước khi render xong
  for (let p = 1; p <= numPages; p++) {
    if (token !== deckLoadToken) return;
    pageIndicator.textContent = `Đang tải trang ${p}/${numPages}...`;
    await renderPage(p);
  }
  if (token !== deckLoadToken) return;
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

function updateHeaderForDeck(meta) {
  topbarFilenameEl.textContent = meta.file || meta.label;
  slideDocNameEl.textContent = meta.file || meta.label;
  tutorContextEl.textContent = `Ngữ cảnh: ${meta.label}${meta.file ? " · " + meta.file : ""}`;
  setTool(currentTool); // làm mới caption đáy trang — text mặc định "Day 1 Foundation" trong HTML gốc không tự cập nhật khi đổi deck
}

function scrollToPage(pageNum, { smooth = false } = {}) {
  const entry = wrapsByPage.get(pageNum);
  if (!entry) return;
  hideSelectionPopup();
  entry.wrapEl.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}

prevPageBtn.addEventListener("click", () => scrollToPage(Math.max(1, currentPage - 1), { smooth: true }));
nextPageBtn.addEventListener("click", () => scrollToPage(Math.min(numPages, currentPage + 1), { smooth: true }));

async function applyZoom(newScale) {
  if (isRendering) return;
  isRendering = true;
  hideSelectionPopup();
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
  pdfScroll.classList.toggle("tool-highlight", tool === "highlight");
  toolCaption.textContent =
    tool === "pen"
      ? "Chế độ vẽ ghi chú tay"
      : tool === "highlight"
        ? "Kéo chuột để tô highlight tự do — dùng được cả trên ảnh/biểu đồ không phải text"
        : "Bôi đen đoạn text để hiện menu Highlight / Hỏi AI · bấm vào highlight cũ để xoá";
  hideSelectionPopup();
}
readBtn.addEventListener("click", () => setTool("read"));
highlightToolBtn.addEventListener("click", () => setTool("highlight"));
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
    // Highlight từ bôi đen text thật: vùng chữ nhật khớp theo dòng chữ.
    ctx.fillStyle = "rgba(255,214,0,0.38)";
    for (const h of data.highlights) {
      if (h.kind === "free") continue;
      for (const [x, y, w, hgt] of h.rects) {
        ctx.fillRect(x * scale, y * scale, w * scale, hgt * scale);
      }
    }
    // Highlight tự do (kéo chuột như vẽ): dùng được cả trên ảnh/biểu đồ không có text layer.
    ctx.strokeStyle = "rgba(255,214,0,0.38)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const h of data.highlights) {
      if (h.kind !== "free") continue;
      ctx.lineWidth = (h.width || FREE_HIGHLIGHT_WIDTH) * scale;
      drawStroke(ctx, h.points);
    }
    ctx.strokeStyle = "#e6333e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of data.pen) drawStroke(ctx, stroke);
  }
  if (drawing && drawingPage === pageNum && currentStroke && currentStroke.length > 1) {
    if (currentTool === "highlight") {
      ctx.strokeStyle = "rgba(255,214,0,0.38)";
      ctx.lineWidth = FREE_HIGHLIGHT_WIDTH * scale;
    } else {
      ctx.strokeStyle = "#e6333e";
      ctx.lineWidth = 2.5;
    }
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
  if (currentTool !== "pen" && currentTool !== "highlight") return;
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
    if (currentTool === "highlight") {
      getPageAnnotations(drawingPage).highlights.push({ kind: "free", points: currentStroke, width: FREE_HIGHLIGHT_WIDTH });
    } else {
      getPageAnnotations(drawingPage).pen.push(currentStroke);
    }
  }
  const finishedPage = drawingPage;
  drawing = false;
  currentStroke = null;
  drawingPage = null;
  if (finishedPage) redrawAnnotationsForPage(finishedPage);
});

// ---------------- Highlight & Hỏi AI: popup nổi cạnh vùng bôi đen (kiểu Edge PDF) ----------------
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

// pendingSelection: { range, text, page } khi popup đang ở mode "select"
// pendingDelete: { page, index } khi popup đang ở mode "delete"
let pendingSelection = null;
let pendingDelete = null;

function placePopup(centerX, aboveY, belowY) {
  selectionPopup.classList.remove("is-hidden");
  const pw = selectionPopup.offsetWidth;
  const ph = selectionPopup.offsetHeight;
  let top = aboveY - ph - 10;
  let below = false;
  if (top < 8) {
    top = belowY + 10;
    below = true;
  }
  let left = centerX - pw / 2;
  left = Math.min(Math.max(8, left), window.innerWidth - pw - 8);
  selectionPopup.classList.toggle("popup-below", below);
  selectionPopup.style.left = `${left}px`;
  selectionPopup.style.top = `${top}px`;
}

function hideSelectionPopup() {
  selectionPopup.classList.add("is-hidden");
  selectionPopup.classList.remove("mode-select", "mode-delete", "popup-below");
  pendingSelection = null;
  pendingDelete = null;
}

function showSelectPopupForRange(range, text, pageNum) {
  pendingDelete = null;
  pendingSelection = { range: range.cloneRange(), text, page: pageNum };
  selectionPopup.classList.remove("mode-delete");
  selectionPopup.classList.add("mode-select");
  const rect = range.getBoundingClientRect();
  placePopup(rect.left + rect.width / 2, rect.top, rect.bottom);
}

function showDeletePopupAt(clientX, clientY, pageNum, index) {
  pendingSelection = null;
  pendingDelete = { page: pageNum, index };
  selectionPopup.classList.remove("mode-select");
  selectionPopup.classList.add("mode-delete");
  placePopup(clientX, clientY, clientY);
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function findHighlightHit(pageNum, px, py) {
  const data = annotationsByPage.get(pageNum);
  if (!data) return -1;
  return data.highlights.findIndex((h) => {
    if (h.kind === "free") {
      const halfWidth = (h.width || FREE_HIGHLIGHT_WIDTH) / 2;
      const pts = h.points;
      if (pts.length === 1) return Math.hypot(px - pts[0][0], py - pts[0][1]) <= halfWidth;
      for (let i = 0; i < pts.length - 1; i++) {
        if (pointToSegmentDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= halfWidth) return true;
      }
      return false;
    }
    return h.rects.some(([x, y, w, hgt]) => px >= x && px <= x + w && py >= y && py <= y + hgt);
  });
}

// Bấm ra ngoài popup (và không tạo lựa chọn mới) → ẩn popup, không chặn hành vi click gốc.
document.addEventListener("pointerdown", (e) => {
  if (!selectionPopup.classList.contains("is-hidden") && !selectionPopup.contains(e.target)) {
    hideSelectionPopup();
  }
});
// Cuộn/zoom/đổi trang làm toạ độ popup cũ sai vị trí → ẩn luôn cho an toàn.
pdfStage.addEventListener("scroll", () => hideSelectionPopup());

pdfScroll.addEventListener("mouseup", (e) => {
  if (currentTool !== "read") return;
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.toString().trim()) {
    const text = sel.toString().trim();
    const entry = getPageWrapFromNode(sel.anchorNode);
    if (entry) {
      showSelectPopupForRange(sel.getRangeAt(0), text, entry.page);
      return;
    }
  }
  // Không có lựa chọn text mới — kiểm tra có đang bấm trúng một highlight có sẵn không.
  const wrapEl = e.target.closest(".pdf-page-wrap");
  if (!wrapEl) return;
  const pageNum = Number(wrapEl.dataset.page);
  const wrapRect = wrapEl.getBoundingClientRect();
  const px = (e.clientX - wrapRect.left) / scale;
  const py = (e.clientY - wrapRect.top) / scale;
  const hitIndex = findHighlightHit(pageNum, px, py);
  if (hitIndex >= 0) {
    showDeletePopupAt(e.clientX, e.clientY, pageNum, hitIndex);
  }
});

popupHighlightBtn.addEventListener("click", () => {
  if (!pendingSelection) return;
  const entry = wrapsByPage.get(pendingSelection.page);
  if (entry) {
    getPageAnnotations(pendingSelection.page).highlights.push({
      kind: "rect",
      rects: getPdfSpaceRects(pendingSelection.range, entry.wrapEl),
      text: pendingSelection.text
    });
    redrawAnnotationsForPage(pendingSelection.page);
  }
  window.getSelection()?.removeAllRanges();
  hideSelectionPopup();
});

popupAskBtn.addEventListener("click", () => {
  if (!pendingSelection) return;
  const { text, page } = pendingSelection;
  window.getSelection()?.removeAllRanges();
  hideSelectionPopup();
  sendQuestion(`Giải thích đoạn mình vừa bôi đen trên trang ${page}.`, text, page);
});

popupDeleteBtn.addEventListener("click", () => {
  if (!pendingDelete) return;
  const data = annotationsByPage.get(pendingDelete.page);
  if (data) {
    data.highlights.splice(pendingDelete.index, 1);
    redrawAnnotationsForPage(pendingDelete.page);
  }
  hideSelectionPopup();
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
function appendTutorMessage(result, trace, activeMeta) {
  const el = document.createElement("article");
  el.className = "message tutor-message";
  const parts = [`<p>${escapeHtml(result.answer || "")}</p>`];

  if (result.source_type === "insufficient") {
    const q = result.clarifying_question
      ? `<p class="citation-quote"><strong>Hỏi lại:</strong> ${escapeHtml(result.clarifying_question)}</p>`
      : `<p class="citation-quote">Chưa tìm thấy căn cứ đáng tin cho câu hỏi này.</p>`;
    parts.push(`<div class="citation insufficient"><span>Chưa đủ căn cứ</span>${q}</div>`);
  }

  // Dropdown 1: trích dẫn trực tiếp từ slide/tài liệu đang xem.
  const slideCitations = result.source_type === "slide" ? result.citations || [] : [];
  const slideBody = slideCitations.length
    ? slideCitations
        .map((c) => {
          const pageNum = Number(c.page) || "?";
          let deckLabel;
          let canJump;
          if (c.deck && DECK_LABELS[c.deck]) {
            deckLabel = DECK_LABELS[c.deck];
            canJump = c.deck === activeMeta.id;
          } else {
            deckLabel = activeMeta.kind === "custom" ? activeMeta.label : DECK_LABELS.d1;
            canJump = true;
          }
          const jumpBtn = canJump ? `<button type="button" class="jump-page" data-page="${pageNum}">→ Xem trang ${pageNum}</button>` : "";
          return `<p class="citation-quote">${escapeHtml(deckLabel)} · Trang ${pageNum}: “${escapeHtml(c.quote || "")}”${jumpBtn}</p>`;
        })
        .join("")
    : `<p class="dd-empty">Câu trả lời này không có trích dẫn trực tiếp từ slide.</p>`;
  parts.push(
    `<details class="citation-dropdown slide-dd"><summary>📄 Trích dẫn từ slide${slideCitations.length ? ` (${slideCitations.length})` : ""}</summary><div class="dd-body">${slideBody}</div></details>`
  );

  // Dropdown 2: tham khảo thêm — link ngoài (further_reading) hoặc tên nguồn ngoài (external_source) nếu có.
  const fr = result.further_reading;
  let refBody;
  if (fr?.url) {
    const linkLabel = escapeHtml(fr.title || fr.url);
    refBody =
      `<p class="citation-quote"><a href="${escapeHtml(fr.url)}" target="_blank" rel="noopener noreferrer">${linkLabel}</a></p>` +
      (fr.note ? `<p class="citation-quote">${escapeHtml(fr.note)}</p>` : "") +
      `<span class="dd-disclaimer">Đường link do AI gợi ý — tự kiểm tra trước khi dùng.</span>`;
  } else if (result.source_type === "external" && result.external_source?.name) {
    refBody =
      `<p class="citation-quote"><strong>${escapeHtml(result.external_source.name)}</strong></p>` +
      (result.external_source.note ? `<p class="citation-quote">${escapeHtml(result.external_source.note)}</p>` : "");
  } else {
    refBody = `<p class="dd-empty">Không có nguồn ngoài được đề xuất cho câu trả lời này.</p>`;
  }
  parts.push(`<details class="citation-dropdown external-dd"><summary>🔗 Tham khảo thêm</summary><div class="dd-body">${refBody}</div></details>`);

  if (result.scope_note) parts.push(`<p class="scope-note">${escapeHtml(result.scope_note)}</p>`);

  if (Array.isArray(trace) && trace.length) {
    const items = trace
      .map((t) => {
        const deckLabel = DECK_LABELS[t.deck] || t.deck || "?";
        const cacheTag = t.cached ? " <em>(cache)</em>" : "";
        if (t.tool === "list_slide_decks") {
          return `<li>🗂️ Xem danh sách bộ slide hiện có${cacheTag}</li>`;
        }
        if (t.tool === "search_slides") {
          return `<li>🔍 Tìm “${escapeHtml(t.query || "")}” trong ${deckLabel} → trang ${(t.result_pages || []).join(", ") || "—"}${cacheTag}</li>`;
        }
        if (t.tool === "read_slide_page") {
          return `<li>📖 Đọc toàn văn ${deckLabel} · Trang ${t.page ?? "?"}${t.found ? "" : " (không tìm thấy)"}${cacheTag}</li>`;
        }
        if (t.tool === "cite_external_source") {
          const reused = t.reused_citation ? " — trích dẫn cũ, đã dùng trước đó" : "";
          const auto = t.auto ? " (server tự đăng ký)" : "";
          return `<li>🌐 Đăng ký nguồn ngoài “${escapeHtml(t.topic || "")}”${reused}${auto}${cacheTag}</li>`;
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
    const meta = getDeckMetaById(activeDeckId);
    const pageNum = pageOverride || currentPage;
    const payload = {
      question: trimmed,
      page: pageNum,
      selection: selectionText || null,
      history: conversationHistory
    };
    if (meta.kind === "custom") {
      const neighborPages = [pageNum - 1, pageNum + 1].filter((p) => p >= 1 && p <= numPages);
      payload.customDoc = {
        label: meta.label,
        page: pageNum,
        numPages,
        pageText: pageTextCache.get(`${meta.id}:${pageNum}`) || "",
        neighborText: neighborPages
          .map((p) => (pageTextCache.has(`${meta.id}:${p}`) ? `[Trang ${p}] ${pageTextCache.get(`${meta.id}:${p}`)}` : ""))
          .filter(Boolean)
          .join("\n\n")
      };
    } else {
      payload.deck = meta.id;
    }
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Lỗi máy chủ (${response.status})`);
    typingEl.remove();
    appendTutorMessage(data.result, data.trace, meta);
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

// ---------------- Sidebar: danh sách slide + chuyển bộ đang xem ----------------
function renderDocList() {
  docListEl.replaceChildren();
  for (const d of deckRegistryList()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "doc-item" + (d.id === activeDeckId ? " is-active" : "");
    btn.dataset.deckId = d.id;
    btn.innerHTML = `
      <span class="doc-item-icon">${d.kind === "custom" ? "📄" : "▤"}</span>
      <span class="doc-item-meta"><strong>${escapeHtml(d.label)}</strong><small>${d.numPages ? d.numPages + " trang" : "Đang tải…"}</small></span>
      ${d.kind === "custom" ? `<span class="doc-item-remove" data-remove-id="${d.id}" title="Xoá khỏi danh sách">✕</span>` : ""}
    `;
    btn.addEventListener("click", (e) => {
      if (e.target.closest(".doc-item-remove")) return;
      switchDeck(d.id).catch((err) => {
        console.error(err);
        appendErrorMessage(`Không mở được tài liệu: ${err.message}`);
      });
    });
    const removeBtn = btn.querySelector(".doc-item-remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await removeCustomDeck(d.id);
      });
    }
    docListEl.appendChild(btn);
  }
}

async function switchDeck(id) {
  if (id === activeDeckId && pdfDoc) return;
  const token = ++deckLoadToken;
  activeDeckId = id;
  localStorage.setItem(LAST_DECK_KEY, id);
  renderDocList();
  const meta = getDeckMetaById(id);
  updateHeaderForDeck(meta);
  pageIndicator.textContent = "Đang tải tài liệu...";
  const doc = await getDeckDocument(meta);
  if (token !== deckLoadToken) return; // đã có lượt chuyển deck khác bắt đầu sau đó, bỏ qua kết quả cũ
  pdfDoc = doc;
  numPages = pdfDoc.numPages;
  currentPage = 1;
  annotationsByPage.clear();
  buildPageShells();
  await renderAllPages();
  if (token !== deckLoadToken) return;
  setupIntersectionObserver();
}

async function removeCustomDeck(id) {
  await idbDelete(id);
  customDecks = customDecks.filter((d) => d.id !== id);
  deckDocCache.delete(id);
  deckNumPages.delete(id);
  if (activeDeckId === id) {
    await switchDeck("d1");
  } else {
    renderDocList();
  }
}

function setSidebar(open) {
  docSidebar.classList.toggle("is-hidden", !open);
  sidebarToggle.classList.toggle("is-collapsed", !open);
  sidebarToggle.textContent = open ? "‹" : "›";
  sidebarToggle.setAttribute("aria-expanded", String(open));
}
sidebarToggle.addEventListener("click", () => setSidebar(docSidebar.classList.contains("is-hidden")));

addSlideBtn.addEventListener("click", () => addSlideInput.click());
addSlideInput.addEventListener("change", async () => {
  const file = addSlideInput.files[0];
  addSlideInput.value = "";
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    appendErrorMessage("Chỉ hỗ trợ file PDF.");
    return;
  }
  try {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const arrayBuffer = await file.arrayBuffer();
    await idbPut({ id, name: file.name, addedAt: Date.now(), size: file.size, blob: file });
    customDecks.push({ id, name: file.name, addedAt: Date.now(), size: file.size, arrayBuffer });
    renderDocList();
    await switchDeck(id);
  } catch (err) {
    console.error(err);
    appendErrorMessage(`Không thêm được slide: ${err.message}`);
  }
});

// ---------------- Boot ----------------
async function init() {
  renderDocList();
  try {
    customDecks = await idbGetAll();
    for (const d of customDecks) {
      d.arrayBuffer = await d.blob.arrayBuffer();
    }
    renderDocList();
  } catch (err) {
    console.warn("Không đọc được cache slide đã thêm trước đó:", err);
  }
  if (!BUILTIN_DECKS[activeDeckId] && !customDecks.some((d) => d.id === activeDeckId)) {
    activeDeckId = "d1";
  }
  // Mở nhẹ (chỉ đọc metadata, chưa render trang) các bộ chưa active để sidebar hiện số trang ngay.
  for (const d of Object.values(BUILTIN_DECKS)) {
    if (d.id !== activeDeckId) getDeckDocument(d).catch(() => {});
  }
  await switchDeck(activeDeckId);
}
init().catch((err) => {
  console.error(err);
  appendErrorMessage(`Không tải được PDF slide: ${err.message}`);
});
