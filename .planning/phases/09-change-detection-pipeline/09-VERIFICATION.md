---
phase: 09-change-detection-pipeline
verified: 2026-03-25T05:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 9: Change Detection Pipeline Verification Report

**Phase Goal:** El sistema monitorea automaticamente cambios en la legislacion de feriados y alerta al equipo cuando una afirmacion necesita revision
**Verified:** 2026-03-25T05:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | Script detects when BCN article text hash differs from stored hash in legal-articles.json | VERIFIED | Lines 316-326: `new_hash = bcn.compute_hash(new_texto)` compared against `stored_hash`; mismatch appends to `changes` list |
| 2  | When change detected, DeepSeek evaluates impact and returns one of sin_impacto\|requiere_revision\|actualizar | VERIFIED | `evaluate_impact()` (lines 39-86) calls `client.chat.completions.create(model='deepseek-chat', max_tokens=16)` and normalizes response to one of three exact states |
| 3  | When change detected, a consolidated GitHub Issue is created with diff, evaluation, claims, recommendation | VERIFIED | `create_github_issue()` (lines 89-145) POSTs to `api.github.com/repos/{}/issues`; `build_issue_body()` (lines 148-198) builds 4-component markdown: diff, AI eval, claims, recommendation |
| 4  | last_checked is updated in legal-articles.json after every successful BCN fetch, even if no change | VERIFIED | Lines 396-414: unconditional loop updates all entries then writes JSON — only skipped if `bcn_error` is True (line 331) |
| 5  | When BCN is unavailable, script exits silently (exit 0) without updating last_checked or creating Issues | VERIFIED | `bcn_error` flag (lines 266-298) set on RuntimeError from `fetch_norma_json`, breaks loop; lines 331-336 print warning and call `sys.exit(0)` without touching last_checked or creating Issue |
| 6  | GitHub Action runs weekly on Monday 06:00 UTC and has manual workflow_dispatch trigger | VERIFIED | `.github/workflows/check-bcn-changes.yml` line 11: `cron: '0 6 * * 1'`; line 12: `workflow_dispatch:` |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/check-bcn-changes.py` | Change detection pipeline script, min 120 lines | VERIFIED | 425 lines; shebang `#!/usr/bin/env python3`; all required functions implemented |
| `.github/workflows/check-bcn-changes.yml` | Cron + manual GitHub Action with `cron: '0 6 * * 1'` | VERIFIED | 50 lines; cron present at line 11; workflow_dispatch at line 12 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/check-bcn-changes.py` | `scripts/bcn-extractor.py` | `importlib.import_module('bcn-extractor')` | WIRED | Line 33: `bcn = importlib.import_module('bcn-extractor')`; bcn-extractor.py confirmed present with all required interface functions |
| `scripts/check-bcn-changes.py` | `data/legal-articles.json` | json.load for stored hashes + json.dump for last_checked update | WIRED | Lines 234-236: `json.load`; line 413-414: `json.dump`; all 15 entries have `last_checked` updated to `2026-03-25T04:41:28Z` |
| `scripts/check-bcn-changes.py` | `https://api.github.com/repos/{owner}/{repo}/issues` | urllib.request.urlopen POST with Bearer GH_TOKEN | WIRED | Line 120: URL construction; lines 127-140: `urllib.request.Request` POST with all required headers including `Bearer {gh_token}` and `X-GitHub-Api-Version: 2022-11-28` |
| `.github/workflows/check-bcn-changes.yml` | `scripts/check-bcn-changes.py` | `python scripts/check-bcn-changes.py` step | WIRED | Line 40: `run: python scripts/check-bcn-changes.py` |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces a standalone Python pipeline script and a GitHub Actions workflow. There is no frontend rendering of dynamic data. Data flows to external systems (BCN API, DeepSeek API, GitHub Issues API) rather than to a rendered UI component.

The data persistence link (`last_checked` updated in `data/legal-articles.json`) was verified by the dry-run: all 15 entries show `"last_checked": "2026-03-25T04:41:28Z"` and `_meta.last_checked_at` is set to the same timestamp.

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| `--dry-run` fetches BCN, compares hashes, updates last_checked | `_meta.last_checked_at: 2026-03-25T04:41:28Z` in legal-articles.json; all 15 entries have matching `last_checked` timestamp; SUMMARY confirms "0 changes detected in live BCN as of 2026-03-25T04:37:32Z" | PASS |
| BCN error triggers silent exit without updating last_checked | Lines 331-336: `if bcn_error: ... sys.exit(0)` before the last_checked update block at line 396 | PASS |
| Issue creation uses correct GitHub API endpoint and auth | Line 120: `https://api.github.com/repos/{}/issues`; lines 131-136: correct headers including `Authorization: Bearer`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28` | PASS |
| Workflow uses auto-token for Issue creation without extra PAT | Line 39: `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`; line 20: `issues: write` permission declared | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CHNG-01 | 09-01-PLAN.md | Script compara hash actual BCN vs hash guardado en legal-articles.json | SATISFIED | Lines 283-326: `fetch_norma_json` -> `compute_hash` -> compare with `stored_hash` |
| CHNG-02 | 09-01-PLAN.md | Si detecta cambio, llama DeepSeek para evaluar (sin_impacto\|requiere_revision\|actualizar) | SATISFIED | `evaluate_impact()` lines 39-86 with `deepseek-chat` model |
| CHNG-03 | 09-01-PLAN.md | Si detecta cambio, crea GitHub Issue con diff, evaluacion IA, claims, recomendacion | SATISFIED | `create_github_issue()` + `build_issue_body()` with 4 required components per change |
| CHNG-04 | 09-01-PLAN.md | last_checked se actualiza en cada corrida independientemente de si hay cambio | SATISFIED | Lines 396-414: unconditional update of all entries and `_meta.last_checked_at` |
| CHNG-05 | 09-01-PLAN.md | GitHub Action ejecuta check-bcn-changes.py en cron semanal con workflow_dispatch | SATISFIED | `.github/workflows/check-bcn-changes.yml` lines 10-12 |

**Orphaned requirements:** None. CHNG-01 through CHNG-05 are the only requirements mapped to Phase 9 in REQUIREMENTS.md and all were claimed in 09-01-PLAN.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, no empty implementations, no hardcoded empty data that flows to output. The `return null` / `return []` patterns do not appear. The only `sys.exit(0)` calls are intentional (BCN error = silent exit, successful completion).

One notable observation: `feriado_dia_trabajo` in legal-articles.json uses `articulo_numero: "1"` (numeric) while other bcn-ley-2977 entries use `"PRIMERO"` (ordinal). This is a potential lookup issue if `bcn.find_article_text` does not handle numeric-to-ordinal mapping — but this is a Phase 8 data quality issue (legal-articles.json was generated by bcn-extractor.py), not a Phase 9 issue. Flagged as INFO for Phase 8 retroactive review.

### Human Verification Required

#### 1. GitHub Issue creation end-to-end

**Test:** In a fork or test branch, modify one `hash_sha256` in `data/legal-articles.json` to a wrong value, set `DEEPSEEK_API_KEY` and confirm `GITHUB_REPOSITORY` is set, then run `python scripts/check-bcn-changes.py` (no --dry-run).
**Expected:** Script detects hash mismatch, calls DeepSeek (may need key), creates a GitHub Issue with diff + evaluation + recommendation sections visible in the repo's Issues tab.
**Why human:** Requires live DEEPSEEK_API_KEY, live GITHUB_TOKEN with `issues:write`, and a real GitHub repository context — cannot be tested with grep/file checks.

#### 2. GitHub Action first run (manual dispatch)

**Test:** In GitHub Actions UI, click "Run workflow" on the "Check BCN Legal Changes" action.
**Expected:** Workflow runs to completion, commits `data/legal-articles.json` with updated `last_checked`, no new Issue created (no changes expected), `[skip ci]` in commit message prevents deploy loop.
**Why human:** Requires actual GitHub Actions execution environment with secrets configured.

### Gaps Summary

No gaps. All 6 must-have truths verified, all artifacts pass Levels 1-3, all 4 key links wired, all 5 requirements satisfied. The phase goal is achieved: the system has automated infrastructure to monitor BCN legal article changes weekly, evaluate impact via DeepSeek, and alert via GitHub Issues when holiday law claims need review.

---

_Verified: 2026-03-25T05:00:00Z_
_Verifier: Claude (gsd-verifier)_
