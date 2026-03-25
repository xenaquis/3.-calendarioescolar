---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Validacion Legal + Mapa Interactivo
status: Defining requirements
stopped_at: ""
last_updated: "2026-03-24T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# State — calendarioescolar.cl v1.2

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Información 100% fidedigna extraída de resoluciones oficiales, verificable visualmente
**Current focus:** Defining requirements for v1.2

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-24 — Milestone v1.2 started

## Phase Status (v1.0 — archived)

| # | Phase | Status |
|---|-------|--------|
| 1 | Pipeline Visual | completed |
| 2 | Datos Completos | completed |
| 3 | (skipped) | — |
| 4 | Mobile Responsiveness | completed |

## Phase Status (v1.1 — archived)

| # | Phase | Status |
|---|-------|--------|
| 5 | Activacion de Produccion | completed (2026-03-24) |
| 6 | Seguridad & Validacion | superseded by v1.2 |
| 7 | Mapa Interactivo | carried over to v1.2 |

## Phase Status (v1.2 — active)

| # | Phase | Status |
|---|-------|--------|
| TBD | BCN Article Extractor | Not started |
| TBD | Change Detection Pipeline | Not started |
| TBD | Tooltip UI | Not started |
| TBD | Mapa Interactivo | Not started |

## Decisions

- **[Phase 04-01]:** --space-5 set to 1.25rem (4px scale: 5×4=20px=1.25rem); --leading-relaxed set to 1.75 (standard)
- **[Phase 04-01]:** key-fact__date breakpoint at 400px targets narrowest phones (iPhone SE 375px)
- **PDF location:** Regional PDFs are in `data/extraction-tests/` (not `data/snapshots/`). Scripts handle both via `--pdf-dir` arg and worktree fallback.
- **Table PNG count:** 25 table PNGs organized (not 62 — the 62 are all pages; 25 are the table-specific ones per TODAS-REGIONES JSON)
- **Worktree paths:** organize-snapshots.js auto-detects parent project when running from git worktree
- [Phase 01]: extract-visual.js --local mode expands TODAS-REGIONES-visual-extraction.json to gold standard structure
- [Phase 01]: API mode supports Anthropic (default) and OpenAI via EXTRACTION_API env var
- [Phase 01]: Dual-format detection in validate-extraction.js: flat-field format (TODAS-REGIONES) handled by skipping label-based checks and parsing Spanish dates for cross-region analysis
- [Phase 02]: finAnoSinJEC/EPJA dates derived from regional group rules in buildFromLocalData(), not hardcoded per region
- [Phase 02]: populate-pages-json.js is a separate script from extract-visual.js for clean separation of concerns
- [Phase 02]: SUR group (Aysén, Magallanes) has different finSinJEC=23 dic, finEPJA=27 nov — verified against aysen-gold-standard.json
- [Phase 02]: Native <details> element used for collapsible — no JavaScript, works without CSS
- [Phase 02]: Section placed after main table, closed by default — secondary info not prominent
- [Phase 05]: No claim-data meta on feriados-2027.html: page has no factual claims, only fixed-by-law holiday list — warnings are expected
- [Phase 05]: Replace placeholder in all 25 HTML pages including contacto.html and quienes-somos.html not listed in plan
- [Phase 05]: Run npm run generate after template.html update to propagate GA4 ID to all 16 region pages

## Accumulated Context

- 62 PNGs generados de los 16 PDFs en `data/extraction-tests/`
- Extracción visual validada manualmente para las 16 regiones
- 5 regiones con datos corregidos en `pages.json` (Arica, Tarapacá, Los Lagos, Aysén, Magallanes)
- Gold standards creados para Metropolitana, Aysén, Maule
- BCN.cl tiene XML API estable para 6 leyes de feriados — endpoints ya en afirmaciones.json
- afirmaciones.json tiene 50 claims (version 1.0.0, generado 2026-03-17)
- v1.2: articulado verbatim solo para feriados (BCN XML); fechas escolares mantienen sistema actual

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 3 min | 2 | 28 |
| Phase 01 P02 | 2 min | 1 tasks | 2 files |
| Phase 01 P03 | 15 | 2 tasks | 3 files |
| Phase 02 P01 | 8 min | 2 tasks | 7 files |
| Phase 02 P02 | 15 | 1 tasks | 19 files |
| 04 | 01 | 4 min | 3 | 3 |
| Phase 05 P02 | 2 | 2 tasks | 3 files |
| Phase 05 P01 | 3 | 2 tasks | 32 files |

---
*Last updated: 2026-03-24 after v1.2 milestone start*
