// sendMessage handles chat input -> server -> reply
async function sendMessage(message) {
  addMessage(message, "user");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();
    addMessage(data.reply || "⚠️ No reply from server", "bot");
  } catch (err) {
    console.error("Chat error:", err);
    addMessage("⚠️ Error contacting server", "bot");
  }
}

// handle feature menu actions
async function handleFeature(feature, input) {
  if (feature === "remember") {
    await fetch("/api/remember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });
    addMessage("✅ Remembered: " + input, "bot");
  }

  if (feature === "schedule") {
    addMessage(`📅 Scheduled: ${input}`, "bot");
    // You can later hook this to a DB or calendar API
  }

  if (feature === "search") {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: input }),
    });
    const data = await res.json();
    data.results.forEach(r => addMessage(r, "bot"));
  }

  if (feature === "image") {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: input }),
    });
    const data = await res.json();
    if (data.imageUrl) {
      addMessage(`<img src="${data.imageUrl}" style="max-width:100%;border-radius:8px;">`, "bot", true);
    } else {
      addMessage("⚠️ No image generated", "bot");
    }
  }
}