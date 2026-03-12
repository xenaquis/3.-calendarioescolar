/* chart-loader.js — Carga lazy de Chart.js desde CDN
   Copiar a public/js/ cuando el sitio necesite gráficos.
   Uso: ChartLoader.load().then(Chart => new Chart(...)) */
var ChartLoader = (function () {
  var CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
  var promise = null;

  function load() {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (promise) return promise;

    promise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CHART_CDN;
      s.async = true;
      s.onload = function () { resolve(window.Chart); };
      s.onerror = function () { reject(new Error('Failed to load Chart.js')); };
      document.head.appendChild(s);
    });

    return promise;
  }

  /* Crear un line chart simple (sparkline o full) */
  function createLine(canvasId, labels, data, opts) {
    return load().then(function (Chart) {
      var ctx = document.getElementById(canvasId);
      if (!ctx) return null;

      var defaults = {
        color: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#1a73e8',
        fill: true,
        tension: 0.3
      };
      var o = Object.assign({}, defaults, opts || {});

      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            borderColor: o.color,
            backgroundColor: o.color + '20',
            fill: o.fill,
            tension: o.tension,
            pointRadius: labels.length > 30 ? 0 : 3,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: labels.length <= 30, grid: { display: false } },
            y: { display: true, grid: { color: '#e5e7eb' } }
          }
        }
      });
    });
  }

  return { load: load, createLine: createLine };
})();
