# Phase 10: UI Verificacion + Mapa Interactivo — Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Agregar el badge "Verificado BCN" con tooltip CSS-only a la tabla de feriados en index.html, verificar que el mapa interactivo de regiones ya funciona (ya implementado en app.js), documentar Bot Fight Mode en BLUEPRINT.md.

Entregables:
- `public/css/verificacion.css` — nuevas clases `.bcn-badge-wrap`, `.bcn-badge`, `.bcn-tooltip`
- `public/index.html` — columna "Ley" en tabla feriados con badge+tooltip para los 7 feriados en período escolar
- `BLUEPRINT.md` — sección nueva "Bot Fight Mode" con guía de activación

NO incluido (ya funciona):
- MAP-02: click región → panel con datos (app.js `selectRegion()` ya lo implementa)
- MAP-04: `window.REGIONS_DATA` sin duplicación en HTML (ya implementado)
- MAP-05: mobile dropdown + panel (ya implementado en `.mobile-region-selector`)

</domain>

<decisions>
## Implementation Decisions

### Tooltip Design (Grey Area 1/2 — aceptado)
- Badge placement: nueva columna "Ley" en tabla feriados (tercera columna)
- Tooltip position: arriba del badge (CSS `bottom: calc(100% + 6px)`)
- Max-width: 320px, texto completo sin truncar (puede crecer verticalmente)
- Badge color: verde (consistente con `.verificacion-badge--ok`, color `#166534`)
- Mecanismo: CSS-only — `:hover` desktop + `:focus-within` mobile (sin JS para visibilidad)

### Bot Fight Mode Docs (Grey Area 2/2 — aceptado)
- Ubicación: sección nueva en BLUEPRINT.md (no archivo separado)
- Contenido: steps para activar en Cloudflare dashboard + descripción de qué hace

### Tooltip HTML Pattern
```html
<td>
  <span class="bcn-badge-wrap" tabindex="0">
    <span class="bcn-badge">✓ Ley</span>
    <span class="bcn-tooltip" role="tooltip">Art. PRIMERO Nº3, Ley 2.977: «Los Viérnes i Sábados de la Semana Santa...»</span>
  </span>
</td>
```

### Mapping: Feriados tabla → legal-articles.json
Los 7 feriados en período escolar y sus claims correspondientes:
1. Viernes Santo → `feriado_viernes_santo` → Art. PRIMERO Nº3, Ley 2.977
2. Día del Trabajo → `feriado_dia_trabajo` → Art. PRIMERO, Ley 2.977
3. Glorias Navales → `feriado_glorias_navales` → Art. PRIMERO Nº5, Ley 2.977
4. Corpus Christi → `feriado_corpus_christi` → Art. PRIMERO Nº2, Ley 2.977
5. San Pedro y San Pablo → `feriado_san_pedro_san_pablo` → Art. PRIMERO Nº2, Ley 2.977
6. Encuentro de Dos Mundos → `feriado_encuentro_dos_mundos` → Art. ÚNICO, Ley 19.668
7. Inmaculada Concepción → `feriado_inmaculada_concepcion` → Art. PRIMERO Nº2, Ley 2.977

### Claude's Discretion
- Texto exacto del tooltip (puede resumir el inciso relevante o mostrar extracto)
- Estilo exacto del badge (border, padding, font-size) mientras sea verde y legible
- Formato de la sección Bot Fight Mode en BLUEPRINT.md

</decisions>

<code_context>
## Existing Code Insights

### Feriados Table — index.html (lines ~332-354)
```html
<table>
  <thead><tr><th>Fecha</th><th>Feriado</th></tr></thead>
  <tbody>
    <tr><td>Viernes 3 de abril</td><td>Viernes Santo</td></tr>
    <tr><td>Viernes 1 de mayo</td><td>Día del Trabajo</td></tr>
    <!-- 5 more rows -->
  </tbody>
</table>
```
→ Agregar `<th>Ley</th>` en thead, `<td><span class="bcn-badge-wrap" tabindex="0">...</span></td>` en cada fila

### verificacion.css — Existing Badge Classes
- `.verificacion-badge--ok` — green background `#f0fdf4`, border `#bbf7d0`, color `#166534`
- Usar MISMOS colores para `.bcn-badge` (consistencia visual)
- Agregar las nuevas clases `.bcn-badge-wrap`, `.bcn-badge`, `.bcn-tooltip` al final del archivo

### MAP Requirements — Already Implemented
- `app.js` líneas 49-100: `initMapSelector()` enlaza `.region-bar[data-slug]` + `<select id="region-select">` mobile
- `selectRegion(slug, bars)` carga datos de `window.REGIONS_DATA` en `#region-data`
- `public/js/regions-data.js` provee `window.REGIONS_DATA` (generado por npm run generate)
- Solo verificar que MAP-02, MAP-04, MAP-05 se cumplan con la implementación existente

### BLUEPRINT.md
- Contiene secciones: Estado actual, Pipeline, Datos, Pendientes, etc.
- Agregar sección "Bot Fight Mode" con steps para activar en Cloudflare

</code_context>

<specifics>
## Specific Requirements

### VERI-01: Tooltip desktop via :hover
CSS puro — `.bcn-badge-wrap:hover .bcn-tooltip { display: block; }`

### VERI-02: Tooltip mobile via :focus-within
CSS puro — `.bcn-badge-wrap:focus-within .bcn-tooltip { display: block; }`
(El `tabindex="0"` en `.bcn-badge-wrap` permite focus via tap en mobile)

### VERI-03: Footer links intactos
Footer ya tiene links a BCN.cl y Mineduc — NO modificar. Solo verificar.

### MAP-02, MAP-04, MAP-05: Ya implementados
No hay código que escribir — solo verificar el estado existente.

### SEC-01: Bot Fight Mode en BLUEPRINT.md
Guía paso a paso:
1. Cloudflare Dashboard → sitio calendarioescolar.cl
2. Security → Bots → Bot Fight Mode: Enable
3. Verificar que está ON (checkmark verde)
Descripción: bloquea bots maliciosos conocidos, no afecta Google/Bing crawlers legítimos

</specifics>

<deferred>
## Deferred Ideas

- Dashboard web de estado de verificación legal (pertenece a milestone posterior)
- Tooltips en páginas regionales individuales (region/[slug]/index.html) — fuera de alcance v1.2
- Animación CSS del tooltip (fade-in) — nice-to-have no requerido

</deferred>
