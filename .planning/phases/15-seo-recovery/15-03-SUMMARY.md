---
plan: 15-03
phase: 15-seo-recovery
status: complete
completed: 2026-04-23
---

# Summary — 15-03: Regenerar artefactos + validar + BLUEPRINT v3

## What was built
- `npm run generate` exitcode 0: sitemap regenerado con `<loc>` sin `.html`, 16 páginas región, health.json, regions-data.js, calendar-config.js
- `node scripts/validate.js` exitcode 0 (3 warnings conocidos: source-health.json, feriados-2027, quienes-somos — ninguno es error)
- `BLUEPRINT.md` actualizado con SEO Recovery v3: diagnóstico March 2026 Core Update, fixes aplicados, baseline 2026-04-23, gate de escalación, Track C manual pendiente

## Key files
- `public/sitemap.xml` — `<loc>https://calendarioescolar.cl/vacaciones-invierno-2026</loc>` sin .html ✓
- `public/health.json` — generatedDate: 2026-04-23
- `BLUEPRINT.md` — sección "SEO Recovery v3 — Core Update response (2026-04-23)"

## Commit
4769d46 chore(seo): regenerar artefactos + validar + BLUEPRINT SEO Recovery v3

## Self-Check: PASSED
- sitemap no contiene vacaciones-invierno-2026.html → 0 matches ✓
- sitemap contiene vacaciones-invierno-2026 sin .html ✓
- health.json generatedDate 2026-04-23 ✓
- BLUEPRINT contiene "SEO Recovery v3" → 2 matches ✓
- BLUEPRINT contiene "2026-04-23" → 4 matches ✓
- BLUEPRINT contiene "Track C" → 1 match ✓
- validate.js exitcode 0 ✓
