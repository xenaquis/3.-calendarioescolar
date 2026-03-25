---
phase: 13-sync-sheet-pagina
verified: 2026-03-25T16:55:05Z
status: human_needed
score: 7/8 must-haves verified
human_verification:
  - test: "Verify tooltip rendering in browser"
    expected: "Hovering over a feriado row in the index.html feriados table shows a tooltip with BCN law text (e.g. 'Art. 1 — Viernes Santo, Ley 2.977 — Feriados legales de Chile: ...'). All 7 feriado rows should display populated tooltips."
    why_human: "claims-tooltips.js populates .bcn-tooltip spans at DOMContentLoaded via window.CLAIMS_DATA. The data and wiring are verified programmatically, but the actual rendering requires a browser to confirm the IIFE executes and text appears on hover."
  - test: "Verify live Sheet sync end-to-end (SYNC-04 live pipeline)"
    expected: "With GOOGLE_API_KEY set, run 'node scripts/sync-from-sheet.js --dry-run'. Output should print 'Leidos 50 claims + 16 regiones + config (year: 2026, feriados: 7)'. Then run without --dry-run and confirm claims.json, pages.json, calendar-config.json are updated (or report 'sin cambios' if data is current). Finally confirm 'npm run generate && npm run build' still exits 0 with updated data."
    why_human: "The sync script requires a live GOOGLE_API_KEY to connect to the Sheets API. Cannot be tested in a sandboxed verification environment."
---

# Phase 13: Sync Sheet to Pagina — Verification Report

**Phase Goal:** El Google Sheet es la unica fuente de verdad — toda edicion humana en el Sheet se propaga automaticamente a las paginas publicadas

**Verified:** 2026-03-25T16:55:05Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | sync-from-sheet.js reads exclusively from the Datos tab, not Regiones or Config tabs | VERIFIED | `DATOS_TAB = config.sheet.datosTab`, REGIONS_TAB/CONFIG_TAB count = 0, single `fetchSheet(DATOS_TAB, ...)` call |
| 2 | sync-from-sheet.js produces claims.json, pages.json, and calendar-config.json from Datos tab data | VERIFIED | `writeIfChanged(data/claims.json)`, `writeIfChanged(data/pages.json)`, `writeIfChanged(data/calendar-config.json)` all present in main() |
| 3 | GitHub Action runs on daily cron and commits claims.json alongside pages.json and calendar-config.json | VERIFIED | `cron: '0 6 * * *'` at line 9; `git add data/pages.json data/calendar-config.json data/claims.json` at line 76 |
| 4 | generate-pages.js produces public/js/claims-data.js from data/claims.json | VERIFIED | File exists; `npm run generate` exits 0 and logs "Generado public/js/claims-data.js (50 claims)" |
| 5 | generate-verificacion.js reads from claims.json instead of afirmaciones.json | VERIFIED | `claimsPath = path.join(ROOT, 'data', 'claims.json')` at line 54; fallback to afirmaciones.json preserved |
| 6 | index.html feriados tooltips are populated from claims-data.js, not hardcoded in HTML | VERIFIED | 7 data-claim-id attributes confirmed; all 7 bcn-tooltip spans are empty in source HTML; script tags for claims-data.js and claims-tooltips.js present at lines 552-553 |
| 7 | No hardcoded tooltip text in bcn-tooltip spans | VERIFIED | `grep 'bcn-tooltip.*role.*tooltip">[^<]'` returns 0 matches |
| 8 | The full chain Sheet edit -> sync -> generate -> validate -> deploy works end-to-end | NEEDS HUMAN | Scripts exist and work locally (npm run build passes); live Sheet connection requires GOOGLE_API_KEY |

**Score:** 7/8 truths verified (1 deferred as human checkpoint per user instruction)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/sync-from-sheet.js` | Sheet sync reading from Datos tab, producing 3 JSON files | VERIFIED | 364 lines; parseDatosTab(), buildClaimsOutput(), --dry-run flag; no syntax errors |
| `.github/workflows/sync-deploy.yml` | Daily cron sync + deploy pipeline | VERIFIED | 104 lines; daily cron `0 6 * * *`; claims.json in git add |
| `scripts/generate-pages.js` | Claims data JS file generation from claims.json | VERIFIED | Generates claims-data.js (50 claims) and claims-tooltips.js; exits 0 |
| `scripts/generate-verificacion.js` | Verification JSON generation from claims.json | VERIFIED | Reads claims.json primary, afirmaciones.json fallback |
| `public/index.html` | Dynamic tooltip rendering via data-claim-id attributes | VERIFIED | 7 data-claim-id attributes on bcn-badge-wrap; 7 empty bcn-tooltip spans; script tags for claims-data.js and claims-tooltips.js |
| `public/js/claims-data.js` | Generated JS with window.CLAIMS_DATA | VERIFIED | Exists; contains window.CLAIMS_DATA with 50 claims including all 7 feriado claims with source_reference and extracto_verbatim |
| `public/js/claims-tooltips.js` | IIFE that populates tooltips at runtime | VERIFIED | Exists; DOMContentLoaded IIFE; queries [data-claim-id]; populates .bcn-tooltip text |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/sync-from-sheet.js` | `config.json` | sheet.datosTab config key | WIRED | `DATOS_TAB = (config.sheet && config.sheet.datosTab)` — config.json has `"datosTab": "Datos"` |
| `scripts/sync-from-sheet.js` | `data/claims.json` | writeIfChanged for claims output | WIRED | `writeIfChanged(path.join(ROOT, 'data', 'claims.json'), claimsOutput)` at line 346 |
| `.github/workflows/sync-deploy.yml` | `scripts/sync-from-sheet.js` | sync step invocation | WIRED | `run: node scripts/sync-from-sheet.js` at line 43 |
| `scripts/generate-pages.js` | `data/claims.json` | reads claims for JS generation | WIRED | `CLAIMS_FILE = path.join(..., 'data', 'claims.json')` at line 261; `fs.readFileSync(CLAIMS_FILE)` |
| `scripts/generate-pages.js` | `public/js/claims-data.js` | writes CLAIMS_DATA global | WIRED | `fs.writeFileSync(claimsDataJsPath, claimsDataJs)` at line 296 |
| `public/index.html` | `public/js/claims-data.js` | script tag loads claims data | WIRED | `<script defer src="/js/claims-data.js"></script>` at line 552 |
| `public/js/claims-tooltips.js` | `public/index.html` [data-claim-id] | IIFE queries DOM and populates tooltips | WIRED | `document.querySelectorAll('[data-claim-id]')` — 7 matching elements in index.html |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `public/js/claims-data.js` | window.CLAIMS_DATA | `data/claims.json` (50 claims, 6 sources) | Yes — 50 claims including all 7 feriado BCN claims with source_reference, extracto_verbatim, fuente_url | FLOWING |
| `public/index.html` tooltip spans | .bcn-tooltip textContent | claims-tooltips.js reads window.CLAIMS_DATA[claimId].source_reference + extracto_verbatim | Yes — feriado-viernes-santo has source_reference="Art. 1 — Viernes Santo" and extracto_verbatim populated | FLOWING (runtime population — human needed to confirm render) |
| `public/data/verificacion.json` | claims array | `data/claims.json` via generate-verificacion.js | Yes — "50 claims, 4 secciones, 45 verificados" logged on generate run | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| sync-from-sheet.js has no syntax errors | `node -c scripts/sync-from-sheet.js` | No output (success) | PASS |
| REGIONS_TAB/CONFIG_TAB references removed | `grep -c "REGIONS_TAB\|CONFIG_TAB" scripts/sync-from-sheet.js` | 0 | PASS |
| datosTab key in config.json | `grep "datosTab" config.json` | `"datosTab": "Datos"` at line 36 | PASS |
| generate-pages.js exits 0 and produces claims files | `node scripts/generate-pages.js` | Exits 0; "Generado public/js/claims-data.js (50 claims)" | PASS |
| npm run build exits 0 | `npm run build` | Exits 0 — "Build completo" (2 warnings for non-phase files; no errors) | PASS |
| All 7 data-claim-id attributes present | `grep -c "data-claim-id" public/index.html` | 7 matches | PASS |
| No hardcoded bcn-tooltip content | `grep 'bcn-tooltip.*role.*tooltip">[^<]' public/index.html` | 0 matches | PASS |
| Daily cron in workflow | `grep "0 6 \* \* \*" .github/workflows/sync-deploy.yml` | Match at line 9 | PASS |
| Weekly cron removed | `grep "0 6 \* \* 1" .github/workflows/sync-deploy.yml` | No match | PASS |
| claims.json in git add step | `grep "claims.json" .github/workflows/sync-deploy.yml` | Match at line 76 | PASS |
| Live Sheet sync (--dry-run) | `node scripts/sync-from-sheet.js --dry-run` | SKIPPED — requires GOOGLE_API_KEY | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SYNC-01 | 13-01 | sync-from-sheet.js reads Datos tab, generates claims.json + pages.json + calendar-config.json | SATISFIED | Rewritten script reads single DATOS_TAB, parseDatosTab() routes CLAIMS/REGION/CONFIG rows, all 3 writeIfChanged() calls present |
| SYNC-02 | 13-02 | generate-pages.js uses claims.json data to inject tooltips and factual content | SATISFIED | generate-pages.js reads data/claims.json, produces public/js/claims-data.js (50 claims), claims-tooltips.js populated at runtime |
| SYNC-03 | 13-01 | GitHub Action with daily cron runs sync → generate → validate → deploy | SATISFIED | `cron: '0 6 * * *'` (daily), pipeline: sync → generate → validate → build → commit → deploy |
| SYNC-04 | 13-02 | Full flow works: no data hardcoded in HTML | SATISFIED (programmatic) / NEEDS HUMAN (live) | All bcn-tooltip spans empty; data-claim-id attributes wired; generate + build pass. Live Sheet connection deferred per user instruction. |

All 4 SYNC requirements are satisfied programmatically. SYNC-04 live pipeline verification deferred as human checkpoint.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No stubs, placeholders, hardcoded empty data, or TODO comments found in the modified files. The bcn-tooltip spans are intentionally empty — they are populated at runtime by claims-tooltips.js from CLAIMS_DATA, which is confirmed non-empty.

### Human Verification Required

#### 1. Tooltip Rendering in Browser

**Test:** Open `public/index.html` in a browser (via `npm run dev` or directly). Navigate to the "Feriados 2026" section. Hover over (or focus with keyboard) each of the 7 feriado rows that have the green checkmark badge (Viernes Santo, Dia del Trabajo, Glorias Navales, Corpus Christi, San Pedro y San Pablo, Encuentro de Dos Mundos, Inmaculada Concepcion).

**Expected:** Each badge shows a tooltip popup with BCN legal text, e.g. "Art. 1 — Viernes Santo, Ley 2.977 — Feriados legales de Chile: «ARTICULO PRIMERO.- ... Los Viernes i Sabados de la Semana Santa...»". The tooltip text should not be empty. All 7 tooltips should display content.

**Why human:** The tooltip population is done by claims-tooltips.js at DOMContentLoaded via `window.CLAIMS_DATA`. The IIFE, the data, and the DOM attributes are all verified programmatically to be correctly wired. However, confirming the text actually appears visibly on hover/focus requires a browser rendering environment.

#### 2. Live Sheet Sync End-to-End (SYNC-04)

**Test:** With `GOOGLE_API_KEY` set in environment, run:
1. `node scripts/sync-from-sheet.js --dry-run`
2. If output shows 50 claims + 16 regiones + config, run: `node scripts/sync-from-sheet.js`
3. Then run: `npm run generate && npm run build`

**Expected:** Step 1 prints "Leidos 50 claims + 16 regiones + config (year: 2026, feriados: 7)". Step 2 either updates the JSON files or reports "sin cambios". Step 3 exits 0 with no errors.

**Why human:** The sync script requires a live Google Sheets API connection with a valid GOOGLE_API_KEY. This cannot be tested in a sandboxed environment without the secret. The script itself is syntactically correct and logically complete — auth is the only gate.

### Gaps Summary

No gaps blocking goal achievement. All automated checks pass. Phase 13's primary deliverables — unified Datos tab sync, dynamic tooltip generation, and daily GitHub Action — are fully implemented and wired. The two human verification items are deferred checkpoints (browser rendering + live API auth), not implementation gaps.

---

_Verified: 2026-03-25T16:55:05Z_
_Verifier: Claude (gsd-verifier)_
