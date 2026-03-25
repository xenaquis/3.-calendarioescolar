# calendarioescolar.cl — Extraccion Fidedigna + Datos Completos

## What This Is

Sitio utility chileno que entrega el calendario escolar 2026 por region. Extrae datos visualmente de PDFs oficiales del Mineduc (16 resoluciones regionales), los valida con checks deterministas, y los publica como paginas estaticas. Incluye datos extendidos (cierre actas, fin sin JEC/EPJA, dia profesor, inicio 2do semestre) en seccion colapsable.

## Core Value

Informacion 100% fidedigna extraida de las resoluciones oficiales de cada region, verificable visualmente contra los PDFs originales.

## Requirements

### Validated

- ✓ Calendario por region (16 regiones) con inicio, vacaciones, fiestas patrias, fin ano — v1
- ✓ Validacion de datos con checks deterministas (formato fecha, dia semana, ano) — v1
- ✓ Cross-region para detectar outliers — v1
- ✓ Landing pages SEO (vacaciones invierno, inicio clases) — v1
- ✓ Feriados con contexto escolar — v1
- ✓ Pipeline de extraccion visual: PDF → PNG → Claude Code multimodal → JSON verificado — v1.0
- ✓ PNGs de tablas preservados como evidencia visual publica — v1.0
- ✓ Verificacion determinista de extraccion (formato fecha, dia semana, ano, cross-region) — v1.0
- ✓ Datos completos por region: cierre actas 4 Medio, fin JEC/sin JEC/EPJA, dia del profesor, inicio 2do semestre — v1.0
- ✓ GA4 real configurado (G-6FVLKF6PFQ activo en todas las páginas) — v1.1
- ✓ og-image.png 1200×630px referenciada en todas las páginas — v1.1
- ✓ Landing feriados-2027.html creada y enlazada desde footer — v1.1
- ✓ Guía Search Console + GA4 connection documentada en BLUEPRINT.md — v1.1

### Active

<!-- Milestone v1.2 Validación Legal + Mapa Interactivo -->

- ✓ Extracción de artículos BCN XML por ley de feriado (Python), verbatim en JSON con hash + last_checked — v1.2 Phase 8
- [ ] Pipeline de detección de cambios: cron compara hash BCN actual vs guardado
- [ ] Alerta GitHub Issue cuando cambia artículo: diff + evaluación IA de impacto en afirmación
- [ ] Tooltip CSS sobre badge "Verificado" mostrando art. XX: "texto verbatim"
- [ ] Mapa: click en región abre panel con datos (MAP-02)
- [ ] Mapa: carga datos desde regions-data.js sin duplicar (MAP-04)
- [ ] Mapa: mobile — dropdown select + panel debajo (MAP-05)
- [ ] Bot Fight Mode activado en Cloudflare (documentación manual)

## Current Milestone: v1.2 Validación Legal + Mapa Interactivo

**Goal:** Respaldar cada afirmación de feriados con articulado legal verbatim de BCN.cl, detectar cambios automáticamente con alerta humana, y completar el mapa interactivo de regiones.

**Target features:**
- BCN Article Extractor (Python): parsea XML de 6 leyes de feriado, identifica artículos relevantes con Claude API, guarda verbatim + hash + last_checked
- Change Detection Pipeline: cron compara hash actual vs guardado; si cambia → Claude API evalúa impacto → GitHub Issue con diff + recomendación
- Tooltip "Verificado": CSS-only sobre badge de verificación, muestra art. XX inciso X: "texto verbatim" al hover/tap
- Mapa interactivo: completar MAP-02, MAP-04, MAP-05
- Bot Fight Mode: documentación para activar en Cloudflare dashboard

### Out of Scope

- Datos en tiempo real de colegios individuales — no es el proposito del sitio
- Notificaciones push a usuarios — complejidad innecesaria para sitio estatico
- Regimen trimestral detallado (fechas condicionales por tipo de receso) — demasiado complejo para el usuario promedio

## Context

- **v1.0 shipped (2026-03-24):** Pipeline visual completo + datos extendidos en 16 regiones
- **v1.1 shipped (2026-03-25):** GA4 activado + feriados-2027.html + guía Search Console
- **4 grupos de fechas regionales:** ESTANDAR (11 regiones), NORTE (Arica, Tarapaca), SUR (Aysen, Magallanes), SUR-PARCIAL (Los Lagos)
- **Tech stack:** Vanilla HTML/CSS/JS, Cloudflare Pages. Scripts: PyMuPDF (PNG), Node.js CommonJS (extraction, validation, generation)
- **Pipeline:** pdf-to-png.py → organize-snapshots.js → extract-visual.js → validate-extraction.js → populate-pages-json.js → generate-pages.js
- **Pending human actions:** Search Console verification, GA4↔Search Console connection (guía en BLUEPRINT.md)

## Constraints

- **Tech stack**: Vanilla HTML/CSS/JS, Cloudflare Pages, cero frameworks, cero node_modules
- **Extraccion**: PNGs con PyMuPDF, extraccion con Anthropic API multimodal
- **Verificacion final**: Siempre human-in-the-loop via Claude Code CLI antes de publicar
- **Frecuencia**: Extraccion anual (~noviembre cuando Mineduc publica)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Extraccion visual sobre texto plano | 6 PDFs son escaneos; tablas pierden estructura en texto plano; visual logra 100% | ✓ Validado v1.0 |
| finAno = fecha JEC (38 sem) | Consistencia: JEC es el regimen mayoritario. Sin JEC y EPJA se muestran como dato adicional | ✓ Good |
| Preservar PNGs como evidencia | Transparencia: 25 PNGs canonicos en data/snapshots/ con manifest | ✓ Implementado v1.0 |
| Datos completos en seccion colapsable | No prominente: `<details>` cerrado por defecto, 5 campos adicionales | ✓ Implementado v1.0 |
| Datos del pipeline, no hardcodeados | DATA-04: populate-pages-json.js lee visual-extraction.json, no valores manuales | ✓ Implementado v1.0 |
| GA4 ID en analytics.js con guard | Guard `indexOf('XXXX')` evita carga accidental con placeholder — real ID en config.json | ✓ v1.1 |
| feriados-2027.html sin claim-data | Página anticipatoria sin datos reales — no tiene meta claim-data para evitar falsos positivos en validación | ✓ v1.1 |
| Phase 6 (Seguridad) descartada | Scope evolucionó a verificación legal BCN.cl en v1.2 — enfoque más preciso que "validación genérica" | ✓ v1.1 → v1.2 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-03-25 after v1.1 Activacion & Calidad milestone archived*
