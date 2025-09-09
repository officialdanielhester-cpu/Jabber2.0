async function sendMessage() {
  const input = document.getElementById("userInput");
  const message = input.value.trim();
  if (!message) return;

  // Add user bubble
  addMessage(message, "user");
  input.value = "";

  // Show typing indicator
  const typing = document.createElement("div");
  typing.className = "chat-bubble bot typing-indicator";
  typing.innerText = "Jabber is thinking";
  document.getElementById("chatContainer").appendChild(typing);

  try {
    // Send to backend (adjust URL if needed)
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();

    // Remove typing indicator
    document.querySelectorAll(".typing-indicator").forEach(el => el.remove());

    // Add Jabber response
    if (data && data.reply) {
      addMessage(data.reply, "bot");
    } else {
      addMessage("Hmm... I didn’t quite get that.", "bot");
    }
  } catch (error) {
    // Remove typing indicator on error
    document.querySelectorAll(".typing-indicator").forEach(el => el.remove());
    addMessage("⚠️ Error connecting to Jabber.", "bot");
  }
}

function addMessage(text, sender) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerText = text;
  document.getElementById("chatContainer").appendChild(bubble);

  // Auto scroll
  const chatContainer = document.getElementById("chatContainer");
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
