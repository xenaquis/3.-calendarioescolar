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

// Agregar páginas estáticas al sitemap
var STATIC_PAGES = [
  { file: 'index.html',                      pri: '1.0', freq: 'weekly' },
  { file: 'feriados-2026.html',              pri: '0.8', freq: 'monthly' },
  { file: 'vacaciones-invierno-2026.html',   pri: '0.9', freq: 'monthly' },
  { file: 'cuando-empiezan-clases-2026.html',pri: '0.9', freq: 'monthly' },
  { file: 'about.html',                      pri: '0.3', freq: 'monthly' },
  { file: 'contacto.html',                   pri: '0.3', freq: 'yearly' }
];
STATIC_PAGES.forEach(function (p) {
  if (fs.existsSync(path.join(OUTPUT_DIR, p.file))) {
    var slug = p.file === 'index.html' ? '' : p.file;
    sitemapUrls.push({ loc: 'https://' + domain + '/' + slug, priority: p.pri, changefreq: p.freq });
  }
});

// Generar cada página
pages.forEach(function (page) {
  if (!page.slug) return;

  var html = template;
  // Reemplazar todos los {{key}} con valores del objeto
  Object.keys(page).forEach(function (key) {
    var re = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
    html = html.replace(re, page[key] || '');
  });
  // Reemplazar {{domain}} y {{siteName}}
  html = html.replace(/\{\{domain\}\}/g, domain);
  html = html.replace(/\{\{siteName\}\}/g, config.siteName || 'SITENAME');

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
    diasFP: page.diasFiestasPatrias
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
fs.writeFileSync(path.join(OUTPUT_DIR, 'health.json'), JSON.stringify(health, null, 2));
console.log('Generado public/health.json (status: ok, regiones: ' + health.regionsCount + ')');
