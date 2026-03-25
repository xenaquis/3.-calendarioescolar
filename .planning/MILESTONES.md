# Milestones

## v1.3 Sheet como Fuente de Verdad Unica (Shipped: 2026-03-25)

**Phases completed:** 4 phases, 7 plans, 14 tasks
**Stats:** 32 files changed, 4,072 insertions, 437 deletions
**Timeline:** 2026-03-25 (single day)

**Key accomplishments:**

- Unified data model: afirmaciones.json + legal-articles.json merged into claims.json (50 claims, 18 with BCN verbatim)
- Google Sheet write: claims-to-sheet.js exports claims, regions, and config to "Datos" tab with JWT auth
- Sheet as single source of truth: sync-from-sheet.js reads Datos tab, generates 3 JSON files, daily cron deploys
- Dynamic tooltips: claims-data.js + claims-tooltips.js replace 7 hardcoded BCN tooltip texts
- Telegram notifications replace GitHub Issues for BCN change detection alerts

**Tech debt:** check-bcn-changes.py still reads afirmaciones.json (not claims.json); sync-deploy.yml silent-failure path

---

## v1.2 Validacion Legal + Mapa Interactivo (Shipped: 2026-03-25)

**Phases completed:** 3 phases, 3 plans, 6 tasks

**Key accomplishments:**

- bcn-extractor.py fetches 4 Chilean holiday laws via BCN JSON API using DeepSeek to identify relevant articles, producing data/legal-articles.json with 15 claims containing verbatim legal text and SHA256 hashes

---

## v1.1 Activacion & Calidad (Shipped: 2026-03-25)

**Phases completed:** 1 phases, 2 plans, 3 tasks

**Key accomplishments:**

- GA4 real (G-6FVLKF6PFQ) activado en 25 paginas, og-image.png, feriados-2027.html, guia Search Console

---

## v1.0 Extraccion Fidedigna + Datos Completos (Shipped: 2026-03-24)

**Phases completed:** 3 phases, 6 plans, 8 tasks

**Key accomplishments:**

- Pipeline visual completo: PDF → PNG → Claude Code multimodal → JSON verificado para 16 regiones
- Datos extendidos con seccion colapsable: cierre actas 4 Medio, fin JEC/sin JEC/EPJA, dia del profesor
- Mobile responsiveness con breakpoints optimizados

---
