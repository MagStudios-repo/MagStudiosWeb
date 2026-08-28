/* Interacciones del sitio público. Las actualizaciones Android se distribuyen
 * exclusivamente por F-Droid; esta web no descarga ni verifica APKs. */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    var meta = byId('theme-color-meta');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f8fa' : '#0a0e12');
    try { localStorage.setItem('magplayer-theme', theme); } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    var year = byId('year');
    if (year) year.textContent = String(new Date().getFullYear());

    applyTheme(document.documentElement.dataset.theme || 'dark');
    var theme = byId('theme-toggle');
    if (theme) {
      theme.addEventListener('click', function () {
        applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      });
    }

    var mobileMenus = document.querySelectorAll('.mobile-menu');
    mobileMenus.forEach(function (menu) {
      menu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () { menu.removeAttribute('open'); });
      });
    });
    document.addEventListener('click', function (event) {
      mobileMenus.forEach(function (menu) {
        if (menu.open && !menu.contains(event.target)) menu.removeAttribute('open');
      });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        mobileMenus.forEach(function (menu) { menu.removeAttribute('open'); });
      }
    });
  });
})();
