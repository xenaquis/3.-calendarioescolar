---
plan: 15-01
phase: 15-seo-recovery
status: complete
completed: 2026-04-23
---

# Summary — 15-01: Canonical/hreflang/og:url sin .html + sitemap fix

## What was built
Eliminadas señales canónicas contradictorias en 4 landings SEO y en el sitemap.

- `vacaciones-invierno-2026.html`: canonical, 3 hreflang, og:url → sin `.html`
- `feriados-2026.html`: canonical, 3 hreflang, og:url → sin `.html`
- `cuando-empiezan-clases-2026.html`: canonical, 3 hreflang, og:url → sin `.html`
- `about.html`: canonical, 3 hreflang, og:url → sin `.html`
- `scripts/generate-pages.js` línea 74: slug para `<loc>` del sitemap ahora usa `.replace(/\.html$/, '')`

## Key files
- `public/vacaciones-invierno-2026.html` — canonical/hreflang/og:url sin .html
- `public/feriados-2026.html` — canonical/hreflang/og:url sin .html
- `public/cuando-empiezan-clases-2026.html` — canonical/hreflang/og:url sin .html
- `public/about.html` — canonical/hreflang/og:url sin .html
- `scripts/generate-pages.js` — sitemap <loc> sin .html

## Commit
58e528c fix(seo): canonical/hreflang/og:url sin .html en 4 landings + sitemap loc fix

## Self-Check: PASSED
- grep .html en canonical/hreflang/og:url de los 4 archivos → 0 resultados ✓
- generate-pages.js contiene `.replace(/\.html$/, '')` en slug del sitemap ✓
