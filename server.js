// server.js (CommonJS) - put at repo root
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
if(!OPENAI_KEY) console.warn('Warning: OPENAI_API_KEY not set in environment. Set it in Render or your shell.');

// data files
const MEMORY_FILE = path.join(__dirname, 'server_memory.json');
const SCHEDULE_FILE = path.join(__dirname, 'schedules.json');

async function readJson(file){
  try {
    const t = await fs.readFile(file, 'utf8');
    return JSON.parse(t || '{}');
  } catch (e) {
    return {};
  }
}
async function writeJson(file, obj){
  try {
    await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8');
  } catch(e){
    console.error('write error', e);
  }
}

// --- /api/chat ---
app.post('/api/chat', async (req, res) => {
  const { message, sessionId, memoryRequested } = req.body;
  if(!message) return res.status(400).json({ error: 'missing message' });
  try {
    // load server memory for session (if any)
    const allMemory = await readJson(MEMORY_FILE);
    const serverMem = (sessionId && allMemory[sessionId]) ? allMemory[sessionId] : [];

    // Build messages for OpenAI
    // include server memory only if requested
    const messagesForOpenAI = [
      { role: 'system', content: 'You are Jabber — a helpful assistant. Keep answers friendly and concise.' }
    ];
    if(memoryRequested && serverMem.length){
      // convert to role/content
      serverMem.forEach(it => {
        if(it.role && it.content) messagesForOpenAI.push({ role: it.role, content: it.content });
      });
    }
    messagesForOpenAI.push({ role: 'user', content: message });

    if(!OPENAI_KEY) {
      // return placeholder reply so UI still works during dev
      const placeholder = `This is a placeholder reply. (No OPENAI_API_KEY set on server)`;
      // persist hint in server memory if requested
      if(sessionId){
        allMemory[sessionId] = allMemory[sessionId] || [];
        allMemory[sessionId].push({ role: 'user', content: message, ts: Date.now() });
        allMemory[sessionId].push({ role: 'assistant', content: placeholder, ts: Date.now() });
        if(allMemory[sessionId].length > 80) allMemory[sessionId] = allMemory[sessionId].slice(-80);
        await writeJson(MEMORY_FILE, allMemory);
      }
      return res.json({ reply: placeholder });
    }

    // call OpenAI Chat Completions
    const fetchResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // change if needed
        messages: messagesForOpenAI,
        max_tokens: 800
      })
    });
    const body = await fetchResp.json();
    if(body.error) {
      console.error('openai error', body.error);
      return res.status(500).json({ error: body.error.message || 'OpenAI error' });
    }

    const reply = (body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content) || 'No reply.';
    // persist to server memory
    if(sessionId){
      allMemory[sessionId] = allMemory[sessionId] || [];
      allMemory[sessionId].push({ role: 'user', content: message, ts: Date.now() });
      allMemory[sessionId].push({ role: 'assistant', content: reply, ts: Date.now() });
      if(allMemory[sessionId].length > 80) allMemory[sessionId] = allMemory[sessionId].slice(-80);
      await writeJson(MEMORY_FILE, allMemory);
    }

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching reply.' });
  }
});

// --- /api/image ---
app.post('/api/image', async (req, res) => {
  const { prompt } = req.body;
  if(!prompt) return res.status(400).json({ error: 'missing prompt' });
  if(!OPENAI_KEY){
    return res.json({ imageUrl: null, error: 'No OPENAI_API_KEY on server (placeholder)' });
  }
  try {
    const fetchResp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '512x512'
      })
    });
    const body = await fetchResp.json();
    if(body.error) {
      console.error('image error', body.error);
      return res.status(500).json({ error: body.error.message || 'Image generation error' });
    }
    const url = (body.data && body.data[0] && body.data[0].url) || null;
    res.json({ imageUrl: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while generating image.' });
  }
});

// --- placeholder web search ---
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  // implement a proper search provider (Bing/Serper) later
  res.json({ results: [`Pretend search result for: ${query}`] });
});

// --- scheduling endpoints ---
app.post('/api/schedule', async (req, res) => {
  const { sessionId, when, text } = req.body;
  if(!sessionId || !when || !text) return res.status(400).json({ error: 'missing fields' });
  try {
    const schedules = await readJson(SCHEDULE_FILE);
    schedules[sessionId] = schedules[sessionId] || [];
    const item = { id: Date.now().toString(36), when, text, created: Date.now() };
    schedules[sessionId].push(item);
    await writeJson(SCHEDULE_FILE, schedules);
    res.json({ ok: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save schedule' });
  }
});

app.get('/api/schedule', async (req, res) => {
  const sessionId = req.query.sessionId;
  const schedules = await readJson(SCHEDULE_FILE);
  res.json({ items: (schedules[sessionId] || []) });
});

// --- memory endpoints (inspect/clear) ---
app.get('/api/memory', async (req,res) => {
  const sessionId = req.query.sessionId;
  const mem = await readJson(MEMORY_FILE);
  res.json({ memory: mem[sessionId] || [] });
});
app.post('/api/memory/clear', async (req,res) => {
  const { sessionId } = req.body;
  const mem = await readJson(MEMORY_FILE);
  if(sessionId) mem[sessionId] = [];
  await writeJson(MEMORY_FILE, mem);
  res.json({ ok: true });
});

// fallback - serve index.html for single-page usage
app.get('*', (req,res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));