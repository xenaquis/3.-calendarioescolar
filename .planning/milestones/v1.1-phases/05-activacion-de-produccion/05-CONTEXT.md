# Phase 5: Activacion de Produccion - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Activar el sitio completamente en producción: reemplazar GA4 placeholder con ID real, crear feriados-2027.html como landing SEO anticipatoria, y documentar pasos de Search Console. ASSET-01 (og-image.png 1200×630px) ya existe — no requiere trabajo.

</domain>

<decisions>
## Implementation Decisions

### GA4 Integration Approach
- Reemplazar G-XXXXXXXXXX con ID real `G-6FVLKF6PFQ` en todos los archivos afectados
- Actualizar template.html y regenerar páginas de región via `npm run generate`
- Documentar pasos de Search Console y conexión GA4↔Search Console en BLUEPRINT.md
- Conexión GA4 + Search Console requiere acción manual del usuario en ambos dashboards — documentar pasos exactos

### feriados-2027.html Content
- Página mínima SEO-ready: H1, meta tags, sección "próximamente" — sin datos reales (disponibles ~noviembre 2026)
- Enlazar desde index.html (footer o sección feriados)
- Incluir URL en sitemap.xml para indexación anticipada
- Estructura similar a feriados-2026.html con aviso claro "Datos disponibles desde noviembre 2026"

### GA4 Measurement ID
- ID real: `G-6FVLKF6PFQ`
- Reemplazar en todos los archivos que contengan 'G-XXXXXXXXXX'

### Claude's Discretion
- Ubicación exacta del link a feriados-2027 en index.html (footer preferible)
- Contenido específico del texto "próximamente" en feriados-2027.html

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `public/js/analytics.js` — IIFE loader con guard: skips if ID contains 'XXXX' (seguro)
- `public/feriados-2026.html` — template completo para nueva página feriados-2027
- `public/icons/og-image.png` — ya existe 1200×630px (ASSET-01 completo)
- `data/template.html` — genera todas las páginas de región (16 regiones)

### Established Patterns
- Analytics.init('G-XXXXXXXXXX') en inline script al final de cada HTML
- `sitemap.xml` existe en public/ con URLs absolutas
- Páginas de región generadas via `npm run generate` desde template.html
- Sistema claim-data: meta tag + afirmaciones.json para páginas con datos factuales

### Integration Points
- `G-XXXXXXXXXX` aparece en: public/js/app.js, data/template.html, y ~20 páginas HTML estáticas
- sitemap.xml necesita nueva entrada para /feriados-2027.html
- index.html sección feriados o footer para enlace a nueva página

</code_context>

<specifics>
## Specific Ideas

- GA4 ID confirmado: `G-6FVLKF6PFQ`
- feriados-2027.html debe tener aviso explícito sobre disponibilidad de datos (~noviembre 2026)
- No crear datos ficticios de feriados 2027 — solo estructura y SEO

</specifics>

<deferred>
## Deferred Ideas

- Dashboard de métricas personalizado (ANLYT-F01) — fuera de scope v1.1
- Alertas automáticas si cae tráfico orgánico (ANLYT-F02) — fuera de scope v1.1

</deferred>
