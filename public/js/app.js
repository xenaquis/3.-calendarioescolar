/* app.js — calendarioescolar.cl
   Selector de región + stats en tiempo real

   Depende de (cargados antes en HTML):
     - public/js/regions-data.js    → window.REGIONS_DATA
     - public/js/calendar-config.js → window.CALENDAR_CONFIG
   Ambos generados por: npm run generate
*/

document.addEventListener('DOMContentLoaded', function () {
  // Módulos compartidos
  Theme.init();
  Ads.init();
  Analytics.init('G-XXXXXXXXXX');

  // Lógica del sitio
  App.init();
});

var App = (function () {
  // Datos de regiones — cargados desde public/js/regions-data.js
  // Si no está disponible: ejecutar npm run generate
  var REGIONS = window.REGIONS_DATA || {};

  // Config del calendario — cargada desde public/js/calendar-config.js
  // Fuente de verdad: data/calendar-config.json
  // Si no está disponible: ejecutar npm run generate
  var CAL = window.CALENDAR_CONFIG || null;

  function init() {
    initRegionSelector();
    initRegionChips();
    if (CAL) {
      initSchoolStats();
    } else {
      console.warn('[app.js] CALENDAR_CONFIG no disponible — ejecutar: npm run generate');
    }
  }

  // Selector de región oculto (mantiene compatibilidad con el DOM esperado)
  function initRegionSelector() {
    var select = document.getElementById('region-select');
    if (!select) return;

    select.addEventListener('change', function () {
      var slug = select.value;
      var container = document.getElementById('region-calendar');
      if (!slug || !REGIONS[slug]) {
        if (container) container.style.display = 'none';
        return;
      }

      var r = REGIONS[slug];
      var title = document.getElementById('region-title');
      var tbody = document.getElementById('region-table-body');
      var link  = document.getElementById('region-link');

      if (title) title.textContent = 'Calendario Escolar ' + (CAL ? CAL.year : '') + ' \u2014 Regi\u00f3n ' + r.name;

      if (tbody) {
        tbody.innerHTML =
          '<tr><td><strong>Inicio a\u00f1o escolar</strong></td><td>' + r.inicio + '</td><td>\u2014</td></tr>' +
          '<tr><td><strong>Vacaciones invierno</strong></td><td>' + r.vacIni + ' \u2014 ' + r.vacFin + '</td><td>' + r.diasVac + '</td></tr>' +
          '<tr><td><strong>Fiestas Patrias</strong></td><td>' + r.fpIni + ' \u2014 ' + r.fpFin + '</td><td>' + r.diasFP + '</td></tr>' +
          '<tr><td><strong>Fin a\u00f1o escolar</strong></td><td>' + r.fin + '</td><td>\u2014</td></tr>';
      }

      if (link) link.href = '/region/' + slug + '/';

      if (container) {
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // Chips de región — activa el select oculto para que initRegionSelector procese
  function initRegionChips() {
    var chips = document.querySelectorAll('.chip[data-region]');
    var select = document.getElementById('region-select');
    if (!chips.length || !select) return;

    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        chip.addEventListener('click', function () {
          // Reset todos los chips
          for (var j = 0; j < chips.length; j++) {
            chips[j].setAttribute('aria-selected', 'false');
          }
          // Marcar chip activo
          chip.setAttribute('aria-selected', 'true');
          // Actualizar select y disparar change
          select.value = chip.dataset.region;
          select.dispatchEvent(new Event('change'));
        });
      })(chips[i]);
    }
  }

  // Stats en tiempo real: semana del año escolar, días para vacaciones, próximo feriado
  // Lee fechas desde window.CALENDAR_CONFIG (data/calendar-config.json)
  function initSchoolStats() {
    // Parsear fechas ISO desde calendar-config.json
    // Nota: parseamos con hora 12:00 UTC para evitar desfase de timezone (Chile -3/-4)
    function parseDate(isoStr) {
      var parts = isoStr.split('-');
      return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0));
    }

    var schoolStart = parseDate(CAL.schoolStart);
    var winterStart = parseDate(CAL.winterStart);
    var winterEnd   = parseDate(CAL.winterEnd);
    var schoolEnd   = parseDate(CAL.schoolEnd);

    // Feriados desde calendar-config.json (ya no hardcodeados)
    var FERIADOS = CAL.feriados.map(function (f) {
      return { date: parseDate(f.date), nombre: f.nombre };
    });

    var now = new Date();
    var today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0));

    // Semana del año escolar
    var weekEl = document.getElementById('school-week');
    if (weekEl) {
      var daysSinceStart = Math.floor((today - schoolStart) / 86400000);
      if (daysSinceStart < 0) {
        weekEl.textContent = 'A\u00fan no inicia';
      } else if (today >= schoolEnd) {
        weekEl.textContent = 'Finalizado';
      } else {
        var weekNum = Math.floor(daysSinceStart / 7) + 1;
        weekEl.textContent = 'Semana\u00a0' + weekNum;
      }
    }

    // Días para vacaciones de invierno (o estado actual)
    var winterEl = document.getElementById('days-to-winter');
    if (winterEl) {
      var daysToWinter = Math.ceil((winterStart - today) / 86400000);
      if (daysToWinter > 0) {
        winterEl.textContent = daysToWinter + '\u00a0d\u00edas';
      } else if (today < winterEnd) {
        winterEl.textContent = '\u00a1En\u00a0curso!';
      } else {
        winterEl.textContent = 'Pasadas';
      }
    }

    // Próximo feriado en período escolar
    var nameEl = document.getElementById('next-holiday-name');
    var daysEl = document.getElementById('next-holiday-days');
    if (nameEl) {
      var nextFeriado = null;
      for (var i = 0; i < FERIADOS.length; i++) {
        if (FERIADOS[i].date >= today) {
          nextFeriado = FERIADOS[i];
          break;
        }
      }
      if (nextFeriado) {
        nameEl.textContent = nextFeriado.nombre;
        if (daysEl) {
          var dF = Math.ceil((nextFeriado.date - today) / 86400000);
          daysEl.textContent = dF === 0 ? '\u00a1Hoy!' : 'en ' + dF + ' d\u00edas';
        }
      } else {
        nameEl.textContent = 'Ninguno';
        if (daysEl) daysEl.textContent = 'a\u00f1o concluido';
      }
    }
  }

  return { init: init };
})();
