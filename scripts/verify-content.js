#!/usr/bin/env node
/* verify-content.js — Verificacion de contenido contra fuentes oficiales
   Fase 3 del sistema de validacion robusto.

   Uso:
     DEEPSEEK_API_KEY=... node scripts/verify-content.js
     FORCE_ALL=true DEEPSEEK_API_KEY=... node scripts/verify-content.js

   Lee:
     - data/afirmaciones.json          (claims a verificar)
     - data/source-health.json         (estado de fuentes)
     - data/calendar-config.json       (datos del calendario)
     - data/pages.json                 (datos regionales)
     - data/verification-results.json  (resultados previos — cache)
     - data/snapshots/*.txt            (texto de PDFs)

   Genera:
     - data/verification-results.json  (resultados de verificacion)
     - data/verification-log.jsonl     (log de verificaciones IA para auditoria)

   Exit codes:
     0 = todo OK (CORRECTO, NO_VERIFICABLE, FUENTE_INACCESIBLE)
     1 = datos INCORRECTOS detectados (requiere accion)
*/

var fs = require('fs');
var path = require('path');
var https = require('https');
var http = require('http');

// ── Paths ────────────────────────────────────────────────────────────────────

var ROOT = path.join(__dirname, '..');
var AFIRMACIONES_PATH = path.join(ROOT, 'data', 'afirmaciones.json');
var SOURCE_HEALTH_PATH = path.join(ROOT, 'data', 'source-health.json');
var CAL_CONFIG_PATH = path.join(ROOT, 'data', 'calendar-config.json');
var PAGES_PATH = path.join(ROOT, 'data', 'pages.json');
var RESULTS_PATH = path.join(ROOT, 'data', 'verification-results.json');
var LOG_PATH = path.join(ROOT, 'data', 'verification-log.jsonl');

// ── Config ───────────────────────────────────────────────────────────────────

var DEEPSEEK_MODEL = 'deepseek-chat';
var DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
var FORCE_ALL = process.env.FORCE_ALL === 'true';
var MAX_DEEPSEEK_CALLS = 20;
var DEEPSEEK_TIMEOUT_MS = 30000;
var DELAY_BETWEEN_CALLS_MS = 1000;
var CONFIDENCE_THRESHOLD = 0.7;
var FETCH_TIMEOUT_MS = 15000;
var USER_AGENT = 'CalendarioEscolar-Verifier/1.0 (+https://calendarioescolar.cl)';

// ── Data Loading ─────────────────────────────────────────────────────────────

if (!fs.existsSync(AFIRMACIONES_PATH)) {
  console.log('ERROR: data/afirmaciones.json no existe');
  process.exit(1);
}

var afirmaciones = JSON.parse(fs.readFileSync(AFIRMACIONES_PATH, 'utf8'));
var sourceHealth = fs.existsSync(SOURCE_HEALTH_PATH)
  ? JSON.parse(fs.readFileSync(SOURCE_HEALTH_PATH, 'utf8'))
  : null;
var calConfig = JSON.parse(fs.readFileSync(CAL_CONFIG_PATH, 'utf8'));
var pages = JSON.parse(fs.readFileSync(PAGES_PATH, 'utf8'));
var previousResults = fs.existsSync(RESULTS_PATH)
  ? JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'))
  : null;

var MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ── Date Helpers ─────────────────────────────────────────────────────────────

/**
 * Easter date via Meeus/Jones/Butcher algorithm.
 */
function easterDate(year) {
  var a = year % 19;
  var b = Math.floor(year / 100);
  var c = year % 100;
  var d = Math.floor(b / 4);
  var e = b % 4;
  var f = Math.floor((b + 8) / 25);
  var g = Math.floor((b - f + 1) / 3);
  var h = (19 * a + b - d - g + 15) % 30;
  var i = Math.floor(c / 4);
  var k = c % 4;
  var l = (32 + 2 * e + 2 * i - h - k) % 7;
  var m = Math.floor((a + 11 * h + 22 * l) / 451);
  var month = Math.floor((h + l - 7 * m + 114) / 31);
  var day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, n) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function daysBetween(d1, d2) {
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

function dateToIso(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function isoToSpanish(isoDate) {
  var parts = isoDate.split('-');
  var day = parseInt(parts[2], 10);
  var month = MONTHS_ES[parseInt(parts[1], 10) - 1];
  return day + ' de ' + month + ' de ' + parts[0];
}

/**
 * Parsea "14 de septiembre" → Date(year, 8, 14)
 */
function spanishToDate(text, year) {
  var match = text.match(/(\d+)\s+de\s+(\w+)/);
  if (!match) return null;
  var day = parseInt(match[1], 10);
  var monthIdx = MONTHS_ES.indexOf(match[2].toLowerCase());
  if (monthIdx === -1) return null;
  return new Date(year, monthIdx, day);
}

function findFeriadoByDate(dateStr) {
  for (var i = 0; i < calConfig.feriadosCompletos.length; i++) {
    if (calConfig.feriadosCompletos[i].date === dateStr) {
      return calConfig.feriadosCompletos[i];
    }
  }
  return null;
}

// ── HTTP Fetch ───────────────────────────────────────────────────────────────

function fetchWithTimeout(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var startTime = Date.now();
    var mod = url.indexOf('https') === 0 ? https : http;

    var timer = setTimeout(function () {
      req.destroy();
      reject(new Error('Timeout despues de ' + timeoutMs + 'ms'));
    }, timeoutMs);

    var req = mod.get(url, { headers: { 'User-Agent': USER_AGENT } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        var newUrl = res.headers.location;
        if (newUrl.indexOf('//') === -1) {
          var parsed = new URL(url);
          newUrl = parsed.protocol + '//' + parsed.host + newUrl;
        }
        fetchWithTimeout(newUrl, timeoutMs - (Date.now() - startTime))
          .then(resolve).catch(reject);
        return;
      }

      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        clearTimeout(timer);
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8')
        });
      });
    });

    req.on('error', function (err) {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Source Content Extraction ─────────────────────────────────────────────────

function extractTextFromXml(xml) {
  return xml.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function extractStableContent(html) {
  var content = html;
  var mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    content = mainMatch[1];
  } else {
    var articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) content = articleMatch[1];
  }
  return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Obtiene el texto de una fuente segun su tier.
 * Tier 1 (BCN XML): fetch api_endpoint, strip XML tags.
 * Tier 2 (HTML): fetch URL, extract main/article.
 * Tier 3 (PDF): lee snapshot .txt local.
 */
function fetchSourceContent(source) {
  return new Promise(function (resolve) {
    // Tier 3: PDF — usar snapshot local .txt
    if (source.tier === 3) {
      if (!source.snapshot_local) { resolve(null); return; }
      var txtPath = path.join(ROOT, source.snapshot_local.replace(/\.pdf$/, '.txt'));
      if (fs.existsSync(txtPath)) {
        resolve(fs.readFileSync(txtPath, 'utf8'));
      } else {
        resolve(null);
      }
      return;
    }

    // Tier 1: BCN XML
    if (source.tier === 1 && source.api_endpoint) {
      fetchWithTimeout(source.api_endpoint, FETCH_TIMEOUT_MS)
        .then(function (res) {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve(extractTextFromXml(res.body));
          } else {
            resolve(null);
          }
        })
        .catch(function () { resolve(null); });
      return;
    }

    // Tier 2: HTML
    if (source.tier === 2 && source.url) {
      fetchWithTimeout(source.url, FETCH_TIMEOUT_MS)
        .then(function (res) {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve(extractStableContent(res.body));
          } else {
            resolve(null);
          }
        })
        .catch(function () { resolve(null); });
      return;
    }

    resolve(null);
  });
}

// ── Text Normalization (for quote validation) ────────────────────────────────

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Valida que una cita exista en el texto fuente.
 * Usa normalizacion (lowercase, sin acentos) y ventana deslizante con 80% overlap.
 */
function validateQuote(quote, sourceContent) {
  if (!quote) return true;

  var normQuote = normalizeText(quote);
  var normSource = normalizeText(sourceContent);

  // Match exacto despues de normalizacion
  if (normSource.indexOf(normQuote) !== -1) return true;

  // Fuzzy: ventana deslizante con 80% de palabras coincidentes
  var quoteWords = normQuote.split(' ').filter(function (w) { return w.length > 2; });
  if (quoteWords.length === 0) return false;

  var sourceWords = normSource.split(' ');
  var windowSize = Math.min(quoteWords.length * 2, sourceWords.length);

  for (var i = 0; i <= sourceWords.length - quoteWords.length; i++) {
    var windowText = sourceWords.slice(i, i + windowSize).join(' ');
    var matches = 0;
    for (var j = 0; j < quoteWords.length; j++) {
      if (windowText.indexOf(quoteWords[j]) !== -1) matches++;
    }
    if (matches / quoteWords.length >= 0.8) return true;
  }

  return false;
}

// ── Capa 1: Verificacion Determinista ────────────────────────────────────────

function verifyDeterministic(claim) {
  var id = claim.id;

  // Ano escolar
  if (id === 'ano-escolar') {
    var ok = calConfig.year === parseInt(claim.displayed_value, 10);
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'calendar-config.json year = ' + calConfig.year
        : 'Esperado: ' + claim.displayed_value + ', Actual: ' + calConfig.year
    };
  }

  // Total regiones
  if (id === 'total-regiones') {
    var ok = pages.length === parseInt(claim.displayed_value, 10);
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'pages.json tiene ' + pages.length + ' regiones'
        : 'Esperado: ' + claim.displayed_value + ', Actual: ' + pages.length
    };
  }

  // Total feriados
  if (id === 'total-feriados') {
    var ok = calConfig.feriadosCompletos.length === parseInt(claim.displayed_value, 10);
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'feriadosCompletos tiene ' + calConfig.feriadosCompletos.length + ' feriados'
        : 'Esperado: ' + claim.displayed_value + ', Actual: ' + calConfig.feriadosCompletos.length
    };
  }

  // Pascua 2026
  if (id === 'pascua-2026') {
    var easter = easterDate(calConfig.year);
    var easterIso = dateToIso(easter);
    var ok = easterIso === claim.displayed_value;
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'Pascua ' + calConfig.year + ' (Meeus/Jones/Butcher) = ' + easterIso
        : 'Esperado: ' + claim.displayed_value + ', Calculado: ' + easterIso
    };
  }

  // Corpus Christi movil (claim sin displayed_value, valida la regla)
  if (id === 'corpus-christi-movil') {
    var easter = easterDate(calConfig.year);
    var corpus = addDays(easter, 60);
    var corpusIso = dateToIso(corpus);
    var feriado = findFeriadoByDate(corpusIso);
    var ok = feriado !== null;
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'Pascua + 60 = ' + corpusIso + '. Encontrado en feriadosCompletos.'
        : 'Pascua + 60 = ' + corpusIso + '. NO encontrado en feriadosCompletos.'
    };
  }

  // San Pedro traslado 2026 (claim valida que no requiere traslado)
  if (id === 'san-pedro-traslado-2026') {
    var d = new Date(calConfig.year, 5, 29); // June 29
    var dow = d.getDay();
    var isWeekday = dow >= 1 && dow <= 5;
    return {
      verdict: isWeekday ? 'CORRECTO' : 'INCORRECTO',
      evidence: '29 junio ' + calConfig.year + ' = dia ' + dow +
        (isWeekday ? ' (dia habil, no requiere traslado)' : ' (fin de semana, requiere traslado)')
    };
  }

  // Inicio todas regiones — leer valor esperado desde datos, no hardcodear
  if (id === 'inicio-todas-regiones') {
    var expectedInicio = pages[0].inicio;
    var allSame = pages.every(function (p) { return p.inicio === expectedInicio; });
    return {
      verdict: allSame ? 'CORRECTO' : 'INCORRECTO',
      evidence: allSame
        ? 'Las ' + pages.length + ' regiones tienen inicio = "' + expectedInicio + '"'
        : 'No todas las regiones tienen el mismo inicio (esperado: "' + expectedInicio + '")'
    };
  }

  // Corpus Christi NO es feriado (suprimido — la fecha calculada debe estar AUSENTE)
  if (id === 'corpus-christi-no-feriado') {
    var easter = easterDate(calConfig.year);
    var cc = addDays(easter, 60);
    var ccIso = dateToIso(cc);
    var ok = ccIso === claim.displayed_value && findFeriadoByDate(ccIso) === null;
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'Pascua + 60 = ' + ccIso + '. Correctamente AUSENTE de feriadosCompletos (no es feriado vigente).'
        : 'Pascua + 60 = ' + ccIso + ', displayed=' + claim.displayed_value +
          ', presente=' + (findFeriadoByDate(ccIso) !== null)
    };
  }

  // Feriados de fecha fija
  var FIXED_DATES = {
    'feriado-ano-nuevo': '2026-01-01',
    'feriado-dia-trabajo': '2026-05-01',
    'feriado-glorias-navales': '2026-05-21',
    'feriado-virgen-carmen': '2026-07-16',
    'feriado-asuncion-virgen': '2026-08-15',
    'feriado-fiestas-patrias': '2026-09-18',
    'feriado-glorias-ejercito': '2026-09-19',
    'feriado-iglesias-evangelicas': '2026-10-31',
    'feriado-todos-los-santos': '2026-11-01',
    'feriado-inmaculada-concepcion': '2026-12-08',
    'feriado-navidad': '2026-12-25'
  };

  if (FIXED_DATES[id]) {
    var expectedDate = FIXED_DATES[id];
    var feriado = findFeriadoByDate(expectedDate);
    var ok = feriado !== null && claim.displayed_value === expectedDate;
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'Fecha fija ' + expectedDate + ' confirmada en feriadosCompletos'
        : 'Fecha ' + expectedDate + ': feriado=' + (feriado ? 'si' : 'no') +
          ', displayed=' + claim.displayed_value
    };
  }

  // Feriados derivados de Pascua
  if (id === 'feriado-viernes-santo') {
    var easter = easterDate(calConfig.year);
    var vs = addDays(easter, -2);
    var vsIso = dateToIso(vs);
    var ok = vsIso === claim.displayed_value && findFeriadoByDate(vsIso) !== null;
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'Pascua - 2 = ' + vsIso + '. Confirmado en feriadosCompletos.'
        : 'Esperado: ' + claim.displayed_value + ', Calculado: ' + vsIso
    };
  }

  if (id === 'feriado-sabado-santo') {
    var easter = easterDate(calConfig.year);
    var ss = addDays(easter, -1);
    var ssIso = dateToIso(ss);
    var ok = ssIso === claim.displayed_value && findFeriadoByDate(ssIso) !== null;
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'Pascua - 1 = ' + ssIso + '. Confirmado en feriadosCompletos.'
        : 'Esperado: ' + claim.displayed_value + ', Calculado: ' + ssIso
    };
  }

  if (id === 'feriado-corpus-christi') {
    var easter = easterDate(calConfig.year);
    var cc = addDays(easter, 60);
    var ccIso = dateToIso(cc);
    var ok = ccIso === claim.displayed_value && findFeriadoByDate(ccIso) !== null;
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'Pascua + 60 = ' + ccIso + '. Confirmado en feriadosCompletos.'
        : 'Esperado: ' + claim.displayed_value + ', Calculado: ' + ccIso
    };
  }

  // Pueblos Indigenas (solsticio de invierno)
  if (id === 'feriado-pueblos-indigenas') {
    // Solsticio de invierno hemisferio sur 2026 = 21 de junio
    var solstice = calConfig.year + '-06-21';
    var ok = claim.displayed_value === solstice && findFeriadoByDate(solstice) !== null;
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'Solsticio de invierno ' + calConfig.year + ' = ' + solstice + '. Confirmado.'
        : 'Esperado: ' + claim.displayed_value + ', Solsticio: ' + solstice
    };
  }

  // Feriados con traslado a lunes (Ley 19.668)
  if (id === 'feriado-san-pedro-san-pablo') {
    var d = new Date(calConfig.year, 5, 29); // June 29
    var dow = d.getDay();
    var expectedDate;
    if (dow === 0) expectedDate = calConfig.year + '-06-30';
    else if (dow === 6) expectedDate = calConfig.year + '-07-01';
    else expectedDate = calConfig.year + '-06-29';
    var ok = claim.displayed_value === expectedDate && findFeriadoByDate(expectedDate) !== null;
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? '29 junio = dia ' + dow + '. Fecha efectiva: ' + expectedDate
        : 'Esperado: ' + expectedDate + ', Mostrado: ' + claim.displayed_value
    };
  }

  if (id === 'feriado-encuentro-dos-mundos') {
    var d = new Date(calConfig.year, 9, 12); // Oct 12
    var dow = d.getDay();
    var expectedDate;
    if (dow === 0) expectedDate = calConfig.year + '-10-13';
    else if (dow === 6) expectedDate = calConfig.year + '-10-14';
    else expectedDate = calConfig.year + '-10-12';
    var ok = claim.displayed_value === expectedDate && findFeriadoByDate(expectedDate) !== null;
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? '12 octubre = dia ' + dow + '. Fecha efectiva: ' + expectedDate
        : 'Esperado: ' + expectedDate + ', Mostrado: ' + claim.displayed_value
    };
  }

  return null; // No es claim determinista
}

// ── Capa 1b: Verificacion Aritmetica ─────────────────────────────────────────

function verifyArithmetic(claim) {
  var id = claim.id;

  // Dias vacaciones invierno (standard)
  if (id === 'region-dias-vacaciones-invierno' || id === 'dias-vacaciones-invierno-calc-standard') {
    var start = new Date(calConfig.winterStart + 'T00:00:00');
    var end = new Date(calConfig.winterEnd + 'T00:00:00');
    var days = daysBetween(start, end) + 1;
    var ok = days === parseInt(claim.displayed_value, 10);
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? calConfig.winterEnd + ' - ' + calConfig.winterStart + ' + 1 = ' + days + ' dias'
        : 'Esperado: ' + claim.displayed_value + ', Calculado: ' + days
    };
  }

  // Dias vacaciones invierno (sur — fechas propias desde pages.json)
  if (id === 'region-dias-vacaciones-invierno-sur' || id === 'dias-vacaciones-invierno-calc-sur') {
    // Leer fechas reales de Aysen/Magallanes desde pages.json
    var surPage = pages.find(function (p) { return p.regionSlug === 'aysen' || p.regionSlug === 'magallanes'; });
    if (!surPage) return { verdict: 'NO_VERIFICABLE', evidence: 'No se encontro region sur en pages.json' };
    var surStart = spanishToDate(surPage.vacacionesInicio, calConfig.year);
    var surEnd = spanishToDate(surPage.vacacionesFin, calConfig.year);
    if (!surStart || !surEnd) return { verdict: 'NO_VERIFICABLE', evidence: 'No se pudo parsear fechas sur' };
    var days = daysBetween(surStart, surEnd) + 1;
    var ok = days === parseInt(claim.displayed_value, 10);
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? dateToIso(surEnd) + ' - ' + dateToIso(surStart) + ' + 1 = ' + days + ' dias'
        : 'Esperado: ' + claim.displayed_value + ', Calculado: ' + days
    };
  }

  // Dias Fiestas Patrias
  if (id === 'region-dias-fiestas-patrias' || id === 'dias-fiestas-patrias-calc') {
    var start = new Date(2026, 8, 14); // Sep 14
    var end = new Date(2026, 8, 18);   // Sep 18
    var days = daysBetween(start, end) + 1;
    var ok = days === parseInt(claim.displayed_value, 10);
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? '18 sep - 14 sep + 1 = ' + days + ' dias'
        : 'Esperado: ' + claim.displayed_value + ', Calculado: ' + days
    };
  }

  // Feriados en clases
  if (id === 'feriados-en-clases') {
    var count = calConfig.feriadosCompletos.filter(function (f) {
      return f.contexto === 'en-clases';
    }).length;
    var ok = count === parseInt(claim.displayed_value, 10);
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'feriadosCompletos con contexto="en-clases": ' + count
        : 'Esperado: ' + claim.displayed_value + ', Contado: ' + count
    };
  }

  // Feriados sin impacto
  if (id === 'feriados-sin-impacto') {
    var count = calConfig.feriadosCompletos.filter(function (f) {
      return f.contexto === 'sin-impacto';
    }).length;
    var ok = count === parseInt(claim.displayed_value, 10);
    return {
      verdict: ok ? 'CORRECTO' : 'INCORRECTO',
      evidence: ok
        ? 'feriadosCompletos con contexto="sin-impacto": ' + count
        : 'Esperado: ' + claim.displayed_value + ', Contado: ' + count
    };
  }

  // Virgen del Carmen fuera de vacaciones (en periodo de clases)
  if (id === 'virgen-carmen-en-vacaciones') {
    var wStart = new Date(calConfig.winterStart + 'T00:00:00');
    var wEnd = new Date(calConfig.winterEnd + 'T00:00:00');
    var virgen = new Date(calConfig.year + '-07-16T00:00:00');
    var inVacation = virgen >= wStart && virgen <= wEnd;
    // Claim dice que cae FUERA de vacaciones → ok si NO esta en vacacion
    return {
      verdict: !inVacation ? 'CORRECTO' : 'INCORRECTO',
      evidence: !inVacation
        ? '16 julio esta FUERA del rango ' + calConfig.winterStart + ' — ' + calConfig.winterEnd + ' (en clases)'
        : '16 julio esta DENTRO del rango ' + calConfig.winterStart + ' — ' + calConfig.winterEnd + ' (en vacaciones)'
    };
  }

  // Fiestas Patrias en vacaciones
  if (id === 'fiestas-patrias-en-vacaciones') {
    var fpInicio = pages[0].fiestasPatriasInicio; // "14 de septiembre"
    var fpFin = pages[0].fiestasPatriasFin;       // "18 de septiembre"
    // Parsear fechas del receso
    var fpIniParts = spanishToDate(fpInicio, calConfig.year);
    var fpFinParts = spanishToDate(fpFin, calConfig.year);
    if (!fpIniParts || !fpFinParts) {
      return { verdict: 'NO_VERIFICABLE', evidence: 'No se pudo parsear fechas de Fiestas Patrias' };
    }
    // Verificar que 18 sep (Fiestas Patrias) esta dentro del receso
    var sep18 = new Date(calConfig.year, 8, 18);
    var sep19 = new Date(calConfig.year, 8, 19);
    var fpOk = sep18 >= fpIniParts && sep18 <= fpFinParts;
    var isSaturday = sep19.getDay() === 6;
    var allOk = fpOk && isSaturday;
    return {
      verdict: allOk ? 'CORRECTO' : 'INCORRECTO',
      evidence: fpOk
        ? 'Fiestas Patrias (18 sep) dentro del receso ' + fpInicio + ' - ' + fpFin +
          '. 19 sep = ' + (isSaturday ? 'sabado (confirmado)' : 'NO es sabado (ERROR)')
        : 'Fiestas Patrias (18 sep) NO esta dentro del receso ' + fpInicio + ' - ' + fpFin
    };
  }

  return null; // No es claim aritmetica
}

// ── Capa 1c: Verificacion Manual ─────────────────────────────────────────────

var MANUAL_MAX_AGE_DAYS = 365;

/**
 * Claims verificados manualmente por el operador al cargar datos anuales.
 * CORRECTO si last_verified < 1 ano. NO_VERIFICABLE si nunca o expirado.
 */
function verifyManual(claim) {
  if (!claim.last_verified) {
    return {
      verdict: 'NO_VERIFICABLE',
      evidence: 'Verificacion manual requerida — nunca verificado'
    };
  }

  var verifiedDate = new Date(claim.last_verified);
  var ageDays = Math.floor((Date.now() - verifiedDate.getTime()) / 86400000);

  if (ageDays > MANUAL_MAX_AGE_DAYS) {
    return {
      verdict: 'NO_VERIFICABLE',
      evidence: 'Verificacion manual expirada — ultima: ' + claim.last_verified.slice(0, 10) + ' (' + ageDays + ' dias)'
    };
  }

  return {
    verdict: 'CORRECTO',
    evidence: 'Verificado manualmente por ' + (claim.last_verified_by || 'operador') +
      ' el ' + claim.last_verified.slice(0, 10) + ' (' + ageDays + ' dias)'
  };
}

// ── Capa 2: Verificacion con DeepSeek ────────────────────────────────────────

function buildVerificationPrompt(claim, sourceContent) {
  var displayedSpanish = claim.displayed_value;
  if (displayedSpanish && /^\d{4}-\d{2}-\d{2}$/.test(displayedSpanish)) {
    displayedSpanish = isoToSpanish(displayedSpanish) + ' (ISO: ' + claim.displayed_value + ')';
  }

  return {
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: 'system',
        content: [
          'Eres un verificador de datos del calendario escolar chileno.',
          'Tu UNICA tarea es comparar una afirmacion con un texto fuente oficial.',
          '',
          'REGLAS ESTRICTAS:',
          '1. Basarte EXCLUSIVAMENTE en el texto proporcionado. NUNCA usar conocimiento propio.',
          '2. Si el texto no contiene informacion suficiente para verificar → NO_VERIFICABLE.',
          '3. Si el texto contradice la afirmacion → INCORRECTO.',
          '4. Si el texto confirma la afirmacion → CORRECTO + cita textual exacta.',
          '5. NO existe el veredicto "IMPRECISO" o "PARCIAL". Solo CORRECTO, INCORRECTO, NO_VERIFICABLE.',
          '6. La cita debe ser TEXTUAL del documento. No parafrasear.',
          '7. Las fechas pueden estar en formatos diferentes (ISO: 2026-03-02, espanol: 2 de marzo de 2026). Ambos formatos son equivalentes.',
          '8. Responde SOLO con JSON valido, sin texto adicional.'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          '=== AFIRMACION A VERIFICAR ===',
          'ID: ' + claim.id,
          'Afirmacion: ' + claim.claim,
          'Valor mostrado: ' + (displayedSpanish || 'N/A'),
          'Referencia esperada: ' + (claim.source_reference || 'No especificada'),
          '',
          '=== TEXTO FUENTE OFICIAL ===',
          sourceContent.substring(0, 4000),
          '',
          '=== RESPUESTA (JSON) ===',
          '{',
          '  "verdict": "CORRECTO|INCORRECTO|NO_VERIFICABLE",',
          '  "source_quote": "cita textual exacta del texto fuente, o null",',
          '  "evidence": "explicacion en 1-2 oraciones",',
          '  "confidence": 0.0',
          '}'
        ].join('\n')
      }
    ],
    temperature: 0.1,
    max_tokens: 500
  };
}

function callDeepSeek(payload) {
  return new Promise(function (resolve, reject) {
    var data = JSON.stringify(payload);
    var options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    var timer = setTimeout(function () {
      req.destroy();
      reject(new Error('DeepSeek timeout (' + DEEPSEEK_TIMEOUT_MS + 'ms)'));
    }, DEEPSEEK_TIMEOUT_MS);

    var req = https.request(options, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        clearTimeout(timer);
        var body = Buffer.concat(chunks).toString('utf8');
        try {
          var json = JSON.parse(body);
          if (json.error) {
            reject(new Error('DeepSeek API: ' + (json.error.message || JSON.stringify(json.error))));
            return;
          }
          var content = json.choices[0].message.content;
          // Limpiar posible wrapping ```json...```
          content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          var result = JSON.parse(content);
          resolve(result);
        } catch (e) {
          reject(new Error('DeepSeek parse error: ' + e.message + ' — body: ' + body.substring(0, 200)));
        }
      });
    });

    req.on('error', function (err) {
      clearTimeout(timer);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Verifica un claim con DeepSeek + validacion anti-alucinacion.
 */
function verifyWithDeepSeek(claim, sourceContent) {
  var prompt = buildVerificationPrompt(claim, sourceContent);

  return callDeepSeek(prompt).then(function (response) {
    // Log para auditoria
    appendLog({
      timestamp: new Date().toISOString(),
      claim_id: claim.id,
      prompt_tokens: prompt.messages[1].content.length,
      response: response,
      validated: null
    });

    // Umbral de confianza
    if (typeof response.confidence === 'number' && response.confidence < CONFIDENCE_THRESHOLD) {
      return {
        verdict: 'NO_VERIFICABLE',
        evidence: 'Confianza IA = ' + response.confidence + ' (umbral: ' + CONFIDENCE_THRESHOLD + ')',
        source_quote: response.source_quote,
        ai_response: response
      };
    }

    // INCORRECTO con confianza < 0.9 → NO_VERIFICABLE (mitigar falso negativo)
    if (response.verdict === 'INCORRECTO' &&
        typeof response.confidence === 'number' && response.confidence < 0.9) {
      return {
        verdict: 'NO_VERIFICABLE',
        evidence: 'IA reporto INCORRECTO pero confianza = ' + response.confidence + ' < 0.9. Requiere revision manual.',
        source_quote: response.source_quote,
        ai_response: response
      };
    }

    // Validacion cruzada de citas (anti-alucinacion)
    if (response.verdict === 'CORRECTO' && response.source_quote) {
      var quoteValid = validateQuote(response.source_quote, sourceContent);
      if (!quoteValid) {
        // Actualizar log
        updateLastLog({ validated: false });
        return {
          verdict: 'NO_VERIFICABLE',
          evidence: 'IA reporto CORRECTO pero la cita no se encontro en el texto fuente. Posible alucinacion.',
          source_quote: response.source_quote,
          ai_response: response
        };
      }
      updateLastLog({ validated: true });
    }

    return {
      verdict: response.verdict || 'NO_VERIFICABLE',
      evidence: response.evidence || 'Sin evidencia',
      source_quote: response.source_quote || null,
      ai_response: response
    };
  }).catch(function (err) {
    appendLog({
      timestamp: new Date().toISOString(),
      claim_id: claim.id,
      error: err.message
    });

    return {
      verdict: 'NO_VERIFICABLE',
      evidence: 'Error DeepSeek: ' + err.message,
      source_quote: null,
      ai_response: null
    };
  });
}

// ── Logging ──────────────────────────────────────────────────────────────────

function appendLog(entry) {
  fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
}

function updateLastLog(update) {
  // Simple: read last line, parse, merge, rewrite last line
  try {
    var content = fs.readFileSync(LOG_PATH, 'utf8');
    var lines = content.trim().split('\n');
    if (lines.length === 0) return;
    var last = JSON.parse(lines[lines.length - 1]);
    Object.keys(update).forEach(function (k) { last[k] = update[k]; });
    lines[lines.length - 1] = JSON.stringify(last);
    fs.writeFileSync(LOG_PATH, lines.join('\n') + '\n');
  } catch (e) { /* best effort */ }
}

// ── Cache ────────────────────────────────────────────────────────────────────

function getCachedResult(claim) {
  if (FORCE_ALL) return null;
  if (!previousResults || !previousResults.results) return null;

  var prev = null;
  for (var i = 0; i < previousResults.results.length; i++) {
    if (previousResults.results[i].id === claim.id) {
      prev = previousResults.results[i];
      break;
    }
  }
  if (!prev) return null;

  // TTL: resultados CORRECTO expiran despues de 30 dias para garantizar re-verificacion periodica
  var CACHE_TTL_DAYS = 30;
  if (prev.verified_at) {
    var ageDays = (Date.now() - new Date(prev.verified_at).getTime()) / 86400000;
    if (ageDays > CACHE_TTL_DAYS) return null;
  }

  // Solo cachear CORRECTO (los demas merecen re-verificacion)
  if (prev.verdict !== 'CORRECTO') return null;

  // Verificar que el displayed_value no cambio
  if (prev.displayed_value !== claim.displayed_value) return null;

  // Claims derivados (sin source_id) siempre se re-verifican — son checks rapidos
  // y no hay forma de detectar si sus inputs cambiaron
  if (!claim.source_id) return null;

  // Verificar que la fuente no cambio (via source-health hash)
  if (sourceHealth && sourceHealth.sources && sourceHealth.sources[claim.source_id]) {
    if (sourceHealth.sources[claim.source_id].hash_changed) return null;
  }

  return {
    verdict: 'CORRECTO',
    evidence: prev.evidence + ' (cache — fuente sin cambios)',
    source_quote: prev.source_quote,
    verified_by: 'cache'
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== Verificacion de Contenido (Fase 3) ===');
  console.log('Claims: ' + afirmaciones.claims.length);
  console.log('Force all: ' + FORCE_ALL);
  console.log('DeepSeek API key: ' + (DEEPSEEK_API_KEY ? 'configurada' : 'NO configurada'));
  console.log('');

  // Limpiar log si es una ejecucion nueva
  if (fs.existsSync(LOG_PATH)) fs.unlinkSync(LOG_PATH);

  var results = [];
  var deepseekQueue = []; // Claims que necesitan verificacion IA
  var deepseekCallCount = 0;

  // Fase 1: procesar claims deterministas y aritmeticas (sync)
  afirmaciones.claims.forEach(function (claim) {
    var result = {
      id: claim.id,
      claim: claim.claim,
      displayed_value: claim.displayed_value,
      verified_at: new Date().toISOString(),
      verified_by: null,
      verdict: null,
      evidence: null,
      source_quote: null
    };

    // Cache
    var cached = getCachedResult(claim);
    if (cached) {
      result.verdict = cached.verdict;
      result.evidence = cached.evidence;
      result.source_quote = cached.source_quote;
      result.verified_by = cached.verified_by;
      console.log('  [cache] ' + claim.id + ' → ' + result.verdict);
      results.push(result);
      return;
    }

    // Fuente inaccesible
    if (claim.source_id && sourceHealth && sourceHealth.sources) {
      var srcStatus = sourceHealth.sources[claim.source_id];
      if (srcStatus && (srcStatus.status === 'broken' || srcStatus.status === 'error' || srcStatus.status === 'timeout')) {
        result.verdict = 'FUENTE_INACCESIBLE';
        result.evidence = 'Fuente ' + claim.source_id + ' no disponible (' + srcStatus.status + ')';
        result.verified_by = 'source_health';
        console.log('  [source] ' + claim.id + ' → FUENTE_INACCESIBLE');
        results.push(result);
        return;
      }
    }

    // Capa 1: determinista
    if (claim.verification_method === 'deterministic') {
      var detResult = verifyDeterministic(claim);
      if (detResult) {
        result.verdict = detResult.verdict;
        result.evidence = detResult.evidence;
        result.verified_by = 'deterministic';
        var icon = result.verdict === 'CORRECTO' ? '✓' : '✗';
        console.log('  [det]   ' + icon + ' ' + claim.id + ' → ' + result.verdict);
        results.push(result);
        return;
      }
    }

    // Capa 1b: aritmetica
    if (claim.verification_method === 'arithmetic') {
      var arithResult = verifyArithmetic(claim);
      if (arithResult) {
        result.verdict = arithResult.verdict;
        result.evidence = arithResult.evidence;
        result.verified_by = 'arithmetic';
        var icon = result.verdict === 'CORRECTO' ? '✓' : '✗';
        console.log('  [arith] ' + icon + ' ' + claim.id + ' → ' + result.verdict);
        results.push(result);
        return;
      }
    }

    // Capa 1c: manual
    if (claim.verification_method === 'manual') {
      var manualResult = verifyManual(claim);
      result.verdict = manualResult.verdict;
      result.evidence = manualResult.evidence;
      result.verified_by = 'manual';
      var icon = result.verdict === 'CORRECTO' ? '✓' : '?';
      console.log('  [manual] ' + icon + ' ' + claim.id + ' → ' + result.verdict);
      results.push(result);
      return;
    }

    // Capa 2: necesita DeepSeek
    if (claim.verification_method === 'deepseek') {
      deepseekQueue.push({ claim: claim, result: result });
      return;
    }

    // Capa 3: no verificable
    result.verdict = 'NO_VERIFICABLE';
    result.evidence = 'No se pudo verificar automaticamente';
    result.verified_by = 'none';
    console.log('  [none]  ' + claim.id + ' → NO_VERIFICABLE');
    results.push(result);
  });

  // Fase 2: procesar cola DeepSeek (async, secuencial)
  if (deepseekQueue.length === 0) {
    finalize(results);
    return;
  }

  console.log('\n--- Verificacion IA (' + deepseekQueue.length + ' claims) ---');

  // Pre-fetch contenido de fuentes necesarias
  var sourceContents = {};
  var sourcesToFetch = {};
  deepseekQueue.forEach(function (item) {
    var sid = item.claim.source_id;
    if (sid && !sourcesToFetch[sid]) {
      sourcesToFetch[sid] = afirmaciones.sources[sid];
    }
  });

  var sourceIds = Object.keys(sourcesToFetch);
  var fetchIdx = 0;

  function fetchNextSource() {
    if (fetchIdx >= sourceIds.length) {
      processDeepseekQueue();
      return;
    }

    var sid = sourceIds[fetchIdx];
    var source = sourcesToFetch[sid];
    console.log('  Obteniendo contenido: ' + sid + ' (tier ' + source.tier + ')...');

    fetchSourceContent(source).then(function (content) {
      if (content) {
        sourceContents[sid] = content;
        console.log('    → ' + content.length + ' chars');
      } else {
        console.log('    → sin contenido disponible');
      }
      fetchIdx++;
      fetchNextSource();
    });
  }

  function processDeepseekQueue() {
    var qIdx = 0;

    function processNext() {
      if (qIdx >= deepseekQueue.length) {
        finalize(results);
        return;
      }

      var item = deepseekQueue[qIdx];
      var claim = item.claim;
      var result = item.result;
      var sourceContent = sourceContents[claim.source_id] || null;

      // Sin contenido de fuente → NO_VERIFICABLE
      if (!sourceContent) {
        result.verdict = 'NO_VERIFICABLE';
        result.evidence = 'Contenido de fuente no disponible (' + claim.source_id + ')';
        result.verified_by = 'none';
        console.log('  [no-src] ' + claim.id + ' → NO_VERIFICABLE');
        results.push(result);
        qIdx++;
        processNext();
        return;
      }

      // Sin API key → NO_VERIFICABLE
      if (!DEEPSEEK_API_KEY) {
        result.verdict = 'NO_VERIFICABLE';
        result.evidence = 'DEEPSEEK_API_KEY no configurada';
        result.verified_by = 'none';
        console.log('  [no-key] ' + claim.id + ' → NO_VERIFICABLE');
        results.push(result);
        qIdx++;
        processNext();
        return;
      }

      // Limite de llamadas
      if (deepseekCallCount >= MAX_DEEPSEEK_CALLS) {
        result.verdict = 'NO_VERIFICABLE';
        result.evidence = 'Limite de ' + MAX_DEEPSEEK_CALLS + ' llamadas DeepSeek alcanzado';
        result.verified_by = 'none';
        console.log('  [limit] ' + claim.id + ' → NO_VERIFICABLE');
        results.push(result);
        qIdx++;
        processNext();
        return;
      }

      // Llamar DeepSeek
      deepseekCallCount++;
      console.log('  [ai ' + deepseekCallCount + '/' + MAX_DEEPSEEK_CALLS + '] ' + claim.id + '...');

      verifyWithDeepSeek(claim, sourceContent).then(function (aiResult) {
        result.verdict = aiResult.verdict;
        result.evidence = aiResult.evidence;
        result.source_quote = aiResult.source_quote;
        result.verified_by = 'deepseek';
        var icon = result.verdict === 'CORRECTO' ? '✓' :
                   result.verdict === 'INCORRECTO' ? '✗' : '?';
        console.log('    ' + icon + ' ' + result.verdict);
        results.push(result);

        qIdx++;
        // Delay entre llamadas
        setTimeout(processNext, DELAY_BETWEEN_CALLS_MS);
      });
    }

    processNext();
  }

  fetchNextSource();
}

function finalize(results) {
  // Calcular totales
  var correcto = 0, incorrecto = 0, noVerificable = 0, fuenteInaccesible = 0;
  results.forEach(function (r) {
    if (r.verdict === 'CORRECTO') correcto++;
    else if (r.verdict === 'INCORRECTO') incorrecto++;
    else if (r.verdict === 'NO_VERIFICABLE') noVerificable++;
    else if (r.verdict === 'FUENTE_INACCESIBLE') fuenteInaccesible++;
  });

  var output = {
    verified_at: new Date().toISOString(),
    total_claims: results.length,
    correcto: correcto,
    incorrecto: incorrecto,
    no_verificable: noVerificable,
    fuente_inaccesible: fuenteInaccesible,
    results: results
  };

  fs.writeFileSync(RESULTS_PATH, JSON.stringify(output, null, 2));
  console.log('\nGenerado data/verification-results.json');

  // Sincronizar campo status en afirmaciones.json con resultados de verificacion
  var syncById = {};
  results.forEach(function (r) { syncById[r.id] = r; });
  var statusChanged = false;
  afirmaciones.claims.forEach(function (claim) {
    var r = syncById[claim.id];
    var newStatus = r ? r.verdict.toLowerCase() : 'unverified';
    if (claim.status !== newStatus) {
      claim.status = newStatus;
      statusChanged = true;
    }
  });
  if (statusChanged) {
    fs.writeFileSync(AFIRMACIONES_PATH, JSON.stringify(afirmaciones, null, 2));
    console.log('  \u2192 Sincronizados estados en data/afirmaciones.json');
  }

  // Reporte
  console.log('\n=== Resultado ===');
  console.log('  Total:              ' + output.total_claims);
  console.log('  Correcto:           ' + correcto);
  console.log('  Incorrecto:         ' + incorrecto);
  console.log('  No verificable:     ' + noVerificable);
  console.log('  Fuente inaccesible: ' + fuenteInaccesible);

  // Cobertura Capa 1 (determinista + aritmetica + manual)
  var det = results.filter(function (r) {
    return r.verified_by === 'deterministic' || r.verified_by === 'arithmetic' || r.verified_by === 'manual';
  }).length;
  var detPct = Math.round(det / output.total_claims * 100);
  console.log('  Capa 1 (det+arith+manual): ' + det + '/' + output.total_claims + ' (' + detPct + '%)');

  // Alertas
  var incorrectos = results.filter(function (r) { return r.verdict === 'INCORRECTO'; });
  if (incorrectos.length > 0) {
    console.log('\n  ALERTA CRITICA: ' + incorrectos.length + ' afirmaciones INCORRECTAS:');
    incorrectos.forEach(function (r) {
      console.log('    ✗ ' + r.id + ': ' + r.evidence);
    });
    process.exit(1);
  }

  console.log('');
  process.exit(0);
}

main();
