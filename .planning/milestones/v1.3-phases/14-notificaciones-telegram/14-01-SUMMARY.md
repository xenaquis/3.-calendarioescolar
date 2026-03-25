---
phase: 14-notificaciones-telegram
plan: 01
subsystem: scripts
tags: [telegram, notifications, bcn, change-detection, cli]
dependency_graph:
  requires: [scripts/check-bcn-changes.py, data/claims.json]
  provides: [scripts/notify-telegram.js]
  affects: [.github/workflows/sync-deploy.yml]
tech_stack:
  added: []
  patterns: [native-https-post, iife-module, stdin-json-input, dry-run-flag]
key_files:
  created: [scripts/notify-telegram.js]
  modified: []
decisions:
  - "EVAL_EMOJI maps sin_impacto to checkmark (not green circle) for better Telegram client compatibility"
  - "Message split strategy: summary first then per-change details when total exceeds 4096 chars"
  - "truncate() set to 300 chars per text block in single-message mode, 150 chars in split mode"
metrics:
  duration: "2 min"
  completed_date: "2026-03-25T17:06:15Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 14 Plan 01: Telegram Notification Sender Summary

## One-liner

Standalone Node.js CLI script reading BCN change JSON from stdin and sending HTML-formatted Telegram messages via Bot API with emoji evaluations, text diffs, and Sheet link.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create notify-telegram.js with stdin JSON input, HTML message formatting, and --dry-run | 42bc33a | scripts/notify-telegram.js (319 lines) |

## What Was Built

`scripts/notify-telegram.js` is a standalone CLI script that:

1. Reads BCN change data as JSON from stdin (structure: `changes[]`, `total_claims_checked`, `detection_date`)
2. Formats an HTML Telegram message using `<b>`, `<code>`, `<pre>`, and `<a>` tags — no markdown
3. Assigns emojis to each evaluation state: checkmark (sin_impacto), yellow circle (requiere_revision), red circle (actualizar)
4. Handles the 4096-char Telegram limit by splitting into summary + per-change detail messages
5. Supports `--dry-run` to print the formatted message to stdout without needing credentials
6. Validates `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` env vars with setup instructions on failure
7. Uses only `require('https')` (native Node.js) — zero npm dependencies
8. Follows project conventions: IIFE pattern, `var` only (no `const`/`let`), no ES module imports

## Verification

Both verification commands passed:

```
echo '{"changes":[{"data_key":"feriado_test",...,"evaluacion":"requiere_revision",...}],...}' | node scripts/notify-telegram.js --dry-run
# Output: formatted HTML message with yellow circle emoji, Sheet link

echo '{"changes":[{"data_key":"test",...,"evaluacion":"actualizar",...}],...}' | node scripts/notify-telegram.js --dry-run
# Output: formatted HTML message with red circle emoji, Sheet link
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the script is fully functional. Actual Telegram sending requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` environment variables (GitHub Actions secrets). The dry-run path is complete and testable without credentials.

## Next Steps

- Phase 14 Plan 02 will integrate `notify-telegram.js` into the GitHub Actions workflow (replacing the GitHub Issues notification in `sync-deploy.yml`)
- Before first production run: create Telegram bot via @BotFather, obtain `TELEGRAM_CHAT_ID` via `getUpdates`, add both as GitHub Actions secrets

## Self-Check: PASSED

- scripts/notify-telegram.js: FOUND (319 lines, 42bc33a)
- grep api.telegram.org: FOUND
- grep parse_mode: FOUND
- grep dry-run: FOUND
- grep TELEGRAM_BOT_TOKEN: FOUND
- grep TELEGRAM_CHAT_ID: FOUND
- grep 160WyrLOm6nV2MAg1cusYvSbVzOWnqYWIt8O5MgXRvF4: FOUND
- grep require('https'): FOUND
- No import/const/let: CLEAN
- --dry-run exit 0: VERIFIED
