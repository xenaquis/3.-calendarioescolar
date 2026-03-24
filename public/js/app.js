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

  // Mapeo de grupos regionales (slugs sin grupo = Estándar por defecto)
  var GRUPOS = {
    'arica-y-parinacota': 'Norte',
    'tarapaca': 'Norte',
    'los-lagos': 'Sur-Parcial',
    'aysen': 'Sur',
    'magallanes': 'Sur'
  };

  function init() {
    initMapSelector();
    if (CAL) {
      initSchoolStats();
    } else {
      console.warn('[app.js] CALENDAR_CONFIG no disponible — ejecutar: npm run generate');
    }
  }

  // Selector de región por mapa — enlaza clicks en .region-bar[data-slug]
  function initMapSelector() {
    var bars = document.querySelectorAll('.region-bar[data-slug]');
    if (!bars.length) return;

    for (var i = 0; i < bars.length; i++) {
      (function (bar) {
        bar.addEventListener('click', function () {
          selectRegion(bar.dataset.slug, bars);
        });
      })(bars[i]);
    }
  }

  // Selecciona una región: actualiza estado activo y puebla el panel de datos
  function selectRegion(slug, bars) {
    if (!slug || !REGIONS[slug]) return;
    var r = REGIONS[slug];

    // Desactivar todas las barras
    for (var i = 0; i < bars.length; i++) {
      bars[i].classList.remove('active');
      bars[i].setAttribute('aria-selected', 'false');
    }
    // Activar la barra seleccionada
    var activeBar = document.querySelector('.region-bar[data-slug="' + slug + '"]');
    if (activeBar) {
      activeBar.classList.add('active');
      activeBar.setAttribute('aria-selected', 'true');
    }

    // Ocultar placeholder, mostrar datos
    var placeholder = document.getElementById('placeholder-data');
    var regionData = document.getElementById('region-data');
    if (placeholder) placeholder.style.display = 'none';
    if (regionData) regionData.className = 'active';

    // Poblar datos clave
    var elName  = document.getElementById('r-name');
    var elGrupo = document.getElementById('r-grupo');
    var elInicio = document.getElementById('r-inicio');
    var elVac   = document.getElementById('r-vac');
    var elFp    = document.getElementById('r-fp');
    var elFin   = document.getElementById('r-fin');

    if (elName)  elName.textContent  = 'Regi\u00f3n ' + r.name;
    if (elGrupo) elGrupo.textContent = GRUPOS[slug] || 'Est\u00e1ndar';
    if (elInicio) elInicio.textContent = r.inicio;
    if (elVac)  elVac.textContent   = r.vacIni + ' \u2014 ' + r.vacFin;
    if (elFp)   elFp.textContent    = r.fpIni + ' \u2014 ' + r.fpFin;
    if (elFin)  elFin.textContent   = r.fin;

    // Poblar datos adicionales
    var elSeg    = document.getElementById('r-seg');
    var elProf   = document.getElementById('r-prof');
    var elActas  = document.getElementById('r-actas');
    var elSinjec = document.getElementById('r-sinjec');
    var elEpja   = document.getElementById('r-epja');

    if (elSeg)    elSeg.textContent    = r.ini2doSem;
    if (elProf)   elProf.textContent   = r.diaProf;
    if (elActas)  elActas.textContent  = r.cierreActas;
    if (elSinjec) elSinjec.textContent = r.finSinJEC;
    if (elEpja)   elEpja.textContent   = r.finEPJA;

    // Actualizar enlace "ver página completa"
    var elLink = document.getElementById('link-pagina');
    if (elLink) elLink.href = '/region/' + slug + '/';
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
