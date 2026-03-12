/* theme.js — Dark mode toggle + system preference */
var Theme = (function () {
  var STORAGE_KEY = 'theme';
  var btn;

  function init() {
    btn = document.getElementById('theme-toggle');
    if (!btn) return;

    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }
    updateIcon();
    btn.addEventListener('click', toggle);
  }

  function toggle() {
    var current = document.documentElement.getAttribute('data-theme');
    var isDark = current === 'dark' ||
      (!current && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
    updateIcon();
  }

  function updateIcon() {
    if (!btn) return;
    var theme = document.documentElement.getAttribute('data-theme');
    var isDark = theme === 'dark' ||
      (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    btn.textContent = isDark ? '\u2600' : '\u263E';
    btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }

  return { init: init };
})();
