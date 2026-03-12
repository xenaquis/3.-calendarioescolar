/* app.js — calendarioescolar.cl
   Selector de región + stats en tiempo real */

document.addEventListener('DOMContentLoaded', function () {
  // Módulos compartidos
  Theme.init();
  Ads.init();
  Analytics.init('G-XXXXXXXXXX');

  // Lógica del sitio
  App.init();
});

var App = (function () {
  // Datos de regiones — cargados desde public/js/regions-data.js (generado por scripts/generate-pages.js)
  // Si regions-data.js no está disponible, el selector de región no funcionará — ejecutar: npm run generate
  var REGIONS = window.REGIONS_DATA || {};

  // Feriados irrenunciables que caen en período escolar 2026 (excluye fin de semana y vacaciones)
  // Timezone Chile: verano -03:00, invierno -04:00
  var FERIADOS = [
    { date: new Date(2026, 3, 3),  nombre: 'Viernes Santo' },    // abril = mes 3
    { date: new Date(2026, 4, 1),  nombre: '1 de mayo' },
    { date: new Date(2026, 4, 21), nombre: 'Glorias Navales' },
    { date: new Date(2026, 5, 8),  nombre: 'Corpus Christi' },
    { date: new Date(2026, 5, 29), nombre: 'San Pedro y San Pablo' },
    { date: new Date(2026, 9, 12), nombre: 'Enc. Dos Mundos' },  // octubre = mes 9
    { date: new Date(2026, 11, 8), nombre: '8 de diciembre' }    // diciembre = mes 11
  ];

  function init() {
    initRegionSelector();
    initRegionChips();
    initSchoolStats();
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

      if (title) title.textContent = 'Calendario Escolar 2026 \u2014 Regi\u00f3n ' + r.name;

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
  function initSchoolStats() {
    // Año escolar 2026: inicio 2 marzo, inicio vacaciones 11 julio, fin 11 diciembre
    var schoolStart = new Date(2026, 2, 2);   // marzo = mes 2
    var winterStart = new Date(2026, 6, 11);  // julio = mes 6
    var winterEnd   = new Date(2026, 6, 25);  // 25 julio
    var schoolEnd   = new Date(2026, 11, 12); // 12 dic (día siguiente al último día)

    var today = new Date();
    today.setHours(0, 0, 0, 0);

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
        winterEl.textContent = '¡En\u00a0curso!';
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
