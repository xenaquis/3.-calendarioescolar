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
      // unverified or no_verificable — has declared sources
      div.classList.add('verificacion-badge--unverified');
      div.innerHTML = '<span class="verificacion-badge__icon" aria-hidden="true">\u23F3</span>' +
        '<span class="verificacion-badge__text">' +
        'Pendiente de verificaci\u00f3n \u00b7 Fuente declarada: ' + sourcesStr +
        '</span>';
    } else {
      // unverified — no sources at all
      div.classList.add('verificacion-badge--no-source');
      div.innerHTML = '<span class="verificacion-badge__icon" aria-hidden="true">\u2014</span>' +
        '<span class="verificacion-badge__text">' +
        'Dato sin verificaci\u00f3n independiente' +
        '</span>';
    }

    return div;
  }

  function renderFooter(data, footerEl) {
    if (!footerEl) return;
    var s = data.summary;
    var lines = [];

    if (s.last_source_check) {
      var daysAgo = Math.floor((Date.now() - new Date(s.last_source_check).getTime()) / 86400000);
      var agoStr = daysAgo === 0 ? 'hoy' : daysAgo === 1 ? 'ayer' : 'hace ' + daysAgo + ' d\u00edas';
      lines.push('<p class="verificacion-footer__date">Fuentes revisadas el ' +
        formatDate(s.last_source_check) + ' (' + agoStr + ')</p>');
    }

    if (s.sources_ok !== null && s.sources_total !== null) {
      lines.push('<p>' + s.sources_ok + ' de ' + s.sources_total + ' fuentes accesibles</p>');
    }

    if (s.source_names && s.source_names.length > 0) {
      lines.push('<p>Fuentes: ' + s.source_names.join(' \u00b7 ') + '</p>');
    }

    if (s.has_verification_results && s.verified > 0) {
      lines.push('<p>' + s.verified + ' de ' + s.total_claims +
        ' datos verificados autom\u00e1ticamente</p>');
    } else {
      lines.push('<p>' + s.total_claims + ' datos vinculados a fuentes oficiales</p>');
    }

    var unv = (s.unverified || 0) + (s.no_verificable || 0);
    var inc = s.incorrecto || 0;
    if (inc > 0) {
      lines.push('<p class="verificacion-footer__alert">' + inc + ' dato' +
        (inc > 1 ? 's' : '') + ' con discrepancia detectada</p>');
    }
    if (unv > 0) {
      lines.push('<p class="verificacion-footer__caveat">' + unv + ' de ' + s.total_claims +
        ' datos a\u00fan no han sido verificados contra fuentes primarias</p>');
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
