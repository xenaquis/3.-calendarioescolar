# PLAN DE REDISENO — calendarioescolar.cl

Fecha: 2026-03-12
Estado: EN REVISION (pendiente decisiones antes de implementar)

---

## Resumen

Se generaron 3 propuestas de diseno visual para la homepage:
1. **Cuaderno Botanico** (`mockups/propuesta-1-botanico.html`) — Agenda escolar, decoraciones botanicas CSS, grid de regiones
2. **Editorial Escolar** (`mockups/propuesta-2-editorial.html`) — Tipografia bold, timeline horizontal, data cards dashboard
3. **Jardin Digital** (`mockups/propuesta-3-jardin.html`) — Formas organicas animadas, mapa de regiones por zona, barra de progreso

**Elegida**: Editorial, optimizada con rasgos botanicos de las fotos de referencia y paleta mas clara.

**Mockup definitivo**: `mockups/mockup-definitivo.html` — abrir en navegador para ver el diseno final propuesto.

---

## Imagenes de referencia

Dos headers acuarela botanicos en la raiz del proyecto:
- `Xenaquis_minimalist_header_background_school_calendar_Chile_f_..._1.png`
- `Xenaquis_minimalist_header_background_school_calendar_Chile_f_..._3.png`

Rasgos clave: hojas teal/verde, acentos dorados/amarillos, textura papel crema, grilla calendario, estetica calida y educativa.

---

## Mockup definitivo — Decisiones de diseno

### Paleta nueva (menos oscura que la propuesta editorial original)

| Token | Valor actual | Valor nuevo | Nota |
|-------|-------------|-------------|------|
| --color-primary | #7c3aed (morado) | #2a9d8f (teal medio) | Coincide con hojas de las fotos |
| --color-primary-light | #ede9fe | #e6f5f2 | |
| --color-primary-dark | #5b21b6 | #1e7a6e | Para hover y links (contraste WCAG AA) |
| --color-accent | #2563eb (azul) | #7c3aed (morado) | El morado pasa a ser accent |
| --color-bg | #ffffff | #faf8f3 (crema calido) | Como textura papel de las fotos |
| --color-surface | #f8f9fa | #ffffff | |
| --color-surface-alt | #f1f3f4 | #f5f1ea (piedra calida) | |
| --color-text | #202124 | #2d3436 (negro calido) | |
| --color-text-secondary | #5f6368 | #636e72 | |
| --color-border/divider | #dadce0 | #e8e3d9 (calido) | |
| NUEVO --color-secondary | — | #c8963e (dorado) | Acentos dorados de las fotos |
| NUEVO --color-accent-warm | — | #e07a5f (coral suave) | Para highlights |

### Dark mode
Tonos oscuros calidos (no los azules actuales):
- --bg: #1a1d21, --surface: #23272e, --primary: #3dbdad, --text: #e8e6e1

### Toques botanicos (CSS puro, sin imagenes)
- Hero: 3 blobs organicos (teal, dorado, coral) con border-radius asimetrico, opacidad 0.05-0.06
- Divisores entre secciones: 3 puntos (teal, gold, coral) con lineas finas a los lados
- Footer: forma hoja sutil via ::before, opacidad 0.04

### Orden de secciones (optimizado para utilidad)
1. Header (sticky, limpio)
2. Hero + countdown + decoracion botanica
3. Data cards (4 fechas clave) — subido para valor inmediato
4. Region selector con card resultado
5. Timeline (ano escolar de un vistazo, grid 10 meses)
6. Tabla resumen nacional
7. Links SEO (vacaciones invierno, inicio clases)
8. Contenido SEO (prosa)
9. FAQ accordion (con iconos teal +/-)
10. Footer

### Componentes nuevos del mockup
- **Data cards**: borde izquierdo coloreado (estilo pull-quote editorial), numeros grandes
- **Timeline grid**: 11 columnas (label + 10 meses), 2 filas (14 regiones + Aysen/Magallanes)
- **Botanical divider**: 3 puntos coloreados con lineas
- **Editorial rule**: hr sutil con opacidad 0.2
- **FAQ accordion**: botones con +/- teal, max-height transition, cierra los demas al abrir uno

### Cambio estructural HTML importante
Actual: `<main><div class="container">...todo...</div></main>`
Nuevo: `<main><section class="hero"><div class="container">...</div></section><section class="section section--alt"><div class="container">...</div></section>...</main>`
Cada seccion es full-bleed con su propio container interno.

---

## Decisiones pendientes antes de implementar

1. **Contraste links**: #2a9d8f sobre crema #faf8f3 = 3.5:1 (falla WCAG AA para texto chico). Propuesta: usar #1e7a6e (primary-dark, 5.5:1) para links de texto body. OK?

2. **Dark mode**: Tonos calidos (verdes/marrones) o mantener los azul-oscuros actuales?

3. **Timeline**: Solo visual estatico, o JS resalta el periodo actual segun la fecha de hoy?

4. **Hero en subpaginas**: Las landing pages SEO tambien reciben un hero pequeno, o se quedan planas?

---

## Plan de implementacion (8 fases)

### Fase 1 — Tokens (afecta 22 paginas)
- Editar `public/css/tokens.css`: reemplazar paleta segun tabla de arriba
- Actualizar dark mode (ambos bloques)
- Cambiar `<meta name="theme-color" content="#7c3aed">` a `"#2a9d8f"` en:
  - public/index.html (linea 38)
  - public/vacaciones-invierno-2026.html
  - public/cuando-empiezan-clases-2026.html
  - public/about.html, contacto.html, privacidad.html
  - data/template.html (linea 30)
  - config.json campo themeColor (linea 7)
- Despues: `npm run generate` para regenerar regiones
- Verificar: todas las paginas con nueva paleta, dark mode, contraste

### Fase 2 — Base CSS (clases aditivas, sin riesgo)
- Agregar a `public/css/base.css`:
  - `.section-band`, `.section-band--cream`, `.section-band--white`
  - `.editorial-rule`, `.editorial-rule--gold`
  - `.botanical-divider` (3 puntos + lineas)
  - `.eyebrow` (label sobre titulos de seccion)
  - Fix contraste: `a { color: var(--color-primary-dark) }` (si se decide)
  - Print: `.hero { display: none !important; }`

### Fase 3 — Componentes CSS (clases aditivas, sin riesgo)
- Agregar a `public/css/components.css`:
  - `.hero`, `.hero__title`, `.hero__kicker`, `.hero__subtitle`, `.hero__botanical`, `.hero__title-accent`
  - `.data-cards`, `.data-card`, `.data-card__number`, `.data-card__label`, `.data-card__detail`
  - `.timeline`, `.timeline__grid`, `.timeline__cell`, `.timeline__cell--clases/vacaciones/fiestas`
  - `.countdown-wrap`, `.countdown-label`, `.countdown-event`
  - `.region-result` rediseñado
  - `.seo-links`, `.seo-link-card`
  - `.faq-list`, `.faq-item`, `.faq-item__question`, `.faq-item__answer`
  - Override countdown en hero
  - Responsive: ajustes en @media (max-width: 640px)

### Fase 4 — HTML Homepage (cambio grande)
- Reestructurar `<main>` de `public/index.html`
- De un solo .container a secciones full-bleed con containers individuales
- Nuevo orden de secciones segun lista de arriba
- Mantener TODOS los IDs de elementos (countdown-home, region-select, etc.)
- Ads slots se mantienen entre secciones

### Fase 5 — JavaScript (ajustes menores)
- Verificar app.js compatible con nueva estructura (mismos IDs)
- Posible ajuste scrollIntoView en region selector
- countdown.js no necesita cambios si IDs se mantienen

### Fase 6 — Template + Regiones
- `data/template.html`: solo theme-color
- `npm run generate` para regenerar 16 paginas + sitemap + regions-data.js

### Fase 7 — Landing pages + utility pages
- theme-color en las 5 paginas restantes
- Verificacion visual completa

### Fase 8 — Config + Docs
- config.json: themeColor
- BLUEPRINT.md: actualizar colores, marcar rediseno completado
- CLAUDE.md: actualizar seccion Colores

### Riesgos
| Riesgo | Severidad | Mitigacion |
|--------|-----------|------------|
| Token change afecta 22 paginas | MEDIO | Hacer primero, verificar antes de seguir |
| Contraste links WCAG AA | ALTO | Usar primary-dark para links |
| HTML rewrite rompe JS | MEDIO | Mantener IDs identicos |
| Dark mode no ajustado | MEDIO | Actualizar ambos bloques en tokens.css |

---

## Archivos del mockup

```
mockups/
  propuesta-1-botanico.html   — Cuaderno Botanico (descartada)
  propuesta-2-editorial.html  — Editorial Escolar (base)
  mockup-definitivo.html      — ESTE ES EL DISENO FINAL A IMPLEMENTAR
  propuesta-3-jardin.html     — Jardin Digital (descartada)
```

Abrir `mockup-definitivo.html` en el navegador para ver exactamente como debe quedar el sitio.
El mockup es autocontenido (CSS + JS inline) y funcional (countdown, region selector, FAQ, dark mode).
