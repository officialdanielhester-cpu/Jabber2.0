// script.js
const messagesEl = document.getElementById("messages");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const moreSelect = document.getElementById("more-select");
const themeToggle = document.getElementById("theme-toggle");
const appTitle = document.getElementById("app-title");

function appendMessage(text, who = "bot", label = null, isHtml=false) {
  const el = document.createElement("div");
  el.classList.add("message", who);
  if (label) {
    const span = document.createElement("span");
    span.className = "msg-label";
    span.textContent = label;
    el.appendChild(span);
  }
  const content = document.createElement("div");
  if (isHtml) content.innerHTML = text;
  else content.textContent = text;
  el.appendChild(content);
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// show startup helper
appendMessage("Hello — I am Jabber. Ask me anything!", "bot");

async function sendToChat(text) {
  appendMessage(text, "user", "You:");
  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (data.error) {
      appendMessage("⚠️ " + (data.error || "No reply from OpenAI."), "bot");
    } else {
      appendMessage(data.reply, "bot");
    }
  } catch (err) {
    appendMessage("❌ Connection error", "bot");
    console.error(err);
  }
}

sendBtn.addEventListener("click", () => {
  const v = userInput.value.trim();
  if (!v) return;
  userInput.value = "";
  sendToChat(v);
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

// More select actions
moreSelect.addEventListener("change", async (e) => {
  const val = e.target.value;
  e.target.value = "more"; // reset
  if (val === "browse") {
    const query = prompt("Search the web for:");
    if (!query) return;
    appendMessage(`🔎 Searching web for: ${query}`, "user", "You:");
    try {
      const r = await fetch("/search", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ query })
      });
      const d = await r.json();
      if (d.error) appendMessage("⚠️ " + d.error, "bot");
      else {
        const results = Array.isArray(d.results) ? d.results.join("\n\n") : JSON.stringify(d.results);
        appendMessage(results, "bot");
      }
    } catch (err) {
      appendMessage("❌ Search failed", "bot");
      console.error(err);
    }
  } else if (val === "generate") {
    const prompt = prompt("Describe the image you want to generate:");
    if (!prompt) return;
    appendMessage(`🖼️ Generating image for: ${prompt}`, "user", "You:");
    try {
      const rr = await fetch("/image", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ prompt })
      });
      const dd = await rr.json();
      if (dd.error) {
        appendMessage("⚠️ " + dd.error, "bot");
      } else if (dd.imageUrl) {
        const html = `<img src="${dd.imageUrl}" style="max-width:220px;border-radius:8px;display:block;margin-top:6px;" alt="generated image">`;
        appendMessage("Here is your generated image:", "bot");
        appendMessage(html, "bot", null, true);
      } else appendMessage("⚠️ Could not generate image.", "bot");
    } catch (err) {
      appendMessage("❌ Could not generate image.", "bot");
      console.error(err);
    }
  } else if (val === "remember") {
    const note = prompt("What should I remember?");
    if (!note) return;
    try {
      const r = await fetch("/remember", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ text: note })
      });
      const d = await r.json();
      if (d.ok) {
        appendMessage(`✅ I remembered: ${note}`, "bot");
      } else {
        appendMessage("⚠️ Could not remember (server error).", "bot");
      }
    } catch (err) {
      appendMessage("❌ Remember failed", "bot");
    }
  }
});

// theme toggle: only toggles light/dark in UI
let dark = true;
themeToggle.addEventListener("click", () => {
  dark = !dark;
  if (dark) {
    document.body.style.background = "#050505";
    themeToggle.textContent = "🌙";
  } else {
    document.body.style.background = "#f7f7f7";
    themeToggle.textContent = "☀️";
  }
});
