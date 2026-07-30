(function () {
  const panel = document.querySelector("#tutor-panel");
  const toggle = document.querySelector("#tutor-toggle");
  const closeButton = document.querySelector("#close-tutor");
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#question-input");
  const messages = document.querySelector("#messages");

  function setPanel(open) {
    panel.classList.toggle("is-hidden", !open);
    toggle.classList.toggle("is-collapsed", !open);
    toggle.textContent = open ? "›" : "‹";
    toggle.setAttribute("aria-expanded", String(open));
  }

  function findRule(question) {
    const normalized = question.toLocaleLowerCase("vi");
    return window.TUTOR_RULES.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword))) || window.EXTERNAL_FALLBACK;
  }

  function addMessage(question, rule) {
    const user = document.createElement("article");
    user.className = "message user-message";
    user.textContent = question;

    const tutor = document.createElement("article");
    tutor.className = "message tutor-message";
    tutor.innerHTML = `<p>${rule.answer}</p><div class="citation ${rule.sourceType === "Nguồn ngoài" ? "external" : ""}"><span>${rule.sourceType}</span><strong>⌁ ${rule.citation}</strong></div>`;
    messages.append(user, tutor);
    messages.scrollTop = messages.scrollHeight;
  }

  toggle.addEventListener("click", () => setPanel(panel.classList.contains("is-hidden")));
  closeButton.addEventListener("click", () => setPanel(false));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    addMessage(question, findRule(question));
    input.value = "";
  });
  document.querySelectorAll("[data-question]").forEach((button) => button.addEventListener("click", () => {
    const question = button.dataset.question;
    addMessage(question, findRule(question));
  }));
})();
