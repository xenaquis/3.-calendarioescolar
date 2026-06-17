#!/usr/bin/env node
/* generate-proximo-feriado.js — Genera public/proximo-feriado.html
   Modulo usado por generate-pages.js. No ejecutar directamente.

   Pagina nacional "proximo feriado en Chile": el siguiente feriado (cualquier tipo, no solo
   escolar) + tabla de feriados restantes del ano. Contenido estatico calculado en build
   (indexable) + countdown client-side desde window.CALENDAR_CONFIG (siempre fresco).
   Lee: data/calendar-config.json (via parametro). Devuelve: url para el sitemap. */

var fs = require('fs');
var path = require('path');

var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

var TIPO = { civil: 'Civil', laboral: 'Laboral', patrio: 'Patrio', conmemorativo: 'Conmemorativo', religioso: 'Religioso' };

module.exports = function generateProximoFeriado(calConfig, outputDir, domain) {
  var feriados = (calConfig.feriadosCompletos || []).slice();
  var buildDate = new Date().toISOString().slice(0, 10);
  var hoy = parseISO(buildDate);

  // Feriados restantes del ano (>= hoy), ordenados.
  var restantes = feriados.filter(function (f) { return parseISO(f.date) >= hoy; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  var prox = restantes[0] || null;

  var year = calConfig.year || 2026;
  var url = 'https://' + domain + '/proximo-feriado';

  // --- Hero / key-facts (estatico, recalculado por JS en cliente) ---
  var proxNombre, proxFechaTxt, proxDias, proxImpacto;
  if (prox) {
    var pd = parseISO(prox.date);
    proxNombre = prox.nombre;
    proxFechaTxt = DIAS[pd.getDay()] + ' ' + prox.diaNum + ' de ' + prox.mes + ' de ' + year;
    proxDias = Math.ceil((pd - hoy) / 86400000);
    proxImpacto = prox.contexto === 'en-clases' ? 'Suspende clases' : (prox.notaContexto || 'Sin impacto escolar');
  } else {
    proxNombre = 'No quedan feriados en ' + year;
    proxFechaTxt = 'El proximo es Ano Nuevo de ' + (year + 1);
    proxDias = 0;
    proxImpacto = '—';
  }
  var proxDiasTxt = proxDias === 0 ? '¡Hoy!' : (proxDias === 1 ? 'Manana' : proxDias + ' dias');

  // --- Tabla de feriados restantes ---
  var filas = restantes.map(function (f) {
    var d = parseISO(f.date);
    var fecha = DIAS[d.getDay()] + ' ' + f.diaNum + ' de ' + f.mes;
    var irren = f.irrenunciable ? ' <span class="badge badge--patrio">Irrenunciable</span>' : '';
    var impacto = f.contexto === 'en-clases'
      ? '<span class="badge badge--clases">Suspende clases</span>'
      : '<span class="badge badge--sin-impacto">' + esc(f.notaContexto || 'Sin impacto escolar') + '</span>';
    return '              <tr>\n' +
      '                <td><time datetime="' + f.date + '">' + esc(fecha) + '</time></td>\n' +
      '                <td><strong>' + esc(f.nombre) + '</strong>' + irren + '</td>\n' +
      '                <td>' + esc(TIPO[f.tipo] || f.tipo) + '</td>\n' +
      '                <td>' + impacto + '</td>\n' +
      '              </tr>';
  }).join('\n');

  var nRestantes = restantes.length;
  var title = '¿Cuál es el próximo feriado en Chile? ' + year + ' — Cuenta regresiva';
  var desc = 'El próximo feriado en Chile es ' + esc(proxNombre) + ' (' + esc(proxFechaTxt) +
    '). Cuenta regresiva y lista de los ' + nRestantes + ' feriados que quedan en ' + year + '. Fuente legal BCN.';

  // --- FAQ ---
  var faqs = [
    { q: '¿Cuál es el próximo feriado en Chile?',
      a: 'El próximo feriado en Chile es ' + proxNombre + ', el ' + proxFechaTxt.toLowerCase() + '. Faltan ' + (proxDias === 0 ? 'cero días (es hoy)' : proxDias + ' días') + '.' },
    { q: '¿Cuántos feriados quedan en ' + year + '?',
      a: 'Quedan ' + nRestantes + ' feriados en lo que resta de ' + year + ' en Chile, contando desde hoy. La lista completa con fechas está en esta página.' },
    { q: '¿El próximo feriado suspende las clases?',
      a: prox && prox.contexto === 'en-clases'
        ? proxNombre + ' cae en día lectivo, por lo que suspende las clases en la mayoría de las regiones.'
        : (prox ? proxNombre + ' no suspende clases: ' + (prox.notaContexto ? prox.notaContexto.toLowerCase() : 'cae en fin de semana o período de vacaciones') + '.' : 'No quedan feriados este año.') },
    { q: '¿Los feriados de esta página son oficiales?',
      a: 'Sí. Se calculan de forma determinística desde la Ley 2.977 y sus modificaciones (BCN), incluyendo traslados de la Ley 19.668 y el solsticio de la Ley 21.357. La cuenta regresiva se actualiza sola cada día.' }
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
        { '@type': 'ListItem', position: 3, name: 'Próximo feriado', item: url }
      ]},
      { '@type': 'Article', headline: title.replace(/¿/g, '').replace(/á/g, 'a').replace(/ó/g, 'o'),
        description: desc, url: url, inLanguage: 'es-CL', datePublished: buildDate, dateModified: buildDate,
        author: { '@id': 'https://' + domain + '/#author' }, publisher: { '@id': 'https://' + domain + '/#org' },
        mainEntityOfPage: url, isPartOf: { '@id': 'https://' + domain + '/#website' } },
      { '@type': 'FAQPage', mainEntity: faqs.map(function (f) {
        return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }; }) }
    ]
  };

  var html = '<!DOCTYPE html>\n' +
'<html lang="es-CL" dir="ltr">\n' +
'<head>\n' +
'  <meta charset="utf-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'  <title>' + esc(title) + '</title>\n' +
'  <meta name="description" content="' + esc(desc) + '">\n' +
'  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, noai, noimageai">\n' +
'  <meta name="claim-data" content="feriado_viernes_santo,feriado_dia_trabajo,feriado_glorias_navales,feriado_san_pedro_san_pablo,feriado_encuentro_dos_mundos,feriado_inmaculada_concepcion">\n' +
'  <link rel="canonical" href="' + url + '">\n' +
'  <link rel="alternate" hreflang="es-CL" href="' + url + '">\n' +
'  <link rel="alternate" hreflang="es" href="' + url + '">\n' +
'  <link rel="alternate" hreflang="x-default" href="' + url + '">\n' +
'  <meta property="og:type" content="article">\n' +
'  <meta property="og:url" content="' + url + '">\n' +
'  <meta property="og:title" content="' + esc(title) + '">\n' +
'  <meta property="og:description" content="' + esc(desc) + '">\n' +
'  <meta property="og:image" content="https://' + domain + '/icons/og-image.png">\n' +
'  <meta property="og:locale" content="es_CL">\n' +
'  <meta property="og:site_name" content="Calendario Escolar Chile">\n' +
'  <meta name="twitter:card" content="summary_large_image">\n' +
'  <meta name="twitter:title" content="' + esc(title) + '">\n' +
'  <meta name="twitter:description" content="' + esc(desc) + '">\n' +
'  <meta name="twitter:image" content="https://' + domain + '/icons/og-image.png">\n' +
'  <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">\n' +
'  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">\n' +
'  <meta name="theme-color" content="#7c3aed">\n' +
'  <link rel="stylesheet" href="/css/tokens.css">\n' +
'  <link rel="stylesheet" href="/css/base.css">\n' +
'  <link rel="stylesheet" href="/css/components.css">\n' +
'  <script type="application/ld+json">\n' + JSON.stringify(schema, null, 2) + '\n  </script>\n' +
'</head>\n' +
'<body>\n' +
'  <a href="#main" class="skip-link">Saltar al contenido</a>\n' +
'  <header class="site-header">\n' +
'    <div class="container">\n' +
'      <a href="/" class="site-header__brand">Calendario Escolar Chile</a>\n' +
'      <nav class="site-header__nav" aria-label="Principal">\n' +
'        <a href="/">Inicio</a>\n        <a href="/feriados-2026">Feriados</a>\n        <a href="/about">Info</a>\n' +
'        <button id="theme-toggle" type="button" aria-label="Cambiar tema">&#9790;</button>\n' +
'      </nav>\n    </div>\n  </header>\n' +
'  <main id="main">\n    <div class="container">\n' +
'      <nav class="breadcrumb" aria-label="Breadcrumb">\n' +
'        <a href="/">Inicio</a> <span>&rsaquo;</span> <a href="/feriados-2026">Feriados 2026</a> <span>&rsaquo;</span> Pr&oacute;ximo feriado\n' +
'      </nav>\n' +
'      <div class="hero-section">\n' +
'        <h1>&iquest;Cu&aacute;l es el pr&oacute;ximo feriado en Chile?</h1>\n' +
'        <p class="hero-sub">El pr&oacute;ximo feriado es <strong id="pf-nombre">' + esc(proxNombre) + '</strong>, el <strong id="pf-fecha">' + esc(proxFechaTxt) + '</strong>. La cuenta regresiva se actualiza sola cada d&iacute;a.</p>\n' +
'      </div>\n' +
'      <section class="key-facts" aria-label="Pr&oacute;ximo feriado">\n' +
'        <div class="key-fact key-fact--primary">\n          <p class="key-fact__label">Pr&oacute;ximo feriado</p>\n          <p class="key-fact__date" id="pf-nombre2">' + esc(proxNombre) + '</p>\n          <p class="key-fact__note" id="pf-fecha2">' + esc(proxFechaTxt) + '</p>\n        </div>\n' +
'        <div class="key-fact key-fact--accent">\n          <p class="key-fact__label">Faltan</p>\n          <p class="key-fact__date" id="pf-dias">' + esc(proxDiasTxt) + '</p>\n          <p class="key-fact__note">para el pr&oacute;ximo feriado</p>\n        </div>\n' +
'        <div class="key-fact key-fact--warning">\n          <p class="key-fact__label">Impacto escolar</p>\n          <p class="key-fact__date" style="font-size:var(--text-lg)" id="pf-impacto">' + esc(proxImpacto) + '</p>\n          <p class="key-fact__note">en la mayor&iacute;a de las regiones</p>\n        </div>\n' +
'        <div class="key-fact key-fact--success">\n          <p class="key-fact__label">Feriados restantes</p>\n          <p class="key-fact__date" id="pf-restantes">' + nRestantes + '</p>\n          <p class="key-fact__note">en ' + year + '</p>\n        </div>\n' +
'      </section>\n' +
'      <section class="section" aria-label="Feriados restantes ' + year + '">\n' +
'        <h2>Feriados que quedan en ' + year + '</h2>\n' +
'        <p>Estos son los feriados de Chile desde hoy hasta fin de a&ntilde;o, con su impacto en el calendario escolar:</p>\n' +
'        <div class="table-wrapper">\n          <table aria-label="Feriados restantes ' + year + ' Chile">\n' +
'            <thead>\n              <tr><th>Fecha</th><th>Feriado</th><th>Tipo</th><th>Impacto escolar</th></tr>\n            </thead>\n' +
'            <tbody id="pf-tbody">\n' + filas + '\n            </tbody>\n          </table>\n        </div>\n' +
'        <p class="card__meta" style="margin-top:var(--space-3)">\n' +
'          Fuente: <a href="https://www.bcn.cl/leychile/Navegar?idNorma=23639" rel="noopener noreferrer" target="_blank">Ley 2.977 y modificaciones (BCN)</a> &middot;\n' +
'          <a href="/feriados-2026">Ver los 16 feriados de ' + year + ' &rarr;</a>\n        </p>\n      </section>\n' +
'      <section class="section" id="faq">\n        <h2>Preguntas frecuentes</h2>\n\n' + faqHtml + '\n      </section>\n' +
'      <section class="section">\n        <h2>Consulta tambi&eacute;n</h2>\n        <div class="card-grid">\n' +
'          <a href="/feriados-2026" class="card" style="text-decoration:none; color:inherit;">\n            <h3 class="card__title" style="color:var(--color-primary);">Todos los feriados 2026</h3>\n            <p>Los 16 feriados del a&ntilde;o con respaldo legal y su impacto escolar.</p>\n          </a>\n' +
'          <a href="/vacaciones-invierno-2026" class="card" style="text-decoration:none; color:inherit;">\n            <h3 class="card__title" style="color:var(--color-accent);">Vacaciones de Invierno 2026</h3>\n            <p>Fechas por regi&oacute;n: la mayor&iacute;a parte el 22 de junio.</p>\n          </a>\n' +
'          <a href="/feriados-2027" class="card" style="text-decoration:none; color:inherit;">\n            <h3 class="card__title" style="color:var(--color-success);">Feriados 2027</h3>\n            <p>Adelanta el pr&oacute;ximo a&ntilde;o: feriados y fines de semana largos.</p>\n          </a>\n        </div>\n      </section>\n' +
'    </div>\n  </main>\n' +
'  <div data-verificacion-footer>\n    <div class="verificacion-footer">\n      <p>Feriados calculados de forma determin&iacute;stica desde la legislaci&oacute;n vigente (BCN).</p>\n    </div>\n  </div>\n' +
'  <footer class="site-footer">\n    <div class="container">\n      <ul class="site-footer__links">\n' +
'        <li><a href="/">Inicio</a></li>\n        <li><a href="/feriados-2026">Feriados 2026</a></li>\n        <li><a href="/feriados-2027">Feriados 2027</a></li>\n        <li><a href="/about">Acerca de</a></li>\n        <li><a href="/contacto">Contacto</a></li>\n        <li><a href="/privacidad">Privacidad</a></li>\n        <li><a href="/avisolegal">Aviso Legal</a></li>\n        <li><a href="https://dolaruf.cl" rel="noopener">Valor UF hoy</a></li>\n      </ul>\n' +
'      <p class="site-footer__copy">&copy; ' + year + ' Calendario Escolar Chile</p>\n      <p class="site-footer__source">Fuente: Biblioteca del Congreso Nacional &middot; Mineduc</p>\n    </div>\n  </footer>\n' +
'  <script defer src="/js/theme.js"></script>\n' +
'  <script defer src="/js/calendar-config.js"></script>\n' +
'  <script defer src="/js/analytics.js"></script>\n' +
'  <script>\n' +
'  document.addEventListener("DOMContentLoaded", function () {\n' +
'    if (typeof Theme !== "undefined") Theme.init();\n' +
'    if (typeof Analytics !== "undefined") Analytics.init("G-6FVLKF6PFQ");\n' +
'    var CAL = window.CALENDAR_CONFIG; if (!CAL || !CAL.feriadosCompletos) return;\n' +
'    var DIAS = ["domingo","lunes","martes","mi\\u00e9rcoles","jueves","viernes","s\\u00e1bado"];\n' +
'    var MES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];\n' +
'    var n = new Date(); var hoy = new Date(n.getFullYear(), n.getMonth(), n.getDate());\n' +
'    function pd(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2]);}\n' +
'    var rest = CAL.feriadosCompletos.filter(function(f){return pd(f.date)>=hoy;}).sort(function(a,b){return a.date<b.date?-1:1;});\n' +
'    var set = function(id,v){var e=document.getElementById(id); if(e) e.textContent=v;};\n' +
'    set("pf-restantes", rest.length);\n' +
'    if (!rest.length) return;\n' +
'    var f = rest[0]; var d = pd(f.date);\n' +
'    var fechaTxt = DIAS[d.getDay()].charAt(0).toUpperCase()+DIAS[d.getDay()].slice(1)+" "+d.getDate()+" de "+MES[d.getMonth()]+" de "+d.getFullYear();\n' +
'    var dias = Math.ceil((d-hoy)/86400000);\n' +
'    set("pf-nombre", f.nombre); set("pf-nombre2", f.nombre);\n' +
'    set("pf-fecha", fechaTxt); set("pf-fecha2", fechaTxt);\n' +
'    set("pf-dias", dias===0?"\\u00a1Hoy!":(dias===1?"Ma\\u00f1ana":dias+" d\\u00edas"));\n' +
'    set("pf-impacto", f.contexto==="en-clases"?"Suspende clases":(f.notaContexto||"Sin impacto escolar"));\n' +
'  });\n' +
'  </script>\n' +
'</body>\n</html>\n';

  fs.writeFileSync(path.join(outputDir, 'proximo-feriado.html'), html);
  console.log('Generado public/proximo-feriado.html (proximo: ' + (prox ? prox.nombre : 'ninguno') + ', ' + nRestantes + ' restantes)');
  return { loc: url, priority: '0.8', changefreq: 'daily' };
};
