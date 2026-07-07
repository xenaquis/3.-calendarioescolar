#!/usr/bin/env node
/* generate-efemerides.js — Genera public/efemerides-escolares-2026.html
   Modulo usado por generate-pages.js. No ejecutar directamente.

   Captura la query "calendario de efemerides educacionales 2026" (CTR 37% en GSC, sin pagina).
   Datos CURADOS y VERIFICADOS con fuente (no derivables de calendar-config.json). Mayoria de
   fecha FIJA = bajo mantenimiento. Las MOVILES estan marcadas (REVISAR ANUALMENTE).

   Fuentes: BCN/Ley Chile, Mineduc, ONU/UNESCO. Ver investigacion milestone 360 (2026-06-17). */

var fs = require('fs');
var path = require('path');

var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function fechaLarga(iso) {
  var d = parseISO(iso);
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MES[d.getMonth()];
}
// Ultimo martes de abril del ano (para el Dia de la Convivencia Educativa, movil).
function ultimoMartesAbril(year) {
  var d = new Date(year, 3, 30); // 30 abril
  while (d.getDay() !== 2) d.setDate(d.getDate() - 1);
  return year + '-04-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
}

/* Efemerides VERIFICADAS. feriado:true = ademas es feriado legal (ya cubierto en /feriados-2026).
   movil:true = la fecha cambia ano a ano — REVISAR. fuente = texto citable. */
function buildEfemerides(year) {
  return [
    { date: year + '-03-08', nombre: 'Dia Internacional de la Mujer', cat: 'Derechos', fuente: 'ONU (oficializado 1977)' },
    { date: year + '-03-22', nombre: 'Dia Mundial del Agua', cat: 'Medioambiente', fuente: 'ONU, Resolucion A/RES/47/193 (1992)' },
    { date: year + '-04-22', nombre: 'Dia Internacional de la Madre Tierra', cat: 'Medioambiente', fuente: 'ONU, Resolucion A/RES/63/278 (2009)' },
    { date: year + '-04-23', nombre: 'Dia Mundial del Libro y del Derecho de Autor', cat: 'Cultura', fuente: 'UNESCO, Conferencia General (1995)' },
    { date: year + '-04-27', nombre: 'Dia del Carabinero', cat: 'Civica', fuente: 'Fundacion de Carabineros de Chile (27 abr 1927)' },
    { date: ultimoMartesAbril(year), nombre: 'Dia de la Convivencia Educativa', cat: 'Convivencia escolar', movil: true, fuente: 'Mineduc, marco Ley 20.536 (ultimo martes de abril; revisar cada ano)' },
    { date: year + '-05-02', nombre: 'Dia Internacional contra el Acoso Escolar (bullying)', cat: 'Convivencia escolar', fuente: 'UNESCO (2013)' },
    { date: year + '-05-11', nombre: 'Dia del Estudiante', cat: 'Educacion', fuente: 'Mineduc, Decreto Supremo N° 524 (1992)' },
    { date: year + '-05-21', feriadoKey: 'Glorias Navales', nombre: 'Dia de las Glorias Navales (Combate Naval de Iquique)', cat: 'Patria', feriado: true, fuente: 'Ley 2.977; Combate Naval de Iquique (1879)' },
    { date: year + '-06-21', feriadoKey: 'Pueblos Ind', nombre: 'Dia Nacional de los Pueblos Indigenas', cat: 'Pueblos originarios', feriado: true, fuente: 'Ley 21.357 (2021); cae en el solsticio de invierno (varia 20/21/24 jun segun el ano)' },
    { date: year + '-08-18', nombre: 'Dia de la Solidaridad (San Alberto Hurtado)', cat: 'Valores', fuente: 'Conmemora el fallecimiento de San Alberto Hurtado (18 ago 1952)' },
    { date: year + '-08-19', nombre: 'Dia de la Educacion Publica', cat: 'Educacion', fuente: 'Conmemoracion del sistema de Educacion Publica (marco Ley 21.040, 2017)' },
    { date: year + '-09-18', feriadoKey: 'Fiestas Patrias', nombre: 'Dia de la Independencia Nacional (Fiestas Patrias)', cat: 'Patria', feriado: true, fuente: 'Ley 2.977; feriado irrenunciable Ley 19.973' },
    { date: year + '-09-19', feriadoKey: 'Glorias del Ej', nombre: 'Dia de las Glorias del Ejercito', cat: 'Patria', feriado: true, fuente: 'Ley 2.977; feriado irrenunciable Ley 20.629' },
    { date: year + '-10-12', feriadoKey: 'Dos Mundos', nombre: 'Dia del Encuentro de Dos Mundos', cat: 'Civica', feriado: true, movil: true, fuente: 'Ley 3.810; el feriado se traslada al lunes mas cercano (Ley 19.668)' },
    { date: year + '-10-16', nombre: 'Dia del Profesor y la Profesora', cat: 'Educacion', fuente: 'Decreto Ley 1.938 (1977)' },
    { date: year + '-11-22', nombre: 'Dia de la Educacion Parvularia y del Educador de Parvulos', cat: 'Educacion', fuente: 'Subsecretaria de Educacion Parvularia (Mineduc)' },
    { date: year + '-12-10', nombre: 'Dia de los Derechos Humanos', cat: 'Derechos humanos', fuente: 'ONU, Resolucion 423(V) de 1950' }
  ].sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}

module.exports = function generateEfemerides(calConfig, outputDir, domain) {
  var year = calConfig.year || 2026;
  var efem = buildEfemerides(year);

  // Veracidad: las efemerides que ADEMAS son feriado toman su fecha de calendar-config.json
  // (fuente de verdad), para no contradecir al resto del sitio. Ej: Pueblos Indigenas cae en
  // el solsticio (21-jun en 2026), no en una fecha fija.
  var fc = calConfig.feriadosCompletos || [];
  efem.forEach(function (e) {
    if (!e.feriadoKey) return;
    var m = fc.filter(function (f) { return f.nombre && f.nombre.indexOf(e.feriadoKey) !== -1; })[0];
    if (m && m.date) e.date = m.date;
  });
  efem.sort(function (a, b) { return a.date < b.date ? -1 : 1; });

  var buildDate = new Date().toISOString().slice(0, 10);
  var url = 'https://' + domain + '/efemerides-escolares-' + year;

  var diaProfesor = efem.filter(function (e) { return /Profesor/.test(e.nombre); })[0];
  var nEducacion = efem.filter(function (e) { return e.cat === 'Educacion'; }).length;

  var filas = efem.map(function (e) {
    var feriadoCell = e.feriado
      ? '<span class="badge badge--clases">Sí, feriado</span>'
      : '<span class="badge badge--sin-impacto">No</span>';
    var movil = e.movil ? ' <span class="badge badge--patrio">Fecha móvil</span>' : '';
    return '              <tr>\n' +
      '                <td><time datetime="' + e.date + '">' + esc(fechaLarga(e.date)) + '</time></td>\n' +
      '                <td><strong>' + esc(e.nombre) + '</strong>' + movil + '<br><small style="color:var(--color-text-tertiary)">' + esc(e.fuente) + '</small></td>\n' +
      '                <td>' + esc(e.cat) + '</td>\n' +
      '                <td>' + feriadoCell + '</td>\n' +
      '              </tr>';
  }).join('\n');

  var title = 'Efemérides escolares ' + year + ' en Chile — Calendario de conmemoraciones';
  var desc = 'Calendario de efemérides educacionales ' + year + ' de Chile: ' + efem.length +
    ' fechas conmemorativas (Día del Profesor 16 oct, Día del Estudiante 11 may, Día del Libro y más) con su fuente oficial. Cuáles son feriado y cuáles no.';

  var faqs = [
    { q: '¿Qué es una efeméride escolar?',
      a: 'Una efeméride escolar es una fecha conmemorativa que se recuerda en los establecimientos educacionales (como el Día del Profesor o el Día del Libro). A diferencia de un feriado, la mayoría no suspende las clases: son instancias pedagógicas para trabajar valores, historia o ciencia.' },
    { q: '¿Cuándo es el Día del Profesor ' + year + ' en Chile?',
      a: 'El Día del Profesor y la Profesora se conmemora el ' + (diaProfesor ? fechaLarga(diaProfesor.date).toLowerCase() + ' de ' + year : '16 de octubre') + ', fecha fijada por el Decreto Ley 1.938 de 1977. Es una efeméride, no un feriado: hay clases normales.' },
    { q: '¿Qué efemérides de esta lista son feriado?',
      a: 'Son feriado (y por tanto suspenden clases o caen en día no lectivo) las Glorias Navales (21 de mayo), el Día de los Pueblos Indígenas, Fiestas Patrias (18 de septiembre), las Glorias del Ejército (19 de septiembre) y el Encuentro de Dos Mundos (12 de octubre). El resto son conmemoraciones sin feriado.' },
    { q: '¿De dónde salen estas fechas?',
      a: 'Cada efeméride de esta página tiene su fuente indicada: leyes y decretos chilenos (vía Biblioteca del Congreso Nacional), el Ministerio de Educación, o la ONU/UNESCO para las fechas internacionales. Las fechas móviles (como el Día de la Convivencia Educativa) se marcan expresamente.' }
  ];
  var faqHtml = faqs.map(function (f) {
    return '        <details>\n          <summary>' + esc(f.q) + '</summary>\n          <p>' + esc(f.a) + '</p>\n        </details>';
  }).join('\n\n');

  var schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://' + domain + '/' },
        { '@type': 'ListItem', position: 2, name: 'Feriados 2026', item: 'https://' + domain + '/feriados-2026' },
        { '@type': 'ListItem', position: 3, name: 'Efemérides escolares ' + year, item: url }
      ]},
      { '@type': 'Article', headline: 'Efemerides escolares ' + year + ' en Chile',
        description: desc, url: url, inLanguage: 'es-CL', datePublished: buildDate, dateModified: buildDate,
        author: { '@id': 'https://' + domain + '/#author' }, publisher: { '@id': 'https://' + domain + '/#org' },
        mainEntityOfPage: url, isPartOf: { '@id': 'https://' + domain + '/#website' } },
      { '@type': 'FAQPage', mainEntity: faqs.map(function (f) {
        return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }; }) }
    ]
  };

  var html = '<!DOCTYPE html>\n' +
'<html lang="es-CL" dir="ltr">\n<head>\n' +
'  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'  <title>' + esc(title) + '</title>\n' +
'  <meta name="description" content="' + esc(desc) + '">\n' +
'  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, noai, noimageai">\n' +
'  <meta name="claim-data" content="feriado_glorias_navales,feriado_encuentro_dos_mundos">\n' +
'  <link rel="canonical" href="' + url + '">\n' +
'  <link rel="alternate" hreflang="es-CL" href="' + url + '">\n  <link rel="alternate" hreflang="es" href="' + url + '">\n  <link rel="alternate" hreflang="x-default" href="' + url + '">\n' +
'  <meta property="og:type" content="article">\n  <meta property="og:url" content="' + url + '">\n' +
'  <meta property="og:title" content="' + esc(title) + '">\n  <meta property="og:description" content="' + esc(desc) + '">\n' +
'  <meta property="og:image" content="https://' + domain + '/icons/og-image.png">\n  <meta property="og:locale" content="es_CL">\n  <meta property="og:site_name" content="Calendario Escolar Chile">\n' +
'  <meta name="twitter:card" content="summary_large_image">\n  <meta name="twitter:title" content="' + esc(title) + '">\n  <meta name="twitter:description" content="' + esc(desc) + '">\n  <meta name="twitter:image" content="https://' + domain + '/icons/og-image.png">\n' +
'  <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">\n  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">\n  <meta name="theme-color" content="#7c3aed">\n' +
'  <link rel="stylesheet" href="/css/tokens.css">\n  <link rel="stylesheet" href="/css/base.css">\n  <link rel="stylesheet" href="/css/components.css">\n' +
'  <script type="application/ld+json">\n' + JSON.stringify(schema, null, 2) + '\n  </script>\n' +
'</head>\n<body>\n' +
'  <a href="#main" class="skip-link">Saltar al contenido</a>\n' +
'  <header class="site-header">\n    <div class="container">\n      <a href="/" class="site-header__brand">Calendario Escolar Chile</a>\n' +
'      <nav class="site-header__nav" aria-label="Principal">\n        <a href="/">Inicio</a>\n        <a href="/feriados-2026">Feriados</a>\n        <a href="/about">Info</a>\n        <button id="theme-toggle" type="button" aria-label="Cambiar tema">&#9790;</button>\n      </nav>\n    </div>\n  </header>\n' +
'  <main id="main">\n    <div class="container">\n' +
'      <nav class="breadcrumb" aria-label="Breadcrumb">\n        <a href="/">Inicio</a> <span>&rsaquo;</span> <a href="/feriados-2026">Feriados ' + year + '</a> <span>&rsaquo;</span> Efem&eacute;rides escolares\n      </nav>\n' +
'      <div class="hero-section">\n        <h1>Efem&eacute;rides escolares ' + year + ' en Chile</h1>\n' +
'        <p class="hero-sub">Calendario de <strong>conmemoraciones educacionales</strong> de ' + year + ': ' + efem.length + ' fechas (D&iacute;a del Profesor, del Estudiante, del Libro y m&aacute;s), cada una con su fuente oficial. A diferencia de los <a href="/feriados-2026">feriados</a>, la mayor&iacute;a no suspende clases.</p>\n      </div>\n' +
'      <section class="key-facts" aria-label="Resumen efem&eacute;rides ' + year + '">\n' +
'        <div class="key-fact key-fact--primary">\n          <p class="key-fact__label">Efem&eacute;rides</p>\n          <p class="key-fact__date">' + efem.length + '</p>\n          <p class="key-fact__note">conmemoraciones en ' + year + '</p>\n        </div>\n' +
'        <div class="key-fact key-fact--accent">\n          <p class="key-fact__label">D&iacute;a del Profesor</p>\n          <p class="key-fact__date">16 oct</p>\n          <p class="key-fact__note">Decreto Ley 1.938 (1977)</p>\n        </div>\n' +
'        <div class="key-fact key-fact--success">\n          <p class="key-fact__label">D&iacute;a del Estudiante</p>\n          <p class="key-fact__date">11 may</p>\n          <p class="key-fact__note">Decreto Supremo 524 (1992)</p>\n        </div>\n' +
'        <div class="key-fact key-fact--warning">\n          <p class="key-fact__label">Educativas</p>\n          <p class="key-fact__date">' + nEducacion + '</p>\n          <p class="key-fact__note">del &aacute;mbito educacion</p>\n        </div>\n      </section>\n' +
'      <section class="section" aria-label="Tabla de efem&eacute;rides ' + year + '">\n        <h2>Calendario de efem&eacute;rides ' + year + '</h2>\n' +
'        <p>Fechas conmemorativas del a&ntilde;o escolar ' + year + ', ordenadas por fecha, con su fuente y si son adem&aacute;s feriado:</p>\n' +
'        <div class="table-wrapper">\n          <table aria-label="Efem&eacute;rides escolares ' + year + ' Chile">\n' +
'            <thead>\n              <tr><th>Fecha</th><th>Efem&eacute;ride / Fuente</th><th>&Aacute;mbito</th><th>&iquest;Feriado?</th></tr>\n            </thead>\n' +
'            <tbody>\n' + filas + '\n            </tbody>\n          </table>\n        </div>\n' +
'        <p class="card__meta" style="margin-top:var(--space-3)">Las fechas m&oacute;viles (como el D&iacute;a de la Convivencia Educativa) se recalculan cada a&ntilde;o. Feriados verificados contra la <a href="https://www.bcn.cl/leychile/Navegar?idNorma=23639" rel="noopener noreferrer" target="_blank">legislaci&oacute;n vigente (BCN)</a>.</p>\n      </section>\n' +
'      <section class="section" id="faq">\n        <h2>Preguntas frecuentes</h2>\n\n' + faqHtml + '\n      </section>\n' +
'      <section class="section">\n        <h2>Consulta tambi&eacute;n</h2>\n        <div class="card-grid">\n' +
'          <a href="/feriados-2026" class="card" style="text-decoration:none; color:inherit;">\n            <h3 class="card__title" style="color:var(--color-primary);">Feriados 2026</h3>\n            <p>Los 16 feriados del a&ntilde;o con respaldo legal y su impacto escolar.</p>\n          </a>\n' +
'          <a href="/proximo-feriado" class="card" style="text-decoration:none; color:inherit;">\n            <h3 class="card__title" style="color:var(--color-accent);">Pr&oacute;ximo feriado</h3>\n            <p>Cuenta regresiva al siguiente feriado en Chile.</p>\n          </a>\n' +
'          <a href="/" class="card" style="text-decoration:none; color:inherit;">\n            <h3 class="card__title" style="color:var(--color-success);">Calendario escolar 2026</h3>\n            <p>Inicio de clases, vacaciones y fin de a&ntilde;o por regi&oacute;n.</p>\n          </a>\n        </div>\n      </section>\n' +
'    </div>\n  </main>\n' +
'  <div data-verificacion-footer>\n    <div class="verificacion-footer">\n      <p>Fuentes: Biblioteca del Congreso Nacional, Ministerio de Educaci&oacute;n, ONU/UNESCO. Cada efem&eacute;ride indica la suya.</p>\n    </div>\n  </div>\n' +
'  <footer class="site-footer">\n    <div class="container">\n      <ul class="site-footer__links">\n' +
'        <li><a href="/">Inicio</a></li>\n        <li><a href="/feriados-2026">Feriados 2026</a></li>\n        <li><a href="/proximo-feriado">Pr&oacute;ximo feriado</a></li>\n        <li><a href="/about">Acerca de</a></li>\n        <li><a href="/contacto">Contacto</a></li>\n        <li><a href="/privacidad">Privacidad</a></li>\n        <li><a href="/avisolegal">Aviso Legal</a></li>\n        <li><a href="https://dolaruf.cl" rel="noopener">Valor UF hoy</a></li>\n      </ul>\n' +
'      <p class="site-footer__copy">&copy; ' + year + ' Calendario Escolar Chile</p>\n      <p class="site-footer__source">Fuente: Biblioteca del Congreso Nacional &middot; Mineduc</p>\n    </div>\n  </footer>\n' +
'  <script defer src="/js/theme.js"></script>\n  <script defer src="/js/analytics.js"></script>\n' +
'  <script>\n  document.addEventListener("DOMContentLoaded", function () {\n' +
'    if (typeof Theme !== "undefined") Theme.init();\n    if (typeof Analytics !== "undefined") Analytics.init("G-6FVLKF6PFQ");\n  });\n  </script>\n' +
'</body>\n</html>\n';

  fs.writeFileSync(path.join(outputDir, 'efemerides-escolares-' + year + '.html'), html);
  console.log('Generado public/efemerides-escolares-' + year + '.html (' + efem.length + ' efemerides)');
  return { loc: url, priority: '0.7', changefreq: 'monthly' };
};
