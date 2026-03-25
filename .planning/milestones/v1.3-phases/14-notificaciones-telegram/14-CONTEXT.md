# Phase 14: Notificaciones Telegram - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Infrastructure phase — discuss skipped

<domain>
## Phase Boundary

Create `scripts/notify-telegram.js` that sends BCN change notifications via Telegram Bot API. Update `scripts/check-bcn-changes.py` to call the Telegram notifier instead of creating GitHub Issues. Message includes: affected claim name, old vs new text, AI impact assessment, and Sheet link.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints:
- No npm dependencies — use native Node.js https module for Telegram Bot API calls
- Telegram Bot API token via TELEGRAM_BOT_TOKEN env var
- Chat ID via TELEGRAM_CHAT_ID env var
- check-bcn-changes.py currently creates GitHub Issues — must be changed to call notify-telegram.js
- AI impact evaluation is already done in check-bcn-changes.py via Claude API — pass the assessment to the Telegram message
- --dry-run flag for testing without sending real messages

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/check-bcn-changes.py` — Current BCN change detection pipeline, creates GitHub Issues on changes detected
- `scripts/bcn-extractor.py` — BCN article extraction with Claude API
- `data/claims.json` — Unified claims with BCN verbatim text and hashes
- `config.json` — Project configuration

### Established Patterns
- Python scripts for BCN interaction (bcn-extractor.py, check-bcn-changes.py)
- Node.js scripts for data transformation (merge-claims.js, claims-to-sheet.js)
- Native https for API calls (no external dependencies)
- var/require for Node.js scripts, standard Python for .py scripts
- --dry-run flag pattern used in bcn-extractor.py and claims-to-sheet.js

### Integration Points
- `scripts/check-bcn-changes.py` — must replace GitHub Issue creation with Telegram notification
- `.github/workflows/sync-deploy.yml` — may need TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets
- Telegram Bot API: https://api.telegram.org/bot{token}/sendMessage

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
