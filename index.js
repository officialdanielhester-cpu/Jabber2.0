/**
 * index.js - simple Express server with endpoints:
 *  POST /api/chat    -> calls OpenAI chat completions
 *  POST /api/image   -> calls OpenAI image generation
 *  POST /api/search  -> DuckDuckGo Instant Answer quick lookup
 *
 * IMPORTANT: set OPENAI_API_KEY in environment (Render service env var or local .env)
 *
 * Run: npm install && npm start
 */

import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(process.cwd())); // serve files from repo root (index.html, style.css, script.js, logo.png)

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.warn('⚠️ OPENAI_API_KEY is not set. Add it to environment variables.');
}

/* Helper to call OpenAI Chat Completions */
async function callOpenAIChat(message) {
  if (!OPENAI_KEY) throw new Error('No API key set');
  const body = {
    model: "gpt-4o-mini", // lightweight chat model; change if needed
    messages: [{ role: "user", content: message }],
    temperature: 0.7,
    max_tokens: 800
  };
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization": `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify(body)
  });
  return await r.json();
}

/* Helper to call OpenAI Images */
async function callOpenAIImage(prompt) {
  if (!OPENAI_KEY) throw new Error('No API key set');
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method:"POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization": `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "512x512"
    })
  });
  return await r.json();
}

/* Chat endpoint */
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.json({ reply: "⚠️ Empty message." });

    // basic web-search intent detection: if user asks to "browse" explicitly, inform frontend (frontend has browse option)
    const aiResp = await callOpenAIChat(message);
    const reply = aiResp?.choices?.[0]?.message?.content || "⚠️ No reply from OpenAI.";
    res.json({ reply });
  } catch(err) {
    console.error(err);
    res.json({ reply: "⚠️ Error calling OpenAI (check server logs and OPENAI_API_KEY)." });
  }
});

/* Image endpoint */
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.json({ error: 'No prompt provided' });
    const data = await callOpenAIImage(prompt);
    const url = data?.data?.[0]?.url || null;
    res.json({ url });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Image generation failed' });
  }
});

/* Simple web search using DuckDuckGo Instant Answer (no external API key) */
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query) return res.json({ error: 'No query' });

    const qs = new URLSearchParams({ q: query, format: 'json', no_html: '1', skip_disambig: '1' });
    const url = `https://api.duckduckgo.com/?${qs.toString()}`;
    const r = await fetch(url);
    const data = await r.json();

    // Choose best field available
    const answer = data?.AbstractText || data?.RelatedTopics?.[0]?.Text || null;
    res.json({ answer, abstract: data?.AbstractText || null, raw: data });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

/* start server */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));