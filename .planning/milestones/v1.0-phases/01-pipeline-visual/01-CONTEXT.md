# Phase 1: Pipeline Visual - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Reemplazar `extract-from-pdf.js` con pipeline visual: PDF → PNG → extracción estructurada → validación determinista. Lograr 100% de precisión en las 16 regiones.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Key constraints from PROJECT.md:
- PyMuPDF for PNG generation (already available in environment)
- Vanilla JS (no npm dependencies) for Node scripts
- Human-in-the-loop verification before publishing
- PNGs preserved in `data/snapshots/` as visual evidence

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/extract-from-pdf.js` — current RAG pipeline v3 (DeepSeek + pdftotext), 700+ lines
- `data/extraction-tests/TODAS-REGIONES-visual-extraction.json` — visual extraction results for all 16 regions (validated)
- Gold standards: `aysen-gold-standard.json`, `maule-gold-standard.json`, `metropolitana-gold-standard.json`
- 62 PNGs already generated in `data/extraction-tests/` from prior session
- `data/snapshots/` — 16 regional PDFs + text extractions

### Established Patterns
- Scripts use `var` + `require()` (CommonJS, no ES modules)
- IIFE pattern, `'use strict'`
- CLI flags: `--local`, `--fix`, `--region=X`, `--force`
- Cross-region validation with 4 groups: ESTÁNDAR, NORTE, SUR, SUR-PARCIAL
- Deterministic checks: date format, day-of-week, year, ordering

### Integration Points
- Output: `data/pages.json` (regional truth), `data/calendar-config.json` (temporal truth)
- Downstream: `scripts/generate-pages.js` reads these JSON files to produce HTML
- CI: `.github/workflows/extract-pdf.yml` runs extraction biannually (May 15 + Dec 31)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
