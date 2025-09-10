/**
 * index.js - Full server for Jabber
 *
 * Required npm packages:
 *   npm install express dotenv openai node-fetch
 *
 * Environment:
 *   - OPENAI_API_KEY (recommended) — for AI chat & image generation
 *   - PORT (Render sets this automatically)
 *
 * Notes:
 *  - Keep your .env local and DO NOT commit it to GitHub.
 *  - If OPENAI_API_KEY is missing, web-search fallback will still work but AI features return a clear error.
 */

const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

// Try to use global fetch (Node 18+). If not available, use node-fetch.
let fetchFn = global.fetch;
if (!fetchFn) {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    fetchFn = require("node-fetch");
  } catch (e) {
    console.warn("node-fetch not available; web search will fail without global fetch.");
  }
}

// OpenAI client (official SDK). If not installed / set up, we handle gracefully.
let OpenAIClient = null;
try {
  const OpenAI = require("openai");
  OpenAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (err) {
  // We'll report errors if user tries AI features without SDK
  console.warn("OpenAI SDK not available or failed to initialize. AI features will return errors.");
}

const app = express();
app.use(express.json());

// Serve static frontend files from repo root (index.html, style.css, script.js, assets)
const STATIC_DIR = path.resolve(__dirname);
app.use(express.static(STATIC_DIR, { extensions: ["html"] }));

// In-memory simple memory store (non-persistent). Size-limited.
const MEMORIES = [];
const MAX_MEMORIES = 30;

// Helper: push a memory (deduplicates simple repeats)
function addMemory(text) {
  if (!text || typeof text !== "string") return;
  const t = text.trim();
  if (!t) return;
  // Avoid duplicates if same as last
  if (MEMORIES.length && MEMORIES[MEMORIES.length - 1] === t) return;
  MEMORIES.push(t);
  if (MEMORIES.length > MAX_MEMORIES) MEMORIES.shift();
}

// Helper: get last N memories as a single string
function getMemoryContext(n = 6) {
  if (!MEMORIES.length) return "";
  return MEMORIES.slice(-n).map((m, i) => `- ${m}`).join("\n");
}

// Basic health
app.get("/status", (req, res) => {
  res.json({
    ok: true,
    openaiConfigured: !!(OpenAIClient && process.env.OPENAI_API_KEY),
    memoryCount: MEMORIES.length,
  });
});

// Remember endpoints
app.post("/remember", (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "send { text: '...' } in body" });
  }
  addMemory(text);
  return res.json({ ok: true, memoryCount: MEMORIES.length });
});
app.get("/memory", (req, res) => {
  res.json({ memories: MEMORIES.slice(-MAX_MEMORIES) });
});

// Image generation endpoint
app.post("/generate-image", async (req, res) => {
  const { prompt, size = "512x512" } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  if (!OpenAIClient) {
    return res.status(500).json({
      error: "OpenAI client not configured on server. Set OPENAI_API_KEY and install openai SDK.",
    });
  }

  try {
    // Use the official SDK images endpoint (OpenAI SDK v4+ style)
    // If your installed SDK version differs, you may need to adjust this.
    const resp = await OpenAIClient.images.generate({
      model: "gpt-image-1",
      prompt,
      size,
      // you can request base64 by setting "response_format": "b64_json" depending on SDK version
    });

    // SDK returns different shapes depending on versions. Try to extract sensibly:
    const imageData = resp?.data?.[0]?.b64_json || resp?.data?.[0]?.url || null;

    if (!imageData) {
      console.error("Unexpected image response:", JSON.stringify(resp).slice(0, 1000));
      return res.status(500).json({ error: "Could not generate image (unexpected response)" });
    }

    // If we got base64, return it as data URL. If we got a URL, return the URL.
    if (imageData.startsWith && imageData.startsWith("http")) {
      return res.json({ imageUrl: imageData });
    }
    // else base64
    return res.json({ imageBase64: imageData, imageUrl: `data:image/png;base64,${imageData}` });
  } catch (err) {
    console.error("generate-image error:", err?.message || err);
    return res.status(500).json({ error: "Image generation failed", detail: String(err?.message || err) });
  }
});

// Web search helper using DuckDuckGo Instant Answer (no API key)
async function duckDuckGoInstant(q) {
  if (!fetchFn) throw new Error("fetch not available on server");
  const safeQ = encodeURIComponent(q);
  const url = `https://api.duckduckgo.com/?q=${safeQ}&format=json&no_redirect=1&skip_disambig=1`;
  const r = await fetchFn(url);
  const data = await r.json();
  return data;
}

// Main chat endpoint
// Expects JSON: { message: "...", mode: "ai"|"web", remember: true|false }
app.post("/chat", async (req, res) => {
  const { message, mode = "ai", remember = false } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "send { message: '...' } in body" });
  }

  // Optionally remember the user's message
  if (remember) addMemory(message);

  // If user requested web browsing mode, run a web search and return summarized result
  if (mode === "web") {
    try {
      const dd = await duckDuckGoInstant(message);
      // Choose best fields from DuckDuckGo Instant Answer
      const answer = dd?.AbstractText?.trim();
      if (answer) {
        return res.json({ reply: `🔎 ${answer}` });
      }
      // Some instant answers return RelatedTopics with FirstURL + Text
      const related = dd?.RelatedTopics?.find((t) => t.Text || (t.Topics && t.Topics[0]?.Text));
      if (related) {
        const text = related.Text || related.Topics?.[0]?.Text || "";
        const firstURL = related.FirstURL || related.Topics?.[0]?.FirstURL || "";
        return res.json({ reply: `🔗 ${text}${firstURL ? `\n\nSource: ${firstURL}` : ""}` });
      }
      // fallback
      return res.json({ reply: `🤔 I searched the web but couldn't find a concise Instant Answer for "${message}".` });
    } catch (err) {
      console.error("web search error:", err);
      return res.status(500).json({ reply: "⚠️ Web search failed on server." });
    }
  }

  // mode === "ai": use OpenAI chat completion
  if (!OpenAIClient) {
    // If no key / client, return clear message so front-end shows it
    return res.status(500).json({
      reply:
        "⚠️ Error calling OpenAI (server not configured). Set OPENAI_API_KEY in Render (or .env for local) and restart.",
    });
  }

  // Build the prompt/messages
  const memoryContext = getMemoryContext(6);
  const systemPrompt = `You are "Jabber", a helpful assistant for the user. Be concise when possible.
- Always be friendly.
- If a clear factual answer is requested, answer directly.
- If user asked to browse the web (mode web), use the web API instead.
- When returning web-search results include an emoji 🔎 for the main text, and 🔗 for a source link.
  
Memory (latest):
${memoryContext || "(no memories yet)"}
`;

  const messages = [
    { role: "system", content: systemPrompt },
    // Include a short "you are the user" hint if there are remembered items
    ...(memoryContext ? [{ role: "system", content: `Recent memories:\n${memoryContext}` }] : []),
    { role: "user", content: message },
  ];

  try {
    // Create chat completion
    // NOTE: SDK versions vary. This is compatible with OpenAI official SDK v4+:
    const completion = await OpenAIClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 600,
      temperature: 0.2,
    });

    // Extract assistant reply - SDK returns different shapes sometimes
    const reply = completion?.choices?.[0]?.message?.content || completion?.choices?.[0]?.text || null;
    if (!reply) {
      console.error("unexpected completion shape:", JSON.stringify(completion).slice(0, 1000));
      return res.status(500).json({ reply: "⚠️ Error: no reply from OpenAI (unexpected response shape)." });
    }

    // Optionally remember the assistant reply as well? (we won't store assistant replies by default).
    return res.json({ reply: reply.trim() });
  } catch (err) {
    console.error("OpenAI chat error:", err);
    // If it's an OpenAI key problem, surface a clear reply
    const m = String(err?.message || err || "unknown error");
    if (m.toLowerCase().includes("api key") || m.toLowerCase().includes("invalid")) {
      return res.status(500).json({
        reply: "⚠️ Error calling OpenAI (check server logs and OPENAI_API_KEY).",
        detail: m,
      });
    }
    return res.status(500).json({ reply: "⚠️ Error calling OpenAI (see server logs)", detail: m });
  }
});

// Provide a friendly root message for quick debug
app.get("/", (req, res) => {
  // If you have an index.html in repo root, express.static will serve it. This is fallback.
  res.sendFile(path.join(STATIC_DIR, "index.html"), (err) => {
    if (err) {
      res.send(
        `<h3>Jabber server running</h3>
         <p>OpenAI configured: ${!!(OpenAIClient && process.env.OPENAI_API_KEY)}</p>
         <p>Endpoints: POST /chat, POST /generate-image, POST /remember, GET /memory</p>`
      );
    }
  });
});

// Start server on Render-friendly port
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log(`✅ Jabber server listening on port ${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "⚠️ OPENAI_API_KEY is not set. AI features will not work until you set OPENAI_API_KEY in Render or .env."
    );
  }
});