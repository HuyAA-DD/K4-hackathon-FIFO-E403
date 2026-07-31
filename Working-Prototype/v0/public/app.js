const PAGE_COUNT = 29;
let currentPage = 1;
let previousTopic = "";

const form = document.querySelector("#chat-form");
const input = document.querySelector("#question");
const messages = document.querySelector("#messages");
const pdfFrame = document.querySelector("#pdf-frame");
const pageIndicator = document.querySelector("#page-indicator");
const pageFooterLabel = document.querySelector("#page-footer-label");
const toolbarPage = document.querySelector("#toolbar-page");
const tutorContext = document.querySelector("#tutor-context");
const docList = document.querySelector("#doc-list");
const sidebar = document.querySelector("#doc-sidebar");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const tutorPanel = document.querySelector("#tutor-panel");
const tutorToggle = document.querySelector("#tutor-toggle");

function updateSlide(page) {
  currentPage = Math.min(Math.max(Number(page) || 1, 1), PAGE_COUNT);
  pdfFrame.src = `/slides/d1-slide-hackathon.pdf#page=${currentPage}&view=FitH`;
  pageIndicator.textContent = `Trang ${currentPage} · Tài liệu bài giảng`;
  pageFooterLabel.textContent = `Slide ${currentPage} / ${PAGE_COUNT} · từ data pack`;
  toolbarPage.textContent = `Trang ${currentPage} / ${PAGE_COUNT}`;
  tutorContext.textContent = `Ngữ cảnh: Slide trang ${currentPage} · d1-slide-hackathon.pdf`;
}

function buildSlideList() {
  const documentItem = document.createElement("button");
  documentItem.type = "button";
  documentItem.className = "doc-item is-active";
  documentItem.innerHTML = "<span class=\"doc-item-icon\">▧</span><span class=\"doc-item-meta\"><strong>Slide bài giảng</strong><small>d1-slide-hackathon.pdf · 29 trang</small></span>";
  documentItem.addEventListener("click", () => updateSlide(currentPage));
  docList.replaceChildren(documentItem);
}

function setPanel(open) {
  tutorPanel.classList.toggle("is-hidden", !open);
  tutorToggle.classList.toggle("is-collapsed", !open);
  tutorToggle.textContent = open ? "›" : "‹";
  tutorToggle.setAttribute("aria-expanded", String(open));
}

function addBubble(text, role) {
  const bubble = document.createElement("article");
  bubble.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.append(paragraph);
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
}

function addCitations(citations) {
  if (!citations.length) return;
  const list = document.createElement("div");
  list.className = "citations";
  citations.forEach((citation) => {
    const item = document.createElement("a");
    item.className = `citation ${citation.type === "external" ? "external" : "slide"}`;
    const label = document.createElement("span");
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    if (citation.type === "slide") {
      item.href = `#slide-${citation.page}`;
      label.textContent = `Trong tài liệu · Trang ${citation.page}`;
      title.textContent = citation.document;
      detail.textContent = citation.title;
      item.addEventListener("click", (event) => {
        event.preventDefault();
        updateSlide(citation.page);
      });
    } else {
      item.href = citation.url;
      item.target = "_blank";
      item.rel = "noreferrer";
      label.textContent = "Nguồn ngoài · Web Search";
      title.textContent = citation.title;
      detail.textContent = citation.url;
    }
    item.append(label, title, detail);
    list.append(item);
  });
  messages.append(list);
  messages.scrollTop = messages.scrollHeight;
}

function addStatus() {
  const status = document.createElement("div");
  status.className = "typing";
  status.textContent = "Tutor đang kiểm tra slide và nguồn...";
  messages.append(status);
  messages.scrollTop = messages.scrollHeight;
  return status;
}

function setComposerBusy(isBusy) {
  form.classList.toggle("is-disabled", isBusy);
  input.disabled = isBusy;
  form.querySelector("button").disabled = isBusy;
}

async function ask(question) {
  addBubble(question, "user");
  const status = addStatus();
  setComposerBusy(true);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, currentPage, previousTopic })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Không thể xử lý câu hỏi.");
    addBubble(data.answer, "assistant");
    addCitations(data.citations || []);
    if (data.topic) previousTopic = data.topic;
  } catch (error) {
    const message = error.message === "Failed to fetch"
      ? "Không kết nối được tới server. Hãy kiểm tra npm start vẫn đang chạy."
      : error.message;
    addBubble(message, "assistant");
  } finally {
    status.remove();
    setComposerBusy(false);
    input.focus();
  }
}

document.querySelector("#prev-page").addEventListener("click", () => updateSlide(currentPage - 1));
document.querySelector("#next-page").addEventListener("click", () => updateSlide(currentPage + 1));
sidebarToggle.addEventListener("click", () => {
  const hidden = sidebar.classList.toggle("is-hidden");
  sidebarToggle.classList.toggle("is-collapsed", hidden);
  sidebarToggle.textContent = hidden ? "›" : "‹";
  sidebarToggle.setAttribute("aria-expanded", String(!hidden));
});
tutorToggle.addEventListener("click", () => setPanel(tutorPanel.classList.contains("is-hidden")));
document.querySelector("#close-tutor").addEventListener("click", () => setPanel(false));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question || input.disabled) return;
  input.value = "";
  ask(question);
});
document.querySelectorAll("[data-question]").forEach((button) => button.addEventListener("click", () => ask(button.dataset.question)));

buildSlideList();
updateSlide(1);
