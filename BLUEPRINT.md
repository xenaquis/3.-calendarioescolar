# BLUEPRINT — calendarioescolar.cl

## LEE ESTO PRIMERO — contexto rapido para toda accion

Sitio utility chileno: calendario escolar 2026 por region.
Arquetipo B (Catalogo Estatico). Vanilla HTML/CSS/JS. Cloudflare Pages. Sin frameworks, sin bundlers, sin dependencias npm.
Ultimo update de este blueprint: 2026-03-12 (rediseño frontend minimalista completo).

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
| Datos Mineduc 2026    | Cargados        | En data/pages.json — verificar cada noviembre      |
| Frontend              | REDISEÑADO      | Minimalista utility-first (2026-03-12)             |

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
│   │   ├── app.js                  -> Stats en tiempo real (semana, días vacaciones, feriado) + chips selector + region selector
│   │   ├── regions-data.js         -> GENERADO — window.REGIONS_DATA (datos de regiones para app.js)
│   │   ├── countdown.js            -> DEAD CODE — ya no se carga en ningun HTML (ver BUG 8)
│   │   ├── theme.js                -> Dark mode toggle
│   │   ├── ads.js                  -> Inicializacion AdSense
│   │   ├── analytics.js            -> Google Analytics init
│   │   ├── export-image.js         -> Exportar tabla como imagen (solo paginas de region)
│   │   └── api.js                  -> DEAD CODE — archivo huerfano (ver BUG 5)
│   ├── icons/
│   │   └── og-image.png            -> FALTA — referenciado en HTML pero no existe (ver BUG 4)
│   └── sitemap.xml                 -> GENERADO por scripts/generate-pages.js
│
├── data/
│   ├── pages.json                  -> FUENTE DE VERDAD de contenido: 16 regiones, fechas
│   └── template.html               -> Plantilla HTML para paginas de region (usa {{variables}})
│
├── scripts/
│   └── generate-pages.js           -> Lee pages.json + template.html → escribe region/*/index.html + sitemap.xml + js/regions-data.js
│
├── .github/
│   └── workflows/
│       └── deploy.yml              -> CI/CD: push a main → build → deploy a Cloudflare Pages
│
├── config.json                     -> Config del sitio (URLs, IDs de servicios, AdSense, GA4)
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
data/pages.json
      |
      v
scripts/generate-pages.js   (npm run generate)
      |
      |---> public/region/[slug]/index.html  (x16 archivos)
      |---> public/sitemap.xml
      |---> public/js/regions-data.js        (window.REGIONS_DATA para app.js)
```

**Regla**: editar datos SOLO en `data/pages.json`, luego correr `npm run generate`.
Las paginas en `public/region/` y `public/js/regions-data.js` son artefactos generados — nunca editar a mano.

---

## Bugs conocidos y deuda tecnica

### ~~BUG 1 — DATA DUPLICATION~~ RESUELTO (2026-03-12)
- generate-pages.js ahora genera `public/js/regions-data.js` con `window.REGIONS_DATA`
- app.js usa `var REGIONS = window.REGIONS_DATA || {}` — sin duplicacion

### ~~BUG 2 — ISO DATES TRIPLICADAS~~ RESUELTO PARCIALMENTE (2026-03-12)
- El countdown fue eliminado de homepage y páginas de región
- Las fechas ISO del array EVENTS en app.js fueron eliminadas con el rediseño
- **Deuda residual**: las fechas en `initSchoolStats()` y el array `FERIADOS` en app.js están hardcodeadas como `new Date(2026, ...)`. Requieren actualización manual cada año escolar junto con `data/pages.json`.

### ~~BUG 3 — UNICODE ESCAPES EN app.js~~ RESUELTO (2026-03-12)

### BUG 4 — OG IMAGE FALTANTE
- **Archivo**: `config.json` → referencia `https://calendarioescolar.cl/icons/og-image.png`
- **Problema**: El archivo `public/icons/og-image.png` no existe.
- **Fix pendiente**: Crear og-image.png (1200x630px). Diseño: fondo #7c3aed, texto blanco "Calendario Escolar 2026 Chile".

### BUG 5 — DEAD CODE api.js
- **Archivo**: `public/js/api.js`
- **Problema**: No se carga en ningún HTML. Es código huérfano.
- **Fix pendiente**: Eliminar el archivo.

### BUG 6 — IDS PLACEHOLDER EN config.json
- **Archivo**: `config.json`
- **Problema**: `ca-pub-XXXXXXXXXXXXXXXX` (AdSense) y `G-XXXXXXXXXX` (GA4) son placeholders.
- **Fix pendiente**: Obtener IDs reales (ver Pendientes Críticos) y actualizar config.json + todos los HTML.

### ~~BUG 7 — COUNTDOWN SOLO FECHAS NACIONALES~~ RESUELTO (2026-03-12)
- El countdown fue eliminado del homepage y páginas de región con el rediseño.

### BUG 8 — DEAD CODE countdown.js (NUEVO, post-rediseño 2026-03-12)
- **Archivo**: `public/js/countdown.js`
- **Problema**: El rediseño eliminó el countdown de todas las páginas. El archivo existe pero ya NO se carga en ningún HTML.
- **Fix pendiente**: Eliminar `public/js/countdown.js`. No hay `<script src>` que remover.
- **Nota**: Si en el futuro se quiere reintroducir un countdown, el archivo está bien implementado (acepta cualquier ID y fecha).

### ~~DEUDA TECNICA — TIMEZONE app.js~~ RESUELTA (2026-03-12)
- El array EVENTS con fechas ISO fue eliminado del rediseño. Ya no aplica.
- **Nueva nota**: `initSchoolStats()` usa `new Date(2026, mes, dia)` (hora local del browser). Es aceptable para cálculos de días. No requiere timezone explícito.

---

## Pendientes criticos (acciones manuales)

Estas acciones NO puede hacerlas Claude — requieren acceso humano a servicios externos.

1. **Registrar dominio `calendarioescolar.cl`**
   - URL: https://www.nic.cl
   - Costo: ~$18 USD/año
   - Requisito: RUT chileno del titular
   - Prioridad: ALTA — sin dominio no hay sitio

2. **Configurar DNS en Cloudflare**
   - Después de registrar el dominio en nic.cl, apuntar nameservers a Cloudflare
   - Cloudflare dashboard: https://dash.cloudflare.com

3. **Crear propiedad GA4**
   - URL: https://analytics.google.com
   - Obtener ID `G-XXXXXXXXXX`
   - Reemplazar placeholder en config.json y en todos los HTML

4. **Solicitar AdSense**
   - URL: https://www.google.com/adsense
   - Requiere tráfico real primero (meses de indexación)
   - Cuando se apruebe: reemplazar `ca-pub-XXXXXXXXXXXXXXXX` en config.json y HTML

5. **Verificar en Google Search Console**
   - URL: https://search.google.com/search-console
   - Hacer después de tener dominio activo y DNS configurado
   - Subir sitemap: `https://calendarioescolar.cl/sitemap.xml`

6. **Activar Bot Fight Mode en Cloudflare**
   - URL: https://dash.cloudflare.com → sitio → Security → Bots

7. **Crear og-image.png**
   - Tamaño: 1200x630px
   - Diseño: fondo #7c3aed, texto blanco "Calendario Escolar 2026 Chile"
   - Guardar en: `public/icons/og-image.png`

---

## Fuentes de informacion

### Datos del calendario escolar
- **Mineduc oficial**: https://www.mineduc.cl → Documentos → Calendario Escolar
  - Buscar "Resolución Exenta" del año correspondiente (publicada ~noviembre)
  - No hay API — requiere descarga manual del PDF
- **Skill disponible**: `.claude/skills/update-data/SKILL.md`

### Actualizacion anual de datos (cada noviembre)
1. Descargar PDF Mineduc → extraer fechas de las 16 regiones
2. Actualizar `data/pages.json`
3. Actualizar fechas hardcodeadas en `public/js/app.js`:
   - `var schoolStart`, `var winterStart`, `var winterEnd`, `var schoolEnd` en `initSchoolStats()`
   - Array `FERIADOS` con los nuevos feriados del año escolar
4. Correr `npm run generate`
5. Verificar páginas de región (especialmente Aysén y Magallanes)
6. Actualizar año en todos los `<title>`, `<meta description>`, H1, Schema.org, sitemap
7. Deploy

### Servicios del sitio
- Cloudflare Pages dashboard: https://dash.cloudflare.com
- Google Search Console: https://search.google.com/search-console
- Google Analytics: https://analytics.google.com

### Cross-links (sitios hermanos)
- dolaruf.cl — valor UF y UTM para multas (mismo ecosistema "Paginas Chicas")

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
npm run dev       # Servidor local en localhost (wrangler pages dev)
npm run build     # Build + verificación de integridad
npm run generate  # Genera public/region/*/index.html + sitemap.xml + regions-data.js desde data/pages.json + data/template.html
npm run deploy    # Deploy a Cloudflare Pages
```

`update-blueprint` — No es un script. Es una instrucción: actualizar este archivo después de cada cambio importante al sitio.

---

## Checklist antes de deploy

- [ ] `data/pages.json` tiene datos correctos y completos para las 16 regiones
- [ ] Se corrió `npm run generate` después del último cambio a pages.json o template.html
- [ ] `public/js/regions-data.js` fue regenerado (se genera automáticamente con `npm run generate`)
- [ ] Las fechas en `app.js` (initSchoolStats, FERIADOS) corresponden al año escolar vigente
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
