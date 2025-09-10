document.getElementById("send-btn").addEventListener("click", sendMessage);
document.getElementById("user-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
  const inputField = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");
  const mode = document.getElementById("mode-select").value;
  const userMessage = inputField.value.trim();

  if (!userMessage) return;

  // Show user message
  addMessage(`You: ${userMessage}`, "user-message");

  // Send to server
  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, mode })
    });

    const data = await response.json();
    addMessage(`Jabber 🤖: ${data.reply}`, "bot-message");
  } catch (error) {
    addMessage("⚠️ Error connecting to server.", "bot-message");
  }

  inputField.value = "";
}

function addMessage(text, className) {
  const chatBox = document.getElementById("chat-box");
  const msg = document.createElement("div");
  msg.className = `message ${className}`;
  msg.innerText = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Theme toggle
document.getElementById("theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
});