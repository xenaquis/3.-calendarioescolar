# BLUEPRINT — calendarioescolar.cl

## LEE ESTO PRIMERO — contexto rapido para toda accion

Sitio utility chileno: calendario escolar 2026 por region.
Arquetipo B (Catalogo Estatico). Vanilla HTML/CSS/JS. Cloudflare Pages. Sin frameworks, sin bundlers, sin dependencias npm.
Ultimo update de este blueprint: 2026-03-12 (auditoría de fuentes + corrección Corpus Christi + FUENTES-VERDAD.md).

---

## Estado del sitio (actualizar en cada sesion)

| Item                  | Estado          | Notas                                              |
|-----------------------|-----------------|----------------------------------------------------|
| Dominio               | PENDIENTE       | calendarioescolar.cl — registrar en nic.cl (~$18 USD) |
| Cloudflare Pages      | Configurado     | Deploy via GitHub Actions                          |
| DNS                   | PENDIENTE       | Requiere dominio primero                           |
| GA4                   | PENDIENTE       | ID placeholder `G-XXXXXXXXXX` en config.json       |
| AdSense               | PENDIENTE       | ID placeholder `ca-pub-XXXXXXXXXXXXXXXX` en config.json |
| Search Console        | PENDIENTE       | Verificar tras registrar dominio                   |
| OG Image              | PENDIENTE       | Archivo `/icons/og-image.png` referenciado pero no existe |
| Bot Fight Mode        | PENDIENTE       | Activar en dashboard de Cloudflare                 |
| Datos Mineduc 2026    | Cargados        | En data/pages.json + data/calendar-config.json — Corpus Christi corregido 2026-03-12 |
| Google Sheet Sync     | PENDIENTE       | Configurar: ver data/SHEET-SETUP.md                |
| Frontend              | REDISEÑADO      | Minimalista utility-first (2026-03-12)             |
| Backend               | REFACTORIZADO   | Fechas centralizadas, validación, sync Sheet (2026-03-12) |

---

## Arquitectura

```
/
├── public/                         -> Root del sitio estatico (Cloudflare Pages)
│   ├── index.html                  -> Homepage: key-facts, school-stats, chips selector de región, feriados escolares
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
│   ├── sync-from-sheet.js          -> Lee Google Sheet via REST API → actualiza pages.json + calendar-config.json
│   └── build.sh                    -> Corre validate.js + verificaciones + cuenta archivos
│
├── .github/
│   └── workflows/
│       ├── deploy.yml              -> CI/CD: push a main → build → deploy a Cloudflare Pages
│       └── sync-deploy.yml         -> Cron semanal + manual: sync Sheet → generate → validate → deploy
│
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

1. **Registrar dominio `calendarioescolar.cl`**
   - URL: https://www.nic.cl | Costo: ~$18 USD/año | Requiere RUT chileno

2. **Configurar DNS en Cloudflare**
   - Después de registrar dominio, apuntar nameservers a Cloudflare

3. **Configurar Google Sheet + API Key** ← NUEVO
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

### Actualizacion anual de datos (cada noviembre) — flujo optimizado

1. Detectar publicación en `https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-{AÑO+1}/`
2. Descargar PDFs regionales → extraer fechas de las 16 regiones
3. **Verificar Corpus Christi** con algoritmo Pascua (NO copiar del año anterior — bug histórico)
4. **Verificar San Pedro y San Pablo** (29 jun: si cae sáb/dom → mover al lunes)
5. **Verificar qué otros feriados** (Pueblos Indígenas, Asunción, Iglesias Evangélicas) caen en días de clases ese año
6. **Actualizar tab "Regiones"** del Google Sheet
7. **Actualizar tab "Config"** del Google Sheet (year, fechas, feriados)
8. Actualizar **FAQ hardcodeadas** en `public/index.html` (texto dentro de `<details>`)
9. Actualizar **Schema.org JSON-LD** en `public/index.html` (fechas en `acceptedAnswer`)
10. Disparar GitHub Action **"Sync desde Sheet + Deploy"** manualmente (o esperar al lunes)
11. Verificar `https://calendarioescolar.cl/health.json` → `dataYear` correcto
12. Actualizar año en landings estáticas: `vacaciones-invierno-{AÑO}.html`, `cuando-empiezan-clases-{AÑO}.html`

**Sin Google Sheet (fallback manual):**
Editar `data/pages.json` + `data/calendar-config.json` → `npm run generate` → `node scripts/validate.js` → deploy

### Monitoreo automatico por agente
- `GET https://calendarioescolar.cl/health.json`
- Verificar: `status: "ok"`, `dataYear` correcto, `generatedDate` reciente (< 30 días)
- Si `dataYear` incorrecto: actualización pendiente → notificar humano
- **Octubre-enero**: monitorear `https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-{AÑO+1}/`
  → Si la página aparece con PDFs → ESCALADA HUMANA INMEDIATA

### Servicios del sitio
- Cloudflare Pages: https://dash.cloudflare.com
- Search Console: https://search.google.com/search-console
- Analytics: https://analytics.google.com

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

node scripts/validate.js        # Solo validación de datos (0=OK, 1=error)
node scripts/sync-from-sheet.js # Solo sync desde Sheet (requiere GOOGLE_API_KEY env var)
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
