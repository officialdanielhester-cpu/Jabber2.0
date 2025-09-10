const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const actionSelect = document.getElementById("action-select");

function addMessage(sender, text) {
  const message = document.createElement("div");
  message.classList.add("message", sender);
  message.innerText = text;
  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.addEventListener("click", async () => {
  const text = userInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  userInput.value = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    addMessage("bot", data.reply ? data.reply : "⚠️ No response from Jabber.");
  } catch (err) {
    addMessage("bot", "⚠️ Error contacting server.");
  }
});

// Dropdown actions
actionSelect.addEventListener("change", () => {
  const choice = actionSelect.value;
  if (choice === "browse") {
    window.open("https://www.google.com", "_blank");
  } else if (choice === "schedule") {
    alert("📅 Scheduling feature coming soon!");
  } else if (choice === "remember") {
    alert("🧠 Remember feature coming soon!");
  }
  actionSelect.value = "default"; // reset
});