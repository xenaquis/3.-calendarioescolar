# Requirements — calendarioescolar.cl v1.1

## v1.1 Requirements

### MAP — Selector de Regiones

- [x] **MAP-01**: Usuario ve lista de 16 regiones ordenadas norte-sur con dot de color por grupo
- [ ] **MAP-02**: Al hacer click en una region, el panel derecho muestra sus datos
- [x] **MAP-03**: Region activa se resalta visualmente en la lista
- [x] **MAP-04**: Leyenda de colores visible (Estandar, Norte, Sur-Parcial, Sur)

### PANEL — Panel de Datos

- [x] **PANEL-01**: Panel muestra key-facts (inicio, vacaciones, fiestas patrias, fin ano)
- [x] **PANEL-02**: Panel muestra tabla de datos adicionales (5 campos de v1.0)
- [x] **PANEL-03**: Link "Ver pagina completa" lleva a /region/slug/
- [ ] **PANEL-04**: Datos se cargan desde regions-data.js (sin duplicar)

### RESP — Responsividad

- [x] **RESP-01**: Desktop (>650px): layout split (lista izquierda + panel derecha)
- [ ] **RESP-02**: Mobile (<650px): dropdown select + panel debajo

## Future Requirements (deferred)

- [ ] Mapa SVG real de Chile (en vez de lista) — complejidad alta, poco valor agregado vs lista
- [ ] Animacion de transicion al cambiar region
- [ ] Guardar region preferida en localStorage

## Out of Scope

- Mapa SVG geografico real — la lista ordenada norte-sur cumple el mismo proposito con menos complejidad
- Comparador de regiones lado a lado — fuera del scope de esta milestone

## Traceability

| REQ | Phase | Status |
|-----|-------|--------|
| MAP-01 | Phase 3 | Complete |
| MAP-02 | Phase 3 | Pending |
| MAP-03 | Phase 3 | Complete |
| MAP-04 | Phase 3 | Complete |
| PANEL-01 | Phase 3 | Complete |
| PANEL-02 | Phase 3 | Complete |
| PANEL-03 | Phase 3 | Complete |
| PANEL-04 | Phase 3 | Pending |
| RESP-01 | Phase 3 | Complete |
| RESP-02 | Phase 4 | Pending |
