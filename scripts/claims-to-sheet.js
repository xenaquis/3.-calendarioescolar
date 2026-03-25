#!/usr/bin/env node
/* claims-to-sheet.js — Escribe claims.json + datos regionales + config a la pestana "Datos" del Google Sheet.
   Sin dependencias npm. Usa modulos nativos https y crypto de Node.js.

   Requiere:
     - GOOGLE_SERVICE_ACCOUNT_KEY: JSON string o ruta a archivo .json con las credenciales del service account
     - config.json -> sheet.spreadsheetId

   Uso:
     node scripts/claims-to-sheet.js           # Escribe al Sheet
     node scripts/claims-to-sheet.js --dry-run  # Muestra datos sin escribir
*/

var https = require('https');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '..');

// ── Configuracion ──────────────────────────────────────────────────────────
var config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
} catch (e) {
  console.error('claims-to-sheet: No se pudo leer config.json:', e.message);
  process.exit(1);
}

var SPREADSHEET_ID = config.sheet && config.sheet.spreadsheetId;
var DATOS_TAB      = (config.sheet && config.sheet.datosTab) || 'Datos';
var DRY_RUN        = process.argv.indexOf('--dry-run') !== -1;

if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PLACEHOLDER_SHEET_ID') {
  console.error('claims-to-sheet: config.json -> sheet.spreadsheetId no configurado.');
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function hashRespuesta(text) {
  return crypto.createHash('sha256').update(text || '', 'utf8').digest('hex');
}

// ── JWT Auth ───────────────────────────────────────────────────────────────
function getAccessToken(serviceAccountKey, callback) {
  var clientEmail = serviceAccountKey.client_email;
  var privateKey  = serviceAccountKey.private_key;
  var tokenUri    = serviceAccountKey.token_uri || 'https://oauth2.googleapis.com/token';

  if (!clientEmail || !privateKey) {
    callback(new Error('Service account key must have client_email and private_key'));
    return;
  }

  var now = Math.floor(Date.now() / 1000);

  var header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claim  = base64url(JSON.stringify({
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600
  }));

  var signingInput = header + '.' + claim;

  var sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  var signature;
  try {
    signature = sign.sign(privateKey, 'base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) {
    callback(new Error('JWT signing failed: ' + e.message));
    return;
  }

  var jwt  = signingInput + '.' + signature;
  var body = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;

  var parsedUri = require('url').parse(tokenUri);
  var options = {
    hostname: parsedUri.hostname,
    path:     parsedUri.path,
    method:   'POST',
    headers: {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  var req = https.request(options, function (res) {
    var data = '';
    res.on('data', function (chunk) { data += chunk; });
    res.on('end', function () {
      try {
        var parsed = JSON.parse(data);
        if (parsed.error) {
          callback(new Error('Token error: ' + parsed.error + ' — ' + (parsed.error_description || '')));
          return;
        }
        if (!parsed.access_token) {
          callback(new Error('No access_token in response: ' + data));
          return;
        }
        callback(null, parsed.access_token);
      } catch (e) {
        callback(new Error('Token response parse error: ' + e.message + ' | body: ' + data));
      }
    });
  });

  req.on('error', function (e) {
    callback(new Error('Token request error: ' + e.message));
  });

  req.setTimeout(15000, function () {
    req.abort();
    callback(new Error('Token request timeout (15s)'));
  });

  req.write(body);
  req.end();
}

// ── Data Transformation ────────────────────────────────────────────────────
function buildSheetData() {
  // Load source data files
  var claimsData, pagesData, calConfig;

  try {
    claimsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'claims.json'), 'utf8'));
  } catch (e) {
    throw new Error('No se pudo leer data/claims.json: ' + e.message);
  }

  try {
    pagesData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pages.json'), 'utf8'));
  } catch (e) {
    throw new Error('No se pudo leer data/pages.json: ' + e.message);
  }

  try {
    calConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'calendar-config.json'), 'utf8'));
  } catch (e) {
    throw new Error('No se pudo leer data/calendar-config.json: ' + e.message);
  }

  // Column headers (A through L)
  var headers = [
    'seccion',          // A
    'id',               // B
    'pregunta',         // C
    'respuesta',        // D
    'fuente_url',       // E
    'fuente_referencia',// F
    'extracto_verbatim',// G
    'hash_respuesta',   // H
    'hash_verbatim',    // I
    'last_checked',     // J
    'status',           // K
    'campo'             // L
  ];

  var rows = [];

  // ── CLAIMS section (50 rows) ──────────────────────────────────────────
  var claims = (claimsData.claims || []);
  var i;
  for (i = 0; i < claims.length; i++) {
    var c = claims[i];
    var respuesta = c.respuesta || '';
    rows.push([
      'CLAIMS',
      c.id || '',
      c.pregunta || '',
      respuesta,
      c.fuente_url || '',
      c.source_reference || '',
      c.extracto_verbatim || '',
      hashRespuesta(respuesta),
      c.hash_sha256 || '',
      c.last_checked || '',
      c.status || '',
      ''
    ]);
  }

  // ── REGION section (16 rows) ──────────────────────────────────────────
  var pages = pagesData || [];
  for (i = 0; i < pages.length; i++) {
    var region = pages[i];
    var regionJson = JSON.stringify(region);
    rows.push([
      'REGION',
      region.regionSlug || '',
      '',
      regionJson,
      '',
      '',
      '',
      hashRespuesta(regionJson),
      '',
      '',
      '',
      'datos_region'
    ]);
  }

  // ── CONFIG section ────────────────────────────────────────────────────
  var configKeys = ['year', 'schoolStart', 'winterStart', 'winterEnd', 'schoolEnd'];
  for (i = 0; i < configKeys.length; i++) {
    var key = configKeys[i];
    var val = String(calConfig[key] !== undefined ? calConfig[key] : '');
    rows.push([
      'CONFIG',
      key,
      '',
      val,
      '',
      '',
      '',
      hashRespuesta(val),
      '',
      '',
      '',
      key
    ]);
  }

  // Feriados array
  var feriadosJson = JSON.stringify(calConfig.feriados || []);
  rows.push([
    'CONFIG',
    'feriados',
    '',
    feriadosJson,
    '',
    '',
    '',
    hashRespuesta(feriadosJson),
    '',
    '',
    '',
    'feriados'
  ]);

  // FeriadosCompletos array
  var feriadosCompletosJson = JSON.stringify(calConfig.feriadosCompletos || []);
  rows.push([
    'CONFIG',
    'feriadosCompletos',
    '',
    feriadosCompletosJson,
    '',
    '',
    '',
    hashRespuesta(feriadosCompletosJson),
    '',
    '',
    '',
    'feriadosCompletos'
  ]);

  return { headers: headers, rows: rows, claimsCount: claims.length, regionsCount: pages.length };
}

// ── Sheet Write ────────────────────────────────────────────────────────────
function httpsRequest(options, body, callback) {
  var req = https.request(options, function (res) {
    var data = '';
    res.on('data', function (chunk) { data += chunk; });
    res.on('end', function () {
      try {
        var parsed = JSON.parse(data);
        callback(null, res.statusCode, parsed);
      } catch (e) {
        callback(new Error('Response parse error: ' + e.message + ' | status: ' + res.statusCode + ' | body: ' + data.slice(0, 200)));
      }
    });
  });

  req.on('error', function (e) {
    callback(new Error('Request error: ' + e.message));
  });

  req.setTimeout(30000, function () {
    req.abort();
    callback(new Error('Request timeout (30s)'));
  });

  if (body) {
    req.write(body);
  }
  req.end();
}

function addOrClearSheet(accessToken, callback) {
  // Try to add the "Datos" tab
  var addBody = JSON.stringify({
    requests: [{
      addSheet: {
        properties: { title: DATOS_TAB }
      }
    }]
  });

  var addOptions = {
    hostname: 'sheets.googleapis.com',
    path:     '/v4/spreadsheets/' + SPREADSHEET_ID + ':batchUpdate',
    method:   'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type':  'application/json',
      'Content-Length': Buffer.byteLength(addBody)
    }
  };

  httpsRequest(addOptions, addBody, function (err, statusCode, parsed) {
    if (err) {
      callback(err);
      return;
    }

    // If tab already exists (error 400 with ALREADY_EXISTS), clear it instead
    if (statusCode === 400 && parsed.error) {
      var msg = (parsed.error.message || '').toLowerCase();
      if (msg.indexOf('already exists') !== -1 || msg.indexOf('titulo ya existe') !== -1 ||
          msg.indexOf('same title') !== -1 || msg.indexOf('alreadyexists') !== -1 ||
          (parsed.error.status === 'INVALID_ARGUMENT')) {
        // Clear the existing sheet
        var clearPath = '/v4/spreadsheets/' + SPREADSHEET_ID + '/values/' +
                        encodeURIComponent(DATOS_TAB) + '!A1:Z1000:clear';
        var clearOptions = {
          hostname: 'sheets.googleapis.com',
          path:     clearPath,
          method:   'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type':  'application/json',
            'Content-Length': 0
          }
        };
        httpsRequest(clearOptions, '', function (err2, statusCode2, parsed2) {
          if (err2) {
            callback(err2);
            return;
          }
          if (statusCode2 >= 400) {
            callback(new Error('Clear sheet failed: ' + JSON.stringify(parsed2.error)));
            return;
          }
          console.log('  Pestana "' + DATOS_TAB + '" limpiada (ya existia).');
          callback(null);
        });
        return;
      }
      callback(new Error('addSheet error: ' + JSON.stringify(parsed.error)));
      return;
    }

    if (statusCode >= 400) {
      callback(new Error('addSheet failed (status ' + statusCode + '): ' + JSON.stringify(parsed.error)));
      return;
    }

    console.log('  Pestana "' + DATOS_TAB + '" creada.');
    callback(null);
  });
}

function writeToSheet(accessToken, sheetData, callback) {
  addOrClearSheet(accessToken, function (err) {
    if (err) {
      callback(err);
      return;
    }

    // Build data matrix: headers row + data rows
    var matrix = [sheetData.headers].concat(sheetData.rows);
    var totalRows = matrix.length;

    var writeBody = JSON.stringify({
      values: matrix
    });

    var rangePath = encodeURIComponent(DATOS_TAB + '!A1:L' + totalRows);
    var writePath = '/v4/spreadsheets/' + SPREADSHEET_ID + '/values/' +
                    rangePath + '?valueInputOption=RAW';

    var writeOptions = {
      hostname: 'sheets.googleapis.com',
      path:     writePath,
      method:   'PUT',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(writeBody)
      }
    };

    httpsRequest(writeOptions, writeBody, function (err2, statusCode2, parsed2) {
      if (err2) {
        callback(err2);
        return;
      }
      if (statusCode2 >= 400) {
        callback(new Error('Write values failed (status ' + statusCode2 + '): ' + JSON.stringify(parsed2.error)));
        return;
      }
      callback(null, parsed2.updatedCells || totalRows);
    });
  });
}

// ── Load service account key ───────────────────────────────────────────────
function loadServiceAccountKey() {
  var keyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyEnv) {
    console.error('claims-to-sheet: GOOGLE_SERVICE_ACCOUNT_KEY no encontrada.');
    console.error('  Opciones:');
    console.error('    1) export GOOGLE_SERVICE_ACCOUNT_KEY=\'{"client_email":"...","private_key":"...","token_uri":"https://oauth2.googleapis.com/token"}\'');
    console.error('    2) export GOOGLE_SERVICE_ACCOUNT_KEY=/ruta/al/service-account.json');
    process.exit(1);
  }

  // Try JSON.parse first
  try {
    return JSON.parse(keyEnv);
  } catch (e) {
    // Treat as file path
    try {
      var fileContent = fs.readFileSync(keyEnv, 'utf8');
      return JSON.parse(fileContent);
    } catch (e2) {
      console.error('claims-to-sheet: No se pudo parsear GOOGLE_SERVICE_ACCOUNT_KEY.');
      console.error('  Intento JSON: ' + e.message);
      console.error('  Intento archivo (' + keyEnv + '): ' + e2.message);
      process.exit(1);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('\n=== claims-to-sheet.js ===');
console.log('  Spreadsheet ID: ' + SPREADSHEET_ID);
console.log('  Pestana destino: ' + DATOS_TAB);
if (DRY_RUN) {
  console.log('  Modo: DRY RUN (no se escribira al Sheet)');
}
console.log('');

// Build data
var sheetData;
try {
  sheetData = buildSheetData();
} catch (e) {
  console.error('  ERROR al construir datos: ' + e.message);
  process.exit(1);
}

var configRowCount = 5 + 2; // 5 scalar keys + feriados + feriadosCompletos
var totalRows = sheetData.claimsCount + sheetData.regionsCount + configRowCount;

console.log('  Resumen de datos:');
console.log('    CLAIMS: ' + sheetData.claimsCount + ' filas');
console.log('    REGION: ' + sheetData.regionsCount + ' filas');
console.log('    CONFIG: ' + configRowCount + ' filas');
console.log('    TOTAL:  ' + totalRows + ' filas de datos + 1 fila de headers = ' + (totalRows + 1) + ' filas totales');
console.log('');

if (DRY_RUN) {
  // Show headers
  console.log('  Headers (columnas A-L):');
  console.log('    ' + sheetData.headers.join(' | '));
  console.log('');

  // Show first 5 rows as sample
  console.log('  Muestra — primeras 5 filas (seccion CLAIMS):');
  var sampleRows = sheetData.rows.slice(0, 5);
  for (var s = 0; s < sampleRows.length; s++) {
    var row = sampleRows[s];
    // Truncate long fields for display
    var display = row.map(function (cell) {
      var str = String(cell);
      return str.length > 50 ? str.slice(0, 47) + '...' : str;
    });
    console.log('    [' + (s + 1) + '] ' + display.join(' | '));
  }
  console.log('');

  // REGION section summary
  var regionRows = sheetData.rows.filter(function (r) { return r[0] === 'REGION'; });
  console.log('  Seccion REGION: ' + regionRows.length + ' filas');
  for (var r = 0; r < regionRows.length; r++) {
    console.log('    ' + regionRows[r][1] + ' (hash_respuesta: ' + regionRows[r][7].slice(0, 16) + '...)');
  }
  console.log('');

  // CONFIG section summary
  var configRows = sheetData.rows.filter(function (row) { return row[0] === 'CONFIG'; });
  console.log('  Seccion CONFIG: ' + configRows.length + ' filas');
  for (var cc = 0; cc < configRows.length; cc++) {
    var configVal = String(configRows[cc][3]);
    var configDisplay = configVal.length > 60 ? configVal.slice(0, 57) + '...' : configVal;
    console.log('    ' + configRows[cc][1] + ': ' + configDisplay);
  }
  console.log('');

  console.log('  Dry run completo. No se escribio al Sheet.');
  console.log('');
  process.exit(0);
}

// Live write — load credentials and authenticate
var serviceAccountKey = loadServiceAccountKey();

console.log('  Service account: ' + (serviceAccountKey.client_email || '(sin client_email)'));
console.log('  Obteniendo access token...');

getAccessToken(serviceAccountKey, function (err, accessToken) {
  if (err) {
    console.error('  ERROR al obtener access token: ' + err.message);
    process.exit(1);
  }

  console.log('  Token obtenido. Escribiendo al Sheet...');

  writeToSheet(accessToken, sheetData, function (err2, updatedCells) {
    if (err2) {
      console.error('  ERROR al escribir al Sheet: ' + err2.message);
      process.exit(1);
    }

    console.log('  Escritura completada.');
    console.log('  Celdas actualizadas: ~' + updatedCells);
    console.log('');
    console.log('  Pestana "' + DATOS_TAB + '" actualizada con:');
    console.log('    - ' + sheetData.claimsCount + ' claims (CLAIMS)');
    console.log('    - ' + sheetData.regionsCount + ' regiones (REGION)');
    console.log('    - ' + configRowCount + ' entradas de configuracion (CONFIG)');
    console.log('');
    console.log('  Ver: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID);
    console.log('');
    process.exit(0);
  });
});
