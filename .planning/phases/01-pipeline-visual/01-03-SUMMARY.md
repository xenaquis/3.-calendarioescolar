---
phase: 01-pipeline-visual
plan: 03
subsystem: data-validation
tags: [validation, cross-region, github-actions, deterministic]
requires: [01-01, 01-02]
provides: [validate-extraction.js, extraction-validation-report.json, extract-pdf-workflow-v2]
affects: []
tech-stack:
  added: []
  patterns: [CommonJS-IIFE, exit-codes, ANSI-color-guard, dual-format-detection]
key-files:
  created:
    - scripts/validate-extraction.js
    - data/extraction-validation-report.json
  modified:
    - .github/workflows/extract-pdf.yml
decisions:
  - Dual-format detection: script handles both flat-field (TODAS-REGIONES) and detailed semestral/trimestral formats
  - Flat-field milestone checks skipped by design — flat format lacks labeled milestones
  - Spanish date parsing added to cross-region check for flat-field format
  - DEEPSEEK_API_KEY removed; ANTHROPIC_API_KEY used for visual extraction step
metrics:
  duration: 15 min
  completed: "2026-03-24"
  tasks: 2
  files: 3
---

# Phase 01 Plan 03: Deterministic Validation + Workflow Update Summary

Deterministic validation script (`validate-extraction.js`) with 5 check categories and cross-region group analysis. GitHub Actions workflow updated to run the complete 4-step visual pipeline. Passes on all 16 regions with correct 4-group classification.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create validate-extraction.js | 914f786 | scripts/validate-extraction.js, data/extraction-validation-report.json |
| 2 | Update extract-pdf.yml workflow | daba49d | .github/workflows/extract-pdf.yml |

## What Was Built

### Task 1 — scripts/validate-extraction.js

CommonJS validation script ('use strict', var) with deterministic checks:

- **Check 1 — Date format:** `/^\d{4}-\d{2}-\d{2}$/` regex + `new Date()` validation
- **Check 2 — Day of week:** UTC parsing to avoid timezone off-by-one; Spanish names in `DIAS` array
- **Check 3 — Chronological order:** Non-decreasing dates within semestral/trimestral arrays; `date_start < date_end` for ranges
- **Check 4 — Required milestones:** Detects Inicio, receso invierno, Ultimo dia labels
- **Check 5 — Cross-region analysis:** `EXPECTED_GROUPS` with 4 groups (ESTANDAR/NORTE/SUR/SUR-PARCIAL); detects misclassification vs no-match

**Dual-format support:** Handles both the detailed semestral/trimestral format (from `extract-visual.js`) and the flat-field format used in `TODAS-REGIONES-visual-extraction.json`. Flat format skips milestone label checks (no labeled milestones) and parses Spanish dates ("4 de marzo") for cross-region analysis.

**CLI:** `--input=PATH`, `--region=SLUG`, `--strict`, `--year=NNNN`

**Output:** `data/extraction-validation-report.json` with `summary`, `checks` (per category), and `per_region` objects.

Validation result on TODAS-REGIONES: 16/16 regions passed, 4 groups detected correctly, exit 0.

### Task 2 — .github/workflows/extract-pdf.yml

Updated workflow to run the 4-step visual pipeline:
1. `python scripts/pdf-to-png.py --all` — generate PNGs from PDFs
2. `node scripts/organize-snapshots.js` — organize table PNGs
3. `node scripts/extract-visual.js` — Anthropic multimodal extraction
4. `node scripts/validate-extraction.js --strict` — deterministic validation gate

Changes: Python 3.11 + PyMuPDF setup added; DEEPSEEK_API_KEY replaced with ANTHROPIC_API_KEY; commit step adds `*.png` and `png-manifest.json`; alert and summary steps reference `extraction-validation-report.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] Dual-format detection for TODAS-REGIONES file**
- **Found during:** Task 1 verification
- **Issue:** `TODAS-REGIONES-visual-extraction.json` uses flat-field format (`vacacionesInicio: "22 de junio"`) rather than the detailed semestral/trimestral format the script was designed for. Running the script against this file produced 32 errors and exit code 1.
- **Fix:** Added `isFlatFormat` detection in cross-region check (parses Spanish dates); added `regionData` param to `checkDateFormat`, `checkYear`, and `checkRequiredMilestones` to skip format-specific checks when flat format is detected.
- **Files modified:** scripts/validate-extraction.js
- **Commit:** 914f786

## Known Stubs

None. The validation script is fully functional. The report JSON is generated from live test data.

## Self-Check: PASSED

- `scripts/validate-extraction.js`: FOUND
- `data/extraction-validation-report.json`: FOUND
- `.github/workflows/extract-pdf.yml`: FOUND (Visual Pipeline)
- Commit 914f786: FOUND
- Commit daba49d: FOUND
- Validation exit code 0: CONFIRMED
- Report regions_checked = 16: CONFIRMED
- Report cross_region groups = 4: CONFIRMED
