---
phase: 11-modelo-de-datos-unificado
plan: "02"
subsystem: build-validation
tags: [claims, validation, enforcement, build, legal]
dependency_graph:
  requires: ["11-01"]
  provides: ["build-enforcement-claims", "normative-verbatim-gate"]
  affects: ["scripts/validate.js", "data/claims.json"]
tech_stack:
  added: []
  patterns: ["claims.json enforcement in validate.js", "BCN normative gate via source_id prefix"]
key_files:
  modified:
    - scripts/validate.js
    - data/claims.json
decisions:
  - "Switch validate.js section 7 from afirmaciones.json to claims.json as primary source with afirmaciones.json fallback"
  - "BCN normative detection via source_id.startsWith('bcn-') — simple prefix, no extra config"
  - "3 contextual BCN claims (total-feriados, corpus-christi-movil, san-pedro-traslado-2026) backfilled with verbatim from legal-articles.json — they had source_id but no verbatim after Plan 01 merge"
metrics:
  duration: "7 min"
  completed: "2026-03-25T13:44:00Z"
  tasks: 2
  files: 2
---

# Phase 11 Plan 02: Validate.js Claims Enforcement Summary

**One-liner:** Build gate enforcing extracto_verbatim + hash_sha256 on all BCN-sourced claims via claims.json (18/18 normativas verified).

## What Was Built

Updated `scripts/validate.js` section 7 to use `data/claims.json` as the source of truth for claim validation, replacing `data/afirmaciones.json`. Added normative enforcement (JSON-04): any claim with `source_id` starting with `"bcn-"` must have non-null `extracto_verbatim` and `hash_sha256` — build fails otherwise.

Key changes to validate.js:
- Section 7 rewritten to read `data/claims.json` first, fall back to `data/afirmaciones.json` with deprecation warning
- Section 7b: new enforcement block iterating claims and erroring on missing verbatim/hash for BCN sources
- Section 7c: displayed_value coherence check updated to use `claimsData` variable
- Section 7d: orphan detection updated to use `claimsData` and report `claims.json` in error messages
- Summary line now shows `N/M normativas con verbatim` enrichment count

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update validate.js to read claims.json and enforce verbatim+hash | 5b669ef | scripts/validate.js, data/claims.json |
| 2 | Verify build enforcement with negative test | 3dfcabc | public/sitemap.xml |

## Verification

- `node scripts/validate.js` exits 0: Claims: 50 total, 6 sources, 18/18 normativas con verbatim, 39 data_keys en HTML
- `npm run build` passes end-to-end
- Negative test: nulling feriado-ano-nuevo verbatim → validate exits 1 with clear error message containing claim ID and "extracto_verbatim"
- Restored claims.json → exits 0 again

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 3 contextual BCN claims missing verbatim after Plan 01 merge**
- **Found during:** Task 1 — validate.js ran and found 3 BCN claims without verbatim/hash
- **Issue:** `total-feriados` (bcn-ley-2977), `corpus-christi-movil` (bcn-ley-2977), `san-pedro-traslado-2026` (bcn-ley-19668) had source_id pointing to BCN laws but null extracto_verbatim/hash_sha256. These were contextual/aggregate claims that the Plan 01 merge script skipped because they lacked direct legal-articles.json keys.
- **Fix:** Backfilled verbatim text and hash_sha256 from the already-extracted `data/legal-articles.json` — same article text used for other feriado claims from the same laws. Used bcn-ley-2977 Art. PRIMERO for total-feriados and corpus-christi-movil; bcn-ley-19668 Art. UNICO for san-pedro-traslado-2026.
- **Files modified:** data/claims.json
- **Commit:** 5b669ef

## Known Stubs

None. All 18 normative BCN claims now have extracto_verbatim and hash_sha256. The 32 non-normative claims (Mineduc PDF source) are correctly exempt from verbatim enforcement.

## Self-Check: PASSED
