// Adds a message to the chat window
function addMessage(content, sender = "bot") {
  const chatBox = document.getElementById("chat-box");
  const message = document.createElement("div");
  message.classList.add("message", sender);

  // If the bot sends HTML (like an <img>), insert safely
  if (sender === "bot" && content.startsWith("<img")) {
    message.innerHTML = content;
  } else {
    message.textContent = content;
  }

  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Send text message
async function sendMessage(message) {
  addMessage(message, "user");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    if (data.error) {
      addMessage("⚠️ " + data.error, "bot");
    } else {
      addMessage(data.reply, "bot");
    }
  } catch (err) {
    console.error(err);
    addMessage("⚠️ Server error — check if backend is running.", "bot");
  }
}

// Generate image
async function generateImage(prompt) {
  addMessage("🎨 Generating image for: " + prompt, "user");

  try {
    const response = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    if (data.error) {
      addMessage("⚠️ " + data.error, "bot");
    } else if (data.imageUrl) {
      addMessage(`<img src="${data.imageUrl}" alt="Generated image"/>`, "bot");
    }
  } catch (err) {
    console.error(err);
    addMessage("⚠️ Could not reach image API.", "bot");
  }
}

// Hook up buttons
document.getElementById("send-btn").addEventListener("click", () => {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (message) {
    sendMessage(message);
    input.value = "";
  }
});

document.getElementById("generate-btn").addEventListener("click", () => {
  const input = document.getElementById("user-input");
  const prompt = input.value.trim();
  if (prompt) {
    generateImage(prompt);
    input.value = "";
  }
});