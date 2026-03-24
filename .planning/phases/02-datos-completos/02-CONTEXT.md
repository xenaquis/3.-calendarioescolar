# Phase 2: Datos Completos - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Agregar datos adicionales (cierre actas, JEC/sin JEC, EPJA, dia profesor, inicio 2do semestre) a cada pagina de region de forma minimalista y elegante. Los datos deben provenir del pipeline visual (Phase 1), no hardcodeados.

</domain>

<decisions>
## Implementation Decisions

### Data Presentation Layout
- Additional data goes below main table in a collapsible `<details>` section (secondary, not prominent)
- Section closed by default — most visitors want the 4 key dates, power users expand
- Label: "Mas fechas del calendario escolar"
- Each additional date shows day-of-week ("Viernes 20 de noviembre") matching resolution format

### Additional Fields
- All 5 fields added to pages.json: `finAnoSinJEC`, `finAnoEPJA`, `cierreActas4Medio`, `diaProfesor`, `inicioSegundoSemestre`
- When a field is unavailable for a region, show row with "Sin datos" (transparent, user knows it was checked)
- Data extracted via extended extract-visual.js (satisfies DATA-04: not hardcoded)

### Visual Styling
- Same `.section` container + simple table like the main calendar table — consistency with existing design
- Small text note after main table: "Ver mas fechas ▾" as subtle nudge
- Same neutral palette as main table (DATA-03: consistent aesthetics)

### Claude's Discretion
- Exact table column layout for additional fields
- How extract-visual.js prompt is modified to capture additional milestones
- Mapping logic from extracted milestones to the 5 new fields in pages.json

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data/template.html` — region page template with {{variable}} placeholders, existing table at line 170-205
- `data/pages.json` — 16 regions with current fields (inicio, vacacionesInicio, etc.)
- `scripts/generate-pages.js` — reads pages.json + template.html, writes region HTML
- `scripts/extract-visual.js` — Phase 1 extraction script, reads png-manifest.json, calls Anthropic API
- `data/extraction-tests/metropolitana-gold-standard.json` — gold standard showing all available milestones (semestral + trimestral arrays)
- `public/css/components.css` — existing card, table, key-facts, section styles

### Established Patterns
- Templates use `{{fieldName}}` placeholders replaced by generate-pages.js
- Tables use `<table>` inside `.table-wrapper` inside `.section`
- Styles in components.css with BEM-lite naming
- Scripts use CommonJS (`var`, `require`, `'use strict'`)

### Integration Points
- `scripts/generate-pages.js` must be extended to pass new fields to template
- `data/template.html` must add collapsible section after main table
- `scripts/extract-visual.js` prompt must request all milestones (not just 6 core fields)
- `data/pages.json` is the bridge between extraction and generation

</code_context>

<specifics>
## Specific Ideas

- Gold standard for Metropolitana shows all milestones: cierre actas 4 Medio (Nov 20), fin sin JEC (Dec 18), fin EPJA (Nov 20), dia profesor (Oct 16), inicio 2do semestre (Jul 6)
- The 4 regional groups (ESTANDAR, NORTE, SUR, SUR-PARCIAL) may have different dates for these additional fields
- The `<details>` HTML element provides native collapsible behavior without JavaScript

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
