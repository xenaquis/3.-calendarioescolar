# calendarioescolar.cl — Datos del sitio

## 1. Qué datos necesita el sitio

El sitio muestra **fechas del calendario escolar 2026 por región** obtenidas del Mineduc. Los datos son estáticos (el Mineduc los publica una vez por año como resolución exenta).

Por cada una de las **16 regiones de Chile** se necesita:

| Campo | Descripción |
|-------|-------------|
| `inicio` | Fecha inicio año escolar ("2 de marzo") |
| `vacacionesInicio` | Primer día vacaciones de invierno |
| `vacacionesFin` | Último día vacaciones de invierno |
| `fiestasPatriasInicio` | Primer día receso Fiestas Patrias |
| `fiestasPatriasFin` | Último día receso Fiestas Patrias |
| `finAno` | Fecha término año escolar |
| `diasVacacionesInvierno` | Número de días de vacaciones de invierno |
| `diasFiestasPatrias` | Número de días de Fiestas Patrias |

Adicionalmente, el JS del frontend necesita **fechas con hora e ISO timezone** para los countdowns (`EVENTS` en `app.js` y en el template de páginas de región).

El sitio tiene **3 tipos de páginas**:
1. `index.html` — página nacional con selector de región + tabla resumen nacional
2. `region/[slug]/index.html` (16 páginas) — página específica por región con tabla y countdown
3. `vacaciones-invierno-2026.html` y `cuando-empiezan-clases-2026.html` — landing pages temáticas (contenido hardcodeado en HTML)

---

## 2. Fuente de datos actual

El sitio es **arquetipo B (catálogo estático)**. No consume ninguna API en tiempo real.

Los datos están en **dos lugares sincronizados manualmente**:

### A. `data/pages.json`
Array de 16 objetos (uno por región). Usado por el generador de páginas estáticas `scripts/generate-pages.js` para producir `public/region/[slug]/index.html`.

Ruta: `data/pages.json`

### B. `var REGIONS` en `public/js/app.js` (líneas 16–33)
Objeto JS con los mismos 16 registros, **duplicado a mano** desde `data/pages.json`. Es la fuente que usa el selector de región en `index.html` para renderizar la tabla inline sin navegación.

### C. `var EVENTS` en `app.js` (líneas 36–43) y en `data/template.html` (líneas 273–281)
Array de 6 fechas con timestamps ISO para los countdowns. Están **hardcodeadas en dos lugares**:
- `public/js/app.js` — countdown de la página de inicio
- `data/template.html` — countdown de las páginas de región (se incrusta en el HTML generado)

No existe ninguna URL de API externa. `config.json` tiene `"apis": { "worker": "", "external": [] }`. El Cloudflare Function en `functions/api/data.js` es un placeholder vacío que retorna un mensaje informativo y no hace nada.

**No hay ninguna llamada a ninguna API.** `public/js/api.js` existe pero **no se usa** en este sitio; es código compartido del template base para arquetipo C.

---

## 3. Estado actual

**Los datos son REALES y CORRECTOS para 2026.** No son mockeados ni placeholders.

Las fechas en `data/pages.json` y `app.js` corresponden al calendario oficial Mineduc 2026:
- Inicio clases: 2 de marzo (todas las regiones)
- Vacaciones invierno: 11–24 julio (14 regiones); 4–24 julio (Aysén y Magallanes, 21 días)
- Fiestas Patrias: 14–18 septiembre (todas las regiones, 5 días)
- Fin año escolar: 11 de diciembre (14 regiones); 4 de diciembre (Aysén y Magallanes)

Lo que NO está configurado con datos reales son los servicios de terceros:
- `config.json` → `adsense.client`: `"ca-pub-XXXXXXXXXXXXXXXX"` (placeholder)
- `config.json` → `adsense.slots`: `"1234567890"`, `"0987654321"`, `"1122334455"` (placeholders)
- `config.json` → `analytics.ga4`: `"G-XXXXXXXXXX"` (placeholder)
- `public/index.html` y `data/template.html` → mismo placeholder AdSense en los `<ins>` tags
- `app.js` línea 8 → `Analytics.init('G-XXXXXXXXXX')` comentado
- `config.json` → `sheet.spreadsheetId`: `"PLACEHOLDER_SHEET_ID"`

Las páginas de región en `public/region/*/index.html` **ya están generadas** (el directorio existe con subdirectorios). Sin embargo, el estado de la generación debe verificarse — ver sección 4.

---

## 4. Qué hay que hacer para producción

El sitio está **funcionalmente completo** en cuanto a datos. Los únicos pasos pendientes son de configuración de servicios externos:

### Paso 1 — Registrar AdSense y obtener IDs reales
1. Aplicar a Google AdSense con el dominio `calendarioescolar.cl`
2. Obtener Publisher ID real (formato `ca-pub-XXXXXXXXXXXXXXXXX`)
3. Obtener 3 Slot IDs para los 3 ad units (top banner, mid rectangle, bottom rectangle)
4. Reemplazar en `config.json`: campos `adsense.client` y `adsense.slots`
5. Ejecutar `node scripts/new-site.sh` o hacer find/replace manual en:
   - `public/index.html` (3 ocurrencias del pub ID, 3 del slot ID)
   - `data/template.html` (3 ocurrencias del pub ID, 3 del slot ID)
   - `public/ads.txt` (debe contener `google.com, ca-pub-REAL, DIRECT, f08c47fec0942fa0`)
6. Re-ejecutar `node scripts/generate-pages.js` para regenerar las 16 páginas de región con los IDs reales

### Paso 2 — Configurar GA4
1. Crear propiedad en Google Analytics 4
2. Obtener Measurement ID (formato `G-XXXXXXXXXX`)
3. Reemplazar en `config.json`: campo `analytics.ga4`
4. Descomentar línea 8 en `public/js/app.js`: `Analytics.init('G-REAL_ID');`
5. Agregar `Analytics.init('G-REAL_ID')` en cada página estática que no use app.js

### Paso 3 — Verificar páginas de región generadas
1. Confirmar que las 16 páginas `public/region/[slug]/index.html` tienen los datos correctos y no tienen placeholders sin reemplazar
2. Ejecutar `node scripts/generate-pages.js` desde la raíz del proyecto si hay dudas

### Paso 4 — Deploy en Cloudflare Pages
1. Crear proyecto en Cloudflare Pages apuntando a este repo
2. Build command: `node scripts/generate-pages.js` (o vacío si ya están generadas)
3. Output directory: `public`
4. Configurar dominio `calendarioescolar.cl` en Cloudflare
5. Verificar `public/_headers` y `public/_redirects` estén correctos

### Paso 5 — Google Search Console
1. Verificar dominio via DNS TXT
2. Enviar `sitemap.xml`
3. Configurar geo-targeting Chile

### Paso 6 — Mantenimiento anual (cuando Mineduc publique calendario 2027)
El único dato que cambia año a año es el contenido de las fechas. Para actualizar:
1. Actualizar `data/pages.json` con las fechas del nuevo año
2. Actualizar `var REGIONS` en `public/js/app.js` (mismo contenido, duplicado)
3. Actualizar `var EVENTS` en `public/js/app.js` y en `data/template.html`
4. Actualizar fechas hardcodeadas en `public/index.html` (tabla resumen nacional, FAQ, JSON-LD)
5. Re-ejecutar `node scripts/generate-pages.js`
6. Actualizar `sitemap.xml` (se regenera automáticamente con el script)

---

## 5. Dependencias

### Dependencias externas en producción
| Dependencia | Uso | Estado |
|-------------|-----|--------|
| Google AdSense (`pagead2.googlesyndication.com`) | Monetización, 3 ad slots | IDs pendientes (placeholders) |
| Google Analytics 4 (`googletagmanager.com`) | Tracking de visitas | ID pendiente (placeholder) |
| `html2canvas@1` via CDN jsdelivr | Botón "Descargar como imagen" en páginas de región | Listo, se carga lazy on-demand |

### Dependencias de build (solo local/CI, no en runtime)
| Dependencia | Uso |
|-------------|-----|
| Node.js (cualquier versión LTS) | Ejecutar `scripts/generate-pages.js` |
| `package.json` | Sin dependencias npm (solo Node built-ins: `fs`, `path`) |

### NO usa
- Cloudflare Worker (el archivo `functions/api/data.js` es un placeholder vacío, no se necesita)
- Cloudflare KV
- Ninguna API del Mineduc (las fechas se copian manualmente una vez al año)
- Ningún bundler, framework, o librería JS excepto html2canvas cargado bajo demanda

### Problema de duplicación de datos (deuda técnica)
Los datos de fechas por región existen en **3 lugares simultáneos**:
1. `data/pages.json` — fuente para el generador de páginas estáticas
2. `var REGIONS` en `public/js/app.js` — fuente para el selector inline en index.html
3. `var EVENTS` en `app.js` + `data/template.html` — countdowns (fechas ISO con timezone)

No existe sincronización automática entre ellos. Si se cambia un dato en `pages.json` hay que cambiarlo también en `app.js` y en el template. Para 2027 esto es el principal riesgo de error.

**Posible mejora (no urgente):** hacer que el build script lea `data/pages.json` e inyecte el objeto `REGIONS` en `app.js` automáticamente, eliminando la duplicación.
