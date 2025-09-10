const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const themeToggle = document.getElementById("theme-toggle");

// Add message to chat
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender.toLowerCase());
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Fake AI response generator
function getJabberReply(message) {
  const replies = [
    "Interesting! Tell me more.",
    "I see what you mean.",
    "That’s cool 😃",
    "Can you explain further?",
    "Got it!"
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

// Send message
function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  addMessage("User", message);
  userInput.value = "";

  setTimeout(() => {
    const reply = getJabberReply(message);
    addMessage("Jabber", reply);
  }, 800);
}

// Event listeners
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

// Toggle dark/light mode
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  themeToggle.textContent = 
    document.body.classList.contains("light-mode") 
      ? "☀️ Light Mode" 
      : "🌙 Dark Mode";
});