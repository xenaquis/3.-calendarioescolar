---
phase: 12-sheet-write
plan: 01
subsystem: sheet-integration
tags: [google-sheets, jwt-auth, data-export, change-detection]
dependency_graph:
  requires: [data/claims.json, data/pages.json, data/calendar-config.json, config.json]
  provides: [scripts/claims-to-sheet.js, config.sheet.datosTab]
  affects: [Google Sheet "Datos" tab]
tech_stack:
  added: [JWT RS256 signing via crypto.createSign, Google Sheets API v4 batchUpdate + values PUT]
  patterns: [var/require CommonJS, callback-style async, native https, IIFE-style]
key_files:
  created: [scripts/claims-to-sheet.js]
  modified: [config.json]
decisions:
  - "require('url').parse used for tokenUri parsing — stdlib native, no npm dep"
  - "REGION rows use JSON.stringify of full region object — all 19 fields auditable in one cell"
  - "CONFIG section has 7 rows: 5 scalar keys + feriados array + feriadosCompletos array"
  - "addOrClearSheet checks statusCode=400 + INVALID_ARGUMENT — handles both tab-exists error variants"
metrics:
  duration: "5 min"
  completed: "2026-03-25"
  tasks_completed: 1
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 12 Plan 01: Sheet Write Script Summary

## One-liner

Native Node.js script (JWT RS256 + Google Sheets API v4) that writes claims.json + pages.json + calendar-config.json to a "Datos" tab with SHA256 hash_respuesta for change detection.

## What Was Built

`scripts/claims-to-sheet.js` (557 lines) — a zero-dependency Node.js script that:

1. Reads `data/claims.json` (50 claims), `data/pages.json` (16 regions), `data/calendar-config.json`
2. Builds a 74-row matrix (1 header + 73 data rows) with 12 columns (A-L)
3. Authenticates via Google Service Account JWT (RS256, native `crypto.createSign`)
4. Creates or clears the "Datos" tab via `batchUpdate`, then writes all rows via `values PUT`
5. Supports `--dry-run` mode (no credentials needed, prints full data summary)

Column layout (A-L): `seccion | id | pregunta | respuesta | fuente_url | fuente_referencia | extracto_verbatim | hash_respuesta | hash_verbatim | last_checked | status | campo`

Data sections:
- **CLAIMS** (50 rows): One row per claim from claims.json
- **REGION** (16 rows): One row per region (JSON.stringify of full region object)
- **CONFIG** (7 rows): year, schoolStart, winterStart, winterEnd, schoolEnd, feriados, feriadosCompletos

`hash_respuesta` = SHA256 of the `respuesta` column — enables SHEET-04 change detection when a human edits a cell.

## Task Status

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Create claims-to-sheet.js with JWT auth, data transformation, and --dry-run | DONE | 439319f |
| 2 | Verify Sheet write with real credentials | PENDING (checkpoint:human-verify) | — |

## Dry-Run Output Verified

```
CLAIMS: 50 filas
REGION: 16 filas
CONFIG: 7 filas
TOTAL:  73 filas de datos + 1 fila de headers = 74 filas totales
```

Exit code: 0. All acceptance criteria passed.

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Added require('url') for tokenUri parsing**
- **Found during:** Task 1 implementation
- **Issue:** tokenUri from service account JSON needs `hostname` and `path` extracted for https.request
- **Fix:** Used native `require('url').parse()` — stdlib module, not npm dependency, consistent with zero-dependency constraint
- **Files modified:** scripts/claims-to-sheet.js

Otherwise — plan executed as written.

## Known Stubs

None — the script is complete. The --dry-run path is fully functional without credentials. The live write path requires `GOOGLE_SERVICE_ACCOUNT_KEY` env var which will be tested in Task 2 (checkpoint).

## Self-Check: PASSED

- scripts/claims-to-sheet.js: FOUND (557 lines)
- config.json datosTab entry: FOUND (grep -c "datosTab" = 1)
- commit 439319f: FOUND
- dry-run exit code 0: VERIFIED
