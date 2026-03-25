---
phase: 13-sync-sheet-pagina
plan: "01"
subsystem: sync-pipeline
tags: [sync, google-sheets, datos-tab, claims, github-actions]
dependency_graph:
  requires: [phase-12-claims-to-sheet]
  provides: [datos-tab-sync, claims-json-sync, daily-cron]
  affects: [data/claims.json, data/pages.json, data/calendar-config.json]
tech_stack:
  added: []
  patterns: [single-tab-fetch, parseDatosTab-routing, dry-run-flag]
key_files:
  created: []
  modified:
    - scripts/sync-from-sheet.js
    - .github/workflows/sync-deploy.yml
decisions:
  - "Single Datos tab fetch replaces dual Regiones+Config fetch — consistent with Phase 12 write approach"
  - "claims merge preserves existing fields (tags, data_key, etc.) and overwrites only Sheet-editable fields"
  - "extracto_verbatim and hash_sha256 use null-check (not empty-string) for Sheet→claims merge — null means 'not set', empty string means 'was cleared'"
metrics:
  duration: "4 min"
  completed: "2026-03-25"
  tasks: 2
  files: 2
---

# Phase 13 Plan 01: Sync-from-Sheet Datos Tab Rewrite Summary

**One-liner:** sync-from-sheet.js rewritten to read unified Datos tab (CLAIMS/REGION/CONFIG sections) and produce claims.json + pages.json + calendar-config.json; GitHub Action updated to daily cron.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite sync-from-sheet.js to read Datos tab | 2600f0d | scripts/sync-from-sheet.js |
| 2 | Update GitHub Action to daily cron and include claims.json | 77d7273 | .github/workflows/sync-deploy.yml |

## What Was Built

**sync-from-sheet.js (full rewrite):**
- Reads from a single "Datos" tab (`config.json → sheet.datosTab`) instead of two tabs
- Range expanded to `A1:L100` (12 columns, up to 74 rows)
- New `parseDatosTab(rows)` function routes rows by `seccion` column (CLAIMS / REGION / CONFIG)
- CLAIMS: builds claim objects from cols B-K, collected into array
- REGION: JSON.parse of col D (full region object stored as JSON string by claims-to-sheet.js)
- CONFIG: key=col B, value=col D; feriados and feriadosCompletos are JSON.parse'd arrays
- Validation: 16 regions required, non-empty claims, required config fields (year/schoolStart/winterStart/winterEnd/schoolEnd)
- `buildClaimsOutput()`: merges Sheet data into existing claims.json structure, preserving _meta, sources, and all non-Sheet fields (tags, data_key, data_path, source_id, verification fields, etc.)
- `--dry-run` flag: prints parsed summary without writing files
- Produces all 3 output files via `writeIfChanged()`

**sync-deploy.yml (targeted updates):**
- Cron changed from weekly Monday (`0 6 * * 1`) to daily (`0 6 * * *`)
- `git add` in commit step now includes `data/claims.json`
- Commit message updated to reference Datos tab
- Step name and top comment updated for clarity

## Decisions Made

- **Single Datos tab fetch:** Consistent with how claims-to-sheet.js writes — same tab is the source of truth for reading back
- **claims merge via existingMap:** Sheet claims are authoritative for editable fields; existing claims.json is authoritative for structural fields (tags, data paths, verification metadata)
- **null vs empty-string for extracto_verbatim/hash_sha256:** Sheet cells that are empty should not overwrite existing non-null values — only explicit non-null values from Sheet propagate

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Both files are fully functional. sync-from-sheet.js cannot be tested without GOOGLE_API_KEY (auth gate, not a stub).

## Self-Check: PASSED

- FOUND: scripts/sync-from-sheet.js
- FOUND: .github/workflows/sync-deploy.yml
- FOUND: commit 2600f0d (feat sync-from-sheet rewrite)
- FOUND: commit 77d7273 (chore workflow update)
