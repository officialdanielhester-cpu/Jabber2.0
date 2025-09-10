const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const browseBtn = document.getElementById("browse-btn");
const themeToggle = document.getElementById("theme-toggle");

// Helper: Add messages
function addMessage(content, sender) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = content;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Send AI message
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  addMessage(message, "user");
  userInput.value = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    addMessage(data.reply || "⚠️ Error: No reply", "bot");
  } catch {
    addMessage("❌ Connection error", "bot");
  }
}

// Browse Web message
async function browseMessage() {
  const query = userInput.value.trim();
  if (!query) return;

  addMessage(query, "user");
  userInput.value = "";

  try {
    const res = await fetch("/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    addMessage(data.result || "⚠️ No results found", "bot");
  } catch {
    addMessage("❌ Web browsing failed", "bot");
  }
}

// Event Listeners
sendBtn.addEventListener("click", sendMessage);
browseBtn.addEventListener("click", browseMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

// Theme toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("jabber-theme", isDark ? "dark" : "light");
});

// Load saved theme
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("jabber-theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
  }
});
