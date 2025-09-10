// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static client files from /public
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Simple in-memory server memory (non-persistent). Good for testing.
let serverMemory = {
  conversation: [],   // {role: 'user'|'assistant', content: '...'}
  remembered: [],     // {text, createdAt}
  schedule: [],       // {title, when, createdAt}
};

// --- API: chat (simple fallback) ---
// If you later add a working OpenAI key & code, replace inside this handler.
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'No message provided' });

    // store user message
    serverMemory.conversation.push({ role: 'user', content: message });

    // If you want to use OpenAI server-side, check for OPENAI_API_KEY here and forward the request.
    // For now we return a friendly fallback reply so the UI stays interactive.
    const fallbackReply = `I heard you say "${message}". (This is a local fallback reply from the server.)`;

    serverMemory.conversation.push({ role: 'assistant', content: fallbackReply });

    return res.json({ reply: fallbackReply });
  } catch (err) {
    console.error('Chat error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// --- API: image generation placeholder ---
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

    // If you add OpenAI key later you can make the image call here.
    // For now return a harmless placeholder image so UI shows something.
    const placeholder = 'https://via.placeholder.com/512x512.png?text=Image+Placeholder';
    return res.json({ imageUrl: placeholder });
  } catch (err) {
    console.error('Image error', err);
    return res.status(500).json({ error: 'Server error generating image' });
  }
});

// --- API: search placeholder ---
app.post('/api/search', async (req, res) => {
  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: 'No query provided' });
  // Return simple mock results so the client doesn't break
  return res.json({
    results: [
      `Pretend search result for: ${query}`,
      `Another result for: ${query}`
    ]
  });
});

// --- API: remember & schedule (server-side fallback) ---
app.post('/api/remember', (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'No text to remember' });
  const item = { text, createdAt: new Date().toISOString() };
  serverMemory.remembered.push(item);
  return res.json({ ok: true, item });
});

app.post('/api/schedule', (req, res) => {
  const { when, title } = req.body || {};
  if (!when || !title) return res.status(400).json({ error: 'Missing when or title' });
  const item = { when, title, createdAt: new Date().toISOString() };
  serverMemory.schedule.push(item);
  return res.json({ ok: true, item });
});

// Fallback: if route not matched and file exists, static middleware above handles it.
// For single-page apps, serve index.html for unknown GET routes:
app.get('*', (req, res) => {
  // if request accepts html, return index.html so client SPA can handle routing
  if (req.accepts('html')) {
    return res.sendFile(path.join(publicDir, 'index.html'), err => {
      if (err) {
        res.status(404).send('Index not found on server. Make sure public/index.html exists.');
      }
    });
  } else {
    res.status(404).send('Not Found');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});