# Pre-Launch Checklist

## Configuración
- [ ] `config.json` completado (nombre, dominio, lang, ads)
- [ ] `scripts/new-site.sh` ejecutado (placeholders reemplazados)
- [ ] Dominio .cl registrado en NIC Chile
- [ ] Dominio apuntado a Cloudflare (nameservers)
- [ ] Proyecto creado en Cloudflare Pages
- [ ] Secrets configurados en GitHub (CF_API_TOKEN, CF_ACCOUNT_ID)
- [ ] Variable CF_PROJECT_NAME configurada en GitHub

## SEO
- [ ] H1 único por página con keyword principal
- [ ] Title tag < 60 chars en cada página
- [ ] Meta description 150-160 chars en cada página
- [ ] Canonical URL en cada página
- [ ] JSON-LD validado en Rich Results Test de Google
- [ ] sitemap.xml lista todas las páginas
- [ ] robots.txt permite Googlebot, bloquea AI bots
- [ ] Hreflang configurado según idioma

## Contenido (mínimo para AdSense)
- [ ] Página principal con herramienta + 500 palabras
- [ ] Página About con fuentes de datos (300+ palabras)
- [ ] Política de privacidad (referencia Ley 19.628)
- [ ] Página de contacto con email
- [ ] FAQ con 5+ preguntas (800+ palabras)
- [ ] Blog con 5-10 posts (800+ palabras cada uno) — si aplica
- [ ] Total: 5,000+ palabras en el sitio

## Performance
- [ ] Lighthouse Performance >= 95
- [ ] LCP < 1.5s en mobile
- [ ] CLS < 0.05 (ad slots con min-height fija)
- [ ] Total página < 100KB sin ads
- [ ] Sin web fonts (system-ui solamente)
- [ ] AdSense cargado lazy (3s delay)

## Accesibilidad
- [ ] Contraste color >= 4.5:1
- [ ] Skip-to-content link presente
- [ ] Todas las imágenes con alt text
- [ ] Formularios con labels
- [ ] Navegación por teclado funcional

## Anti-Scraping
- [ ] robots.txt con 40+ AI crawlers bloqueados
- [ ] Cloudflare Bot Fight Mode activado
- [ ] Cloudflare "Block AI Bots" activado
- [ ] WAF rule creada (bloqueo por User-Agent)
- [ ] _headers con X-Robots-Tag: noai
- [ ] Datos dinámicos renderizados via JS (no en HTML estático)

## Ads
- [ ] ads.txt con Publisher ID correcto
- [ ] Ad slots con dimensiones fijas (no CLS)
- [ ] Máximo 3 ads por página
- [ ] Primer ad debajo del contenido principal (no above fold)
- [ ] Dominio con 1-3 meses de antigüedad antes de aplicar
- [ ] 50+ visitas diarias antes de aplicar a AdSense

## Worker (solo arquetipo C)
- [ ] KV namespace creado
- [ ] Cron trigger configurado
- [ ] Fallback si KV está vacío
- [ ] CORS limitado al dominio del sitio
- [ ] Cache-Control headers en respuestas API

## Red de links
- [ ] Cross-links configurados en footer según config.json
- [ ] Links son contextuales y relevantes
- [ ] Todos los sitios de la red se enlazan mutuamente

## Post-Launch
- [ ] Google Search Console verificado (DNS TXT)
- [ ] Sitemap enviado en Search Console
- [ ] Geo-targeting Chile configurado en Search Console
- [ ] Primer crawl verificado (Search Console > Inspección de URL)
