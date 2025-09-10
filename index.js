// index.js (server)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";
import OpenAI from "openai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html, style.css, script.js, logo.png etc

// Ensure you set OPENAI_API_KEY in Render or local .env
const openaiApiKey = process.env.OPENAI_API_KEY;
let openaiClient = null;
if(openaiApiKey){
  openaiClient = new OpenAI({ apiKey: openaiApiKey });
}

// POST /chat - body: { message: string, mode: 'ai'|'browse' }
app.post("/chat", async (req, res) => {
  const { message, mode } = req.body || {};
  if(!message) return res.json({ reply: "⚠️ Please type a message." });

  if(mode === 'browse'){
    // quick duckduckgo instant answer
    try {
      const q = encodeURIComponent(message);
      const r = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`);
      const data = await r.json();
      // choose AbstractText or first RelatedTopic
      let reply = "";
      if(data.AbstractText && data.AbstractText.trim()){
        reply = `🔎 ${data.AbstractText}`;
      } else if (data.RelatedTopics && data.RelatedTopics.length){
        // take first useful text
        const first = data.RelatedTopics[0];
        if(first.Text) reply = `🔎 ${first.Text}`;
        else reply = `🔎 I found something but couldn't extract a short summary.`;
      } else {
        reply = `🤔 I searched the web but couldn't find a clear Instant Answer.`;
      }
      return res.json({ reply });
    } catch (err) {
      console.error("DuckDuckGo error:", err);
      return res.json({ reply: "⚠️ Sorry, web lookup failed." });
    }
  }

  // fallback to OpenAI if available
  if(!openaiClient){
    return res.json({ reply: "⚠️ OPENAI_API_KEY not configured on the server. Add it and redeploy." });
  }

  try {
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are Jabber, a helpful assistant. Keep answers concise for the chat UI." },
        { role: "user", content: message }
      ],
      max_tokens: 350,
      temperature: 0.7
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim() || "⚠️ No reply from model.";
    return res.json({ reply });
  } catch (err) {
    console.error("OpenAI error:", err);
    return res.json({ reply: "⚠️ Error calling OpenAI (check server logs and OPENAI_API_KEY)." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));