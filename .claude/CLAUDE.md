# calendarioescolar.cl — Instrucciones Claude Code

## Que es este proyecto
Sitio utility chileno: calendario escolar 2026 por region.
Arquetipo B (Catalogo Estatico) — paginas generadas desde JSON, sin API real-time.
Tecnologia: vanilla HTML/CSS/JS + Cloudflare Pages.

## Arquitectura
```
public/          -> Desplegado a Cloudflare Pages (HTML estatico)
data/            -> JSON fuente para generar paginas regionales
  pages.json     -> 16 regiones con fechas escolares
  template.html  -> Plantilla HTML para paginas de region
scripts/         -> Build, generacion de paginas
config.json      -> Configuracion del sitio
```

## Paginas del sitio
- **index.html** — Selector de region + resumen nacional + countdown
- **region/[slug]/index.html** (x16) — Calendario por region, generadas desde JSON
- **vacaciones-invierno-2026.html** — Landing SEO vacaciones de invierno
- **cuando-empiezan-clases-2026.html** — Landing SEO inicio de clases
- **about.html** — Fuentes (Mineduc)
- **contacto.html**, **privacidad.html** — Paginas legales

## Fuente de datos
- Ministerio de Educacion de Chile (Mineduc)
- Datos en data/pages.json, actualizacion anual (una vez al ano cuando Mineduc publica el calendario)

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
- `npm run dev` -> servidor local (wrangler pages dev)
- `npm run build` -> build + verificacion
- `npm run generate` -> generar paginas region/ desde data/pages.json + data/template.html
- `npm run deploy` -> deploy a Cloudflare Pages

## Fuente de verdad
El Google Sheet "Páginas Chicas — Control" es la fuente de verdad para estado,
tracking y decisiones. El ID del spreadsheet está en config.json → sheet.spreadsheetId.
Cada sitio tiene su propio tab en el Sheet.
Cualquier cambio de estado debe reflejarse en el Sheet.

## NO HACER
- No agregar dependencias npm
- No usar ES modules (import/export)
- No poner API keys en codigo frontend
- No modificar la estructura de tokens.css (solo valores)
- No crear archivos fuera de public/, data/, functions/, scripts/
- No usar Google Fonts (system-ui solamente)
