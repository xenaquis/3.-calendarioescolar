# Roadmap — calendarioescolar.cl

## Milestones

- ✅ **v1.0 Extraccion Fidedigna + Datos Completos** — Phases 1-2 (shipped 2026-03-24)
- [ ] **v1.1 Mapa Interactivo** — Phases 3-4

## Phases

<details>
<summary>✅ v1.0 (Phases 1-2) — SHIPPED 2026-03-24</summary>

- [x] Phase 1: Pipeline Visual (3/3 plans) — completed 2026-03-24
- [x] Phase 2: Datos Completos (2/2 plans) — completed 2026-03-24

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### v1.1 Mapa Interactivo

- [ ] **Phase 3: Region Selector + Panel** - Lista de regiones con colores + panel de datos en layout desktop
- [ ] **Phase 4: Mobile Responsiveness** - Dropdown fallback + panel vertical en mobile

## Phase Details

### Phase 3: Region Selector + Panel
**Goal**: Users can browse all 16 regions in a color-coded list and instantly see full calendar data for any region in a side panel, on desktop
**Depends on**: Nothing (regions-data.js already has all data)
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, PANEL-01, PANEL-02, PANEL-03, PANEL-04, RESP-01
**Success Criteria** (what must be TRUE):
  1. User sees a list of 16 regions ordered north to south, each with a color dot indicating its group (Estandar, Norte, Sur-Parcial, Sur)
  2. User clicks any region and the right panel immediately shows that region's key-facts (inicio, vacaciones, fiestas patrias, fin ano) without a page reload
  3. The active region is visually highlighted in the list so the user knows which region they are viewing
  4. A legend below or near the list explains what each color represents
  5. User can click "Ver pagina completa" in the panel and land on the correct /region/[slug]/ page
**Plans**: TBD
**UI hint**: yes

### Phase 4: Mobile Responsiveness
**Goal**: Users on mobile can select a region via a native dropdown and see the data panel stacked below it
**Depends on**: Phase 3
**Requirements**: RESP-02
**Success Criteria** (what must be TRUE):
  1. On a screen narrower than 650px the region list is replaced by a native select dropdown, and the data panel appears below it
  2. Selecting a region in the dropdown populates the panel with the same data shown on desktop
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 3. Region Selector + Panel | 0/? | Not started | - |
| 4. Mobile Responsiveness | 0/? | Not started | - |

---
*Updated: 2026-03-24 — v1.1 roadmap created*
