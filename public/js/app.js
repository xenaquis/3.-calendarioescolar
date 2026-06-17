/* app.js — calendarioescolar.cl
   Landing minimal: próximo feriado escolar + selector de región.

   Depende de (cargados antes en HTML):
     - public/js/regions-data.js    → window.REGIONS_DATA
     - public/js/calendar-config.js → window.CALENDAR_CONFIG
   Ambos generados por: npm run generate
*/

document.addEventListener('DOMContentLoaded', function () {
  Theme.init();
  Analytics.init('G-6FVLKF6PFQ');
  App.init();
});

var App = (function () {
  var REGIONS = window.REGIONS_DATA || {};
  var CAL = window.CALENDAR_CONFIG || null;

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function parseDate(isoStr) {
    var parts = isoStr.split('-');
    return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0));
  }

  function today() {
    var now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0));
  }

  function formatDateLong(d) {
    return DIAS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()];
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function initHomeStats() {
    var weekEl = document.getElementById('stat-week');
    var daysEl = document.getElementById('stat-days-winter');
    var feriadosEl = document.getElementById('stat-feriados-left');
    if (!weekEl || !daysEl || !feriadosEl || !CAL) return;

    var now = today();
    var schoolStart = parseDate(CAL.schoolStart);
    var winterStart = parseDate(CAL.winterStart);

    if (now >= schoolStart) {
      var diffMs = now - schoolStart;
      var week = Math.floor(diffMs / (7 * 86400000)) + 1;
      weekEl.textContent = week > 0 && week <= 45 ? week : '—';
    } else {
      weekEl.textContent = 'Pre';
    }

    if (now < winterStart) {
      var diffDays = Math.ceil((winterStart - now) / 86400000);
      daysEl.textContent = diffDays;
    } else {
      var winterEnd = parseDate(CAL.winterEnd);
      if (now <= winterEnd) {
        daysEl.textContent = '0';
        var daysElNote = daysEl.nextElementSibling;
        if (daysElNote) daysElNote.textContent = 'ya estamos de vacaciones';
      } else {
        daysEl.textContent = '—';
      }
    }

    var source = CAL.feriadosCompletos || [];
    var count = 0;
    for (var i = 0; i < source.length; i++) {
      var f = source[i];
      if (f.contexto && f.contexto !== 'en-clases') continue;
      var d = parseDate(f.date);
      if (d >= now) count++;
    }
    feriadosEl.textContent = count;
  }

  function init() {
    if (CAL) {
      initFeriadoCard();
      initHomeStats();
      initFreshness();
    } else {
      console.warn('[app.js] CALENDAR_CONFIG no disponible — ejecutar: npm run generate');
    }
    initRegionPicker();
  }

  // Label "Actualizado: <mes> <ano>" desde la fecha de build (deploy diario) — cero mantenimiento.
  function initFreshness() {
    var el = document.getElementById('hero-updated');
    if (!el || !CAL || !CAL.generatedDate) return;
    var d = parseDate(CAL.generatedDate);
    el.textContent = 'Actualizado: ' + MESES[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  // Próximo feriado escolar: primero en feriadosCompletos con contexto="en-clases" y fecha >= hoy.
  // Fallback: feriados[] (lista corta) filtrada por fecha futura.
  function initFeriadoCard() {
    var nameEl = document.getElementById('feriado-name');
    var dateEl = document.getElementById('feriado-date');
    var cdEl = document.getElementById('feriado-countdown');
    var daysEl = document.getElementById('feriado-days');
    if (!nameEl || !dateEl) return;

    var now = today();
    var source = CAL.feriadosCompletos || CAL.feriados || [];
    var next = null;

    for (var i = 0; i < source.length; i++) {
      var f = source[i];
      var d = parseDate(f.date);
      if (d < now) continue;
      if (f.contexto && f.contexto !== 'en-clases') continue;
      next = { date: d, nombre: f.nombre };
      break;
    }

    if (!next) {
      nameEl.textContent = 'No hay m\u00e1s feriados este a\u00f1o escolar';
      dateEl.textContent = 'El a\u00f1o escolar 2026 ha concluido';
      if (cdEl) cdEl.hidden = true;
      return;
    }

    nameEl.textContent = next.nombre;
    dateEl.textContent = capitalize(formatDateLong(next.date));

    var diffDays = Math.ceil((next.date - now) / 86400000);
    if (cdEl && daysEl) {
      if (diffDays === 0) {
        daysEl.textContent = '';
        cdEl.firstChild.textContent = '\u00a1Hoy!';
        cdEl.hidden = false;
      } else {
        daysEl.textContent = diffDays;
        cdEl.hidden = false;
      }
    }
  }

  function initRegionPicker() {
    var sel = document.getElementById('region-select');
    var result = document.getElementById('region-result');
    if (!sel || !result) return;

    sel.addEventListener('change', function () {
      var slug = sel.value;
      if (!slug || !REGIONS[slug]) {
        result.hidden = true;
        return;
      }
      var r = REGIONS[slug];
      var elInicio = document.getElementById('r-inicio');
      var elVac = document.getElementById('r-vac');
      var elFin = document.getElementById('r-fin');
      var elLink = document.getElementById('link-pagina');

      if (elInicio) elInicio.textContent = r.inicio || '\u2014';
      if (elVac) elVac.textContent = (r.vacIni && r.vacFin) ? (r.vacIni + ' \u2014 ' + r.vacFin) : '\u2014';
      if (elFin) elFin.textContent = r.fin || '\u2014';
      if (elLink) elLink.href = '/region/' + slug + '/';

      result.hidden = false;
    });
  }

  return { init: init };
})();
