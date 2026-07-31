const form = document.querySelector("#chat-form");
const input = document.querySelector("#question");
const messages = document.querySelector("#messages");
let previousTopic = "";

function addBubble(text, role) {
  const bubble = document.createElement("article");
  bubble.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.append(paragraph);
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
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
      item.href = `/slides/d1-slide-hackathon.pdf#page=${citation.page}`;
      item.target = "_blank";
      label.textContent = `Trong tài liệu · Trang ${citation.page}`;
      title.textContent = citation.document;
      detail.textContent = citation.title;
    } else {
      item.href = citation.url;
      item.target = "_blank";
      item.rel = "noreferrer";
      label.textContent = "Nguồn ngoài · Google Search";
      title.textContent = citation.title;
      detail.textContent = citation.url;
    }
    item.append(label, title, detail);
    list.append(item);
  });
  messages.append(list);
}

function addStatus(text) {
  const status = document.createElement("div");
  status.className = "typing";
  status.textContent = text;
  messages.append(status);
  messages.scrollTop = messages.scrollHeight;
  return status;
}

async function ask(question) {
  addBubble(question, "user");
  const status = addStatus("Tutor đang kiểm tra slide và nguồn...");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, currentPage: 1, previousTopic })
    });
    const data = await response.json();
    status.remove();
    if (!response.ok) throw new Error(data.error || "Không thể xử lý câu hỏi.");
    const bubble = addBubble(data.answer, "assistant");
    bubble.dataset.route = data.route;
    addCitations(data.citations || []);
    if (data.topic) previousTopic = data.topic;
  } catch (error) {
    status.remove();
    addBubble(error.message, "assistant");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  input.value = "";
  ask(question);
});

document.querySelectorAll("[data-question]").forEach((button) => {
  button.addEventListener("click", () => ask(button.dataset.question));
});
