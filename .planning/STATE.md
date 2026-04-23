---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Sheet como Fuente de Verdad Unica
status: hotfix complete — Phase 15 SEO Recovery v3 executed 2026-04-23
last_updated: "2026-04-23T00:00:00.000Z"
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
active_phase: ""
---

# State — calendarioescolar.cl

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Informacion 100% fidedigna extraida de resoluciones oficiales, verificable visualmente, con el Google Sheet como fuente de verdad unica y auditable
**Current focus:** Planning next milestone

## Milestone History

| Milestone | Status | Shipped |
|-----------|--------|---------|
| v1.0 Extraccion Fidedigna + Datos Completos | Complete | 2026-03-24 |
| v1.1 Activacion & Calidad | Complete | 2026-03-25 |
| v1.2 Validacion Legal + Mapa Interactivo | Complete | 2026-03-25 |
| v1.3 Sheet como Fuente de Verdad Unica | Complete | 2026-03-25 |

## Pending Human Actions

- Search Console verification
- GA4 ↔ Search Console connection
- Bot Fight Mode activation in Cloudflare dashboard
- Google Service Account setup for Sheet write (claims-to-sheet.js)
- Telegram bot setup (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID secrets)

## Known Tech Debt

- check-bcn-changes.py reads afirmaciones.json instead of claims.json (INT-01)
- sync-deploy.yml silent-failure deploy path (INT-02)

---
*Last updated: 2026-03-25 — v1.3 milestone archived*
