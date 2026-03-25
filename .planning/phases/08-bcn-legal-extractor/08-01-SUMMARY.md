---
phase: 08-bcn-legal-extractor
plan: 01
subsystem: data-pipeline
tags: [bcn, legal, python, data-extraction, claude-api]
dependency_graph:
  requires: []
  provides: [scripts/bcn-extractor.py, data/legal-articles.json (pending)]
  affects: [data/afirmaciones.json]
tech_stack:
  added: [scripts/bcn-extractor.py (Python 3.12)]
  patterns: [TDD red-green, idempotent data pipeline, lazy import for optional deps]
key_files:
  created:
    - scripts/bcn-extractor.py
    - scripts/test_bcn_extractor.py
  modified:
    - data/afirmaciones.json
    - BLUEPRINT.md
decisions:
  - "import anthropic inside build_claude_client() allows --dry-run without anthropic SDK installed"
  - "source_id None check uses 'or empty string' pattern (not .get default) because JSON null becomes Python None"
  - "IDNORMA_CORRECTIONS dict as defense-in-depth even after fixing afirmaciones.json"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-25"
  tasks_total: 2
  tasks_completed: 1
  tasks_blocked: 1
  files_created: 2
  files_modified: 2
---

# Phase 08 Plan 01: BCN Legal Extractor Summary

**One-liner:** Python BCN extractor using nuevo.leychile.cl JSON API, fetching 4 holiday laws for 15 claims with SHA256 hashing and Claude API identification.

## Status

**Task 1:** COMPLETE — `scripts/bcn-extractor.py` created, `data/afirmaciones.json` fixed
**Task 2:** BLOCKED at checkpoint — requires `ANTHROPIC_API_KEY` to generate `data/legal-articles.json`

## What Was Built

### Task 1: bcn-extractor.py + afirmaciones.json fix

**scripts/bcn-extractor.py** (180+ lines, all required functions):
- `get_idnorma()` — extracts idNorma from afirmaciones.json api_endpoint with correction map
- `fetch_norma_json()` — fetches law JSON from `nuevo.leychile.cl` with User-Agent and timeout
- `extract_articles()` — parses `estructura` array to identify articles, extracts HTML text
- `extract_text()` — strips HTML tags and unescapes entities (regex + html.unescape)
- `compute_hash()` — SHA256 of UTF-8 encoded text
- `get_feriado_claims()` — filters 15 BCN-sourced claims from afirmaciones.json (excludes 2 derived)
- `build_claude_client()` — lazy-imports anthropic SDK inside function (allows --dry-run without SDK)
- `identify_articles()` — one Claude API call per law, batch identification with JSON fallback parsing
- `update_entry()` — idempotent update with texto_anterior preservation on hash change
- `find_article_text()` — locates article text by numero with case-insensitive matching
- `main()` — argparse with --dry-run and --force flags, sequential phases

**data/afirmaciones.json:**
- Fixed `bcn-ley-20148` idNorma from `257742` (HTTP 500) to `257080` (correct) in both `url` and `api_endpoint` fields

**scripts/test_bcn_extractor.py** (6 TDD tests, all passing):
- Tests 1-6 cover: idNorma correction, idNorma extraction, HTML stripping, SHA256 determinism, 15-claim count, 4-law grouping

### Dry-run verification (live BCN API)

```
Found 15 BCN-sourced feriado claims across 4 laws

Processing bcn-ley-19668... 1 articles extracted
Processing bcn-ley-20148... 2 articles extracted
Processing bcn-ley-21357... 2 articles extracted
Processing bcn-ley-2977... 4 articles extracted

--dry-run complete. 4 laws processed.
```

## Checkpoint: Task 2 Blocked — ANTHROPIC_API_KEY Required

Task 2 requires:
1. Run `python scripts/bcn-extractor.py` (full run with Claude API)
2. Verify `data/legal-articles.json` has 15 claims with verbatim text and SHA256 hashes
3. Verify idempotency on second run
4. Update BLUEPRINT.md with OPERATIVO status

**To resume:** Set `ANTHROPIC_API_KEY` and the continuation agent will complete Task 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed None source_id causing AttributeError in get_feriado_claims**
- **Found during:** Task 1 GREEN phase (TDD Tests 5 and 6 failed)
- **Issue:** `claim.get('source_id', '')` returns `None` for derived claims (JSON null), and `None.startswith('bcn-')` raises AttributeError
- **Fix:** Changed to `claim.get('source_id') or ''` which handles None -> empty string correctly
- **Files modified:** scripts/bcn-extractor.py (line ~130)
- **Commit:** 7bc7770

None other — plan executed as written for Task 1.

## Known Stubs

- `data/legal-articles.json` — does not exist yet. Requires ANTHROPIC_API_KEY to generate. This is the primary output of the plan. Task 2 will produce it.

## Self-Check

### Files exist:
- [x] scripts/bcn-extractor.py
- [x] scripts/test_bcn_extractor.py
- [x] data/afirmaciones.json (modified — idNorma=257080 present, 257742 absent)
- [ ] data/legal-articles.json (pending Task 2)

### Commits exist:
- [x] 0304d5d — test(08-01): add failing tests for bcn-extractor helper functions
- [x] 7bc7770 — feat(08-01): create bcn-extractor.py and fix afirmaciones.json idNorma

## Self-Check: PARTIAL

Task 1 fully complete and verified. Task 2 blocked at checkpoint (ANTHROPIC_API_KEY gate).
data/legal-articles.json not yet created — expected, this is the checkpoint deliverable.
