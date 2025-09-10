// script.js - frontend
const chatDiv = document.getElementById('chat');
const input = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const actionSelect = document.getElementById('action-select');
const themeToggle = document.getElementById('theme-toggle');

function addMessage(text, who){
  const el = document.createElement('div');
  el.className = 'message ' + (who === 'user' ? 'user' : 'bot');
  if(who === 'user'){
    el.innerHTML = `<div class="meta">You:</div>${escapeHtml(text)}`;
  } else {
    el.textContent = text;
  }
  chatDiv.appendChild(el);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[s]);
}

async function sendMessage(){
  const txt = input.value.trim();
  if(!txt) return;
  addMessage(txt,'user');
  input.value = '';

  // figure out action: browse triggers web lookup
  const action = actionSelect.value;
  const mode = action === 'browse' ? 'browse' : 'ai';

  // show a temporary spinner message
  const waiting = document.createElement('div');
  waiting.className = 'message bot';
  waiting.textContent = 'Jabber is thinking...';
  chatDiv.appendChild(waiting);
  chatDiv.scrollTop = chatDiv.scrollHeight;

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: txt, mode })
    });
    const data = await res.json();
    waiting.remove();
    if(data && data.reply){
      addMessage(data.reply, 'bot');
    } else {
      addMessage('⚠️ No response from Jabber.','bot');
    }
  } catch (err) {
    waiting.remove();
    addMessage('❌ Connection error','bot');
    console.error(err);
  }
}

sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') sendMessage();
});

// theme toggle
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  themeToggle.textContent = isLight ? '☀️' : '🌙';
});

// helper to focus input when page loads
window.addEventListener('load', () => input.focus());