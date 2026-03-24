---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to plan
stopped_at: Completed 01-03-PLAN.md
last_updated: "2026-03-24T14:23:59.381Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
---

# State — calendarioescolar.cl v2

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Información 100% fidedigna extraída de resoluciones oficiales, verificable visualmente
**Current focus:** Phase 01 — pipeline-visual

## Phase Status

| # | Phase | Status |
|---|-------|--------|
| 1 | Pipeline Visual | in_progress |
| 2 | Datos Completos | not_started |

## Plan Progress — Phase 01

| Plan | Name | Status |
|------|------|--------|
| 01-01 | PDF-to-PNG Pipeline Setup | completed |
| 01-02 | TBD | not_started |
| 01-03 | TBD | not_started |

## Decisions

- **PDF location:** Regional PDFs are in `data/extraction-tests/` (not `data/snapshots/`). Scripts handle both via `--pdf-dir` arg and worktree fallback.
- **Table PNG count:** 25 table PNGs organized (not 62 — the 62 are all pages; 25 are the table-specific ones per TODAS-REGIONES JSON)
- **Worktree paths:** organize-snapshots.js auto-detects parent project when running from git worktree
- [Phase 01]: extract-visual.js --local mode expands TODAS-REGIONES-visual-extraction.json to gold standard structure
- [Phase 01]: API mode supports Anthropic (default) and OpenAI via EXTRACTION_API env var
- [Phase 01]: Dual-format detection in validate-extraction.js: flat-field format (TODAS-REGIONES) handled by skipping label-based checks and parsing Spanish dates for cross-region analysis

## Context from Research (2026-03-24)

- 62 PNGs generados de los 16 PDFs en `data/extraction-tests/`
- Extracción visual validada manualmente para las 16 regiones
- 5 regiones con datos corregidos en `pages.json` (Arica, Tarapacá, Los Lagos, Aysén, Magallanes)
- Gold standards creados para Metropolitana, Aysén, Maule
- Pipeline actual (`extract-from-pdf.js`) usa DeepSeek + pdftotext — será reemplazado
- **Plan 01-01 completado (2026-03-24):** scripts/pdf-to-png.py + scripts/organize-snapshots.js + 25 tabla PNGs + png-manifest.json

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 3 min | 2 | 28 |
| Phase 01 P02 | 2 min | 1 tasks | 2 files |
| Phase 01 P03 | 15 | 2 tasks | 3 files |

## Session

**Last session:** 2026-03-24T14:18:09.419Z
**Stopped at:** Completed 01-03-PLAN.md

---
*Last updated: 2026-03-24*
