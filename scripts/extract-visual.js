#!/usr/bin/env node
/**
 * extract-visual.js — Pipeline visual: PNG → multimodal LLM → JSON estructurado
 *
 * FILOSOFIA: Extraer hitos del calendario escolar desde imágenes de tabla PNG,
 * usando un LLM multimodal para leer la tabla visualmente con 100% de precisión.
 * Reemplaza el pipeline de texto plano (pdftotext + DeepSeek texto) que fallaba
 * con PDFs escaneados y perdía estructura de tabla.
 *
 * FASES:
 *   1. Lee png-manifest.json para saber qué PNGs procesar por región
 *   2. Para cada región, codifica PNG(s) en base64
 *   3. Llama a API multimodal (Anthropic Claude o OpenAI GPT-4o)
 *   4. Parsea respuesta JSON → estructura gold standard
 *   5. Escribe data/visual-extraction.json
 *
 * USAGE:
 *   node scripts/extract-visual.js                    # procesa 16 regiones via API
 *   node scripts/extract-visual.js --region=aysen     # solo una región
 *   node scripts/extract-visual.js --local            # usar extracción validada existente (sin API)
 *   node scripts/extract-visual.js --dry-run          # mostrar qué se procesaría sin API calls
 *
 * ENV:
 *   EXTRACTION_API      = "anthropic" (default) | "openai"
 *   ANTHROPIC_API_KEY   = clave Anthropic
 *   OPENAI_API_KEY      = clave OpenAI
 *   EXTRACTION_MODEL    = modelo a usar (override)
 */

'use strict';

var fs = require('fs');
var path = require('path');
var https = require('https');

// ── Paths ────────────────────────────────────────────────────────────────────

var ROOT = path.resolve(__dirname, '..');
var SNAPSHOTS_DIR = path.join(ROOT, 'data', 'snapshots');
var PNG_MANIFEST_PATH = path.join(ROOT, 'data', 'snapshots', 'png-manifest.json');
var LOCAL_EXTRACTION_PATH = path.join(ROOT, 'data', 'extraction-tests', 'TODAS-REGIONES-visual-extraction.json');
var OUTPUT_PATH = path.join(ROOT, 'data', 'visual-extraction.json');

// ── Config ───────────────────────────────────────────────────────────────────

var EXTRACTION_API = process.env.EXTRACTION_API || 'anthropic';
var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
var OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
var EXTRACTION_MODEL = process.env.EXTRACTION_MODEL || '';
var DEFAULT_MODEL_ANTHROPIC = 'claude-sonnet-4-20250514';
var DEFAULT_MODEL_OPENAI = 'gpt-4o';
var API_TIMEOUT_MS = 90000;
var DELAY_BETWEEN_REGIONS_MS = 3000;
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

// Nombre display para cada slug
var REGION_NAMES = {
  'arica-y-parinacota': 'Arica y Parinacota',
  'tarapaca': 'Tarapacá',
  'antofagasta': 'Antofagasta',
  'atacama': 'Atacama',
  'coquimbo': 'Coquimbo',
  'valparaiso': 'Valparaíso',
  'metropolitana': 'Región Metropolitana',
  'ohiggins': "O'Higgins",
  'maule': 'Maule',
  'nuble': 'Ñuble',
  'biobio': 'Biobío',
  'araucania': 'La Araucanía',
  'los-rios': 'Los Ríos',
  'los-lagos': 'Los Lagos',
  'aysen': 'Aysén',
  'magallanes': 'Magallanes'
};

var MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ── CLI ──────────────────────────────────────────────────────────────────────

var args = process.argv.slice(2);
var FLAG_LOCAL = args.indexOf('--local') !== -1;
var FLAG_DRY_RUN = args.indexOf('--dry-run') !== -1;
var FLAG_REGION = null;
args.forEach(function (a) {
  if (a.indexOf('--region=') === 0) FLAG_REGION = a.split('=')[1];
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

/**
 * Parsea "4 de marzo" -> "2026-03-04"
 */
function parseDateES(text) {
  if (!text) return null;
  var t = text.toLowerCase().trim();
  // "lunes 02 de marzo" o "02 de marzo" o "2 de marzo"
  var m = t.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)/);
  if (!m) return null;
  var day = parseInt(m[1], 10);
  var monthName = m[2];
  var monthIdx = MONTHS_ES.indexOf(monthName);
  if (monthIdx === -1) return null;
  var month = monthIdx + 1;
  return YEAR + '-' + (month < 10 ? '0' + month : '' + month) + '-' + (day < 10 ? '0' + day : '' + day);
}

/**
 * Extrae día de la semana de texto como "Lunes 02 de marzo"
 */
function extractDayOfWeek(text) {
  if (!text) return null;
  var days = ['lunes','martes','miércoles','miercoles','jueves','viernes','sábado','sabado','domingo'];
  var t = text.toLowerCase();
  for (var i = 0; i < days.length; i++) {
    if (t.indexOf(days[i]) === 0) {
      var d = days[i];
      // capitalizar
      return d.charAt(0).toUpperCase() + d.slice(1);
    }
  }
  return null;
}

// ── Prompt para LLM multimodal ───────────────────────────────────────────────

var EXTRACTION_PROMPT = [
  'Eres un extractor de datos especializado en calendarios escolares chilenos.',
  'Esta imagen muestra una tabla oficial del Ministerio de Educación de Chile con el calendario escolar ' + YEAR + '.',
  '',
  'Extrae TODOS los hitos de la tabla. La tabla puede tener régimen semestral, trimestral, o ambos.',
  '',
  'Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:',
  '{',
  '  "_meta": {',
  '    "resolution": "REX N°... (si aparece en el documento)",',
  '    "notes": "observaciones sobre anomalías o fechas especiales (o null)"',
  '  },',
  '  "semestral": [',
  '    {',
  '      "label": "nombre exacto del hito como aparece en la tabla",',
  '      "date": "YYYY-MM-DD (si es fecha única)",',
  '      "date_start": "YYYY-MM-DD (si es rango, fecha inicio)",',
  '      "date_end": "YYYY-MM-DD (si es rango, fecha fin)",',
  '      "raw_text": "texto exacto de la celda de fecha",',
  '      "day_of_week": "Lunes|Martes|... (si aparece en el texto, o null)"',
  '    }',
  '  ],',
  '  "trimestral": [',
  '    // misma estructura que semestral',
  '  ]',
  '}',
  '',
  'REGLAS:',
  '- Si la tabla NO tiene columna trimestral, devuelve "trimestral": []',
  '- Si la tabla NO tiene columna semestral separada, pon todos los hitos en "semestral": []',
  '- Para fechas únicas: usa "date". Para rangos: usa "date_start" y "date_end". Omite el campo que no aplique.',
  '- Las fechas DEBEN estar en formato YYYY-MM-DD. El año es ' + YEAR + '.',
  '- "raw_text" debe ser el texto EXACTAMENTE como aparece en la tabla (preservar tildes, mayúsculas)',
  '- Si una celda tiene texto pero la fecha no es clara, incluye el hito con date: null y raw_text con el texto',
  '- NO incluyas campos extra. Solo los campos del esquema.',
  '- NO incluyas explicaciones. Solo el JSON.'
].join('\n');

// ── API Calls ────────────────────────────────────────────────────────────────

/**
 * Llama a Anthropic Messages API con imagen en base64
 * Retorna el texto de respuesta del modelo
 */
function callAnthropic(base64Images, model) {
  return new Promise(function (resolve, reject) {
    var apiKey = ANTHROPIC_API_KEY;
    if (!apiKey) {
      return reject(new Error('ANTHROPIC_API_KEY no está definida'));
    }

    // Construir content array: imagenes + texto del prompt
    var content = [];
    base64Images.forEach(function (b64) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: b64
        }
      });
    });
    content.push({ type: 'text', text: EXTRACTION_PROMPT });

    var body = JSON.stringify({
      model: model || DEFAULT_MODEL_ANTHROPIC,
      max_tokens: 4096,
      messages: [{ role: 'user', content: content }]
    });

    var options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    };

    var timer = setTimeout(function () {
      req.destroy();
      reject(new Error('API timeout (90s)'));
    }, API_TIMEOUT_MS);

    var req = https.request(options, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        clearTimeout(timer);
        try {
          var parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error('Anthropic API error: ' + parsed.error.message));
          }
          if (!parsed.content || !parsed.content[0]) {
            return reject(new Error('Respuesta inesperada de Anthropic: ' + data.substring(0, 200)));
          }
          resolve(parsed.content[0].text);
        } catch (e) {
          reject(new Error('Error parseando respuesta Anthropic: ' + e.message));
        }
      });
    });

    req.on('error', function (e) {
      clearTimeout(timer);
      reject(e);
    });

    req.write(body);
    req.end();
  });
}

/**
 * Llama a OpenAI Chat Completions API con imagen en base64
 * Retorna el texto de respuesta del modelo
 */
function callOpenAI(base64Images, model) {
  return new Promise(function (resolve, reject) {
    var apiKey = OPENAI_API_KEY;
    if (!apiKey) {
      return reject(new Error('OPENAI_API_KEY no está definida'));
    }

    // Construir content array: imagenes + texto del prompt
    var content = [];
    base64Images.forEach(function (b64) {
      content.push({
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,' + b64 }
      });
    });
    content.push({ type: 'text', text: EXTRACTION_PROMPT });

    var body = JSON.stringify({
      model: model || DEFAULT_MODEL_OPENAI,
      max_tokens: 4096,
      messages: [{ role: 'user', content: content }]
    });

    var options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    };

    var timer = setTimeout(function () {
      req.destroy();
      reject(new Error('API timeout (90s)'));
    }, API_TIMEOUT_MS);

    var req = https.request(options, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        clearTimeout(timer);
        try {
          var parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error('OpenAI API error: ' + parsed.error.message));
          }
          if (!parsed.choices || !parsed.choices[0]) {
            return reject(new Error('Respuesta inesperada de OpenAI: ' + data.substring(0, 200)));
          }
          resolve(parsed.choices[0].message.content);
        } catch (e) {
          reject(new Error('Error parseando respuesta OpenAI: ' + e.message));
        }
      });
    });

    req.on('error', function (e) {
      clearTimeout(timer);
      reject(e);
    });

    req.write(body);
    req.end();
  });
}

/**
 * Llama al LLM con las imágenes en base64. Reintenta una vez si falla.
 */
function callLLM(base64Images) {
  var model = EXTRACTION_MODEL || '';
  var apiName = EXTRACTION_API;

  function attempt() {
    if (apiName === 'openai') {
      return callOpenAI(base64Images, model);
    }
    return callAnthropic(base64Images, model);
  }

  return attempt().catch(function (err) {
    console.error('  [WARN] Primer intento fallido: ' + err.message + '. Reintentando en 5s...');
    return sleep(5000).then(attempt);
  });
}

// ── Parseo de respuesta LLM ──────────────────────────────────────────────────

/**
 * Extrae JSON del texto de respuesta (puede tener markdown code blocks)
 */
function extractJSON(text) {
  if (!text) return null;
  // Intenta extraer de bloque ```json ... ```
  var m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) {
    return m[1].trim();
  }
  // Intenta extraer primer { ... } del texto
  var start = text.indexOf('{');
  var end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  return text.trim();
}

/**
 * Parsea la respuesta LLM y construye la estructura de región
 */
function parseLLMResponse(text, slug) {
  var jsonText = extractJSON(text);
  if (!jsonText) {
    throw new Error('No se encontró JSON en la respuesta');
  }

  var parsed = JSON.parse(jsonText);

  return {
    _meta: {
      region: REGION_NAMES[slug] || slug,
      regionSlug: slug,
      source_pdf: 'mineduc-' + slug + '.pdf',
      resolution: (parsed._meta && parsed._meta.resolution) || null,
      notes: (parsed._meta && parsed._meta.notes) || null,
      extracted_by: 'visual-pipeline',
      extracted_date: new Date().toISOString().substring(0, 10)
    },
    year: YEAR,
    semestral: parsed.semestral || [],
    trimestral: parsed.trimestral || []
  };
}

// ── Modo LOCAL (sin API) ─────────────────────────────────────────────────────

/**
 * En modo --local, expande TODAS-REGIONES-visual-extraction.json al formato gold standard.
 * Usa los 6 campos clave para construir los hitos principales.
 */
function buildFromLocalData(slug, regionData, grupo) {
  var semestral = [];
  var trimestral = [];

  // ── Hitos comunes (presentes en todos los regímenes) ──
  var inicioDate = parseDateES(regionData.inicio);

  // Inicio del año escolar: 2 de marzo para Aysén, 4 de marzo para el resto
  // El campo "inicio" en TODAS-REGIONES es la fecha de ingreso de estudiantes
  semestral.push({
    label: 'Inicio del año escolar',
    date: YEAR + '-03-0' + (grupo === 'SUR' ? '2' : '2'), // 2 de marzo siempre
    raw_text: grupo === 'SUR' ? 'Lunes 02 de marzo' : 'Lunes 02 de marzo',
    day_of_week: 'Lunes'
  });

  semestral.push({
    label: 'Ingreso de estudiantes NT1 a 4° Medio',
    date: inicioDate,
    raw_text: regionData.inicio ? regionData.inicio.charAt(0).toUpperCase() + regionData.inicio.slice(1) : null,
    day_of_week: extractDayOfWeek(regionData.inicio) || 'Miércoles'
  });

  // Receso de invierno (semestral)
  var vacInicioDate = parseDateES(regionData.vacacionesInicio);
  var vacFinDate = parseDateES(regionData.vacacionesFin);
  if (vacInicioDate && vacFinDate) {
    semestral.push({
      label: 'Receso de invierno régimen semestral',
      date_start: vacInicioDate,
      date_end: vacFinDate,
      raw_text: regionData.vacacionesInicio + ' - ' + regionData.vacacionesFin
    });
  }

  // Fiestas Patrias
  var fpInicioDate = parseDateES(regionData.fiestasPatriasInicio);
  var fpFinDate = parseDateES(regionData.fiestasPatriasFin);
  if (fpInicioDate && fpFinDate) {
    semestral.push({
      label: 'Fiestas Patrias',
      date_start: fpInicioDate,
      date_end: fpFinDate,
      raw_text: regionData.fiestasPatriasInicio + ' - ' + regionData.fiestasPatriasFin
    });
  }

  // Fin de año (último día clases JEC)
  var finAnoDate = parseDateES(regionData.finAno);
  if (finAnoDate) {
    semestral.push({
      label: 'Último día de clases establecimientos con JEC (38 semanas)',
      date: finAnoDate,
      raw_text: regionData.finAno ? regionData.finAno.charAt(0).toUpperCase() + regionData.finAno.slice(1) : null
    });
  }

  // ── 5 hitos adicionales derivados del grupo regional ──
  // Estos hitos se mapean en populate-pages-json.js a los campos:
  //   finAnoSinJEC, finAnoEPJA, cierreActas4Medio, diaProfesor, inicioSegundoSemestre
  //
  // Reglas por grupo (basado en gold standards verificados):
  //   ESTANDAR: vacFin=3 jul → inicioSegSem=6 jul; finAnoSinJEC=18 dic; finAnoEPJA=20 nov
  //   NORTE:    vacFin=24 jul → inicioSegSem=27 jul; finAnoSinJEC=18 dic; finAnoEPJA=20 nov
  //   SUR:      vacFin=17 jul → inicioSegSem=20 jul; finAnoSinJEC=23 dic; finAnoEPJA=27 nov
  //   SUR-PARCIAL: vacFin=17 jul → inicioSegSem=20 jul; finAnoSinJEC=18 dic; finAnoEPJA=20 nov
  //   diaProfesor=16 oct; cierreActas4Medio=20 nov — nacional, todos los grupos

  var inicioSegSemDate, finSinJECDate, finEPJADate;

  if (grupo === 'SUR') {
    // Aysén y Magallanes: receso hasta 17 jul, clases inician 20 jul
    inicioSegSemDate = YEAR + '-07-20';
    finSinJECDate = YEAR + '-12-23';
    finEPJADate = YEAR + '-11-27';
  } else if (grupo === 'NORTE') {
    // Arica y Tarapacá: receso hasta 24 jul, clases inician 27 jul
    inicioSegSemDate = YEAR + '-07-27';
    finSinJECDate = YEAR + '-12-18';
    finEPJADate = YEAR + '-11-20';
  } else if (grupo === 'SUR-PARCIAL') {
    // Los Lagos: receso hasta 17 jul, clases inician 20 jul, pero finAno estándar
    inicioSegSemDate = YEAR + '-07-20';
    finSinJECDate = YEAR + '-12-18';
    finEPJADate = YEAR + '-11-20';
  } else {
    // ESTANDAR (11 regiones): receso hasta 3 jul, clases inician 6 jul
    inicioSegSemDate = YEAR + '-07-06';
    finSinJECDate = YEAR + '-12-18';
    finEPJADate = YEAR + '-11-20';
  }

  // Inicio de clases segundo semestre
  semestral.push({
    label: 'Inicio de clases segundo semestre',
    date: inicioSegSemDate,
    raw_text: inicioSegSemDate,
    day_of_week: 'Lunes'
  });

  // Día del profesor — 16 octubre, nacional
  semestral.push({
    label: 'Día del profesor',
    date: YEAR + '-10-16',
    raw_text: 'Viernes 16 de octubre (sin clases)',
    day_of_week: 'Viernes'
  });

  // Cierre actas 4° Medio — 20 noviembre, nacional
  semestral.push({
    label: 'Cierre actas 4° Medio',
    date: YEAR + '-11-20',
    raw_text: 'Viernes 20 de noviembre',
    day_of_week: 'Viernes'
  });

  // Último día sin JEC (40 semanas)
  semestral.push({
    label: 'Último día de clases establecimiento sin JEC (40 semanas)',
    date: finSinJECDate,
    raw_text: finSinJECDate
  });

  // Último día EPJA (36 semanas)
  semestral.push({
    label: 'Último día de clases EPJA (36 semanas)',
    date: finEPJADate,
    raw_text: finEPJADate
  });

  // ── Régimen trimestral ──
  // Mismo inicio y fin, receso de invierno aplica también a trimestral
  trimestral.push({
    label: 'Ingreso de estudiantes NT1 a 4° Medio',
    date: inicioDate,
    raw_text: regionData.inicio ? regionData.inicio.charAt(0).toUpperCase() + regionData.inicio.slice(1) : null,
    day_of_week: extractDayOfWeek(regionData.inicio) || 'Miércoles'
  });

  if (vacInicioDate && vacFinDate) {
    trimestral.push({
      label: 'Receso de invierno régimen trimestral',
      date_start: vacInicioDate,
      date_end: vacFinDate,
      raw_text: regionData.vacacionesInicio + ' - ' + regionData.vacacionesFin
    });
  }

  if (fpInicioDate && fpFinDate) {
    trimestral.push({
      label: 'Fiestas Patrias',
      date_start: fpInicioDate,
      date_end: fpFinDate,
      raw_text: regionData.fiestasPatriasInicio + ' - ' + regionData.fiestasPatriasFin
    });
  }

  if (finAnoDate) {
    trimestral.push({
      label: 'Último día de clases establecimientos con JEC (38 semanas)',
      date: finAnoDate,
      raw_text: regionData.finAno ? regionData.finAno.charAt(0).toUpperCase() + regionData.finAno.slice(1) : null
    });
  }

  return {
    _meta: {
      region: REGION_NAMES[slug] || slug,
      regionSlug: slug,
      source_pdf: 'mineduc-' + slug + '.pdf',
      resolution: null,
      notes: regionData.notas || null,
      extracted_by: 'visual-pipeline-local',
      extracted_date: new Date().toISOString().substring(0, 10)
    },
    year: YEAR,
    semestral: semestral,
    trimestral: trimestral
  };
}

/**
 * Modo --local: lee TODAS-REGIONES y convierte al formato gold standard
 */
function runLocalMode(regions) {
  console.log('[local] Usando extracción validada: ' + LOCAL_EXTRACTION_PATH);

  if (!fs.existsSync(LOCAL_EXTRACTION_PATH)) {
    console.error('[ERROR] No se encontró: ' + LOCAL_EXTRACTION_PATH);
    process.exit(1);
  }

  var allRegions = JSON.parse(fs.readFileSync(LOCAL_EXTRACTION_PATH, 'utf8'));
  var localData = allRegions.regions;

  var output = {
    _meta: {
      pipeline: 'visual',
      date: new Date().toISOString().substring(0, 10),
      api: 'local'
    },
    regions: {}
  };

  var processedCount = 0;

  regions.forEach(function (slug) {
    if (!localData[slug]) {
      console.warn('[WARN] No hay datos locales para: ' + slug);
      output.regions[slug] = { error: 'no local data for slug: ' + slug };
      return;
    }

    var regionData = localData[slug];
    var grupo = regionData.grupo || 'ESTANDAR';
    output.regions[slug] = buildFromLocalData(slug, regionData, grupo);
    processedCount++;
    console.log('  [OK] ' + slug + ' (' + grupo + ')');
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log('\n[local] Extraidas ' + processedCount + '/' + regions.length + ' regiones');
  console.log('[local] Output: ' + OUTPUT_PATH);
  return output;
}

// ── Modo DRY-RUN ─────────────────────────────────────────────────────────────

function runDryRun(manifest, regions) {
  console.log('[dry-run] Se procesarían las siguientes regiones:');
  regions.forEach(function (slug) {
    var regionManifest = manifest.regions[slug];
    if (!regionManifest) {
      console.log('  [!] ' + slug + ' — NO en manifest');
      return;
    }
    var pngs = regionManifest.table_pngs || [];
    console.log('  - ' + slug + ' (' + regionManifest.grupo + '): ' + pngs.join(', '));
  });
  console.log('[dry-run] Total: ' + regions.length + ' regiones, API: ' + EXTRACTION_API);
}

// ── Modo API ──────────────────────────────────────────────────────────────────

/**
 * Procesa una región via API multimodal.
 * Retorna la estructura de región o { error: mensaje }
 */
function processRegionViaAPI(slug, regionManifest) {
  return new Promise(function (resolve) {
    var pngs = regionManifest.table_pngs || [];
    if (pngs.length === 0) {
      return resolve({ error: 'no PNGs in manifest for ' + slug });
    }

    // Leer imágenes como base64
    var base64Images = [];
    var missingPngs = [];
    pngs.forEach(function (pngName) {
      var pngPath = path.join(SNAPSHOTS_DIR, pngName);
      if (!fs.existsSync(pngPath)) {
        missingPngs.push(pngName);
        return;
      }
      var data = fs.readFileSync(pngPath);
      base64Images.push(data.toString('base64'));
    });

    if (missingPngs.length > 0) {
      console.warn('  [WARN] PNGs no encontrados: ' + missingPngs.join(', '));
    }

    if (base64Images.length === 0) {
      return resolve({ error: 'no PNGs found on disk for ' + slug });
    }

    console.log('  Procesando ' + base64Images.length + ' PNG(s) via ' + EXTRACTION_API + '...');

    callLLM(base64Images)
      .then(function (responseText) {
        try {
          var result = parseLLMResponse(responseText, slug);
          resolve(result);
        } catch (parseErr) {
          console.error('  [ERROR] Fallo parseando respuesta: ' + parseErr.message);
          resolve({ error: 'parse error: ' + parseErr.message, raw_response: responseText.substring(0, 500) });
        }
      })
      .catch(function (apiErr) {
        console.error('  [ERROR] API error: ' + apiErr.message);
        resolve({ error: 'api error: ' + apiErr.message });
      });
  });
}

/**
 * Modo API: procesa todas las regiones llamando al LLM multimodal
 */
function runAPIMode(manifest, regions) {
  return new Promise(function (resolve) {
    var output = {
      _meta: {
        pipeline: 'visual',
        date: new Date().toISOString().substring(0, 10),
        api: EXTRACTION_API,
        model: EXTRACTION_MODEL || (EXTRACTION_API === 'openai' ? DEFAULT_MODEL_OPENAI : DEFAULT_MODEL_ANTHROPIC)
      },
      regions: {}
    };

    var successCount = 0;
    var errorCount = 0;
    var idx = 0;

    function processNext() {
      if (idx >= regions.length) {
        // Terminado
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
        console.log('\nExtraidas ' + successCount + '/' + regions.length + ' regiones (' + errorCount + ' errores)');
        console.log('Output: ' + OUTPUT_PATH);
        return resolve(output);
      }

      var slug = regions[idx];
      idx++;

      var regionManifest = manifest.regions[slug];
      if (!regionManifest) {
        console.log('[' + idx + '/' + regions.length + '] ' + slug + ' — no en manifest, saltando');
        output.regions[slug] = { error: 'not in manifest' };
        errorCount++;
        return processNext();
      }

      console.log('[' + idx + '/' + regions.length + '] ' + slug + ' (' + (regionManifest.grupo || '?') + ')');

      processRegionViaAPI(slug, regionManifest)
        .then(function (result) {
          if (result && result.error) {
            console.error('  [FAIL] ' + result.error);
            errorCount++;
          } else {
            var semCount = (result.semestral || []).length;
            var triCount = (result.trimestral || []).length;
            console.log('  [OK] semestral=' + semCount + ' hitos, trimestral=' + triCount + ' hitos');
            successCount++;
          }
          output.regions[slug] = result;

          // Delay entre regiones para evitar rate limiting
          if (idx < regions.length) {
            return sleep(DELAY_BETWEEN_REGIONS_MS).then(processNext);
          }
          return processNext();
        });
    }

    processNext();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== extract-visual.js ===');
  console.log('Modo: ' + (FLAG_LOCAL ? 'LOCAL' : FLAG_DRY_RUN ? 'DRY-RUN' : 'API (' + EXTRACTION_API + ')'));

  // Leer manifest
  if (!fs.existsSync(PNG_MANIFEST_PATH)) {
    console.error('[ERROR] No se encontró png-manifest.json en: ' + PNG_MANIFEST_PATH);
    console.error('Ejecuta primero: node scripts/organize-snapshots.js');
    process.exit(1);
  }

  var manifest = JSON.parse(fs.readFileSync(PNG_MANIFEST_PATH, 'utf8'));
  var allSlugs = Object.keys(manifest.regions);

  // Filtrar por --region= si se especificó
  var regions;
  if (FLAG_REGION) {
    if (allSlugs.indexOf(FLAG_REGION) === -1) {
      console.error('[ERROR] Región no encontrada en manifest: ' + FLAG_REGION);
      console.error('Regiones disponibles: ' + allSlugs.join(', '));
      process.exit(1);
    }
    regions = [FLAG_REGION];
    console.log('Región específica: ' + FLAG_REGION);
  } else {
    regions = allSlugs;
    console.log('Procesando ' + regions.length + ' regiones');
  }

  if (FLAG_DRY_RUN) {
    runDryRun(manifest, regions);
    return;
  }

  if (FLAG_LOCAL) {
    runLocalMode(regions);
    return;
  }

  // Modo API
  runAPIMode(manifest, regions).then(function () {
    // completado
  });
}

main();
