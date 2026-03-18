#!/usr/bin/env node
/**
 * extract-from-pdf.js — RAG pipeline v3: extracción fiel + catalogación
 *
 * FILOSOFIA: Extraer TODOS los hitos/fechas del documento tal como aparecen,
 * preservando las etiquetas originales. No mapear a nuestro esquema.
 * La interpretación y mapeo se hace DESPUÉS, con el catálogo completo.
 *
 * FASES:
 *   1. Descarga + texto (pdftotext con fallbacks)
 *   2. Pass A — Catálogo completo: extrae TODOS los hitos con etiquetas originales
 *   3. Pass B — Validación: verifica datos clave contra el texto
 *   4. Checks deterministas (fecha válida, año, día-semana, orden)
 *   5. Cross-region (quórum, outliers)
 *   6. Reporte + sugerencias de mapeo
 *
 * USAGE:
 *   node scripts/extract-from-pdf.js                  # auto-discovery
 *   node scripts/extract-from-pdf.js --local           # usar snapshots locales
 *   node scripts/extract-from-pdf.js --fix             # auto-corregir datos
 *   node scripts/extract-from-pdf.js --region=aysen    # solo una región
 *   node scripts/extract-from-pdf.js --force           # re-descargar PDFs
 */

'use strict';

var fs = require('fs');
var path = require('path');
var https = require('https');
var http = require('http');
var childProcess = require('child_process');

// ── Paths ────────────────────────────────────────────────────────────────────

var ROOT = path.resolve(__dirname, '..');
var SNAPSHOTS_DIR = path.join(ROOT, 'data', 'snapshots');
var CAL_CONFIG_PATH = path.join(ROOT, 'data', 'calendar-config.json');
var PAGES_PATH = path.join(ROOT, 'data', 'pages.json');
var AFIRMACIONES_PATH = path.join(ROOT, 'data', 'afirmaciones.json');
var REPORT_PATH = path.join(ROOT, 'data', 'pdf-extraction-report.json');

// ── Config ───────────────────────────────────────────────────────────────────

var DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
var DEEPSEEK_MODEL = 'deepseek-chat';
var MAX_PAGES_PER_CHUNK = 5;
var DEEPSEEK_TIMEOUT_MS = 60000;
var DELAY_MS = 2000;
var HTTP_TIMEOUT_MS = 30000;
var YEAR = 2026;

// ── Region Mapping ───────────────────────────────────────────────────────────

var REGION_MAP = {
  'arica y parinacota': 'arica-y-parinacota',
  'tarapaca': 'tarapaca', 'tarapacá': 'tarapaca',
  'antofagasta': 'antofagasta', 'atacama': 'atacama', 'coquimbo': 'coquimbo',
  'valparaiso': 'valparaiso', 'valparaíso': 'valparaiso',
  'metropolitana': 'metropolitana', 'metropolitana de santiago': 'metropolitana',
  'region metropolitana': 'metropolitana',
  "o'higgins": 'ohiggins', 'ohiggins': 'ohiggins',
  "libertador general bernardo o'higgins": 'ohiggins',
  'maule': 'maule', 'nuble': 'nuble', 'ñuble': 'nuble',
  'biobio': 'biobio', 'biobío': 'biobio',
  'araucania': 'araucania', 'la araucania': 'araucania', 'la araucanía': 'araucania',
  'los rios': 'los-rios', 'los ríos': 'los-rios', 'los lagos': 'los-lagos',
  'aysen': 'aysen', 'aysén': 'aysen',
  'magallanes': 'magallanes', 'magallanes y de la antartica chilena': 'magallanes',
  'magallanes y de la antártica chilena': 'magallanes'
};

var MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ── CLI ──────────────────────────────────────────────────────────────────────

var args = process.argv.slice(2);
var FLAG_LOCAL = args.indexOf('--local') !== -1;
var FLAG_FIX = args.indexOf('--fix') !== -1;
var FLAG_FORCE = args.indexOf('--force') !== -1;
var FLAG_REGION = null;
args.forEach(function (a) { if (a.indexOf('--region=') === 0) FLAG_REGION = a.split('=')[1]; });

// ── Load Data ────────────────────────────────────────────────────────────────

var calConfig = JSON.parse(fs.readFileSync(CAL_CONFIG_PATH, 'utf8'));
var pages = JSON.parse(fs.readFileSync(PAGES_PATH, 'utf8'));
var afirmaciones = JSON.parse(fs.readFileSync(AFIRMACIONES_PATH, 'utf8'));

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function normalizeStr(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resolveSlug(text) {
  var norm = normalizeStr(text);
  var keys = Object.keys(REGION_MAP);
  for (var i = 0; i < keys.length; i++) {
    if (norm.indexOf(normalizeStr(keys[i])) !== -1) return REGION_MAP[keys[i]];
  }
  return null;
}

function isoToSpanish(iso) {
  if (!iso) return null;
  var p = iso.split('-');
  return parseInt(p[2], 10) + ' de ' + MONTHS_ES[parseInt(p[1], 10) - 1];
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

function fetchUrl(url, opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    var maxRedir = opts.maxRedirects || 5;
    function go(u, n) {
      if (n > maxRedir) return reject(new Error('Too many redirects'));
      var mod = u.indexOf('https') === 0 ? https : http;
      var parsed = new URL(u);
      var req = mod.request({
        hostname: parsed.hostname, port: parsed.port,
        path: parsed.pathname + parsed.search, method: 'GET',
        headers: { 'User-Agent': 'CalendarioEscolar-RAG/3.0' },
        timeout: opts.timeout || HTTP_TIMEOUT_MS
      }, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          var loc = res.headers.location;
          if (loc.indexOf('http') !== 0) loc = parsed.protocol + '//' + parsed.host + loc;
          res.resume(); return go(loc, n + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        var chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
          var buf = Buffer.concat(chunks);
          resolve(opts.binary ? buf : buf.toString('utf8'));
        });
      });
      req.on('error', reject);
      req.on('timeout', function () { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    }
    go(url, 0);
  });
}

function callDeepSeek(messages, maxTokens) {
  return new Promise(function (resolve, reject) {
    var body = JSON.stringify({
      model: DEEPSEEK_MODEL, messages: messages,
      temperature: 0.1, max_tokens: maxTokens || 4000
    });
    var req = https.request({
      hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: DEEPSEEK_TIMEOUT_MS
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8');
        try {
          var parsed = JSON.parse(raw);
          if (parsed.choices && parsed.choices[0]) resolve(parsed.choices[0].message.content);
          else reject(new Error('No choices: ' + raw.slice(0, 300)));
        } catch (e) { reject(new Error('JSON parse: ' + raw.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', function () { req.destroy(); reject(new Error('DeepSeek timeout')); });
    req.write(body); req.end();
  });
}

function parseJson(content) {
  var cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) { return null; }
}

// ── Tool Detection ───────────────────────────────────────────────────────────

function hasCommand(cmd) {
  try {
    childProcess.execSync('which ' + cmd + ' 2>/dev/null || where ' + cmd + ' 2>nul',
      { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
    return true;
  } catch (e) { return false; }
}

var HAS_PDFTOTEXT = hasCommand('pdftotext');
var HAS_PDFTOPPM = hasCommand('pdftoppm');
var HAS_TESSERACT = hasCommand('tesseract');
var HAS_OCR = HAS_PDFTOPPM && HAS_TESSERACT;

// ── PDF Text Extraction ─────────────────────────────────────────────────────

function extractText(pdfPath) {
  // Intento 1: pdftotext (3 modos)
  if (HAS_PDFTOTEXT) {
    var modes = [['-layout'], ['-raw'], []];
    for (var i = 0; i < modes.length; i++) {
      try {
        var cmd = 'pdftotext ' + modes[i].concat(['"' + pdfPath + '"', '-']).join(' ');
        var result = childProcess.execSync(cmd, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 60000 });
        if (result && result.trim().length > 100) return result;
      } catch (e) { /* next */ }
    }
  }

  // Intento 2: OCR (pdftoppm → tesseract)
  if (HAS_OCR) {
    console.log('      pdftotext fallo, intentando OCR (pdftoppm + tesseract)...');
    return extractTextOCR(pdfPath);
  }

  return '';
}

/**
 * OCR fallback: convierte PDF a imágenes PNG y luego OCR con tesseract.
 * Requiere: pdftoppm (poppler-utils) + tesseract-ocr + tesseract-ocr-spa
 */
function extractTextOCR(pdfPath) {
  var tmpDir = path.join(SNAPSHOTS_DIR, '_ocr_tmp_' + Date.now());
  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    // PDF → PNG (300 DPI para buena calidad OCR)
    childProcess.execSync(
      'pdftoppm -png -r 300 "' + pdfPath + '" "' + path.join(tmpDir, 'page') + '"',
      { timeout: 120000, stdio: 'pipe' }
    );

    // Obtener PNGs generados, ordenados
    var pngs = fs.readdirSync(tmpDir)
      .filter(function (f) { return f.endsWith('.png'); })
      .sort();

    if (pngs.length === 0) {
      console.log('      OCR: pdftoppm no genero imagenes');
      return '';
    }

    console.log('      OCR: ' + pngs.length + ' paginas convertidas a PNG');

    // Tesseract: cada PNG → texto (español)
    var allText = [];
    pngs.forEach(function (png, idx) {
      var pngPath = path.join(tmpDir, png);
      var txtBase = path.join(tmpDir, 'ocr_' + idx);
      try {
        childProcess.execSync(
          'tesseract "' + pngPath + '" "' + txtBase + '" -l spa --psm 6 2>/dev/null',
          { timeout: 60000, stdio: 'pipe' }
        );
        var txt = '';
        if (fs.existsSync(txtBase + '.txt')) {
          txt = fs.readFileSync(txtBase + '.txt', 'utf8');
        }
        allText.push(txt);
      } catch (e) {
        console.log('      OCR: tesseract fallo en pagina ' + (idx + 1));
      }
    });

    // Unir con form feed (mismo formato que pdftotext)
    var combined = allText.join('\f');
    console.log('      OCR: ' + combined.length + ' chars extraidos');
    return combined;
  } catch (e) {
    console.log('      OCR error: ' + e.message);
    return '';
  } finally {
    // Limpiar tmp
    try {
      var files = fs.readdirSync(tmpDir);
      files.forEach(function (f) { fs.unlinkSync(path.join(tmpDir, f)); });
      fs.rmdirSync(tmpDir);
    } catch (e) { /* ignore cleanup errors */ }
  }
}

function chunkText(text) {
  var pages = text.split('\f').filter(function (p) { return p.trim().length > 0; });
  if (pages.length === 0) return [{ text: text, pageStart: 1, pageEnd: 1 }];
  var chunks = [];
  for (var i = 0; i < pages.length; i += MAX_PAGES_PER_CHUNK) {
    chunks.push({
      text: pages.slice(i, i + MAX_PAGES_PER_CHUNK).join('\n\n--- PAGINA ---\n\n'),
      pageStart: i + 1,
      pageEnd: Math.min(i + MAX_PAGES_PER_CHUNK, pages.length)
    });
  }
  return chunks;
}

// ── Prompts ──────────────────────────────────────────────────────────────────

var CATALOG_SYSTEM = [
  'Eres un extractor de datos de resoluciones oficiales del Ministerio de Educacion de Chile.',
  'Tu tarea es extraer TODOS los hitos y fechas del documento, preservando las etiquetas ORIGINALES.',
  '',
  'REGLAS:',
  '1. Extrae CADA hito/fecha que aparezca en las tablas del documento.',
  '2. Preserva la etiqueta EXACTA del documento (no renombrar ni reinterpretar).',
  '3. Separa por regimen: "semestral" y "trimestral" son secciones DISTINTAS.',
  '4. Para rangos de fechas, incluye inicio y fin.',
  '5. Incluye notas o condiciones asociadas (ej: "sin clases", "semana 17").',
  '6. Si hay texto general fuera de tablas con informacion de fechas, incluyelo en "notas_generales".',
  '7. Responde SOLO con JSON valido, sin markdown ni texto adicional.'
].join('\n');

function buildCatalogPrompt(text, regionHint) {
  return [
    { role: 'system', content: CATALOG_SYSTEM },
    { role: 'user', content: [
      regionHint ? 'Region esperada: ' + regionHint : '',
      '',
      '=== TEXTO DEL DOCUMENTO ===',
      text,
      '=== FIN ===',
      '',
      'Extrae TODOS los hitos y fechas. Retorna JSON con esta estructura exacta:',
      '{',
      '  "region": "<nombre de la region>",',
      '  "year": 2026,',
      '  "semestral": [',
      '    {',
      '      "label": "<etiqueta EXACTA del documento>",',
      '      "date": "<YYYY-MM-DD si es fecha unica, null si es rango>",',
      '      "date_start": "<YYYY-MM-DD si es rango, null si es fecha unica>",',
      '      "date_end": "<YYYY-MM-DD si es rango, null si es fecha unica>",',
      '      "raw_text": "<texto original de la fecha tal como aparece>",',
      '      "day_of_week": "<dia de la semana si se menciona>",',
      '      "notes": "<condiciones o notas asociadas, o null>"',
      '    }',
      '  ],',
      '  "trimestral": [<misma estructura>],',
      '  "notas_generales": [',
      '    "<texto relevante fuera de las tablas, ej: condiciones especiales del receso>"',
      '  ],',
      '  "articulo_1": "<texto completo del articulo 1 sobre inicio/fin del año escolar>",',
      '  "confidence": 0.0-1.0',
      '}'
    ].join('\n') }
  ];
}

var VALIDATION_SYSTEM = [
  'Eres un verificador. Recibes datos extraidos y el texto original.',
  'Verifica que cada hito extraido coincida exactamente con el documento.',
  'Si un hito tiene la fecha equivocada o la etiqueta cambiada, marcalo INCORRECTO.',
  'Si faltan hitos que aparecen en el texto, listalos en "missing".',
  'Responde SOLO con JSON valido.'
].join('\n');

function buildValidationPrompt(catalog, text) {
  var items = [];
  if (catalog.semestral) {
    catalog.semestral.forEach(function (h, i) {
      items.push('SEM[' + i + '] "' + h.label + '": ' + (h.raw_text || h.date || '?'));
    });
  }
  if (catalog.trimestral) {
    catalog.trimestral.forEach(function (h, i) {
      items.push('TRI[' + i + '] "' + h.label + '": ' + (h.raw_text || h.date || '?'));
    });
  }

  return [
    { role: 'system', content: VALIDATION_SYSTEM },
    { role: 'user', content: [
      '=== DATOS EXTRAIDOS ===',
      items.join('\n'),
      '',
      '=== TEXTO ORIGINAL ===',
      text,
      '=== FIN ===',
      '',
      'Retorna JSON:',
      '{',
      '  "corrections": [',
      '    {"ref": "SEM[0]", "issue": "fecha incorrecta", "correct_date": "YYYY-MM-DD", "correct_raw": "..."}',
      '  ],',
      '  "missing": [',
      '    {"regime": "semestral", "label": "...", "date": "...", "raw_text": "..."}',
      '  ],',
      '  "all_correct": true/false',
      '}'
    ].join('\n') }
  ];
}

// ── Discovery ────────────────────────────────────────────────────────────────

function discoverPdfs(indexUrl) {
  return fetchUrl(indexUrl).then(function (html) {
    var links = [];
    var regex = /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([^<]*)<\/a>/gi;
    var match;
    while ((match = regex.exec(html)) !== null) {
      var url = match[1].indexOf('http') === 0 ? match[1] : 'https://www.mineduc.cl' + match[1];
      var slug = resolveSlug(match[2] + ' ' + url);
      if (slug) links.push({ url: url, regionSlug: slug });
    }
    var seen = {};
    links = links.filter(function (l) { if (seen[l.regionSlug]) return false; seen[l.regionSlug] = true; return true; });
    console.log('  ' + links.length + ' PDFs regionales encontrados');
    return links;
  });
}

function discoverLocal() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) { fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true }); return []; }
  var files = fs.readdirSync(SNAPSHOTS_DIR);
  var byRegion = {};
  files.forEach(function (f) {
    var ext = path.extname(f).toLowerCase();
    if (ext !== '.pdf' && ext !== '.txt') return;
    var slug = resolveSlug(path.basename(f, ext));
    if (!slug) return;
    if (!byRegion[slug] || ext === '.txt') byRegion[slug] = { filePath: path.join(SNAPSHOTS_DIR, f), type: ext.slice(1), regionSlug: slug };
  });
  return Object.keys(byRegion).map(function (k) { return byRegion[k]; });
}

function downloadPdf(url, destPath) {
  if (!FLAG_FORCE && fs.existsSync(destPath)) return Promise.resolve(destPath);
  console.log('  Descargando: ' + url.slice(0, 80) + '...');
  return fetchUrl(url, { binary: true, timeout: 60000 }).then(function (data) {
    if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    fs.writeFileSync(destPath, data);
    return destPath;
  });
}

// ── Extraction Pipeline ──────────────────────────────────────────────────────

function extractRegion(source) {
  var slug = source.regionSlug;
  var text;

  if (source.type === 'txt') {
    text = fs.readFileSync(source.filePath, 'utf8');
  } else {
    text = extractText(source.filePath);
    if (!text || text.trim().length < 200) {
      var method = HAS_OCR ? 'pdftotext + OCR fallback' : 'pdftotext (sin OCR disponible)';
      return Promise.resolve({ regionSlug: slug, status: 'text_extraction_failed', catalog: null,
        error: 'No se pudo extraer texto via ' + method });
    }
    fs.writeFileSync(source.filePath.replace(/\.pdf$/i, '.txt'), text, 'utf8');
  }

  var chunks = chunkText(text);
  // Usar primeros 3 chunks (donde están las tablas de fechas)
  var headText = chunks.slice(0, 3).map(function (c) { return c.text; }).join('\n\n--- SECCION ---\n\n');
  if (headText.length > 35000) headText = headText.slice(0, 35000);

  var result = { regionSlug: slug, status: 'ok', totalPages: 0, catalog: null, validation: null, checks: [] };
  result.totalPages = chunks.reduce(function (m, c) { return Math.max(m, c.pageEnd); }, 0);

  // Pass A: Catálogo completo
  console.log('    [CATALOG] Extrayendo todos los hitos...');
  return callDeepSeek(buildCatalogPrompt(headText, slug), 4000)
    .then(function (resp) {
      result.catalog = parseJson(resp);
      if (result.catalog) {
        var nSem = (result.catalog.semestral || []).length;
        var nTri = (result.catalog.trimestral || []).length;
        console.log('      ' + nSem + ' hitos semestral, ' + nTri + ' hitos trimestral');
        (result.catalog.semestral || []).forEach(function (h) {
          console.log('        SEM: ' + h.label + ' → ' + (h.raw_text || h.date || '?'));
        });
        (result.catalog.trimestral || []).forEach(function (h) {
          console.log('        TRI: ' + h.label + ' → ' + (h.raw_text || h.date || '?'));
        });
        if (result.catalog.notas_generales && result.catalog.notas_generales.length) {
          result.catalog.notas_generales.forEach(function (n) {
            console.log('        NOTA: ' + n.slice(0, 120));
          });
        }
      }
      return sleep(DELAY_MS);
    })
    .catch(function (e) { console.log('      ERROR catalog: ' + e.message); return sleep(DELAY_MS); })

    // Pass B: Validación
    .then(function () {
      if (!result.catalog) return;
      console.log('    [VALIDATE] Verificando contra texto...');
      return callDeepSeek(buildValidationPrompt(result.catalog, headText), 2000);
    })
    .then(function (resp) {
      if (!resp) return;
      result.validation = parseJson(resp);
      if (result.validation) {
        if (result.validation.all_correct) {
          console.log('      Todos los hitos confirmados');
        }
        if (result.validation.corrections && result.validation.corrections.length) {
          console.log('      ' + result.validation.corrections.length + ' correcciones:');
          result.validation.corrections.forEach(function (c) {
            console.log('        ' + c.ref + ': ' + c.issue + ' → ' + (c.correct_date || c.correct_raw || '?'));
            applyCorrection(result.catalog, c);
          });
        }
        if (result.validation.missing && result.validation.missing.length) {
          console.log('      ' + result.validation.missing.length + ' hitos faltantes:');
          result.validation.missing.forEach(function (m) {
            console.log('        +' + m.regime + ': ' + m.label + ' → ' + (m.raw_text || m.date));
            addMissing(result.catalog, m);
          });
        }
      }
      return sleep(DELAY_MS);
    })
    .catch(function (e) { console.log('      WARN validate: ' + e.message); return sleep(DELAY_MS); })

    // Deterministic checks
    .then(function () {
      if (result.catalog) result.checks = runChecks(result.catalog);
      return result;
    });
}

function applyCorrection(catalog, correction) {
  var match = (correction.ref || '').match(/^(SEM|TRI)\[(\d+)\]$/);
  if (!match) return;
  var arr = match[1] === 'SEM' ? catalog.semestral : catalog.trimestral;
  var idx = parseInt(match[2], 10);
  if (!arr || !arr[idx]) return;
  if (correction.correct_date) arr[idx].date = correction.correct_date;
  if (correction.correct_raw) arr[idx].raw_text = correction.correct_raw;
  if (correction.correct_date_start) arr[idx].date_start = correction.correct_date_start;
  if (correction.correct_date_end) arr[idx].date_end = correction.correct_date_end;
}

function addMissing(catalog, item) {
  var arr = item.regime === 'trimestral' ? catalog.trimestral : catalog.semestral;
  if (!arr) { if (item.regime === 'trimestral') catalog.trimestral = []; else catalog.semestral = []; arr = item.regime === 'trimestral' ? catalog.trimestral : catalog.semestral; }
  arr.push({ label: item.label, date: item.date || null, date_start: item.date_start || null, date_end: item.date_end || null, raw_text: item.raw_text || null, notes: 'added by validation pass' });
}

// ── Deterministic Checks ─────────────────────────────────────────────────────

function runChecks(catalog) {
  var checks = [];
  function check(pass, msg) { checks.push({ pass: pass, message: msg }); }

  (catalog.semestral || []).concat(catalog.trimestral || []).forEach(function (h) {
    var dates = [h.date, h.date_start, h.date_end].filter(Boolean);
    dates.forEach(function (d) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        check(false, h.label + ': formato fecha invalido "' + d + '"');
      } else if (d.indexOf(String(YEAR)) !== 0) {
        check(false, h.label + ': año incorrecto "' + d + '"');
      }
    });
    if (h.date_start && h.date_end && h.date_start > h.date_end) {
      check(false, h.label + ': rango invertido ' + h.date_start + ' > ' + h.date_end);
    }
  });

  // Verificar día de semana si se menciona
  var dayMap = { 'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6, 'domingo': 0 };
  (catalog.semestral || []).forEach(function (h) {
    if (!h.day_of_week || !h.date) return;
    var expected = dayMap[normalizeStr(h.day_of_week)];
    if (expected === undefined) return;
    var actual = new Date(h.date + 'T00:00:00').getDay();
    if (actual !== expected) {
      check(false, h.label + ': dice ' + h.day_of_week + ' pero ' + h.date + ' es ' +
        Object.keys(dayMap).find(function (k) { return dayMap[k] === actual; }));
    }
  });

  return checks;
}

// ── Cross-Region ─────────────────────────────────────────────────────────────

function crossRegion(allResults) {
  console.log('\n=== Analisis Cross-Region ===\n');

  // Agrupar por etiqueta normalizada
  var labelGroups = {};
  allResults.forEach(function (r) {
    if (!r.catalog || !r.catalog.semestral) return;
    r.catalog.semestral.forEach(function (h) {
      var key = normalizeStr(h.label).replace(/\s+/g, ' ').trim();
      if (!labelGroups[key]) labelGroups[key] = [];
      labelGroups[key].push({
        region: r.regionSlug,
        date: h.date || h.date_start || null,
        date_end: h.date_end || null,
        raw: h.raw_text
      });
    });
  });

  // Mostrar agrupados
  var totalRegions = allResults.filter(function (r) { return r.status === 'ok'; }).length;
  Object.keys(labelGroups).sort().forEach(function (key) {
    var entries = labelGroups[key];
    if (entries.length < 2) return; // Skip unique labels

    // Agrupar por valor
    var byValue = {};
    entries.forEach(function (e) {
      var v = e.date || e.raw || '?';
      if (!byValue[v]) byValue[v] = [];
      byValue[v].push(e.region);
    });

    var values = Object.keys(byValue).sort(function (a, b) { return byValue[b].length - byValue[a].length; });
    if (values.length <= 1) {
      // Unanimidad
      console.log('  ✓ ' + key);
      console.log('    → ' + values[0] + ' (' + byValue[values[0]].length + '/' + totalRegions + ')');
    } else {
      // Discrepancia
      console.log('  ⚠ ' + key);
      values.forEach(function (v) {
        var isMinority = byValue[v].length < byValue[values[0]].length;
        console.log('    ' + (isMinority ? '⚠' : '✓') + ' ' + v + ' (' + byValue[v].length + '): ' + byValue[v].join(', '));
      });
    }
  });

  return labelGroups;
}

// ── Mapping Suggestions ──────────────────────────────────────────────────────

function suggestMapping(allResults) {
  console.log('\n=== Sugerencias de Mapeo a Fuente de Verdad ===\n');

  var mappings = [
    { target: 'inicio (pages.json)', labelHints: ['ingreso de estudiantes', 'ingreso de estudiantes nt'] },
    { target: 'vacacionesInicio (pages.json)', labelHints: ['receso de invierno regimen semestral', 'receso de invierno semestral'] },
    { target: 'vacacionesFin (pages.json)', labelHints: ['receso de invierno regimen semestral', 'receso de invierno semestral'] },
    { target: 'fiestasPatriasInicio (pages.json)', labelHints: ['receso fiestas patrias', 'vacaciones fiestas patrias'] },
    { target: 'finAno (pages.json)', labelHints: ['ultimo dia de clases establecimientos con jec', 'ultimo dia de clases jec'] },
    { target: 'winterStart (calendar-config)', labelHints: ['receso de invierno regimen semestral', 'receso de invierno semestral'] },
    { target: 'winterEnd (calendar-config)', labelHints: ['receso de invierno regimen semestral', 'receso de invierno semestral'] },
    { target: 'schoolStart (calendar-config)', labelHints: ['inicio del ano escolar'] },
    { target: 'schoolEnd (calendar-config)', labelHints: ['ultimo dia de clases establecimientos con jec', 'ultimo dia de clases jec'] }
  ];

  mappings.forEach(function (m) {
    console.log('  ' + m.target + ':');
    var found = false;

    allResults.forEach(function (r) {
      if (!r.catalog || !r.catalog.semestral) return;
      r.catalog.semestral.forEach(function (h) {
        var norm = normalizeStr(h.label);
        var match = m.labelHints.some(function (hint) { return norm.indexOf(normalizeStr(hint)) !== -1; });
        if (!match) return;
        found = true;

        var isRange = m.target.indexOf('Inicio') !== -1 || m.target.indexOf('Start') !== -1 || m.target.indexOf('winterStart') !== -1;
        var isEnd = m.target.indexOf('Fin') !== -1 || m.target.indexOf('End') !== -1 || m.target.indexOf('winterEnd') !== -1;
        var value;
        if (isRange && h.date_start) value = h.date_start;
        else if (isEnd && h.date_end) value = h.date_end;
        else value = h.date || h.date_start || '?';

        console.log('    ' + r.regionSlug + ': "' + h.label + '" → ' + (h.raw_text || value));
      });
    });

    if (!found) console.log('    (no se encontro hito correspondiente)');
    console.log('');
  });
}

// ── Report ───────────────────────────────────────────────────────────────────

function generateReport(allResults, labelGroups) {
  var report = {
    generated_at: new Date().toISOString(),
    pipeline_version: '3.0 (catalog-first)',
    summary: {
      regions_ok: allResults.filter(function (r) { return r.status === 'ok'; }).length,
      regions_failed: allResults.filter(function (r) { return r.status !== 'ok'; }).length,
      failed_regions: allResults.filter(function (r) { return r.status !== 'ok'; }).map(function (r) { return r.regionSlug; })
    },
    catalogs: allResults.map(function (r) {
      return {
        regionSlug: r.regionSlug, status: r.status,
        totalPages: r.totalPages,
        catalog: r.catalog,
        validation: r.validation,
        checks: r.checks
      };
    }),
    cross_region: labelGroups
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  return report;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== RAG Pipeline v3.0 — Catalog-First Extraction ===');
  console.log('Modo: ' + (FLAG_LOCAL ? 'local' : 'auto-discovery'));
  console.log('DeepSeek: ' + (DEEPSEEK_API_KEY ? 'OK' : 'FALTA'));
  console.log('Tools: pdftotext=' + (HAS_PDFTOTEXT ? 'OK' : 'NO') +
    ' pdftoppm=' + (HAS_PDFTOPPM ? 'OK' : 'NO') +
    ' tesseract=' + (HAS_TESSERACT ? 'OK' : 'NO') +
    ' OCR=' + (HAS_OCR ? 'OK' : 'NO'));
  if (!HAS_PDFTOTEXT && !HAS_OCR) {
    console.log('WARN: Sin pdftotext ni OCR. PDFs escaneados no podran ser procesados.');
    console.log('  Instalar: apt-get install poppler-utils tesseract-ocr tesseract-ocr-spa');
    console.log('  O en Windows: choco install poppler tesseract');
  }
  console.log('');

  if (!DEEPSEEK_API_KEY) { console.log('ERROR: DEEPSEEK_API_KEY requerida.'); process.exit(1); }

  var sourcesP;
  if (FLAG_LOCAL) {
    var local = discoverLocal();
    console.log('  ' + local.length + ' archivos locales');
    if (local.length === 0) { console.log('Sin archivos. Coloca PDFs/TXTs en data/snapshots/'); process.exit(0); }
    sourcesP = Promise.resolve(local);
  } else {
    var mineduc = afirmaciones.sources['mineduc-resolucion-2026'];
    if (!mineduc || !mineduc.url) { console.log('ERROR: URL Mineduc no encontrada'); process.exit(1); }
    console.log('Indice: ' + mineduc.url);
    sourcesP = discoverPdfs(mineduc.url).then(function (links) {
      function dlNext(i, res) {
        if (i >= links.length) return Promise.resolve(res);
        var l = links[i];
        if (FLAG_REGION && l.regionSlug !== FLAG_REGION) return dlNext(i + 1, res);
        var dest = path.join(SNAPSHOTS_DIR, 'mineduc-' + l.regionSlug + '.pdf');
        return downloadPdf(l.url, dest).then(function (p) {
          res.push({ filePath: p, type: 'pdf', regionSlug: l.regionSlug });
          return sleep(500);
        }).catch(function (e) { console.log('  ERROR: ' + e.message); }).then(function () { return dlNext(i + 1, res); });
      }
      return dlNext(0, []);
    });
  }

  sourcesP.then(function (sources) {
    if (FLAG_REGION) sources = sources.filter(function (s) { return s.regionSlug === FLAG_REGION; });
    console.log('\n' + sources.length + ' regiones a procesar (2 calls/region)\n');

    var allResults = [];
    function processNext(i) {
      if (i >= sources.length) return Promise.resolve(allResults);
      console.log('\n── [' + (i + 1) + '/' + sources.length + '] ' + sources[i].regionSlug + ' ──');
      return extractRegion(sources[i]).then(function (r) { allResults.push(r); return processNext(i + 1); });
    }
    return processNext(0);
  }).then(function (allResults) {
    var labelGroups = crossRegion(allResults);
    suggestMapping(allResults);

    // Failed regions
    var failed = allResults.filter(function (r) { return r.status !== 'ok'; });
    if (failed.length) {
      console.log('=== Regiones sin texto extraible ===');
      failed.forEach(function (r) { console.log('  ⚠ ' + r.regionSlug); });
      console.log('  (PDFs probablemente escaneados como imagen)\n');
    }

    var report = generateReport(allResults, labelGroups);
    console.log('Reporte completo: data/pdf-extraction-report.json');

    var ok = allResults.filter(function (r) { return r.status === 'ok'; }).length;
    process.exit(ok > 0 ? 0 : 2);
  }).catch(function (e) {
    console.error('ERROR: ' + e.message);
    process.exit(2);
  });
}

main();
