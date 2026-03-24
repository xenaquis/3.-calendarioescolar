#!/usr/bin/env node
/**
 * populate-pages-json.js — Lee data/visual-extraction.json y añade 5 campos
 * adicionales a cada región en data/pages.json:
 *
 *   finAnoSinJEC          <- "Último día de clases establecimiento sin JEC (40 semanas)"
 *   finAnoEPJA            <- "Último día de clases EPJA (36 semanas)"
 *   cierreActas4Medio     <- "Cierre actas 4° Medio"
 *   diaProfesor           <- "Día del profesor"
 *   inicioSegundoSemestre <- "Inicio de clases segundo semestre"
 *
 * Formato de fecha de salida: "DD de mes" (ej: "18 de diciembre")
 *
 * USAGE: node scripts/populate-pages-json.js
 */

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var VISUAL_PATH = path.join(ROOT, 'data', 'visual-extraction.json');
var PAGES_PATH = path.join(ROOT, 'data', 'pages.json');

var MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Convierte fecha ISO "2026-12-18" a "18 de diciembre"
 */
function formatDateES(isoDate) {
  if (!isoDate) return 'Sin datos';
  var parts = isoDate.split('-');
  if (parts.length < 3) return 'Sin datos';
  var day = parseInt(parts[2], 10);
  var monthIdx = parseInt(parts[1], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return 'Sin datos';
  return day + ' de ' + MONTHS_ES[monthIdx];
}

/**
 * Busca en el array de hitos semestral el primer elemento cuyo label
 * contiene alguna de las cadenas de búsqueda (case-insensitive).
 * Devuelve la fecha formateada "DD de mes" o "Sin datos" si no se encuentra.
 */
function findMilestoneDate(semestral, searchTerms) {
  if (!semestral || !semestral.length) return 'Sin datos';
  for (var i = 0; i < semestral.length; i++) {
    var hito = semestral[i];
    if (!hito.label) continue;
    var labelLower = hito.label.toLowerCase();
    var found = false;
    for (var j = 0; j < searchTerms.length; j++) {
      if (labelLower.indexOf(searchTerms[j].toLowerCase()) !== -1) {
        found = true;
        break;
      }
    }
    if (found) {
      var date = hito.date || hito.date_start || null;
      return formatDateES(date);
    }
  }
  return 'Sin datos';
}

// ── Cargar archivos ──────────────────────────────────────────────────────────

if (!fs.existsSync(VISUAL_PATH)) {
  console.error('[ERROR] No se encontró data/visual-extraction.json');
  console.error('  Ejecuta primero: node scripts/extract-visual.js --local');
  process.exit(1);
}

if (!fs.existsSync(PAGES_PATH)) {
  console.error('[ERROR] No se encontró data/pages.json');
  process.exit(1);
}

var visual = JSON.parse(fs.readFileSync(VISUAL_PATH, 'utf8'));
var pages = JSON.parse(fs.readFileSync(PAGES_PATH, 'utf8'));

// ── Mapear milestones a campos de pages.json ─────────────────────────────────

var updated = 0;
var missing = 0;

pages.forEach(function (page) {
  var slug = page.regionSlug;
  if (!slug) {
    console.warn('[WARN] Región sin regionSlug: ' + JSON.stringify(page).substring(0, 50));
    return;
  }

  var regionData = visual.regions && visual.regions[slug];
  if (!regionData) {
    console.warn('[WARN] Sin datos en visual-extraction.json para: ' + slug);
    missing++;
    page.finAnoSinJEC = 'Sin datos';
    page.finAnoEPJA = 'Sin datos';
    page.cierreActas4Medio = 'Sin datos';
    page.diaProfesor = 'Sin datos';
    page.inicioSegundoSemestre = 'Sin datos';
    return;
  }

  var semestral = regionData.semestral || [];

  // finAnoSinJEC: "sin JEC"
  page.finAnoSinJEC = findMilestoneDate(semestral, ['sin jec', 'sin JEC']);

  // finAnoEPJA: "EPJA"
  page.finAnoEPJA = findMilestoneDate(semestral, ['epja', 'EPJA']);

  // cierreActas4Medio: "cierre actas"
  page.cierreActas4Medio = findMilestoneDate(semestral, ['cierre actas', 'Cierre actas']);

  // diaProfesor: "profesor"
  page.diaProfesor = findMilestoneDate(semestral, ['profesor', 'Profesor']);

  // inicioSegundoSemestre: "segundo semestre"
  page.inicioSegundoSemestre = findMilestoneDate(semestral, ['segundo semestre', 'Segundo semestre']);

  updated++;
  console.log('  [OK] ' + slug + ': finSinJEC=' + page.finAnoSinJEC +
    ', EPJA=' + page.finAnoEPJA + ', segSem=' + page.inicioSegundoSemestre);
});

// ── Escribir pages.json actualizado ─────────────────────────────────────────

fs.writeFileSync(PAGES_PATH, JSON.stringify(pages, null, 2), 'utf8');

console.log('\n[OK] pages.json actualizado:');
console.log('  Regiones procesadas: ' + updated);
if (missing > 0) {
  console.warn('  [WARN] Regiones sin datos: ' + missing);
}
console.log('  Campos agregados: finAnoSinJEC, finAnoEPJA, cierreActas4Medio, diaProfesor, inicioSegundoSemestre');
