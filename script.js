const chatMessages = document.getElementById("chat-messages");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");

// Add a message bubble
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender === "You" ? "user" : "jabber");
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send message
sendBtn.addEventListener("click", async () => {
  const message = messageInput.value.trim();
  if (!message) return;

  addMessage("You", message);
  messageInput.value = "";

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    addMessage("Jabber", data.reply || "⚠️ No response from Jabber.");
  } catch (err) {
    addMessage("Jabber", "⚠️ Connection error.");
  }
});