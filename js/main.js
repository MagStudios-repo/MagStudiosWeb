/* Interacciones del sitio público de MagStudios.
 * Incluye alternador de tema, menú móvil, copia de enlaces y verificador
 * de integridad criptográfica SHA-256 de APKs 100% en el cliente. */
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

    // ── Toast de notificación ──
    function showToast(message) {
      var toast = byId('toast');
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(function () {
        toast.classList.remove('show');
      }, 3200);
    }

    // ── Contador de descargas oficiales ──
    // GitHub contabiliza cada descarga de los assets APK. Solo se suman los
    // lanzamientos estables; el resultado se guarda localmente por 30 minutos
    // para no hacer una consulta por cada navegación dentro del sitio.
    var downloadCounters = document.querySelectorAll('[data-download-counter]');
    var downloadsCacheKey = 'magplayer-official-apk-downloads-v1';
    var downloadsCacheLifetime = 30 * 60 * 1000;
    var releasesApiUrl = 'https://api.github.com/repos/MagStudios-repo/MagPlayerPlus/releases?per_page=100';

    function formatDownloadCount(value) {
      try {
        return new Intl.NumberFormat('es-AR').format(value);
      } catch (_) {
        return String(value);
      }
    }

    function renderDownloadCount(value, context) {
      downloadCounters.forEach(function (counter) {
        var count = counter.querySelector('[data-download-count]');
        var detail = counter.querySelector('[data-download-context]');
        if (count) count.textContent = value;
        if (detail) detail.textContent = context;
        counter.setAttribute('aria-busy', 'false');
      });
    }

    function readCachedDownloadCount() {
      try {
        var raw = localStorage.getItem(downloadsCacheKey);
        if (!raw) return null;
        var cached = JSON.parse(raw);
        if (typeof cached.count !== 'number' || typeof cached.savedAt !== 'number') return null;
        return Date.now() - cached.savedAt < downloadsCacheLifetime ? cached.count : null;
      } catch (_) {
        return null;
      }
    }

    function cacheDownloadCount(count) {
      try {
        localStorage.setItem(downloadsCacheKey, JSON.stringify({ count: count, savedAt: Date.now() }));
      } catch (_) {}
    }

    function isPublishedApk(asset) {
      return asset && typeof asset.name === 'string' && /\.apk$/i.test(asset.name);
    }

    function loadDownloadCount() {
      if (!downloadCounters.length || !window.fetch) return;
      var cached = readCachedDownloadCount();
      if (cached !== null) {
        renderDownloadCount(formatDownloadCount(cached), 'desde lanzamientos publicados');
        return;
      }

      window.fetch(releasesApiUrl, { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (response) {
          if (!response.ok) throw new Error('No se pudo consultar GitHub');
          return response.json();
        })
        .then(function (releases) {
          if (!Array.isArray(releases)) throw new Error('Respuesta inválida de GitHub');
          var count = releases
            .filter(function (release) { return !release.draft && !release.prerelease; })
            .reduce(function (total, release) {
              var assets = Array.isArray(release.assets) ? release.assets : [];
              return total + assets
                .filter(isPublishedApk)
                .reduce(function (assetTotal, asset) {
                  return assetTotal + (Number(asset.download_count) || 0);
                }, 0);
            }, 0);
          cacheDownloadCount(count);
          renderDownloadCount(formatDownloadCount(count), 'desde lanzamientos publicados');
        })
        .catch(function () {
          renderDownloadCount('No disponible', 'GitHub no respondió en este momento');
        });
    }

    loadDownloadCount();

    // ── Copiar enlace oficial ──
    var copyRepoBtn = byId('copy-repo-btn');
    if (copyRepoBtn) {
      copyRepoBtn.addEventListener('click', function () {
        var link = byId('official-repo-link');
        var text = link ? link.textContent : 'https://github.com/MagStudios-repo/MagPlayerPlus/releases';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showToast('Enlace copiado al portapapeles');
          }).catch(function () {
            showToast('No se pudo copiar el enlace');
          });
        } else {
          showToast('Enlace oficial: ' + text);
        }
      });
    }

    // ── Verificador de integridad SHA-256 de APKs ──
    var dropzone = byId('dropzone');
    var apkInput = byId('apk-input');
    var verifyResult = byId('verify-result');

    function formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      var k = 1024;
      var sizes = ['Bytes', 'KB', 'MB', 'GB'];
      var i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }

    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function processApkFile(file) {
      if (!verifyResult) return;
      if (!file) return;

      verifyResult.innerHTML =
        '<div class="result-card">' +
          '<span class="file-name">' + escapeHtml(file.name) + ' (' + formatBytes(file.size) + ')</span>' +
          '<h3>Calculando huella SHA-256…</h3>' +
          '<p>Procesando archivo localmente en tu dispositivo…</p>' +
        '</div>';

      var reader = new FileReader();
      reader.onload = function (e) {
        var buffer = e.target.result;
        if (!window.crypto || !window.crypto.subtle) {
          verifyResult.innerHTML =
            '<div class="result-card bad">' +
              '<h3>Navegador no compatible</h3>' +
              '<p>Tu navegador no soporta la Web Crypto API requerida para calcular SHA-256.</p>' +
            '</div>';
          return;
        }

        window.crypto.subtle.digest('SHA-256', buffer).then(function (hashBuffer) {
          var hashArray = Array.from(new Uint8Array(hashBuffer));
          var hashHex = hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');

          verifyResult.innerHTML =
            '<div class="result-card ok">' +
              '<span class="file-name">' + escapeHtml(file.name) + ' · ' + formatBytes(file.size) + '</span>' +
              '<h3>Huella SHA-256 calculada</h3>' +
              '<p>Verificá que coincida con el valor publicado en el repositorio oficial de GitHub:</p>' +
              '<code class="computed-hash">' + hashHex + '</code>' +
            '</div>';
          showToast('Hash SHA-256 calculado correctamente');
        }).catch(function () {
          verifyResult.innerHTML =
            '<div class="result-card bad">' +
              '<h3>Error de cálculo</h3>' +
              '<p>No se pudo calcular la huella digital del archivo seleccionado.</p>' +
            '</div>';
        });
      };

      reader.onerror = function () {
        verifyResult.innerHTML =
          '<div class="result-card bad">' +
            '<h3>Error de lectura</h3>' +
            '<p>No se pudo leer el archivo seleccionado en el dispositivo.</p>' +
          '</div>';
      };

      reader.readAsArrayBuffer(file);
    }

    if (dropzone && apkInput) {
      dropzone.addEventListener('click', function () {
        apkInput.click();
      });

      dropzone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          apkInput.click();
        }
      });

      ['dragenter', 'dragover'].forEach(function (eventName) {
        dropzone.addEventListener(eventName, function (e) {
          e.preventDefault();
          dropzone.classList.add('is-dragging');
        });
      });

      ['dragleave', 'drop'].forEach(function (eventName) {
        dropzone.addEventListener(eventName, function (e) {
          e.preventDefault();
          dropzone.classList.remove('is-dragging');
        });
      });

      dropzone.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          processApkFile(e.dataTransfer.files[0]);
        }
      });

      apkInput.addEventListener('change', function () {
        if (apkInput.files && apkInput.files.length > 0) {
          processApkFile(apkInput.files[0]);
        }
      });
    }
  });
})();
