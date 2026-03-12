/* export-image.js — Exportar elemento HTML como imagen PNG
   Copiar a public/js/ cuando el sitio necesite exportar (calendarioescolar).
   Usa html2canvas via CDN.
   Uso: ExportImage.capture('element-id', 'nombre-archivo') */
var ExportImage = (function () {
  var CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1/dist/html2canvas.min.js';

  function loadLib() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      s.onload = function () { resolve(window.html2canvas); };
      s.onerror = function () { reject(new Error('Failed to load html2canvas')); };
      document.head.appendChild(s);
    });
  }

  function capture(elementId, filename) {
    var el = document.getElementById(elementId);
    if (!el) return Promise.reject(new Error('Element not found: ' + elementId));

    return loadLib().then(function (h2c) {
      return h2c(el, { scale: 2, backgroundColor: '#ffffff' });
    }).then(function (canvas) {
      var link = document.createElement('a');
      link.download = (filename || 'captura') + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  return { capture: capture };
})();
