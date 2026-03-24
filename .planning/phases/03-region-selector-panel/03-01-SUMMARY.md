---
phase: 03-region-selector-panel
plan: 01
subsystem: ui
tags: [css, html, vanilla-js, bem, map-layout, region-selector]

requires:
  - phase: 02-datos-completos
    provides: regions-data.js with all 16 regions including extended fields (seg, prof, actas, sinJEC, EPJA)

provides:
  - map-layout CSS grid component (220px | 1fr on desktop, stacked mobile)
  - region-bar button component with group color dots (NORTE/SUR/SUR-PARCIAL/ESTANDAR)
  - data-panel component with placeholder and region-data sections
  - mini-facts 2x2 grid for key dates display
  - map-legend component with 4 group color indicators
  - index.html HTML structure ready for Plan 02 JS wiring

affects: [03-02-plan, app.js wiring, index.html]

tech-stack:
  added: []
  patterns:
    - "BEM-lite CSS components appended to components.css without modifying existing styles"
    - "data-grupo attribute on region-bar buttons for CSS group color targeting"
    - "data-slug attribute as JS hook for region selection (Plan 02)"
    - "CSS #region-data display:none / .active toggle pattern"

key-files:
  created: []
  modified:
    - public/css/components.css
    - public/index.html

key-decisions:
  - "ESTANDAR regions have no data-grupo attribute; CSS default color (--color-primary) applies"
  - "details[open] for additional data - open by default per CONTEXT.md decision"
  - "region-bar as <button> elements for keyboard accessibility (WCAG AA)"
  - "key-facts static section removed - data shown in panel per CONTEXT.md"
  - "hidden region-select removed - replaced by region-bar buttons"

patterns-established:
  - "Map layout: .map-layout > .map-panel + .data-panel grid structure"
  - "Group colors via CSS attribute selector: [data-grupo='NORTE'] .region-bar__dot"
  - "Panel IDs: r-name, r-grupo, r-inicio, r-vac, r-fp, r-fin, r-seg, r-prof, r-actas, r-sinjec, r-epja, link-pagina"

requirements-completed: [MAP-01, MAP-03, MAP-04, PANEL-01, PANEL-02, PANEL-03, RESP-01]

duration: 12min
completed: 2026-03-24
---

# Phase 03 Plan 01: Region Selector Panel — CSS + HTML Structure

**Split map layout HTML and CSS: 16 region bars (north-to-south) with group color dots on left, data panel with placeholder and mini-facts on right, using project BEM tokens throughout.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-24T00:00:00Z
- **Completed:** 2026-03-24
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Appended 191 lines of new CSS to components.css covering map layout, region bar, data panel, mini-facts, map legend, placeholder, and dark mode overrides — zero existing styles modified
- Replaced the chips-based region selector (64 lines) with the Mock C map layout HTML (78 lines) including all 16 regions ordered north-to-south with correct group attributes
- Removed static key-facts section (25 lines) per design decision; data will display in the panel
- All acceptance criteria verified: 16 region bars, 2 NORTE, 2 SUR, 1 SUR-PARCIAL, no chips/select/key-facts, school-stats preserved

## Task Commits

1. **Task 1: Add map layout CSS styles to components.css** - `a21fa42` (feat)
2. **Task 2: Replace homepage HTML with map layout structure** - `f641bda` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `public/css/components.css` - Appended .map-layout, .map-panel, .chile-map, .region-bar, .data-panel, .mini-facts, .map-legend, .data-panel__placeholder, dark mode overrides
- `public/index.html` - Removed key-facts section and chips selector; added map-legend + map-layout with 16 region-bar buttons and data-panel with mini-facts

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `id="r-inicio"`, `id="r-vac"`, `id="r-fp"`, `id="r-fin"`, `id="r-seg"`, `id="r-prof"`, `id="r-actas"`, `id="r-sinjec"`, `id="r-epja"` — all empty, will be populated by Plan 02 JS wiring
- `id="link-pagina"` — href="#" placeholder, will be set to `/region/[slug]/` by Plan 02 JS
- `id="r-grupo"` — empty, will be set to group name by Plan 02 JS

These stubs are intentional: Plan 02 (03-02) implements the JS that reads REGIONS_DATA and populates the panel. The goal of Plan 01 was HTML/CSS structure only.

## Self-Check: PASSED

- public/css/components.css: FOUND
- public/index.html: FOUND
- Commit a21fa42 (Task 1 CSS): FOUND
- Commit f641bda (Task 2 HTML): FOUND
