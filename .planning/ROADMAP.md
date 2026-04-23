# Roadmap — calendarioescolar.cl

## Milestones

- ✅ **v1.0 Extraccion Fidedigna + Datos Completos** — Phases 1-4 (shipped 2026-03-24)
- ✅ **v1.1 Activacion & Calidad** — Phase 5 (shipped 2026-03-25)
- ✅ **v1.2 Validacion Legal + Mapa Interactivo** — Phases 8-10 (shipped 2026-03-25)
- ✅ **v1.3 Sheet como Fuente de Verdad Unica** — Phases 11-14 (shipped 2026-03-25)

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

<details>
<summary>✅ v1.3 Sheet como Fuente de Verdad Unica (Phases 11-14) — SHIPPED 2026-03-25</summary>

- [x] Phase 11: Modelo de Datos Unificado (2/2 plans) — completed 2026-03-25
- [x] Phase 12: Sheet Write (1/1 plan) — completed 2026-03-25
- [x] Phase 13: Sync Sheet → Pagina (2/2 plans) — completed 2026-03-25
- [x] Phase 14: Notificaciones Telegram (2/2 plans) — completed 2026-03-25

Full details: `.planning/milestones/v1.3-ROADMAP.md`

</details>

---

## Hotfix / Standalone Phases

- [x] **Phase 15: SEO Recovery v3** — Core Update response (3/3 plans) — completed 2026-04-23

### Phase 15: SEO Recovery v3 — Core Update Response

**Goal:** Re-posicionar el sitio como destination source (no aggregator) vía señales técnicas + contenido único diferenciador, revertiendo las regresiones SEO del refactor ce2835f y corrigiendo señales canónicas contradictorias.

**Causa raíz:** Google March 2026 Core Update movió visibilidad away from aggregators toward destination sources. calendarioescolar.cl cayó de ~3000 → ~5 impresiones/día.

| Plan | Wave | Scope |
|------|------|-------|
| 15-01 | 1 | B1 canonical+hreflang sin .html (4 landings) + B2 sitemap sin .html |
| 15-02 | 1 | B3 title revert + B4 H2+linkgraph + B5 stats bar + B6 dateModified |
| 15-03 | 2 | B7 regenerar + validar + BLUEPRINT.md update |

**Phase dir:** `.planning/phases/15-seo-recovery/`

---
*Updated: 2026-04-23 — Phase 15 SEO Recovery v3 planned*
