# Requirements — calendarioescolar.cl v2

## v1 Requirements

### PIPE — Pipeline de Extracción Visual

- [x] **PIPE-01**: Script genera PNGs de páginas con tablas desde los 16 PDFs regionales usando PyMuPDF
- [x] **PIPE-02**: PNGs se preservan en `data/snapshots/` con naming consistente (`{region}-tabla-p{N}.png`)
- [ ] **PIPE-03**: Extracción produce JSON estructurado por región con todos los hitos del calendario
- [ ] **PIPE-04**: Checks deterministas validan formato fecha, día de semana, año, rangos
- [ ] **PIPE-05**: Cross-region detecta diferencias y las clasifica como legítimas (NORTE/SUR/SUR-PARCIAL) vs errores

### DATA — Datos Completos por Región

- [ ] **DATA-01**: `pages.json` incluye campos adicionales: `finAnoSinJEC`, `finAnoEPJA`, `cierreActas4Medio`, `diaProfesor`, `inicioSegundoSemestre`
- [ ] **DATA-02**: Template de región muestra tabla extendida con los datos adicionales en sección colapsable o secundaria
- [ ] **DATA-03**: Estilo minimalista consistente con la estética actual (mismo card, misma tipografía, jerarquía visual clara)
- [ ] **DATA-04**: Los datos adicionales se extraen del mismo pipeline visual (no hardcodeados)

## v2 Requirements (deferred)

- [ ] PNGs de tablas visibles on-demand en cada página de región (link "Ver resolución oficial")
- [ ] Badge visual indicando fecha de última verificación contra PDF

## Out of Scope

- Detalle de régimen trimestral con fechas condicionales — demasiado complejo para el usuario
- Extracción automatizada sin human-in-the-loop — la verificación manual es parte del valor
- Migración a otro stack (Python, etc.) — el sitio es vanilla JS y debe seguir siéndolo

## Traceability

| REQ | Phase |
|-----|-------|
| PIPE-01..05 | Phase 1 |
| DATA-01..04 | Phase 2 |
