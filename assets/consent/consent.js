/*
  Banner de cookies / consentimiento (LSSI art. 22.2 + RGPD + Guía de cookies AEPD).

  Dos modos, según OPTIONAL:
  - OPTIONAL vacío (hoy): solo hay almacenamiento técnico → banner INFORMATIVO ("Entendido").
  - OPTIONAL con categorías (p. ej. analítica): Aceptar / Rechazar / Configurar con el mismo
    peso visual, todo desactivado por defecto y nada se carga hasta que el usuario acepta.

  Para añadir analítica en el futuro:
    1. Añade la categoría a OPTIONAL (nombre + descripción + proveedor).
    2. Carga el script solo dentro de: SiteConsent.onGrant('analytics', function () { ... });
    3. Actualiza cookies.html y privacidad.html.
  Cambiar las categorías invalida el consentimiento anterior y el banner vuelve a salir.
*/
(function () {
  'use strict';

  var OPTIONAL = (window.SiteConsentConfig && window.SiteConsentConfig.optional) || [
    // { id: 'analytics',
    //   es: { name: 'Analítica', desc: 'Medir visitas de forma agregada (Proveedor X).' },
    //   en: { name: 'Analytics', desc: 'Measure visits in aggregate (Provider X).' } }
  ];

  var KEY = 'site-consent';
  var MAX_AGE_DAYS = 365;  // se vuelve a preguntar pasado un año
  var VERSION = 'v1:' + OPTIONAL.map(function (c) { return c.id; }).join(',');

  var T = {
    es: {
      title: 'Privacidad y cookies',
      info: 'Esta web solo usa almacenamiento técnico necesario (tu idioma y la conversación del chat mientras navegas). No usamos cookies de analítica ni de publicidad.',
      ask: 'Usamos almacenamiento técnico necesario y, solo si lo aceptas, las categorías opcionales de abajo. Puedes cambiar tu elección cuando quieras en «Configurar cookies», al pie de la página.',
      ok: 'Entendido', accept: 'Aceptar todo', reject: 'Rechazar todo', config: 'Configurar', save: 'Guardar selección',
      more: 'Política de cookies', privacy: 'Privacidad', necessary: 'Necesarias', always: 'Siempre activas',
      necessaryDesc: 'Idioma, conversación del chat y esta misma elección. Sin ellas la web no funciona bien.'
    },
    en: {
      title: 'Privacy & cookies',
      info: 'This site only uses strictly necessary storage (your language and the chat conversation while you browse). We use no analytics or advertising cookies.',
      ask: 'We use strictly necessary storage and, only if you accept, the optional categories below. You can change your choice anytime via “Cookie settings” in the footer.',
      ok: 'Got it', accept: 'Accept all', reject: 'Reject all', config: 'Settings', save: 'Save selection',
      more: 'Cookie policy', privacy: 'Privacy', necessary: 'Necessary', always: 'Always on',
      necessaryDesc: 'Language, chat conversation and this very choice. The site does not work properly without them.'
    }
  };

  var listeners = {};
  var root = null;

  function lang() {
    var l = document.documentElement.getAttribute('data-lang');
    if (!l) { try { l = localStorage.getItem('portfolio-lang'); } catch (e) {} }
    return l === 'en' ? 'en' : 'es';
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!s || s.version !== VERSION) return null;
      if (Date.now() - new Date(s.date).getTime() > MAX_AGE_DAYS * 864e5) return null;
      return s;
    } catch (e) { return null; }
  }

  function save(choices) {
    var s = { version: VERSION, date: new Date().toISOString(), choices: choices };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    OPTIONAL.forEach(function (c) { if (choices[c.id]) fire(c.id); });
    close();
  }

  function fire(id) {
    (listeners[id] || []).splice(0).forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function all(value) {
    var o = {}; OPTIONAL.forEach(function (c) { o[c.id] = value; }); return o;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function btn(text, onClick, cls) {
    var b = el('button', 'sc-btn' + (cls ? ' ' + cls : ''), text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function close() { if (root) { root.remove(); root = null; } }

  function render(showConfig) {
    close();
    var t = T[lang()];
    var current = (load() || {}).choices || {};
    root = el('div', 'sc-banner');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-label', t.title);

    root.appendChild(el('p', 'sc-title', t.title));
    root.appendChild(el('p', 'sc-text', OPTIONAL.length ? t.ask : t.info));

    if (OPTIONAL.length && showConfig) {
      var list = el('div', 'sc-list');
      var nec = el('label', 'sc-row');
      var necBox = el('input'); necBox.type = 'checkbox'; necBox.checked = true; necBox.disabled = true;
      nec.appendChild(necBox);
      nec.appendChild(el('span', '', t.necessary + ' (' + t.always + ') — ' + t.necessaryDesc));
      list.appendChild(nec);
      OPTIONAL.forEach(function (c) {
        var row = el('label', 'sc-row');
        var box = el('input'); box.type = 'checkbox'; box.checked = !!current[c.id]; box.dataset.id = c.id;
        row.appendChild(box);
        row.appendChild(el('span', '', c[lang()].name + ' — ' + c[lang()].desc));
        list.appendChild(row);
      });
      root.appendChild(list);
    }

    var links = el('p', 'sc-links');
    var a1 = el('a', '', t.more); a1.href = 'cookies.html';
    var a2 = el('a', '', t.privacy); a2.href = 'privacidad.html';
    links.appendChild(a1); links.appendChild(document.createTextNode(' · ')); links.appendChild(a2);
    root.appendChild(links);

    var actions = el('div', 'sc-actions');
    if (!OPTIONAL.length) {
      actions.appendChild(btn(t.ok, function () { save({}); }));
    } else if (showConfig) {
      actions.appendChild(btn(t.reject, function () { save(all(false)); }));
      actions.appendChild(btn(t.save, function () {
        var o = {};
        root.querySelectorAll('input[data-id]').forEach(function (b) { o[b.dataset.id] = b.checked; });
        save(o);
      }));
      actions.appendChild(btn(t.accept, function () { save(all(true)); }));
    } else {
      // Rechazar y Aceptar con el MISMO estilo y en la misma capa (criterio AEPD).
      actions.appendChild(btn(t.reject, function () { save(all(false)); }));
      actions.appendChild(btn(t.config, function () { render(true); }, 'sc-btn-ghost'));
      actions.appendChild(btn(t.accept, function () { save(all(true)); }));
    }
    root.appendChild(actions);
    document.body.appendChild(root);
  }

  window.SiteConsent = {
    /** ¿Ha aceptado el usuario esta categoría? */
    granted: function (id) { var s = load(); return !!(s && s.choices && s.choices[id]); },
    /** Ejecuta fn solo cuando (y si) el usuario acepta la categoría. */
    onGrant: function (id, fn) {
      if (this.granted(id)) { fn(); return; }
      (listeners[id] = listeners[id] || []).push(fn);
    },
    /** Reabre el banner (enlace «Configurar cookies» del pie). */
    open: function () { render(OPTIONAL.length > 0); }
  };

  function init() {
    document.querySelectorAll('[data-consent-open]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); window.SiteConsent.open(); });
    });
    if (!load()) render(false);
    // Si cambia el idioma de la web con el banner abierto, se re-pinta.
    new MutationObserver(function () { if (root) render(!!root.querySelector('.sc-list')); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
