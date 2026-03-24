#!/usr/bin/env node
/**
 * organize-snapshots.js — Organiza PNGs de tablas con nomenclatura canonica.
 *
 * Lee data/extraction-tests/TODAS-REGIONES-visual-extraction.json para saber
 * cuales paginas de cada region contienen tablas (campo "images").
 *
 * Copia esas PNGs desde data/extraction-tests/ a data/snapshots/ con nombre:
 *   {regionSlug}-tabla-p{N}.png  (N = indice secuencial, empieza en 1)
 *
 * Genera data/snapshots/png-manifest.json con estructura:
 *   { generated, regions: { slug: { table_pngs, source_pages, grupo } } }
 *
 * Uso: node scripts/organize-snapshots.js [--source-dir=PATH]
 *
 * --source-dir  Directorio con los PNGs fuente y el JSON (default: data/extraction-tests)
 *              Si no existe relativo al proyecto, intenta como ruta absoluta.
 */

'use strict';

var fs = require('fs');
var path = require('path');

// ── Paths ────────────────────────────────────────────────────────────────────

var ROOT = path.resolve(__dirname, '..');

// Parseo minimo de args (sin dependencias externas)
var args = process.argv.slice(2);
var sourceArgPrefix = '--source-dir=';
var sourceArgIdx = args.findIndex(function (a) { return a.indexOf(sourceArgPrefix) === 0; });
var SOURCE_DIR_ARG = sourceArgIdx >= 0 ? args[sourceArgIdx].slice(sourceArgPrefix.length) : null;

/**
 * Resuelve el directorio de extraccion (donde estan los PNGs fuente y el JSON).
 * Busca en orden:
 *   1. --source-dir argumento CLI
 *   2. data/extraction-tests relativo al proyecto
 *   3. data/extraction-tests en el proyecto padre (para worktrees)
 */
function resolveSourceDir() {
  if (SOURCE_DIR_ARG) {
    if (fs.existsSync(SOURCE_DIR_ARG)) return SOURCE_DIR_ARG;
    console.error('WARNING: --source-dir no existe: ' + SOURCE_DIR_ARG);
  }

  // Ruta estandar (main project o worktree con datos propios)
  var standard = path.join(ROOT, 'data', 'extraction-tests');
  if (fs.existsSync(standard)) return standard;

  // Worktree: el proyecto esta en .claude/worktrees/agent-xxx/
  // Sube 3 niveles: agent-xxx -> worktrees -> .claude -> proyecto
  var parentProject = path.resolve(ROOT, '..', '..', '..');
  var parentExtraction = path.join(parentProject, 'data', 'extraction-tests');
  if (fs.existsSync(parentExtraction)) {
    console.error('INFO: Usando datos de proyecto principal: ' + parentExtraction);
    return parentExtraction;
  }

  return null;
}

var EXTRACTION_DIR = resolveSourceDir();
var JSON_PATH = EXTRACTION_DIR ? path.join(EXTRACTION_DIR, 'TODAS-REGIONES-visual-extraction.json') : null;
var SNAPSHOTS_DIR = path.join(ROOT, 'data', 'snapshots');
var MANIFEST_PATH = path.join(SNAPSHOTS_DIR, 'png-manifest.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrae el numero de pagina de un nombre de PNG como "aysen-p2.png" → 2
 */
function extractPageNum(pngName) {
  var match = pngName.match(/-p(\d+)\.png$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Copia un archivo de src a dst, creando el directorio destino si es necesario.
 */
function copyFile(src, dst) {
  var dstDir = path.dirname(dst);
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }
  var buf = fs.readFileSync(src);
  fs.writeFileSync(dst, buf);
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // Validar que tenemos el directorio fuente
  if (!EXTRACTION_DIR || !fs.existsSync(EXTRACTION_DIR)) {
    console.error('ERROR: No se encontro directorio de extraccion. Use --source-dir=PATH');
    process.exit(1);
  }

  if (!fs.existsSync(JSON_PATH)) {
    console.error('ERROR: No se encontro ' + JSON_PATH);
    process.exit(1);
  }

  // Crear directorio destino si no existe
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }

  // Leer JSON de extraccion
  var extraction = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  var regions = extraction.regions || {};

  var manifest = {
    generated: new Date().toISOString(),
    regions: {},
  };

  var totalPngs = 0;
  var totalRegions = 0;
  var skipped = [];

  // Ordenar regiones para output determinista
  var regionSlugs = Object.keys(regions);

  regionSlugs.forEach(function (slug) {
    var regionData = regions[slug];
    var images = regionData.images || [];

    if (images.length === 0) {
      console.error('WARNING: ' + slug + ' no tiene imagenes definidas');
      return;
    }

    // Ordenar imagenes por numero de pagina para asegurar orden correcto
    var sortedImages = images.slice().sort(function (a, b) {
      return extractPageNum(a) - extractPageNum(b);
    });

    var tablePngs = [];
    var sourcePages = [];

    sortedImages.forEach(function (srcPng, idx) {
      var tablaName = slug + '-tabla-p' + (idx + 1) + '.png';
      var srcPath = path.join(EXTRACTION_DIR, srcPng);
      var dstPath = path.join(SNAPSHOTS_DIR, tablaName);

      if (!fs.existsSync(srcPath)) {
        console.error('WARNING: No se encontro PNG fuente: ' + srcPath);
        skipped.push(srcPng);
        return;
      }

      copyFile(srcPath, dstPath);
      tablePngs.push(tablaName);
      sourcePages.push(extractPageNum(srcPng));
      totalPngs++;
    });

    if (tablePngs.length > 0) {
      manifest.regions[slug] = {
        table_pngs: tablePngs,
        source_pages: sourcePages,
        grupo: regionData.grupo || 'ESTANDAR',
      };
      totalRegions++;
    }
  });

  // Escribir manifest
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('Organized ' + totalPngs + ' PNGs for ' + totalRegions + ' regions');
  if (skipped.length > 0) {
    console.log('Skipped ' + skipped.length + ' missing PNGs: ' + skipped.join(', '));
  }
  console.log('Manifest: ' + MANIFEST_PATH);
}

main();
