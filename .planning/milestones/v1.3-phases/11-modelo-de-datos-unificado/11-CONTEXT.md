# Phase 11: Modelo de Datos Unificado - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Infrastructure phase — discuss skipped

<domain>
## Phase Boundary

Unificar afirmaciones.json (~50 claims) + legal-articles.json (15 claims) en un solo claims.json enriquecido. Build enforcement: npm run build falla si claim normativo carece de extracto verbatim o hash SHA256.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data/afirmaciones.json` — 50 claims with sources, data_keys, tags (v1.0.0)
- `data/legal-articles.json` — 15 feriado claims with ley_id, articulo_numero, texto_verbatim, hash_sha256, last_checked
- `scripts/validate.js` — existing build validation (checks claim-data meta tags against afirmaciones.json)
- `scripts/bcn-extractor.py` — generates legal-articles.json from BCN API

### Established Patterns
- Claim-centric model: claims linked to data_keys, pages declare via `<meta name="claim-data">`
- Build-time resolution of claim-to-page mapping
- JSON as data interchange format, no npm dependencies
- validate.js exits 1 on errors, warnings for non-critical issues

### Integration Points
- `scripts/generate-pages.js` reads from data/*.json
- `scripts/validate.js` validates data integrity at build time
- `scripts/check-bcn-changes.py` reads legal-articles.json for change detection
- `npm run build` calls validate.js

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
