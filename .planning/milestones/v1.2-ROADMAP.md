# Roadmap — calendarioescolar.cl

## Milestones

- ✅ **v1.0 Extraccion Fidedigna + Datos Completos** — Phases 1-4 (shipped 2026-03-24)
- ✅ **v1.1 Activacion & Calidad** — Phase 5 (shipped 2026-03-25)
- 📋 **v1.2 Validacion Legal + Mapa Interactivo** — Phases 8-10 (planned)

## Phases

<details>
<summary>✅ v1.0 (Phases 1-4) — SHIPPED 2026-03-24</summary>

- [x] Phase 1: Pipeline Visual (3/3 plans) — completed 2026-03-24
- [x] Phase 2: Datos Completos (2/2 plans) — completed 2026-03-24
- [x] Phase 4: Mobile Responsiveness (1/1 plan) — completed 2026-03-24

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Activacion & Calidad (Phase 5) — SHIPPED 2026-03-25</summary>

- [x] Phase 5: Activacion de Produccion (2/2 plans) — completed 2026-03-25

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 📋 v1.2 Validacion Legal + Mapa Interactivo

- [x] **Phase 8: BCN Legal Extractor** - Script Python extrae articulado verbatim desde BCN.cl y lo guarda en legal-articles.json (completed 2026-03-25)
- [x] **Phase 9: Change Detection Pipeline** - Cron semanal detecta cambios en articulado BCN y crea GitHub Issue con evaluacion IA (completed 2026-03-25)
- [x] **Phase 10: UI Verificacion + Mapa Interactivo** - Tooltip "Verificado" con texto legal + mapa de regiones interactivo en mobile y desktop (completed 2026-03-25)

## Phase Details

### Phase 8: BCN Legal Extractor
**Goal**: El sistema puede obtener y almacenar el articulado legal verbatim que respalda cada afirmacion de feriado
**Depends on**: Nothing (foundation for v1.2)
**Requirements**: BCN-01, BCN-02, BCN-03
**Success Criteria** (what must be TRUE):
  1. `scripts/bcn-extractor.py` descarga el XML de BCN.cl para cada ley de feriado y extrae todos sus articulos sin error
  2. `data/legal-articles.json` existe y contiene para cada claim `feriado-*`: articulo(s) relevante(s) identificados por Claude API, texto verbatim, hash SHA, y `last_checked`
  3. El hash SHA almacenado corresponde al texto verbatim guardado (verificable localmente con sha256)
  4. El campo `texto_anterior` se registra en `legal-articles.json` cuando hay un cambio respecto a la corrida previa
**Plans:** 1 plan
Plans:
- [x] 08-01-PLAN.md — COMPLETE: bcn-extractor.py + DeepSeek AI identification + legal-articles.json with 15 claims

### Phase 9: Change Detection Pipeline
**Goal**: El sistema monitorea automaticamente cambios en la legislacion de feriados y alerta al equipo cuando una afirmacion necesita revision
**Depends on**: Phase 8
**Requirements**: CHNG-01, CHNG-02, CHNG-03, CHNG-04, CHNG-05
**Success Criteria** (what must be TRUE):
  1. `scripts/check-bcn-changes.py` compara el hash BCN actual contra `legal-articles.json` y detecta cambios correctamente
  2. Cuando hay un cambio, DeepSeek responde con uno de los tres estados definidos (`sin_impacto | requiere_revision | actualizar`) y ese valor queda registrado
  3. Cuando hay un cambio, existe un GitHub Issue creado automaticamente con el diff de texto, la evaluacion IA, los claims afectados, y una recomendacion
  4. `last_checked` se actualiza en `legal-articles.json` despues de cada corrida, haya o no cambio
  5. El GitHub Action `check-bcn-changes` se ejecuta en cron semanal y tiene boton `workflow_dispatch` funcional
**Plans**: 1 plan
Plans:
- [x] 09-01-PLAN.md — COMPLETE: check-bcn-changes.py + check-bcn-changes.yml workflow (2026-03-25)

### Phase 10: UI Verificacion + Mapa Interactivo
**Goal**: El usuario puede verificar el respaldo legal de cada feriado directamente en la pagina, y navegar por regiones en un mapa interactivo que funciona en mobile y desktop
**Depends on**: Phase 8 (para datos del tooltip)
**Requirements**: VERI-01, VERI-02, VERI-03, MAP-02, MAP-04, MAP-05, SEC-01
**Success Criteria** (what must be TRUE):
  1. Al hacer hover sobre el badge "Verificado" en desktop aparece un tooltip CSS-only con `art. XX inciso X: "texto verbatim"`
  2. En mobile, el mismo tooltip es accesible via tap o focus sin ningun JavaScript (CSS `:focus-within` puro)
  3. El footer mantiene los links a BCN.cl y Mineduc como estan hoy
  4. Al hacer click en una region de la lista, el panel muestra sus key-facts y tabla de datos sin recargar la pagina
  5. En mobile (<650px), la interfaz muestra un dropdown select de region seguido del panel de datos, y los datos se leen desde `window.REGIONS_DATA` sin duplicacion en el HTML estatico
  6. La guia de Bot Fight Mode esta documentada y el dashboard de Cloudflare puede mostrar el estado activo
**Plans:** 1/1 plans complete
Plans:
- [ ] 10-01-PLAN.md — CSS-only tooltip badges on 7 feriados + verify MAP + Bot Fight Mode docs

## Progress Table

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Pipeline Visual | v1.0 | 3/3 | Complete | 2026-03-24 |
| 2. Datos Completos | v1.0 | 2/2 | Complete | 2026-03-24 |
| 4. Mobile Responsiveness | v1.0 | 1/1 | Complete | 2026-03-24 |
| 5. Activacion de Produccion | v1.1 | 2/2 | Complete | 2026-03-25 |
| 8. BCN Legal Extractor | v1.2 | 1/1 | Complete | 2026-03-25 |
| 9. Change Detection Pipeline | v1.2 | 1/1 | Complete    | 2026-03-25 |
| 10. UI Verificacion + Mapa Interactivo | v1.2 | 0/1 | Complete    | 2026-03-25 |

---
*Updated: 2026-03-25 — Phase 10 planned: 1 plan (tooltip badges + MAP verify + Bot Fight Mode docs)*
