# calendarioescolar.cl — Extracción Fidedigna + Datos Completos

## What This Is

Sitio utility chileno que entrega el calendario escolar 2026 por región. Se actualiza solo: extrae datos de PDFs oficiales del Mineduc, los valida, y los publica. El objetivo es ser la fuente más confiable y completa de fechas escolares en Chile.

## Core Value

Información 100% fidedigna extraída de las resoluciones oficiales de cada región, verificable visualmente contra los PDFs originales.

## Requirements

### Validated

- ✓ Calendario por región (16 regiones) con inicio, vacaciones, fiestas patrias, fin año — v1
- ✓ Validación de datos con checks deterministas (formato fecha, día semana, año) — v1
- ✓ Cross-region para detectar outliers — v1
- ✓ Landing pages SEO (vacaciones invierno, inicio clases) — v1
- ✓ Feriados con contexto escolar — v1

### Active

- [ ] Pipeline de extracción visual: PDF → PNG → Claude Code multimodal → JSON verificado
- [ ] Datos completos por región: cierre actas 4° Medio, fin JEC/sin JEC/EPJA, día del profesor, inicio 2do semestre
- [ ] PNGs de tablas preservados como evidencia visual pública
- [ ] Verificación verbatim adaptada del extractor no determinista (fuzzy match contra fuente)

### Out of Scope

- Datos en tiempo real de colegios individuales — no es el propósito del sitio
- Notificaciones push a usuarios — complejidad innecesaria para sitio estático
- Régimen trimestral detallado (fechas condicionales por tipo de receso) — demasiado complejo para el usuario promedio

## Context

- **Hallazgo crítico (2026-03-24):** 5 de 16 regiones tenían datos incorrectos. El pipeline de texto plano no podía detectarlos porque: (a) 6 PDFs son escaneos sin texto extraíble, (b) las tablas pierden estructura al convertirse a texto plano.
- **Solución validada:** Extracción visual (PDF → PNG → lectura multimodal) logra 100% de precisión en las 16 regiones. Probado en esta sesión.
- **4 grupos de fechas regionales:** ESTÁNDAR (11 regiones), NORTE (Arica, Tarapacá: vacaciones julio), SUR (Aysén, Magallanes: receso extendido + fin año tardío), SUR-PARCIAL (Los Lagos: receso julio).
- **Pipeline actual** usa DeepSeek + pdftotext. Se reemplazará por PyMuPDF + visión multimodal + verificación determinista.

## Constraints

- **Tech stack**: Vanilla HTML/CSS/JS, Cloudflare Pages, cero frameworks, cero node_modules
- **Extracción**: Los PNGs deben generarse con PyMuPDF (ya disponible en el entorno)
- **Verificación final**: Siempre human-in-the-loop via Claude Code CLI antes de publicar
- **Frecuencia**: Extracción anual (~noviembre cuando Mineduc publica). Verificación manual post-extracción.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Extracción visual sobre texto plano | 6 PDFs son escaneos; tablas pierden estructura en texto plano; visual logra 100% | ✓ Validado en sesión |
| finAno = fecha JEC (38 sem) | Consistencia: JEC es el régimen mayoritario. Sin JEC y EPJA se muestran como dato adicional | ✓ Good |
| Preservar PNGs como evidencia | Transparencia: el usuario puede ver la fuente visual. Evaluable para publicar en el sitio | — Pending |
| Datos completos como milestone separado | No mezclar corrección de errores con features nuevas | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 after initialization*
