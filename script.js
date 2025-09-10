/* Frontend behavior: chat, dropdown actions, dark toggle, image generation, web search, remember & schedule (localStorage) */

const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const selectAction = document.getElementById('action-select');
const themeToggle = document.getElementById('theme-toggle');
const root = document.documentElement;
const STORAGE_KEY = 'jabber_memory_v1';
const SCHEDULE_KEY = 'jabber_schedule_v1';

/* startup theme */
(function initTheme(){
  const saved = localStorage.getItem('jabber_theme');
  if (saved === 'light') {
    document.documentElement.classList.add('light');
    themeToggle.textContent = '☀️';
  } else {
    document.documentElement.classList.remove('light');
    themeToggle.textContent = '🌙';
  }
})();

themeToggle.addEventListener('click', () => {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('jabber_theme', isLight ? 'light' : 'dark');
  themeToggle.textContent = isLight ? '☀️' : '🌙';
});

/* helpers to create / add message bubbles */
function createBubble(text, who = 'bot', html=false){
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${who}`;
  if (html) wrapper.innerHTML = text;
  else wrapper.textContent = text;
  return wrapper;
}
function addMessage(content, who='bot', html=false){
  const bubble = createBubble(content, who, html);
  chatEl.appendChild(bubble);
  chatEl.scrollTo({top: chatEl.scrollHeight, behavior: 'smooth'});
}

/* Remember & schedule handling (localStorage) */
function rememberItem(text) {
  const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  store.push({text, created: new Date().toISOString()});
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  addMessage('✅ Saved to memory.', 'bot');
}
function scheduleItem(text, datetime){
  const store = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]');
  store.push({text, when: datetime, created: new Date().toISOString()});
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(store));
  addMessage(`📅 Scheduled: ${text} @ ${datetime}`, 'bot');
}

/* actions that call backend */
async function callChat(message){
  addMessage(message, 'user');
  try {
    const res = await fetch('/api/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    const reply = data?.reply || '⚠️ No response from Jabber.';
    addMessage(reply, 'bot', true);
  } catch (e) {
    console.error(e);
    addMessage('⚠️ Error connecting to server.', 'bot');
  }
}

async function callImage(prompt){
  addMessage(prompt, 'user');
  try {
    const res = await fetch('/api/image', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (data?.url) {
      addMessage(`<div class="meta">🖼️ Generated image</div><img src="${data.url}" alt="generated">`, 'bot', true);
    } else {
      addMessage('⚠️ Could not generate image.', 'bot');
    }
  } catch(err){ console.error(err); addMessage('⚠️ Image generation failed.', 'bot'); }
}

async function callSearch(query){
  addMessage(query, 'user');
  try {
    const res = await fetch('/api/search', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ query })
    });
    const data = await res.json();
    if (data?.answer) {
      addMessage(`🔎 ${data.answer}`, 'bot', true);
    } else if (data?.abstract) {
      addMessage(`🔎 ${data.abstract}`, 'bot', true);
    } else {
      addMessage('🤔 I searched but could not find a clear Instant Answer.', 'bot');
    }
  } catch(e){ console.error(e); addMessage('⚠️ Web search failed.', 'bot'); }
}

/* main handler depending on dropdown selection */
async function handleSend(){
  const text = inputEl.value.trim();
  if (!text) return;
  const action = selectAction.value;

  if (action === 'remember'){
    rememberItem(text);
    inputEl.value = '';
    return;
  }
  if (action === 'schedule'){
    const when = prompt('Schedule date/time (e.g. 2025-09-10 12:30):');
    if (when) scheduleItem(text, when);
    inputEl.value = '';
    return;
  }
  if (action === 'browse'){
    await callSearch(text);
    inputEl.value = '';
    return;
  }
  if (action === 'image'){
    await callImage(text);
    inputEl.value = '';
    return;
  }

  // default send -> chat
  await callChat(text);
  inputEl.value = '';
}

/* UI events */
sendBtn.addEventListener('click', handleSend);
inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(); });

/* On load show greeting / memory hint */
(function showIntro(){
  addMessage('Hello — I am Jabber. Ask me anything!', 'bot');
  // show cached memory count
  const mem = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (mem.length) addMessage(`💾 I have ${mem.length} saved memories (use "Remember" to add).`, 'bot');
})();