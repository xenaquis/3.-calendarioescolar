#!/usr/bin/env node
/* sync-from-sheet.js — Sincroniza datos desde Google Sheets → data/*.json
   Sin dependencias npm. Usa el módulo https nativo de Node.js.

   Requiere:
     - GOOGLE_API_KEY en variable de entorno (o config.json → sheet.apiKey)
     - config.json → sheet.spreadsheetId (ID del Google Sheet)

   Lee exclusivamente del tab "Datos" (config.json → sheet.datosTab).
   El tab "Datos" tiene 12 columnas y hasta ~74 filas (1 header + secciones):

   Headers (fila 1):
     A: seccion | B: id | C: pregunta | D: respuesta | E: fuente_url
     F: fuente_referencia | G: extracto_verbatim | H: hash_respuesta
     I: hash_verbatim | J: last_checked | K: status | L: campo

   Secciones (detectadas por col A):
     CLAIMS (50 filas): claims factuales del sitio
       B=claim-id, C=pregunta, D=respuesta, E=fuente_url, F=fuente_referencia,
       G=extracto_verbatim, I=hash_verbatim, J=last_checked, K=status
     REGION (16 filas): datos completos de cada región
       B=regionSlug, D=JSON.stringify(region object completo), L=datos_region
     CONFIG (5+2 filas): configuración del año escolar
       B=key-name, D=value, L=key-name
       Keys: year, schoolStart, winterStart, winterEnd, schoolEnd,
             feriados (JSON array), feriadosCompletos (JSON array)

   Produce:
     - data/claims.json        (merge Sheet data into existing claims structure)
     - data/pages.json         (16 region objects)
     - data/calendar-config.json (year, school dates, feriados)

   Flags:
     --dry-run  Imprime resumen de lo leido pero no escribe archivos
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
var DATOS_TAB      = (config.sheet && config.sheet.datosTab) || 'Datos';
var API_KEY        = process.env.GOOGLE_API_KEY || (config.sheet && config.sheet.apiKey) || '';
var DRY_RUN        = process.argv.indexOf('--dry-run') !== -1;

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
  var range = encodeURIComponent(tabName + '!A1:L100');
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

// ── Parsear tab "Datos" ────────────────────────────────────────────────────
function parseDatosTab(rows) {
  if (!rows || rows.length < 2) throw new Error('Tab Datos vacio o sin datos');

  var claims = [];
  var pages = [];
  var calConfig = {
    year: null,
    schoolStart: null,
    winterStart: null,
    winterEnd: null,
    schoolEnd: null,
    feriados: [],
    feriadosCompletos: []
  };

  // Fila 0 = headers, filas 1+ = datos
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (!row || !cell(row, 0)) continue; // Fila vacía = ignorar

    var seccion = cell(row, 0).toUpperCase();

    if (seccion === 'CLAIMS') {
      claims.push({
        id:                 cell(row, 1),  // B: id
        pregunta:           cell(row, 2),  // C: pregunta
        respuesta:          cell(row, 3),  // D: respuesta
        fuente_url:         cell(row, 4),  // E: fuente_url
        source_reference:   cell(row, 5),  // F: fuente_referencia
        extracto_verbatim:  cell(row, 6) || null,  // G: extracto_verbatim
        hash_sha256:        cell(row, 8) || null,  // I: hash_verbatim
        last_checked:       cell(row, 9) || null,  // J: last_checked
        status:             cell(row, 10) || 'unverified' // K: status
      });

    } else if (seccion === 'REGION') {
      var regionJson = cell(row, 3); // D: respuesta (JSON stringified)
      if (!regionJson) {
        console.warn('  Fila ' + (i + 1) + ' REGION ignorada: respuesta vacia');
        continue;
      }
      try {
        var regionObj = JSON.parse(regionJson);
        pages.push(regionObj);
      } catch (e) {
        console.warn('  Fila ' + (i + 1) + ' REGION: error al parsear JSON de region "' + cell(row, 1) + '": ' + e.message);
      }

    } else if (seccion === 'CONFIG') {
      var key = cell(row, 1); // B: id (key name)
      var val = cell(row, 3); // D: respuesta (value)

      switch (key) {
        case 'year':
          calConfig.year = parseInt(val, 10);
          break;
        case 'schoolStart':
          calConfig.schoolStart = val;
          break;
        case 'winterStart':
          calConfig.winterStart = val;
          break;
        case 'winterEnd':
          calConfig.winterEnd = val;
          break;
        case 'schoolEnd':
          calConfig.schoolEnd = val;
          break;
        case 'feriados':
          try {
            calConfig.feriados = JSON.parse(val);
          } catch (e) {
            console.warn('  CONFIG feriados: error al parsear JSON: ' + e.message);
            calConfig.feriados = [];
          }
          break;
        case 'feriadosCompletos':
          try {
            calConfig.feriadosCompletos = JSON.parse(val);
          } catch (e) {
            console.warn('  CONFIG feriadosCompletos: error al parsear JSON: ' + e.message);
            calConfig.feriadosCompletos = [];
          }
          break;
      }
    }
  }

  // Validaciones
  if (pages.length !== 16) {
    throw new Error('Se esperan 16 regiones en la pestana Datos, se encontraron ' + pages.length);
  }

  if (claims.length === 0) {
    throw new Error('No se encontraron claims en la pestana Datos');
  }

  var required = ['year', 'schoolStart', 'winterStart', 'winterEnd', 'schoolEnd'];
  required.forEach(function (f) {
    if (!calConfig[f]) throw new Error('Tab Datos CONFIG: falta campo "' + f + '"');
  });

  return { claims: claims, pages: pages, calConfig: calConfig };
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

// ── Construir claims.json: merge Sheet data into existing structure ─────────
function buildClaimsOutput(sheetClaims) {
  // Leer claims.json existente para preservar _meta, sources y campos no editables
  var existingData = { _meta: {}, sources: {}, claims: [] };
  try {
    existingData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'claims.json'), 'utf8'));
  } catch (e) {
    console.warn('  claims.json no encontrado — se creara desde cero');
  }

  // Crear mapa de claims existentes por id
  var existingMap = {};
  var existingClaims = existingData.claims || [];
  for (var i = 0; i < existingClaims.length; i++) {
    existingMap[existingClaims[i].id] = existingClaims[i];
  }

  // Merge: Sheet data into existing claim objects
  var mergedClaims = [];
  for (var j = 0; j < sheetClaims.length; j++) {
    var sheetClaim = sheetClaims[j];
    var existing = existingMap[sheetClaim.id];

    if (existing) {
      // Actualizar campos editables desde Sheet, preservar el resto
      var merged = {};
      // Copiar todos los campos existentes primero
      var keys = Object.keys(existing);
      for (var k = 0; k < keys.length; k++) {
        merged[keys[k]] = existing[keys[k]];
      }
      // Sobreescribir con datos del Sheet
      merged.pregunta          = sheetClaim.pregunta          || existing.pregunta;
      merged.respuesta         = sheetClaim.respuesta         || existing.respuesta;
      merged.fuente_url        = sheetClaim.fuente_url        || existing.fuente_url;
      merged.source_reference  = sheetClaim.source_reference  || existing.source_reference;
      merged.extracto_verbatim = sheetClaim.extracto_verbatim !== null
                                   ? sheetClaim.extracto_verbatim
                                   : existing.extracto_verbatim;
      merged.hash_sha256       = sheetClaim.hash_sha256 !== null
                                   ? sheetClaim.hash_sha256
                                   : existing.hash_sha256;
      merged.last_checked      = sheetClaim.last_checked !== null
                                   ? sheetClaim.last_checked
                                   : existing.last_checked;
      merged.status            = sheetClaim.status || existing.status;
      mergedClaims.push(merged);
    } else {
      // Nueva claim no encontrada en existente — crear objeto mínimo
      mergedClaims.push({
        id:                 sheetClaim.id,
        tags:               [],
        pregunta:           sheetClaim.pregunta,
        respuesta:          sheetClaim.respuesta,
        fuente_url:         sheetClaim.fuente_url,
        source_reference:   sheetClaim.source_reference,
        extracto_verbatim:  sheetClaim.extracto_verbatim,
        hash_sha256:        sheetClaim.hash_sha256,
        last_checked:       sheetClaim.last_checked,
        status:             sheetClaim.status
      });
    }
  }

  return {
    _meta:    existingData._meta    || {},
    sources:  existingData.sources  || {},
    claims:   mergedClaims
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('\n=== Sync desde Google Sheet ===');
console.log('  Spreadsheet ID: ' + SPREADSHEET_ID);
console.log('  Tab datos:      ' + DATOS_TAB);
if (DRY_RUN) console.log('  MODO: --dry-run (no escribe archivos)');
console.log('');

var hasChanges = false;

fetchSheet(DATOS_TAB, function (err, rows) {
  if (err) {
    console.error('  ERROR al leer tab "' + DATOS_TAB + '": ' + err.message);
    process.exit(1);
  }

  try {
    var parsed = parseDatosTab(rows);
    var claims    = parsed.claims;
    var pages     = parsed.pages;
    var calConfig = parsed.calConfig;

    console.log('  Leidos ' + claims.length + ' claims + ' + pages.length + ' regiones + config (year: ' + calConfig.year + ', feriados: ' + calConfig.feriados.length + ')');
    console.log('');

    if (DRY_RUN) {
      console.log('  [dry-run] claims.json:          ' + claims.length + ' claims');
      console.log('  [dry-run] pages.json:           ' + pages.length + ' regiones');
      console.log('  [dry-run] calendar-config.json: year=' + calConfig.year +
                  ', schoolStart=' + calConfig.schoolStart +
                  ', feriados=' + calConfig.feriados.length +
                  ', feriadosCompletos=' + calConfig.feriadosCompletos.length);
      console.log('');
      console.log('  [dry-run] Sin escrituras. Saliendo.');
      console.log('');
      process.exit(0);
    }

    // Construir claims.json con merge
    var claimsOutput = buildClaimsOutput(claims);

    // Escribir si cambiaron
    if (writeIfChanged(path.join(ROOT, 'data', 'claims.json'), claimsOutput)) hasChanges = true;
    if (writeIfChanged(path.join(ROOT, 'data', 'pages.json'), pages)) hasChanges = true;
    if (writeIfChanged(path.join(ROOT, 'data', 'calendar-config.json'), calConfig)) hasChanges = true;

    console.log('');
    if (hasChanges) {
      console.log('  Datos actualizados. Ejecutar: npm run generate');
    } else {
      console.log('  Datos ya al dia. Nada que hacer.');
    }
    console.log('');
    process.exit(0);

  } catch (e) {
    console.error('  ERROR al procesar datos del Sheet: ' + e.message);
    process.exit(1);
  }
});
