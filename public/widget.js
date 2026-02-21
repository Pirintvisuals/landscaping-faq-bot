(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  const CFG = window.LANDSCALE_CONFIG || {};
  const API_URL = (CFG.apiUrl || 'https://landscaping-faq-bot-iu5s.vercel.app/api/chat')
    .replace('/api/faq-agent', '/api/chat'); // auto-correct old path

  const OPENING_MESSAGE =
    "Good day. I'm the Landscale Digital Assistant — here to help qualify your garden project and get you connected with Milán's team.\n\n" +
    "Whether you're after a full patio build, soft landscaping, timber work, or ongoing maintenance, we can help.\n\n" +
    "To get started, could I take the postcode for the property?";

  // Pre-seed history so Gemini knows its opening line
  const history = [
    { role: 'user',  parts: [{ text: 'Hello, I have a garden project I would like to discuss.' }] },
    { role: 'model', parts: [{ text: JSON.stringify({ message: OPENING_MESSAGE, lead: null }) }] },
  ];

  // ── Styles (fully scoped — won't touch your Framer site) ─────────────────
  const css = `
    #lc-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #1a3d1a;
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.22);
      z-index: 2147483640;
      transition: background 0.18s, transform 0.18s;
      font-size: 24px;
      line-height: 1;
    }
    #lc-fab:hover { background: #2d5a27; transform: scale(1.07); }

    #lc-label {
      position: fixed;
      bottom: 94px;
      right: 18px;
      background: #fff;
      color: #1a3d1a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      font-weight: 700;
      padding: 12px 18px;
      border-radius: 14px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.22);
      white-space: nowrap;
      z-index: 2147483641;
      pointer-events: none;
      transition: opacity 0.4s, transform 0.4s;
      transform: translateY(0);
      letter-spacing: -0.01em;
    }
    #lc-label::after {
      content: '';
      position: absolute;
      bottom: -6px;
      right: 22px;
      width: 12px;
      height: 12px;
      background: #fff;
      transform: rotate(45deg);
      border-radius: 2px;
    }
    #lc-label.lc-label-hidden {
      opacity: 0;
      transform: translateY(4px);
      pointer-events: none;
    }

    #lc-window {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 360px;
      height: 520px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      z-index: 2147483639;
      overflow: hidden;
      transform-origin: bottom right;
      transition: opacity 0.2s, transform 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #lc-window.lc-hidden {
      opacity: 0;
      transform: scale(0.85);
      pointer-events: none;
    }

    @media (max-width: 420px) {
      #lc-window {
        width: calc(100vw - 16px);
        height: 70dvh;
        bottom: 88px;
        right: 8px;
      }
    }

    #lc-header {
      background: #1a3d1a;
      color: #fff;
      padding: 13px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    #lc-header-icon {
      font-size: 20px;
      width: 36px;
      height: 36px;
      background: rgba(255,255,255,0.12);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #lc-header-text { flex: 1; }
    #lc-header-title { font-size: 14px; font-weight: 600; margin: 0; }
    #lc-header-sub { font-size: 11px; opacity: 0.7; display: block; margin-top: 1px; }
    #lc-close {
      background: none;
      border: none;
      color: rgba(255,255,255,0.8);
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;
      transition: color 0.15s;
    }
    #lc-close:hover { color: #fff; }

    #lc-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      scroll-behavior: smooth;
    }
    #lc-messages::-webkit-scrollbar { width: 3px; }
    #lc-messages::-webkit-scrollbar-thumb { background: #c4d4c4; border-radius: 2px; }

    .lc-msg { display: flex; }
    .lc-msg.lc-user { justify-content: flex-end; }

    .lc-bubble {
      max-width: 82%;
      padding: 9px 13px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.5;
      word-break: break-word;
    }
    .lc-msg.lc-bot .lc-bubble {
      background: #f0f4f0;
      color: #1a2a1a;
      border-bottom-left-radius: 4px;
    }
    .lc-msg.lc-user .lc-bubble {
      background: #1a3d1a;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .lc-msg.lc-bot .lc-bubble a {
      color: #1a3d1a;
      font-weight: 600;
    }

    #lc-typing {
      padding: 0 12px 6px;
      display: none;
    }
    .lc-typing-bubble {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      background: #f0f4f0;
      padding: 10px 14px;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
    }
    .lc-typing-bubble span {
      width: 6px;
      height: 6px;
      background: #7a9e7a;
      border-radius: 50%;
      animation: lc-bounce 1.3s infinite ease-in-out;
    }
    .lc-typing-bubble span:nth-child(2) { animation-delay: 0.18s; }
    .lc-typing-bubble span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes lc-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    #lc-input-row {
      padding: 10px 12px;
      display: flex;
      gap: 7px;
      border-top: 1px solid #e4ebe4;
      flex-shrink: 0;
    }
    #lc-input {
      flex: 1;
      border: 1.5px solid #cdd9cd;
      border-radius: 20px;
      padding: 8px 14px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
      color: #1a2a1a;
      background: #fff;
    }
    #lc-input:focus { border-color: #1a3d1a; }
    #lc-input:disabled { background: #f7faf7; }

    #lc-send {
      width: 38px;
      height: 38px;
      background: #1a3d1a;
      border: none;
      border-radius: 50%;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    #lc-send:hover:not(:disabled) { background: #2d5a27; }
    #lc-send:disabled { background: #a8bea8; cursor: not-allowed; }
  `;

  const styleEl = document.createElement('style');
  styleEl.id = 'lc-styles';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── DOM ───────────────────────────────────────────────────────────────────
  const fab = document.createElement('button');
  fab.id = 'lc-fab';
  fab.setAttribute('aria-label', 'Open Landscale chat');
  fab.innerHTML = '🌿';

  const label = document.createElement('div');
  label.id = 'lc-label';
  label.textContent = 'Ready to turn your garden into a high-end retreat? 🌿';
  document.body.appendChild(label);

  // Auto-hide the label after 5 seconds
  setTimeout(() => label.classList.add('lc-label-hidden'), 5000);

  const win = document.createElement('div');
  win.id = 'lc-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'Landscale Digital Assistant');
  win.classList.add('lc-hidden');
  win.innerHTML = `
    <div id="lc-header">
      <div id="lc-header-icon">🌿</div>
      <div id="lc-header-text">
        <div id="lc-header-title">Landscale Digital Assistant</div>
        <span id="lc-header-sub">Representing Milán &amp; the Landscale team</span>
      </div>
      <button id="lc-close" aria-label="Close chat">✕</button>
    </div>
    <div id="lc-messages" role="log" aria-live="polite"></div>
    <div id="lc-typing"><div class="lc-typing-bubble"><span></span><span></span><span></span></div></div>
    <div id="lc-input-row">
      <input id="lc-input" type="text" placeholder="Type your message…" autocomplete="off" aria-label="Your message">
      <button id="lc-send" aria-label="Send">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(win);

  // ── Element refs ──────────────────────────────────────────────────────────
  const msgArea  = document.getElementById('lc-messages');
  const input    = document.getElementById('lc-input');
  const sendBtn  = document.getElementById('lc-send');
  const typing   = document.getElementById('lc-typing');
  const closeBtn = document.getElementById('lc-close');

  // ── Open / close ──────────────────────────────────────────────────────────
  let isOpen = false;

  function openChat() {
    isOpen = true;
    win.classList.remove('lc-hidden');
    fab.innerHTML = '✕';
    fab.setAttribute('aria-label', 'Close chat');
    label.classList.add('lc-label-hidden');
    if (msgArea.children.length === 0) appendMsg(OPENING_MESSAGE, 'bot');
    setTimeout(() => input.focus(), 220);
  }

  function closeChat() {
    isOpen = false;
    win.classList.add('lc-hidden');
    fab.innerHTML = '🌿';
    fab.setAttribute('aria-label', 'Open Landscale chat');
  }

  fab.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);

  // ── Messaging ─────────────────────────────────────────────────────────────
  let leadAlreadySent = false; // ensures only one email per conversation

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  sendBtn.addEventListener('click', send);

  async function send() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    input.value = '';
    appendMsg(text, 'user');
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, leadAlreadySent }),
      });
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      const reply = data.reply || "Apologies — something went wrong. Please try again.";

      if (data.leadSent) leadAlreadySent = true;

      history.push(
        { role: 'user',  parts: [{ text }] },
        { role: 'model', parts: [{ text: data.rawResponse || JSON.stringify({ message: reply, lead: null }) }] }
      );
      appendMsg(reply, 'bot');
    } catch {
      appendMsg("Apologies — I'm having trouble connecting. Please try again shortly.", 'bot');
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  function appendMsg(text, role) {
    const wrapper = document.createElement('div');
    wrapper.className = `lc-msg lc-${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'lc-bubble';
    bubble.innerHTML = fmt(text);
    wrapper.appendChild(bubble);
    msgArea.appendChild(wrapper);
    msgArea.scrollTop = msgArea.scrollHeight;
  }

  function fmt(text) {
    let s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    s = s.replace(/(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return s.replace(/\n/g, '<br>');
  }

  function setLoading(on) {
    sendBtn.disabled = on;
    input.disabled   = on;
    typing.style.display = on ? 'block' : 'none';
    if (on) msgArea.scrollTop = msgArea.scrollHeight;
  }

})();
