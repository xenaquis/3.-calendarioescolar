# Phase 3: Region Selector + Panel - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current chips-based region selector on index.html with a split layout: color-coded region list (left) + data panel (right). Desktop only — mobile handled in Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Region List Behavior
- Replace chips entirely with region list (no dual selector)
- Remove the static key-facts section (4 cards at top) — data shows in panel only, avoids duplication
- Before selecting a region: show placeholder "Selecciona una region" with icon

### Data Panel Content
- Additional dates (`<details>`) open by default in panel — user came to see data, panel has space
- Small group badge under region name (Estandar/Norte/Sur/Sur-Parcial) per Mock C

### Integration with Existing Page
- Keep school-stats section (countdown timers) above the map layout — unique value
- Keep feriados section below the map layout — separate content
- Remove the hidden `<select>` element (id=region-select) and inline calendar card (id=region-calendar) — replaced by new layout

### Claude's Discretion
- Exact CSS class names for new components (follow BEM-lite pattern)
- How to structure the JS that reads REGIONS_DATA and populates the panel
- Whether to put new JS in app.js or a separate file

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `public/js/regions-data.js` — window.REGIONS_DATA with all 16 regions, all fields including 5 additional
- `public/js/app.js` — current chip click handler + region table population logic
- `public/css/components.css` — existing BEM components, tokens, variables
- `public/css/tokens.css` — color vars (--primary: #7c3aed, --accent: #2563eb, etc.)
- `mocks/mock-c-mapa.html` — approved mock with working JS and CSS (reference implementation)

### Established Patterns
- CSS: BEM-lite classes, custom properties from tokens.css, mobile-first
- JS: IIFE, var, no ES modules, reads window.REGIONS_DATA
- HTML: semantic, accessible (WCAG AA), lang="es-CL"

### Integration Points
- `public/index.html` lines 231-297: current chips + hidden select + inline calendar (REPLACE)
- `public/index.html` lines 176-200: static key-facts section (REMOVE)
- `public/js/app.js`: chip click handlers + region table builder (REWRITE for new layout)
- `public/css/components.css`: add new component styles

</code_context>

<specifics>
## Specific Ideas

- Mock C (`mocks/mock-c-mapa.html`) is the approved reference — copy its layout, colors, and interaction pattern
- 4 group colors: primary (#7c3aed) for ESTANDAR, warning (#ea580c) for NORTE, success (#16a34a) for SUR-PARCIAL, accent (#2563eb) for SUR
- Region order: north to south (Arica first, Magallanes last)
- Grid layout: `grid-template-columns: 220px 1fr` on desktop

</specifics>

<deferred>
## Deferred Ideas

- Mobile responsive layout — Phase 4 (RESP-02)

</deferred>
