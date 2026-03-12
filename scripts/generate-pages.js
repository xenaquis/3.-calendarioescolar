#!/usr/bin/env node
/* generate-pages.js — Genera páginas HTML desde datos JSON
   Para arquetipo B (catálogos estáticos: visachileno, calendarioescolar, nevechile).

   Uso:
     node scripts/generate-pages.js

   Lee:
     - data/pages.json (array de objetos con datos por página)
     - data/template.html (plantilla HTML con {{placeholders}})

   Genera:
     - public/[slug]/index.html por cada entrada en pages.json
     - Actualiza public/sitemap.xml
*/

var fs = require('fs');
var path = require('path');

var DATA_FILE = path.join(__dirname, '..', 'data', 'pages.json');
var TEMPLATE_FILE = path.join(__dirname, '..', 'data', 'template.html');
var OUTPUT_DIR = path.join(__dirname, '..', 'public');
var SITEMAP_FILE = path.join(OUTPUT_DIR, 'sitemap.xml');

// Verificar archivos
if (!fs.existsSync(DATA_FILE)) {
  console.log('No se encontró data/pages.json — nada que generar.');
  console.log('Crear el archivo con formato:');
  console.log('[{ "slug": "ejemplo", "title": "Título", "content": "HTML..." }]');
  process.exit(0);
}

if (!fs.existsSync(TEMPLATE_FILE)) {
  console.log('No se encontró data/template.html — creando plantilla base.');
  fs.writeFileSync(TEMPLATE_FILE, defaultTemplate());
  console.log('Editar data/template.html y volver a ejecutar.');
  process.exit(0);
}

// Leer datos y template
var pages = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
var template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
var config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
} catch (e) { /* sin config */ }

var domain = config.domain || 'DOMAIN.cl';
var generated = 0;
var sitemapUrls = [];

// Agregar páginas estáticas al sitemap
['index.html', 'about.html', 'contacto.html', 'vacaciones-invierno-2026.html', 'cuando-empiezan-clases-2026.html'].forEach(function (f) {
  if (fs.existsSync(path.join(OUTPUT_DIR, f))) {
    var slug = f === 'index.html' ? '' : f;
    var pri = '0.3';
    if (f === 'index.html') pri = '1.0';
    else if (f.indexOf('vacaciones') !== -1 || f.indexOf('cuando') !== -1) pri = '0.9';
    sitemapUrls.push({ loc: 'https://' + domain + '/' + slug, priority: pri });
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
    priority: page.priority || '0.6'
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
  sitemap += '    <priority>' + u.priority + '</priority>\n';
  sitemap += '  </url>\n';
});
sitemap += '</urlset>\n';
fs.writeFileSync(SITEMAP_FILE, sitemap);

console.log('Generadas ' + generated + ' páginas + sitemap (' + sitemapUrls.length + ' URLs)');

// Generar public/js/regions-data.js (elimina duplicacion con app.js)
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

function defaultTemplate() {
  return '<!DOCTYPE html>\n<html lang="es-CL">\n<head>\n' +
    '  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '  <title>{{title}} — {{siteName}}</title>\n' +
    '  <meta name="description" content="{{description}}">\n' +
    '  <link rel="canonical" href="https://{{domain}}/{{slug}}/">\n' +
    '  <link rel="stylesheet" href="/css/tokens.css">\n' +
    '  <link rel="stylesheet" href="/css/base.css">\n' +
    '  <link rel="stylesheet" href="/css/components.css">\n' +
    '  <link rel="stylesheet" href="/css/ads.css">\n' +
    '</head>\n<body>\n' +
    '  <header class="site-header"><div class="container">\n' +
    '    <a href="/" class="site-header__brand">{{siteName}}</a>\n' +
    '  </div></header>\n' +
    '  <main id="main"><div class="container">\n' +
    '    <nav class="breadcrumb"><a href="/">Inicio</a> <span>&rsaquo;</span> {{title}}</nav>\n' +
    '    <h1>{{title}}</h1>\n' +
    '    {{content}}\n' +
    '  </div></main>\n' +
    '  <footer class="site-footer"><div class="container">\n' +
    '    <p class="site-footer__copy">&copy; 2026 {{siteName}}</p>\n' +
    '  </div></footer>\n' +
    '  <script defer src="/js/theme.js"></script>\n' +
    '  <script defer src="/js/ads.js"></script>\n' +
    '</body>\n</html>';
}
