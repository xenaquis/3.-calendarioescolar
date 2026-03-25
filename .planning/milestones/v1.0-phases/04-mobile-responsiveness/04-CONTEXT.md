# Phase 4: Mobile Responsiveness - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Mode:** Auto-generated (small scope — 1 requirement)

<domain>
## Phase Boundary

Add mobile responsiveness to the map layout: below 650px, replace the region list with a native `<select>` dropdown and stack the data panel vertically below it. Same data, different presentation.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints:
- Breakpoint: 650px (already established in Phase 3 CSS with `@media (min-width: 650px)`)
- Use native `<select>` element for mobile (not a custom dropdown)
- Data panel stacks below the dropdown (single column)
- Must work with the same selectRegion() JS function from Phase 3
- The `<select>` can be hidden on desktop via CSS, shown on mobile

</decisions>

<code_context>
## Existing Code Insights

### From Phase 3
- `public/css/components.css` — `.map-layout` uses `grid-template-columns: 220px 1fr` at `min-width: 650px`
- `public/index.html` — 16 `.region-bar` buttons in `.map-panel`, data panel in `.data-panel`
- `public/js/app.js` — `selectRegion(slug)` already handles all data population
- Mobile-first CSS: the map-layout defaults to single column, grid only at 650px+

### Integration Points
- Need to add a `<select>` element in index.html (hidden on desktop, visible on mobile)
- Need CSS to hide `.map-panel` on mobile and show the select
- Need JS to wire the select's `onchange` to `selectRegion()`

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond RESP-02.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
