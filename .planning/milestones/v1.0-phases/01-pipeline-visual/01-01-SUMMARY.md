---
phase: 01-pipeline-visual
plan: 01
subsystem: data-pipeline
tags: [pdf, png, pymupdf, snapshots, pipeline]
dependency_graph:
  requires: []
  provides: [scripts/pdf-to-png.py, scripts/organize-snapshots.js, data/snapshots/png-manifest.json]
  affects: [data/snapshots/]
tech_stack:
  added: [PyMuPDF (fitz)]
  patterns: [CommonJS strict mode, argparse CLI, JSON manifest output]
key_files:
  created:
    - scripts/pdf-to-png.py
    - scripts/organize-snapshots.js
    - data/snapshots/png-manifest.json
    - data/snapshots/*-tabla-p*.png (25 files)
  modified: []
decisions:
  - pdf-dir defaults to data/extraction-tests (where PDFs actually live, not data/snapshots as plan stated)
  - organize-snapshots.js detects worktree context and falls back to parent project for extraction-tests
  - raw all-pages PNGs from pdf-to-png.py not committed (only canonical tabla PNGs persisted)
metrics:
  duration: 3 minutes
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_created: 28
---

# Phase 01 Plan 01: PDF-to-PNG Pipeline Setup Summary

**One-liner:** PyMuPDF-based PDF-to-PNG pipeline with canonical tabla naming and png-manifest.json for all 16 regions.

## What Was Built

Two scripts that together form the first stage of the visual extraction pipeline:

1. **`scripts/pdf-to-png.py`** — Converts any Mineduc regional PDF to PNGs at 300 DPI using PyMuPDF (fitz). Accepts `--region=SLUG` or `--all`, configurable `--dpi` and `--output-dir`. Outputs a JSON manifest to stdout. Exit code 0 if at least one region processed.

2. **`scripts/organize-snapshots.js`** — Reads `TODAS-REGIONES-visual-extraction.json` to identify which pages per region contain the table data, then copies those PNGs from `data/extraction-tests/` to `data/snapshots/` with canonical naming `{regionSlug}-tabla-p{N}.png`. Generates `data/snapshots/png-manifest.json`.

## Artifacts Produced

- 25 canonical table PNGs in `data/snapshots/` across 16 regions
- `data/snapshots/png-manifest.json` documenting table pages, source page numbers, and grupo per region

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | e276dbf | feat(01-01): add PDF-to-PNG conversion script using PyMuPDF |
| Task 2 | eef9add | feat(01-01): organize table PNGs with canonical naming + png-manifest.json |
| Cleanup | fb5fa64 | chore(01-01): update png-manifest.json timestamp after verification run |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PDF location differs from plan description**
- **Found during:** Task 1 implementation
- **Issue:** Plan stated PDFs are in `data/snapshots/` but all 16 regional PDFs are in `data/extraction-tests/` (the main project data dir)
- **Fix:** Script defaults `--pdf-dir` to `data/extraction-tests` and has a fallback to `data/snapshots`. Also handles worktree path resolution (goes up 3 levels to find parent project when run from worktree)
- **Files modified:** scripts/pdf-to-png.py (--pdf-dir arg), scripts/organize-snapshots.js (resolveSourceDir function)
- **Commit:** e276dbf, eef9add

**2. [Rule 2 - Context] organize-snapshots.js handles worktree path resolution**
- **Found during:** Task 2 testing
- **Issue:** This repo uses git worktrees. The `data/extraction-tests/` with PNGs is untracked in the main project but not present in the worktree checkout.
- **Fix:** Added `resolveSourceDir()` function that checks standard path, then climbs 3 directories to find the parent project's extraction-tests. Prints INFO message when using parent project path.
- **Files modified:** scripts/organize-snapshots.js
- **Commit:** eef9add

### Plan Count vs Reality

The plan's done criteria said "All 62 table PNGs organized". In reality, `TODAS-REGIONES-visual-extraction.json` lists 25 table-relevant images across the 16 regions (1-4 per region). The 62 PNGs in extraction-tests include many non-table pages from the original extraction session. The 25 organized are the correct table-specific ones.

## Known Stubs

None. Both scripts are fully functional and produce correct output.

## Self-Check: PASSED

- scripts/pdf-to-png.py — FOUND
- scripts/organize-snapshots.js — FOUND
- data/snapshots/png-manifest.json — FOUND
- data/snapshots/aysen-tabla-p1.png — FOUND
- Commit e276dbf — FOUND
- Commit eef9add — FOUND
