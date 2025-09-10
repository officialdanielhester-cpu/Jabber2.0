// index.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY || null;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html, style.css, script.js, assets

// In-memory "memory" store (very simple). Persist externally for production.
const memories = [];

/**
 * POST /chat
 * body: { message: "..." }
 * returns: { reply: "..." }
 */
app.post("/chat", async (req, res) => {
  const { message } = req.body ?? {};
  if (!message) return res.status(400).json({ error: "No message provided" });

  // If OpenAI key missing, return an explanatory error (front-end will show).
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY not set on server." });
  }

  try {
    // Simple system prompt and user message
    const system = "You are Jabber — a friendly assistant that replies concisely.";
    const user = message;

    // Call OpenAI Chat Completions (stable v1 REST)
    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 350
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("OpenAI chat error:", r.status, errText);
      return res.status(500).json({ error: "Error calling OpenAI (check server logs and OPENAI_API_KEY)." });
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content ?? "⚠️ No reply from OpenAI.";

    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Server error while contacting OpenAI." });
  }
});

/**
 * POST /image
 * body: { prompt: "..." }
 * returns: { imageUrl: "..." }
 */
app.post("/image", async (req, res) => {
  const { prompt } = req.body ?? {};
  if (!prompt) return res.status(400).json({ error: "No prompt provided" });

  if (!OPENAI_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY not set on server." });
  }

  try {
    // Use OpenAI Images generation endpoint (DALL·E style)
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        n: 1,
        size: "1024x1024"
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("OpenAI image error:", r.status, txt);
      return res.status(500).json({ error: "Could not generate image" });
    }

    const data = await r.json();
    // Many OpenAI responses include data[0].url
    const imageUrl = data?.data?.[0]?.url ?? null;
    if (!imageUrl) return res.status(500).json({ error: "No image URL returned" });

    res.json({ imageUrl });
  } catch (err) {
    console.error("Image error:", err);
    res.status(500).json({ error: "Could not generate image." });
  }
});

/**
 * POST /search
 * body: { query: "..." }
 * returns: { results: [ ... ] }
 * Uses DuckDuckGo Instant Answer API (simple).
 */
app.post("/search", async (req, res) => {
  const { query } = req.body ?? {};
  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    const q = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url);
    if (!r.ok) {
      console.error("DuckDuckGo error", r.status);
      return res.status(500).json({ error: "Search failed" });
    }
    const data = await r.json();

    // Try to extract an "Instant Answer" (AbstractText) and related topics
    const results = [];
    if (data?.AbstractText) results.push(data.AbstractText);
    if (Array.isArray(data?.RelatedTopics)) {
      data.RelatedTopics.slice(0, 5).forEach((t) => {
        if (t.Text) results.push(t.Text);
        else if (t.Topics) t.Topics.slice(0,2).forEach(tt => tt.Text && results.push(tt.Text));
      });
    }
    if (results.length === 0) results.push("No clear Instant Answer found.");

    res.json({ results });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

/**
 * POST /remember
 * body: { text: "..." }
 */
app.post("/remember", (req, res) => {
  const { text } = req.body ?? {};
  if (!text) return res.status(400).json({ error: "No text provided" });
  memories.push({ text, time: new Date().toISOString() });
  res.json({ ok: true, memories });
});

app.get("/memories", (req, res) => {
  res.json({ memories });
});

// start
app.listen(PORT, () => {
  console.log(`Jabber server running on port ${PORT}`);
});