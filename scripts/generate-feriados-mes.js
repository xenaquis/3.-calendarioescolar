#!/usr/bin/env node
/* generate-feriados-mes.js — Genera public/feriados/[mes]-2026/index.html (12 páginas)
   Módulo usado por generate-pages.js. No ejecutar directamente.

   Lee: data/calendar-config.json (via parámetro) + data/template-mes.html
   Genera: public/feriados/{enero..diciembre}-2026/index.html
   Devuelve: array de URLs para el sitemap.

   El contenido escolar/regional por mes está curado en MES_EXTRA — revisar
   cada año junto con calendar-config.json (ver data/FUENTES-VERDAD.md).
*/

var fs = require('fs');
var path = require('path');

// data_key de afirmaciones.json por NOMBRE de feriado (year-agnostic:
// las fechas cambian cada año pero el nombre no, evitando fallo silencioso en 2027).
var DATA_KEY_BY_NAME = {
  'Año Nuevo': 'feriado_ano_nuevo',
  'Viernes Santo': 'feriado_viernes_santo',
  'Sábado Santo': 'feriado_sabado_santo',
  'Día del Trabajo': 'feriado_dia_trabajo',
  'Glorias Navales': 'feriado_glorias_navales',
  'Día de los Pueblos Indígenas': 'feriado_pueblos_indigenas',
  'San Pedro y San Pablo': 'feriado_san_pedro_san_pablo',
  'Virgen del Carmen': 'feriado_virgen_carmen',
  'Asunción de la Virgen': 'feriado_asuncion_virgen',
  'Fiestas Patrias': 'feriado_fiestas_patrias',
  'Glorias del Ejército': 'feriado_glorias_ejercito',
  'Encuentro de Dos Mundos': 'feriado_encuentro_dos_mundos',
  'Día Iglesias Evangélicas y Protestantes': 'feriado_iglesias_evangelicas',
  'Día de Todos los Santos': 'feriado_todos_los_santos',
  'Inmaculada Concepción': 'feriado_inmaculada_concepcion',
  'Navidad': 'feriado_navidad'
};

var MESES = [
  { num: 1,  nombre: 'enero',      cap: 'Enero' },
  { num: 2,  nombre: 'febrero',    cap: 'Febrero' },
  { num: 3,  nombre: 'marzo',      cap: 'Marzo' },
  { num: 4,  nombre: 'abril',      cap: 'Abril' },
  { num: 5,  nombre: 'mayo',       cap: 'Mayo' },
  { num: 6,  nombre: 'junio',      cap: 'Junio' },
  { num: 7,  nombre: 'julio',      cap: 'Julio' },
  { num: 8,  nombre: 'agosto',     cap: 'Agosto' },
  { num: 9,  nombre: 'septiembre', cap: 'Septiembre' },
  { num: 10, nombre: 'octubre',    cap: 'Octubre' },
  { num: 11, nombre: 'noviembre',  cap: 'Noviembre' },
  { num: 12, nombre: 'diciembre',  cap: 'Diciembre' }
];

/* Contenido curado por mes: contexto escolar, FAQs extra y claim keys extra.
   REVISAR ANUALMENTE. Las fechas escolares citadas provienen de calendar-config.json
   y pages.json (regiones con vacaciones de invierno diferenciadas). */
var MES_EXTRA = {
  enero: {
    claimKeys: [],
    contexto: '<p>En enero no hay clases: es el per&iacute;odo de <strong>vacaciones de verano</strong> en todo Chile. El feriado de A&ntilde;o Nuevo no afecta el calendario escolar.</p>' +
      '<p>El pr&oacute;ximo hito escolar es el <strong>ingreso de estudiantes el mi&eacute;rcoles 4 de marzo de 2026</strong>, igual en las 16 regiones.</p>',
    faqs: [
      { q: '¿El 2 de enero de 2026 es feriado en Chile?',
        a: 'No. El 2 de enero solo es feriado cuando el 1 de enero cae domingo (Ley 20.983). En 2026 el 1 de enero cae jueves, por lo que el viernes 2 de enero es día hábil normal.' }
    ]
  },
  febrero: {
    claimKeys: ['schoolStart'],
    contexto: '<p>Febrero es uno de los dos meses del a&ntilde;o <strong>sin ning&uacute;n feriado</strong> en Chile (el otro es marzo, salvo a&ntilde;os con feriados electorales). Tampoco hay clases: contin&uacute;an las <strong>vacaciones de verano</strong>.</p>' +
      '<p>Las clases 2026 comienzan el <strong>mi&eacute;rcoles 4 de marzo</strong> en las 16 regiones, seg&uacute;n los calendarios escolares regionales del Mineduc.</p>',
    faqs: [
      { q: '¿Por qué febrero nunca tiene feriados en Chile?',
        a: 'Ninguna de las leyes de feriados vigentes (Ley 2.977 y sus modificaciones) fija fechas en febrero. Solo puede haber feriados excepcionales, como plebiscitos o elecciones.' }
    ]
  },
  marzo: {
    claimKeys: ['schoolStart'],
    contexto: '<p>Marzo 2026 <strong>no tiene feriados</strong> y es el mes de regreso a clases: el <strong>ingreso de estudiantes es el mi&eacute;rcoles 4 de marzo</strong> en las 16 regiones del pa&iacute;s.</p>' +
      '<p>Es un mes completo de clases, sin interrupciones. El primer feriado del a&ntilde;o escolar llega reci&eacute;n con Semana Santa: <strong>viernes 3 de abril</strong>.</p>',
    faqs: [
      { q: '¿Cuándo empiezan las clases en marzo 2026?',
        a: 'El ingreso de estudiantes es el miércoles 4 de marzo de 2026 en las 16 regiones, según las resoluciones regionales del Mineduc.' },
      { q: '¿Cuál es el primer feriado después del inicio de clases 2026?',
        a: 'Viernes Santo, el 3 de abril de 2026. Es el primer feriado que suspende clases en el año escolar.' }
    ]
  },
  abril: {
    claimKeys: [],
    contexto: '<p>En abril hay clases todo el mes, con una excepci&oacute;n: el <strong>viernes 3 de abril (Viernes Santo) se suspenden las clases</strong> en todos los establecimientos. El s&aacute;bado 4 (S&aacute;bado Santo) tambi&eacute;n es feriado, pero cae en fin de semana.</p>' +
      '<p><strong>Semana Santa 2026</strong> (del domingo 29 de marzo al domingo 5 de abril) genera el <strong>primer fin de semana largo</strong> del a&ntilde;o escolar: viernes 3 a domingo 5 de abril. En el calendario escolar chileno <strong>no hay &laquo;vacaciones de Semana Santa&raquo;</strong>: solo el Viernes y el S&aacute;bado Santo son feriado, y el lunes 6 de abril hay clases normalmente.</p>',
    faqs: [
      { q: '¿Hay vacaciones de Semana Santa en Chile 2026?',
        a: 'No. El calendario escolar chileno no contempla vacaciones de Semana Santa. Solo son feriado el Viernes Santo (3 de abril) y el Sábado Santo (4 de abril) de 2026; el resto de la semana hay clases normales.' },
      { q: '¿Qué días son feriado en Semana Santa 2026?',
        a: 'Viernes Santo, el viernes 3 de abril, y Sábado Santo, el sábado 4 de abril de 2026. El Jueves Santo y el Domingo de Resurrección no son feriados legales en Chile.' },
      { q: '¿El lunes 6 de abril de 2026 hay clases?',
        a: 'Sí. El feriado de Semana Santa 2026 cubre solo viernes 3 y sábado 4 de abril. El lunes 6 es día de clases normal.' },
      { q: '¿Cuándo cae el Domingo de Pascua 2026?',
        a: 'El domingo 5 de abril de 2026 (cálculo eclesiástico Meeus/Jones/Butcher). De ahí derivan Viernes Santo (3 de abril) y Sábado Santo (4 de abril).' }
    ]
  },
  mayo: {
    claimKeys: [],
    contexto: '<p>Mayo 2026 tiene <strong>dos feriados y ambos suspenden clases</strong>: el viernes 1 de mayo (D&iacute;a del Trabajo, irrenunciable) y el jueves 21 de mayo (Glorias Navales).</p>' +
      '<p>El 1 de mayo genera fin de semana largo (viernes 1 a domingo 3). El 21 de mayo cae jueves: el viernes 22 hay clases, aunque algunos establecimientos lo declaran interferiado y lo recuperan despu&eacute;s &mdash; eso lo define cada colegio dentro del marco del calendario regional Mineduc.</p>',
    faqs: [
      { q: '¿El viernes 22 de mayo de 2026 hay clases?',
        a: 'Oficialmente sí: el feriado es solo el jueves 21 (Glorias Navales). Algunos colegios declaran el viernes 22 como interferiado, con recuperación posterior. Confirma con tu establecimiento.' }
    ]
  },
  junio: {
    claimKeys: ['winterStart'],
    contexto: '<p>Junio 2026 tiene dos feriados, pero <strong>ninguno suspende clases</strong>: el D&iacute;a Nacional de los Pueblos Ind&iacute;genas cae <strong>domingo 21 de junio</strong> (coincide con el solsticio de invierno, Ley 21.357) y San Pedro y San Pablo cae <strong>lunes 29 de junio</strong>, cuando la mayor&iacute;a de las regiones ya est&aacute; en <strong>vacaciones de invierno</strong> (desde el lunes 22 de junio).</p>' +
      '<p>El fin de semana del <strong>s&aacute;bado 27 al lunes 29 de junio</strong> es fin de semana largo &mdash; el primero de las vacaciones de invierno escolares.</p>' +
      '<p>Ojo: <a href="/corpus-christi-2026">Corpus Christi (4 de junio) no es feriado en Chile</a> desde 2007.</p>',
    faqs: [
      { q: '¿Corpus Christi (4 de junio) es feriado en Chile 2026?',
        a: 'No. Corpus Christi fue suprimido como feriado legal por el artículo 144 de la Ley 16.840 y reemplazado por el 16 de julio (Virgen del Carmen, Ley 20.148). El jueves 4 de junio de 2026 es día de clases normal.' },
      { q: '¿Por qué el Día de los Pueblos Indígenas cae el 21 de junio en 2026?',
        a: 'La Ley 21.357 fija este feriado en el día del solsticio de invierno del hemisferio sur, que en 2026 ocurre el domingo 21 de junio. Por eso la fecha cambia cada año (20, 21 o 24 de junio).' },
      { q: '¿El 7 de junio es feriado en alguna parte de Chile?',
        a: 'Sí, solo en la Región de Arica y Parinacota: el Asalto y Toma del Morro de Arica (Ley 20.663). En 2026 cae domingo, por lo que no genera día libre adicional.' }
    ]
  },
  julio: {
    claimKeys: ['winterEnd'],
    contexto: '<p>Julio 2026 tiene un solo feriado: la <strong>Virgen del Carmen, jueves 16 de julio</strong> (Ley 20.148). Su efecto escolar depende de la regi&oacute;n:</p>' +
      '<ul><li>En <strong>11 regiones</strong> las vacaciones de invierno terminan el viernes 3 de julio, as&iacute; que el 16 de julio es d&iacute;a lectivo y <strong>se suspenden las clases</strong>.</li>' +
      '<li>En <a href="/region/arica-y-parinacota/">Arica y Parinacota</a> y <a href="/region/tarapaca/">Tarapac&aacute;</a> (vacaciones 13&ndash;24 jul), <a href="/region/los-lagos/">Los Lagos</a> (6&ndash;17 jul), <a href="/region/aysen/">Ays&eacute;n</a> (6&ndash;24 jul) y <a href="/region/magallanes/">Magallanes</a> (29 jun&ndash;17 jul), el 16 de julio cae <strong>dentro de las vacaciones de invierno</strong>.</li></ul>' +
      '<p>Las fechas regionales provienen de las resoluciones exentas de cada Seremi de Educaci&oacute;n (incluida la REX 632/2025 que modific&oacute; Ays&eacute;n).</p>',
    faqs: [
      { q: '¿El 16 de julio de 2026 se suspenden las clases?',
        a: 'En 11 regiones sí (las vacaciones de invierno terminan el 3 de julio). En Arica y Parinacota, Tarapacá, Los Lagos, Aysén y Magallanes el 16 de julio cae dentro de las vacaciones de invierno regionales.' },
      { q: '¿Cuándo se vuelve a clases después de las vacaciones de invierno 2026?',
        a: 'La mayoría de las regiones vuelve el lunes 6 de julio. Excepciones: Los Lagos y Magallanes vuelven el 20 de julio, y Arica y Parinacota, Tarapacá y Aysén el 27 de julio.' }
    ]
  },
  agosto: {
    claimKeys: [],
    contexto: '<p>Agosto 2026 tiene un solo feriado: la <strong>Asunci&oacute;n de la Virgen, s&aacute;bado 15 de agosto</strong> (Ley 2.977). Al caer s&aacute;bado, <strong>no afecta las clases</strong> ni genera fin de semana largo.</p>' +
      '<p>Es un mes completo de clases en todo el pa&iacute;s, en plena segunda mitad del primer semestre extendido o inicio del segundo semestre, seg&uacute;n el r&eacute;gimen de cada regi&oacute;n.</p>',
    faqs: [
      { q: '¿El 20 de agosto es feriado en alguna parte de Chile?',
        a: 'Sí, solo en las comunas de Chillán y Chillán Viejo (Región de Ñuble): el Nacimiento del Prócer de la Independencia, Bernardo O\'Higgins (Ley 20.768). En 2026 cae jueves y suspende clases únicamente en esas dos comunas.' }
    ]
  },
  septiembre: {
    claimKeys: [],
    titleSeo: 'Vacaciones de Septiembre 2026 en Chile — Fiestas Patrias y feriados',
    descSeo: 'Vacaciones de Fiestas Patrias 2026: del 14 al 18 de septiembre; las clases vuelven el lunes 21. Feriados viernes 18 y sábado 19 (irrenunciables). Detalle con respaldo legal Mineduc y BCN.',
    contexto: '<p>Los feriados de Fiestas Patrias 2026 &mdash; <strong>viernes 18 y s&aacute;bado 19 de septiembre</strong>, ambos irrenunciables &mdash; caen dentro de las <strong>vacaciones escolares de Fiestas Patrias (14 al 18 de septiembre)</strong> fijadas por el calendario Mineduc, por lo que no restan d&iacute;as de clases.</p>' +
      '<p>El fin de semana del <strong>18 al 20 de septiembre</strong> es fin de semana largo para todo el pa&iacute;s. Las clases se retoman el lunes 21 de septiembre.</p>',
    faqs: [
      { q: '¿Hay clases la semana del 14 al 18 de septiembre de 2026?',
        a: 'No. El calendario escolar Mineduc fija vacaciones de Fiestas Patrias del 14 al 18 de septiembre de 2026. Las clases se retoman el lunes 21.' },
      { q: '¿El 18 y 19 de septiembre son feriados irrenunciables?',
        a: 'Sí, ambos (Ley 19.973 y Ley 20.629). La irrenunciabilidad aplica a los trabajadores del comercio, que no pueden ser obligados a trabajar esos días.' }
    ]
  },
  octubre: {
    claimKeys: [],
    contexto: '<p>Octubre 2026 tiene dos feriados: el <strong>lunes 12 de octubre</strong> (Encuentro de Dos Mundos), que es d&iacute;a lectivo y <strong>suspende las clases</strong>, y el <strong>s&aacute;bado 31 de octubre</strong> (D&iacute;a de las Iglesias Evang&eacute;licas y Protestantes), sin impacto escolar por caer s&aacute;bado.</p>' +
      '<p>El 12 de octubre genera <strong>fin de semana largo del s&aacute;bado 10 al lunes 12</strong>.</p>',
    faqs: [
      { q: '¿Por qué el 12 de octubre de 2026 cae lunes?',
        a: 'En 2026 el 12 de octubre cae lunes de forma natural. La Ley 19.668 lo trasladaría al lunes más cercano solo si cayera entre martes y viernes.' },
      { q: '¿El 31 de octubre se suspenden las clases?',
        a: 'En 2026 no aplica suspensión porque cae sábado. Cuando cae entre semana, la Ley 20.299 lo traslada al viernes más cercano según el día.' }
    ]
  },
  noviembre: {
    claimKeys: [],
    contexto: '<p>Noviembre 2026 tiene un solo feriado: el <strong>D&iacute;a de Todos los Santos, domingo 1 de noviembre</strong> (Ley 2.977). Al caer domingo, <strong>no afecta las clases</strong>.</p>' +
      '<p>Es el &uacute;ltimo mes completo de clases del a&ntilde;o escolar 2026: el cierre JEC es el viernes 4 de diciembre en la mayor&iacute;a de las regiones.</p>',
    faqs: [
      { q: '¿El lunes 2 de noviembre de 2026 es feriado?',
        a: 'No. En Chile el Día de Todos los Santos no se traslada cuando cae domingo. El lunes 2 de noviembre de 2026 es día de clases normal.' }
    ]
  },
  diciembre: {
    claimKeys: ['schoolEnd'],
    contexto: '<p>Diciembre 2026 tiene dos feriados: la <strong>Inmaculada Concepci&oacute;n, martes 8 de diciembre</strong>, y <strong>Navidad, viernes 25 de diciembre</strong> (irrenunciable).</p>' +
      '<p>El <strong>&uacute;ltimo d&iacute;a de clases JEC es el viernes 4 de diciembre</strong> en la mayor&iacute;a de las regiones, por lo que el 8 de diciembre afecta principalmente a establecimientos con calendario extendido y a las regiones con t&eacute;rmino posterior: en <a href="/region/aysen/">Ays&eacute;n</a> y <a href="/region/magallanes/">Magallanes</a> las clases JEC terminan el <strong>viernes 11 de diciembre</strong>, y los establecimientos sin JEC (40 semanas) el <strong>23 de diciembre</strong> (REX 632/2025 Ays&eacute;n).</p>',
    faqs: [
      { q: '¿Hasta cuándo hay clases en diciembre 2026?',
        a: 'El último día de clases JEC es el viernes 4 de diciembre en la mayoría de las regiones. En Aysén y Magallanes las clases JEC terminan el viernes 11 de diciembre, y los establecimientos sin JEC (40 semanas) el 23 de diciembre, según sus resoluciones regionales.' },
      { q: '¿El lunes 7 de diciembre de 2026 es feriado?',
        a: 'No. El feriado es solo el martes 8 (Inmaculada Concepción). El lunes 7 queda como día "sándwich": es hábil, aunque algunos empleadores y establecimientos lo otorgan con cargo a recuperación.' }
    ]
  }
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildFeriadoRow(f) {
  var fecha = f.diaSemana + ' ' + f.diaNum + ' de ' + f.mes;
  var TIPO = { civil: 'Civil', laboral: 'Laboral', patrio: 'Patrio', conmemorativo: 'Conmemorativo', religioso: 'Religioso' };
  var impacto = f.contexto === 'en-clases'
    ? '<span class="badge badge--clases">Suspende clases</span>'
    : '<span class="badge badge--sin-impacto">' + (f.notaContexto || 'Sin impacto escolar') + '</span>';
  var nombre = '<strong>' + f.nombre + '</strong>';
  if (f.irrenunciable) nombre += ' <span class="badge badge--patrio">Irrenunciable</span>';
  if (f.nota) nombre += '<br><small style="color:var(--color-text-tertiary)">' + f.nota + '</small>';
  return '              <tr>\n' +
    '                <td><time datetime="' + f.date + '">' + fecha + '</time></td>\n' +
    '                <td>' + nombre + '</td>\n' +
    '                <td>' + (TIPO[f.tipo] || f.tipo) + '</td>\n' +
    '                <td>' + impacto + '</td>\n' +
    '              </tr>';
}

function buildFeriadosSection(mes, feriadosMes, proximoDespues) {
  if (feriadosMes.length === 0) {
    var prox = proximoDespues
      ? '<p>El pr&oacute;ximo feriado es <strong>' + proximoDespues.nombre + '</strong>, el ' +
        proximoDespues.diaSemana.toLowerCase() + ' <time datetime="' + proximoDespues.date + '">' +
        proximoDespues.diaNum + ' de ' + proximoDespues.mes + ' de 2026</time>.</p>'
      : '';
    return '      <section class="section" aria-label="Feriados de ' + mes.nombre + ' 2026">\n' +
      '        <h2>' + mes.cap + ' 2026 no tiene feriados</h2>\n' +
      '        <p>No hay ning&uacute;n feriado nacional en ' + mes.nombre + ' de 2026 en Chile, seg&uacute;n la Ley 2.977 y sus modificaciones.</p>\n' +
      '        ' + prox + '\n' +
      '      </section>';
  }
  var rows = feriadosMes.map(buildFeriadoRow).join('\n');
  return '      <section class="section" aria-label="Feriados de ' + mes.nombre + ' 2026">\n' +
    '        <h2>Feriados de ' + mes.nombre + ' 2026</h2>\n' +
    '        <div class="table-wrapper">\n' +
    '          <table aria-label="Feriados ' + mes.nombre + ' 2026 Chile">\n' +
    '            <thead>\n' +
    '              <tr><th>Fecha</th><th>Feriado</th><th>Tipo</th><th>Impacto escolar</th></tr>\n' +
    '            </thead>\n' +
    '            <tbody>\n' + rows + '\n            </tbody>\n' +
    '          </table>\n' +
    '        </div>\n' +
    '        <p class="card__meta" style="margin-top:var(--space-3)">\n' +
    '          Fuente: <a href="https://www.bcn.cl/leychile/Navegar?idNorma=23639" rel="noopener noreferrer" target="_blank">Ley 2.977 y modificaciones (BCN)</a> &middot;\n' +
    '          <a href="https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-2026/" rel="noopener noreferrer" target="_blank">Calendario Escolar Mineduc 2026</a>\n' +
    '        </p>\n' +
    '      </section>';
}

function findeLargoInfo(feriadosMes) {
  // Viernes feriado → vie-dom; Lunes feriado → sáb-lun
  for (var i = 0; i < feriadosMes.length; i++) {
    var f = feriadosMes[i];
    if (f.diaSemana === 'Viernes') {
      return { si: true, texto: 'Vie ' + f.diaNum + ' &ndash; dom ' + (f.diaNum + 2) + ' de ' + f.mes, feriado: f };
    }
    if (f.diaSemana === 'Lunes') {
      return { si: true, texto: 'S&aacute;b ' + (f.diaNum - 2) + ' &ndash; lun ' + f.diaNum + ' de ' + f.mes, feriado: f };
    }
  }
  return { si: false };
}

function buildFaq(mes, feriadosMes, finde, extra) {
  var faqs = [];

  // Q1: cuántos feriados
  var lista = feriadosMes.map(function (f) {
    return f.nombre + ' (' + f.diaSemana.toLowerCase() + ' ' + f.diaNum + ' de ' + f.mes + ')';
  }).join(' y ');
  faqs.push({
    q: '¿Cuántos feriados tiene ' + mes.nombre + ' de 2026 en Chile?',
    a: feriadosMes.length === 0
      ? mes.cap + ' de 2026 no tiene ningún feriado en Chile.'
      : (feriadosMes.length === 1 ? 'Uno: ' : feriadosMes.length + ' feriados: ') + lista + '.'
  });

  // Q2: finde largo
  faqs.push({
    q: '¿Hay fin de semana largo en ' + mes.nombre + ' 2026?',
    a: finde.si
      ? 'Sí: ' + finde.texto.replace(/&ndash;/g, 'al').replace(/&aacute;/g, 'á') + ' de 2026, por el feriado de ' + finde.feriado.nombre + '.'
      : 'No. ' + (feriadosMes.length === 0
          ? 'No hay feriados en ' + mes.nombre + ' de 2026.'
          : 'Ningún feriado de ' + mes.nombre + ' 2026 cae viernes o lunes.')
  });

  // FAQs curadas del mes
  (extra.faqs || []).forEach(function (f) { faqs.push(f); });

  return faqs;
}

function faqToHtml(faqs) {
  return faqs.map(function (f) {
    return '        <details>\n' +
      '          <summary>' + esc(f.q) + '</summary>\n' +
      '          <p>' + esc(f.a) + '</p>\n' +
      '        </details>';
  }).join('\n\n');
}

function buildSchema(mes, slug, title, description, faqs, domain, today) {
  var url = 'https://' + domain + '/feriados/' + slug + '/';
  var schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://' + domain + '/' },
          { '@type': 'ListItem', position: 2, name: 'Feriados 2026', item: 'https://' + domain + '/feriados-2026' },
          { '@type': 'ListItem', position: 3, name: 'Feriados ' + mes.nombre + ' 2026', item: url }
        ]
      },
      {
        '@type': 'Article',
        headline: title,
        description: description,
        url: url,
        inLanguage: 'es-CL',
        datePublished: '2026-06-12',
        dateModified: today,
        author: { '@id': 'https://' + domain + '/#author' },
        publisher: { '@id': 'https://' + domain + '/#org' },
        mainEntityOfPage: url,
        isPartOf: { '@id': 'https://' + domain + '/#website' }
      }
      // FAQPage retirado (milestone-361): Google elimino el rich result FAQ
      // de la busqueda el 07-may-2026. El texto FAQ visible se conserva
      // (lo leen usuarios y AI Overviews).
    ]
  };
  return JSON.stringify(schema, null, 2);
}

module.exports = function generateFeriadosMes(calConfig, templateFile, outputDir, domain) {
  var template = fs.readFileSync(templateFile, 'utf8');
  var feriados = calConfig.feriadosCompletos || [];
  var today = new Date().toISOString().slice(0, 10);
  var urls = [];
  var count = 0;

  MESES.forEach(function (mes, idx) {
    var slug = mes.nombre + '-2026';
    var extra = MES_EXTRA[mes.nombre] || { claimKeys: [], contexto: '', faqs: [] };
    var feriadosMes = feriados.filter(function (f) { return f.mes === mes.nombre; });
    var enClases = feriadosMes.filter(function (f) { return f.contexto === 'en-clases'; });

    // Próximo feriado después del mes (para meses sin feriados y key-fact estático)
    var proximoDespues = null;
    for (var i = 0; i < feriados.length; i++) {
      if (parseInt(feriados[i].date.slice(5, 7), 10) > mes.num) { proximoDespues = feriados[i]; break; }
    }
    var proximoEstatico = feriadosMes.length > 0 ? feriadosMes[0] : proximoDespues;

    var finde = findeLargoInfo(feriadosMes);
    var faqs = buildFaq(mes, feriadosMes, finde, extra);

    // Title + description + answer lead
    var title, description, answerLead;
    if (feriadosMes.length === 0) {
      title = 'Feriados de ' + mes.nombre + ' 2026 en Chile — No hay feriados este mes';
      description = mes.cap + ' 2026 no tiene feriados en Chile. Te contamos cuál es el próximo feriado y qué pasa con las clases. Fuente legal BCN.';
      answerLead = '<strong>' + mes.cap + ' 2026 no tiene feriados</strong> en Chile.' +
        (proximoDespues ? ' El próximo es <strong>' + proximoDespues.nombre + '</strong> (' + proximoDespues.diaNum + ' de ' + proximoDespues.mes + ').' : '');
    } else {
      var nombres = feriadosMes.map(function (f) { return f.nombre + ' (' + f.diaSemana.toLowerCase() + ' ' + f.diaNum + ')'; }).join(' y ');
      title = 'Feriados de ' + mes.nombre + ' 2026 en Chile — Fechas y si hay clases';
      description = mes.cap + ' 2026 en Chile: ' + feriadosMes.length + (feriadosMes.length === 1 ? ' feriado' : ' feriados') + ', ' +
        (enClases.length === 0 ? 'sin suspensión de clases' : enClases.length + ' con suspensión de clases') +
        (finde.si ? ' y fin de semana largo' : '') + '. Detalle con respaldo legal BCN.';
      answerLead = mes.cap + ' 2026 tiene <strong>' + (feriadosMes.length === 1 ? 'un feriado' : feriadosMes.length + ' feriados') + '</strong>: ' + nombres + '.';
    }

    // Override SEO por mes (ej. septiembre apunta a "vacaciones de septiembre 2026")
    if (extra.titleSeo) title = extra.titleSeo;
    if (extra.descSeo) description = extra.descSeo;

    // Claim keys: feriados del mes + extras curados
    var claimKeys = feriadosMes
      .map(function (f) { return DATA_KEY_BY_NAME[f.nombre]; })
      .filter(Boolean)
      .concat(extra.claimKeys || []);

    var mesPrev = MESES[(idx + 11) % 12];
    var mesNext = MESES[(idx + 1) % 12];

    var mesIndexLinks = MESES.map(function (m) {
      var current = m.num === mes.num;
      return '          <li>' + (current
        ? '<strong>' + m.cap + '</strong>'
        : '<a href="/feriados/' + m.nombre + '-2026/">' + m.cap + '</a>') + '</li>';
    }).join('\n');

    var html = template
      .replace(/\{\{title\}\}/g, esc(title))
      .replace(/\{\{description\}\}/g, esc(description))
      .replace(/\{\{claimKeys\}\}/g, claimKeys.join(','))
      .replace(/\{\{slug\}\}/g, slug)
      .replace(/\{\{mesNombre\}\}/g, mes.nombre)
      .replace(/\{\{mesCap\}\}/g, mes.cap)
      .replace(/\{\{modifiedDate\}\}/g, today)
      .replace(/\{\{schemaJson\}\}/g, buildSchema(mes, slug, title, description, faqs, domain, today))
      .replace(/\{\{answerLead\}\}/g, answerLead)
      .replace(/\{\{numFeriados\}\}/g, feriadosMes.length === 0 ? 'Ninguno' : String(feriadosMes.length))
      .replace(/\{\{numEnClases\}\}/g, feriadosMes.length === 0 ? '0' : String(enClases.length))
      .replace(/\{\{notaEnClases\}\}/g, enClases.length > 0
        ? enClases.map(function (f) { return f.diaNum + ' de ' + f.mes; }).join(' y ')
        : 'Sin suspensi&oacute;n de clases')
      .replace(/\{\{findeLargo\}\}/g, finde.si ? 'S&iacute;' : 'No')
      .replace(/\{\{findeLargoNota\}\}/g, finde.si ? finde.texto : 'Este mes no aplica')
      .replace(/\{\{proximoEstatico\}\}/g, proximoEstatico ? proximoEstatico.nombre : '&mdash;')
      .replace(/\{\{proximoFechaEstatica\}\}/g, proximoEstatico
        ? proximoEstatico.diaNum + ' de ' + proximoEstatico.mes + ' 2026' : '&mdash;')
      .replace(/\{\{feriadosSection\}\}/g, buildFeriadosSection(mes, feriadosMes, proximoDespues))
      .replace(/\{\{contextoEscolar\}\}/g, '        ' + extra.contexto)
      .replace(/\{\{faqHtml\}\}/g, faqToHtml(faqs))
      .replace(/\{\{mesPrevSlug\}\}/g, mesPrev.nombre + '-2026')
      .replace(/\{\{mesPrevNombre\}\}/g, mesPrev.nombre)
      .replace(/\{\{mesNextSlug\}\}/g, mesNext.nombre + '-2026')
      .replace(/\{\{mesNextNombre\}\}/g, mesNext.nombre)
      .replace(/\{\{mesIndexLinks\}\}/g, mesIndexLinks)
      .replace(/\{\{domain\}\}/g, domain);

    var dir = path.join(outputDir, 'feriados', slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    count++;

    urls.push({
      loc: 'https://' + domain + '/feriados/' + slug + '/',
      priority: '0.7',
      changefreq: 'monthly'
    });
  });

  console.log('Generadas ' + count + ' paginas de feriados por mes (public/feriados/)');
  return urls;
};
