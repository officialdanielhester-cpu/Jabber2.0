// index.js
// Full server file (ESM). Copy & paste into your project root.
// Requires: "type": "module" in package.json and dependencies: express, openai
// Set OPENAI_API_KEY in environment (Render dashboard / Secrets).

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// --- OpenAI client (safe even if key missing; we'll handle errors) ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || undefined,
});

// --- Simple in-memory memories store (persist elsewhere for production) ---
const memories = [];

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // serve frontend

// --- Helper: DuckDuckGo instant answer (fallback search) ---
async function duckDuckGoInstantAnswer(query) {
  try {
    const q = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    // prefer AbstractText, then RelatedTopics[0].Text, else null
    if (data.AbstractText && data.AbstractText.trim()) {
      return { source: "duckduckgo", text: data.AbstractText };
    }
    if (Array.isArray(data.RelatedTopics) && data.RelatedTopics.length) {
      // try to find first text
      for (const t of data.RelatedTopics) {
        if (t.Text) return { source: "duckduckgo", text: t.Text };
        if (t.Topics && t.Topics.length && t.Topics[0].Text) {
          return { source: "duckduckgo", text: t.Topics[0].Text };
        }
      }
    }
    return null;
  } catch (err) {
    console.error("DuckDuckGo error:", err);
    return null;
  }
}

// --- POST /api/chat
// Body: { message: "..." }
// Returns: { reply: "..." }
app.post("/api/chat", async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ reply: "No message provided." });
  }

  // small system prompt + memory context
  const systemPrompt = `You are Jabber, a friendly assistant. Keep responses concise for chat UI. If the user asks to "browse" or "search" use web search fallback.`;

  // Build messages: include short memory summary if any
  const memoryText = memories.length ? `Memories: ${memories.slice(-5).join(" | ")}` : "";
  const messages = [
    { role: "system", content: systemPrompt + (memoryText ? `\n\n${memoryText}` : "") },
    { role: "user", content: message },
  ];

  // Attempt to call OpenAI chat completion; if fails, fallback to web search.
  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

    // Use chat completions (new OpenAI JS API). Model choice can be adjusted.
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // change to a model you have access to if needed
      messages,
      max_tokens: 400,
      temperature: 0.2,
    });

    // The response text:
    const reply =
      completion?.choices?.[0]?.message?.content ??
      completion?.choices?.[0]?.text ??
      null;

    if (reply) {
      return res.json({ reply: String(reply).trim() });
    }

    // If for some reason no reply text present, fallthrough to fallback
    throw new Error("No reply returned from OpenAI");
  } catch (openaiErr) {
    console.error("OpenAI chat error:", openaiErr?.message ?? openaiErr);

    // Fallback: if user asked for a web lookup keyword, do DuckDuckGo search
    try {
      const searchResult = await duckDuckGoInstantAnswer(message);
      if (searchResult && searchResult.text) {
        return res.json({
          reply: `🔎 ${searchResult.text}`,
          fallback: true,
        });
      }
    } catch (ddgErr) {
      console.error("DuckDuckGo fallback error:", ddgErr);
    }

    // Final fallback response (matches UI text seen in screenshots)
    return res.json({
      reply:
        "⚠️ Error calling OpenAI (check server logs and OPENAI_API_KEY).",
      error: true,
    });
  }
});

// --- POST /api/image
// Body: { prompt: "..." }
// Returns: { url: "https://..." } or { error: "..." }
app.post("/api/image", async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "No prompt provided." });
  }

  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

    // Image generation (OpenAI images)
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    // result.data[0].url in many SDK versions OR base64 in b64_json
    const imageUrl = result?.data?.[0]?.url ?? result?.data?.[0]?.b64_json
      ? `data:image/png;base64,${result.data[0].b64_json}`
      : null;

    if (!imageUrl) throw new Error("No image returned");

    return res.json({ url: imageUrl });
  } catch (err) {
    console.error("Image generation error:", err?.message ?? err);
    return res.status(500).json({ error: "Could not generate image." });
  }
});

// --- POST /api/search
// Body: { query: "..." }  -> returns { results: ["text1", ...] }
app.post("/api/search", async (req, res) => {
  const { query } = req.body || {};
  if (!query) return res.status(400).json({ results: [] });

  try {
    const ddg = await duckDuckGoInstantAnswer(query);
    if (ddg && ddg.text) {
      return res.json({ results: [ddg.text], source: ddg.source });
    }
    return res.json({ results: [], source: "none" });
  } catch (err) {
    console.error("Search endpoint error:", err);
    return res.status(500).json({ results: [] });
  }
});

// --- POST /api/remember  (store a short memory string)
app.post("/api/remember", (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ ok: false, msg: "No text" });
  }
  memories.push(text.trim());
  // cap memory size
  if (memories.length > 200) memories.splice(0, memories.length - 200);
  return res.json({ ok: true, memories });
});

// --- GET /api/memories
app.get("/api/memories", (req, res) => {
  return res.json({ memories });
});

// --- Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// --- Catch-all serve index for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});