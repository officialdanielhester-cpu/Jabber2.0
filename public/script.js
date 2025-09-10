// public/script.js
(function () {
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('send');
  const moreBtn = document.getElementById('moreBtn');
  const moreMenu = document.getElementById('moreMenu');
  const rememberStateEl = document.getElementById('rememberState');

  // --- session ID to identify user to server ---
  const SESSION_KEY = 'jabber_session_id_v1';
  function genId(){ return 's_' + Math.random().toString(36).slice(2,12); }
  let sessionId = localStorage.getItem(SESSION_KEY);
  if(!sessionId){ sessionId = genId(); localStorage.setItem(SESSION_KEY, sessionId); }

  // --- remember toggle (client UI + stored setting) ---
  let rememberEnabled = (localStorage.getItem('jabber_remember') === 'true');
  function updateRememberUI(){ rememberStateEl.textContent = rememberEnabled ? 'ON' : 'OFF'; }
  updateRememberUI();

  // utility: add message
  function addMessage(text, who = 'bot', label = '') {
    const div = document.createElement('div');
    div.className = 'msg ' + (who === 'user' ? 'user' : 'bot');
    if (label) {
      const lab = document.createElement('span');
      lab.className = 'label';
      lab.textContent = label;
      div.appendChild(lab);
    }

    if ((typeof text === 'string') && (text.startsWith('http') && (text.match(/\.(jpeg|jpg|gif|png|webp)$/i)))) {
      const img = document.createElement('img');
      img.src = text;
      img.style.maxWidth = '100%';
      img.style.borderRadius = '10px';
      div.appendChild(img);
    } else {
      const p = document.createElement('div');
      p.textContent = text;
      div.appendChild(p);
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // initial welcome
  addMessage('Hello — I am Jabber. Ask me anything!', 'bot');

  // send to server chat endpoint
  async function sendText(promptText) {
    if(!promptText) return;
    addMessage(promptText, 'user', 'You:');
    inputEl.value = '';
    addMessage('⏳ Thinking...', 'bot');

    try {
      const payload = {
        message: promptText,
        sessionId,
        memoryRequested: rememberEnabled
      };
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      // remove last "Thinking..." message
      const last = messagesEl.lastElementChild;
      if (last && last.textContent && last.textContent.includes('Thinking')) last.remove();

      if(!resp.ok){
        addMessage('⚠️ Error calling OpenAI (check server logs and OPENAI_API_KEY).', 'bot');
        console.error('chat error', data);
        return;
      }
      if(data.error){
        addMessage('⚠️ ' + data.error, 'bot');
        return;
      }
      addMessage(data.reply || 'No reply', 'bot');

    } catch (err) {
      const last = messagesEl.lastElementChild;
      if (last && last.textContent && last.textContent.includes('Thinking')) last.remove();
      addMessage('⚠️ Could not reach server — placeholder reply shown.', 'bot');
      console.error(err);
    }
  }

  // send button / enter
  sendBtn.addEventListener('click', () => {
    const v = inputEl.value.trim();
    if(!v) return;
    sendText(v);
  });
  inputEl.addEventListener('keypress', (ev) => {
    if(ev.key === 'Enter') sendBtn.click();
  });

  // dropdown toggle & click outside hide
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    moreMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    if(!moreMenu.classList.contains('hidden')) moreMenu.classList.add('hidden');
  });

  // menu handler
  moreMenu.addEventListener('click', async (evt) => {
    const button = evt.target.closest('.menu-item');
    if(!button) return;
    const action = button.getAttribute('data-action');
    moreMenu.classList.add('hidden');

    if(action === 'remember'){
      rememberEnabled = !rememberEnabled;
      localStorage.setItem('jabber_remember', rememberEnabled ? 'true' : 'false');
      updateRememberUI();
      addMessage('Selected: remember -> ' + (rememberEnabled ? 'ON' : 'OFF'), 'user');
    }

    if(action === 'schedule'){
      const text = prompt('What do you want to schedule? (e.g. "Meeting with Jake tomorrow 9am")');
      if(!text) return;
      const when = prompt('When? (freeform string — server stores it as provided)');
      if(!when) return;
      addMessage('Selected: schedule', 'user');
      try {
        const res = await fetch('/api/schedule', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({sessionId, text, when})});
        const j = await res.json();
        if(j.ok){
          addMessage('✅ Scheduled: ' + text + ' — ' + when, 'bot');
        } else {
          addMessage('⚠️ Could not schedule: ' + (j.error || 'unknown'), 'bot');
        }
      } catch(err){
        addMessage('⚠️ Schedule failed (server unreachable).', 'bot');
      }
    }

    if(action === 'search'){
      const q = prompt('Search the web for:');
      if(!q) return;
      addMessage(`Searching web for: "${q}"`, 'user');
      try {
        const res = await fetch('/api/search', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({query:q})});
        const j = await res.json();
        if(j.results && j.results.length){
          addMessage('🔎 ' + j.results[0], 'bot');
        } else {
          addMessage('🤔 I searched the web but couldn\'t find a clear Instant Answer.', 'bot');
        }
      } catch(err){
        addMessage('⚠️ Web search failed (no server implementation).', 'bot');
      }
    }

    if(action === 'image'){
      const promptText = prompt('Describe the image to generate:');
      if(!promptText) return;
      addMessage('Generating image for: ' + promptText, 'user');
      addMessage('⏳ Generating image...', 'bot');
      try {
        const res = await fetch('/api/image', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prompt: promptText, sessionId})});
        const j = await res.json();
        // remove generating indicator
        const last = messagesEl.lastElementChild;
        if(last && last.textContent && last.textContent.includes('Generating image')) last.remove();

        if(j && j.imageUrl){
          addMessage(j.imageUrl, 'bot'); // client shows image URL — server returns hosted URL from OpenAI
        } else if (j && j.error) {
          addMessage('⚠️ Could not generate image: ' + j.error, 'bot');
        } else {
          addMessage('⚠️ Could not generate image.', 'bot');
        }
      } catch(err){
        const last = messagesEl.lastElementChild;
        if(last && last.textContent && last.textContent.includes('Generating image')) last.remove();
        addMessage('⚠️ Could not generate image (server unreachable).', 'bot');
      }
    }

  });

  // expose a small helper to clear memory (dev)
  window._jabber_clearMemory = async function(){
    try{
      await fetch('/api/memory/clear', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({sessionId})});
      addMessage('✅ Local server memory cleared.', 'bot');
    }catch(e){ addMessage('⚠️ Could not clear memory.', 'bot'); }
  };

})();