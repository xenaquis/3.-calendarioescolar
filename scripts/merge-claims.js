#!/usr/bin/env node
/* merge-claims.js — Unifica afirmaciones.json + legal-articles.json en claims.json
   Uso: node scripts/merge-claims.js
   Produce: data/claims.json (modelo unificado v2.0.0)

   Join key: afirmaciones.claims[].data_key === legal-articles key (e.g. "feriado_ano_nuevo")
*/

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

// ── Mapping pregunta: claim id → pregunta humana ──────────────────────────
// Para claims sin mapping explicito, se usa el campo claim como fallback.
var PREGUNTA_MAP = {
  // Fechas escolares
  'fecha-inicio-clases':              'Cuando comienzan las clases 2026?',
  'fecha-inicio-vacaciones-invierno': 'Cuando empiezan las vacaciones de invierno 2026?',
  'fecha-fin-vacaciones-invierno':    'Cuando terminan las vacaciones de invierno 2026?',
  'fecha-fin-ano-escolar':            'Cuando termina el ano escolar 2026?',
  'ano-escolar':                      'A que ano corresponde este calendario escolar?',

  // Feriados
  'feriado-ano-nuevo':                'Cuando es el feriado de Ano Nuevo 2026?',
  'feriado-viernes-santo':            'Cuando es el feriado de Viernes Santo 2026?',
  'feriado-sabado-santo':             'Cuando es el feriado de Sabado Santo 2026?',
  'feriado-dia-trabajo':              'Cuando es el feriado del Dia del Trabajo 2026?',
  'feriado-glorias-navales':          'Cuando es el feriado de Glorias Navales 2026?',
  'feriado-corpus-christi':           'Cuando es el feriado de Corpus Christi 2026?',
  'feriado-pueblos-indigenas':        'Cuando es el Dia Nacional de los Pueblos Indigenas 2026?',
  'feriado-san-pedro-san-pablo':      'Cuando es el feriado de San Pedro y San Pablo 2026?',
  'feriado-virgen-carmen':            'Cuando es el feriado de la Virgen del Carmen 2026?',
  'feriado-fiestas-patrias':          'Cuando es el feriado de Fiestas Patrias 2026?',
  'feriado-glorias-ejercito':         'Cuando es el feriado de las Glorias del Ejercito 2026?',
  'feriado-encuentro-dos-mundos':     'Cuando es el feriado del Encuentro de Dos Mundos 2026?',
  'feriado-iglesias-evangelicas':     'Cuando es el feriado de las Iglesias Evangelicas 2026?',
  'feriado-inmaculada-concepcion':    'Cuando es el feriado de la Inmaculada Concepcion 2026?',
  'feriado-navidad':                  'Cuando es el feriado de Navidad 2026?',

  // Regional
  'region-inicio':                          'Cuando es el ingreso de estudiantes por region 2026?',
  'region-vacaciones-inicio-standard':       'Cuando empiezan las vacaciones de invierno en las 14 regiones estandar?',
  'region-vacaciones-inicio-sur':            'Cuando empiezan las vacaciones de invierno en Aysen y Magallanes?',
  'region-vacaciones-fin':                   'Cuando terminan las vacaciones de invierno en las 16 regiones?',
  'region-fiestas-patrias-inicio':           'Cuando empiezan las vacaciones de Fiestas Patrias 2026?',
  'region-fiestas-patrias-fin':              'Cuando terminan las vacaciones de Fiestas Patrias 2026?',
  'region-fin-ano-standard':                 'Cuando es el ultimo dia de clases en 14 regiones?',
  'region-fin-ano-sur':                      'Cuando es el ultimo dia de clases en Aysen y Magallanes?',
  'region-dias-vacaciones-invierno':         'Cuantos dias de vacaciones de invierno tienen las 14 regiones estandar?',
  'region-dias-vacaciones-invierno-sur':     'Cuantos dias de vacaciones de invierno tienen Aysen y Magallanes?',
  'region-dias-fiestas-patrias':             'Cuantos dias de vacaciones de Fiestas Patrias hay?',
  'region-fin-ano-sin-jec':                  'Cuando termina el ano escolar sin JEC (40 semanas)?',
  'region-fin-ano-epja':                     'Cuando termina el ano EPJA (36 semanas)?',
  'region-cierre-actas-4-medio':             'Cuando es el cierre de actas de 4 Medio?',
  'region-dia-profesor':                     'Cuando es el Dia del Profesor?',
  'region-inicio-segundo-semestre':          'Cuando comienza el segundo semestre?',

  // Contextuales
  'total-regiones':                   'Cuantas regiones tienen calendario escolar?',
  'total-feriados':                   'Cuantos feriados nacionales hay en 2026?',
  'feriados-en-clases':               'Cuantos feriados caen en dias de clases en 2026?',
  'feriados-sin-impacto':             'Cuantos feriados no afectan el calendario escolar en 2026?',
  'corpus-christi-movil':             'Como se calcula Corpus Christi?',
  'pascua-2026':                      'Cuando cae el Domingo de Pascua 2026?',
  'san-pedro-traslado-2026':          'San Pedro y San Pablo 2026 requiere traslado a lunes?',
  'virgen-carmen-en-vacaciones':      'La Virgen del Carmen 2026 cae dentro de las vacaciones de invierno?',
  'fiestas-patrias-en-vacaciones':    'Las Fiestas Patrias caen dentro del receso de Fiestas Patrias?',
  'inicio-todas-regiones':            'El ingreso de estudiantes 2026 es la misma fecha en todas las regiones?',
  'regiones-sur-extra-vacaciones':    'Que regiones tienen vacaciones de invierno extendidas?',
  'dias-vacaciones-invierno-calc-standard': 'Como se calculan los 12 dias de vacaciones de invierno estandar?',
  'dias-vacaciones-invierno-calc-sur':      'Como se calculan los 19 dias de vacaciones de invierno en el sur?',
  'dias-fiestas-patrias-calc':              'Como se calculan los 5 dias de vacaciones de Fiestas Patrias?'
};

// ── Leer fuentes ──────────────────────────────────────────────────────────
var afirmacionesPath = path.join(ROOT, 'data', 'afirmaciones.json');
var legalArticlesPath = path.join(ROOT, 'data', 'legal-articles.json');
var claimsOutputPath = path.join(ROOT, 'data', 'claims.json');

if (!fs.existsSync(afirmacionesPath)) {
  console.error('ERROR: No se encuentra data/afirmaciones.json');
  process.exit(1);
}
if (!fs.existsSync(legalArticlesPath)) {
  console.error('ERROR: No se encuentra data/legal-articles.json');
  process.exit(1);
}

var afirmaciones;
var legalArticles;

try {
  afirmaciones = JSON.parse(fs.readFileSync(afirmacionesPath, 'utf8'));
} catch (e) {
  console.error('ERROR: data/afirmaciones.json JSON invalido — ' + e.message);
  process.exit(1);
}

try {
  legalArticles = JSON.parse(fs.readFileSync(legalArticlesPath, 'utf8'));
} catch (e) {
  console.error('ERROR: data/legal-articles.json JSON invalido — ' + e.message);
  process.exit(1);
}

// ── Construir lookup de legal-articles (excluir _meta) ────────────────────
var legalLookup = {};
Object.keys(legalArticles).forEach(function (key) {
  if (key !== '_meta') {
    legalLookup[key] = legalArticles[key];
  }
});

// ── Merge claims ──────────────────────────────────────────────────────────
var enrichedCount = 0;
var unenrichedCount = 0;

var mergedClaims = afirmaciones.claims.map(function (claim) {
  var legal = legalLookup[claim.data_key] || null;

  // Resolver fuente_url desde sources
  var fuente_url = null;
  var fuente_tipo = null;
  if (claim.source_id && afirmaciones.sources[claim.source_id]) {
    var src = afirmaciones.sources[claim.source_id];
    fuente_url = src.url || null;
    fuente_tipo = src.type || null;
  }

  // Derivar pregunta
  var pregunta = PREGUNTA_MAP[claim.id] || claim.claim;

  if (legal) {
    enrichedCount++;
  } else {
    unenrichedCount++;
  }

  return {
    id: claim.id,
    tags: claim.tags,
    pregunta: pregunta,
    respuesta: claim.claim,
    displayed_value: claim.displayed_value !== undefined ? claim.displayed_value : null,
    data_key: claim.data_key,
    data_path: claim.data_path || null,
    source_id: claim.source_id || null,
    source_reference: claim.source_reference || null,
    fuente_url: fuente_url,
    fuente_tipo: fuente_tipo,
    extracto_verbatim: legal ? legal.texto_verbatim : null,
    hash_sha256: legal ? legal.hash_sha256 : null,
    last_checked: legal ? legal.last_checked : null,
    articulo_numero: legal ? legal.articulo_numero : null,
    inciso: legal ? (legal.inciso !== undefined ? legal.inciso : null) : null,
    texto_anterior: legal ? (legal.texto_anterior !== undefined ? legal.texto_anterior : null) : null,
    verification_method: claim.verification_method || null,
    verification_tier: claim.verification_tier !== undefined ? claim.verification_tier : null,
    expected_check: claim.expected_check !== undefined ? claim.expected_check : null,
    last_verified: claim.last_verified !== undefined ? claim.last_verified : null,
    last_verified_by: claim.last_verified_by !== undefined ? claim.last_verified_by : null,
    status: claim.status || null
  };
});

// ── Construir output ──────────────────────────────────────────────────────
var claimsOutput = {
  _meta: {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    description: 'Modelo unificado de claims. Fuente de verdad para todas las afirmaciones del sitio.',
    totalClaims: mergedClaims.length,
    model: 'claim-centric-unified',
    merged_from: ['afirmaciones.json', 'legal-articles.json']
  },
  sources: afirmaciones.sources,
  claims: mergedClaims
};

// ── Escribir output ───────────────────────────────────────────────────────
fs.writeFileSync(claimsOutputPath, JSON.stringify(claimsOutput, null, 2), 'utf8');

// ── Resumen ───────────────────────────────────────────────────────────────
console.log('');
console.log('=== merge-claims.js ===');
console.log('  Total claims:    ' + mergedClaims.length);
console.log('  Enriquecidos:    ' + enrichedCount + ' (con extracto verbatim de BCN)');
console.log('  Sin enriquecer:  ' + unenrichedCount + ' (sin entrada en legal-articles.json)');
console.log('  Fuentes:         ' + Object.keys(afirmaciones.sources).length);
console.log('  Output:          data/claims.json');
console.log('');
console.log('  OK — claims.json generado');
