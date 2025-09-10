const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const themeToggle = document.getElementById("theme-toggle");

// Add a message bubble
function addMessage(message, type) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", type);
  msgDiv.textContent = message;
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Mock bot response
function botReply(userMessage) {
  setTimeout(() => {
    addMessage("Jabber: I heard you say '" + userMessage + "'.", "bot-message");
  }, 800);
}

// Send message
sendBtn.addEventListener("click", () => {
  const message = userInput.value.trim();
  if (message) {
    addMessage("You: " + message, "user-message");
    botReply(message);
    userInput.value = "";
  }
});

// Enter key support
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});

// Dark / Light mode toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  themeToggle.textContent = 
    document.body.classList.contains("light-mode") ? "☀️ Light Mode" : "🌙 Dark Mode";
});

// Dropdown actions
document.querySelectorAll(".action-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    addMessage(`🔧 Action selected: ${action}`, "bot-message");
  });
});