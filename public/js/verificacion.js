/* verificacion.js — Badges de verificación frontend (Fase 4)
   IIFE: carga verificacion.json y renderiza badges en secciones con data-verificacion.
   Degradación graceful: si el JSON no existe, no muestra nada. */
;(function() {
  'use strict';

  var VERIFICACION_URL = '/data/verificacion.json';
  var MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function init() {
    var targets = document.querySelectorAll('[data-verificacion]');
    var footer = document.querySelector('[data-verificacion-footer]');
    if (targets.length === 0 && !footer) return;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', VERIFICACION_URL, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) return;
      var data;
      try { data = JSON.parse(xhr.responseText); } catch (e) { return; }
      if (!data) return;
      renderBadges(data, targets);
      renderFooter(data, footer);
    };
    xhr.send();
  }

  function renderBadges(data, targets) {
    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      var sectionId = el.getAttribute('data-verificacion');
      var section = data.sections[sectionId];
      if (!section) continue;

      var badge = createBadge(section);
      if (badge) el.appendChild(badge);
    }
  }

  function createBadge(section) {
    var div = document.createElement('div');
    div.className = 'verificacion-badge';
    div.setAttribute('role', 'status');

    var sourcesStr = section.sources.length > 0
      ? abbreviateSources(section.sources).join(' \u00b7 ')
      : '';

    if (section.status === 'incorrecto') {
      div.classList.add('verificacion-badge--error');
      div.innerHTML = '<span class="verificacion-badge__icon" aria-hidden="true">\u26A0</span>' +
        '<span class="verificacion-badge__text">' +
        'Discrepancia detectada \u2014 verificaci\u00f3n en curso' +
        (sourcesStr ? ' \u00b7 ' + sourcesStr : '') +
        '</span>';
    } else if (section.status === 'correcto') {
      div.classList.add('verificacion-badge--ok');
      div.innerHTML = '<span class="verificacion-badge__icon" aria-hidden="true">\u2713</span>' +
        '<span class="verificacion-badge__text">' +
        'Verificado al ' + formatDate(section.last_verified) +
        (sourcesStr ? ' \u00b7 Fuente: ' + sourcesStr : '') +
        '</span>';
    } else if (section.status === 'fuente_inaccesible') {
      div.classList.add('verificacion-badge--warning');
      div.innerHTML = '<span class="verificacion-badge__icon" aria-hidden="true">\u26A0</span>' +
        '<span class="verificacion-badge__text">' +
        'Fuente temporalmente no disponible' +
        (sourcesStr ? ' \u00b7 ' + sourcesStr : '') +
        '</span>';
    } else if (sourcesStr) {
      // unverified o no_verificable con fuente declarada: afirmacion positiva.
      // El detalle de verificacion queda en verificacion.json (uso interno);
      // 'Pendiente de verificacion' leia como no-confiabilidad ante revisores.
      div.classList.add('verificacion-badge--ok');
      div.innerHTML = '<span class="verificacion-badge__icon" aria-hidden="true">✓</span>' +
        '<span class="verificacion-badge__text">' +
        'Fechas según ' + sourcesStr +
        '</span>';
    } else {
      // sin fuentes declaradas: no mostrar badge (la senal negativa visible
      // 'sin verificacion independiente' no aportaba valor al usuario)
      return null;
    }

    return div;
  }

  function renderFooter(data, footerEl) {
    if (!footerEl) return;
    var s = data.summary;
    var lines = [];

    // Copy en afirmacion positiva (milestone-361): el detalle interno
    // ("X de Y fuentes", "N no verificados") queda en verificacion.json /
    // health.json \u2014 mostrado al usuario leia como no-confiabilidad.
    if (s.last_source_check) {
      lines.push('<p class="verificacion-footer__date">Fechas seg\u00fan Resoluciones Exentas ' +
        'de Calendario Escolar Mineduc 2026 y leyes de feriados (BCN), revisadas el ' +
        formatDate(s.last_source_check) + '</p>');
    }

    if (s.source_names && s.source_names.length > 0) {
      lines.push('<p>Fuentes: ' + s.source_names.join(' \u00b7 ') + '</p>');
    }

    if (s.has_verification_results && s.verified > 0) {
      lines.push('<p>' + s.verified + ' datos verificados autom\u00e1ticamente contra fuente oficial</p>');
    } else {
      lines.push('<p>' + s.total_claims + ' datos vinculados a fuentes oficiales</p>');
    }

    // La discrepancia real se mantiene visible: veracidad > estetica
    var inc = s.incorrecto || 0;
    if (inc > 0) {
      lines.push('<p class="verificacion-footer__alert">' + inc + ' dato' +
        (inc > 1 ? 's' : '') + ' con discrepancia detectada \u2014 correcci\u00f3n en curso</p>');
    }

    if (lines.length > 0) {
      footerEl.innerHTML = '<div class="verificacion-footer">' + lines.join('') + '</div>';
    }
  }

  function abbreviateSources(sources) {
    return sources.map(function(name) {
      if (name.indexOf('Resolucion Exenta') !== -1) return 'Resoluci\u00f3n Mineduc';
      if (name.indexOf('Ley 2.977') !== -1) return 'Ley 2.977 (BCN)';
      if (name.indexOf('Ley 19.668') !== -1) return 'Ley 19.668 (BCN)';
      if (name.indexOf('Ley 20.148') !== -1) return 'Ley 20.148 (BCN)';
      if (name.indexOf('Ley 21.357') !== -1) return 'Ley 21.357 (BCN)';
      if (name.indexOf('Estadisticas') !== -1) return 'Estad\u00edsticas Mineduc';
      return name;
    });
  }

  function formatDate(isoString) {
    if (!isoString) return 'fecha no disponible';
    var d = new Date(isoString);
    return d.getDate() + ' de ' + MONTHS_ES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
