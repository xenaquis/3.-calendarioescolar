---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Validacion Legal + Mapa Interactivo
status: Ready to plan
last_updated: "2026-03-25T04:19:18.501Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
---

# State — calendarioescolar.cl v1.2

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Información 100% fidedigna extraída de resoluciones oficiales, verificable visualmente
**Current focus:** Phase 08 — bcn-legal-extractor

## Current Position

Phase: 9
Plan: Not started

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
| 5 | Activacion de Produccion | completed (2026-03-25) |
| 6 | Seguridad & Validacion | superseded by v1.2 |
| 7 | Mapa Interactivo | consolidated into Phase 10 |

## Phase Status (v1.2 — active)

| # | Phase | Status |
|---|-------|--------|
| 8 | BCN Legal Extractor | In progress — Task 1 done, Task 2 blocked (ANTHROPIC_API_KEY) |
| 9 | Change Detection Pipeline | Not started |
| 10 | UI Verificacion + Mapa Interactivo | Not started |

## Decisions

- **[Phase 08-01]:** import anthropic inside build_claude_client() — allows --dry-run without anthropic SDK installed
- **[Phase 08-01]:** source_id None check uses 'or empty string' pattern — JSON null becomes Python None, .startswith() fails on None
- **[Phase 08-01]:** IDNORMA_CORRECTIONS dict as defense-in-depth even after fixing afirmaciones.json — bcn-ley-20148 corrected 257742→257080
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
- **[v1.2 roadmap]:** VERI tooltip grouped with MAP in Phase 10 — both are frontend UI concerns; BCN extractor (Phase 8) delivers the data both depend on
- **[v1.2 roadmap]:** SEC-01 (Bot Fight Mode docs) attached to Phase 10 — standalone doc task, no dependencies
- [Phase 08-01]: Switched from Anthropic Claude to DeepSeek API (OpenAI-compatible) — ANTHROPIC_API_KEY unavailable; DEEPSEEK_API_KEY used with openai SDK base_url override
- [Phase 08-01]: Ordinal-to-numeric mapping in find_article_text() — BCN estructura uses PRIMERO/SEGUNDO/UNICO ordinals; ORDINAL_MAP normalizes before matching DeepSeek numeric output

## Accumulated Context

- 62 PNGs generados de los 16 PDFs en `data/extraction-tests/`
- Extracción visual validada manualmente para las 16 regiones
- 5 regiones con datos corregidos en `pages.json` (Arica, Tarapacá, Los Lagos, Aysén, Magallanes)
- Gold standards creados para Metropolitana, Aysén, Maule
- BCN.cl usa nuevo.leychile.cl JSON API (no XML — SPA migration ~2022). Endpoints en afirmaciones.json solo sirven para extraer idNorma
- afirmaciones.json tiene 50 claims (version 1.0.0, generado 2026-03-17) — idNorma corregido para bcn-ley-20148: 257742→257080
- v1.2: articulado verbatim solo para feriados (BCN JSON); fechas escolares mantienen sistema actual
- bcn-extractor.py --dry-run verificado: 4 leyes, 15 claims, articulos extraidos correctamente

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
| 08 | 01 | 4 min | 1/2 tasks | 4 files (Task 2 pending ANTHROPIC_API_KEY) |

---
*Last updated: 2026-03-25 — Phase 08-01 Task 1 complete; checkpoint at Task 2 (ANTHROPIC_API_KEY required)*
| Phase 08 P01 | 14 | 2 tasks | 5 files |
