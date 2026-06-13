#!/usr/bin/env node
/* check-feriados.js — Verificación determinística de feriados (sin red)
   Recalcula los feriados legales de Chile para cal.year desde las reglas
   codificadas en la ley y los compara contra data/calendar-config.json
   (feriadosCompletos). El dato se auto-verifica: detecta feriados faltantes,
   sobrantes, fechas movidas mal y flags irrenunciable incorrectos.

   Uso:    node scripts/check-feriados.js          (exit 0 = OK, 1 = discrepancia)
   Corre:  en build.sh y en el workflow diario (sync-deploy.yml)

   Fuentes de las reglas:
   - Ley 2.977 y modificaciones (listado base) — BCN idNorma=23639
   - Ley 19.668 (traslados 29-jun y 12-oct a lunes) — BCN idNorma=160270
   - Ley 20.148 (16-jul reemplaza Corpus Christi) — BCN idLey=20148
   - Ley 20.299 (31-oct: martes→viernes anterior, miércoles→viernes siguiente)
   - Ley 21.357 (Pueblos Indígenas = solsticio de invierno; tabla anexa)
   - Leyes 19.973 + 20.629 (irrenunciables: 1-ene, 1-may, 18-sep, 19-sep, 25-dic)

   NOTA ANUAL: la tabla SOLSTICIO debe extenderse con la fecha oficial
   (anexo Ley 21.357 / BCN) antes de cargar datos de un año nuevo.
   Si el año no está en la tabla, el script falla a propósito.
*/

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

// Fechas del feriado del solsticio (Ley 21.357, tabla oficial) — extender anualmente
var SOLSTICIO = {
  2024: '06-20',
  2025: '06-20',
  2026: '06-21',
  2027: '06-21',
  2028: '06-20'
};

// Irrenunciables para trabajadores del comercio (Leyes 19.973 + 20.629), como MM-DD
var IRRENUNCIABLES = ['01-01', '05-01', '09-18', '09-19', '12-25'];

function pad(n) { return n < 10 ? '0' + n : String(n); }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }

// Pascua — algoritmo Meeus/Jones/Butcher
function easterDate(year) {
  var a = year % 19, b = Math.floor(year / 100), c = year % 100;
  var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  var g = Math.floor((b - f + 1) / 3);
  var h = (19 * a + b - d - g + 15) % 30;
  var i = Math.floor(c / 4), k = c % 4;
  var l = (32 + 2 * e + 2 * i - h - k) % 7;
  var m = Math.floor((a + 11 * h + 22 * l) / 451);
  var month = Math.floor((h + l - 7 * m + 114) / 31);
  var day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Ley 19.668: feriado se traslada a lunes si cae mar/mié/jue (misma semana)
// o vie (semana siguiente). Sáb, dom y lun no se mueven.
function trasladoLunes(d) {
  var dow = d.getDay(); // 0=dom .. 6=sáb
  if (dow >= 2 && dow <= 4) return addDays(d, 1 - dow);      // mar/mié/jue → lunes anterior
  if (dow === 5) return addDays(d, 3);                        // vie → lunes siguiente
  return d;
}

// Ley 20.299: 31-oct → viernes anterior si cae martes; viernes siguiente si cae miércoles
function trasladoEvangelicas(d) {
  var dow = d.getDay();
  if (dow === 2) return addDays(d, -4); // martes → viernes anterior
  if (dow === 3) return addDays(d, 2);  // miércoles → viernes siguiente
  return d;
}

function computeExpected(year) {
  var easter = easterDate(year);
  var solsticio = SOLSTICIO[year];
  if (!solsticio) {
    console.error('ERROR: año ' + year + ' sin fecha de solsticio en la tabla SOLSTICIO de check-feriados.js.');
    console.error('Verificar la fecha oficial (anexo Ley 21.357 en BCN) y agregarla antes de continuar.');
    process.exit(1);
  }
  return [
    { date: year + '-01-01',                              nombre: 'Año Nuevo' },
    { date: iso(addDays(easter, -2)),                     nombre: 'Viernes Santo' },
    { date: iso(addDays(easter, -1)),                     nombre: 'Sábado Santo' },
    { date: year + '-05-01',                              nombre: 'Día del Trabajo' },
    { date: year + '-05-21',                              nombre: 'Glorias Navales' },
    { date: year + '-' + solsticio,                       nombre: 'Día de los Pueblos Indígenas' },
    { date: iso(trasladoLunes(new Date(year, 5, 29))),    nombre: 'San Pedro y San Pablo' },
    { date: year + '-07-16',                              nombre: 'Virgen del Carmen' },
    { date: year + '-08-15',                              nombre: 'Asunción de la Virgen' },
    { date: year + '-09-18',                              nombre: 'Fiestas Patrias' },
    { date: year + '-09-19',                              nombre: 'Glorias del Ejército' },
    { date: iso(trasladoLunes(new Date(year, 9, 12))),    nombre: 'Encuentro de Dos Mundos' },
    { date: iso(trasladoEvangelicas(new Date(year, 9, 31))), nombre: 'Día Iglesias Evangélicas y Protestantes' },
    { date: year + '-11-01',                              nombre: 'Día de Todos los Santos' },
    { date: year + '-12-08',                              nombre: 'Inmaculada Concepción' },
    { date: year + '-12-25',                              nombre: 'Navidad' }
  ];
}

// ── Main ────────────────────────────────────────────────────────────────────
var cal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'calendar-config.json'), 'utf8'));
var actual = cal.feriadosCompletos || [];
var expected = computeExpected(cal.year);

var errors = [];
var expectedDates = expected.map(function (f) { return f.date; });
var actualDates = actual.map(function (f) { return f.date; });

// Faltantes y sobrantes
expected.forEach(function (f) {
  if (actualDates.indexOf(f.date) === -1) {
    errors.push('FALTA: ' + f.date + ' (' + f.nombre + ') no está en feriadosCompletos');
  }
});
actual.forEach(function (f) {
  if (expectedDates.indexOf(f.date) === -1) {
    errors.push('SOBRA: ' + f.date + ' (' + f.nombre + ') no corresponde a ningún feriado legal calculado');
  }
});

// Conteo
if (actual.length !== expected.length) {
  errors.push('CONTEO: feriadosCompletos tiene ' + actual.length + ', se esperan ' + expected.length);
}

// Día de semana declarado vs real
var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
actual.forEach(function (f) {
  var p = f.date.split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2]);
  if (f.diaSemana && f.diaSemana !== DIAS[d.getDay()]) {
    errors.push('DIA: ' + f.date + ' (' + f.nombre + ') dice "' + f.diaSemana + '" pero cae ' + DIAS[d.getDay()]);
  }
});

// Irrenunciables (Leyes 19.973 + 20.629)
actual.forEach(function (f) {
  var mmdd = f.date.slice(5);
  var debe = IRRENUNCIABLES.indexOf(mmdd) !== -1;
  var tiene = f.irrenunciable === true;
  if (debe && !tiene) errors.push('IRRENUNCIABLE: ' + f.date + ' (' + f.nombre + ') debe llevar irrenunciable:true');
  if (!debe && tiene) errors.push('IRRENUNCIABLE: ' + f.date + ' (' + f.nombre + ') NO es irrenunciable (Leyes 19.973/20.629)');
});

// Corpus Christi explícito (clase de bug histórico: copiar año anterior)
var corpus = iso(addDays(easterDate(cal.year), 60));
if (actualDates.indexOf(corpus) !== -1) {
  errors.push('CORPUS: ' + corpus + ' (Pascua+60) figura como feriado — Corpus Christi NO es feriado legal vigente');
}

if (errors.length) {
  console.error('=== check-feriados: ' + errors.length + ' discrepancia(s) en feriados ' + cal.year + ' ===');
  errors.forEach(function (e) { console.error('  ERROR: ' + e); });
  process.exit(1);
}
console.log('check-feriados: OK — ' + actual.length + ' feriados ' + cal.year +
  ' coinciden con el cálculo legal determinístico (fechas, días, irrenunciables).');
