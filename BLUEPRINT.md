# BLUEPRINT — calendarioescolar.cl

## LEE ESTO PRIMERO — contexto rapido para toda accion

Sitio utility chileno: calendario escolar 2026 por region.
Arquetipo B (Catalogo Estatico). Vanilla HTML/CSS/JS. Cloudflare Pages. Sin frameworks, sin bundlers, sin dependencias npm.
Ultimo update de este blueprint: 2026-06-12 (ESTRATEGIA FERIADOS post-análisis GSC: ver sección "Estrategia Feriados" abajo. FIX datos: feriadosCompletos 14→16 — faltaban 15-ago Asunción y 1-nov Todos los Santos; flag irrenunciable agregado. FIX legal hub: lista de irrenunciables estaba incorrecta. 12 páginas nuevas /feriados/[mes]-2026/ + /corpus-christi-2026 + feriados-2027 con fechas reales).

---

## Estado del sitio (actualizar en cada sesion)

| Item                  | Estado          | Notas                                              |
|-----------------------|-----------------|----------------------------------------------------|
| Dominio               | ACTIVO          | calendarioescolar.cl — HTTP 200 verificado 2026-03-17 |
| Cloudflare Pages      | ACTIVO          | Deploy via GitHub Actions — en producción          |
| DNS                   | ACTIVO          | Cloudflare DNS configurado y propagado             |
| GA4                   | ACTIVO          | ID `G-6FVLKF6PFQ` activo en todas las paginas (2026-03-24) |
| AdSense               | PENDIENTE       | Slots removidos del home. Script + ins en landings/regiones con ID `ca-pub-2859628961076196` (slots aún placeholders en esas páginas). Reactivar en home cuando AdSense apruebe slots reales. |
| Search Console        | PENDIENTE       | Verificar propiedad + enviar sitemap               |
| OG Image              | ACTIVO          | Archivo `public/icons/og-image.png` existe (verificado 2026-03-24) |
| Bot Fight Mode        | DOCUMENTADO     | Guia de activacion en seccion "Bot Fight Mode" abajo |
| Datos Mineduc 2026    | CORREGIDOS      | 2026-06-11: Aysén = 6-24 jul (REX 632 modifica REX 618). Magallanes 29 jun-17 jul. Los Lagos 6-17 jul. Arica/Tarapacá 13-24 jul. Inicio = 4 mar. Las resoluciones SE MODIFICAN durante el año — ver PDFs en data/resoluciones-modificatorias/ |
| Google Sheet Sync     | PENDIENTE       | Configurar: ver data/SHEET-SETUP.md                |
| Frontend              | COMPLETADO      | Auditoría 360° 2026-04-08: SVG dark mode fix, ads.css collapse, CSP fix (CF Insights + AdSense quality), hero padding, mini-fact/panel borders, zebra table, placeholder icon |
| Backend               | REFACTORIZADO   | Fechas centralizadas, validación, sync Sheet (2026-03-12) |
| SEO / Anti-IA         | COMPLETADO      | Auditoría 360° 2026-03-17: E-E-A-T, llms.txt, schemas, cache — commit 3df7917 |
| Validación Robusta    | 4 FASES + RAG   | Auditoría empírica 2026-03-18: fiabilidad B+ (82/100). Ver sección Validación abajo |
| RAG Pipeline          | OPERATIVO       | extract-from-pdf.js v3 (catalog-first) + OCR. Cron: 15 may + 31 dic. 11/16 regiones OK |
| Badges Honestos       | IMPLEMENTADO    | 5 estados: verde/rojo/ámbar/gris/amarillo. Info no verificada se flaggea visiblemente |
| BCN Legal Extractor   | OPERATIVO       | scripts/bcn-extractor.py — 15 claims con articulado verbatim en data/legal-articles.json (DeepSeek API). SHA256 hashes verificados. |
| GLM-OCR Local         | OPERATIVO       | scripts/glm-ocr-local.py — OCR local (Ollama). 108/112 campos = visual pipeline. Para dev/testing + cross-check. NO reemplaza CI. |

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
│   │   └── og-image.png            -> EXISTE — og-image.png 1200x630px presente (2026-03-24)
│   ├── health.json                 -> GENERADO — metadata para monitoreo automatico
│   └── sitemap.xml                 -> GENERADO por scripts/generate-pages.js
│
├── data/
│   ├── pages.json                  -> FUENTE DE VERDAD regional: 16 regiones, fechas por region
│   ├── calendar-config.json        -> FUENTE DE VERDAD temporal: fechas del año escolar, feriados
│   ├── template.html               -> Plantilla HTML para paginas de region (usa {{variables}})
│   ├── SHEET-SETUP.md              -> Instrucciones para configurar el Google Sheet
│   ├── FUENTES-VERDAD.md           -> Auditoría de fuentes oficiales, protocolo anual, riesgos
│   └── legal-articles.json         -> GENERADO por bcn-extractor.py — articulos verbatim de 15 claims feriado con SHA256
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
│   ├── bcn-extractor.py            -> Extrae articulos legales BCN.cl (4 leyes) → data/legal-articles.json con SHA256 + DeepSeek ID
│   ├── glm-ocr-local.py            -> OCR local (Ollama + GLM-OCR): extraccion sin API keys + cross-check vs pipeline visual
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

## Bot Fight Mode

Cloudflare Bot Fight Mode bloquea bots maliciosos conocidos (scrapers, credential stuffers) sin afectar crawlers legitimos de Google, Bing, etc.

### Activacion

1. Ir a [Cloudflare Dashboard](https://dash.cloudflare.com/) → seleccionar sitio `calendarioescolar.cl`
2. Navegacion: **Security** → **Bots**
3. En la seccion "Bot Fight Mode", hacer click en **Enable** (toggle ON)
4. Verificar que el toggle muestra estado activo (checkmark verde)

### Que hace

- Desafia con CAPTCHA o bloquea bots que coincidan con patrones maliciosos conocidos
- NO afecta a crawlers legitimos (Googlebot, Bingbot, etc.) — estos estan en allowlist de Cloudflare
- NO requiere configuracion adicional ni Workers
- Funciona automaticamente una vez activado

### Verificacion

- Dashboard → Security → Bots → Bot Fight Mode debe mostrar "On"
- Google Search Console debe seguir mostrando paginas indexadas normalmente
- En Analytics (Cloudflare) → Security → Overview: se pueden ver bots bloqueados

---

## Rediseño landing minimal (2026-04-17)

Home (`public/index.html`) simplificado a 3 bloques — feedback: demasiado ruido en landing.
Sketch ganador: `.planning/sketches/001-landing-layout/` variante A (single-card hero).

### Cambios

- **`<main>` reescrito:** hero (h1+sub) → `.feriado-card` (próximo feriado escolar, poblado por app.js) → `.region-picker` (`<select>` + result inline con inicio/vacaciones/fin + link a /region/{slug}/) → `.more-links` (links a feriados-2026, vacaciones, cuando-empiezan-clases).
- **Removido del home:** `.school-stats` bar, region chips + SVG map + panel de datos, tabla de feriados (ahora sólo en `/feriados-2026.html`), FAQ, cards "Consulta también" (movidas a `.more-links`), 3 ad slots AdSense.
- **AdSense removido del home:** `meta google-adsense-account`, `<script pagead2>`, `ads.css` link, `ads.js` reference, 3 `<ins.adsbygoogle>` blocks. Sigue activo en landings SEO + páginas de región hasta que AdSense apruebe slots reales.
- **Scripts eliminados del home:** `ads.js`, `claims-data.js`, `claims-tooltips.js`, `verificacion.js` (usados antes para badges BCN en tabla feriados). Home solo carga: theme.js, analytics.js, regions-data.js, calendar-config.js, app.js.
- **`app.js` reescrito:** dropped `initMapSelector`, `selectRegion`, `initSchoolStats`. Nuevas funciones: `initFeriadoCard` (computa próximo feriado en-clases desde `CAL.feriadosCompletos`) + `initRegionPicker` (select onchange popula result panel).
- **CSS nuevo en `components.css`:** `.landing-hero`, `.feriado-card` + sub-classes, `.region-picker` + sub-classes, `.region-result` + sub-classes, `.more-links`, `.container--narrow` (max-width 560px).
- **CSP fix:** agregado `https://ep2.adtrafficquality.google` a `script-src`, `script-src-elem`, `frame-src`, `connect-src` en `public/_headers` para permitir sodar2.js (AdSense quality detection).

### Preservado

- Todos los schemas JSON-LD en `<head>` (WebSite, Organization, Person, WebApplication, ItemList 16 regiones, FAQPage).
- Todo el SEO meta (canonical, hreflang, OG, Twitter, robots, claim-data).
- `<noscript>` fallback completo (16 regiones + fechas clave).
- `legal-notice` + `site-footer` + `verificacion-footer`.
- Dark mode toggle.
- GA4 tracking.

### Riesgo SEO

FAQPage schema conserva 3 preguntas. Contenido textual de FAQ ya no está en el DOM visible — pero sí en el schema + en las landings (`/cuando-empiezan-clases-2026.html`, `/vacaciones-invierno-2026.html`, `/feriados-2026.html`). Monitorear Search Console en próximas semanas.

---

## SEO Recovery post-refactor (2026-04-20)

### Problema detectado

Google Search Console reportó caída de **3500 → 10-20 impresiones diarias** tras el refactor del 17-abr. Causa: commit `ce2835f` removió ~300 líneas de contenido indexable del home (FAQ, tabla feriados, cards descriptivas, school-stats). FAQPage schema quedó sin pareo HTML visible → señal débil.

### Fix aplicado

**Above-the-fold** (minimal, preservado):
- Hero + feriado-card + region-picker sin cambios de layout

**Above-the-fold densificado**:
- `.hero-dates` — línea con fechas clave "Inicio **4 mar** · Vacaciones invierno **22 jun** · Fin **4 dic**" (scannable + CTR)
- `.hero-updated` — "Actualizado: abril 2026" (freshness signal)

**Below-the-fold** (recuperación SEO):
- `.more-cards` (reemplaza `.more-links`) — 3 cards con título + descripción de 1 línea hacia landings hijas
- `<section class="home-section">` Feriados en período escolar — tabla 6 filas + meta legal
- `<section class="home-section home-faq">` FAQ — 4 `<details open>` con contenido pareado al FAQPage schema

**Head optimizations (CTR)**:
- `<title>`: "Calendario Escolar 2026 Chile — Inicio 4 marzo · Vacaciones · Fin diciembre" (fechas concretas)
- `<meta description>`: accionable + "Actualizado abril 2026"
- OG + Twitter titles/descriptions sincronizados

**Schema.org agregados** al `@graph`:
- `Event` — año escolar 2026 (startDate 2026-03-04, endDate 2026-12-04, organizer Mineduc)
- `HowTo` — "Cómo consultar tu calendario escolar 2026" con 3 pasos
- `FAQPage` — 4ª pregunta añadida ("¿pueden los colegios cambiar las fechas?")

**CSS nuevo en `components.css`** (cache bust v3→v4):
- `.hero-dates`, `.hero-updated`
- `.more-cards`, `.more-card`, `.more-card__title`, `.more-card__desc`
- `.home-section`, `.home-section__intro`, `.home-section__meta`, `.home-section__cta`
- `.feriados-table` (zebra stripes, sin badges BCN)
- `.home-faq details` overrides

### Recovery esperado

- Impresiones: 50-70% en 2 semanas, ~100% en 4-6 semanas
- CTR: +20-40% vs pre-refactor si rich results Event/HowTo/FAQPage se activan

### Monitoreo

Revisar GSC semanalmente:
- Impresiones diarias del home (`/`) → objetivo 3000+ en 4 semanas
- Queries indexadas → objetivo recuperar long-tail tipo "cuándo empiezan las clases 2026", "corpus christi 2026", "vacaciones invierno chile"
- Appearance de rich results (FAQ, HowTo, Event) → GSC > Enhancements

---

## Estrategia Feriados (2026-06-12)

### Diagnóstico GSC (export 16-mar → 10-jun)
- Caída total persiste: 3.503 impr/día (14-abr) → 1-40/día desde 15-abr. 2 meses sin recuperación. Gates de escalación v3 fallaron todos.
- Demanda: vacaciones invierno 401 queries/18k impr (CTR 0,1% — canibalizado por AI Overview + prensa), calendario escolar 311/3k, **feriados 123 queries/803 impr con CTR 5-8% — el mejor del sitio**.
- Ya rankeábamos #1 esporádico en "feriados marzo 2026", "feriados mayo 2026", "feriados octubre 2026 chile" SIN página dedicada.
- Cluster "biblioteca del congreso nacional feriados 2026" (~45 impr) — nuestra ventaja BCN verbatim+SHA256.

### Competencia (revisada 2026-06-12)
- feriados.cl (#1): tabla estática única, sin meses, sin countdown. Gana por exact-match domain + antigüedad.
- feriados-chile.cl (#2), calendario.cl (widget próximo feriado), turismocity (countdown), feriadoslegales.cl (con errores).
- Prensa (T13, El Mostrador) publica "feriados de junio" mensual — dueños del freshness, contenido desechable.

### Apuesta: long-tail mensual + intención, NO head term
1. **12 páginas /feriados/[mes]-2026/** — generadas por `scripts/generate-feriados-mes.js` (módulo llamado desde generate-pages.js, template `data/template-mes.html`). Contenido curado por mes en MES_EXTRA (REVISAR ANUALMENTE): feriados + ¿hay clases? + finde largo + contexto regional (16-jul en 5 regiones de vacaciones; 8-dic vs fin JEC) + FAQ/FAQPage + claim-data meta.
2. **Hub /feriados-2026 robustecido**: 16 feriados, sección 6 findes largos, grid 12 meses, badge irrenunciable, botón imprimir + @media print, FAQ irrenunciables corregido.
3. **/corpus-christi-2026**: responde "NO es feriado" (70+ impr GSC sin respuesta directa en SERP). Claim `corpus-christi-no-feriado` con verificación determinística INVERSA (Pascua+60 debe estar AUSENTE de feriadosCompletos).
4. **/feriados-2027**: fechas reales calculadas según leyes (era thin content "próximamente" y listaba Corpus Christi como feriado vigente — corregido). 8 findes largos 2027. Traslados: San Pedro lun 28-jun, Dos Mundos lun 11-oct.

### Datos corregidos 2026-06-12
| Dato | Antes | Ahora |
|------|-------|-------|
| feriadosCompletos | 14 | **16** (+ Asunción sáb 15-ago, Todos los Santos dom 1-nov, ambos sin-impacto) |
| Irrenunciables | sin flag / FAQ INCORRECTO | flag `irrenunciable:true` en 1-ene, 1-may, 18-sep, 19-sep, 25-dic (Leyes 19.973 + 20.629) |
| Claims | 48 | 51 (feriado-asuncion-virgen, feriado-todos-los-santos, corpus-christi-no-feriado) — todos CORRECTO |
| FAQ schema hub | "7 feriados en clases" | 6 |
| Tabs hub | 15/7/8 | 16/6/10 |

### Auto-mantenimiento (2026-06-12) — página que se mantiene sola
- **Sync Google Sheet DESACTIVADO** en sync-deploy.yml (decisión usuario): el repo es la fuente de verdad. El Sheet quedó con los 14 feriados viejos y un sync los habría restaurado. `scripts/sync-from-sheet.js` sigue disponible para uso manual; si se reactiva, actualizar ANTES la celda feriadosCompletos del Sheet.
- **APIs de feriados evaluadas (2026-06-12): NINGUNA viable para CI.** apis.digital.gob.cl/fl/feriados muerta; feriadosapp.com/api redirige a api.boostr.cl; boostr está detrás de bot-protection Cloudflare (403 a curl/node). NO construir dependencias sobre estas APIs.
- **Solución: motor determinístico propio** — `scripts/check-feriados.js` recalcula los 16 feriados desde reglas legales codificadas (Pascua Meeus → VS/SS; traslados lunes Ley 19.668 para 29-jun/12-oct; traslado viernes Ley 20.299 para 31-oct; tabla solsticio Ley 21.357 2024-2028; irrenunciables 19.973/20.629) y compara contra calendar-config.json. Sin red, no flakea. Mutation-tested (detecta faltantes/sobrantes/Corpus/flags). Corre en build.sh (cada push) + workflow diario.
- **TABLA SOLSTICIO**: extender en check-feriados.js antes de cargar un año nuevo (falla a propósito si el año no está — fuerza verificación humana contra anexo Ley 21.357 BCN).
- Capas de auto-mantenimiento: (1) check determinístico diario, (2) monitor legal BCN semanal (workers/calendar-monitor, fechaVersion de leyes), (3) verify-content mensual (claims), (4) countdown próximo-feriado client-side (siempre fresco), (5) deploy diario (sitemap lastmod + próximo-feriado estático recalculado).
- Verificación pre-push 2026-06-12: enjambre 5 agentes Sonnet (45/47 checks PASS) + validador Opus → GO. Los 2 hallazgos eran falsos positivos inducidos por anotación errónea en afirmaciones.json (decía que 16-jul era irrenunciable; el texto BCN de la Ley 20.148 no contiene "irrenunciable") — corregida.

### Pendientes estrategia feriados
- [ ] Tras deploy: GSC Request Indexing en /feriados-2026, /feriados/junio-2026/, /feriados/julio-2026/, /corpus-christi-2026
- [ ] Monitorear 2-6 semanas: queries "feriados [mes] 2026" en GSC
- [ ] Cuestión de datos abierta: 8-dic marcado "en-clases" pero schoolEnd JEC = 4-dic (aplica a sin-JEC/EPJA/Aysén/Magallanes) — el contexto está explicado en /feriados/diciembre-2026/
- [ ] Evaluar página /proximo-feriado (queries "mañana es feriado", "próximo feriado") — countdown client-side ya existe en hub y páginas de mes
- [ ] verify-content.js: lógica de traslado San Pedro mueve sáb/dom a lunes, pero el verbatim Ley 19.668 solo traslada mar-jue/vie — irrelevante en 2026 (cae lunes), revisar antes de 2027

## Milestone 360 (2026-06-16) — Recuperación + monetización

Análisis 360 con swarm Sonnet (6 investigadores) + validadores Opus + GSC real + BrowserOS.
Detalle completo y backlog priorizado en `MILESTONE-360.md` (raíz). Cambios aplicados (rama `milestone-360`):

**Veracidad (prioridad del dueño):**
- Home "15 feriados" → **16** (era el único error factual visible, en la página de mayor PageRank).
- `llms.txt` reescrito: tenía datos **gravemente falsos** servidos a crawlers de IA (inicio 2-mar, vacaciones
  invierno invertidas, fin de año invertido, y **Corpus Christi listado como feriado** que suspende clases).
  Ahora coincide con `calendar-config.json` + FAQ del home.
- `claims.json` + `afirmaciones.json`: vacaciones de invierno "14/16 regiones" → **11** (5 excepciones
  regionales). NO se tocó el "14 regiones" de fin de año (ése es correcto: solo 2 excepciones). Regenerado.

**Consolidación SEO (sobre tráfico existente):**
- Enlaces internos `.html` → **pretty-URL** en todo el sitio (145 enlaces, 12 archivos) vía
  `scripts/normalize-internal-links.js`. Resuelve la doble indexación GSC (canonical/sitemap ya eran pretty).
- `_redirects`: 301 `.html` → pretty para las 10 páginas standalone indexadas.
- Home: nueva sección **"Feriados mes a mes 2026"** enlaza las 12 páginas `/feriados/[mes]-2026/` (eran
  huérfanas del home). Reusa `.region-index` (cero CSS nuevo).
- `feriados-2027` canonical/og/hreflang → pretty. `_headers`: regla cache `/feriados/*`.

**Freshness automática (cero mantenimiento):**
- `dateModified` de las 16 regiones ahora es `{{buildDate}}` (stampeado en cada deploy diario).
- Home: label visible "Actualizado: <mes> <año>" se autopobla desde `CALENDAR_CONFIG.generatedDate`
  (nuevo campo) en `app.js` → siempre fresco sin editar a mano. Meta/dateModified del home a junio 2026.

**Mantenimiento / robustez:**
- `generate-feriados-mes.js`: `DATA_KEY_BY_DATE` → `DATA_KEY_BY_NAME` (year-agnostic; evita que las claim-keys
  de las páginas de mes se rompan en silencio en 2027 al cambiar las fechas).
- `check-feriados.js`: aviso proactivo (no bloqueante) si falta el solsticio del año+1 en la tabla.
- `verify-content.yml`: `continue-on-error` en el commit (evita rojos espurios por conflicto de rebase).
- `ads.js`: ya **no** hace push de slots placeholder (`1234567890`, etc.) → protege la cuenta AdSense de
  requests a slots inexistentes. Solo carga AdSense si hay ≥1 slot real.

**Verificado:** `node scripts/generate-pages.js` + `check-feriados.js` (OK, 16 feriados) + `validate.js`
(Todo OK, 2 warnings benignos preexistentes). Home cargada en BrowserOS: sin errores de consola, grid de
meses + "16 feriados" + label de frescura OK.

**Pendiente (backlog Fase D en MILESTONE-360.md):** `/proximo-feriado` (countdown, cero mantenimiento);
`/efemerides-escolares-2026` (CTR 37%, **requiere fuente Mineduc verificada**); ancla Semana Santa en abril.
**Acción humana:** pegar slot IDs reales de AdSense; verificar "Always Use HTTPS" en Cloudflare; tras deploy
re-enviar sitemap + Request Indexing en GSC.

## SEO Recovery v3 — Core Update response (2026-04-23)

### Diagnóstico
Caída de 3000 → 5 impresiones/día (2026-04-13 → 2026-04-21). Posición 2.8 → 32.6.
Causa raíz: **Google March 2026 Core Update** (rollout 27-mar → 8-abr, tail 13-15 abril).
El update explícitamente movió visibilidad away from aggregators/utility pages toward destination sources.
calendarioescolar.cl es aggregator de datos Mineduc → target directo.

### Fixes aplicados
- **B1** Canonical + hreflang: 4 landings ahora apuntan a URL sin `.html` (alineado con pretty URLs Cloudflare).
- **B2** Sitemap: `scripts/generate-pages.js` emite `<loc>` sin `.html`.
- **B3** Title revert: "Calendario Escolar 2026 Chile — Fechas Oficiales por Región" (patrón ranker histórico).
- **B4** H2 semántico "¿De qué región eres?" + `<section class="region-index">` con 16 anchors a páginas región.
- **B5** `<section class="home-stats">` con semana escolar / días a vacaciones / feriados restantes (contenido único time-sensitive → señal destination-source).
- **B6** `dateModified` refrescado a 2026-04-23 en schemas + article:modified_time.

### Baseline 2026-04-23
- Impresiones: ~5/día
- Clicks: 0/día
- Posición promedio: 32.6
- Pages top (histórico pre-caída): `/vacaciones-invierno-2026` (14855 impr), `/` (9460 impr), `/feriados-2026` (1954 impr)
- Query motor: "vacaciones de invierno 2026" (7009 impr acumulado, pos 3.43 histórico)

### Gate de escalación
- **2026-04-30 (7d)**: ≥50 impr/día + pos <15 → recovery iniciándose.
- **2026-05-07 (14d)**: ≥500 impr/día + pos <10 → trayectoria OK.
- **2026-05-14 (21d)**: si sigue <200 impr/día → escalar:
  - Reintroducir tabla feriados con badges BCN SHA256 en home.
  - Considerar nueva landing "calendario-escolar-2026" como destination page con datos densos.
  - Revisar reversión parcial del refactor ce2835f.

### Track C manual pendiente (user)
- [ ] GSC → Security & Manual actions (descartar penalización)
- [ ] GSC → Pages coverage: exportar y revisar URLs "Crawled - not indexed" entre 10-21 abril
- [ ] GSC → URL Inspection en: `/`, `/vacaciones-invierno-2026`, `/feriados-2026`, top 3 regiones
- [ ] GSC → Sitemaps → re-submit `sitemap.xml` tras deploy
- [ ] GSC → URL Inspection → Request Indexing en las URLs top post-deploy
- [ ] Cloudflare Analytics → descartar spike 4xx/5xx entre 13-15 abril

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

### Herramienta local: GLM-OCR (no CI, solo dev/testing)

```
python scripts/glm-ocr-local.py                       # extract: 16 regiones via Ollama
python scripts/glm-ocr-local.py --region=aysen         # solo una region
python scripts/glm-ocr-local.py --crosscheck           # comparar OCR vs visual-extraction.json
python scripts/glm-ocr-local.py --dry-run              # ver que se procesaria
```

- Requiere: Ollama corriendo + modelo glm-ocr (`ollama pull glm-ocr`, 2.2GB)
- Salida extract: `data/glm-ocr-extraction.json` (validable con `node scripts/validate-extraction.js --input=data/glm-ocr-extraction.json`)
- Salida crosscheck: `data/glm-ocr-crosscheck.json` (discrepancias OCR vs LLM)
- Precision: 108/112 campos = pipeline visual (4 gaps por cobertura de snapshots, 0 discrepancias)
- NO reemplaza extract-visual.js en CI — Ollama no corre en GitHub Actions

**Regla**: editar datos SOLO en el Google Sheet (o en `data/pages.json` + `data/calendar-config.json` si se prefiere manual).
Las páginas en `public/region/` y `public/js/` son artefactos generados — nunca editar a mano.

---

## Bugs conocidos y deuda tecnica

### ~~BUG 4 — OG IMAGE FALTANTE~~ RESUELTO (2026-03-24)
- **Archivo**: `config.json` → referencia `https://calendarioescolar.cl/icons/og-image.png`
- **Fix**: El archivo `public/icons/og-image.png` existe y es referenciado correctamente.

### BUG 6 — IDS PLACEHOLDER EN config.json (PARCIALMENTE RESUELTO)
- **Archivo**: `config.json`
- **Problema original**: `ca-pub-XXXXXXXXXXXXXXXX` (AdSense) y `G-XXXXXXXXXX` (GA4) eran placeholders.
- **GA4**: RESUELTO (2026-03-24) — `G-6FVLKF6PFQ` activo en todas las paginas.
- **AdSense**: PENDIENTE — `ca-pub-XXXXXXXXXXXXXXXX` aun es placeholder (requiere cuenta AdSense aprobada).

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

4. ~~**Crear propiedad GA4**~~ COMPLETADO (2026-03-24) — ID `G-6FVLKF6PFQ` activo en todas las paginas

5. **Solicitar AdSense**
   - URL: https://www.google.com/adsense (requiere tráfico real primero)

6. **Verificar en Google Search Console**
   - Hacer después de tener dominio activo → subir sitemap

7. **Activar Bot Fight Mode en Cloudflare**

8. ~~**Crear og-image.png**~~ COMPLETADO — archivo `public/icons/og-image.png` existe (2026-03-24)

---

## Google Search Console & GA4 Connection

### Pasos para verificar Search Console

1. Ir a https://search.google.com/search-console
2. Click "Agregar propiedad" → seleccionar "Prefijo de URL" → ingresar `https://calendarioescolar.cl`
3. Verificar via DNS TXT record en Cloudflare:
   - Cloudflare Dashboard → DNS → Add Record → TXT
   - Name: `@`
   - Content: (copiar el valor de verificacion que entrega Google)
   - TTL: Auto
4. Esperar verificacion (puede tomar hasta 24h)
5. Una vez verificado, ir a Sitemaps → ingresar `sitemap.xml` → Enviar

### Pasos para conectar GA4 con Search Console

1. Ir a Google Analytics → Admin → Product Links → Search Console Links
2. Click "Link" → seleccionar la propiedad de Search Console verificada
3. Confirmar la conexion
4. Los datos de Search Console apareceran en GA4 bajo Acquisition → Search Console

### Estado actual

- GA4 ID: `G-6FVLKF6PFQ` (activo en todas las paginas)
- Search Console: pendiente verificacion manual
- Conexion GA4-GSC: pendiente (requiere Search Console verificado primero)

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
| Aysén vacaciones | 29 jun - 17 jul (REX 618 derogada) | **6 jul - 24 jul** (19 días) | **REX 632 de 22/12/2025** — calidad del aire Coyhaique (corregido 2026-06-11) |
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
