#!/usr/bin/env node
/* generate-verificacion.js — Genera public/data/verificacion.json
   Alimenta los badges de verificación del frontend (Fase 4).

   Lee:
     - data/afirmaciones.json       (claims y sources)
     - data/source-health.json      (estado de fuentes — Fase 2)
     - data/verification-results.json (resultados Fase 3, opcional)

   Genera:
     - public/data/verificacion.json
*/

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];

// Map first claim tag to frontend section ID
var TAG_SECTION_MAP = {
  'fechas_escolares': 'school-dates',
  'feriados': 'holidays',
  'regional': 'school-dates',
  'derivados': 'stats',
  'contextuales': 'context'
};

// Status priority (worst first)
var STATUS_PRIORITY = ['incorrecto', 'fuente_inaccesible', 'no_verificable', 'unverified', 'correcto'];

function tagToSection(tags) {
  if (!tags || tags.length === 0) return 'other';
  return TAG_SECTION_MAP[tags[0]] || 'other';
}

function worstOf(a, b) {
  var ia = STATUS_PRIORITY.indexOf(a);
  var ib = STATUS_PRIORITY.indexOf(b);
  if (ia === -1) ia = STATUS_PRIORITY.length;
  if (ib === -1) ib = STATUS_PRIORITY.length;
  return ia < ib ? a : b;
}

function formatDateEs(isoString) {
  if (!isoString) return null;
  var d = new Date(isoString);
  return d.getDate() + ' de ' + MONTHS_ES[d.getMonth()] + ' de ' + d.getFullYear();
}

function main() {
  // Load afirmaciones (required)
  var afirmacionesPath = path.join(ROOT, 'data', 'afirmaciones.json');
  if (!fs.existsSync(afirmacionesPath)) {
    console.log('generate-verificacion: data/afirmaciones.json no encontrado — omitiendo');
    return;
  }
  var afirmaciones = JSON.parse(fs.readFileSync(afirmacionesPath, 'utf8'));

  // Load source-health (optional — Fase 2)
  var sourceHealth = null;
  var sourceHealthPath = path.join(ROOT, 'data', 'source-health.json');
  if (fs.existsSync(sourceHealthPath)) {
    try {
      sourceHealth = JSON.parse(fs.readFileSync(sourceHealthPath, 'utf8'));
    } catch (e) { /* ignore */ }
  }

  // Load verification-results (optional — Fase 3)
  var verResults = null;
  var verResultsPath = path.join(ROOT, 'data', 'verification-results.json');
  if (fs.existsSync(verResultsPath)) {
    try {
      verResults = JSON.parse(fs.readFileSync(verResultsPath, 'utf8'));
    } catch (e) { /* ignore */ }
  }

  // Index verification results by claim ID
  var resultsById = {};
  if (verResults && verResults.results) {
    verResults.results.forEach(function(r) {
      resultsById[r.id] = r;
    });
  }

  // Index source health by source ID
  var sourceStatusById = {};
  if (sourceHealth && sourceHealth.sources) {
    Object.keys(sourceHealth.sources).forEach(function(id) {
      sourceStatusById[id] = sourceHealth.sources[id].status;
    });
  }

  // Group claims into sections
  var sections = {};
  var totalVerified = 0;
  var totalUnverified = 0;
  var totalIncorrecto = 0;
  var totalNoVerificable = 0;
  var totalFuenteInaccesible = 0;

  afirmaciones.claims.forEach(function(claim) {
    var sectionId = tagToSection(claim.tags);

    if (!sections[sectionId]) {
      sections[sectionId] = {
        id: sectionId,
        status: 'correcto',
        claims_count: 0,
        sources: [],
        source_ids: [],
        last_verified: null
      };
    }
    var section = sections[sectionId];
    section.claims_count++;

    // Determine claim status
    var claimStatus;
    var verResult = resultsById[claim.id];

    if (verResult) {
      // Has Fase 3 verification result
      claimStatus = verResult.verdict.toLowerCase();
      if (claimStatus === 'correcto') totalVerified++;
      else if (claimStatus === 'incorrecto') totalIncorrecto++;
      else if (claimStatus === 'no_verificable') totalNoVerificable++;
      else if (claimStatus === 'fuente_inaccesible') totalFuenteInaccesible++;

      if (verResult.verified_at) {
        if (!section.last_verified || verResult.verified_at > section.last_verified) {
          section.last_verified = verResult.verified_at;
        }
      }
    } else {
      // No verification result — check source health
      if (claim.source_id && sourceStatusById[claim.source_id] === 'broken') {
        claimStatus = 'fuente_inaccesible';
        totalFuenteInaccesible++;
      } else {
        claimStatus = 'unverified';
        totalUnverified++;
      }
    }

    section.status = worstOf(section.status, claimStatus);

    // Track sources
    if (claim.source_id && afirmaciones.sources[claim.source_id]) {
      var sourceName = afirmaciones.sources[claim.source_id].name;
      if (section.sources.indexOf(sourceName) === -1) {
        section.sources.push(sourceName);
      }
      if (section.source_ids.indexOf(claim.source_id) === -1) {
        section.source_ids.push(claim.source_id);
      }
    }
  });

  // Collect high-level source names for summary
  var allSourceNames = [];
  Object.keys(afirmaciones.sources).forEach(function(id) {
    if (id.indexOf('mineduc') !== -1 && allSourceNames.indexOf('Mineduc') === -1) {
      allSourceNames.push('Mineduc');
    }
    if (id.indexOf('bcn') !== -1 && allSourceNames.indexOf('Biblioteca del Congreso Nacional') === -1) {
      allSourceNames.push('Biblioteca del Congreso Nacional');
    }
  });

  // Build output
  var output = {
    generated_at: new Date().toISOString(),
    summary: {
      total_claims: afirmaciones.claims.length,
      verified: totalVerified,
      unverified: totalUnverified,
      incorrecto: totalIncorrecto,
      no_verificable: totalNoVerificable,
      fuente_inaccesible: totalFuenteInaccesible,
      sources_ok: sourceHealth ? sourceHealth.ok : null,
      sources_total: sourceHealth ? sourceHealth.total_sources : null,
      last_source_check: sourceHealth ? sourceHealth.checked_at : null,
      last_source_check_formatted: sourceHealth ? formatDateEs(sourceHealth.checked_at) : null,
      source_names: allSourceNames,
      has_verification_results: verResults !== null
    },
    sections: sections
  };

  // Ensure output directory exists
  var outputDir = path.join(ROOT, 'public', 'data');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  var outputPath = path.join(outputDir, 'verificacion.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log('Generado public/data/verificacion.json (' +
    afirmaciones.claims.length + ' claims, ' +
    Object.keys(sections).length + ' secciones' +
    (totalVerified > 0 ? ', ' + totalVerified + ' verificados' : '') + ')');
}

main();
