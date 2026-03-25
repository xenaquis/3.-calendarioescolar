---
phase: 09-change-detection-pipeline
plan: 01
subsystem: infra
tags: [python, github-actions, deepseek, sha256, legal-monitoring, bcn]

# Dependency graph
requires:
  - phase: 08-bcn-legal-extractor
    provides: "bcn-extractor.py helper functions (fetch_norma_json, extract_articles, compute_hash, get_idnorma, find_article_text, build_ai_client) and data/legal-articles.json with stored hashes"
provides:
  - "scripts/check-bcn-changes.py: weekly change detection pipeline comparing BCN live hashes vs stored hashes"
  - ".github/workflows/check-bcn-changes.yml: GitHub Action running weekly cron + manual dispatch"
  - "Automated GitHub Issue creation with diff, DeepSeek AI impact evaluation, and recommendation when legal text changes"
affects: [10-ui-verificacion-mapa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "importlib.import_module('bcn-extractor') — handles hyphenated Python module names via importlib"
    - "Group claims by ley_id to avoid redundant BCN fetches (4 fetches for 15 claims, not 15)"
    - "bcn_error flag + break loop on BCN failure — ensures silent exit 0 without partial data"
    - "texto_antes from stored texto_verbatim (not texto_anterior) — Pitfall 6 pattern for first-change diff"
    - "GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} mapping with issues:write permission — no PAT needed"
    - "if: always() on commit step — updates last_checked even when changes are detected"

key-files:
  created:
    - scripts/check-bcn-changes.py
    - .github/workflows/check-bcn-changes.yml
  modified:
    - data/legal-articles.json (last_checked updated by dry-run verification)

key-decisions:
  - "GH_TOKEN mapped from GITHUB_TOKEN auto-token (not a PAT secret) — requires issues:write in permissions block"
  - "Claims grouped by ley_id: 4 BCN fetches for 15 claims, grouped before iteration"
  - "BCN unavailability: break entire loop (not continue per-law) — prevents partial data from creating misleading Issues"
  - "texto_antes in Issue diff uses stored texto_verbatim (current text before overwrite), not texto_anterior (previous run's diff)"
  - "Consolidated single GitHub Issue for all changes — reduces noise, context.md explicitly prefers this"

patterns-established:
  - "evaluate_impact() returns sin_impacto|requiere_revision|actualizar via substring matching on DeepSeek response"
  - "create_github_issue() uses urllib.request POST to api.github.com/repos/{}/issues with Bearer auth and X-GitHub-Api-Version header"
  - "build_issue_body() produces 4-component markdown per change: diff + AI eval + claims + recommendation"

requirements-completed: [CHNG-01, CHNG-02, CHNG-03, CHNG-04, CHNG-05]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 9 Plan 1: Change Detection Pipeline Summary

**Weekly BCN legal change detection via SHA256 hash comparison, DeepSeek impact evaluation, and consolidated GitHub Issue creation — reusing bcn-extractor.py helpers via importlib**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T04:34:59Z
- **Completed:** 2026-03-25T04:37:46Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 updated)

## Accomplishments

- Created `scripts/check-bcn-changes.py` with full change detection pipeline: BCN fetch → hash compare → DeepSeek impact evaluation → GitHub Issue creation
- Created `.github/workflows/check-bcn-changes.yml` with weekly Monday 06:00 UTC cron, workflow_dispatch, and proper permissions (contents:write + issues:write)
- Verified `--dry-run` fetches 4 BCN laws, compares 15 claims, exits 0, and updates `last_checked` in legal-articles.json

## Task Commits

1. **Task 1: check-bcn-changes.py change detection script** - `1d35975` (feat)
2. **Task 2: GitHub Action workflow for weekly BCN change detection** - `43136cf` (feat)

**Plan metadata:** (included in final commit below)

## Files Created/Modified

- `scripts/check-bcn-changes.py` — standalone pipeline script; imports bcn-extractor via importlib, groups 15 claims by 4 laws, evaluates changes with DeepSeek, creates consolidated GitHub Issue
- `.github/workflows/check-bcn-changes.yml` — GitHub Action with cron `0 6 * * 1`, workflow_dispatch, issues:write permission, GH_TOKEN from auto-token
- `data/legal-articles.json` — last_checked timestamps updated by verification dry-run

## Decisions Made

- **GH_TOKEN via auto-token:** Mapped `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` in Action env block with `issues: write` in permissions. No PAT secret needed. The Python script reads `GH_TOKEN` consistently.
- **Claims grouped by ley_id before iteration:** 4 BCN fetches for 15 claims instead of 15 fetches. Group built as dict `entries_by_law` before the main loop.
- **Break on BCN error (not continue):** If any BCN law is unavailable, break the entire loop. This prevents partial data (some laws checked, others not) from creating misleading Issues or partial last_checked updates.
- **texto_antes from texto_verbatim:** The Issue diff "antes" section uses `stored.get('texto_verbatim')` (current stored text before overwrite), not `stored.get('texto_anterior')` (which is null on first change — Pitfall 6 from RESEARCH.md).
- **Consolidated Issue:** All changes in one Issue with `### Claim afectado: data_key` sections. Consistent with CONTEXT.md preference for reduced noise.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The `--dry-run` verified live BCN connectivity and hash comparison in a single pass. All 15 claims matched stored hashes (no changes detected in live BCN as of 2026-03-25T04:37:32Z).

## User Setup Required

Two manual steps before first Action run:

1. **Create GitHub labels** `bcn-change` and `legal-review` in the repo at:
   https://github.com/xenaquis/3.-calendarioescolar/labels
   (Labels not pre-created → Issues are created without labels, silently dropped by GitHub API)

2. **Add `DEEPSEEK_API_KEY` as a repository secret** at:
   https://github.com/xenaquis/3.-calendarioescolar/settings/secrets/actions
   (Already used in Phase 8 — same key)

`GH_TOKEN` does NOT need to be a separate secret — the workflow uses `secrets.GITHUB_TOKEN` (auto-token) mapped as `GH_TOKEN` in the env block, with `issues: write` declared in permissions.

## Next Phase Readiness

- Phase 10 (UI Verificacion + Mapa Interactivo) can proceed. It depends on `data/legal-articles.json` (available with verbatim text + hashes) for the tooltip "Verificado" feature.
- Change detection pipeline is fully operational — ready for weekly scheduled execution.
- No blockers for Phase 10.

---
*Phase: 09-change-detection-pipeline*
*Completed: 2026-03-25*
