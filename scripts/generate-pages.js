#!/usr/bin/env node
/* generate-pages.js — Genera páginas HTML desde datos JSON
   Para arquetipo B (catálogos estáticos: visachileno, calendarioescolar, nevechile).

   Uso:
     node scripts/generate-pages.js

   Lee:
     - data/pages.json          (array de objetos con datos por región)
     - data/template.html       (plantilla HTML con {{placeholders}})
     - data/calendar-config.json (fechas del año escolar y feriados)
     - config.json

   Genera:
     - public/[slug]/index.html por cada entrada en pages.json
     - public/sitemap.xml
     - public/js/regions-data.js   (window.REGIONS_DATA para app.js)
     - public/js/calendar-config.js (window.CALENDAR_CONFIG para app.js)
     - public/health.json          (metadata para monitoreo automatico)
*/

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var DATA_FILE          = path.join(__dirname, '..', 'data', 'pages.json');
var TEMPLATE_FILE      = path.join(__dirname, '..', 'data', 'template.html');
var CAL_CONFIG_FILE    = path.join(__dirname, '..', 'data', 'calendar-config.json');
var OUTPUT_DIR         = path.join(__dirname, '..', 'public');
var SITEMAP_FILE       = path.join(OUTPUT_DIR, 'sitemap.xml');

// Verificar archivos
if (!fs.existsSync(DATA_FILE)) {
  console.log('No se encontro data/pages.json — nada que generar.');
  process.exit(0);
}

if (!fs.existsSync(TEMPLATE_FILE)) {
  console.log('No se encontro data/template.html.');
  process.exit(1);
}

// Leer datos y template
var pages = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
var template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
var config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
} catch (e) { /* sin config */ }

var calConfig = null;
try {
  calConfig = JSON.parse(fs.readFileSync(CAL_CONFIG_FILE, 'utf8'));
} catch (e) {
  console.log('ADVERTENCIA: No se encontro data/calendar-config.json — calendar-config.js no se generara.');
}

var domain = config.domain || 'DOMAIN.cl';
var generated = 0;
var sitemapUrls = [];
var buildDate = new Date().toISOString().slice(0, 10); // stamp de frescura (deploy diario)

// Agregar páginas estáticas al sitemap
var STATIC_PAGES = [
  { file: 'index.html',                      pri: '1.0', freq: 'weekly' },
  { file: 'feriados-2026.html',              pri: '0.8', freq: 'monthly' },
  { file: 'feriados-2027.html',              pri: '0.6', freq: 'monthly' },
  { file: 'corpus-christi-2026.html',        pri: '0.6', freq: 'monthly' },
  { file: 'vacaciones-invierno-2026.html',   pri: '0.9', freq: 'monthly' },
  { file: 'cuando-empiezan-clases-2026.html',pri: '0.9', freq: 'monthly' },
  { file: 'about.html',                      pri: '0.3', freq: 'monthly' },
  { file: 'quienes-somos.html',             pri: '0.4', freq: 'monthly' },
  { file: 'contacto.html',                   pri: '0.3', freq: 'yearly' }
];
STATIC_PAGES.forEach(function (p) {
  if (fs.existsSync(path.join(OUTPUT_DIR, p.file))) {
    var slug = p.file === 'index.html' ? '' : p.file.replace(/\.html$/, '');
    sitemapUrls.push({ loc: 'https://' + domain + '/' + slug, priority: p.pri, changefreq: p.freq });
  }
});

// Dia de la semana real de una fecha "4 de marzo" — evita hardcodear "Lunes"
// en el template cuando el inicio real cae otro dia (bug detectado: 4-mar-2026
// es miercoles y el template decia "Lunes · 2026").
var MESES_NUM = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
var DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Mi&eacute;rcoles', 'Jueves', 'Viernes', 'S&aacute;bado'];
var dataYear = (calConfig && calConfig.year) || 2026;
function diaSemanaDe(fechaTexto) {
  var m = /^(\d{1,2}) de ([a-záéíóúñ]+)/i.exec(String(fechaTexto || '').trim());
  if (!m) return '';
  var mes = MESES_NUM[m[2].toLowerCase()];
  if (mes === undefined) return '';
  return DIAS_SEMANA[new Date(Date.UTC(dataYear, mes, parseInt(m[1], 10))).getUTCDay()];
}

// Seccion "Particularidades" por region: prosa unica (notaRegional) +
// comparativa + cita de la REX oficial con link al PDF. Es LA remediacion
// del thin content (16 paginas eran 96% boilerplate — auditoria 06-jul).
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function buildParticularidades(page) {
  if (!page.notaRegional || !page.notaRegional.length) return '';
  var out = '<section class="section" id="particularidades" aria-label="Particularidades del calendario de ' + escHtml(page.region) + '">\n';
  out += '        <h2>Particularidades de ' + escHtml(page.region) + ' en 2026</h2>\n';
  page.notaRegional.forEach(function (parrafo) {
    out += '        <p>' + escHtml(parrafo) + '</p>\n';
  });
  if (page.comparativa) {
    out += '        <p>' + escHtml(page.comparativa) + '</p>\n';
  }
  if (page.resolucion && page.resolucion.numero) {
    var r = page.resolucion;
    out += '        <p class="card__meta">Fuente oficial: <a href="' + r.url +
      '" rel="noopener noreferrer" target="_blank">Resoluci&oacute;n Exenta N&deg; ' +
      escHtml(r.numero) + ' (' + escHtml(r.fecha) + ') &mdash; Seremi de Educaci&oacute;n ' +
      escHtml(page.region) + ' (PDF)</a>' +
      (r.nota ? '. ' + escHtml(r.nota) : '') + '</p>\n';
  }
  out += '      </section>';
  return out;
}

// Generar cada página
pages.forEach(function (page) {
  if (!page.slug) return;

  var html = template;
  // Placeholders compuestos primero (evita que el loop de keys pise objetos)
  html = html.replace(/\{\{particularidadesHtml\}\}/g, buildParticularidades(page));
  html = html.replace(/\{\{rexClaimKey\}\}/g, 'rex_' + String(page.regionSlug || '').replace(/-/g, '_'));
  // Reemplazar todos los {{key}} con valores del objeto (solo valores string)
  Object.keys(page).forEach(function (key) {
    if (typeof page[key] === 'object') return;
    var re = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
    html = html.replace(re, page[key] || '');
  });
  // Placeholder calculado: dia de la semana del inicio de clases regional
  html = html.replace(/\{\{inicioDiaSemana\}\}/g, diaSemanaDe(page.inicio));
  // Reemplazar {{domain}}, {{siteName}} y {{buildDate}} (freshness automatica)
  html = html.replace(/\{\{domain\}\}/g, domain);
  html = html.replace(/\{\{siteName\}\}/g, config.siteName || 'SITENAME');
  html = html.replace(/\{\{buildDate\}\}/g, buildDate);

  // Crear directorio y escribir
  var dir = path.join(OUTPUT_DIR, page.slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  generated++;

  sitemapUrls.push({
    loc: 'https://' + domain + '/' + page.slug + '/',
    priority: page.priority || '0.6',
    changefreq: 'monthly'
  });
});

// Generar páginas de feriados por mes (public/feriados/[mes]-2026/)
var TEMPLATE_MES_FILE = path.join(__dirname, '..', 'data', 'template-mes.html');
if (calConfig && fs.existsSync(TEMPLATE_MES_FILE)) {
  var generateFeriadosMes = require('./generate-feriados-mes.js');
  var mesUrls = generateFeriadosMes(calConfig, TEMPLATE_MES_FILE, OUTPUT_DIR, domain);
  mesUrls.forEach(function (u) { sitemapUrls.push(u); });
}

// Generar public/proximo-feriado.html (countdown nacional, estatico en build + cliente)
if (calConfig) {
  var generateProximoFeriado = require('./generate-proximo-feriado.js');
  sitemapUrls.push(generateProximoFeriado(calConfig, OUTPUT_DIR, domain));
}

// Generar public/efemerides-escolares-[year].html (efemerides educacionales verificadas)
if (calConfig) {
  var generateEfemerides = require('./generate-efemerides.js');
  sitemapUrls.push(generateEfemerides(calConfig, OUTPUT_DIR, domain));
}

// Generar sitemap
var today = new Date().toISOString().slice(0, 10);
var sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
sitemapUrls.forEach(function (u) {
  sitemap += '  <url>\n';
  sitemap += '    <loc>' + u.loc + '</loc>\n';
  sitemap += '    <lastmod>' + today + '</lastmod>\n';
  if (u.changefreq) sitemap += '    <changefreq>' + u.changefreq + '</changefreq>\n';
  sitemap += '    <priority>' + u.priority + '</priority>\n';
  sitemap += '  </url>\n';
});
sitemap += '</urlset>\n';
fs.writeFileSync(SITEMAP_FILE, sitemap);

console.log('Generadas ' + generated + ' paginas + sitemap (' + sitemapUrls.length + ' URLs)');

// Generar public/js/regions-data.js
var regionsData = {};
pages.forEach(function (page) {
  if (!page.regionSlug) return;
  regionsData[page.regionSlug] = {
    name: page.region,
    inicio: page.inicio,
    vacIni: page.vacacionesInicio,
    vacFin: page.vacacionesFin,
    fpIni: page.fiestasPatriasInicio,
    fpFin: page.fiestasPatriasFin,
    fin: page.finAno,
    diasVac: page.diasVacacionesInvierno,
    diasFP: page.diasFiestasPatrias,
    finSinJEC: page.finAnoSinJEC,
    finEPJA: page.finAnoEPJA,
    cierreActas: page.cierreActas4Medio,
    diaProf: page.diaProfesor,
    ini2doSem: page.inicioSegundoSemestre
  };
});
var regionsJs = '/* regions-data.js — generado automaticamente por scripts/generate-pages.js\n' +
  '   NO EDITAR DIRECTAMENTE — editar data/pages.json y ejecutar: npm run generate */\n' +
  'window.REGIONS_DATA = ' + JSON.stringify(regionsData, null, 2) + ';\n';
var regionsJsPath = path.join(OUTPUT_DIR, 'js', 'regions-data.js');
fs.writeFileSync(regionsJsPath, regionsJs);
console.log('Generado public/js/regions-data.js (' + Object.keys(regionsData).length + ' regiones)');

// Generar public/js/calendar-config.js (elimina fechas hardcodeadas en app.js)
if (calConfig) {
  calConfig.generatedDate = buildDate; // freshness automatica para el label visible del home (app.js)
  var calJs = '/* calendar-config.js — generado automaticamente por scripts/generate-pages.js\n' +
    '   NO EDITAR DIRECTAMENTE — editar data/calendar-config.json y ejecutar: npm run generate */\n' +
    'window.CALENDAR_CONFIG = ' + JSON.stringify(calConfig, null, 2) + ';\n';
  var calJsPath = path.join(OUTPUT_DIR, 'js', 'calendar-config.js');
  fs.writeFileSync(calJsPath, calJs);
  console.log('Generado public/js/calendar-config.js (year: ' + calConfig.year + ', feriados: ' + calConfig.feriados.length + ')');
}

// Generar tabla de feriados en public/feriados-2026.html desde feriadosCompletos
var feriadosPagePath = path.join(OUTPUT_DIR, 'feriados-2026.html');
if (calConfig && calConfig.feriadosCompletos && fs.existsSync(feriadosPagePath)) {
  var TIPO_LABEL = {
    'civil':         'Civil',
    'laboral':       'Laboral',
    'patrio':        'Patrio',
    'conmemorativo': 'Conmemorativo',
    'religioso':     'Religioso'
  };

  var rows = calConfig.feriadosCompletos.map(function (f) {
    var fechaDisplay = f.diaSemana + ' ' + f.diaNum + ' de ' + f.mes;
    var tipoLabel = TIPO_LABEL[f.tipo] || f.tipo;
    var tipoBadgeClass = 'badge--' + f.tipo;

    var nombreCell = '<strong>' + f.nombre + '</strong>';
    if (f.nota) {
      nombreCell += '\n                  <br><small style="color:var(--color-text-tertiary)">' + f.nota + '</small>';
    }

    var impactoBadge, impactoClass;
    if (f.contexto === 'en-clases') {
      impactoBadge = 'Suspende clases';
      impactoClass = 'badge--clases';
    } else {
      impactoBadge = f.notaContexto || 'Sin impacto escolar';
      impactoClass = 'badge--sin-impacto';
    }

    return '              <tr data-contexto="' + f.contexto + '">\n' +
           '                <td><time datetime="' + f.date + '">' + fechaDisplay + '</time></td>\n' +
           '                <td>' + nombreCell + '</td>\n' +
           '                <td><span class="badge ' + tipoBadgeClass + '">' + tipoLabel + '</span></td>\n' +
           '                <td><span class="badge ' + impactoClass + '">' + impactoBadge + '</span></td>\n' +
           '              </tr>';
  }).join('\n');

  var feriadosHtml = fs.readFileSync(feriadosPagePath, 'utf8');
  var markerStart = '<!-- GENERATED:feriados-tbody-start -->';
  var markerEnd   = '<!-- GENERATED:feriados-tbody-end -->';
  var iStart = feriadosHtml.indexOf(markerStart);
  var iEnd   = feriadosHtml.indexOf(markerEnd);

  if (iStart !== -1 && iEnd !== -1) {
    feriadosHtml = feriadosHtml.slice(0, iStart + markerStart.length) +
      '\n' + rows + '\n              ' +
      feriadosHtml.slice(iEnd);
    fs.writeFileSync(feriadosPagePath, feriadosHtml);
    console.log('Actualizado public/feriados-2026.html (' + calConfig.feriadosCompletos.length + ' feriados)');
  } else {
    console.log('ADVERTENCIA: No se encontraron markers en feriados-2026.html — tabla no actualizada.');
  }
}

// Generar public/health.json (para monitoreo automatico por agente)
var pagesHash = crypto.createHash('md5').update(fs.readFileSync(DATA_FILE)).digest('hex');
var calHash = calConfig
  ? crypto.createHash('md5').update(fs.readFileSync(CAL_CONFIG_FILE)).digest('hex')
  : null;

var health = {
  generatedAt: new Date().toISOString(),
  generatedDate: today,
  dataYear: calConfig ? calConfig.year : null,
  regionsCount: Object.keys(regionsData).length,
  pagesCount: generated,
  sitemap: sitemapUrls.length + ' URLs',
  dataFingerprint: {
    pagesJson: pagesHash,
    calendarConfigJson: calHash
  },
  calendarConfig: calConfig ? {
    schoolStart: calConfig.schoolStart,
    winterStart: calConfig.winterStart,
    winterEnd: calConfig.winterEnd,
    schoolEnd: calConfig.schoolEnd,
    feriadosCount: calConfig.feriados.length
  } : null,
  status: 'ok'
};

// Incluir estado de fuentes en health.json si existe
var sourceHealthPath = path.join(__dirname, '..', 'data', 'source-health.json');
if (fs.existsSync(sourceHealthPath)) {
  try {
    var sourceHealth = JSON.parse(fs.readFileSync(sourceHealthPath, 'utf8'));
    health.sourceHealth = {
      lastChecked: sourceHealth.checked_at,
      totalSources: sourceHealth.total_sources,
      ok: sourceHealth.ok,
      broken: sourceHealth.broken,
      changed: sourceHealth.changed
    };
  } catch (e) { /* ignorar si invalido */ }
}
fs.writeFileSync(path.join(OUTPUT_DIR, 'health.json'), JSON.stringify(health, null, 2));
console.log('Generado public/health.json (status: ok, regiones: ' + health.regionsCount + ')');

// Generar public/js/claims-data.js y public/js/claims-tooltips.js desde claims.json
var CLAIMS_FILE = path.join(__dirname, '..', 'data', 'claims.json');
var claimsData = null;
try {
  claimsData = JSON.parse(fs.readFileSync(CLAIMS_FILE, 'utf8'));
} catch (e) {
  console.log('ADVERTENCIA: No se encontro data/claims.json — claims-data.js no se generara.');
}

if (claimsData && claimsData.claims) {
  // Construir mapa de claims para el frontend
  var claimsDataMap = {};
  claimsData.claims.forEach(function(claim) {
    var entry = {
      id: claim.id,
      pregunta: claim.pregunta || null,
      respuesta: claim.respuesta || null,
      status: claim.status || 'unverified'
    };
    // Para claims BCN (fuente normativa), agregar campos de verificacion legal
    if (claim.source_id && claim.source_id.indexOf('bcn-') === 0) {
      var source = claimsData.sources && claimsData.sources[claim.source_id];
      entry.source_reference = claim.source_reference || null;
      entry.source_name = source ? source.name : null;
      entry.extracto_verbatim = claim.extracto_verbatim || null;
      entry.fuente_url = claim.fuente_url || null;
      entry.articulo_numero = claim.articulo_numero || null;
      entry.inciso = claim.inciso || null;
    }
    claimsDataMap[claim.id] = entry;
  });

  var claimsDataJs = '/* claims-data.js — generado automaticamente por scripts/generate-pages.js\n' +
    '   NO EDITAR DIRECTAMENTE — editar claims en el Sheet y ejecutar: npm run generate */\n' +
    'window.CLAIMS_DATA = ' + JSON.stringify(claimsDataMap, null, 2) + ';\n';
  var claimsDataJsPath = path.join(OUTPUT_DIR, 'js', 'claims-data.js');
  fs.writeFileSync(claimsDataJsPath, claimsDataJs);
  console.log('Generado public/js/claims-data.js (' + claimsData.claims.length + ' claims)');

  // Generar public/js/claims-tooltips.js — popula tooltips BCN desde CLAIMS_DATA en el DOM
  var claimsTooltipsJs = '/* claims-tooltips.js — Popula tooltips BCN desde CLAIMS_DATA\n' +
    '   Generado por generate-pages.js, datos desde claims.json via Sheet */\n' +
    ';(function() {\n' +
    '  \'use strict\';\n' +
    '  document.addEventListener(\'DOMContentLoaded\', function() {\n' +
    '    if (!window.CLAIMS_DATA) return;\n' +
    '    var badges = document.querySelectorAll(\'[data-claim-id]\');\n' +
    '    for (var i = 0; i < badges.length; i++) {\n' +
    '      var claimId = badges[i].getAttribute(\'data-claim-id\');\n' +
    '      var claim = window.CLAIMS_DATA[claimId];\n' +
    '      if (!claim || !claim.source_reference) continue;\n' +
    '      var tooltip = badges[i].querySelector(\'.bcn-tooltip\');\n' +
    '      if (!tooltip) continue;\n' +
    '      var sourceName = claim.source_name || \'\';\n' +
    '      var text = claim.source_reference;\n' +
    '      if (sourceName) text += \', \' + sourceName;\n' +
    '      if (claim.extracto_verbatim) {\n' +
    '        var excerpt = claim.extracto_verbatim;\n' +
    '        if (excerpt.length > 200) excerpt = excerpt.substring(0, 197) + \'...\';\n' +
    '        text += \': \u00ab\' + excerpt + \'\u00bb\';\n' +
    '      }\n' +
    '      tooltip.textContent = text;\n' +
    '    }\n' +
    '  });\n' +
    '})();\n';
  var claimsTooltipsJsPath = path.join(OUTPUT_DIR, 'js', 'claims-tooltips.js');
  fs.writeFileSync(claimsTooltipsJsPath, claimsTooltipsJs);
  console.log('Generado public/js/claims-tooltips.js');
}

// Generar verificacion.json (Fase 4 — badges de verificación)
var claimsExists = fs.existsSync(path.join(__dirname, '..', 'data', 'claims.json'));
var afirmacionesExists = fs.existsSync(path.join(__dirname, '..', 'data', 'afirmaciones.json'));
if (claimsExists || afirmacionesExists) {
  require('./generate-verificacion');
}
