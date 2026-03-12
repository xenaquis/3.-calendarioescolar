#!/usr/bin/env node
/* sync-from-sheet.js — Sincroniza datos desde Google Sheets → data/*.json
   Sin dependencias npm. Usa el módulo https nativo de Node.js.

   Requiere:
     - GOOGLE_API_KEY en variable de entorno (o config.json → sheet.apiKey)
     - config.json → sheet.spreadsheetId (ID del Google Sheet)

   El Google Sheet debe tener:
     - Tab "Regiones" (config.json → sheet.regionsTab): datos de las 16 regiones
     - Tab "Config" (config.json → sheet.configTab):   fechas del año escolar + feriados

   Estructura del tab "Regiones" (fila 1 = headers, filas 2-17 = datos):
     A: slug (ej: region/metropolitana)
     B: region (nombre corto, ej: Metropolitana)
     C: regionSlug (ej: metropolitana)
     D: inicio (ej: 2 de marzo)
     E: vacacionesInicio (ej: 11 de julio)
     F: vacacionesFin (ej: 24 de julio)
     G: fiestasPatriasInicio (ej: 14 de septiembre)
     H: fiestasPatriasFin (ej: 18 de septiembre)
     I: finAno (ej: 11 de diciembre)
     J: diasVacacionesInvierno (ej: 14)
     K: diasFiestasPatrias (ej: 5)
     L: title (ej: Calendario Escolar 2026 — Región Metropolitana)
     M: description (texto meta)
     N: priority (ej: 0.9)

   Estructura del tab "Config":
     Fila 1: headers (KEY | VALUE | NOTAS)
     Filas 2-6:
       year         | 2026     |
       schoolStart  | 2026-03-02 | YYYY-MM-DD
       winterStart  | 2026-07-11 | YYYY-MM-DD
       winterEnd    | 2026-07-25 | YYYY-MM-DD
       schoolEnd    | 2026-12-12 | YYYY-MM-DD
     Fila 8: "FERIADOS" (marcador de sección)
     Fila 9: headers (DATE | NOMBRE)
     Filas 10+: feriados (ej: 2026-04-03 | Viernes Santo)
     (fin de feriados = fila vacía)
*/

var https = require('https');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

// ── Configuración ─────────────────────────────────────────────────────────
var config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
} catch (e) {
  console.error('sync-from-sheet: No se pudo leer config.json:', e.message);
  process.exit(1);
}

var SPREADSHEET_ID = config.sheet && config.sheet.spreadsheetId;
var REGIONS_TAB    = (config.sheet && config.sheet.regionsTab)    || 'Regiones';
var CONFIG_TAB     = (config.sheet && config.sheet.configTab)     || 'Config';
var API_KEY        = process.env.GOOGLE_API_KEY || (config.sheet && config.sheet.apiKey) || '';

if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PLACEHOLDER_SHEET_ID') {
  console.error('sync-from-sheet: config.json → sheet.spreadsheetId no configurado.');
  console.error('  Obtener el ID del Google Sheet y actualizar config.json.');
  process.exit(1);
}

if (!API_KEY) {
  console.error('sync-from-sheet: API key no encontrada.');
  console.error('  Configurar variable de entorno GOOGLE_API_KEY o config.json → sheet.apiKey');
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fetchSheet(tabName, callback) {
  var range = encodeURIComponent(tabName + '!A1:P50');
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID +
            '/values/' + range + '?key=' + API_KEY;

  var req = https.get(url, function (res) {
    var data = '';
    res.on('data', function (chunk) { data += chunk; });
    res.on('end', function () {
      try {
        var parsed = JSON.parse(data);
        if (parsed.error) {
          callback(new Error('Sheets API: ' + parsed.error.message + ' (code ' + parsed.error.code + ')'));
          return;
        }
        callback(null, parsed.values || []);
      } catch (e) {
        callback(new Error('Respuesta invalida de Sheets API: ' + e.message));
      }
    });
  });

  req.on('error', function (e) {
    callback(new Error('Error de red al leer Sheet: ' + e.message));
  });

  req.setTimeout(15000, function () {
    req.abort();
    callback(new Error('Timeout leyendo Sheet (15s)'));
  });
}

function cell(row, index) {
  return (row && row[index] !== undefined) ? String(row[index]).trim() : '';
}

// ── Parsear tab "Regiones" ─────────────────────────────────────────────────
function parseRegionsTab(rows) {
  if (!rows || rows.length < 2) throw new Error('Tab Regiones vacio o sin datos');

  // Fila 0 = headers, filas 1+ = datos
  var pages = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (!row || !cell(row, 0)) break; // Fila vacía = fin

    var slug = cell(row, 0);
    var regionSlug = cell(row, 2);

    if (!slug || !regionSlug) {
      console.warn('  Fila ' + (i + 1) + ' ignorada: slug o regionSlug vacio');
      continue;
    }

    pages.push({
      slug:                    slug,
      title:                   cell(row, 11),
      region:                  cell(row, 1),
      regionSlug:              regionSlug,
      inicio:                  cell(row, 3),
      vacacionesInicio:        cell(row, 4),
      vacacionesFin:           cell(row, 5),
      fiestasPatriasInicio:    cell(row, 6),
      fiestasPatriasFin:       cell(row, 7),
      finAno:                  cell(row, 8),
      diasVacacionesInvierno:  cell(row, 9),
      diasFiestasPatrias:      cell(row, 10),
      description:             cell(row, 12),
      priority:                cell(row, 13) || '0.8'
    });
  }

  if (pages.length !== 16) {
    throw new Error('Se esperan 16 regiones en el Sheet, se encontraron ' + pages.length);
  }

  return pages;
}

// ── Parsear tab "Config" ───────────────────────────────────────────────────
function parseConfigTab(rows) {
  if (!rows || rows.length < 2) throw new Error('Tab Config vacio o sin datos');

  var calConfig = {
    year: null,
    schoolStart: null,
    winterStart: null,
    winterEnd: null,
    schoolEnd: null,
    feriados: []
  };

  var inFeriados = false;
  var feriadoHeaderSeen = false;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!row) continue;

    var col0 = cell(row, 0).toLowerCase();
    var col1 = cell(row, 1);

    // Detectar sección de feriados
    if (col0 === 'feriados') {
      inFeriados = true;
      continue;
    }

    if (inFeriados) {
      if (!feriadoHeaderSeen) { feriadoHeaderSeen = true; continue; } // saltar header
      if (!col0 || !col1) break; // fin de feriados
      calConfig.feriados.push({ date: col0, nombre: col1 });
      continue;
    }

    // Claves de configuración
    switch (col0) {
      case 'year':        calConfig.year = parseInt(col1); break;
      case 'schoolstart': calConfig.schoolStart = col1; break;
      case 'winterstart': calConfig.winterStart = col1; break;
      case 'winterend':   calConfig.winterEnd = col1; break;
      case 'schoolend':   calConfig.schoolEnd = col1; break;
    }
  }

  // Validaciones básicas
  var required = ['year', 'schoolStart', 'winterStart', 'winterEnd', 'schoolEnd'];
  required.forEach(function (f) {
    if (!calConfig[f]) throw new Error('Tab Config: falta campo "' + f + '"');
  });

  return calConfig;
}

// ── Comparar y escribir si cambiaron ──────────────────────────────────────
function writeIfChanged(filePath, newData) {
  var newJson = JSON.stringify(newData, null, 2);
  var existingJson = '';
  try {
    existingJson = fs.readFileSync(filePath, 'utf8');
    // Normalizar: remover _comment para comparación limpia
    var existing = JSON.parse(existingJson);
    delete existing._comment;
    existingJson = JSON.stringify(existing, null, 2);
  } catch (e) { /* archivo no existe */ }

  if (newJson === existingJson) {
    console.log('  ' + path.basename(filePath) + ': sin cambios');
    return false;
  }

  fs.writeFileSync(filePath, newJson);
  console.log('  ' + path.basename(filePath) + ': ACTUALIZADO');
  return true;
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('\n=== Sync desde Google Sheet ===');
console.log('  Spreadsheet ID: ' + SPREADSHEET_ID);
console.log('  Tab regiones:   ' + REGIONS_TAB);
console.log('  Tab config:     ' + CONFIG_TAB);
console.log('');

var hasChanges = false;

// Fetch ambos tabs en paralelo
var regionsRows = null;
var configRows = null;
var errors = [];
var pending = 2;

function onTabFetched() {
  pending--;
  if (pending > 0) return;

  if (errors.length > 0) {
    errors.forEach(function (e) { console.error('  ERROR: ' + e); });
    process.exit(1);
  }

  try {
    // Parsear datos
    var pages = parseRegionsTab(regionsRows);
    var calConfig = parseConfigTab(configRows);

    console.log('  Leidas ' + pages.length + ' regiones + config (year: ' + calConfig.year + ', feriados: ' + calConfig.feriados.length + ')');
    console.log('');

    // Escribir si cambiaron
    if (writeIfChanged(path.join(ROOT, 'data', 'pages.json'), pages)) hasChanges = true;
    if (writeIfChanged(path.join(ROOT, 'data', 'calendar-config.json'), calConfig)) hasChanges = true;

    console.log('');
    if (hasChanges) {
      console.log('  Datos actualizados. Ejecutar: npm run generate');
      console.log('');
      process.exit(0);
    } else {
      console.log('  Datos ya al dia. Nada que hacer.');
      console.log('');
      process.exit(0);
    }

  } catch (e) {
    console.error('  ERROR al procesar datos del Sheet: ' + e.message);
    process.exit(1);
  }
}

fetchSheet(REGIONS_TAB, function (err, rows) {
  if (err) errors.push('Tab "' + REGIONS_TAB + '": ' + err.message);
  else regionsRows = rows;
  onTabFetched();
});

fetchSheet(CONFIG_TAB, function (err, rows) {
  if (err) errors.push('Tab "' + CONFIG_TAB + '": ' + err.message);
  else configRows = rows;
  onTabFetched();
});
