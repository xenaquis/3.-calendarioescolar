---
phase: 03-region-selector-panel
plan: 02
subsystem: ui
tags: [vanilla-js, iife, region-selector, interactive-panel, regions-data]

# Dependency graph
requires:
  - phase: 03-01
    provides: Map layout HTML structure (.map-layout), region bars (.region-bar[data-slug]), and data panel element IDs in public/index.html
provides:
  - Region bar click handler (initMapSelector) wired to data panel via REGIONS_DATA
  - selectRegion() function populating all 11 panel fields per region
  - GRUPOS constant mapping 5 special-group regions (Norte, Sur, Sur-Parcial)
  - Active state management (aria-selected, .active class) for region bars
affects: [04-mobile-responsiveness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IIFE module pattern with var for IE11 compatibility"
    - "Closure-based event delegation in for-loop using IIFE wrapper"
    - "GRUPOS constant as slug -> group-name map; unmatched slugs default to Estandar"

key-files:
  created: []
  modified:
    - public/js/app.js

key-decisions:
  - "GRUPOS constant defined in JS (not data attribute) — keeps HTML clean, group logic co-located with selector"
  - "selectRegion accepts bars NodeList to avoid re-querying on every click"
  - "placeholder-data hidden via style.display, region-data shown via className = 'active'"

patterns-established:
  - "Pattern 1: window.REGIONS_DATA lookup by slug — single source of truth, no data duplication"
  - "Pattern 2: IIFE closure in for-loop for event listener binding — compatible with var/IE11"

requirements-completed: [MAP-02, MAP-03, PANEL-01, PANEL-02, PANEL-03, PANEL-04]

# Metrics
duration: ~20min
completed: 2026-03-24
---

# Phase 03 Plan 02: JS Wiring Summary

**Region bar clicks now populate the data panel with all 11 calendar fields via window.REGIONS_DATA lookup, replacing the old chips/select-based selector in app.js**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-24
- **Completed:** 2026-03-24
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 1

## Accomplishments

- Rewrote `initMapSelector()` to bind click events on all `.region-bar[data-slug]` elements
- Rewrote `selectRegion(slug, bars)` to populate 6 key-fact fields + 5 additional fields + group badge + page link
- Removed `initRegionChips()` and `initRegionSelector()` (old chip/select logic) completely
- Preserved `initSchoolStats()` verbatim — school-week counter, winter countdown, feriados unaffected
- Visual checkpoint confirmed: all 16 regions clickable, correct data and group badges, active highlight works

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite app.js region selector logic for map layout** - `79f6108` (feat)
2. **Task 2: Visual verification** - checkpoint approved (no code commit)

**Plan metadata:** (this commit — docs)

## Files Created/Modified

- `public/js/app.js` — replaced initRegionSelector/initRegionChips with initMapSelector + selectRegion; added GRUPOS constant; preserved initSchoolStats

## Decisions Made

- GRUPOS constant defined inline in JS rather than as data attributes on HTML elements — keeps group logic co-located with the selector and avoids polluting the generated HTML with extra attributes.
- `selectRegion` receives the `bars` NodeList as a parameter (captured at init time) to avoid re-querying the DOM on every click event.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Desktop region selector is fully functional: layout (03-01) + JS wiring (03-02) complete.
- Phase 04 (Mobile Responsiveness) can begin: dropdown fallback + vertical panel layout at 650px breakpoint.
- No blockers.

---
*Phase: 03-region-selector-panel*
*Completed: 2026-03-24*
