// index.js
// Complete server for Jabber:
// - Serves static files from ./public (or project root if you keep files there)
// - POST /api/chat            -> returns { reply }
// - POST /api/image           -> returns { url }
// - POST /api/search          -> returns { results: [...] }
// - POST /api/remember        -> returns { ok: true }
// - GET  /api/memories        -> returns { memories: [...] }
//
// Requirements:
// - package.json must include "type": "module" and "start": "node index.js"
// - npm install express openai node-fetch (node 18+ has fetch builtin)
// - Set OPENAI_API_KEY in environment (Render dashboard or local env)
// - Serve your frontend from ./public (index.html, style.css, script.js, etc)

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// If you put frontend files in a folder called "public", serve that.
// If your index.html is in project root, change this to app.use(express.static(__dirname));
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// In-memory memories (simple). Replace with DB if you want persistence.
const MEMORIES = [];

// Initialize OpenAI client only if key exists
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY?.trim();
let openai = null;
if (OPENAI_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_KEY });
  console.log("OpenAI client initialized.");
} else {
  console.log("WARNING: OPENAI_API_KEY not found. AI endpoints will return fallback messages.");
}

// --- Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message in body." });

    if (!openai) {
      // Fallback (no API key) — echo + hint
      return res.json({ reply: `⚠️ No OPENAI_API_KEY set. You asked: "${message}". Set OPENAI_API_KEY in Render or .env.` });
    }

    // Prefer Responses API if available; fall back to chat completions.
    try {
      // Try Responses API (works in modern SDKs)
      const response = await openai.responses.create({
        model: "gpt-4o-mini", // safe choice — change if you prefer a different model available to you
        input: message,
        max_output_tokens: 500
      });

      // responses.create structure can vary; handle a few shapes:
      let reply = "";
      if (response.output && Array.isArray(response.output) && response.output.length) {
        // join textual parts
        for (const item of response.output) {
          if (item.content) {
            for (const c of item.content) {
              if (typeof c.text === "string") reply += c.text;
            }
          }
        }
      } else if (response.output_text) {
        reply = response.output_text;
      }

      if (!reply) {
        // fallback to a safe placeholder
        reply = "⚠️ OpenAI returned no text. Check server logs.";
      }

      return res.json({ reply });
    } catch (errResponses) {
      // If the above Responses API call fails (SDK differences), fallback to Chat Completions
      console.warn("Responses API failed — trying chat completions:", errResponses?.message || errResponses);

      try {
        const chatRes = await openai.chat.completions.create({
          model: "gpt-4o-mini", // adjust to a model you have access to
          messages: [{ role: "user", content: message }],
          max_tokens: 500
        });

        // chatRes.choices[0].message may be object/array depending on SDK
        let chatReply = "";
        if (Array.isArray(chatRes.choices) && chatRes.choices.length) {
          const chMsg = chatRes.choices[0].message;
          if (typeof chMsg === "string") chatReply = chMsg;
          else if (chMsg && chMsg.content) {
            if (typeof chMsg.content === "string") chatReply = chMsg.content;
            else if (Array.isArray(chMsg.content)) {
              for (const c of chMsg.content) {
                if (c && c.text) chatReply += c.text;
              }
            }
          }
        }

        if (!chatReply) chatReply = "⚠️ OpenAI returned no text (chat). Check logs.";
        return res.json({ reply: chatReply });
      } catch (errChat) {
        console.error("OpenAI chat attempt failed:", errChat);
        return res.status(500).json({ error: "Error calling OpenAI. Check server logs and OPENAI_API_KEY." });
      }
    }
  } catch (err) {
    console.error("/api/chat error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// --- Image generation endpoint
app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt in body." });

    if (!openai) return res.status(400).json({ error: "OPENAI_API_KEY not set." });

    // Use Images API (modern)
    try {
      const imageResp = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024"
      });

      // SDK may return data array with a url or b64_json
      if (imageResp?.data?.length && imageResp.data[0].url) {
        return res.json({ url: imageResp.data[0].url });
      } else if (imageResp?.data?.length && imageResp.data[0].b64_json) {
        // return base64 as data URL
        const b64 = imageResp.data[0].b64_json;
        return res.json({ url: `data:image/png;base64,${b64}` });
      } else {
        console.warn("Unexpected image response shape:", imageResp);
        return res.status(500).json({ error: "Could not generate image (unexpected response)." });
      }
    } catch (err) {
      console.error("Image generation failed:", err?.message || err);
      return res.status(500).json({ error: "Image generation failed." });
    }
  } catch (err) {
    console.error("/api/image error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// --- Simple web search (DuckDuckGo Instant Answer)
app.post("/api/search", async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query) return res.status(400).json({ error: "Missing query." });

    // Use DuckDuckGo Instant Answer JSON (no API key)
    const q = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${q}&format=json&no_redirect=1&skip_disambig=1`;

    // Node 18+ has global fetch
    const r = await fetch(url);
    const data = await r.json();

    const results = [];
    if (data.AbstractText) results.push(`🔎 ${data.AbstractText}`);
    if (Array.isArray(data.RelatedTopics) && data.RelatedTopics.length) {
      for (const t of data.RelatedTopics.slice(0, 5)) {
        if (t.Text) results.push(t.Text);
        else if (t.Topics) {
          for (const st of t.Topics.slice(0, 3)) if (st.Text) results.push(st.Text);
        }
      }
    }

    if (!results.length) results.push("🤔 I couldn't find a quick Instant Answer. Try a different query.");

    return res.json({ results });
  } catch (err) {
    console.error("/api/search error:", err);
    return res.status(500).json({ error: "Search failed." });
  }
});

// --- Remember (basic in-memory)
app.post("/api/remember", (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "Missing text." });
    MEMORIES.push({ text, createdAt: new Date().toISOString() });
    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/remember error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

app.get("/api/memories", (req, res) => {
  return res.json({ memories: MEMORIES.map(m => m.text) });
});

// Serve index.html for any other request (single-page app)
app.get("*", (req, res) => {
  // If you keep index.html at project root instead of public, serve that file
  const indexPath = path.join(PUBLIC_DIR, "index.html");
  res.sendFile(indexPath, err => {
    if (err) {
      res.status(500).send("Index not found on server. Make sure public/index.html exists.");
    }
  });
});

// Start server on Render's expected PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});