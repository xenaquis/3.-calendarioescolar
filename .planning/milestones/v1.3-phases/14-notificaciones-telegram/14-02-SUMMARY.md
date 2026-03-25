---
phase: 14-notificaciones-telegram
plan: 02
subsystem: scripts
tags: [telegram, notifications, bcn, change-detection, github-actions, python]
dependency_graph:
  requires: [scripts/notify-telegram.js, scripts/check-bcn-changes.py, .github/workflows/check-bcn-changes.yml]
  provides: [scripts/check-bcn-changes.py (v2.0.0), .github/workflows/check-bcn-changes.yml (Telegram secrets)]
  affects: [.github/workflows/check-bcn-changes.yml]
tech_stack:
  added: [subprocess (Python stdlib)]
  patterns: [subprocess-stdin-json, dry-run-passthrough]
key_files:
  created: []
  modified:
    - scripts/check-bcn-changes.py
    - .github/workflows/check-bcn-changes.yml
decisions:
  - "subprocess.run with input=json.dumps(payload) is the bridge between Python pipeline and Node.js notify-telegram.js"
  - "--dry-run flag in check-bcn-changes.py propagated to notify-telegram.js for end-to-end message preview without credentials"
metrics:
  duration: "5 min"
  completed_date: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
---

# Phase 14 Plan 02: BCN Pipeline Telegram Integration Summary

## One-liner

Replaced GitHub Issue creation in check-bcn-changes.py with subprocess call to notify-telegram.js via JSON stdin; workflow YAML now passes TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets instead of GH_TOKEN.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Replace GitHub Issue creation with send_telegram_notification() via subprocess | 8d545ed | scripts/check-bcn-changes.py |
| 2 | Update workflow: Telegram secrets + Node.js setup step, remove issues:write | fe609a4 | .github/workflows/check-bcn-changes.yml |

## What Was Built

**Task 1 — check-bcn-changes.py v2.0.0:**

- Removed `create_github_issue()` function (55 lines) and `build_issue_body()` function (50 lines)
- Added `send_telegram_notification(changes, evaluations, claims_by_key, total_claims, dry_run=False)` that:
  1. Builds the stdin JSON payload matching the notify-telegram.js contract
  2. Calls `node scripts/notify-telegram.js` (or `--dry-run`) via `subprocess.run`
  3. Pipes JSON as text input, captures stdout/stderr
  4. Raises `RuntimeError` if exit code is non-zero (logged but non-fatal — last_checked still updates)
- Updated `--dry-run` block: now calls `send_telegram_notification(..., dry_run=True)` to preview message format
- Updated docstring and `--dry-run` help text to reference Telegram instead of GitHub
- Bumped `SCRIPT_VERSION` from `'1.0.0'` to `'2.0.0'`

**Task 2 — check-bcn-changes.yml:**

- Replaced `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- Removed `issues: write` permission (no longer creating GitHub Issues)
- Added `Setup Node.js` step using `actions/setup-node@v4` with `node-version: '20'`
- Comment header updated from "crea GitHub Issue consolidado" to "envia notificacion Telegram"
- Preserved `contents: write`, `DEEPSEEK_API_KEY`, and all other workflow structure

## End-to-End Pipeline

```
check-bcn-changes.py
  -> fetch BCN hashes -> compare -> detect changes
  -> DeepSeek evaluate_impact (if not --dry-run)
  -> send_telegram_notification()
       -> subprocess.run(['node', 'notify-telegram.js'])
            stdin: JSON {changes, total_claims_checked, detection_date}
       -> notify-telegram.js formats HTML message
       -> POST to api.telegram.org/botTOKEN/sendMessage
  -> update legal-articles.json last_checked
```

## Verification

All acceptance criteria verified:

```
grep "create_github_issue|build_issue_body|GitHub Issue" check-bcn-changes.py -> 0 matches
grep "GH_TOKEN|GITHUB_REPOSITORY" check-bcn-changes.py -> 0 matches
grep "import subprocess" check-bcn-changes.py -> 1 match
grep "send_telegram_notification" check-bcn-changes.py -> 3 matches
grep "notify-telegram.js" check-bcn-changes.py -> 8 matches
grep "subprocess.run" check-bcn-changes.py -> 1 match
grep "SCRIPT_VERSION = '2.0.0'" check-bcn-changes.py -> 1 match
grep "GH_TOKEN" check-bcn-changes.yml -> 0 matches
grep "issues: write|issues:write" check-bcn-changes.yml -> 0 matches
grep "TELEGRAM_BOT_TOKEN" check-bcn-changes.yml -> 1 match
grep "TELEGRAM_CHAT_ID" check-bcn-changes.yml -> 1 match
grep "actions/setup-node" check-bcn-changes.yml -> 1 match
python scripts/check-bcn-changes.py --help -> OK (shows Telegram in --dry-run help)
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The Telegram notification pipeline is fully wired. Production requires:
- `TELEGRAM_BOT_TOKEN` secret added to GitHub Actions
- `TELEGRAM_CHAT_ID` secret added to GitHub Actions

## Self-Check: PASSED

- scripts/check-bcn-changes.py: FOUND (modified, 8d545ed)
- .github/workflows/check-bcn-changes.yml: FOUND (modified, fe609a4)
- grep "create_github_issue" check-bcn-changes.py: 0 matches (CLEAN)
- grep "GH_TOKEN" workflow: 0 matches (CLEAN)
- grep "TELEGRAM_BOT_TOKEN" workflow: FOUND
- grep "setup-node" workflow: FOUND
- python --help: exit 0 (VERIFIED)
