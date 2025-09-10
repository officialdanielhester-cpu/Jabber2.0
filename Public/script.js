const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const moreBtn = document.getElementById("more-btn");
const dropdown = moreBtn.parentElement;

// Append a message bubble
function appendMessage(text, sender) {
  const div = document.createElement("div");
  div.className = sender === "user" ? "user-msg" : "bot-msg";
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Send button click
sendBtn.addEventListener("click", () => {
  const text = userInput.value.trim();
  if (!text) return;
  appendMessage(text, "user");
  userInput.value = "";

  // Placeholder response
  setTimeout(() => {
    appendMessage("⚠️ This is a placeholder bot reply.", "bot");
  }, 600);
});

// Dropdown toggle
moreBtn.addEventListener("click", () => {
  dropdown.classList.toggle("show");
});

// Dropdown options
document.querySelectorAll(".dropdown-content button").forEach((btn) => {
  btn.addEventListener("click", () => {
    appendMessage(`Selected: ${btn.dataset.action}`, "user");
    dropdown.classList.remove("show");
  });
});