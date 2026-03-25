# Retrospective — calendarioescolar.cl

## Milestone: v1.1 — Activacion & Calidad

**Shipped:** 2026-03-25
**Phases:** 1 (Phase 5 only) | **Plans:** 2 | **Tasks:** 5
**Timeline:** 1 día (2026-03-24 → 2026-03-25)

### What Was Built

- GA4 measurement ID `G-6FVLKF6PFQ` activado en 25 archivos HTML (antes era placeholder inerte)
- `feriados-2027.html` — landing anticipatoria SEO con estructura completa, enlazada desde footer y sitemap
- Guía paso a paso de Search Console + conexión GA4↔GSC documentada en BLUEPRINT.md
- Confirmación de og-image.png existente (1200×630px)

### What Worked

- **Autonomía del workflow GSD:** discuss → plan → execute en una sola sesión sin intervención
- **Parallel execution:** Los planes 05-01 y 05-02 corrieron en paralelo (worktrees) sin conflictos
- **Guard de placeholder:** `analytics.js` ya tenía `indexOf('XXXX')` — la activación fue solo reemplazar el ID
- **Checkpoint apropiado:** El plan delegó la verificación de dashboard a un human-verify checkpoint, no intentó automatizar lo no automatizable

### What Was Inefficient

- **Scope original demasiado ambicioso:** v1.1 inició con 3 fases (activación + seguridad + mapa). En práctica, solo Phase 5 tenía sentido en este momento — las otras 2 requerían más diseño
- **Phase 6 completamente rediseñada:** El scope de "validación genérica" evolucionó a "verificación legal BCN.cl" antes de empezar — debió haberse definido mejor en los requirements
- **Search Console manual inevitable:** Los requisitos ANLYT-02 y ANLYT-03 siempre iban a ser manuales — el sistema los marcó como "complete" en código aunque la acción real es del usuario post-deploy

### Patterns Established

- **BLUEPRINT.md como fuente de verdad operativa:** Pasos manuales de infraestructura (Search Console, Cloudflare) van ahí, no en el código
- **Páginas anticipatorias sin claim-data:** feriados-2027.html tiene estructura completa pero no meta claim-data — correcto para páginas sin datos verificables aún
- **v1.x scope pequeño:** Milestones de activación/calidad se resuelven mejor con 1-2 fases concretas en vez de 3+ ambiciosas

### Key Lessons

1. **Separar activación de nuevas features:** "Activar GA4" y "construir mapa interactivo" tienen naturaleza diferente — mejor en milestones separados
2. **Phase 6 prematura:** El sistema de validación necesitaba más definición antes de planificarse — bien en dejarlo para v1.2 con arquitectura BCN.cl
3. **Deploy vía CI/CD confirma flujo correcto:** Push → GitHub Actions → Cloudflare Pages funciona sin intervención local

### Cost Observations

- Modelo: claude-sonnet-4-6 (orchestrator + executors)
- Sesiones: 1
- Notable: El workflow autónomo (discuss → plan → execute) funcionó en una sola sesión continua

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Duration | Efficiency |
|-----------|--------|-------|----------|------------|
| v1.0 | 3 | 6 | 1 día | Alta — scope bien definido |
| v1.1 | 1 (de 3 planeadas) | 2 | 1 día | Media — scope redujo durante ejecución |
