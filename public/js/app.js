/* app.js — calendarioescolar.cl
   Selector de region + countdown al proximo evento escolar */

document.addEventListener('DOMContentLoaded', function () {
  // Modulos compartidos
  Theme.init();
  Ads.init();
  Analytics.init('G-XXXXXXXXXX');

  // Logica del sitio
  App.init();
});

var App = (function () {
  // Datos de regiones — cargados desde public/js/regions-data.js (generado por scripts/generate-pages.js)
  // Si regions-data.js no está disponible, el selector de región no funcionará — ejecutar: npm run generate
  var REGIONS = window.REGIONS_DATA || {};

  // Eventos nacionales para countdown
  var EVENTS = [
    { date: '2026-03-02T08:00:00-03:00', label: 'Inicio de clases' },
    { date: '2026-07-11T00:00:00-04:00', label: 'Vacaciones de invierno' },
    { date: '2026-07-25T08:00:00-04:00', label: 'Vuelta de vacaciones de invierno' },
    { date: '2026-09-14T00:00:00-04:00', label: 'Fiestas Patrias' },
    { date: '2026-09-19T08:00:00-04:00', label: 'Vuelta de Fiestas Patrias' },
    { date: '2026-12-11T00:00:00-03:00', label: 'Fin del año escolar' }
  ];

  function init() {
    initCountdown();
    initRegionSelector();
  }

  function initCountdown() {
    var now = Date.now();
    var next = null;
    for (var i = 0; i < EVENTS.length; i++) {
      if (new Date(EVENTS[i].date).getTime() > now) {
        next = EVENTS[i];
        break;
      }
    }

    var labelEl = document.getElementById('countdown-event-name');
    if (next) {
      Countdown.init('countdown-home', next.date);
      if (labelEl) labelEl.textContent = 'para ' + next.label;
    } else {
      if (labelEl) labelEl.textContent = 'El año escolar 2026 ha finalizado';
    }
  }

  function initRegionSelector() {
    var select = document.getElementById('region-select');
    if (!select) return;

    select.addEventListener('change', function () {
      var slug = select.value;
      var container = document.getElementById('region-calendar');
      if (!slug || !REGIONS[slug]) {
        container.style.display = 'none';
        return;
      }

      var r = REGIONS[slug];
      var title = document.getElementById('region-title');
      var tbody = document.getElementById('region-table-body');
      var link = document.getElementById('region-link');

      title.textContent = 'Calendario Escolar 2026 — Región ' + r.name;

      tbody.innerHTML =
        '<tr><td><strong>Inicio año escolar</strong></td><td>' + r.inicio + '</td><td>—</td><td>—</td></tr>' +
        '<tr><td><strong>Vacaciones de invierno</strong></td><td>' + r.vacIni + '</td><td>' + r.vacFin + '</td><td>' + r.diasVac + ' días</td></tr>' +
        '<tr><td><strong>Fiestas Patrias</strong></td><td>' + r.fpIni + '</td><td>' + r.fpFin + '</td><td>' + r.diasFP + ' días</td></tr>' +
        '<tr><td><strong>Fin año escolar</strong></td><td>' + r.fin + '</td><td>—</td><td>—</td></tr>';

      link.href = '/region/' + slug + '/';

      container.style.display = 'block';
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  return { init: init };
})();
