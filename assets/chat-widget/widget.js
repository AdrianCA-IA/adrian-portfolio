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

    fetch(API_BASE + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: messages.slice(-7, -1),   // hasta 6 turnos previos (sin el actual)
        lang: lang
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        typing.remove();
        var reply = (res.d && res.d.reply) ? res.d.reply : I18N[lang].error;
        messages.push({ role: 'assistant', content: reply });
        addBubble('assistant', reply);
        persist();
      })
      .catch(function () {
        typing.remove();
        addBubble('assistant', I18N[lang].offline);
      })
      .finally(function () {
        busy = false; sendBtn.disabled = false; textarea.focus();
      });
  }

  // Sincroniza el idioma del widget con el toggle ES/EN del sitio.
  new MutationObserver(applyStrings).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-lang']
  });

  applyStrings();
})();
