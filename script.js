// Grab elements
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const themeToggle = document.getElementById("theme-toggle");
const rememberBtn = document.getElementById("remember-btn");
const scheduleBtn = document.getElementById("schedule-btn");
const browseBtn = document.getElementById("browse-btn");

// Add a message to chat
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight; // auto scroll
}

// Handle Send
function handleSend() {
  const text = userInput.value.trim();
  if (text === "") return;

  addMessage("user", text);
  userInput.value = "";

  // Simulated bot reply (replace with backend call later)
  setTimeout(() => {
    addMessage("bot", "🤖 Thinking... (this is a placeholder reply)");
  }, 600);
}

sendBtn.addEventListener("click", handleSend);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSend();
});

// Theme toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  if (document.body.classList.contains("dark")) {
    themeToggle.textContent = "☀️";
  } else {
    themeToggle.textContent = "🌙";
  }
});

// Remember button
rememberBtn.addEventListener("click", () => {
  addMessage("bot", "📌 I'll remember that (feature not yet wired).");
});

// Schedule button
scheduleBtn.addEventListener("click", () => {
  addMessage("bot", "⏰ Scheduling feature coming soon.");
});

// Browse Web button
browseBtn.addEventListener("click", () => {
  addMessage("bot", "🌐 Opening web search... (placeholder).");
  // You could later integrate a search API or open a new window:
  // window.open("https://www.google.com/search?q=" + encodeURIComponent(userInput.value), "_blank");
});