# Roadmap — calendarioescolar.cl v2

**2 phases** | **9 requirements** | All v1 requirements covered

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Pipeline Visual | Reemplazar extracción texto por visual con 100% precisión | PIPE-01..05 | 16 regiones extraídas correctamente, PNGs preservados |
| 2 | Datos Completos | Mostrar todos los hitos del calendario en cada página | DATA-01..04 | Tabla extendida visible, datos verificados, estética consistente |

## Phase Details

### Phase 1: Pipeline Visual
**Goal:** Reemplazar `extract-from-pdf.js` con pipeline visual: PDF → PNG → extracción estructurada → validación determinista. Lograr 100% de precisión en las 16 regiones.

**Requirements:** PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05

**Success criteria:**
1. Los 16 PDFs generan PNGs de las páginas con tablas
2. JSON de extracción contiene todos los hitos semestral + trimestral por región
3. Checks deterministas pasan sin errores (formato, día semana, año)
4. Cross-region identifica correctamente los 4 grupos (ESTÁNDAR, NORTE, SUR, SUR-PARCIAL)
5. PNGs preservados en `data/snapshots/` como evidencia

**UI hint**: no

### Phase 2: Datos Completos
**Goal:** Agregar datos adicionales (cierre actas, JEC/sin JEC, EPJA, día profesor, inicio 2do semestre) a cada página de región de forma minimalista y elegante.

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04

**Success criteria:**
1. `pages.json` tiene los campos adicionales para las 16 regiones
2. Tabla extendida visible en cada página de región (sección secundaria, no prominente)
3. Estética consistente con diseño actual (colores, tipografía, cards)
4. Datos provienen del pipeline visual, no hardcodeados
5. `npm run generate` produce las páginas correctamente con los nuevos campos

**UI hint**: yes

---
*Created: 2026-03-24*
