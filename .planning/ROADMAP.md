# Roadmap — calendarioescolar.cl

## Milestones

- ✅ **v1.0 Extraccion Fidedigna + Datos Completos** — Phases 1-2 (shipped 2026-03-24)
- **v1.1 Activacion & Calidad** — Phases 5-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 (Phases 1-2) — SHIPPED 2026-03-24</summary>

- [x] Phase 1: Pipeline Visual (3/3 plans) — completed 2026-03-24
- [x] Phase 2: Datos Completos (2/2 plans) — completed 2026-03-24

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ Phase 4: Mobile Responsiveness — SHIPPED 2026-03-24</summary>

- [x] Phase 4: Mobile Responsiveness (1/1 plans) — completed 2026-03-24

</details>

### v1.1 Activacion & Calidad

- [ ] **Phase 5: Activacion de Produccion** - GA4 real + GSC verificado + OG image + landing feriados 2027
- [ ] **Phase 6: Seguridad & Validacion** - Bot Fight Mode + sistema de validacion 4 fases + badges de transparencia
- [ ] **Phase 7: Mapa Interactivo** - Click en region abre panel, carga desde regions-data.js, mobile dropdown

## Phase Details

### Phase 5: Activacion de Produccion
**Goal**: El sitio esta completamente activo y medible en produccion — analytics reales, activos completos y contenido anticipatorio publicado
**Depends on**: Phase 4 (site funcionando en mobile)
**Requirements**: ANLYT-01, ANLYT-02, ANLYT-03, ASSET-01, SEO-01
**Success Criteria** (what must be TRUE):
  1. Al navegar el sitio, GA4 registra eventos reales en una propiedad propia (no G-XXXXXXXXXX)
  2. Google Search Console muestra la propiedad verificada con el sitemap enviado y conectado a GA4
  3. Al compartir cualquier URL del sitio en redes sociales, aparece una imagen previa (og-image.png 1200x630px con texto "Calendario Escolar Chile 2026")
  4. Existe public/feriados-2027.html accesible y correctamente enlazada, con contenido orientado a busquedas anticipadas del proximo ano
**Plans**: TBD
**UI hint**: yes

### Phase 6: Seguridad & Validacion
**Goal**: El sitio tiene proteccion contra bots y un sistema de validacion verificable que garantiza la honestidad de cada afirmacion publica
**Depends on**: Phase 5
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. El dashboard de Cloudflare muestra Bot Fight Mode activado para el dominio
  2. Cada pagina con datos factuales tiene meta claim-data y un registro correspondiente en afirmaciones.json — el build falla si hay data_keys sin claim
  3. check-sources.js verifica HTTP health de las fuentes oficiales (Mineduc) y reporta su estado
  4. verify-content.js ejecuta verificacion deterministica e IA de los claims declarados en afirmaciones.json
  5. Badges de transparencia son visibles en el frontend mostrando el estado de verificacion de los datos
**Plans**: TBD
**UI hint**: yes

### Phase 7: Mapa Interactivo
**Goal**: El usuario puede seleccionar cualquier region en el mapa y ver sus datos en un panel, tanto en desktop como en mobile
**Depends on**: Phase 5
**Requirements**: MAP-02, MAP-04, MAP-05
**Success Criteria** (what must be TRUE):
  1. Al hacer click en una region de la lista, el panel derecho muestra los key-facts y tabla adicional de esa region sin recargar la pagina
  2. Los datos del panel se cargan desde window.REGIONS_DATA (regions-data.js) — no hay datos duplicados en el HTML estatico
  3. En mobile (menos de 650px), el layout muestra un dropdown select de region y el panel de datos debajo, sin el layout split de desktop
**Plans**: TBD
**UI hint**: yes

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Pipeline Visual | 3/3 | Completed | 2026-03-24 |
| 2. Datos Completos | 2/2 | Completed | 2026-03-24 |
| 4. Mobile Responsiveness | 1/1 | Completed | 2026-03-24 |
| 5. Activacion de Produccion | 0/? | Not started | - |
| 6. Seguridad & Validacion | 0/? | Not started | - |
| 7. Mapa Interactivo | 0/? | Not started | - |

---
*Updated: 2026-03-24 — v1.1 phases 5-7 added*
