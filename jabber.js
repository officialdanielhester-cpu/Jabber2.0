// jabber.js
// Load environment variables from .env
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');

const app = express();
app.use(bodyParser.json());

// Initialize OpenAI with API key from .env
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Route: test that server is working
app.get('/', (req, res) => {
  res.send('🚀 Jabber is running!');
});

// Route: send a message to Jabber
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    const response = await client.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: message }],
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Something went wrong with Jabber." });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Jabber is listening on http://localhost:${PORT}`);
});
