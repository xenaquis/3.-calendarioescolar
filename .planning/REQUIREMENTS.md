# Requirements — calendarioescolar.cl v1.2

**Defined:** 2026-03-25
**Core Value:** El usuario encuentra la fecha escolar que busca en menos de 10 segundos, con datos verificados y actualizados directo de Mineduc.

## v1.2 Requirements

### BCN — Extracción Legal

- [x] **BCN-01**: El script `scripts/bcn-extractor.py` obtiene el XML de cada ley de feriado desde BCN.cl y extrae el texto de todos sus artículos
- [x] **BCN-02**: Para cada claim de tipo `feriado-*` en `afirmaciones.json`, Claude API identifica qué artículos son relevantes (setup único, resultado guardado en `data/legal-articles.json`)
- [x] **BCN-03**: `data/legal-articles.json` almacena por claim: artículos verbatim, hash SHA del texto, `last_checked`, y texto anterior cuando hay cambio (historial)

### CHNG — Detección de Cambios

- [x] **CHNG-01**: El script `scripts/check-bcn-changes.py` compara el hash actual del articulado BCN vs el hash guardado en `legal-articles.json`
- [x] **CHNG-02**: Si detecta cambio, llama DeepSeek API para evaluar si el claim vinculado necesita actualización (respuesta: `sin_impacto | requiere_revision | actualizar`)
- [x] **CHNG-03**: Si detecta cambio, crea automáticamente un GitHub Issue con: texto anterior vs actual (diff), evaluación IA, claim(s) afectados, y recomendación
- [x] **CHNG-04**: `last_checked` se actualiza en cada corrida independientemente de si hay cambio
- [x] **CHNG-05**: GitHub Action ejecuta `check-bcn-changes.py` en cron semanal con opción `workflow_dispatch` para ejecución manual

### VERI — Tooltip de Verificación

- [x] **VERI-01**: El badge "Verificado" en las páginas de feriados muestra al hover un tooltip CSS-only con `art. XX inciso X: "texto verbatim"` del artículo de respaldo
- [x] **VERI-02**: El tooltip es accesible en mobile via tap/focus (sin JavaScript — CSS `:focus-within` puro)
- [x] **VERI-03**: El footer mantiene los links a fuentes oficiales (BCN.cl, Mineduc) como están hoy

### MAP — Mapa Interactivo

- [x] **MAP-02**: Al hacer click en una región de la lista, el panel derecho muestra sus key-facts y tabla de datos sin recargar la página
- [x] **MAP-04**: Los datos del panel se cargan desde `window.REGIONS_DATA` (regions-data.js) — sin duplicar datos en el HTML estático
- [x] **MAP-05**: En mobile (<650px), el layout muestra un dropdown select de región + panel de datos debajo, sin el split de desktop

### SEC — Seguridad

- [x] **SEC-01**: Guía documentada para activar Bot Fight Mode en el dashboard de Cloudflare (verificable: dashboard muestra estado activo)

## v2 Requirements (deferred)

### Legal — Futuro

- **BCN-F01**: Extracción de articulado para claims de fechas escolares (Mineduc PDFs) — requiere pipeline visual adicional
- **BCN-F02**: UI de historial de cambios legales visible en el frontend (timeline de modificaciones)
- **BCN-F03**: Auto-update de afirmaciones cuando IA tiene confianza ≥90% de que el cambio no afecta el claim

### Mapa — Futuro

- **MAP-F01**: Mapa SVG geográfico real de Chile (en vez de lista) — alta complejidad
- **MAP-F02**: Animación de transición al cambiar región
- **MAP-F03**: Guardar región preferida en localStorage

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-update de afirmaciones sin revisión humana | Riesgo de publicar datos incorrectos — siempre human-in-the-loop |
| Articulado verbatim para fechas escolares (PDFs) | PDFs Mineduc no tienen estructura de artículos; pipeline visual cubre verificación |
| Dashboard de historial de cambios legales | Complejidad UI alta, valor marginal para usuario final |
| Datos en tiempo real de colegios individuales | No es el propósito del sitio |
| Notificaciones push | Complejidad innecesaria para sitio estático utilitario |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BCN-01 | Phase 8 | Complete (2026-03-25) |
| BCN-02 | Phase 8 | Complete (2026-03-25) |
| BCN-03 | Phase 8 | Complete (2026-03-25) |
| CHNG-01 | Phase 9 | Complete (2026-03-25) |
| CHNG-02 | Phase 9 | Complete (2026-03-25) |
| CHNG-03 | Phase 9 | Complete (2026-03-25) |
| CHNG-04 | Phase 9 | Complete (2026-03-25) |
| CHNG-05 | Phase 9 | Complete (2026-03-25) |
| VERI-01 | Phase 10 | Complete |
| VERI-02 | Phase 10 | Complete |
| VERI-03 | Phase 10 | Complete |
| MAP-02 | Phase 10 | Complete |
| MAP-04 | Phase 10 | Complete |
| MAP-05 | Phase 10 | Complete |
| SEC-01 | Phase 10 | Complete |

**Coverage:**
- v1.2 requirements: 15 total
- Mapped to phases: 15 (Phase 8: 3, Phase 9: 5, Phase 10: 7)
- Unmapped: 0

---
*Requirements defined: 2026-03-25 | Traceability updated: 2026-03-25*
