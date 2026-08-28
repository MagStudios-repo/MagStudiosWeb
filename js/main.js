/* Sitio público de MagPlayer+. No contiene tokens ni credenciales. */
(function () {
  'use strict';

  // La web usa su propio manifiesto público. Nunca pongas acá un token de
  // GitHub: la app y la web tienen vías de actualización separadas.
  var CONFIG = {
    // Este archivo se publica junto con la web en Maglinkweb.
    manifestUrls: ['version.json'],
    // Registro técnico de APK oficiales. Se usa sólo para verificar archivos;
    // la interfaz sigue mostrando únicamente el hash de la última versión.
    hashesUrl: 'official-hashes.json',
    // Reserva por si `version.json` no carga. Apuntaba al repo y al archivo de
    // la app anterior (`MaglinkUpdate/maglinktv.apk`), así que un fallo de red
    // ofrecía la 2.4.1 como si fuera lo último publicado.
    //
    // Sin hash: la reserva sirve para que el botón de descarga siga llevando a
    // algún sitio, no para dar por buena una versión que no se pudo consultar.
    fallback: {
      versionName: '3.0.1',
      versionCode: 2,
      apkUrl: 'https://github.com/SOSA380/Maglinkweb/releases/download/v3.0.1/magplayer.apk',
      apkSha256: 'd4a964a695f348591544b8e10e891928ef4b29958c8c7dc5c41103dfbc6d4c74',
    },
  };
  var manifest = null;
  var officialVersions = [];

  function byId(id) { return document.getElementById(id); }
  function setText(id, value) { var node = byId(id); if (node) node.textContent = value; }
  function isSha(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

  function showToast(message) {
    var toast = byId('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () { toast.classList.remove('show'); }, 2400);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    var meta = byId('theme-color-meta');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f8fa' : '#0a0e12');
    try { localStorage.setItem('magplayer-theme', theme); } catch (_) {}
  }

  function renderNotes(text) {
    var node = byId('release-notes');
    if (!node) return;
    node.textContent = '';
    var blocks = String(text).split(/\n\s*\n/);
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i].trim();
      if (!block) continue;
      var p = document.createElement('p');
      p.textContent = block;
      node.appendChild(p);
    }
  }

  function setManifest(value, fromNetwork) {
    var data = value || CONFIG.fallback;
    var valid = data && typeof data.apkUrl === 'string' && /^https:\/\//i.test(data.apkUrl) &&
      typeof data.versionName === 'string' && data.versionName.trim();
    if (!valid) data = CONFIG.fallback;
    manifest = data;
    setText('version-name', data.versionName);
    setText('hero-version-pill', 'v' + data.versionName);
    setText('release-code', data.versionCode ? 'BUILD ' + data.versionCode : '—');
    setText('official-hash', isSha(data.apkSha256) ? data.apkSha256.toLowerCase() : 'No publicado todavía');
    setText('release-status', fromNetwork ? 'Publicación verificada' : 'Usando datos de respaldo');
    var button = byId('download-button');
    if (button) {
      button.href = data.apkUrl;
      button.target = '_blank';
      button.rel = 'noopener';
    }
    var copy = byId('copy-hash');
    if (copy) copy.disabled = !isSha(data.apkSha256);
    if (data.notes) renderNotes(data.notes);
  }

  async function loadOfficialVersions() {
    try {
      var response = await fetch(CONFIG.hashesUrl + '?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('hashes ' + response.status);
      var data = await response.json();
      if (!data || !Array.isArray(data.versions)) throw new Error('registro inválido');
      officialVersions = data.versions.filter(function (entry) {
        return entry && typeof entry.versionName === 'string' &&
          Number.isInteger(entry.versionCode) && isSha(entry.sha256);
      });
    } catch (_) {
      // La comprobación de la última versión sigue disponible si el registro
      // histórico no responde.
      officialVersions = manifest && isSha(manifest.apkSha256)
        ? [{
            versionName: manifest.versionName,
            versionCode: Number(manifest.versionCode),
            sha256: manifest.apkSha256.toLowerCase(),
          }]
        : [];
    }
  }

  async function loadManifest() {
    var urls = CONFIG.manifestUrls || [];
    for (var i = 0; i < urls.length; i += 1) {
      try {
        var response = await fetch(urls[i] + '?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('manifest ' + response.status);
        var data = await response.json();
        setManifest(data, true);
        await loadOfficialVersions();
        return;
      } catch (_) {
        // Si el manifiesto público no está disponible, se usa el respaldo.
      }
    }
    setManifest(CONFIG.fallback, false);
    await loadOfficialVersions();
    setText('release-status', 'No se pudo consultar la publicación');
  }

  function bytesToHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  async function hashFile(file) {
    if (!window.crypto || !window.crypto.subtle) throw new Error('El navegador no permite SHA-256 seguro.');
    // Se calcula en el navegador: el archivo no sale del dispositivo. Para
    // APK normales esta ruta evita enviar datos personales a un servidor.
    return bytesToHex(await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  }

  function showVerification(file, hash) {
    var result = byId('verify-result');
    if (!result) return;
    var match = officialVersions.find(function (entry) {
      return entry && typeof entry.sha256 === 'string' && entry.sha256.toLowerCase() === hash;
    });
    var matches = Boolean(match);
    var releaseLabel = match
      ? 'MagPlayer+ ' + escapeHtml(match.versionName) + ' (BUILD ' + escapeHtml(match.versionCode) + ')'
      : '';
    result.innerHTML = '<div class="result-card ' + (matches ? 'ok' : 'bad') + '">' +
      '<span class="file-name">' + escapeHtml(file.name) + '</span>' +
      '<h3>' + (matches ? '✓ APK oficial verificado' : '× No coincide con una versión oficial') + '</h3>' +
      '<p>' + (matches ? 'El archivo corresponde a ' + releaseLabel + '.' : 'El archivo puede ser una copia modificada, una versión diferente o estar dañado. No lo instales sin verificar su origen.') + '</p>' +
      '<div class="computed-hash">' + hash + '</div>' +
      '</div>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
    });
  }

  async function verify(file) {
    if (!file) return;
    var result = byId('verify-result');
    if (result) result.innerHTML = '<div class="result-card"><span class="file-name">' + escapeHtml(file.name) + '</span><h3>Calculando SHA-256…</h3><p>El archivo permanece en tu dispositivo.</p></div>';
    try {
      var hash = await hashFile(file);
      showVerification(file, hash);
    } catch (error) {
      if (result) result.innerHTML = '<div class="result-card bad"><h3>No se pudo verificar</h3><p>' + escapeHtml(error.message) + '</p></div>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setText('year', String(new Date().getFullYear()));
    applyTheme(document.documentElement.dataset.theme || 'dark');
    var theme = byId('theme-toggle');
    if (theme) theme.addEventListener('click', function () { applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); });

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

    var input = byId('apk-file');
    var zone = byId('dropzone');
    if (input) input.addEventListener('change', function () { verify(input.files && input.files[0]); });
    if (zone) {
      ['dragenter', 'dragover'].forEach(function (name) { zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.add('is-dragging'); }); });
      ['dragleave', 'drop'].forEach(function (name) { zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.remove('is-dragging'); }); });
      zone.addEventListener('drop', function (event) { verify(event.dataTransfer.files && event.dataTransfer.files[0]); });
      zone.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input && input.click(); } });
    }
    var copy = byId('copy-hash');
    if (copy) copy.addEventListener('click', function () {
      var hash = manifest && manifest.apkSha256;
      if (!isSha(hash)) return;
      navigator.clipboard.writeText(hash).then(function () { showToast('Hash copiado'); });
    });
    loadManifest();
  });
})();
