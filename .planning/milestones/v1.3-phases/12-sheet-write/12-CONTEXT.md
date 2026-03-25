# Phase 12: Sheet Write - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Infrastructure phase — discuss skipped

<domain>
## Phase Boundary

Create `scripts/claims-to-sheet.js` that writes the unified `data/claims.json` + regional data + config to a single "Datos" tab in the Google Sheet. The Sheet becomes a human-auditable mirror of all site data. Hash-based change detection enables detecting manual Sheet edits.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from project:
- Must use native Node.js `https` module (no npm dependencies) — same pattern as sync-from-sheet.js
- Google Sheets API v4 requires authentication for write operations — use service account JSON key via `GOOGLE_SERVICE_ACCOUNT_KEY` env var (or file path)
- Spreadsheet ID from config.json → sheet.spreadsheetId: "160WyrLOm6nV2MAg1cusYvSbVzOWnqYWIt8O5MgXRvF4"
- New tab name: "Datos" (add to config.json → sheet.datosTab)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/sync-from-sheet.js` — Reads from Sheet using Google Sheets API v4 REST, native https, established patterns for API calls
- `data/claims.json` — Source data (50 claims, unified model v2.0.0 from Phase 11)
- `data/pages.json` — Regional data (16 regions)
- `data/calendar-config.json` — Year config + holidays
- `config.json` — Sheet IDs and tab names

### Established Patterns
- Native https for Google API calls (no libraries)
- GOOGLE_API_KEY env var for read-only access
- config.json stores spreadsheet ID and tab names
- var/require, no ES modules, IIFE style

### Integration Points
- `config.json` → sheet section needs new "datosTab" entry
- `data/claims.json` → primary source for claims rows
- `data/pages.json` → source for regional data rows
- `data/calendar-config.json` → source for config rows
- Google Sheets API v4 batchUpdate / values.update endpoints

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
