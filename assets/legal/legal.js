/* Idioma de las páginas legales: comparte la preferencia ('portfolio-lang') con la web. */
(function () {
  var l = 'es';
  try { l = localStorage.getItem('portfolio-lang') === 'en' ? 'en' : 'es'; } catch (e) {}
  var html = document.documentElement;
  function apply() { html.setAttribute('data-lang', l); html.lang = l; }
  apply();
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.querySelector('.legal-lang');
    if (b) b.addEventListener('click', function () {
      l = l === 'es' ? 'en' : 'es';
      try { localStorage.setItem('portfolio-lang', l); } catch (e) {}
      apply();
    });
  });
})();
