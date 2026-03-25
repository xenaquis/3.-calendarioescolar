# Roadmap — calendarioescolar.cl

## Milestones

- ✅ **v1.0 Extraccion Fidedigna + Datos Completos** — Phases 1-4 (shipped 2026-03-24)
- ✅ **v1.1 Activacion & Calidad** — Phase 5 (shipped 2026-03-25)
- ✅ **v1.2 Validacion Legal + Mapa Interactivo** — Phases 8-10 (shipped 2026-03-25)
- 🔄 **v1.3 Sheet como Fuente de Verdad Unica** — Phases 11-14 (active)

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

<details>
<summary>✅ v1.2 Validacion Legal + Mapa Interactivo (Phases 8-10) — SHIPPED 2026-03-25</summary>

- [x] Phase 8: BCN Legal Extractor (1/1 plan) — completed 2026-03-25
- [x] Phase 9: Change Detection Pipeline (1/1 plan) — completed 2026-03-25
- [x] Phase 10: UI Verificacion + Mapa Interactivo (1/1 plan) — completed 2026-03-25

Full details: `.planning/milestones/v1.2-ROADMAP.md`

</details>

### v1.3 Sheet como Fuente de Verdad Unica

- [x] **Phase 11: Modelo de Datos Unificado** - Unificar afirmaciones.json + legal-articles.json en claims.json con estructura enriquecida (completed 2026-03-25)
- [x] **Phase 12: Sheet Write** - Script claims-to-sheet.js escribe claims.json completo a pestana "Datos" del Google Sheet (completed 2026-03-25)
- [ ] **Phase 13: Sync Sheet → Pagina** - Flujo completo Sheet como fuente de verdad: sync genera JSON, generate inyecta datos, cron diario
- [ ] **Phase 14: Notificaciones Telegram** - Reemplazar GitHub Issues por Telegram en el pipeline de deteccion de cambios BCN

## Phase Details

### Phase 11: Modelo de Datos Unificado
**Goal**: Toda la informacion de afirmaciones existe en un solo JSON enriquecido, con build enforcement
**Depends on**: Nothing (data model foundation)
**Requirements**: JSON-01, JSON-02, JSON-03, JSON-04
**Success Criteria** (what must be TRUE):
  1. Un solo archivo `data/claims.json` contiene todos los claims de afirmaciones.json y legal-articles.json, sin duplicados
  2. Cada claim con fuente normativa tiene: pregunta, respuesta, fuente_url, extracto_verbatim, hash SHA256, last_checked
  3. Cada pagina del sitio con meta claim-data tiene su claim correspondiente registrado en claims.json con fuente y extracto
  4. `npm run build` falla con mensaje claro si algun claim normativo/legal carece de extracto verbatim o hash
**Plans:** 2/2 plans complete

Plans:
- [x] 11-01-PLAN.md — Create merge script + generate unified claims.json
- [x] 11-02-PLAN.md — Update validate.js for claims.json enforcement

### Phase 12: Sheet Write
**Goal**: El Google Sheet refleja el estado completo del sitio — claims, datos regionales, y configuracion en una sola pestana auditable
**Depends on**: Phase 11
**Requirements**: SHEET-01, SHEET-02, SHEET-03, SHEET-04
**Success Criteria** (what must be TRUE):
  1. `node scripts/claims-to-sheet.js` ejecuta sin errores y crea/actualiza la pestana "Datos" en el Sheet
  2. La pestana "Datos" tiene una fila por afirmacion con las columnas: id, pregunta, respuesta, fuente_url, fuente_referencia, extracto_verbatim, hash, last_checked, status
  3. La misma pestana incluye filas para los 16 datos regionales y los campos de configuracion del ano escolar
  4. Editar el valor en la columna "respuesta" del Sheet produce un hash diferente al registrado, detectable automaticamente
**Plans:** 1/1 plans complete

Plans:
- [x] 12-01-PLAN.md — Create claims-to-sheet.js with JWT auth, data transformation, Sheet write, and --dry-run

### Phase 13: Sync Sheet → Pagina
**Goal**: El Google Sheet es la unica fuente de verdad — toda edicion humana en el Sheet se propaga automaticamente a las paginas publicadas
**Depends on**: Phase 12
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04
**Success Criteria** (what must be TRUE):
  1. `node scripts/sync-from-sheet.js` lee exclusivamente la pestana "Datos" y regenera claims.json, pages.json, y calendar-config.json
  2. `npm run generate` usa datos de claims.json para inyectar tooltips y contenido factual — no existe ningun dato hardcodeado en HTML
  3. El GitHub Action con cron diario ejecuta sync → generate → validate → deploy sin intervencion manual
  4. Editar un valor en la pestana "Datos" del Sheet, esperar el cron, y verificar que la pagina publicada refleja el cambio
**Plans:** 2 plans

Plans:
- [ ] 13-01-PLAN.md — Rewrite sync-from-sheet.js for Datos tab + update GitHub Action to daily cron
- [ ] 13-02-PLAN.md — Claims data injection in generate-pages.js + dynamic tooltips + E2E verification

### Phase 14: Notificaciones Telegram
**Goal**: El desarrollador recibe notificaciones de cambios BCN en Telegram con contexto suficiente para actuar sin revisar codigo
**Depends on**: Phase 13
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03
**Success Criteria** (what must be TRUE):
  1. `node scripts/notify-telegram.js` envia un mensaje al bot configurado cuando se detecta un cambio BCN
  2. El mensaje Telegram incluye: nombre del claim afectado, texto anterior vs nuevo, evaluacion IA del impacto, y link al Sheet
  3. check-bcn-changes.py ya no crea GitHub Issues — usa el script Telegram en su lugar
**Plans**: TBD

## Progress Table

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Pipeline Visual | v1.0 | 3/3 | Complete | 2026-03-24 |
| 2. Datos Completos | v1.0 | 2/2 | Complete | 2026-03-24 |
| 4. Mobile Responsiveness | v1.0 | 1/1 | Complete | 2026-03-24 |
| 5. Activacion de Produccion | v1.1 | 2/2 | Complete | 2026-03-25 |
| 8. BCN Legal Extractor | v1.2 | 1/1 | Complete | 2026-03-25 |
| 9. Change Detection Pipeline | v1.2 | 1/1 | Complete | 2026-03-25 |
| 10. UI Verificacion + Mapa Interactivo | v1.2 | 1/1 | Complete | 2026-03-25 |
| 11. Modelo de Datos Unificado | v1.3 | 2/2 | Complete    | 2026-03-25 |
| 12. Sheet Write | v1.3 | 1/1 | Complete    | 2026-03-25 |
| 13. Sync Sheet → Pagina | v1.3 | 0/2 | Not started | - |
| 14. Notificaciones Telegram | v1.3 | 0/? | Not started | - |

---
*Updated: 2026-03-25 — Phase 13 planned: 2 plans, 2 waves*
