/* ═══════════════════════════════════════════════════════════════
   Widget de chat del asistente de IA del portfolio de Adrian.
   Autocontenido: inyecta su propio DOM y habla con el backend /chat.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────
  // En local apunta al backend de dev; en producción, reemplazar por la
  // URL del backend en Cloud Run cuando se despliegue (Fase deploy).
  var IS_LOCAL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  var API_BASE = IS_LOCAL
    ? 'http://' + location.hostname + ':8000'   // mismo host que la página (evita líos IPv4/IPv6)
    : 'https://TODO-URL-CLOUD-RUN';             // TODO(deploy): URL real del backend

  var I18N = {
    es: {
      name: 'Asistente de Adrian',
      status: 'Responde al instante',
      placeholder: 'Escribe tu pregunta…',
      greeting: '¡Hola! 👋 Soy el asistente de Adrian. Pregúntame por su experiencia, proyectos o stack — o si encaja con una vacante.',
      disclaimer: 'IA · puede cometer errores. Verifica lo importante.',
      error: 'Ups, no he podido responder ahora mismo. Inténtalo de nuevo en unos segundos.',
      offline: 'No puedo conectar con el servidor ahora mismo. Inténtalo más tarde.',
      open: 'Abrir chat con el asistente',
      close: 'Cerrar chat'
    },
    en: {
      name: "Adrian's Assistant",
      status: 'Replies instantly',
      placeholder: 'Type your question…',
      greeting: "Hi! 👋 I'm Adrian's assistant. Ask me about his experience, projects or stack — or whether he fits a role.",
      disclaimer: 'AI · may make mistakes. Verify anything important.',
      error: "Oops, I couldn't answer just now. Please try again in a few seconds.",
      offline: "Can't reach the server right now. Please try again later.",
      open: 'Open chat with the assistant',
      close: 'Close chat'
    }
  };

  function getLang() {
    return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'es';
  }

  var messages = [];   // {role:'user'|'assistant', content:string}
  var busy = false;

  // sessionStorage: conserva la conversación al navegar entre páginas del sitio.
  try {
    var saved = sessionStorage.getItem('acw-history');
    if (saved) messages = JSON.parse(saved) || [];
  } catch (e) {}

  function persist() {
    try { sessionStorage.setItem('acw-history', JSON.stringify(messages.slice(-20))); } catch (e) {}
  }

  // ── DOM ────────────────────────────────────────────────────────
  var root = document.createElement('div');
  root.className = 'acw-root';
  root.innerHTML = [
    '<button class="acw-launcher" type="button" aria-label="">',
      '<span class="acw-badge"></span>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    '</button>',
    '<section class="acw-panel" role="dialog" aria-label="Chat">',
      '<header class="acw-header">',
        '<img class="acw-avatar" src="profile.JPG" alt="Adrian Cajas" width="40" height="40">',
        '<div class="acw-h-info"><div class="acw-h-name"></div><div class="acw-h-status"></div></div>',
        '<button class="acw-close" type="button" aria-label=""><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>',
      '</header>',
      '<div class="acw-messages" aria-live="polite"></div>',
      '<div class="acw-input">',
        '<textarea rows="1" aria-label=""></textarea>',
        '<button class="acw-send" type="button" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>',
      '</div>',
      '<div class="acw-foot"></div>',
    '</section>'
  ].join('');
  document.body.appendChild(root);

  var launcher = root.querySelector('.acw-launcher');
  var closeBtn = root.querySelector('.acw-close');
  var msgBox = root.querySelector('.acw-messages');
  var textarea = root.querySelector('textarea');
  var sendBtn = root.querySelector('.acw-send');

  function applyStrings() {
    var t = I18N[getLang()];
    launcher.setAttribute('aria-label', t.open);
    closeBtn.setAttribute('aria-label', t.close);
    root.querySelector('.acw-h-name').textContent = t.name;
    root.querySelector('.acw-h-status').textContent = t.status;
    textarea.setAttribute('placeholder', t.placeholder);
    textarea.setAttribute('aria-label', t.placeholder);
    root.querySelector('.acw-foot').textContent = t.disclaimer;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Enlaza URLs y emails (sobre texto YA escapado).
  function linkify(safe) {
    safe = safe.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    safe = safe.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>');
    return safe;
  }

  function addBubble(role, text) {
    var el = document.createElement('div');
    el.className = 'acw-msg ' + (role === 'user' ? 'user' : 'bot');
    el.innerHTML = linkify(escapeHtml(text));
    msgBox.appendChild(el);
    msgBox.scrollTop = msgBox.scrollHeight;
    return el;
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'acw-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    msgBox.appendChild(el);
    msgBox.scrollTop = msgBox.scrollHeight;
    return el;
  }

  function actionIcon(kind) {
    if (kind === 'tg') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 2.9 11.6c-.9.35-.88 1.62.03 1.92l4.7 1.47 1.8 5.6c.22.66 1.02.86 1.5.36l2.6-2.5 4.7 3.46c.57.42 1.38.12 1.55-.58l3.2-15.6c.2-.94-.72-1.72-1.58-1.33zM9.7 14.1l-.3 3.5-1.3-4.1 9.2-5.7-7.6 6.3z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3A3 3 0 0 0 6 9.4a5.3 5.3 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.6.6 2.3.6 3 .5.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.6-.5z"/></svg>';
  }

  // Renderiza los botones de handoff (demo por Telegram/WhatsApp).
  function renderHandoff(h) {
    if (!h) return;
    var wrap = document.createElement('div');
    wrap.className = 'acw-actions';
    var en = getLang() === 'en';
    if (h.telegram_url) {
      var a = document.createElement('a');
      a.className = 'acw-action-btn tg';
      a.href = h.telegram_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.innerHTML = actionIcon('tg') + (en ? 'Open in Telegram' : 'Abrir en Telegram');
      wrap.appendChild(a);
    }
    if (h.whatsapp_url) {
      var b = document.createElement('a');
      b.className = 'acw-action-btn wa';
      b.href = h.whatsapp_url; b.target = '_blank'; b.rel = 'noopener noreferrer';
      b.innerHTML = actionIcon('wa') + (en ? 'Open in WhatsApp' : 'Abrir en WhatsApp');
      wrap.appendChild(b);
    }
    if (wrap.children.length) {
      msgBox.appendChild(wrap);
      msgBox.scrollTop = msgBox.scrollHeight;
    }
  }

  function renderAll() {
    msgBox.innerHTML = '';
    if (messages.length === 0) {
      addBubble('assistant', I18N[getLang()].greeting);
    } else {
      messages.forEach(function (m) { addBubble(m.role, m.content); });
    }
  }

  var opened = false;
  function openPanel() {
    root.classList.add('open');
    applyStrings();
    if (!opened) { renderAll(); opened = true; }
    setTimeout(function () { textarea.focus(); }, 220);
  }
  function closePanel() { root.classList.remove('open'); }

  launcher.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);

  function autoGrow() {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px';
  }
  textarea.addEventListener('input', autoGrow);
  textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  sendBtn.addEventListener('click', send);

  function send() {
    var text = textarea.value.trim();
    if (!text || busy) return;
    var lang = getLang();

    messages.push({ role: 'user', content: text });
    addBubble('user', text);
    persist();
    textarea.value = ''; autoGrow();

    busy = true; sendBtn.disabled = true;
    var typing = showTyping();
    var history = messages.slice(-7, -1);   // hasta 6 turnos previos (sin el actual)

    var botBubble = null;
    var acc = '';

    function finish() {
      if (typing) { typing.remove(); typing = null; }
      if (acc) {
        messages.push({ role: 'assistant', content: acc });
        if (botBubble) botBubble.innerHTML = linkify(escapeHtml(acc)); // enlaces al final
        persist();
      }
      busy = false; sendBtn.disabled = false; textarea.focus();
    }

    function onEvent(d) {
      if (d.type === 'token') {
        if (typing) { typing.remove(); typing = null; }
        if (!botBubble) botBubble = addBubble('assistant', '');
        acc += d.token;
        botBubble.textContent = acc;          // texto plano mientras streamea (seguro)
        msgBox.scrollTop = msgBox.scrollHeight;
      } else if (d.type === 'full') {           // handoff: mensaje completo + botones
        if (typing) { typing.remove(); typing = null; }
        acc = d.reply || '';
        botBubble = addBubble('assistant', acc);
        if (d.handoff) renderHandoff(d.handoff);
      } else if (d.type === 'error') {
        if (typing) { typing.remove(); typing = null; }
        acc = '';
        addBubble('assistant', d.reply || I18N[lang].error);
      }
    }

    fetch(API_BASE + '/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history, lang: lang })
    }).then(function (resp) {
      if (!resp.ok || !resp.body) throw new Error('no stream');
      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) { finish(); return; }
          buffer += decoder.decode(res.value, { stream: true });
          var parts = buffer.split('\n\n');
          buffer = parts.pop();
          for (var i = 0; i < parts.length; i++) {
            var line = parts[i].trim();
            if (line.indexOf('data:') !== 0) continue;
            try { onEvent(JSON.parse(line.slice(5).trim())); } catch (e) {}
          }
          return pump();
        });
      }
      return pump();
    }).catch(function () {
      if (typing) { typing.remove(); typing = null; }
      if (!acc) addBubble('assistant', I18N[lang].offline);
      busy = false; sendBtn.disabled = false;
    });
  }

  // Sincroniza el idioma del widget con el toggle ES/EN del sitio.
  new MutationObserver(applyStrings).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-lang']
  });

  applyStrings();
})();
