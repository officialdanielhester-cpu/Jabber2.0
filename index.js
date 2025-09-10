// index.js (place at repo root)
// Requires: node >= 18 (fetch available), express, dotenv, cors
// Make sure package.json has "type": "module" if using this import style.

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve UI static files from /public (do not change UI files)
app.use(express.static(path.join(__dirname, "public")));

// --- In-memory memory store (ephemeral) ---
const memories = [];

// helper: call OpenAI Chat (ChatCompletions)
async function callOpenAIChat(messages, model = "gpt-4o-mini") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured in environment");
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      // keep max tokens reasonable for cost and speed
      max_tokens: 600,
      temperature: 0.7,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const message = data?.error?.message || JSON.stringify(data);
    const err = new Error("OpenAI chat error: " + message);
    err.meta = data;
    throw err;
  }
  return data;
}

// helper: image generation (OpenAI Images endpoint)
async function callOpenAIImage(prompt, size = "512x512") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured in environment");
  }

  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const message = data?.error?.message || JSON.stringify(data);
    const err = new Error("OpenAI image error: " + message);
    err.meta = data;
    throw err;
  }
  return data;
}

// --- Routes ---

// POST /api/chat
// body: { message: string, mode?: string }
// returns: { reply: string }
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ reply: "⚠️ No message provided." });
    }

    // build messages for OpenAI: system + recent memory + user message
    const system = {
      role: "system",
      content:
        "You are Jabber — a friendly assistant. Be concise, helpful, and polite. If user asks to browse, say you will search and provide sources where possible.",
    };

    // include small chunk of memory to help continuity (last 8)
    const recentMemories = memories.slice(-8).map((m) => {
      return { role: "system", content: `Memory: ${m.text}` };
    });

    const userMessage = { role: "user", content: message };

    const messages = [system, ...recentMemories, userMessage];

    const data = await callOpenAIChat(messages);

    // pick assistant content
    const reply = data?.choices?.[0]?.message?.content || "⚠️ Empty reply from OpenAI.";
    // store in memory as a short conversation trace
    memories.push({ text: `User: ${message}` });
    memories.push({ text: `Assistant: ${reply}` });

    res.json({ reply });
  } catch (err) {
    console.error("Error in /api/chat:", err?.message || err);
    const msg =
      err?.message && err.message.includes("OPENAI_API_KEY")
        ? "⚠️ Server missing OPENAI_API_KEY. Add it to Render / environment variables."
        : `⚠️ Error calling OpenAI (see server logs).`;
    res.status(500).json({ reply: msg });
  }
});

// POST /api/image
// body: { prompt: string }
// returns { imageUrl: string } (or error)
app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "No prompt provided." });
    }

    const data = await callOpenAIImage(prompt);

    // OpenAI Image API returns data.data[0].url (older) or b64_json
    const url = data?.data?.[0]?.url;
    const b64 = data?.data?.[0]?.b64_json;
    if (url) return res.json({ imageUrl: url });
    if (b64) return res.json({ imageUrl: `data:image/png;base64,${b64}` });

    return res.status(500).json({ error: "No image returned from OpenAI." });
  } catch (err) {
    console.error("Error in /api/image:", err?.message || err);
    res.status(500).json({ error: "⚠️ Error generating image (check server logs)." });
  }
});

// POST /api/search
// body: { query: string }
// returns { results: [string,...] }
app.post("/api/search", async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || typeof query !== "string") {
      return res.status(400).json({ results: [] });
    }

    // Use DuckDuckGo Instant Answer JSON as a free fallback
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(ddgUrl, { method: "GET" });
    const data = await r.json();

    // Prefer AbstractText, then RelatedTopics text
    const results = [];
    if (data?.AbstractText) results.push(`🔎 ${data.AbstractText}`);
    if (Array.isArray(data?.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 4)) {
        if (topic.Text) results.push(`• ${topic.Text}`);
        else if (topic.Topics && Array.isArray(topic.Topics)) {
          topic.Topics.slice(0, 2).forEach((t) => t.Text && results.push(`• ${t.Text}`));
        }
      }
    }

    if (!results.length) results.push("🤔 No instant answer found. Try a different query.");

    res.json({ results });
  } catch (err) {
    console.error("Error in /api/search:", err);
    res.status(500).json({ results: ["⚠️ Search failed (server error)."] });
  }
});

// POST /api/remember  -> stores a memory
// body: { text: string }
app.post("/api/remember", (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") return res.status(400).json({ ok: false, error: "no text" });
    const entry = { text, createdAt: new Date().toISOString() };
    memories.push(entry);
    res.json({ ok: true });
  } catch (err) {
    console.error("remember error", err);
    res.status(500).json({ ok: false, error: "server" });
  }
});

// GET /api/memories -> { memories: [...] }
app.get("/api/memories", (req, res) => {
  res.json({ memories: memories.map((m) => (m.text ? m.text : JSON.stringify(m))).slice(-200) });
});

// fallback: ensure index.html served for front-end routes (so client-side routing works)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});