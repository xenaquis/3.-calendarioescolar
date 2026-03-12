#!/usr/bin/env node
/* validate.js — Valida integridad de datos antes de deploy
   Uso: node scripts/validate.js
   Sale con codigo 1 si hay errores criticos, 0 si todo OK.

   Verifica:
   - data/pages.json: 16 regiones, campos requeridos, no-vacios
   - data/calendar-config.json: fechas validas, coherencia interna
   - public/js/calendar-config.js: existe (generado)
   - public/js/regions-data.js: existe (generado)
   - Coherencia: año en calendar-config == año en pages.json titles
*/

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var errors = [];
var warnings = [];

function error(msg) { errors.push('ERROR: ' + msg); }
function warn(msg)  { warnings.push('WARN:  ' + msg); }

// ── 1. pages.json ─────────────────────────────────────────────────────────
var pagesPath = path.join(ROOT, 'data', 'pages.json');
if (!fs.existsSync(pagesPath)) {
  error('data/pages.json no existe');
} else {
  var pages;
  try {
    pages = JSON.parse(fs.readFileSync(pagesPath, 'utf8'));
  } catch (e) {
    error('data/pages.json: JSON invalido — ' + e.message);
    pages = null;
  }

  if (pages) {
    var REQUIRED_REGIONS = 16;
    var REQUIRED_FIELDS = [
      'slug', 'region', 'regionSlug',
      'inicio', 'vacacionesInicio', 'vacacionesFin',
      'fiestasPatriasInicio', 'fiestasPatriasFin',
      'finAno', 'diasVacacionesInvierno', 'diasFiestasPatrias',
      'title', 'description', 'priority'
    ];

    if (pages.length !== REQUIRED_REGIONS) {
      error('data/pages.json tiene ' + pages.length + ' regiones, se esperan ' + REQUIRED_REGIONS);
    }

    var slugsSeen = {};
    pages.forEach(function (page, idx) {
      var id = page.region || ('index ' + idx);

      // Campos requeridos no vacíos
      REQUIRED_FIELDS.forEach(function (field) {
        if (!page[field] || String(page[field]).trim() === '') {
          error('pages.json[' + id + ']: campo "' + field + '" vacio o faltante');
        }
      });

      // Slugs únicos
      if (page.slug) {
        if (slugsSeen[page.slug]) {
          error('pages.json: slug duplicado "' + page.slug + '"');
        }
        slugsSeen[page.slug] = true;
      }

      // diasVacacionesInvierno debe ser numerico
      if (page.diasVacacionesInvierno && isNaN(Number(page.diasVacacionesInvierno))) {
        error('pages.json[' + id + ']: diasVacacionesInvierno no es numero: "' + page.diasVacacionesInvierno + '"');
      }

      // Regiones del sur tienen fechas distintas — advertir si no
      if (page.regionSlug === 'aysen' || page.regionSlug === 'magallanes') {
        if (page.diasVacacionesInvierno === '14') {
          warn('pages.json[' + id + ']: diasVacacionesInvierno=14 — regiones del sur normalmente tienen más vacaciones de invierno. Verificar con Mineduc.');
        }
      }
    });
  }
}

// ── 2. calendar-config.json ────────────────────────────────────────────────
var calPath = path.join(ROOT, 'data', 'calendar-config.json');
if (!fs.existsSync(calPath)) {
  error('data/calendar-config.json no existe');
} else {
  var cal;
  try {
    cal = JSON.parse(fs.readFileSync(calPath, 'utf8'));
  } catch (e) {
    error('data/calendar-config.json: JSON invalido — ' + e.message);
    cal = null;
  }

  if (cal) {
    var CAL_REQUIRED = ['year', 'schoolStart', 'winterStart', 'winterEnd', 'schoolEnd', 'feriados'];
    CAL_REQUIRED.forEach(function (field) {
      if (!cal[field]) error('calendar-config.json: campo "' + field + '" faltante');
    });

    var ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
    ['schoolStart', 'winterStart', 'winterEnd', 'schoolEnd'].forEach(function (f) {
      if (cal[f] && !ISO_RE.test(cal[f])) {
        error('calendar-config.json: "' + f + '" no tiene formato YYYY-MM-DD: "' + cal[f] + '"');
      }
    });

    // Coherencia cronológica
    if (cal.schoolStart && cal.winterStart && cal.winterEnd && cal.schoolEnd) {
      var ss = new Date(cal.schoolStart);
      var ws = new Date(cal.winterStart);
      var we = new Date(cal.winterEnd);
      var se = new Date(cal.schoolEnd);

      if (ss >= ws) error('calendar-config.json: schoolStart debe ser antes de winterStart');
      if (ws >= we) error('calendar-config.json: winterStart debe ser antes de winterEnd');
      if (we >= se) error('calendar-config.json: winterEnd debe ser antes de schoolEnd');
    }

    // Feriados: formato y orden cronológico
    if (Array.isArray(cal.feriados)) {
      if (cal.feriados.length === 0) warn('calendar-config.json: feriados esta vacio');
      var prevDate = null;
      cal.feriados.forEach(function (f, i) {
        if (!f.date || !ISO_RE.test(f.date)) {
          error('calendar-config.json: feriados[' + i + '].date invalida: "' + f.date + '"');
        }
        if (!f.nombre || f.nombre.trim() === '') {
          error('calendar-config.json: feriados[' + i + '].nombre vacio');
        }
        if (prevDate && f.date < prevDate) {
          warn('calendar-config.json: feriados no estan en orden cronologico (indice ' + i + ')');
        }
        prevDate = f.date;
      });

      // Verificar que el año de los feriados coincide con cal.year
      cal.feriados.forEach(function (f, i) {
        if (f.date && !f.date.startsWith(String(cal.year))) {
          error('calendar-config.json: feriados[' + i + '] tiene año diferente a cal.year (' + cal.year + '): "' + f.date + '"');
        }
      });
    }

    // Coherencia year vs dates
    if (cal.year && cal.schoolStart && !cal.schoolStart.startsWith(String(cal.year))) {
      error('calendar-config.json: schoolStart (' + cal.schoolStart + ') no corresponde al año ' + cal.year);
    }
  }
}

// ── 3. Archivos generados existen ──────────────────────────────────────────
var generatedFiles = [
  'public/js/regions-data.js',
  'public/js/calendar-config.js',
  'public/health.json'
];
generatedFiles.forEach(function (f) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    warn(f + ' no existe — ejecutar: npm run generate');
  }
});

// ── 4. index.html carga calendar-config.js ─────────────────────────────────
var indexPath = path.join(ROOT, 'public', 'index.html');
if (fs.existsSync(indexPath)) {
  var indexHtml = fs.readFileSync(indexPath, 'utf8');
  if (indexHtml.indexOf('calendar-config.js') === -1) {
    error('public/index.html no carga calendar-config.js — app.js necesita window.CALENDAR_CONFIG');
  }
}

// ── 5. No placeholders criticos en config.json ─────────────────────────────
var configPath = path.join(ROOT, 'config.json');
if (fs.existsSync(configPath)) {
  var configStr = fs.readFileSync(configPath, 'utf8');
  if (configStr.indexOf('PLACEHOLDER_SHEET_ID') !== -1) {
    warn('config.json: sheet.spreadsheetId es placeholder — actualizar con ID real del Google Sheet');
  }
}

// ── Reporte final ──────────────────────────────────────────────────────────
console.log('\n=== Validacion de datos ===\n');

if (warnings.length > 0) {
  warnings.forEach(function (w) { console.log('  ' + w); });
  console.log('');
}

if (errors.length > 0) {
  errors.forEach(function (e) { console.log('  ' + e); });
  console.log('\n  ' + errors.length + ' error(es) critico(s). Corregir antes de deploy.\n');
  process.exit(1);
} else {
  console.log('  Todo OK — ' + (warnings.length > 0 ? warnings.length + ' advertencia(s)' : 'sin advertencias') + '\n');
  process.exit(0);
}
