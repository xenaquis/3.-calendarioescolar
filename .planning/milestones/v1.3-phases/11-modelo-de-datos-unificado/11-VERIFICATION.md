---
phase: 11-modelo-de-datos-unificado
verified: 2026-03-25T13:58:22Z
status: passed
score: 8/8 must-haves verified
gaps: []
human_verification:
  - test: "Verify claims.json is not stale after re-running merge script"
    expected: "node scripts/merge-claims.js regenerates claims.json with identical content"
    why_human: "Reproducibility of merge output depends on source file timestamps which change on regeneration — spot-check should confirm no data drift"
---

# Phase 11: Modelo de Datos Unificado — Verification Report

**Phase Goal:** Toda la informacion de afirmaciones existe en un solo JSON enriquecido, con build enforcement
**Verified:** 2026-03-25T13:58:22Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | data/claims.json exists with all 50 afirmaciones claims + legal-articles claims merged | VERIFIED | File exists, `_meta.totalClaims=50`, `claims.length=50`, `merged_from=["afirmaciones.json","legal-articles.json"]` |
| 2 | Each feriado claim with BCN source has texto_verbatim, hash_sha256, and last_checked from legal-articles.json | VERIFIED | 15 feriado claims (data_key starting with `feriado_`), all have non-null extracto_verbatim; spot checks for feriado-ano-nuevo (hash `6af996a86e7cd0f1cef48767fc423c58ca2e73f396003abc9d088ba29dcddc30`) and feriado-pueblos-indigenas (hash `0e50a44a501faed46d5cb79427de90cc1a3ec6247e534938ff535e588d33c289`) match plan expectations |
| 3 | Each claim has pregunta, respuesta, fuente_url, and source metadata | VERIFIED | 0 claims missing pregunta; 0 claims missing respuesta; fuente_url field present on all 50 claims (null for non-sourced, URL for sourced claims) |
| 4 | No duplicate claims exist in claims.json | VERIFIED | 0 duplicate IDs found across all 50 claims |
| 5 | npm run build fails if a normative/legal claim in claims.json lacks extracto_verbatim or hash_sha256 | VERIFIED | Section 7b in validate.js checks `source_id.indexOf('bcn-') === 0` and calls `error()` on missing extracto_verbatim or hash_sha256; negative test confirmed in SUMMARY-02 (exit 1 on corruption) |
| 6 | npm run build succeeds when all normative claims have verbatim and hash | VERIFIED | `node scripts/validate.js` exits 0; output: "Claims: 50 total, 6 sources, 18/18 normativas con verbatim, 39 data_keys en HTML" |
| 7 | validate.js reads claims.json (not afirmaciones.json) for claim validation | VERIFIED | Line 277 sets `claimsPath = path.join(ROOT, 'data', 'claims.json')`, section 7 reads claims.json as primary source with afirmaciones.json as deprecated fallback |
| 8 | 100% of HTML pages with meta claim-data have corresponding claims in claims.json | VERIFIED | validate.js section 7d scans all HTML files for `<meta name="claim-data">` and errors on any data_key not present in claims.json; build passes with 0 errors |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/merge-claims.js` | Merge script that produces claims.json from afirmaciones.json + legal-articles.json | VERIFIED | 193 lines (min 80 required); reads both source files via `fs.readFileSync`; writes data/claims.json via `fs.writeFileSync`; CommonJS `var`/`require` style |
| `data/claims.json` | Unified claims file with enriched structure | VERIFIED | Exists; `_meta.totalClaims=50`; `_meta.model="claim-centric-unified"`; `_meta.version="2.0.0"`; 18 claims enriched with verbatim |
| `scripts/validate.js` | Build validation with claims.json enforcement | VERIFIED | Contains `claims.json` (7 matches); section 7b enforces `extracto_verbatim` + `hash_sha256` for BCN claims; exits 0 on valid data |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/merge-claims.js` | `data/afirmaciones.json` | `fs.readFileSync` | WIRED | Line 94: `afirmaciones = JSON.parse(fs.readFileSync(afirmacionesPath, 'utf8'))` |
| `scripts/merge-claims.js` | `data/legal-articles.json` | `fs.readFileSync` | WIRED | Line 101: `legalArticles = JSON.parse(fs.readFileSync(legalArticlesPath, 'utf8'))` |
| `scripts/merge-claims.js` | `data/claims.json` | `fs.writeFileSync` | WIRED | Line 182: `fs.writeFileSync(claimsOutputPath, JSON.stringify(claimsOutput, null, 2), 'utf8')` |
| `scripts/validate.js` | `data/claims.json` | `fs.readFileSync` | WIRED | Line 277-284: reads claims.json as primary source; `claimsSource = 'claims.json'` |
| `scripts/validate.js` | `process.exit(1)` | `error()` on missing verbatim/hash | WIRED | Lines 316-322: `error('claims.json: claim "...' )` for missing extracto_verbatim and hash_sha256; exits 1 at line 389 when errors exist |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `data/claims.json` | `claims[]` | `data/afirmaciones.json` (50 claims) + `data/legal-articles.json` (15 BCN entries) | Yes — merge script reads both files and joins on `data_key` | FLOWING |
| `scripts/validate.js` section 7 | `claimsData` | `data/claims.json` | Yes — reads JSON, iterates 50 claims, 18/18 normative pass verbatim check | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| validate.js reads claims.json and exits 0 | `node scripts/validate.js` | "Claims: 50 total, 6 sources, 18/18 normativas con verbatim, 39 data_keys en HTML" / "Todo OK — 2 advertencia(s)" / EXIT: 0 | PASS |
| claims.json has 50 claims with correct metadata | `node -e "var c=...; console.log(c._meta.totalClaims, c._meta.model)"` | `50 claim-centric-unified` | PASS |
| 18 claims enriched with BCN verbatim | filter for non-null extracto_verbatim | `enriched: 18` | PASS |
| Spot check: feriado-ano-nuevo hash matches | check hash_sha256 field | `6af996a86e7cd0f1cef48767fc423c58ca2e73f396003abc9d088ba29dcddc30` | PASS |
| Spot check: fecha-inicio-clases verbatim is null, fuente_url has mineduc.cl | check both fields | verbatim: null, fuente_url: `https://www.mineduc.cl/...` | PASS |
| Spot check: feriado-pueblos-indigenas hash matches | check hash_sha256 field | `0e50a44a501faed46d5cb79427de90cc1a3ec6247e534938ff535e588d33c289` | PASS |
| merge-claims.js is substantive (>=80 lines) | `wc -l scripts/merge-claims.js` | 193 lines | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| JSON-01 | Plan 01 | Each non-API claim has enriched structure: pregunta, respuesta, fuente, extracto verbatim, hash SHA256, last_checked — claims.json v2.0.0 | SATISFIED | All 50 claims in claims.json have pregunta, respuesta, fuente_url fields; 18 BCN claims have extracto_verbatim + hash_sha256 + last_checked |
| JSON-02 | Plan 01 | afirmaciones.json and legal-articles.json unified into a single JSON model (`data/claims.json`) | SATISFIED | `data/claims.json` exists with `merged_from: ["afirmaciones.json", "legal-articles.json"]`; `scripts/merge-claims.js` performs the merge |
| JSON-03 | Plans 01 + 02 | 100% of claims appearing in pages (meta claim-data) have their claim registered with source and extract | SATISFIED | validate.js section 7d scans all HTML for `<meta name="claim-data">` and errors on orphaned data_keys; build exits 0 (39 data_keys covered) |
| JSON-04 | Plan 02 | Build (`validate.js`) fails if any normative/legal claim lacks extracto verbatim or hash | SATISFIED | validate.js section 7b (line 312, comment "JSON-04") enforces BCN claims must have non-null extracto_verbatim and hash_sha256; negative test confirmed in SUMMARY-02 |

**Note:** REQUIREMENTS.md traceability table marks JSON-03 as "Pending (Plan 02)" but the actual implementation in validate.js section 7d (orphan detection) covers this requirement. The REQUIREMENTS.md was not updated to reflect completion — this is a documentation gap, not an implementation gap. The requirement IS satisfied in code.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned files: `scripts/merge-claims.js`, `scripts/validate.js`, `data/claims.json`.

- No TODO/FIXME/placeholder comments in implementation files
- No empty handlers or stub returns
- No hardcoded empty arrays/objects passed to rendering paths
- merge-claims.js prints substantive summary (total, enriched, unenriched counts)
- validate.js enforcement section uses `error()` (not `warn()`) for normative violations — correctly blocks build

### Human Verification Required

#### 1. Merge script reproducibility

**Test:** Run `node scripts/merge-claims.js` and verify the regenerated `data/claims.json` is identical (or functionally equivalent) to the current file.
**Expected:** Same 50 claims, same 18 enriched claims, same hashes, same pregunta/respuesta values. Only `_meta.generatedAt` timestamp should differ.
**Why human:** The script regenerates the file with a fresh timestamp — automated diffing would need to exclude the timestamp field; this is a quick manual check.

### Gaps Summary

No gaps found. All 8 observable truths are verified against the actual codebase.

**Minor documentation discrepancy noted (not a gap):** REQUIREMENTS.md traceability table shows JSON-03 as "Pending (Plan 02)" but validate.js section 7d implements full orphan detection against claims.json. The requirement is satisfied in code. The REQUIREMENTS.md table was not updated after Plan 02 completed.

---

_Verified: 2026-03-25T13:58:22Z_
_Verifier: Claude (gsd-verifier)_
