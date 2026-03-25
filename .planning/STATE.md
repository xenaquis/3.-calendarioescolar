---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Sheet como Fuente de Verdad Unica
status: Phase complete — ready for verification
last_updated: "2026-03-25T17:11:22.374Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# State — calendarioescolar.cl v1.3

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Informacion 100% fidedigna extraida de resoluciones oficiales, verificable visualmente, con el Google Sheet como fuente de verdad unica y auditable
**Current focus:** Phase 14 — notificaciones-telegram (complete)

## Current Position

Phase: 14 (notificaciones-telegram) — COMPLETE
Plan: 2 of 2 (all plans complete)

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

## Phase Status (v1.2 — archived)

| # | Phase | Status |
|---|-------|--------|
| 8 | BCN Legal Extractor | completed (2026-03-25) |
| 9 | Change Detection Pipeline | completed (2026-03-25) |
| 10 | UI Verificacion + Mapa Interactivo | completed (2026-03-25) |

## Phase Status (v1.3 — active)

| # | Phase | Status |
|---|-------|--------|
| 11 | Modelo de Datos Unificado | in-progress (plan 01 complete) |
| 12 | Sheet Write | in-progress (plan 01 task 1 complete, awaiting human-verify task 2) |
| 13 | Sync Sheet → Pagina | Not started |
| 14 | Notificaciones Telegram | completed (2026-03-25) |

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
- **[Phase 09-01]:** GH_TOKEN mapped from GITHUB_TOKEN auto-token (not PAT) — requires issues:write in permissions block; avoids separate secret
- **[Phase 09-01]:** Claims grouped by ley_id before iteration — 4 BCN fetches for 15 claims, not 15 fetches
- **[Phase 09-01]:** Break on BCN error (not continue) — prevents partial data from creating misleading Issues or partial last_checked updates
- **[Phase 09-01]:** texto_antes uses stored texto_verbatim (not texto_anterior) for first-change diff — Pitfall 6 from RESEARCH.md
- **[Phase 09-01]:** Consolidated single GitHub Issue for all changes — reduces noise per CONTEXT.md decision
- [Phase 10]: CSS-only tooltip via :hover + :focus-within — zero JavaScript, works on all devices
- [Phase 10]: tabindex=0 on .bcn-badge-wrap enables keyboard/tap focus for mobile accessibility (VERI-02)
- [Phase 10]: Bot Fight Mode documented but not activated — requires human action in Cloudflare dashboard
- **[v1.3 roadmap]:** Phase 11 (JSON unification) must precede all others — claims.json is the data model everything depends on
- **[v1.3 roadmap]:** Phase 14 (Telegram) placed last — depends on pipeline context from Phase 13 but can be developed somewhat independently once sync flow is in place
- **[v1.3 roadmap]:** afirmaciones.json (~50 claims) + legal-articles.json (15 claims) merge into claims.json — 65 total claims with enriched structure
- **[Phase 11-01]:** PREGUNTA_MAP object with 50 explicit mappings at script top — fallback to claim text for unknown IDs; avoids heuristic complexity
- **[Phase 11-01]:** fuente_tipo copied per claim from sources[].type — downstream consumers can filter by source type without extra lookup
- **[Phase 11-01]:** Null-fill all legal-articles fields for unenriched claims — consistent 50-field schema across all claims
- [Phase 11-02]: Switch validate.js section 7 from afirmaciones.json to claims.json as primary source with afirmaciones.json fallback
- [Phase 11-02]: BCN normative detection via source_id.startsWith('bcn-') — simple prefix, no extra config needed
- [Phase 11-02]: 3 contextual BCN claims backfilled with verbatim from legal-articles.json (total-feriados, corpus-christi-movil, san-pedro-traslado-2026)
- **[Phase 12-01]:** require('url').parse used for tokenUri parsing in JWT auth — stdlib native, consistent with zero-dependency constraint
- **[Phase 12-01]:** REGION rows use JSON.stringify of full region object — all 19 fields auditable in one Sheet cell
- **[Phase 12-01]:** addOrClearSheet checks statusCode=400 + INVALID_ARGUMENT — handles both tab-exists error variants from Sheets API
- [Phase 12-01]: require('url').parse used for tokenUri parsing in JWT auth — stdlib native, consistent with zero-dependency constraint
- [Phase 12-01]: REGION rows use JSON.stringify of full region object — all 19 fields auditable in one Sheet cell
- [Phase 12-01]: addOrClearSheet checks statusCode=400 + INVALID_ARGUMENT — handles both tab-exists error variants from Sheets API
- [Phase 13]: Single Datos tab fetch replaces dual Regiones+Config fetch — consistent with Phase 12 write approach
- [Phase 13]: claims merge preserves existing fields (tags, data_key, etc.) and overwrites only Sheet-editable fields
- [Phase 13-02]: claims-tooltips.js generated by generate-pages.js (not manually maintained) — keeps tooltip logic in sync with data model
- [Phase 13-02]: generate-verificacion.js reads claims.json primary with afirmaciones.json fallback — backward compatible
- [Phase 13-02]: claims-tooltips.js generated by generate-pages.js (not manually maintained) — keeps tooltip logic in sync with data model
- [Phase 13-02]: generate-verificacion.js reads claims.json primary with afirmaciones.json fallback — backward compatible
- [Phase 14-01]: EVAL_EMOJI maps sin_impacto to checkmark (not green circle) for better Telegram client compatibility
- [Phase 14-01]: Message split strategy: summary first then per-change details when total exceeds 4096 chars
- **[Phase 14-02]:** subprocess.run with input=json.dumps(payload) bridges Python change-detection pipeline to Node.js notify-telegram.js
- **[Phase 14-02]:** --dry-run propagated to notify-telegram.js for end-to-end message preview without Telegram credentials
- [Phase 14-02]: subprocess.run with input=json.dumps(payload) is the bridge between Python pipeline and Node.js notify-telegram.js

## Accumulated Context

- 62 PNGs generados de los 16 PDFs en `data/extraction-tests/`
- Extracción visual validada manualmente para las 16 regiones
- 5 regiones con datos corregidos en `pages.json` (Arica, Tarapacá, Los Lagos, Aysén, Magallanes)
- Gold standards creados para Metropolitana, Aysén, Maule
- BCN.cl usa nuevo.leychile.cl JSON API (no XML — SPA migration ~2022). Endpoints en afirmaciones.json solo sirven para extraer idNorma
- afirmaciones.json tiene 50 claims (version 1.0.0, generado 2026-03-17) — idNorma corregido para bcn-ley-20148: 257742→257080
- v1.2: articulado verbatim solo para feriados (BCN JSON); fechas escolares mantienen sistema actual
- bcn-extractor.py --dry-run verificado: 4 leyes, 15 claims, articulos extraidos correctamente
- check-bcn-changes.py --dry-run verificado: 4 leyes, 15 claims, 0 cambios detectados (hashes coinciden con BCN actual al 2026-03-25)
- GitHub labels bcn-change y legal-review deben crearse manualmente antes de la primera ejecucion del Action
- v1.3: Google Sheet ya tiene pestanas Regiones y Config — nueva pestana "Datos" consolida todo
- v1.3: Tooltip text actualmente hardcodeado en HTML (tech debt INT-01) — Phase 13 lo elimina via claims.json generado desde Sheet

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
| 09 | 01 | 3 min | 2 | 4 |
| Phase 10 P01 | 2 | 2 tasks | 3 files |
| 11 | 01 | 2 min | 2 | 2 |
| Phase 11 P02 | 7 | 2 tasks | 2 files |
| 12 | 01 | 5 min | 1/2 tasks | 2 files (Task 2 pending GOOGLE_SERVICE_ACCOUNT_KEY) |

---
*Last updated: 2026-03-25 — Phase 12 Plan 01 Task 1 complete: claims-to-sheet.js (557 lines, JWT auth, dry-run verified)*
| Phase 12 P01 | 5 | 1 tasks | 2 files |
| Phase 13 P01 | 4 min | 2 tasks | 2 files |
| Phase 13 P02 | 8 | 1 tasks | 5 files |
| Phase 14 P01 | 2 | 1 tasks | 1 files |
| Phase 14 P02 | 5 min | 2 tasks | 2 files |
