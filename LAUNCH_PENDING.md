# LAUNCH_PENDING — calendarioescolar.cl
Última actualización: 2026-03-12

---

## ✅ Completado en sesión 2026-03-12 (código listo, sin deploy aún)

### Bugs corregidos
- [x] `Analytics.init()` comentado en app.js → activado con placeholder
- [x] `Analytics.init()` ausente en todas las páginas → agregado en about, contacto, privacidad, vacaciones-invierno, cuando-empiezan-clases y las 16 páginas de región
- [x] `<meta name="robots">` duplicado en about/contacto/privacidad → unificado en una sola etiqueta
- [x] Unicode escapes `\u00XX` en HTML body de las 16 páginas de región y template → reemplazados por UTF-8 real (bug visual: antes se mostraba `\u00f3` en lugar de `ó`)
- [x] Countdown de Aysén y Magallanes usaban fechas nacionales → corregidas a 4 jul (vacaciones) y 4 dic (fin de año)
- [x] Títulos de páginas de región >60 chars → eliminado sufijo ` — calendarioescolar.cl`
- [x] `analytics.js` no se cargaba en contacto.html y privacidad.html → agregado

### SEO
- [x] Hreflang (es-CL, es, x-default) en las 16 páginas de región, vacaciones-invierno, cuando-empiezan-clases
- [x] `privacidad.html` agregada al sitemap.xml

### Calidad
- [x] Footer con link a "Inicio" en index.html, las 16 regiones y template
- [x] `<meta name="theme-color">` y `<link rel="apple-touch-icon">` en about/contacto/privacidad
- [x] `site-footer__source` (fuente Mineduc) verificado en todas las páginas

---

## ⏳ Pendiente — Acciones manuales

### 1. Dominio
- [ ] Registrar `calendarioescolar.cl` en **NIC Chile**
  - Verificar disponibilidad y precio: https://www.nic.cl
  - Costo estimado: ~$18 USD/año (dominio .cl)
  - Requiere RUT chileno o representante legal

### 2. DNS / Cloudflare
- [ ] Apuntar nameservers del dominio a Cloudflare
  - Panel Cloudflare: https://dash.cloudflare.com
  - Cambiar NS en NIC Chile a los que indique Cloudflare al agregar el dominio
- [ ] Verificar que Cloudflare Pages está sirviendo el sitio correctamente
  - El proyecto en Cloudflare Pages ya existe (creado sesión anterior)
  - URL de preview: ver `reference_external_systems.md` en memoria del proyecto

### 3. Google Analytics (GA4)
- [ ] Crear property en Google Analytics 4
  - Panel: https://analytics.google.com
  - Crear nueva propiedad → obtener Measurement ID (formato: `G-XXXXXXXXXX`)
  - Reemplazar en **todos** los archivos: buscar `G-XXXXXXXXXX` con grep
  - Archivos a actualizar: `public/js/app.js` (línea 8) + todos los inline scripts
  - O bien reemplazar solo en `app.js` y los inline scripts de cada página
- [ ] Verificar que el tag GA4 dispara en producción con Google Tag Assistant

### 4. Google AdSense
- [ ] Obtener aprobación de AdSense para el dominio
  - Nota: requiere dominio activo con tráfico real (~50 visitas/día) y 1-3 meses de antigüedad
  - Aplicar en: https://www.google.com/adsense
  - Una vez aprobado, obtener Publisher ID (`ca-pub-XXXXXXXXXXXXXXXXX`)
  - Reemplazar en `config.json` → campo `adsense.client`
  - Reemplazar en todos los HTML: buscar `ca-pub-XXXXXXXXXXXXXXXX`
  - Actualizar `public/ads.txt` con el pub-ID real
  - Obtener slot IDs reales para top (horizontal), mid (rectangle), bottom (rectangle)
  - Reemplazar en `config.json` → campos `adsense.slots.top/mid/bottom`

### 5. Google Search Console
- [ ] Verificar propiedad con DNS TXT (método recomendado con Cloudflare)
  - Panel: https://search.google.com/search-console
  - Agregar propiedad → verificar con DNS TXT record en Cloudflare
- [ ] Enviar sitemap: `https://calendarioescolar.cl/sitemap.xml`
- [ ] Configurar geo-targeting: Sitemaps > Settings > Country = Chile

### 6. Cloudflare — Seguridad
- [ ] Activar Bot Fight Mode: Security > Bots > Bot Fight Mode = ON
- [ ] Activar Block AI Bots: Security > Bots > AI Scrapers = Block
- [ ] Verificar que WAF está activo (plan Free incluye reglas básicas)

---

## Verificación de datos del contenido

Las fechas del calendario escolar 2026 fueron tomadas de Mineduc. Para verificar:
- **Fuente oficial**: https://www.mineduc.cl → Documentos → Calendario Escolar
- **Resolución exenta** con el calendario 2026 (publicada ~noviembre 2025)
- Fechas a verificar: inicio 2 marzo, vac. invierno 11 jul (4 jul Aysén/Magallanes), fin 11 dic (4 dic Aysén/Magallanes)

---

## Notas técnicas
- Todos los placeholders AdSense (`ca-pub-XXXXXXXXXXXXXXXX`) y GA4 (`G-XXXXXXXXXX`) son **seguros para deploy** — los scripts tienen guardas y no cargan nada con estos valores
- Si se regeneran las páginas con `node scripts/generate-pages.js`, el template también está corregido y las páginas quedarán bien
- El template está en `data/template.html`, los datos en `data/pages.json`
