// index.js  — copy & paste this entire file into your project root
// Requirements:
// - package.json should include: "type": "module"
// - .env must contain OPENAI_API_KEY (do NOT commit .env publicly)
// - public/index.html (and other client files) must be in ./public/

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
app.use(express.json({ limit: "1mb" }));

// Serve static client files from /public
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// In-memory memory store (simple). You can later replace with DB.
let memory = [];

/**
 * Helper: call OpenAI ChatCompletion (HTTP)
 * Uses global fetch (Node 18+). Replace model as desired.
 */
async function callOpenAIChat(messages = []) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set in environment.");
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // adjust if you want another model
      messages,
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenAI chat request failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return data;
}

/**
 * Helper: quick DuckDuckGo Instant Answer lookup
 * Returns either AbstractText or list of RelatedTopics (first item)
 */
async function duckDuckGoInstant(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`DuckDuckGo request failed: ${resp.status}`);
  }
  const data = await resp.json();
  // Prefer AbstractText
  if (data.AbstractText && data.AbstractText.trim().length > 0) {
    return {
      source: "duckduckgo",
      type: "abstract",
      text: data.AbstractText,
      url: data.AbstractURL || null,
    };
  }
  // Fallback to first RelatedTopic text
  if (Array.isArray(data.RelatedTopics) && data.RelatedTopics.length > 0) {
    const first = data.RelatedTopics[0];
    const text = first.Text || (first.Topics && first.Topics[0] && first.Topics[0].Text) || "";
    return {
      source: "duckduckgo",
      type: "related",
      text: text || "No instant answer found.",
      url: first.FirstURL || null,
    };
  }
  return { source: "duckduckgo", type: "none", text: "No instant answer available." };
}

// Chat endpoint
// Body: { message: "...", mode?: "ai" | "web" }
// mode === "web" => use DuckDuckGo quick lookup and return result instead of calling OpenAI
app.post("/api/chat", async (req, res) => {
  try {
    const { message, mode } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing 'message' in request body." });
    }

    // Save user message to memory
    memory.push({ role: "user", content: message });

    if (mode === "web") {
      // Quick web lookup path
      try {
        const dd = await duckDuckGoInstant(message);
        // store as assistant memory too
        memory.push({ role: "assistant", content: dd.text });
        return res.json({ reply: dd.text, source: "web" });
      } catch (err) {
        console.error("DuckDuckGo error:", err);
        return res.status(500).json({ reply: "⚠️ Web lookup failed.", error: err.message });
      }
    }

    // Default: call OpenAI Chat
    // Compose messages: system + memory (last ~12 messages)
    const systemMsg = { role: "system", content: "You are Jabber, a helpful assistant." };

    // Keep just last N messages to avoid token overload
    const recentMemory = memory.slice(-12);
    const messages = [systemMsg, ...recentMemory];

    const aiResp = await callOpenAIChat(messages);

    // Extract text
    const reply = aiResp?.choices?.[0]?.message?.content ?? "⚠️ No reply from OpenAI.";

    // Save assistant reply to memory
    memory.push({ role: "assistant", content: reply });

    return res.json({ reply, source: "openai" });
  } catch (err) {
    console.error("Chat error:", err);
    const message = err?.message || "Unknown server error.";
    return res.status(500).json({ reply: `⚠️ Error: ${message}` });
  }
});

// Image generation
// Body: { prompt: "..." }
app.post("/api/image", async (req, res) => {
  try {
    const { prompt, size = "512x512" } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing 'prompt' in request body." });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
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

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("Image API error:", resp.status, text);
      return res.status(resp.status).json({ error: `Image API failed (${resp.status}).` });
    }

    const data = await resp.json();
    // Many OpenAI image responses use data[0].url or data[0].b64_json
    const url = data?.data?.[0]?.url ?? null;
    const b64 = data?.data?.[0]?.b64_json ?? null;

    return res.json({ imageUrl: url, b64 });
  } catch (err) {
    console.error("Image generation error:", err);
    return res.status(500).json({ error: "Server error while generating image." });
  }
});

// Simple search endpoint (placeholder or can be expanded)
app.post("/api/search", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Missing 'query' in request body." });
    }
    // Quick ddg fallback
    const dd = await duckDuckGoInstant(query);
    res.json({ results: [dd] });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed." });
  }
});

// Clear memory (for debugging) - optional
app.post("/api/memory/clear", (req, res) => {
  memory = [];
  res.json({ ok: true });
});

// Health
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// Fallback: serve index.html for all other routes (SPA)
app.get("*", (req, res) => {
  const indexPath = path.join(publicDir, "index.html");
  return res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("Failed to send index.html:", err);
      res.status(500).send("Index not found on server. Make sure public/index.html exists.");
    }
  });
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});