#!/usr/bin/env node
/* normalize-internal-links.js — Convierte enlaces internos .html a pretty-URL.
   Cloudflare Pages sirve /pagina desde /pagina.html (clean URLs); el canonical y el
   sitemap ya usan pretty-URL, pero los hrefs internos usaban .html, causando doble
   indexacion. Este script alinea hrefs + canonical/og/twitter a pretty-URL.

   Uso: node scripts/normalize-internal-links.js [--dry]
   Aplica a: public/*.html (top-level) + data/template.html
   Solo toca enlaces internos root-relative (/x.html) y URLs absolutas de calendarioescolar.cl.
   NO toca: index.html (raiz), enlaces externos, /region/.../ , /feriados/.../ (ya son pretty). */

var fs = require('fs');
var path = require('path');

var DRY = process.argv.indexOf('--dry') !== -1;
var ROOT = path.join(__dirname, '..');
var PUBLIC = path.join(ROOT, 'public');

var files = fs.readdirSync(PUBLIC)
  .filter(function (f) { return /\.html$/.test(f); })
  .map(function (f) { return path.join(PUBLIC, f); });
files.push(path.join(ROOT, 'data', 'template.html'));

// href="/algo.html"  o  href="/algo.html#frag"  -> sin .html
var reRootRel = /(href=")(\/[a-z0-9][a-z0-9\-]*)\.html((?:#[a-z0-9\-]+)?")/g;
// content/href="https://calendarioescolar.cl/algo.html"  (canonical, og:url, alternate, twitter)
var reAbs = /((?:href|content)="https:\/\/calendarioescolar\.cl\/[a-z0-9][a-z0-9\-]*)\.html(")/g;

var totalFiles = 0, totalRepl = 0;
files.forEach(function (file) {
  if (!fs.existsSync(file)) return;
  var src = fs.readFileSync(file, 'utf8');
  var n = 0;
  var out = src
    .replace(reRootRel, function (m, a, slug, tail) { n++; return a + slug + tail; })
    .replace(reAbs, function (m, a, tail) { n++; return a + tail; });
  if (n > 0) {
    totalFiles++; totalRepl += n;
    console.log((DRY ? '[dry] ' : '') + path.relative(ROOT, file) + ': ' + n + ' enlaces');
    if (!DRY) fs.writeFileSync(file, out);
  }
});
console.log((DRY ? '[dry] ' : '') + 'Total: ' + totalRepl + ' enlaces en ' + totalFiles + ' archivos');
