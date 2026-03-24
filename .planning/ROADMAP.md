# Roadmap — calendarioescolar.cl v2

**2 phases** | **9 requirements** | All v1 requirements covered

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Pipeline Visual | Reemplazar extraccion texto por visual con 100% precision | PIPE-01..05 | 16 regiones extraidas correctamente, PNGs preservados |
| 2 | Datos Completos | Mostrar todos los hitos del calendario en cada pagina | DATA-01..04 | Tabla extendida visible, datos verificados, estetica consistente |

## Phase Details

### Phase 1: Pipeline Visual
**Goal:** Reemplazar `extract-from-pdf.js` con pipeline visual: PDF -> PNG -> extraccion estructurada -> validacion determinista. Lograr 100% de precision en las 16 regiones.

**Requirements:** PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05

**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md — PDF-to-PNG generation + snapshot organization (PIPE-01, PIPE-02)
- [ ] 01-02-PLAN.md — Visual extraction script with multimodal LLM (PIPE-03)
- [ ] 01-03-PLAN.md — Deterministic validation + cross-region checks + workflow update (PIPE-04, PIPE-05)

**Success criteria:**
1. Los 16 PDFs generan PNGs de las paginas con tablas
2. JSON de extraccion contiene todos los hitos semestral + trimestral por region
3. Checks deterministas pasan sin errores (formato, dia semana, ano)
4. Cross-region identifica correctamente los 4 grupos (ESTANDAR, NORTE, SUR, SUR-PARCIAL)
5. PNGs preservados en `data/snapshots/` como evidencia

**UI hint**: no

### Phase 2: Datos Completos
**Goal:** Agregar datos adicionales (cierre actas, JEC/sin JEC, EPJA, dia profesor, inicio 2do semestre) a cada pagina de region de forma minimalista y elegante.

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04

**Success criteria:**
1. `pages.json` tiene los campos adicionales para las 16 regiones
2. Tabla extendida visible en cada pagina de region (seccion secundaria, no prominente)
3. Estetica consistente con diseno actual (colores, tipografia, cards)
4. Datos provienen del pipeline visual, no hardcodeados
5. `npm run generate` produce las paginas correctamente con los nuevos campos

**UI hint**: yes

---
*Created: 2026-03-24*
