# Requirements — calendarioescolar.cl v1.1

**Defined:** 2026-03-24
**Core Value:** El usuario encuentra la fecha escolar que busca en menos de 10 segundos, con datos verificados y actualizados directo de Mineduc.

## v1.1 Requirements

### ANLYT — Analytics & Medición

- [x] **ANLYT-01**: El sitio envía eventos reales a GA4 (propiedad real, no placeholder G-XXXXXXXXXX)
- [x] **ANLYT-02**: Google Search Console tiene la propiedad verificada y el sitemap enviado
- [x] **ANLYT-03**: GA4 y Search Console están conectados entre sí

### ASSET — Activos de Producción

- [x] **ASSET-01**: og-image.png existe en public/icons/ (1200×630px, fondo #7c3aed, texto blanco "Calendario Escolar Chile 2026")

### SEO — Contenido SEO

- [x] **SEO-01**: Existe public/feriados-2027.html con estructura similar a feriados-2026.html, contenido orientado a búsquedas anticipadas

### SEC — Seguridad & Calidad

- [ ] **SEC-01**: Bot Fight Mode de Cloudflare está activado (guía documentada para hacerlo via dashboard)
- [ ] **SEC-02**: Sistema de validación Fase 1 implementado — registro de afirmaciones (afirmaciones.json) y meta claim-data en páginas
- [ ] **SEC-03**: Sistema de validación Fase 2 implementado — check-sources.js (HTTP health check de fuentes oficiales)
- [ ] **SEC-04**: Sistema de validación Fase 4 implementado — badges de transparencia visibles en frontend
- [ ] **SEC-05**: Sistema de validación Fase 3 implementado — verify-content.js (verificación IA + determinística de claims)

### MAP — Mapa Interactivo (completar)

- [ ] **MAP-02**: Al hacer click en una región de la lista, el panel derecho muestra sus datos (key-facts + tabla adicional)
- [ ] **MAP-04**: Panel carga datos desde window.REGIONS_DATA (regions-data.js) sin duplicar datos en HTML
- [ ] **MAP-05**: Mobile (<650px): muestra dropdown select de región + panel de datos debajo (en vez de layout split)

## v2 Requirements (deferred)

### Mapa Interactivo — Futuro

- **MAP-F01**: Mapa SVG geográfico real de Chile (en vez de lista) — alta complejidad
- **MAP-F02**: Animación de transición al cambiar región
- **MAP-F03**: Guardar región preferida en localStorage

### Analytics — Futuro

- **ANLYT-F01**: Dashboard de métricas personalizado (tráfico por región, keywords principales)
- **ANLYT-F02**: Alertas automáticas si cae el tráfico orgánico significativamente

## Out of Scope

| Feature | Reason |
|---------|--------|
| AdSense setup | Ya activo en producción — excluido de este milestone |
| Datos feriados 2027 completos | Los datos reales llegan ~noviembre 2026 desde Mineduc |
| Mapa SVG geográfico real | Complejidad alta, lista norte-sur cumple el mismo propósito |
| Comparador de regiones lado a lado | Fuera de scope — búsquedas de usuarios son por región individual |
| Notificaciones push | Complejidad innecesaria para sitio estático utilitario |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ANLYT-01 | Phase 5 | Complete |
| ANLYT-02 | Phase 5 | Complete |
| ANLYT-03 | Phase 5 | Complete |
| ASSET-01 | Phase 5 | Complete |
| SEO-01 | Phase 5 | Complete |
| SEC-01 | Phase 6 | Pending |
| SEC-02 | Phase 6 | Pending |
| SEC-03 | Phase 6 | Pending |
| SEC-04 | Phase 6 | Pending |
| SEC-05 | Phase 6 | Pending |
| MAP-02 | Phase 7 | Pending |
| MAP-04 | Phase 7 | Pending |
| MAP-05 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 13 (100%)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 — traceability assigned after roadmap definition*
