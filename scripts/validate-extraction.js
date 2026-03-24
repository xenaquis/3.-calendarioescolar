#!/usr/bin/env node
/* validate-extraction.js — Validacion determinista de extraccion visual
   Uso: node scripts/validate-extraction.js [opciones]
   Opciones:
     --input=PATH    Validar archivo especifico (default: data/visual-extraction.json)
     --region=SLUG   Validar solo una region
     --strict        Tratar advertencias como errores
     --year=NNNN     Año esperado (default: 2026)
   Sale con codigo 0 = OK, 1 = errores encontrados.
*/

'use strict';

var fs = require('fs');
var path = require('path');

// ── CLI parsing ──────────────────────────────────────────────────────────────

var args = process.argv.slice(2);
var FLAG_STRICT = args.indexOf('--strict') !== -1;

var FLAG_INPUT = null;
var FLAG_REGION = null;
var FLAG_YEAR = 2026;

args.forEach(function (arg) {
  var m;
  m = arg.match(/^--input=(.+)$/);
  if (m) { FLAG_INPUT = m[1]; return; }
  m = arg.match(/^--region=(.+)$/);
  if (m) { FLAG_REGION = m[1]; return; }
  m = arg.match(/^--year=(\d{4})$/);
  if (m) { FLAG_YEAR = parseInt(m[1], 10); return; }
});

// ── Paths ────────────────────────────────────────────────────────────────────

var ROOT = path.resolve(__dirname, '..');
var DEFAULT_INPUT = path.join(ROOT, 'data', 'visual-extraction.json');
var INPUT_PATH = FLAG_INPUT ? path.resolve(FLAG_INPUT) : DEFAULT_INPUT;
var REPORT_PATH = path.join(ROOT, 'data', 'extraction-validation-report.json');

// ── Colors ───────────────────────────────────────────────────────────────────

var USE_COLORS = process.stdout.isTTY;
var C = {
  green:  function (s) { return USE_COLORS ? '\x1b[32m' + s + '\x1b[0m' : s; },
  red:    function (s) { return USE_COLORS ? '\x1b[31m' + s + '\x1b[0m' : s; },
  yellow: function (s) { return USE_COLORS ? '\x1b[33m' + s + '\x1b[0m' : s; },
  bold:   function (s) { return USE_COLORS ? '\x1b[1m' + s + '\x1b[0m' : s; }
};

// ── Spanish day names ────────────────────────────────────────────────────────

var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
var DIAS_NORM = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function normalizeDia(dia) {
  if (!dia) return '';
  // Remove accents and lowercase
  return dia.toLowerCase()
    .replace(/é/g, 'e')
    .replace(/á/g, 'a')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ü/g, 'u')
    .trim();
}

function getDayOfWeekES(dateStr) {
  // Parse as UTC to avoid timezone off-by-one
  var parts = dateStr.split('-');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10) - 1;
  var d = parseInt(parts[2], 10);
  var dt = new Date(Date.UTC(y, m, d));
  return DIAS[dt.getUTCDay()];
}

// ── Expected regional groups ─────────────────────────────────────────────────

var EXPECTED_GROUPS = {
  'ESTANDAR': {
    regions: ['antofagasta', 'atacama', 'coquimbo', 'valparaiso', 'metropolitana', 'ohiggins', 'maule', 'nuble', 'biobio', 'araucania', 'los-rios'],
    vacacionesInicio: '2026-06-22',
    vacacionesFin: '2026-07-03',
    finAno: '2026-12-04'
  },
  'NORTE': {
    regions: ['arica-y-parinacota', 'tarapaca'],
    vacacionesInicio: '2026-07-13',
    vacacionesFin: '2026-07-24',
    finAno: '2026-12-04'
  },
  'SUR': {
    regions: ['aysen', 'magallanes'],
    vacacionesInicio: '2026-06-29',
    vacacionesFin: '2026-07-17',
    finAno: '2026-12-11'
  },
  'SUR-PARCIAL': {
    regions: ['los-lagos'],
    vacacionesInicio: '2026-07-06',
    vacacionesFin: '2026-07-17',
    finAno: '2026-12-04'
  }
};

// Map region -> expected group name
var REGION_TO_GROUP = {};
Object.keys(EXPECTED_GROUPS).forEach(function (gName) {
  EXPECTED_GROUPS[gName].regions.forEach(function (r) {
    REGION_TO_GROUP[r] = gName;
  });
});

// ── Date format regex ────────────────────────────────────────────────────────

var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(str) {
  if (!DATE_RE.test(str)) return false;
  var d = new Date(str);
  return d instanceof Date && !isNaN(d.getTime());
}

function getYear(dateStr) {
  return parseInt(dateStr.split('-')[0], 10);
}

// ── Extract dates from semestral/trimestral array ────────────────────────────

function extractDatesFromArray(arr) {
  var dates = [];
  if (!Array.isArray(arr)) return dates;
  arr.forEach(function (item) {
    if (item.date && item.date !== null) dates.push({ field: 'date', value: item.date, label: item.label });
    if (item.date_start && item.date_start !== null) dates.push({ field: 'date_start', value: item.date_start, label: item.label });
    if (item.date_end && item.date_end !== null) dates.push({ field: 'date_end', value: item.date_end, label: item.label });
  });
  return dates;
}

// Find receso invierno dates in semestral array
function findRecesoInvierno(semestral) {
  if (!Array.isArray(semestral)) return null;
  for (var i = 0; i < semestral.length; i++) {
    var item = semestral[i];
    var lbl = (item.label || '').toLowerCase();
    if (lbl.indexOf('receso') !== -1 && (lbl.indexOf('invierno') !== -1 || lbl.indexOf('vacacion') !== -1)) {
      return item;
    }
    if (lbl.indexOf('vacaciones de invierno') !== -1) return item;
  }
  return null;
}

// Find fin ano date in semestral array (JEC)
function findFinAno(semestral) {
  if (!Array.isArray(semestral)) return null;
  for (var i = 0; i < semestral.length; i++) {
    var item = semestral[i];
    var lbl = (item.label || '').toLowerCase();
    if ((lbl.indexOf('ltimo') !== -1 || lbl.indexOf('ultimo') !== -1) &&
        (lbl.indexOf('jec') !== -1 || lbl.indexOf('38') !== -1)) {
      return item;
    }
  }
  // fallback: last "ultimo dia" entry
  var lastUltimo = null;
  for (var j = 0; j < semestral.length; j++) {
    var it = semestral[j];
    var lb = (it.label || '').toLowerCase();
    if (lb.indexOf('ltimo') !== -1 || lb.indexOf('ultimo') !== -1) {
      if (lb.indexOf('clases') !== -1) {
        lastUltimo = it;
      }
    }
  }
  return lastUltimo;
}

// ── Validation checks ────────────────────────────────────────────────────────

function checkDateFormat(regionSlug, semestral, trimestral, errors, warnings, regionData) {
  // Skip date format checks for flat-field format (uses Spanish strings)
  if (regionData && (regionData.vacacionesInicio || regionData.inicio || regionData.finAno)) return;
  var allDates = extractDatesFromArray(semestral).concat(extractDatesFromArray(trimestral));
  allDates.forEach(function (d) {
    if (!DATE_RE.test(d.value)) {
      errors.push('Fecha con formato invalido en "' + d.label + '" campo ' + d.field + ': "' + d.value + '" (se esperaba YYYY-MM-DD)');
    } else if (!isValidDate(d.value)) {
      errors.push('Fecha invalida en "' + d.label + '" campo ' + d.field + ': "' + d.value + '"');
    }
  });
}

function checkYear(regionSlug, semestral, trimestral, errors, warnings, expectedYear, regionData) {
  // Skip year checks for flat-field format
  if (regionData && (regionData.vacacionesInicio || regionData.inicio || regionData.finAno)) return;
  var allDates = extractDatesFromArray(semestral).concat(extractDatesFromArray(trimestral));
  allDates.forEach(function (d) {
    if (DATE_RE.test(d.value)) {
      var y = getYear(d.value);
      if (y !== expectedYear) {
        errors.push('Año incorrecto en "' + d.label + '" campo ' + d.field + ': ' + d.value + ' (esperado ' + expectedYear + ')');
      }
    }
  });
}

function checkDayOfWeek(regionSlug, semestral, trimestral, errors, warnings) {
  var combined = (semestral || []).concat(trimestral || []);
  combined.forEach(function (item) {
    if (!item.day_of_week || !item.date) return;
    if (!DATE_RE.test(item.date)) return;
    var expected = getDayOfWeekES(item.date);
    if (normalizeDia(item.day_of_week) !== normalizeDia(expected)) {
      errors.push('Dia de semana incorrecto en "' + item.label + '": dice "' + item.day_of_week + '" pero ' + item.date + ' es ' + expected);
    }
  });
}

function checkChronological(regionSlug, semestral, trimestral, errors, warnings) {
  function checkArray(arr, arrayName) {
    if (!Array.isArray(arr)) return;
    var prevDate = null;
    arr.forEach(function (item) {
      // Check date_start < date_end for range items
      if (item.date_start && item.date_end) {
        if (DATE_RE.test(item.date_start) && DATE_RE.test(item.date_end)) {
          if (item.date_start >= item.date_end) {
            errors.push('Rango invalido en ' + arrayName + ' "' + item.label + '": date_start ' + item.date_start + ' >= date_end ' + item.date_end);
          }
        }
      }

      // Determine this item's "effective date" for chronological check
      var effectiveDate = item.date_end || item.date_start || item.date;
      if (!effectiveDate || effectiveDate === null) return;
      if (!DATE_RE.test(effectiveDate)) return;

      if (prevDate && effectiveDate < prevDate) {
        warnings.push('Orden cronologico: ' + arrayName + ' "' + item.label + '" (' + effectiveDate + ') antes que hito previo (' + prevDate + ')');
      }
      prevDate = effectiveDate;
    });
  }

  checkArray(semestral, 'semestral');
  checkArray(trimestral, 'trimestral');
}

function checkRequiredMilestones(regionSlug, semestral, trimestral, errors, warnings, regionData) {
  // If region has flat-field format (vacacionesInicio, finAno), skip detailed milestone checks
  // since the flat format doesn't carry labeled milestones
  if (regionData && (regionData.vacacionesInicio || regionData.inicio || regionData.finAno)) {
    return; // flat-field format: milestone labels not available, skip
  }

  var combined = (semestral || []).concat(trimestral || []);

  // If no semestral/trimestral data at all, downgrade errors to warnings
  var noDetailedData = combined.length === 0;

  var labels = combined.map(function (i) { return (i.label || '').toLowerCase(); });

  var hasInicio = labels.some(function (l) { return l.indexOf('inicio') !== -1; });
  if (!hasInicio) {
    if (noDetailedData) {
      warnings.push('Sin datos semestral/trimestral — no se puede verificar hito "Inicio"');
    } else {
      errors.push('No se encontro ningun hito con "Inicio" (inicio del año escolar)');
    }
  }

  var hasReceso = labels.some(function (l) {
    return (l.indexOf('receso') !== -1 || l.indexOf('vacacion') !== -1) &&
           (l.indexOf('invierno') !== -1 || l.indexOf('receso') !== -1);
  });
  if (!hasReceso) {
    warnings.push('No se encontro hito de receso de invierno / vacaciones');
  }

  var hasUltimo = labels.some(function (l) {
    return (l.indexOf('ltimo') !== -1 || l.indexOf('ultimo') !== -1) && l.indexOf('cl') !== -1;
  });
  if (!hasUltimo) {
    if (noDetailedData) {
      warnings.push('Sin datos semestral/trimestral — no se puede verificar hito "Ultimo dia"');
    } else {
      errors.push('No se encontro ningun hito con "Ultimo dia" (fin del año escolar)');
    }
  }
}

// Parse Spanish date string "4 de marzo" or "22 de junio" to YYYY-MM-DD
var MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];

function parseSpanishDate(str, year) {
  if (!str) return null;
  var m = str.match(/(\d+)\s+de\s+(\w+)/i);
  if (!m) return null;
  var day = parseInt(m[1], 10);
  var monthName = m[2].toLowerCase();
  var monthIdx = MONTHS_ES.indexOf(monthName);
  if (monthIdx === -1) return null;
  var mo = String(monthIdx + 1).padStart(2, '0');
  var da = String(day).padStart(2, '0');
  return year + '-' + mo + '-' + da;
}

// ── Cross-region check ───────────────────────────────────────────────────────

function checkCrossRegion(regions, regionErrors, regionWarnings) {
  var crossErrors = [];
  var crossWarnings = [];
  var groupsDetected = { 'ESTANDAR': [], 'NORTE': [], 'SUR': [], 'SUR-PARCIAL': [] };
  var anomalies = [];

  Object.keys(regions).forEach(function (slug) {
    var region = regions[slug];
    var semestral = region.semestral || [];

    var actualVacInicio = null;
    var actualVacFin = null;
    var actualFinAno = null;

    // Detect format: flat-field vs semestral array
    var isFlatFormat = !!(region.vacacionesInicio || region.inicio || region.finAno);

    if (isFlatFormat) {
      // Flat format: parse Spanish dates
      actualVacInicio = parseSpanishDate(region.vacacionesInicio, FLAG_YEAR);
      actualVacFin = parseSpanishDate(region.vacacionesFin, FLAG_YEAR);
      actualFinAno = parseSpanishDate(region.finAno, FLAG_YEAR);
    } else {
      // Detailed semestral array format
      var receso = findRecesoInvierno(semestral);
      var finAnoItem = findFinAno(semestral);
      actualVacInicio = receso ? (receso.date_start || receso.date) : null;
      actualVacFin = receso ? (receso.date_end || null) : null;
      actualFinAno = finAnoItem ? (finAnoItem.date || null) : null;
    }

    var expectedGroup = REGION_TO_GROUP[slug];

    if (!expectedGroup) {
      crossWarnings.push(slug + ': region no reconocida, no tiene grupo esperado definido');
      return;
    }

    var group = EXPECTED_GROUPS[expectedGroup];

    // Check if matches expected group
    var vacInicioOk = !actualVacInicio || actualVacInicio === group.vacacionesInicio;
    var vacFinOk = !actualVacFin || actualVacFin === group.vacacionesFin;
    var finAnoOk = !actualFinAno || actualFinAno === group.finAno;

    var matchesExpected = vacInicioOk && vacFinOk && finAnoOk;

    if (matchesExpected) {
      groupsDetected[expectedGroup].push(slug);
    } else {
      // Check if matches any other group
      var matchedOtherGroup = null;
      Object.keys(EXPECTED_GROUPS).forEach(function (gName) {
        if (gName === expectedGroup) return;
        var g = EXPECTED_GROUPS[gName];
        var vio = !actualVacInicio || actualVacInicio === g.vacacionesInicio;
        var vfo = !actualVacFin || actualVacFin === g.vacacionesFin;
        var fao = !actualFinAno || actualFinAno === g.finAno;
        if (vio && vfo && fao) {
          matchedOtherGroup = gName;
        }
      });

      if (matchedOtherGroup) {
        var anomaly = {
          region: slug,
          expected_group: expectedGroup,
          actual_matches: matchedOtherGroup,
          severity: 'warning',
          details: 'Region asignada a ' + expectedGroup + ' pero fechas coinciden con ' + matchedOtherGroup
        };
        anomalies.push(anomaly);
        crossWarnings.push(slug + ': posible reclasificacion — fechas coinciden con ' + matchedOtherGroup + ' pero esperado ' + expectedGroup);
        groupsDetected[expectedGroup].push(slug + '(?)');
      } else {
        // Does not match any group
        var details = [];
        if (actualVacInicio && actualVacInicio !== group.vacacionesInicio) {
          details.push('vacacionesInicio: extraido=' + actualVacInicio + ' esperado=' + group.vacacionesInicio);
        }
        if (actualVacFin && actualVacFin !== group.vacacionesFin) {
          details.push('vacacionesFin: extraido=' + actualVacFin + ' esperado=' + group.vacacionesFin);
        }
        if (actualFinAno && actualFinAno !== group.finAno) {
          details.push('finAno: extraido=' + actualFinAno + ' esperado=' + group.finAno);
        }

        if (details.length > 0) {
          var anomalyErr = {
            region: slug,
            expected_group: expectedGroup,
            actual_matches: null,
            severity: 'error',
            details: details.join('; ')
          };
          anomalies.push(anomalyErr);
          crossErrors.push(slug + ': fechas no coinciden con ningun grupo. ' + details.join('; '));
        } else {
          // dates are null/missing — just track as expected group
          groupsDetected[expectedGroup].push(slug);
        }
      }
    }
  });

  return {
    errors: crossErrors,
    warnings: crossWarnings,
    groups_detected: groupsDetected,
    anomalies: anomalies
  };
}

// ── Main validation ──────────────────────────────────────────────────────────

function main() {
  console.log(C.bold('\n=== Validacion de Extraccion Visual ==='));
  console.log('Input: ' + INPUT_PATH);
  console.log('Año esperado: ' + FLAG_YEAR);
  if (FLAG_REGION) console.log('Region: ' + FLAG_REGION);
  if (FLAG_STRICT) console.log('Modo: estricto (warnings = errors)');
  console.log('');

  // Load input file
  if (!fs.existsSync(INPUT_PATH)) {
    console.log(C.red('ERROR: Archivo no encontrado: ' + INPUT_PATH));
    process.exit(1);
  }

  var data;
  try {
    data = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  } catch (e) {
    console.log(C.red('ERROR: JSON invalido en ' + INPUT_PATH + ': ' + e.message));
    process.exit(1);
  }

  var regions = data.regions;
  if (!regions || typeof regions !== 'object') {
    console.log(C.red('ERROR: El JSON no tiene campo "regions" valido'));
    process.exit(1);
  }

  // Filter by region if specified
  if (FLAG_REGION) {
    if (!regions[FLAG_REGION]) {
      console.log(C.red('ERROR: Region "' + FLAG_REGION + '" no encontrada en el archivo'));
      process.exit(1);
    }
    var filtered = {};
    filtered[FLAG_REGION] = regions[FLAG_REGION];
    regions = filtered;
  }

  var regionSlugs = Object.keys(regions);
  var perRegion = {};

  // Check results per category
  var checkResults = {
    date_format:         { errors: [], warnings: [] },
    day_of_week:         { errors: [], warnings: [] },
    chronological:       { errors: [], warnings: [] },
    required_milestones: { errors: [], warnings: [] }
  };

  // Per-region checks
  regionSlugs.forEach(function (slug) {
    var region = regions[slug];
    var semestral = region.semestral || [];
    var trimestral = region.trimestral || [];

    var rErrors = [];
    var rWarnings = [];

    checkDateFormat(slug, semestral, trimestral, rErrors, rWarnings, region);
    checkYear(slug, semestral, trimestral, rErrors, rWarnings, FLAG_YEAR, region);
    checkDayOfWeek(slug, semestral, trimestral, rErrors, rWarnings);
    checkChronological(slug, semestral, trimestral, rErrors, rWarnings);
    checkRequiredMilestones(slug, semestral, trimestral, rErrors, rWarnings, region);

    perRegion[slug] = {
      passed: rErrors.length === 0,
      errors: rErrors,
      warnings: rWarnings,
      group: REGION_TO_GROUP[slug] || 'DESCONOCIDO'
    };

    // Accumulate into check results (simplified — all errors rolled up)
    if (rErrors.length > 0) {
      rErrors.forEach(function (e) {
        checkResults.date_format.errors.push(slug + ': ' + e);
      });
    }
    if (rWarnings.length > 0) {
      rWarnings.forEach(function (w) {
        checkResults.date_format.warnings.push(slug + ': ' + w);
      });
    }
  });

  // Cross-region check
  var crossResult = checkCrossRegion(regions, {}, {});

  // Summary counts
  var totalErrors = 0;
  var totalWarnings = 0;
  var regionsPassed = 0;
  var regionsFailed = 0;

  regionSlugs.forEach(function (slug) {
    var r = perRegion[slug];
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
    if (r.errors.length === 0) { regionsPassed++; } else { regionsFailed++; }
  });

  totalErrors += crossResult.errors.length;
  totalWarnings += crossResult.warnings.length;

  if (FLAG_STRICT) {
    totalErrors += totalWarnings;
  }

  // ── Console output ────────────────────────────────────────────────────────

  // Per-region report
  console.log(C.bold('Regiones validadas:'));
  regionSlugs.forEach(function (slug) {
    var r = perRegion[slug];
    var icon = r.errors.length === 0 ? C.green('[OK]') : C.red('[FAIL]');
    var warnStr = r.warnings.length > 0 ? C.yellow(' ' + r.warnings.length + ' warn') : '';
    console.log('  ' + icon + ' ' + slug + ' (grupo: ' + r.group + ')' + warnStr);
    r.errors.forEach(function (e) { console.log('       ' + C.red('E: ' + e)); });
    r.warnings.forEach(function (w) { console.log('       ' + C.yellow('W: ' + w)); });
  });

  // Cross-region summary
  console.log('');
  console.log(C.bold('Analisis cross-region:'));
  Object.keys(crossResult.groups_detected).forEach(function (gName) {
    var detected = crossResult.groups_detected[gName];
    var expected = EXPECTED_GROUPS[gName].regions.length;
    var icon = detected.length > 0 ? C.green('[OK]') : C.yellow('[ ? ]');
    console.log('  ' + icon + ' ' + gName + ': ' + detected.join(', ') + ' (' + detected.length + '/' + expected + ')');
  });

  if (crossResult.anomalies.length > 0) {
    console.log('');
    console.log(C.yellow('Anomalias detectadas:'));
    crossResult.anomalies.forEach(function (a) {
      var icon = a.severity === 'error' ? C.red('[ERROR]') : C.yellow('[WARN]');
      console.log('  ' + icon + ' ' + a.region + ': ' + a.details);
    });
  }

  if (crossResult.errors.length > 0) {
    crossResult.errors.forEach(function (e) { console.log('  ' + C.red('E: ' + e)); });
  }
  if (crossResult.warnings.length > 0) {
    crossResult.warnings.forEach(function (w) { console.log('  ' + C.yellow('W: ' + w)); });
  }

  // Final line
  console.log('');
  var finalErrors = FLAG_STRICT ? (totalErrors) : (totalErrors - (FLAG_STRICT ? 0 : 0));
  // Recount for final line
  var errCount = 0;
  regionSlugs.forEach(function (s) { errCount += perRegion[s].errors.length; });
  errCount += crossResult.errors.length;
  var warnCount = 0;
  regionSlugs.forEach(function (s) { warnCount += perRegion[s].warnings.length; });
  warnCount += crossResult.warnings.length;

  var effectiveErrors = FLAG_STRICT ? errCount + warnCount : errCount;

  if (effectiveErrors === 0) {
    console.log(C.green(C.bold('VALIDATION: PASSED (' + errCount + ' errors, ' + warnCount + ' warnings)')));
  } else {
    console.log(C.red(C.bold('VALIDATION: FAILED (' + errCount + ' errors, ' + warnCount + ' warnings)')));
  }
  console.log('');

  // ── Write report ──────────────────────────────────────────────────────────

  var checksDateFormat = { passed: true, errors: [] };
  var checksDayOfWeek = { passed: true, errors: [] };
  var checksChronological = { passed: true, errors: [] };
  var checksRequired = { passed: true, errors: [] };

  regionSlugs.forEach(function (slug) {
    var r = perRegion[slug];
    r.errors.forEach(function (e) {
      // Bucket errors approximately (simplified — all go to date_format for now)
      var el = e.toLowerCase();
      if (el.indexOf('dia de semana') !== -1 || el.indexOf('dia') !== -1 && el.indexOf('semana') !== -1) {
        checksDayOfWeek.errors.push(slug + ': ' + e);
        checksDayOfWeek.passed = false;
      } else if (el.indexOf('cronol') !== -1 || el.indexOf('orden') !== -1 || el.indexOf('rango') !== -1) {
        checksChronological.errors.push(slug + ': ' + e);
        checksChronological.passed = false;
      } else if (el.indexOf('inicio') !== -1 || el.indexOf('ltimo') !== -1 || el.indexOf('ultimo') !== -1) {
        checksRequired.errors.push(slug + ': ' + e);
        checksRequired.passed = false;
      } else {
        checksDateFormat.errors.push(slug + ': ' + e);
        checksDateFormat.passed = false;
      }
    });
  });

  var report = {
    timestamp: new Date().toISOString(),
    input: INPUT_PATH,
    summary: {
      regions_checked: regionSlugs.length,
      regions_passed: regionsPassed,
      regions_failed: regionsFailed,
      total_errors: errCount,
      total_warnings: warnCount
    },
    checks: {
      date_format: checksDateFormat,
      day_of_week: checksDayOfWeek,
      chronological: checksChronological,
      required_milestones: checksRequired,
      cross_region: {
        passed: crossResult.errors.length === 0,
        groups_detected: crossResult.groups_detected,
        anomalies: crossResult.anomalies,
        errors: crossResult.errors,
        warnings: crossResult.warnings
      }
    },
    per_region: perRegion
  };

  try {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log('Reporte escrito en: ' + REPORT_PATH);
  } catch (e) {
    console.log(C.yellow('WARN: No se pudo escribir el reporte: ' + e.message));
  }

  process.exit(effectiveErrors > 0 ? 1 : 0);
}

main();
