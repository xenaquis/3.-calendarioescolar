# calendarioescolar.cl — Instrucciones Claude Code

## ANTES DE CUALQUIER ACCION: Leer el Blueprint

El archivo `BLUEPRINT.md` en la raiz del proyecto es el contexto operativo del sitio.
Contiene: estado actual, bugs conocidos, deuda tecnica, fuentes de datos, pendientes.
**Leerlo siempre antes de actuar.** Actualizarlo con cada cambio importante.

## Que es este proyecto
Sitio utility chileno: calendario escolar 2026 por region.
Arquetipo B (Catalogo Estatico) — paginas generadas desde JSON, sin API real-time.
Tecnologia: vanilla HTML/CSS/JS + Cloudflare Pages.

## Arquitectura
```
public/                  -> Desplegado a Cloudflare Pages (HTML estatico)
data/
  pages.json             -> 16 regiones con fechas escolares (FUENTE DE VERDAD regional)
  calendar-config.json   -> Fechas del año escolar + feriados (FUENTE DE VERDAD temporal)
  template.html          -> Plantilla HTML para paginas de region
scripts/
  generate-pages.js      -> pages.json + calendar-config.json → HTML + JS + health.json
  validate.js            -> Valida integridad de datos (bloquea build si hay errores)
  check-feriados.js      -> Motor deterministico: recalcula feriados desde reglas legales
  build.sh               -> validate.js + check-feriados.js + verificaciones
.github/workflows/
  deploy.yml             -> push a main → build → deploy
  sync-deploy.yml        -> cron diario: check-feriados → generate → validate → deploy
config.json              -> Configuracion del sitio (IDs servicios)
```

## Paginas del sitio
- **index.html** — Key-facts, school-stats, chips selector de region, feriados
- **region/[slug]/index.html** (x16) — Calendario por region, generadas desde JSON
- **vacaciones-invierno-2026.html** — Landing SEO vacaciones de invierno
- **cuando-empiezan-clases-2026.html** — Landing SEO inicio de clases
- **about.html** — Fuentes (Mineduc)
- **contacto.html**, **privacidad.html** — Paginas legales

## Fuente de datos
- Repo git (fuente de verdad operativa): data/pages.json + data/calendar-config.json
- Mineduc Chile (fuente primaria, PDF anual ~noviembre) → pipeline extract-pdf.yml
- Actualizacion anual: editar los JSON (o pipeline PDF con --fix) → push a main deploya

## Cross-links
- dolaruf.cl (valor UF, UTM para multas)

## Colores
- Primary: #7c3aed (morado educacion)
- Accent: #2563eb (azul)

## Convenciones ESTRICTAS
- **CERO frameworks.** No React, Vue, Svelte, Tailwind, Bootstrap. Vanilla solamente.
- **CERO node_modules.** No instalar dependencias. Librerias solo via CDN.
- **CERO bundlers.** No webpack, vite, esbuild. Scripts con `defer` en HTML.
- JS: IIFE modules (no ES module imports). `var` para compatibilidad.
- CSS: custom properties en tokens.css. Mobile-first. BEM-lite para clases.
- HTML: semantico, accesible (WCAG AA), lang="es-CL".
- Naming: kebab-case archivos, camelCase JS, BEM CSS.

## Comandos
- `npm run dev`      -> servidor local (wrangler pages dev)
- `npm run generate` -> genera HTML + regions-data.js + calendar-config.js + health.json
- `npm run build`    -> validate.js + verificaciones de integridad (bloquea si hay errores)
- `npm run deploy`   -> deploy a Cloudflare Pages
- `node scripts/validate.js`        -> solo validacion de datos (exit 0=OK, 1=error)
- `node scripts/check-feriados.js`  -> verificacion deterministica de feriados (exit 0=OK, 1=discrepancia)
- `update-blueprint` -> No es un script — es una instruccion: actualizar BLUEPRINT.md despues de cada cambio importante

## Fuente de verdad
El repo git es la ÚNICA fuente de verdad: datos (data/*.json), estado y decisiones
(BLUEPRINT.md). El Google Sheet "Páginas Chicas — Control" fue ELIMINADO del sistema
en 2026-07 (milestone 362).

## Sistema de validacion de afirmaciones
- Cada pagina con datos factuales DEBE incluir `<meta name="claim-data" content="key1,key2,...">` listando los data_keys que consume.
- Cada data_key declarado DEBE tener un claim correspondiente en `data/afirmaciones.json`.
- El build falla si hay data_keys sin claim. Paginas sin meta (como privacidad.html) generan warning, no error.
- Al agregar una pagina nueva con datos factuales: agregar meta claim-data + registrar claims en afirmaciones.json.

## NO HACER
- No agregar dependencias npm
- No usar ES modules (import/export)
- No poner API keys en codigo frontend
- No modificar la estructura de tokens.css (solo valores)
- No crear archivos fuera de public/, data/, functions/, scripts/, validacion/
- No usar Google Fonts (system-ui solamente)
