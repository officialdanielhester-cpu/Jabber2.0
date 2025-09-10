/* script.js - complete file
   - Adds chat bubbles (user + bot)
   - Adds "More" dropdown with: Remember, Schedule, Search Web, Generate Image
   - Sends messages to /api/chat and displays replies
   - POSTs image prompts to /api/image and displays returned image
   - POSTs search to /api/search and shows results (fallback if endpoint missing)
   - POSTs remember/schedule to /api/remember and /api/schedule (falls back to localStorage)
   - Graceful error handling and local fallback memory
   - Looks up DOM elements robustly using common selectors found in your screenshots
*/

(function () {
  // ---------- Helper: DOM selectors (robust) ----------
  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  // Find message input by placeholder "Type your message..."
  const messageInput =
    qs('[placeholder="Type your message..."]') ||
    qs('input[type="text"]') ||
    qs('textarea') ||
    qs('.message-input') ||
    null;

  // Find send button by text content containing 'Send'
  let sendBtn =
    qsa('button').find(b => /send/i.test(b.textContent)) ||
    qs('.send-btn') ||
    qs('#send');

  // Find More/More... button (dropdown trigger)
  let moreBtn =
    qsa('button').find(b => /more/i.test(b.textContent)) ||
    qs('.more-btn') ||
    qs('#more');

  // Find main chat container: prefer element with id="chat" or class containing 'messages' or 'chat-body'
  let chatContainer =
    qs('#messages') ||
    qs('#chat') ||
    qs('.chat-messages') ||
    qs('.messages') ||
    qs('.chat-body') ||
    qs('main') ||
    document.body;

  // If chatContainer is still root document.body, create a dedicated container at top to avoid weird insertion points
  if (!chatContainer || chatContainer === document.body) {
    // try to find a large box by computed height / width presence - if not, still use body
    const fallback = qs('#chat') || qs('.chat') || document.body;
    chatContainer = fallback;
  }

  // If essential DOM missing, create a minimal UI area to append messages (non-destructive)
  function ensureChatArea() {
    // If there's an element with id="jabber-chat-area" use it, else create a wrapper inside chatContainer
    let el = qs('#jabber-chat-area');
    if (!el) {
      el = document.createElement('div');
      el.id = 'jabber-chat-area';
      // don't alter layout too much - add as first child
      el.style.minHeight = '200px';
      el.style.padding = '8px';
      el.style.boxSizing = 'border-box';
      // insert at top of chatContainer
      if (chatContainer && chatContainer.firstChild) {
        chatContainer.insertBefore(el, chatContainer.firstChild);
      } else if (chatContainer) {
        chatContainer.appendChild(el);
      } else {
        document.body.appendChild(el);
      }
    }
    return el;
  }

  const jabberArea = ensureChatArea();

  // ---------- Utility: create bubbles ----------
  function createBubble({ text = '', role = 'bot', html = false, imgSrc = null }) {
    const wrapper = document.createElement('div');
    wrapper.className = `jabber-bubble-wrapper jabber-${role}`;
    wrapper.style.display = 'flex';
    wrapper.style.margin = '8px 12px';
    wrapper.style.maxWidth = '88%';

    // Align user bubbles to right
    if (role === 'user') wrapper.style.justifyContent = 'flex-end';
    else wrapper.style.justifyContent = 'flex-start';

    const bubble = document.createElement('div');
    bubble.className = `jabber-bubble jabber-${role}-bubble`;
    bubble.style.background = role === 'user' ? 'linear-gradient(180deg,#b14cff,#9731ff)' : '#3c3c3c';
    bubble.style.color = role === 'user' ? '#fff' : '#fff';
    bubble.style.padding = '14px';
    bubble.style.borderRadius = role === 'user' ? '16px 4px 16px 16px' : '16px';
    bubble.style.boxShadow = '0 6px 18px rgba(0,0,0,0.3)';
    bubble.style.fontFamily = '"Orbitron", "Arial", sans-serif';
    bubble.style.fontSize = '15px';
    bubble.style.lineHeight = '1.4';
    bubble.style.maxWidth = '100%';
    bubble.style.wordWrap = 'break-word';
    bubble.style.whiteSpace = 'pre-wrap';

    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = 'generated image';
      img.style.maxWidth = '220px';
      img.style.display = 'block';
      img.style.borderRadius = '10px';
      img.style.marginTop = '6px';
      bubble.appendChild(img);
    }

    if (html) bubble.innerHTML = text;
    else bubble.textContent = text;

    wrapper.appendChild(bubble);
    return wrapper;
  }

  function appendBubble(opts) {
    const b = createBubble(opts);
    jabberArea.appendChild(b);
    // scroll into view
    b.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  // ---------- Local memory fallback ----------
  const LOCAL_MEMORY_KEY = 'jabber_local_memory_v1';
  function loadLocalMemory() {
    try {
      const raw = localStorage.getItem(LOCAL_MEMORY_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }
  function saveLocalMemory(mem) {
    try {
      localStorage.setItem(LOCAL_MEMORY_KEY, JSON.stringify(mem));
    } catch (e) {}
  }
  let localMemory = loadLocalMemory(); // array of {role, content}

  // ---------- Network helpers ----------
  async function postJson(url, body) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => null);
    return { ok: resp.ok, status: resp.status, data };
  }

  // ---------- Chat send logic ----------
  let pending = false;
  async function sendMessage(text, options = {}) {
    if (!text || !text.trim()) return;
    // show user bubble
    appendBubble({ text, role: 'user' });

    // add to local memory
    localMemory.push({ role: 'user', content: text });
    saveLocalMemory(localMemory);

    // send to server
    pending = true;
    const showTyping = appendBubble({ text: '⏳ Jabber is typing...', role: 'bot' });
    try {
      const { ok, data } = await postJson('/api/chat', { message: text, options: options || {} });

      // remove typing bubble
      if (showTyping && showTyping.parentNode) {
        showTyping.parentNode.removeChild(showTyping);
      }

      if (!ok || !data) {
        // fallback: display error bubble and a placeholder response if available
        const msg = data && data.reply ? data.reply : '⚠️ No reply from server. (fallback)';
        appendBubble({ text: `⚠️ ${msg}`, role: 'bot' });
        return;
      }

      // server returned reply or structured response
      const reply = data.reply || (data.choices && data.choices[0] && (data.choices[0].message?.content || data.choices[0].text)) || null;

      if (reply) {
        appendBubble({ text: reply, role: 'bot' });
        // store memory
        localMemory.push({ role: 'assistant', content: reply });
        saveLocalMemory(localMemory);
      } else if (data.imageUrl) {
        // image response
        appendBubble({ text: 'Generated image:', role: 'bot' });
        appendBubble({ imgSrc: data.imageUrl, role: 'bot' });
      } else {
        appendBubble({ text: '⚠️ No reply from API.', role: 'bot' });
      }
    } catch (err) {
      // remove typing bubble
      if (showTyping && showTyping.parentNode) {
        showTyping.parentNode.removeChild(showTyping);
      }
      appendBubble({ text: '⚠️ Error contacting server. See console.', role: 'bot' });
      console.error(err);
    } finally {
      pending = false;
    }
  }

  // ---------- Image generation ----------
  async function generateImage(prompt) {
    appendBubble({ text: `🖌️ Generating image for: ${prompt}`, role: 'bot' });
    try {
      const { ok, data } = await postJson('/api/image', { prompt });
      if (!ok || !data) {
        appendBubble({ text: `⚠️ Could not generate image: ${data && data.error ? data.error : 'server error'}`, role: 'bot' });
        return;
      }
      const url = data.imageUrl || (data.data && data.data[0] && data.data[0].url);
      if (!url) {
        appendBubble({ text: `⚠️ No image URL returned.`, role: 'bot' });
        return;
      }
      appendBubble({ text: 'Here you go — generated image:', role: 'bot' });
      appendBubble({ imgSrc: url, role: 'bot' });
    } catch (e) {
      appendBubble({ text: '⚠️ Error generating image.', role: 'bot' });
      console.error(e);
    }
  }

  // ---------- Search flow ----------
  async function searchWeb(query) {
    appendBubble({ text: `🔎 Searching the web for: ${query}`, role: 'bot' });
    try {
      const { ok, data } = await postJson('/api/search', { query });
      if (!ok || !data) {
        appendBubble({ text: `⚠️ Search failed: ${data && data.error ? data.error : 'server error'}`, role: 'bot' });
        return;
      }
      const results = data.results || (Array.isArray(data) ? data : null);
      if (!results || results.length === 0) {
        appendBubble({ text: "🤔 I searched but couldn't find a clear Instant Answer.", role: 'bot' });
        return;
      }
      // format results
      for (const r of results.slice(0, 5)) {
        const text = typeof r === 'string' ? r : (r.title ? `${r.title} — ${r.snippet || ''}` : JSON.stringify(r));
        appendBubble({ text: `🔗 ${text}`, role: 'bot' });
      }
    } catch (e) {
      appendBubble({ text: '⚠️ Error while searching.', role: 'bot' });
      console.error(e);
    }
  }

  // ---------- Remember / Schedule ----------
  async function rememberItem(text) {
    // Try server endpoint first
    try {
      const { ok, data } = await postJson('/api/remember', { text });
      if (ok) {
        appendBubble({ text: `🧠 Remembered: ${text}`, role: 'bot' });
        return;
      }
    } catch (e) {
      // ignore, fallback to local memory
    }
    // fallback: localStorage
    try {
      const mem = JSON.parse(localStorage.getItem('jabber_remember_v1') || '[]');
      mem.push({ text, createdAt: new Date().toISOString() });
      localStorage.setItem('jabber_remember_v1', JSON.stringify(mem));
      appendBubble({ text: `🧠 (Local) Remembered: ${text}`, role: 'bot' });
    } catch (e) {
      appendBubble({ text: '⚠️ Could not save memory.', role: 'bot' });
    }
  }

  async function scheduleItem(whenISO, title) {
    try {
      const { ok, data } = await postJson('/api/schedule', { when: whenISO, title });
      if (ok) {
        appendBubble({ text: `⏰ Scheduled "${title}" for ${whenISO}`, role: 'bot' });
        return;
      }
    } catch (e) {
      // fallback
    }
    // local fallback
    try {
      const sched = JSON.parse(localStorage.getItem('jabber_schedule_v1') || '[]');
      sched.push({ when: whenISO, title, createdAt: new Date().toISOString() });
      localStorage.setItem('jabber_schedule_v1', JSON.stringify(sched));
      appendBubble({ text: `⏰ (Local) Scheduled "${title}" for ${whenISO}`, role: 'bot' });
    } catch (e) {
      appendBubble({ text: '⚠️ Could not schedule item.', role: 'bot' });
    }
  }

  // ---------- UI: Build More dropdown / modal flows ----------
  function createMoreDropdown() {
    // If a dropdown already exists, do nothing
    if (qs('#jabber-more-dropdown')) return;

    const container = document.createElement('div');
    container.id = 'jabber-more-dropdown';
    container.style.position = 'absolute';
    container.style.zIndex = '9999';
    container.style.minWidth = '180px';
    container.style.background = '#0f0f0f';
    container.style.border = '1px solid rgba(128,45,255,0.9)';
    container.style.padding = '8px';
    container.style.borderRadius = '10px';
    container.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';
    container.style.color = '#fff';
    container.style.display = 'none';

    const items = [
      { label: '🧠 Remember', action: openRememberPrompt },
      { label: '⏰ Schedule', action: openSchedulePrompt },
      { label: '🌐 Search Web', action: openSearchPrompt },
      { label: '🎨 Generate Image', action: openImagePrompt },
    ];

    items.forEach(it => {
      const el = document.createElement('div');
      el.textContent = it.label;
      el.style.padding = '10px';
      el.style.cursor = 'pointer';
      el.style.borderRadius = '8px';
      el.style.margin = '4px 0';
      el.onmouseenter = () => (el.style.background = 'rgba(255,255,255,0.04)');
      el.onmouseleave = () => (el.style.background = 'transparent');
      el.onclick = () => {
        hideMoreDropdown();
        setTimeout(() => it.action(), 120);
      };
      container.appendChild(el);
    });

    document.body.appendChild(container);
  }

  function positionDropdown(btn) {
    const dd = qs('#jabber-more-dropdown');
    if (!dd || !btn) return;
    const rect = btn.getBoundingClientRect();
    dd.style.left = `${Math.max(8, rect.left)}px`;
    // position above or below depending on space
    const fitsBelow = rect.bottom + 220 < window.innerHeight;
    dd.style.top = `${fitsBelow ? rect.bottom + 8 : rect.top - 8 - 200}px`;
    dd.style.display = 'block';
  }

  function hideMoreDropdown() {
    const dd = qs('#jabber-more-dropdown');
    if (dd) dd.style.display = 'none';
  }

  // simple prompt UIs (non-intrusive)
  function openRememberPrompt() {
    const text = prompt('Remember what? (short note)');
    if (text && text.trim()) rememberItem(text.trim());
  }

  function openSchedulePrompt() {
    // two-step prompt: when + title
    const title = prompt('Schedule title (e.g., "Doctor", "Meeting")');
    if (!title) return;
    const when = prompt('When? Enter ISO datetime (YYYY-MM-DDTHH:MM) or natural text (will be saved as text if not ISO). Example: 2025-09-10T14:00');
    if (!when) return;
    // If it's ISO, keep as-is; else store as text string
    const whenISO = when;
    scheduleItem(whenISO, title);
  }

  function openSearchPrompt() {
    const query = prompt('Search the web for:');
    if (!query) return;
    searchWeb(query);
  }

  function openImagePrompt() {
    const promptText = prompt('Image prompt (describe what you want):');
    if (!promptText) return;
    generateImage(promptText);
  }

  // ---------- Attach dropdown behaviors ----------
  createMoreDropdown();

  if (moreBtn) {
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = qs('#jabber-more-dropdown');
      if (!dd) return;
      if (dd.style.display === 'block') hideMoreDropdown();
      else positionDropdown(moreBtn);
    });
  } else {
    // if more button isn't found, create a small floating button bottom-right
    const fallbackMore = document.createElement('button');
    fallbackMore.id = 'jabber-more-fallback';
    fallbackMore.textContent = 'More...';
    fallbackMore.style.position = 'fixed';
    fallbackMore.style.right = '12px';
    fallbackMore.style.bottom = '78px';
    fallbackMore.style.zIndex = '999';
    fallbackMore.style.padding = '10px 12px';
    fallbackMore.style.borderRadius = '10px';
    fallbackMore.style.background = '#7a2cff';
    fallbackMore.style.color = '#fff';
    fallbackMore.style.border = 'none';
    fallbackMore.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
    fallbackMore.onclick = () => {
      const dd = qs('#jabber-more-dropdown');
      if (!dd) return;
      if (dd.style.display === 'block') hideMoreDropdown();
      else positionDropdown(fallbackMore);
    };
    document.body.appendChild(fallbackMore);
    moreBtn = fallbackMore;
  }

  // hide dropdown on outside click
  document.addEventListener('click', (e) => {
    const dd = qs('#jabber-more-dropdown');
    if (!dd) return;
    if (!dd.contains(e.target) && e.target !== moreBtn) hideMoreDropdown();
  });

  // ---------- Connect send/enter ----------
  async function onSendClicked() {
    if (pending) return;
    const text = messageInput ? messageInput.value : null;
    if (!text || !text.trim()) return;
    // clear input quickly for better UX
    if (messageInput) messageInput.value = '';
    await sendMessage(text.trim());
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      onSendClicked();
    });
  }

  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSendClicked();
      }
    });
  }

  // ---------- Startup greeting ----------
  function initGreeting() {
    appendBubble({ text: 'Hello — I am Jabber. Ask me anything!', role: 'bot' });
  }

  // If jabberArea empty, show greeting once
  if (!jabberArea.querySelector('.jabber-bubble-wrapper')) {
    setTimeout(initGreeting, 600);
  }

  // ---------- Expose for console debugging (optional) ----------
  window.jabber = {
    sendMessage,
    generateImage,
    searchWeb,
    rememberItem,
    scheduleItem,
    getLocalMemory: () => localMemory.slice(),
  };

  // ---------- Ensure fonts: attempt to inject Orbitron if not present ----------
  (function injectFont() {
    // add Orbitron via google fonts if not already loaded
    const found = Array.from(document.styleSheets).some(ss => {
      try {
        return ss.href && ss.href.includes('fonts.googleapis.com');
      } catch (e) {
        return false;
      }
    });
    if (!found) {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  })();

})();