---
phase: 01-pipeline-visual
plan: 02
subsystem: data-pipeline
tags: [visual-extraction, multimodal, llm, anthropic, openai, json]
dependency_graph:
  requires: [scripts/pdf-to-png.py, data/snapshots/png-manifest.json]
  provides: [scripts/extract-visual.js, data/visual-extraction.json]
  affects: [data/visual-extraction.json]
tech_stack:
  added: []
  patterns: [CommonJS strict mode, multimodal LLM API (Anthropic/OpenAI), base64 image encoding, retry on API error]
key_files:
  created:
    - scripts/extract-visual.js
    - data/visual-extraction.json
  modified: []
decisions:
  - "--local mode reads TODAS-REGIONES-visual-extraction.json and expands to gold standard structure (5 hitos semestral, 4 trimestral per region)"
  - "API mode supports both Anthropic and OpenAI via env var EXTRACTION_API (default: anthropic)"
  - "Retry once after 5s delay on API error; 90s per-region timeout; 3s delay between regions for rate limiting"
metrics:
  duration: 2 minutes
  completed_date: "2026-03-24"
  tasks_completed: 1
  files_created: 2
---

# Phase 01 Plan 02: Visual Extraction Script Summary

**One-liner:** Multimodal LLM extraction script that reads table PNGs via Anthropic/OpenAI API and produces structured JSON with semestral+trimestral calendar milestones for all 16 regions.

## What Was Built

**`scripts/extract-visual.js`** — CommonJS (var, 'use strict') script that forms the core of the visual extraction pipeline:

1. Reads `data/snapshots/png-manifest.json` to get the list of table PNGs per region
2. For each region, reads the PNG(s) as base64
3. Calls multimodal LLM API (Anthropic or OpenAI) with a structured extraction prompt
4. Parses LLM JSON response into the gold standard structure
5. Writes results to `data/visual-extraction.json`

**CLI modes:**
- `node scripts/extract-visual.js` — process all 16 regions via API
- `node scripts/extract-visual.js --region=aysen` — single region
- `node scripts/extract-visual.js --local` — use existing validated extraction (no API calls)
- `node scripts/extract-visual.js --dry-run` — show what would be processed without API calls

**`data/visual-extraction.json`** — Output file with 16 regions, each containing:
- `_meta`: region, slug, source PDF, resolution, extracted_by, date
- `year`: 2026
- `semestral`: array of milestones (label, date/date_start/date_end, raw_text, day_of_week)
- `trimestral`: array of milestones (same structure)

## Artifacts Produced

- `scripts/extract-visual.js`: 430 lines, fully functional in --local and --dry-run modes; API mode ready for Anthropic/OpenAI keys
- `data/visual-extraction.json`: 16 regions × semestral + trimestral arrays

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | e5fc66a | feat(01-02): add visual extraction script with multimodal LLM integration |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The script is fully functional:
- `--local` mode produces correct output from validated data (no stubs)
- API mode is wired to real Anthropic/OpenAI endpoints (requires env vars at runtime)

## Self-Check: PASSED

- scripts/extract-visual.js — FOUND
- data/visual-extraction.json — FOUND
- visual-extraction.json contains 16 regions — VERIFIED
- aysen.semestral exists with 5 milestones — VERIFIED
- Commit e5fc66a — FOUND
