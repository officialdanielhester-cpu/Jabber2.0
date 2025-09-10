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

    if (action === "browse") {
      const query = userInput.value.trim();
      if (!query) {
        addMessage("⚠️ Please type what you want to search first.", "bot-message");
        return;
      }
      addMessage("🔎 Searching the web for: " + query, "bot-message");

      // Use DuckDuckGo Instant Answer API
      fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`)
        .then(res => res.json())
        .then(data => {
          if (data.AbstractText) {
            addMessage("🌐 " + data.AbstractText, "bot-message");
            if (data.AbstractURL) {
              addMessage("🔗 " + data.AbstractURL, "bot-message");
            }
          } else {
            addMessage("⚠️ No clear results found.", "bot-message");
          }
        })
        .catch(() => {
          addMessage("⚠️ Couldn’t reach the web, try again later.", "bot-message");
        });

    } else {
      addMessage(`🔧 Action selected: ${action}`, "bot-message");
    }
  });
});