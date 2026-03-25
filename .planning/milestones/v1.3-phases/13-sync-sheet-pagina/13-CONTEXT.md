# Phase 13: Sync Sheet → Pagina - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Mode:** Infrastructure phase — discuss skipped

<domain>
## Phase Boundary

Update sync-from-sheet.js to read exclusively from the "Datos" tab and regenerate claims.json, pages.json, and calendar-config.json. Update generate-pages.js to use claims.json for injecting tooltips and factual content. Configure GitHub Action with daily cron for automated sync → generate → validate → deploy pipeline.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints:
- sync-from-sheet.js already exists and reads from "Regiones" and "Config" tabs — must be updated to read from "Datos" tab instead
- Must maintain backward compatibility with existing GOOGLE_API_KEY authentication (read-only)
- generate-pages.js already generates region pages from pages.json — must additionally use claims.json for tooltip/claim data
- GitHub Action sync-deploy.yml already exists — update cron schedule and flow
- No npm dependencies — native https module only

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/sync-from-sheet.js` — Current Sheet reader (Regiones + Config tabs), native https, GOOGLE_API_KEY auth
- `scripts/generate-pages.js` — Page generator from pages.json + template.html + calendar-config.json
- `scripts/claims-to-sheet.js` — Phase 12 output, writes to "Datos" tab (reverse direction reference)
- `data/claims.json` — Unified claims model v2.0.0 from Phase 11
- `.github/workflows/sync-deploy.yml` — Existing sync + deploy action

### Established Patterns
- Native https for Google Sheets API v4 REST calls
- GOOGLE_API_KEY env var for read access
- config.json → sheet section for spreadsheet ID and tab names
- var/require, no ES modules, IIFE style
- Template variables use {{variable}} pattern in template.html

### Integration Points
- `config.json` → sheet.datosTab = "Datos" (added in Phase 12)
- `data/claims.json` → must be regenerated from Sheet data
- `data/pages.json` → must be regenerated from Sheet regional data
- `data/calendar-config.json` → must be regenerated from Sheet config data
- `.github/workflows/sync-deploy.yml` → update cron + flow

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
