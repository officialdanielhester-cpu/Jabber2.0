import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Setup paths for serving frontend ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from Public/
app.use(express.static(path.join(__dirname, "Public")));

// --- Memory store ---
let memory = [];

// --- OpenAI Chat Endpoint ---
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    memory.push({ role: "user", content: message });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are Jabber, a helpful assistant." },
          ...memory
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ reply: `⚠️ OpenAI Error: ${data.error.message}` });
    }

    const reply = data.choices[0].message.content;
    memory.push({ role: "assistant", content: reply });

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "⚠️ Server error while fetching reply." });
  }
});

// --- OpenAI Image Generation Endpoint ---
app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "512x512"
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    res.json({ imageUrl: data.data[0].url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "⚠️ Server error while generating image." });
  }
});

// --- Web Search (Placeholder for now) ---
app.post("/api/search", async (req, res) => {
  const { query } = req.body;
  res.json({ results: [`Pretend search result for: ${query}`] });
});

// --- Default route: send frontend ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "Public", "index.html"));
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});