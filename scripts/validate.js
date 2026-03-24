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

// ── Helpers para validacion de afirmaciones ─────────────────────────────────
function listHtmlFiles(dir) {
  var results = [];
  if (!fs.existsSync(dir)) return results;
  var entries = fs.readdirSync(dir);
  entries.forEach(function (entry) {
    var full = path.join(dir, entry);
    var stat;
    try { stat = fs.statSync(full); } catch (e) { return; }
    if (stat.isDirectory()) {
      results = results.concat(listHtmlFiles(full));
    } else if (entry.endsWith('.html')) {
      results.push(full);
    }
  });
  return results;
}

function resolveDataPath(dataPath, calendarConfig, pagesData) {
  if (!dataPath) return null;
  var arrow = dataPath.indexOf('\u2192');
  if (arrow === -1) return null;
  var file = dataPath.substring(0, arrow).trim();
  var fieldPath = dataPath.substring(arrow + 1).trim();
  var obj;
  if (file === 'calendar-config.json') {
    obj = calendarConfig;
  } else if (file === 'pages.json') {
    obj = pagesData;
  } else {
    return null;
  }
  if (!obj) return null;
  // pages.json → length
  if (fieldPath === 'length') {
    return Array.isArray(obj) ? obj.length : null;
  }
  // pages.json → [region].field — multi-value, skip
  if (fieldPath.indexOf('[region]') !== -1) return null;
  // field.length (e.g. feriadosCompletos.length)
  var lengthMatch = fieldPath.match(/^(\w+)\.length$/);
  if (lengthMatch) {
    var val = obj[lengthMatch[1]];
    return Array.isArray(val) ? val.length : null;
  }
  // field[N].subfield (e.g. feriadosCompletos[0].date)
  var arrayFieldMatch = fieldPath.match(/^(\w+)\[(\d+)\]\.(\w+)$/);
  if (arrayFieldMatch) {
    var arr = obj[arrayFieldMatch[1]];
    var idx = parseInt(arrayFieldMatch[2], 10);
    var sub = arrayFieldMatch[3];
    if (Array.isArray(arr) && arr[idx]) return arr[idx][sub];
    return null;
  }
  // Simple field (e.g. schoolStart)
  if (obj.hasOwnProperty(fieldPath)) return obj[fieldPath];
  return null;
}

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

      // Campos opcionales adicionales (DATA-01): si existen deben tener formato "DD de mes" o "Sin datos"
      var OPTIONAL_DATE_FIELDS = [
        'finAnoSinJEC', 'finAnoEPJA', 'cierreActas4Medio',
        'diaProfesor', 'inicioSegundoSemestre'
      ];

      OPTIONAL_DATE_FIELDS.forEach(function (field) {
        if (page[field] && page[field] !== 'Sin datos') {
          // Validar formato: "DD de mes"
          if (!/^\d{1,2}\s+de\s+[a-záéíóúñ]+$/i.test(page[field])) {
            warn('pages.json[' + id + ']: campo "' + field + '" formato inesperado: ' + page[field]);
          }
        }
      });
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

// ── 6. Heartbeat: source-health.json no debe estar stale (>14 dias) ──────
var sourceHealthPath = path.join(ROOT, 'data', 'source-health.json');
if (fs.existsSync(sourceHealthPath)) {
  try {
    var sourceHealth = JSON.parse(fs.readFileSync(sourceHealthPath, 'utf8'));
    if (sourceHealth.checked_at) {
      var checkedDate = new Date(sourceHealth.checked_at);
      var daysSinceCheck = Math.floor((Date.now() - checkedDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceCheck > 14) {
        warn('source-health.json tiene ' + daysSinceCheck + ' dias sin actualizar — verificar que el workflow check-sources esta funcionando');
      }
    }
  } catch (e) {
    warn('source-health.json: JSON invalido — ' + e.message);
  }
}

// ── 7. Validacion de afirmaciones ─────────────────────────────────────────
var afirmacionesPath = path.join(ROOT, 'data', 'afirmaciones.json');
if (fs.existsSync(afirmacionesPath)) {
  var afirmaciones;
  try {
    afirmaciones = JSON.parse(fs.readFileSync(afirmacionesPath, 'utf8'));
  } catch (e) {
    error('data/afirmaciones.json: JSON invalido — ' + e.message);
    afirmaciones = null;
  }

  if (afirmaciones && afirmaciones.claims && afirmaciones.sources) {
    // 6a. Verificar que cada claim referencia una source existente
    afirmaciones.claims.forEach(function (claim) {
      if (claim.source_id && !afirmaciones.sources[claim.source_id]) {
        error('afirmaciones.json: claim "' + claim.id +
          '" referencia source inexistente "' + claim.source_id + '"');
      }
    });

    // 6b. Verificar coherencia: displayed_value vs dato real
    afirmaciones.claims.forEach(function (claim) {
      if (claim.data_path && claim.displayed_value) {
        var realValue = resolveDataPath(claim.data_path, cal, pages);
        if (realValue !== null && String(realValue) !== String(claim.displayed_value)) {
          error('afirmaciones.json: claim "' + claim.id + '" dice "' +
            claim.displayed_value + '" pero dato real es "' + realValue + '"');
        }
      }
    });

    // 6c. Detector de claims huerfanas — escanea <meta name="claim-data"> en HTML
    var htmlDir = path.join(ROOT, 'public');
    var htmlFiles = listHtmlFiles(htmlDir);
    var NO_CLAIM_EXEMPT = ['privacidad.html', 'contacto.html', 'about.html', 'avisolegal.html'];
    var declaredKeys = {};

    htmlFiles.forEach(function (htmlFile) {
      var html = fs.readFileSync(htmlFile, 'utf8');
      var match = html.match(/<meta\s+name="claim-data"\s+content="([^"]+)"/);
      if (!match) {
        var basename = path.basename(htmlFile);
        if (NO_CLAIM_EXEMPT.indexOf(basename) === -1) {
          warn(path.relative(ROOT, htmlFile).replace(/\\/g, '/') + ': no tiene meta claim-data');
        }
        return;
      }
      var dataKeys = match[1].split(',').map(function (k) { return k.trim(); });
      dataKeys.forEach(function (key) {
        if (!key) return;
        declaredKeys[key] = true;
        var hasClaim = afirmaciones.claims.some(function (c) { return c.data_key === key; });
        if (!hasClaim) {
          error(path.relative(ROOT, htmlFile).replace(/\\/g, '/') +
            ': usa data_key "' + key + '" pero no hay claim en afirmaciones.json');
        }
      });
    });

    console.log('  Afirmaciones: ' + afirmaciones.claims.length + ' claims, ' +
      Object.keys(afirmaciones.sources).length + ' sources, ' +
      Object.keys(declaredKeys).length + ' data_keys declarados en HTML');
  }
} else {
  warn('data/afirmaciones.json no encontrado — verificacion de afirmaciones deshabilitada');
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
