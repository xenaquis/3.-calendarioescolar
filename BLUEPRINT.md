# BLUEPRINT — calendarioescolar.cl

## LEE ESTO PRIMERO — contexto rapido para toda accion

Sitio utility chileno: calendario escolar 2026 por region.
Arquetipo B (Catalogo Estatico). Vanilla HTML/CSS/JS. Cloudflare Pages. Sin frameworks, sin bundlers, sin dependencias npm.
Ultimo update de este blueprint: 2026-03-12.

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

---

## Arquitectura

```
/
├── public/                         -> Root del sitio estatico (Cloudflare Pages)
│   ├── index.html                  -> Homepage: selector de region, resumen, countdown
│   ├── vacaciones-invierno-2026.html
│   ├── cuando-empiezan-clases-2026.html
│   ├── about.html
│   ├── contacto.html
│   ├── privacidad.html
│   ├── region/
│   │   └── [slug]/index.html (x16) -> GENERADAS — no editar a mano
│   ├── css/
│   │   ├── tokens.css              -> Variables CSS (colores, fuentes, espaciado)
│   │   ├── base.css                -> Reset + estilos base
│   │   ├── components.css          -> Componentes reutilizables
│   │   └── ads.css                 -> Estilos para unidades AdSense
│   ├── js/
│   │   ├── app.js                  -> Logica homepage (countdown, selector region)
│   │   ├── regions-data.js         -> GENERADO — window.REGIONS_DATA (datos de regiones para app.js)
│   │   └── api.js                  -> DEAD CODE — archivo huerfano, no se carga en ningun HTML
│   ├── icons/
│   │   └── og-image.png            -> FALTA — referenciado en config.json pero no existe
│   └── sitemap.xml                 -> GENERADO por scripts/generate-pages.js
│
├── data/
│   ├── pages.json                  -> FUENTE DE VERDAD de contenido: 16 regiones, fechas
│   └── template.html               -> Plantilla HTML para paginas de region
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
- index.html carga regions-data.js antes de app.js

### ~~BUG 3 — UNICODE ESCAPES EN app.js~~ RESUELTO (2026-03-12)
- Reemplazados `\u00f3`, `\u00ed`, `\u2014` etc. con UTF-8 real en app.js

### BUG 2 — ISO DATES TRIPLICADAS
- **Archivos**: `public/js/app.js` (array EVENTS), cada `public/region/[slug]/index.html` (fechas inline), `data/pages.json` (NO las tiene)
- **Problema**: Las fechas ISO para el countdown existen en app.js y en el HTML de cada region, pero NO en pages.json. Actualizar el calendario requiere cambiar tres lugares.
- **Fix pendiente**: Agregar fechas ISO a pages.json, que generate-pages.js las inyecte en el HTML, y que app.js las lea desde regions-data.js (ver BUG 1).

### BUG 4 — OG IMAGE FALTANTE
- **Archivo**: `config.json` → referencia `https://calendarioescolar.cl/icons/og-image.png`
- **Problema**: El archivo `public/icons/og-image.png` no existe. Las previsualizaciones en redes sociales y mensajeria mostraran imagen rota.
- **Fix pendiente**: Crear og-image.png (1200x630px). Diseno: fondo morado #7c3aed, texto blanco "Calendario Escolar 2026 Chile".

### BUG 5 — DEAD CODE api.js
- **Archivo**: `public/js/api.js`
- **Problema**: El archivo existe en el directorio pero NO se carga en ningun HTML. Es codigo huerfano.
- **Fix pendiente**: Eliminar el archivo. No hay `<script>` tags que remover.

### BUG 6 — IDS PLACEHOLDER EN config.json
- **Archivo**: `config.json`
- **Problema**: `ca-pub-XXXXXXXXXXXXXXXX` (AdSense) y `G-XXXXXXXXXX` (GA4) son placeholders. El sitio no reporta analytics ni sirve ads.
- **Fix pendiente**: Obtener IDs reales (ver Pendientes Criticos) y actualizar config.json + todos los HTML que los usan inline.

### BUG 7 — COUNTDOWN SOLO FECHAS NACIONALES
- **Archivo**: `public/js/app.js`
- **Problema**: El countdown de la homepage usa fechas nacionales (11 jul, 11 dic). Aysen y Magallanes tienen fechas distintas (4 jul, 4 dic). Impacto menor: la homepage muestra todas las regiones, no es un contador personalizado.
- **Fix pendiente**: Opcional. Si se agrega selector de region al countdown, usar la fecha correcta por region.

### DEUDA TECNICA — TIMEZONE app.js
- **Archivo**: `public/js/app.js`, array EVENTS
- **Nota**: Julio usa `-04:00` (correcto, invierno Chile), marzo usa `-03:00` (correcto, verano Chile). Es correcto pero no esta documentado en el codigo. Agregar comentario explicativo.

---

## Pendientes criticos (acciones manuales)

Estas acciones NO puede hacerlas Claude — requieren acceso humano a servicios externos.

1. **Registrar dominio `calendarioescolar.cl`**
   - URL: https://www.nic.cl
   - Costo: ~$18 USD/anio
   - Requisito: RUT chileno del titular
   - Prioridad: ALTA — sin dominio no hay sitio

2. **Configurar DNS en Cloudflare**
   - Despues de registrar el dominio en nic.cl, apuntar nameservers a Cloudflare
   - Cloudflare dashboard: https://dash.cloudflare.com
   - Crear CNAME o A record apuntando al proyecto de Cloudflare Pages

3. **Crear propiedad GA4**
   - URL: https://analytics.google.com
   - Obtener ID `G-XXXXXXXXXX`
   - Reemplazar placeholder en config.json y en todos los `<script>` de GA4 en HTML

4. **Solicitar AdSense**
   - URL: https://www.google.com/adsense
   - Requiere trafico real primero (meses de indexacion)
   - Cuando se apruebe: reemplazar `ca-pub-XXXXXXXXXXXXXXXX` en config.json y HTML

5. **Verificar en Google Search Console**
   - URL: https://search.google.com/search-console
   - Hacer despues de tener dominio activo y DNS configurado
   - Subir sitemap: `https://calendarioescolar.cl/sitemap.xml`

6. **Activar Bot Fight Mode en Cloudflare**
   - URL: https://dash.cloudflare.com → sitio → Security → Bots
   - Activar "Bot Fight Mode" (gratis)

7. **Crear og-image.png**
   - Tamano: 1200x630px
   - Diseno sugerido: fondo #7c3aed, texto blanco "Calendario Escolar 2026 Chile"
   - Guardar en: `public/icons/og-image.png`

---

## Fuentes de informacion

### Datos del calendario escolar
- **Mineduc oficial**: https://www.mineduc.cl → Documentos → Calendario Escolar
  - Buscar "Resolucion Exenta" del ano correspondiente (publicada ~noviembre)
  - No hay API — requiere descarga manual del PDF
  - El PDF contiene las fechas para todas las regiones
- **Skill disponible**: `.claude/skills/update-data/SKILL.md` (revisar, puede necesitar pasos Mineduc-especificos)

### Actualizacion anual de datos
- Cada noviembre, Mineduc publica el calendario del proximo ano
- Pasos: descargar PDF → extraer fechas → actualizar `data/pages.json` → `npm run generate` → verificar → deploy

### Servicios del sitio
- Cloudflare Pages dashboard: https://dash.cloudflare.com
- GitHub repo: revisar config en `.github/workflows/deploy.yml`
- Google Search Console: https://search.google.com/search-console
- Google Analytics: https://analytics.google.com

### Cross-links (sitios hermanos)
- dolaruf.cl — valor UF y UTM para multas (mismo ecosistema "Paginas Chicas")

---

## Skills disponibles

| Skill                    | Archivo                              | Uso                                    |
|--------------------------|--------------------------------------|----------------------------------------|
| deploy                   | `.claude/skills/deploy/SKILL.md`     | Deploy a Cloudflare Pages              |
| seo-audit                | `.claude/skills/seo-audit/SKILL.md`  | Auditoria SEO del sitio                |
| update-data              | `.claude/skills/update-data/SKILL.md`| Actualizar datos del calendario        |

Para invocar un skill: escribir `/deploy`, `/seo-audit`, `/update-data` en el chat.

---

## Comandos utiles

```bash
npm run dev       # Servidor local en localhost (wrangler pages dev)
npm run build     # Build + verificacion de integridad
npm run generate  # Genera public/region/*/index.html + sitemap.xml desde data/pages.json
npm run deploy    # Deploy a Cloudflare Pages
```

`update-blueprint` — No es un script. Es una instruccion: actualizar este archivo despues de cada cambio importante al sitio.

---

## Checklist antes de deploy

- [ ] `data/pages.json` tiene datos correctos y completos para las 16 regiones
- [ ] Se corrio `npm run generate` despues del ultimo cambio a pages.json o template.html
- [ ] `public/js/regions-data.js` fue regenerado (se genera automaticamente con `npm run generate`)
- [ ] No hay IDs placeholder visibles en el HTML final (GA4, AdSense)
- [ ] `npm run build` pasa sin errores
- [ ] Sitemap en `public/sitemap.xml` fue regenerado
- [ ] OG image existe en `public/icons/og-image.png`
- [ ] No se introdujeron dependencias npm ni imports ES module
- [ ] CSS nuevo usa variables de `tokens.css`, no valores hardcodeados
- [ ] HTML nuevo tiene `lang="es-CL"`, meta charset, meta viewport
