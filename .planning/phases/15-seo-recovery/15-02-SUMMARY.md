---
plan: 15-02
phase: 15-seo-recovery
status: complete
completed: 2026-04-23
---

# Summary — 15-02: Home content recovery

## What was built
Recuperadas señales de contenido en home para respuesta al March 2026 Core Update.

- `<title>` revertido a "Calendario Escolar 2026 Chile — Fechas Oficiales por Región"
- og:title, twitter:title, og:description, twitter:description, meta description actualizados
- H2 `region-picker__h2` "¿De qué región eres?" agregado dentro de `.region-picker`
- `<section class="region-index">` con 16 anchors crawlables a páginas de región
- `<section class="home-stats">` con semana escolar actual / días a vacaciones / feriados restantes
- `initHomeStats()` en app.js (lee CAL.schoolStart, CAL.winterStart, CAL.feriadosCompletos)
- CSS para `.region-picker__h2`, `.region-index`, `.home-stats` en components.css
- Cache bust: components.css?v=5, app.js?v=4
- dateModified 2026-04-23 en schemas JSON-LD de 5 archivos (index + 4 landings)

## Key files
- `public/index.html` — título revertido, H2, region-index, home-stats, dateModified
- `public/js/app.js` — initHomeStats() + llamada en init()
- `public/css/components.css` — estilos region-index y home-stats
- `public/vacaciones-invierno-2026.html`, `feriados-2026.html`, `cuando-empiezan-clases-2026.html`, `about.html` — dateModified

## Commit
5b7896f feat(seo): recuperar señales home — title ranker, link graph 16 regiones, stats bar

## Self-Check: PASSED
- title contiene "Fechas Oficiales por Región" ✓
- 32 href="/region/" en index.html (≥16) ✓
- home-stats: 13 matches en index.html ✓
- initHomeStats: 2 matches en app.js (def + llamada) ✓
- components.css?v=5 y app.js?v=4 ✓
- dateModified "2026-04-23" en index.html ✓
- id="region-select" presente (select no eliminado) ✓
- 13 matches region-index|home-stats en components.css ✓
