# BLUEPRINT — calendarioescolar.cl

## LEE ESTO PRIMERO — contexto rapido para toda accion

Sitio utility chileno: calendario escolar 2026 por region.
Arquetipo B (Catalogo Estatico). Vanilla HTML/CSS/JS. Cloudflare Pages. Sin frameworks, sin bundlers, sin dependencias npm.
Ultimo update de este blueprint: 2026-03-18 (auditoría empírica validadores + RAG pipeline + badges honestos).

---

## Estado del sitio (actualizar en cada sesion)

| Item                  | Estado          | Notas                                              |
|-----------------------|-----------------|----------------------------------------------------|
| Dominio               | ACTIVO          | calendarioescolar.cl — HTTP 200 verificado 2026-03-17 |
| Cloudflare Pages      | ACTIVO          | Deploy via GitHub Actions — en producción          |
| DNS                   | ACTIVO          | Cloudflare DNS configurado y propagado             |
| GA4                   | PENDIENTE       | ID placeholder `G-XXXXXXXXXX` en config.json       |
| AdSense               | PENDIENTE       | ID placeholder `ca-pub-XXXXXXXXXXXXXXXX` en config.json |
| Search Console        | PENDIENTE       | Verificar propiedad + enviar sitemap               |
| OG Image              | PENDIENTE       | Archivo `/icons/og-image.png` referenciado pero no existe |
| Bot Fight Mode        | PENDIENTE       | Activar en dashboard de Cloudflare                 |
| Datos Mineduc 2026    | CORREGIDOS      | Vacaciones invierno corregidas (jun-jul). Inicio clases = 4 mar. Fin = 4 dic. Aysén/Magallanes diferenciados |
| Google Sheet Sync     | PENDIENTE       | Configurar: ver data/SHEET-SETUP.md                |
| Frontend              | COMPLETADO      | Rediseño UX completado 2026-03-16                  |
| Backend               | REFACTORIZADO   | Fechas centralizadas, validación, sync Sheet (2026-03-12) |
| SEO / Anti-IA         | COMPLETADO      | Auditoría 360° 2026-03-17: E-E-A-T, llms.txt, schemas, cache — commit 3df7917 |
| Validación Robusta    | 4 FASES + RAG   | Auditoría empírica 2026-03-18: fiabilidad B+ (82/100). Ver sección Validación abajo |
| RAG Pipeline          | OPERATIVO       | extract-from-pdf.js v3 (catalog-first) + OCR. Cron: 15 may + 31 dic. 11/16 regiones OK |
| Badges Honestos       | IMPLEMENTADO    | 5 estados: verde/rojo/ámbar/gris/amarillo. Info no verificada se flaggea visiblemente |

---

## Arquitectura

```
/
├── public/                         -> Root del sitio estatico (Cloudflare Pages)
│   ├── index.html                  -> Homepage: school-stats, map layout selector (region list + data panel), feriados escolares
│   ├── feriados-2026.html          -> Landing feriados: tabla filtrable + timeline + FAQ (generada a mano)
│   ├── vacaciones-invierno-2026.html -> Landing SEO: fechas vacaciones por región
│   ├── cuando-empiezan-clases-2026.html -> Landing SEO: inicio de clases
│   ├── about.html
│   ├── contacto.html
│   ├── privacidad.html
│   ├── region/
│   │   └── [slug]/index.html (x16) -> GENERADAS — no editar a mano
│   ├── css/
│   │   ├── tokens.css              -> Variables CSS (colores, fuentes, espaciado) — NO TOCAR ESTRUCTURA
│   │   ├── base.css                -> Reset + estilos base
│   │   ├── components.css          -> Componentes: cards, tablas, badges, key-facts, school-stats, chips
│   │   └── ads.css                 -> Estilos para unidades AdSense — NO TOCAR ALTURAS (CLS)
│   ├── js/
│   │   ├── app.js                  -> Stats en tiempo real + chips selector + region selector
│   │   ├── regions-data.js         -> GENERADO — window.REGIONS_DATA (datos de regiones para app.js)
│   │   ├── calendar-config.js      -> GENERADO — window.CALENDAR_CONFIG (fechas año escolar para app.js)
│   │   ├── theme.js                -> Dark mode toggle
│   │   ├── ads.js                  -> Inicializacion AdSense
│   │   ├── analytics.js            -> Google Analytics init
│   │   └── export-image.js         -> Exportar tabla como imagen (solo paginas de region)
│   ├── icons/
│   │   └── og-image.png            -> FALTA — referenciado en HTML pero no existe (ver BUG 4)
│   ├── health.json                 -> GENERADO — metadata para monitoreo automatico
│   └── sitemap.xml                 -> GENERADO por scripts/generate-pages.js
│
├── data/
│   ├── pages.json                  -> FUENTE DE VERDAD regional: 16 regiones, fechas por region
│   ├── calendar-config.json        -> FUENTE DE VERDAD temporal: fechas del año escolar, feriados
│   ├── template.html               -> Plantilla HTML para paginas de region (usa {{variables}})
│   ├── SHEET-SETUP.md              -> Instrucciones para configurar el Google Sheet
│   └── FUENTES-VERDAD.md           -> Auditoría de fuentes oficiales, protocolo anual, riesgos
│
├── scripts/
│   ├── generate-pages.js           -> Lee pages.json + template.html + calendar-config.json
│   │                                  → escribe region/*/index.html + sitemap.xml
│   │                                  → escribe js/regions-data.js + js/calendar-config.js + health.json
│   ├── validate.js                 -> Valida integridad de datos antes de deploy (sale con 1 si hay errores)
│   ├── verify-content.js           -> Fase 3: verificación IA + determinística de claims (45 claims)
│   ├── generate-verificacion.js    -> Genera public/data/verificacion.json para badges frontend
│   ├── check-sources.js            -> Fase 2: HTTP health check de 6 fuentes oficiales
│   ├── extract-from-pdf.js         -> RAG pipeline v3: extrae datos de PDFs Mineduc (DeepSeek + OCR)
│   ├── sync-from-sheet.js          -> Lee Google Sheet via REST API → actualiza pages.json + calendar-config.json
│   └── build.sh                    -> Corre validate.js + verificaciones + cuenta archivos
│
├── .github/
│   └── workflows/
│       ├── deploy.yml              -> CI/CD: push a main → build → deploy a Cloudflare Pages
│       ├── sync-deploy.yml         -> Cron semanal + manual: sync Sheet → generate → validate → deploy
│       ├── verify-content.yml      -> Cron mensual: verificación IA + alerta Telegram si INCORRECTO
│       └── extract-pdf.yml         -> Cron bianual (15 may + 31 dic): RAG extracción PDFs Mineduc
│
├── validacion/                     -> Documentación del sistema de validación (4 fases)
│   ├── SISTEMA-MAESTRO.md          -> Blueprint del sistema completo
│   ├── FASE-1-registro-afirmaciones.md
│   ├── FASE-2-monitor-fuentes.md
│   ├── FASE-3-verificacion-contenido.md
│   └── FASE-4-transparencia-frontend.md
│
├── workers/
│   └── calendar-monitor/
│       ├── index.js                -> Cloudflare Worker: monitoreo automatico semanal
│       └── wrangler.toml           -> Config del worker (cron, KV binding)
├── config.json                     -> Config del sitio (URLs, IDs de servicios, AdSense, GA4, Sheet)
├── BLUEPRINT.md                    -> Este archivo
└── .claude/
    ├── CLAUDE.md                   -> Instrucciones para Claude Code
    └── skills/
        ├── deploy/SKILL.md
        ├── seo-audit/SKILL.md
        └── update-data/SKILL.md
```

---

## Rediseño UX en progreso (2026-03-16)

Metodología: debate de agentes especializados + premortem + enjambre supervisado por UI expert.
Prioridad: facilidad de búsqueda y lectura primero, estética segundo.

### Páginas completadas
- **index.html** ✓ — key-facts, school-stats, region chips, FAQ. Fix: card__meta grid-column 1/-1; stats fallback estático (sem 3 / 117 días / V.Santo); H2 región → "¿De qué región eres?"; FAQ sin h3 en summary
- **feriados-2026.html** ✓ — badge--civil/conmemorativo/clases con dark mode; timeline 8px; columna Tipo oculta en mobile; H2 simplificado
- **vacaciones-invierno-2026.html** ✓ — countdown primero en hero-sub; key-facts--2col; FAQ sin h3 en summary; footer Feriados 2026
- **cuando-empiezan-clases-2026.html** ✓ — countdown primero en hero-sub; FAQ sin h3 en summary; footer Feriados 2026
- **avisolegal.html** ✓ — footer Feriados 2026
- **about.html** ✓ — footer Feriados 2026
- **data/template.html + 16 páginas de región** ✓ — FAQ sin h3 en summary; regeneradas con npm run generate

### CSS modificado (components.css)
- `.key-facts .card__meta { grid-column: 1 / -1; }` — fuente Mineduc abarca fila completa
- `.key-facts--2col` — para páginas con solo 2 key-facts (vacaciones)
- `summary { font-size: var(--text-base); }` — explícito, sin depender del h3 interno

- **privacidad.html** ✓ — footer Feriados 2026

### Páginas pendientes (en orden)
- ninguna — rediseño UX completado 2026-03-16

### CSS modificado (components.css)
- `.key-fact__date`: text-xl → text-2xl
- `.key-fact--*`: fondos degradados tinted por variante
- `.hero-section`: nueva clase (gradiente + padding mínimo)
- Dark mode overrides para key-fact gradients y hero-section

---

## Diseño del frontend (post-rediseño 2026-03-12)

### Homepage (index.html) — estructura actual
1. Header sticky
2. H1 + hero-sub (fuente Mineduc)
3. **key-facts** — 4 tarjetas: Inicio clases | Vacaciones invierno | Fiestas Patrias | Fin año (color-coded)
4. **school-stats** — barra morada: Semana del año escolar | Días para vacaciones | Próximo feriado escolar
5. Ad banner (top)
6. **region-chips** — grid de 16 botones táctiles (reemplaza dropdown)
   - `<select id="region-select">` oculto para compatibilidad con app.js
   - `#region-calendar` + `#region-table-body` + `#region-link` (populated por app.js)
7. Ad rect (mid)
8. **Feriados en período escolar 2026** — tabla de 7 feriados que caen en días de clases (contenido único)
9. Cards links a landings (vacaciones, clases)
10. FAQ (4 preguntas en `<details>`)
11. Ad rect (bottom)
12. Footer

### Páginas de región (template.html → region/[slug]/index.html) — estructura actual
1. Header sticky
2. Breadcrumb
3. H1 + hero-sub
4. **key-facts** — 4 tarjetas con {{variables}} del pages.json (personalizadas por región)
5. Ad banner (top)
6. **Tabla calendario** — 3 columnas: Evento | Fechas | Días (id="tabla-region")
7. Botón descargar imagen (id="btn-descargar")
8. Ad rect (mid)
9. Info mínima (1 párrafo)
10. FAQ (3 preguntas en `<details>`)
11. Consulta también
12. Ad rect (bottom)
13. Footer

### Componentes CSS relevantes (components.css)
- `.key-facts` — grid 2col mobile, 4col desktop
- `.key-fact`, `.key-fact--primary/accent/warning/success` — tarjetas con borde izq coloreado
- `.school-stats` — barra morada con 3 stat-items
- `.stat-item`, `.stat-label`, `.stat-value`, `.stat-note`
- `.region-chips` — grid 2col/3col/4col según viewport
- `.chip` — botón táctil de región (aria-selected para estado activo)
- `.hero-sub` — subtítulo bajo H1

### IDs de DOM críticos (NO renombrar sin actualizar app.js / export-image.js)
| ID | Archivo | Usado por |
|----|---------|-----------|
| `#region-select` | index.html | app.js (initRegionSelector) |
| `#region-chips` | index.html | app.js (initRegionChips, querySelectorAll) |
| `#region-calendar` | index.html | app.js |
| `#region-title` | index.html | app.js |
| `#region-table-body` | index.html | app.js |
| `#region-link` | index.html | app.js |
| `#school-week` | index.html | app.js (initSchoolStats) |
| `#days-to-winter` | index.html | app.js (initSchoolStats) |
| `#next-holiday-name` | index.html | app.js (initSchoolStats) |
| `#next-holiday-days` | index.html | app.js (initSchoolStats) |
| `#tabla-region` | template.html (→ region pages) | export-image.js |
| `#btn-descargar` | template.html (→ region pages) | inline script |
| `#theme-toggle` | todos los HTML | theme.js |

### {{Placeholders}} del template (NO eliminar de data/template.html)
`{{title}}`, `{{description}}`, `{{region}}`, `{{regionSlug}}`, `{{slug}}`,
`{{inicio}}`, `{{vacacionesInicio}}`, `{{vacacionesFin}}`, `{{diasVacacionesInvierno}}`,
`{{fiestasPatriasInicio}}`, `{{fiestasPatriasFin}}`, `{{diasFiestasPatrias}}`, `{{finAno}}`

---

## Flujo de datos

```
Google Sheet (fuente de verdad — editar aquí)
      |
      v  (GitHub Action: sync-deploy.yml — cron lunes 06:00 UTC o trigger manual)
scripts/sync-from-sheet.js
      |
      |---> data/pages.json           (16 regiones con fechas)
      |---> data/calendar-config.json (fechas año escolar + feriados)
      |
      v  (npm run generate)
scripts/generate-pages.js
      |
      |---> public/region/[slug]/index.html  (x16 archivos)
      |---> public/sitemap.xml
      |---> public/js/regions-data.js        (window.REGIONS_DATA para app.js)
      |---> public/js/calendar-config.js     (window.CALENDAR_CONFIG para app.js)
      |---> public/health.json               (metadata para monitoreo)
      |
      v  (npm run build = scripts/build.sh)
      |   → scripts/validate.js (bloquea build si hay errores criticos)
      |   → actualiza fechas en sitemap.xml
      |   → verifica archivos y placeholders
      v
Cloudflare Pages (deploy)
```

**Regla**: editar datos SOLO en el Google Sheet (o en `data/pages.json` + `data/calendar-config.json` si se prefiere manual).
Las páginas en `public/region/` y `public/js/` son artefactos generados — nunca editar a mano.

---

## Bugs conocidos y deuda tecnica

### BUG 4 — OG IMAGE FALTANTE
- **Archivo**: `config.json` → referencia `https://calendarioescolar.cl/icons/og-image.png`
- **Problema**: El archivo `public/icons/og-image.png` no existe.
- **Fix pendiente**: Crear og-image.png (1200x630px). Diseño: fondo #7c3aed, texto blanco "Calendario Escolar 2026 Chile".

### BUG 6 — IDS PLACEHOLDER EN config.json
- **Archivo**: `config.json`
- **Problema**: `ca-pub-XXXXXXXXXXXXXXXX` (AdSense) y `G-XXXXXXXXXX` (GA4) son placeholders.
- **Fix pendiente**: Obtener IDs reales y actualizar config.json + todos los HTML.

### ~~BUG 9 — CORPUS CHRISTI INCORRECTO~~ RESUELTO (2026-03-12)
- **Archivos**: `data/calendar-config.json` + `public/index.html`
- **Problema**: Corpus Christi aparecía como "8 de junio" (dato copiado de 2023 sin recalcular)
- **Causa raíz**: Pascua 2023 = 9 abril → CC 2023 = 8 junio. Pascua 2026 = 5 abril → CC 2026 = **4 junio**
- **Fix**: Corregido a `2026-06-04` en calendar-config.json y "Jueves 4 de junio" en index.html
- **Prevención**: Calcular Corpus Christi con algoritmo Meeus/Jones/Butcher cada año (ver FUENTES-VERDAD.md)

### ~~BUG 1 — DATA DUPLICATION~~ RESUELTO (2026-03-12)
### ~~BUG 2 — ISO DATES~~ RESUELTO (2026-03-12)
### ~~BUG 3 — UNICODE ESCAPES~~ RESUELTO (2026-03-12)
### ~~BUG 5 — DEAD CODE api.js~~ RESUELTO (2026-03-12)
### ~~BUG 7 — COUNTDOWN~~ RESUELTO (2026-03-12)
### ~~BUG 8 — DEAD CODE countdown.js~~ RESUELTO (2026-03-12)
### ~~DEUDA — FECHAS HARDCODEADAS EN app.js~~ RESUELTO (2026-03-12)
- Todas las fechas del año escolar están en `data/calendar-config.json`
- `app.js` lee `window.CALENDAR_CONFIG` generado automáticamente
- Actualización anual = solo editar el Google Sheet

---

## Pendientes criticos (acciones manuales)

Estas acciones NO puede hacerlas Claude — requieren acceso humano a servicios externos.

1. ~~**Registrar dominio `calendarioescolar.cl`**~~ COMPLETADO — HTTP 200 verificado 2026-03-17

2. ~~**Configurar DNS en Cloudflare**~~ COMPLETADO — dominio en producción

3. **Configurar Google Sheet + API Key** ← SIGUIENTE
   - Seguir instrucciones en `data/SHEET-SETUP.md`
   - Agregar GitHub Secret: `GOOGLE_API_KEY`
   - Actualizar `config.json` → `sheet.spreadsheetId`

4. **Crear propiedad GA4**
   - URL: https://analytics.google.com → obtener ID `G-XXXXXXXXXX`
   - Reemplazar placeholder en config.json y en todos los HTML

5. **Solicitar AdSense**
   - URL: https://www.google.com/adsense (requiere tráfico real primero)

6. **Verificar en Google Search Console**
   - Hacer después de tener dominio activo → subir sitemap

7. **Activar Bot Fight Mode en Cloudflare**

8. **Crear og-image.png** (1200x630px, fondo #7c3aed, texto blanco)

---

## Fuentes de informacion

### Datos del calendario escolar

**FUENTE ÚLTIMA DE VERDAD:** `data/FUENTES-VERDAD.md` — leer antes de cualquier actualización de datos.

- **Mineduc portal centralizado**: `https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-{AÑO}/`
  - Portal de ayuda: `https://www.ayudamineduc.cl/ficha/calendarios-escolares-regionales`
  - PDFs regionales: `https://[region].mineduc.cl/wp-content/uploads/sites/[N]/YYYY/MM/...`
  - No hay API — requiere descarga manual del PDF + lectura humana
- **Diario Oficial** (fuente legal suprema): `https://www.diarioficial.cl/`
- **BCN — feriados** (texto legal): `https://www.bcn.cl/leychile/navegar?idNorma=22209`
- **FeriadosApp** (cross-validación): `https://www.feriadosapp.com/api`

### Actualizacion anual de datos — flujo optimizado (RAG-asistido)

**Automático** (GitHub Actions cron 31 dic):
1. RAG pipeline descarga PDFs regionales de Mineduc y extrae datos
2. Compara datos extraídos vs `pages.json` / `calendar-config.json`
3. Si hay discrepancias → alerta Telegram con detalle
4. Con `--fix` → auto-corrige datos y regenera páginas

**Manual** (revisión humana post-alerta o cada noviembre):
1. Verificar publicación en `https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-{AÑO+1}/`
2. Ejecutar RAG: `npm run extract-pdf` (o disparar workflow manual en GitHub)
3. Revisar `data/pdf-extraction-report.json` — verificar discrepancias
4. **Verificar Corpus Christi** con algoritmo Pascua (NO copiar del año anterior — bug histórico)
5. **Verificar San Pedro y San Pablo** (29 jun: si cae sáb/dom → mover al lunes)
6. **Verificar regiones sur** — Aysén y Magallanes tienen fechas diferentes (vacaciones extendidas)
7. Actualizar `data/calendar-config.json` + `data/pages.json` (o Google Sheet)
8. Actualizar **FAQ hardcodeadas** en `public/index.html` (texto dentro de `<details>`)
9. Actualizar **Schema.org JSON-LD** en `public/index.html` (fechas en `acceptedAnswer`)
10. `npm run generate` → `node scripts/validate.js` → `node scripts/verify-content.js`
11. Verificar `https://calendarioescolar.cl/health.json` → `dataYear` correcto
12. Actualizar año en landings estáticas: `vacaciones-invierno-{AÑO}.html`, `cuando-empiezan-clases-{AÑO}.html`

**Distinción importante PDF Mineduc:**
- "Inicio del año escolar" (2 mar) ≠ "Ingreso de estudiantes" (4 mar) — el sitio muestra **ingreso de estudiantes**
- "Último día clases JEC 38 sem" (4 dic) ≠ "Término año escolar" (31 dic) — el sitio muestra **último día clases JEC**

**Sin Google Sheet (fallback manual):**
Editar `data/pages.json` + `data/calendar-config.json` → `npm run generate` → `node scripts/validate.js` → deploy

### Monitoreo automatico — Calendar Monitor Worker
- **Archivo**: `workers/calendar-monitor/index.js` (v1.2.0)
- **Cron**: lunes 08:00 UTC (automatico via Cloudflare)
- **Test manual**: `GET https://calendar-monitor.TU_SUBDOMINIO.workers.dev/trigger?secret=X`
- **Health**: `GET https://calendar-monitor.TU_SUBDOMINIO.workers.dev/health`
- **Pendientes**: `GET https://calendar-monitor.TU_SUBDOMINIO.workers.dev/pending?secret=X`

Que monitorea:
1. `health.json` del sitio → dataYear correcto + generatedDate < 45 dias
2. Leyes de feriados via BCN XML API → compara `fechaVersion` del XML (= fecha publicacion en DO)
   - Solo alerta cuando hay modificacion legal real (no falsos positivos por ediciones editoriales)
   - Separa articulos transitorios → LLM identifica vigencia futura y baja urgencia si aplica
   - Alerta incluye numero de edicion DO para verificacion directa
3. Mineduc URL año siguiente → aparece = ESCALADA CRITICA inmediata

KV keys usadas: `law:LAWKEY:fecha-version` (antes era `:hash` — se inicializan solas en el primer run)

Deploy: ver seccion "Comandos utiles" abajo.

### Servicios del sitio
- Cloudflare Pages: https://dash.cloudflare.com
- Search Console: https://search.google.com/search-console
- Analytics: https://analytics.google.com

---

## Sistema de Validación — Auditoría empírica 2026-03-18

### Fiabilidad global: B+ (82/100)

Auditoría ejecutada con pruebas reales: inyección de fallos, verificación cruzada datos-claims,
cobertura HTML meta tags, freshness de resultados, y test de regresión.

### Componentes y calificación

| Componente | Archivo(s) | Grado | Score | Notas |
|-----------|------------|-------|-------|-------|
| Build gate (validate.js) | `scripts/validate.js` | **A** | 95/100 | Detectó 5/5 fallos inyectados. Bloquea deploy. |
| Content verifier (Fase 3) | `scripts/verify-content.js` | **B** | 78/100 | Bug hardcodeado "2 de marzo" corregido 2026-03-18. Cache puede enmascarar errores. |
| Claims registry | `data/afirmaciones.json` | **A-** | 88/100 | 45 claims, 6 fuentes. Campo `status` no sincronizado con results. |
| Source health (Fase 2) | `scripts/check-sources.js` | **B+** | 82/100 | 6 fuentes OK. Hashes BCN sospechosos (4 leyes = mismo hash). |
| Frontend badges (Fase 4) | `public/js/verificacion.js` | **B-** | 72/100 | Secciones `context`/`stats` sin badge en HTML. |
| RAG pipeline | `scripts/extract-from-pdf.js` | **C+** | 65/100 | 11/16 regiones OK. 5 requieren OCR (solo en CI). |
| Generate pipeline | `scripts/generate-pages.js` | **A** | 95/100 | Sin fallos. |

### Vulnerabilidades corregidas (2026-03-18)

1. ~~**Hardcoded "2 de marzo" en verify-content.js**~~ CORREGIDO — ahora lee `pages[0].inicio` dinámicamente
2. ~~**Badge `incorrecto` silencioso**~~ CORREGIDO — ahora muestra badge rojo "Discrepancia detectada"
3. ~~**Badge `unverified` engañoso**~~ CORREGIDO — ahora dice "Pendiente de verificación" (ámbar)
4. ~~**Sin badge cuando no hay fuente**~~ CORREGIDO — ahora muestra badge gris "Sin verificación independiente"
5. ~~**source_reference obsoleta en afirmaciones.json**~~ CORREGIDO — actualizada a "4 de marzo"

### Vulnerabilidades pendientes

| Prioridad | Vulnerabilidad | Impacto | Mitigación sugerida |
|-----------|---------------|---------|---------------------|
| ALTA | Cache no tiene TTL — resultados CORRECTO persisten indefinidamente | Bug en lógica de verificación se enmascara | Agregar TTL de 30 días al cache |
| ALTA | 4 leyes BCN con hash idéntico en source-health.json | Cambio en ley no se detectaría | Investigar si hash compara contenido correcto |
| MEDIA | 11 claims sin referencia en HTML (contextual/derived) | Si fallan, ningún badge lo refleja | Agregar `data-verificacion="context"` en páginas relevantes |
| MEDIA | Campo `status` en afirmaciones.json desincronizado | 32/45 dicen "unverified" pero verification-results dice CORRECTO | Agregar paso de sync post-verificación |
| BAJA | 5/16 regiones sin extracción OCR local | Solo verificable en CI (Ubuntu) | Aceptable — workflow tiene tesseract |

### Flujo de verificación completo

```
                     ┌─────────────────────────────────┐
                     │  Fuentes oficiales (Mineduc/BCN) │
                     └────────────┬────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
   ┌──────────┐           ┌──────────────┐         ┌─────────────┐
   │ Fase 2   │           │ RAG Pipeline │         │ Fase 1      │
   │ check-   │           │ extract-from │         │ afirmaciones│
   │ sources  │           │ -pdf.js (v3) │         │ .json       │
   │ (semanal)│           │ (bianual)    │         │ (45 claims) │
   └────┬─────┘           └──────┬───────┘         └──────┬──────┘
        │                        │                        │
        ▼                        ▼                        ▼
   source-health         pdf-extraction           ┌──────────────┐
   .json                 -report.json             │ Fase 3       │
        │                        │                │ verify-      │
        │                        │                │ content.js   │
        └────────────────┬───────┘                │ (mensual)    │
                         │                        └──────┬───────┘
                         ▼                               │
                  ┌──────────────┐                       ▼
                  │ validate.js  │              verification-
                  │ (cada push)  │              results.json
                  │ BUILD GATE   │                       │
                  └──────┬───────┘                       │
                         │                               │
                    PASS │ FAIL → deploy bloqueado       │
                         │                               │
                         ▼                               ▼
                  ┌──────────────────────────────────────────┐
                  │ generate-verificacion.js                  │
                  │ → public/data/verificacion.json           │
                  └────────────────┬─────────────────────────┘
                                   │
                                   ▼
                  ┌──────────────────────────────────────────┐
                  │ Frontend badges (verificacion.js)         │
                  │ ✓ Verde: verificado                       │
                  │ ⚠ Rojo: discrepancia detectada            │
                  │ ⏳ Ámbar: pendiente verificación           │
                  │ — Gris: sin verificación independiente    │
                  │ ⚠ Amarillo: fuente inaccesible            │
                  └──────────────────────────────────────────┘
```

### RAG Pipeline (extract-from-pdf.js v3 — catalog-first)

- **Arquitectura**: Descarga PDF → pdftotext (3 modos) → OCR fallback (tesseract) → DeepSeek catálogo → DeepSeek validación → checks determinísticos → análisis cross-regional
- **Regímenes**: Distingue semestral vs trimestral en cada PDF
- **Hitos extraídos**: Inicio año escolar, Ingreso estudiantes, Receso invierno, Fiestas Patrias, Último día clases (JEC/no-JEC), Término año escolar
- **Workflow**: `.github/workflows/extract-pdf.yml` — cron 15 mayo + 31 diciembre 14:00 UTC + manual
- **Inputs**: `--fix` (auto-corregir), `--region=slug`, `--force` (re-descargar)
- **Estado actual**: 11/16 regiones con texto extraído. 5 regiones (Tarapacá, Atacama, Ñuble, Biobío, Araucanía) requieren OCR disponible solo en CI

### Datos Mineduc corregidos 2026-03-18

| Dato | Valor anterior (erróneo) | Valor correcto | Fuente |
|------|-------------------------|----------------|--------|
| winterStart | 2026-07-11 | **2026-06-22** | Resolución Mineduc reg. semestral |
| winterEnd | 2026-07-25 | **2026-07-03** | Resolución Mineduc reg. semestral |
| schoolStart | 2026-03-02 | **2026-03-04** | "Ingreso de estudiantes" (no "Inicio año escolar") |
| schoolEnd | 2026-12-11 | **2026-12-04** | "Último día clases JEC 38 sem" |
| Aysén vacaciones | standard | **29 jun - 17 jul** (19 días) | Resolución regional diferenciada |
| Magallanes vacaciones | standard | **29 jun - 17 jul** (19 días) | Resolución regional diferenciada |
| Aysén fin año | 4 dic | **23 dic** | Resolución regional |
| Magallanes fin año | 4 dic | **11 dic** | Resolución regional |

---

## SEO — Estado post-auditoría 2026-03-17

### Anti-canibalización IA (COMPLETO)
- `public/robots.txt` — 50+ bots bloqueados (OpenAI, Anthropic, Google-Extended, DeepSeek, xAI/Grok, Cohere, CCBot, ByteDance, Perplexity, Amazon, Apple, Meta, + 8 nuevos 2026)
- `public/llms.txt` (NUEVO) — archivo de citación controlada; LLMs pueden citar con atribución obligatoria
- `public/_headers` — `X-Robots-Tag: noai, noimageai` (HTTP header layer) + cache strategy por tipo
- Meta robots `noai, noimageai` en todas las páginas HTML

### E-E-A-T / Author markup (COMPLETO, invisible en UI)
- Person schema: Carlos Sánchez Rossi → LinkedIn (`cl.linkedin.com/in/csanchezrossi`) + Google Scholar
  - `worksFor`: Dirección de Estudios, Corte Suprema → Poder Judicial de Chile
  - `alumniOf`: UC Berkeley School of Law
- Presente en: `index.html` (Person + Organization founder), `about.html` (AboutPage + Person), todas las páginas vía `@id` reference
- **No aparece en el UI** — solo en JSON-LD structured data

### Schemas enriquecidos (COMPLETO)
- `index.html`: WebSite + Organization + **Person** + WebApplication + **ItemList (16 regiones)** + FAQPage
- `data/template.html` → 16 regiones: BreadcrumbList + **Article (author/publisher/dates)** + Event (endDate + eventStatus) + FAQPage
- Landing pages: BreadcrumbList + **Article (author/dates)** + FAQPage
- `about.html`: BreadcrumbList + **AboutPage** + Organization + **Person**

### Twitter cards (COMPLETO)
- Agregadas a: `vacaciones-invierno-2026.html`, `cuando-empiezan-clases-2026.html`, `data/template.html`
- `article:published_time`, `article:modified_time`, `article:author`, `article:tag` en todas las landing pages

### Sitemap (COMPLETO)
- `changefreq` agregado: weekly (home), monthly (regiones + contenido), yearly (legal)
- `feriados-2026.html`: prioridad 0.3 → 0.8
- `scripts/generate-pages.js` actualizado para propagar changefreq en builds futuros

### Cache strategy `_headers` (COMPLETO)
- HTML: `max-age=3600, stale-while-revalidate=86400`
- CSS/JS: `max-age=2592000, immutable`
- Icons: `max-age=31536000, immutable`
- HSTS preload agregado

### Noscript fallback (COMPLETO)
- `index.html`: bloque `<noscript>` con 16 regiones + fechas clave en texto plano para crawlers sin JS

### Cloudflare Pretty URLs (ACTIVO — comportamiento esperado)
Cloudflare Pages redirige `.html` → sin extensión con 308 Permanent Redirect:
- `/vacaciones-invierno-2026.html` → `/vacaciones-invierno-2026` (308 → 200)
- `/feriados-2026.html` → `/feriados-2026` (308 → 200)
- `/about.html` → `/about` (308 → 200)
- Regiones `/region/slug/` y homepage `/` → 200 directo (sin redirect)
- **Impacto SEO**: positivo — Google indexa la URL limpia y el 308 es permanente
- **Canonical tags**: apuntan a `.html` pero Google las resuelve correctamente via 308
- **Robots.txt, sitemap.xml, llms.txt, health.json** → 200 directo

### Robots.txt en producción
Cloudflare prepende su propia sección "Managed Content" con `Content-Signal: search=yes,ai-train=no` antes de nuestro robots.txt. Efecto: **doble capa de protección anti-training**. No requiere acción.

### Pendiente SEO (requiere acción humana)
- Google Search Console: verificar propiedad + enviar sitemap.xml
- OG Image: crear `public/icons/og-image.png` 1200×630px (fondo #7c3aed, texto blanco)
- Core Web Vitals: verificar con PageSpeed Insights post-deploy

---

## Skills disponibles

| Skill       | Archivo                               | Uso                                |
|-------------|---------------------------------------|------------------------------------|
| deploy      | `.claude/skills/deploy/SKILL.md`      | Deploy a Cloudflare Pages          |
| seo-audit   | `.claude/skills/seo-audit/SKILL.md`   | Auditoría SEO del sitio            |
| update-data | `.claude/skills/update-data/SKILL.md` | Actualizar datos del calendario    |

Para invocar un skill: escribir `/deploy`, `/seo-audit`, `/update-data` en el chat.

---

## Comandos utiles

```bash
npm run dev             # Servidor local en localhost (wrangler pages dev)
npm run generate        # Genera todo: HTML, sitemap, regions-data.js, calendar-config.js, health.json
npm run build           # Valida datos + verificaciones de integridad
npm run deploy          # Deploy a Cloudflare Pages

node scripts/validate.js          # Solo validación de datos (0=OK, 1=error)
node scripts/verify-content.js    # Verificación Fase 3 (determinística + IA). Con FORCE_ALL=true recalcula todo
node scripts/sync-from-sheet.js   # Solo sync desde Sheet (requiere GOOGLE_API_KEY env var)
npm run extract-pdf               # RAG: extrae datos de PDFs Mineduc (requiere DEEPSEEK_API_KEY)
npm run verify-pdf                # RAG: solo PDFs locales (--local)

# Calendar Monitor Worker (desde workers/calendar-monitor/)
cd workers/calendar-monitor
npx wrangler kv namespace create CALENDAR_KV    # 1. Crear KV → anotar ID → pegar en wrangler.toml
npx wrangler secret put DEEPSEEK_API_KEY        # 2. API key DeepSeek
npx wrangler secret put MONITOR_SECRET          # 3. Contraseña para /trigger
npx wrangler secret put ALERT_WEBHOOK_URL       # 4. Webhook alertas (o TELEGRAM_*)
npx wrangler deploy                             # 5. Deploy
# Test: curl "https://calendar-monitor.TU.workers.dev/trigger?secret=TU_SECRET"
```

`update-blueprint` — No es un script. Es una instrucción: actualizar este archivo después de cada cambio importante al sitio.

---

## Checklist antes de deploy

- [ ] `data/pages.json` tiene datos correctos y completos para las 16 regiones
- [ ] `data/calendar-config.json` tiene fechas del año escolar correcto
- [ ] Se corrió `npm run generate` después del último cambio
- [ ] `node scripts/validate.js` pasa sin errores (warnings de placeholder son OK)
- [ ] `public/js/calendar-config.js` fue regenerado
- [ ] `public/js/regions-data.js` fue regenerado
- [ ] `public/health.json` fue regenerado
- [ ] Las landings estáticas tienen el año correcto en title/H1
- [ ] No hay IDs placeholder visibles en el HTML final (GA4, AdSense)
- [ ] `npm run build` pasa sin errores
- [ ] Sitemap en `public/sitemap.xml` fue regenerado
- [ ] OG image existe en `public/icons/og-image.png`
- [ ] No se introdujeron dependencias npm ni imports ES module
- [ ] CSS nuevo usa variables de `tokens.css`, no valores hardcodeados
- [ ] HTML nuevo tiene `lang="es-CL"`, meta charset, meta viewport
- [ ] Dark mode verificado (toggle ☽/☀️ funciona visualmente)
- [ ] Todos los IDs críticos de DOM presentes (ver tabla en sección Diseño del frontend)
- [ ] Todos los {{placeholders}} intactos en data/template.html
