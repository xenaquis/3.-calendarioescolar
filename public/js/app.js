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
  // Datos de regiones (mismos que data/pages.json)
  var REGIONS = {
    'arica-y-parinacota': { name: 'Arica y Parinacota', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'tarapaca': { name: 'Tarapac\u00e1', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'antofagasta': { name: 'Antofagasta', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'atacama': { name: 'Atacama', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'coquimbo': { name: 'Coquimbo', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'valparaiso': { name: 'Valpara\u00edso', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'metropolitana': { name: 'Metropolitana', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'ohiggins': { name: 'O\u2019Higgins', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'maule': { name: 'Maule', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'nuble': { name: '\u00d1uble', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'biobio': { name: 'Biob\u00edo', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'araucania': { name: 'La Araucan\u00eda', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'los-rios': { name: 'Los R\u00edos', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'los-lagos': { name: 'Los Lagos', inicio: '2 de marzo', vacIni: '11 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '11 de diciembre', diasVac: '14', diasFP: '5' },
    'aysen': { name: 'Ays\u00e9n', inicio: '2 de marzo', vacIni: '4 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '4 de diciembre', diasVac: '21', diasFP: '5' },
    'magallanes': { name: 'Magallanes', inicio: '2 de marzo', vacIni: '4 de julio', vacFin: '24 de julio', fpIni: '14 de septiembre', fpFin: '18 de septiembre', fin: '4 de diciembre', diasVac: '21', diasFP: '5' }
  };

  // Eventos nacionales para countdown
  var EVENTS = [
    { date: '2026-03-02T08:00:00-03:00', label: 'Inicio de clases' },
    { date: '2026-07-11T00:00:00-04:00', label: 'Vacaciones de invierno' },
    { date: '2026-07-25T08:00:00-04:00', label: 'Vuelta de vacaciones de invierno' },
    { date: '2026-09-14T00:00:00-04:00', label: 'Fiestas Patrias' },
    { date: '2026-09-19T08:00:00-04:00', label: 'Vuelta de Fiestas Patrias' },
    { date: '2026-12-11T00:00:00-03:00', label: 'Fin del a\u00f1o escolar' }
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
      if (labelEl) labelEl.textContent = 'El a\u00f1o escolar 2026 ha finalizado';
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

      title.textContent = 'Calendario Escolar 2026 \u2014 Regi\u00f3n ' + r.name;

      tbody.innerHTML =
        '<tr><td><strong>Inicio a\u00f1o escolar</strong></td><td>' + r.inicio + '</td><td>\u2014</td><td>\u2014</td></tr>' +
        '<tr><td><strong>Vacaciones de invierno</strong></td><td>' + r.vacIni + '</td><td>' + r.vacFin + '</td><td>' + r.diasVac + ' d\u00edas</td></tr>' +
        '<tr><td><strong>Fiestas Patrias</strong></td><td>' + r.fpIni + '</td><td>' + r.fpFin + '</td><td>' + r.diasFP + ' d\u00edas</td></tr>' +
        '<tr><td><strong>Fin a\u00f1o escolar</strong></td><td>' + r.fin + '</td><td>\u2014</td><td>\u2014</td></tr>';

      link.href = '/region/' + slug + '/';

      container.style.display = 'block';
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  return { init: init };
})();
