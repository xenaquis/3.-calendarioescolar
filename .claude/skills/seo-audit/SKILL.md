---
name: seo-audit
description: Auditoría SEO del sitio
---

# Auditoría SEO

Revisar todos los archivos HTML en public/ y verificar:

## Por cada página HTML:
- [ ] Exactamente un `<h1>` por página
- [ ] `<title>` presente y < 60 caracteres
- [ ] `<meta name="description">` presente y 150-160 caracteres
- [ ] `<link rel="canonical">` presente con URL absoluta
- [ ] `<meta property="og:title">` y `og:description` y `og:image` presentes
- [ ] `lang` attribute en `<html>` coincide con config.json
- [ ] Todas las imágenes tienen `alt`
- [ ] No hay links rotos internos
- [ ] No hay placeholders sin reemplazar (SITENAME, DOMAIN, TITULO, etc.)

## Archivos del sitio:
- [ ] `robots.txt` existe y permite Googlebot
- [ ] `sitemap.xml` existe y lista todas las páginas
- [ ] `ads.txt` existe (si usa AdSense)
- [ ] `_headers` existe con X-Robots-Tag: noai
- [ ] JSON-LD schema válido en index.html

## Reportar:
- Errores críticos (missing H1, missing meta)
- Advertencias (descripciones muy cortas/largas)
- Sugerencias de mejora

NO auto-corregir sin permiso del usuario.
