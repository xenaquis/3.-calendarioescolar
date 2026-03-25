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

### Active

<!-- Milestone v1.1 Activación & Calidad -->

- [ ] GA4 real configurado (reemplazar placeholder G-XXXXXXXXXX)
- [ ] Google Search Console verificado y con sitemap enviado
- [ ] OG Image creada (og-image.png 1200×630px — hoy referenciado pero no existe)
- [ ] Landing feriados-2027.html (captura temprana de búsquedas del año siguiente)
- [ ] Bot Fight Mode activado en Cloudflare (instrucciones + guía)
- [ ] Sistema de validación robusta implementado (4 fases de validacion/)
- [ ] Mapa: click en región abre panel con datos (MAP-02)
- [ ] Mapa: carga datos desde regions-data.js sin duplicar (PANEL-04)
- [ ] Mapa: mobile — dropdown select + panel debajo (RESP-02)

## Current Milestone: v1.1 Activación & Calidad

**Goal:** Activar servicios de medición, completar pendientes de producción, reforzar calidad de datos y terminar el mapa interactivo.

**Target features:**
- GA4 real (crear propiedad, reemplazar placeholder, deploy)
- Search Console (verificar, enviar sitemap, conectar GA4)
- OG Image (og-image.png 1200×630px)
- Landing feriados 2027
- Bot Fight Mode (Cloudflare)
- Validación robusta (4 fases)
- Mapa interactivo: completar MAP-02, PANEL-04, RESP-02

### Out of Scope

- Datos en tiempo real de colegios individuales — no es el proposito del sitio
- Notificaciones push a usuarios — complejidad innecesaria para sitio estatico
- Regimen trimestral detallado (fechas condicionales por tipo de receso) — demasiado complejo para el usuario promedio

## Context

- **v1.0 shipped (2026-03-24):** Pipeline visual completo + datos extendidos en 16 regiones
- **4 grupos de fechas regionales:** ESTANDAR (11 regiones), NORTE (Arica, Tarapaca), SUR (Aysen, Magallanes), SUR-PARCIAL (Los Lagos)
- **Tech stack:** Vanilla HTML/CSS/JS, Cloudflare Pages. Scripts: PyMuPDF (PNG), Node.js CommonJS (extraction, validation, generation)
- **Pipeline:** pdf-to-png.py → organize-snapshots.js → extract-visual.js → validate-extraction.js → populate-pages-json.js → generate-pages.js
- **Pending human verification:** collapsible section browser behavior, API-mode extraction, pdf-to-png.py --all

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

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-03-24 after v1.1 Activación & Calidad milestone start*
