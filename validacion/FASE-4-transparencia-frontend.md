# Fase 4: Transparencia de Verificación en el Frontend

> **Agente Especialista**: Ingeniero Frontend
> **Idea Matriz aplicada**: El usuario debe ver con sus propios ojos que la información fue verificada, cuándo, y contra qué fuente. La trazabilidad no sirve si es invisible.

---

## Objetivo

Mostrar en el frontend del sitio indicadores visuales de verificación: "Información verificada al DD/MM/YYYY contra [fuente oficial]", con enlace a la fuente. Esto genera confianza y diferencia al sitio de páginas sin respaldo.

---

## Problema que Resuelve

El sitio muestra datos correctos, pero el usuario no tiene forma de saber:
1. ¿Cuándo se verificó esta información por última vez?
2. ¿Contra qué fuente oficial se verificó?
3. ¿El sitio se actualiza automáticamente o está abandonado?

Agregar indicadores de verificación convierte una debilidad percibida ("¿puedo confiar en este sitio?") en una fortaleza ("este sitio me dice exactamente de dónde sacó los datos").

---

## Diseño Visual

### Principio: Minimalismo informativo

El badge de verificación debe ser **visible pero no intrusivo**. No debe competir con el contenido principal. Debe comunicar confianza, no complejidad.

### Componente: Verification Badge

```
┌──────────────────────────────────────────────────────────────┐
│ ✓ Verificado al 17 de marzo 2026 · Fuente: Mineduc Res. Ex. │
│   Última revisión automática: hace 3 días                    │
└──────────────────────────────────────────────────────────────┘
```

**Variantes por estado**:

```
Estado CORRECTO (verde sutil):
┌──────────────────────────────────────────────────────────────┐
│ ✓ Verificado al 17/03/2026 · Fuente: Resolución Mineduc     │
└──────────────────────────────────────────────────────────────┘

Estado NO_VERIFICABLE (gris):
┌──────────────────────────────────────────────────────────────┐
│ ○ Información basada en Resolución Mineduc · Verificación    │
│   automática no disponible para esta sección                 │
└──────────────────────────────────────────────────────────────┘

Estado FUENTE_INACCESIBLE (amarillo):
┌──────────────────────────────────────────────────────────────┐
│ △ Última verificación: 15/02/2026 · Fuente temporalmente     │
│   no disponible · Datos basados en última verificación       │
└──────────────────────────────────────────────────────────────┘

Estado INCORRECTO:
→ NO MOSTRAR BADGE. Corregir el dato primero.
→ Si no se puede corregir inmediatamente: ocultar la sección completa.
```

### Componente: Footer de Verificación Global

Al pie de cada página, un resumen global:

```
──────────────────────────────────────────────
  Información actualizada al 17 de marzo de 2026
  42 de 45 datos verificados automáticamente
  Fuentes: Mineduc · Biblioteca del Congreso Nacional
  Ver detalle de verificación →
──────────────────────────────────────────────
```

---

## Entregables

### 1. `scripts/generate-verificacion.js`

Script que genera `public/data/verificacion.json` a partir de `data/verification-results.json` + `data/afirmaciones.json` + `data/source-health.json`.

```javascript
// Pseudocódigo

function generateVerificacion() {
  var afirmaciones = loadJSON('data/afirmaciones.json');
  var results = loadJSON('data/verification-results.json');
  var sourceHealth = loadJSON('data/source-health.json');

  // Agrupar claims por sección de la página
  var sections = {};

  results.results.forEach(function(result) {
    var claim = findClaim(afirmaciones, result.id);
    if (!claim) return;

    // Determinar en qué secciones aparece este claim
    claim.displayed_in.forEach(function(page) {
      var sectionId = deriveSectionId(claim);

      if (!sections[sectionId]) {
        sections[sectionId] = {
          id: sectionId,
          claims: [],
          worst_status: 'CORRECTO',
          last_verified: null,
          sources: []
        };
      }

      sections[sectionId].claims.push({
        id: result.id,
        verdict: result.verdict,
        verified_at: result.verified_at,
        verified_by: result.verified_by
      });

      // El peor status de la sección determina el badge
      sections[sectionId].worst_status = worstOf(
        sections[sectionId].worst_status,
        result.verdict
      );

      // La fecha más reciente de verificación
      if (!sections[sectionId].last_verified ||
          result.verified_at > sections[sectionId].last_verified) {
        sections[sectionId].last_verified = result.verified_at;
      }

      // Agregar fuente si no está ya
      var source = afirmaciones.sources[claim.source_id];
      if (source && sections[sectionId].sources.indexOf(source.name) === -1) {
        sections[sectionId].sources.push(source.name);
      }
    });
  });

  // Generar JSON para frontend
  var output = {
    generated_at: new Date().toISOString(),
    summary: {
      total_claims: results.total_claims,
      correcto: results.correcto,
      incorrecto: results.incorrecto,
      no_verificable: results.no_verificable,
      fuente_inaccesible: results.fuente_inaccesible,
      last_full_verification: results.verified_at,
      sources_healthy: sourceHealth ? sourceHealth.ok : null,
      sources_total: sourceHealth ? sourceHealth.total_sources : null
    },
    sections: sections
  };

  writeJSON('public/data/verificacion.json', output);
}

function worstOf(a, b) {
  var priority = ['INCORRECTO', 'FUENTE_INACCESIBLE', 'NO_VERIFICABLE', 'CORRECTO'];
  return priority.indexOf(a) < priority.indexOf(b) ? a : b;
}

function deriveSectionId(claim) {
  // Mapear categorías de claims a secciones del frontend
  var map = {
    'fechas_escolares': 'school-dates',
    'feriados': 'holidays',
    'derivados': 'stats',
    'contextuales': 'context'
  };
  return map[claim.category] || 'other';
}
```

### 2. `public/js/verificacion.js` (IIFE)

```javascript
;(function() {
  'use strict';

  var VERIFICACION_URL = '/data/verificacion.json';
  var MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function init() {
    // Solo cargar si hay elementos con data-verificacion
    var targets = document.querySelectorAll('[data-verificacion]');
    if (targets.length === 0) return;

    fetch(VERIFICACION_URL)
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data) return;
        renderBadges(data, targets);
        renderFooter(data);
      })
      .catch(function() {
        // Silencioso — no mostrar nada si no hay datos de verificación
      });
  }

  function renderBadges(data, targets) {
    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      var sectionId = el.getAttribute('data-verificacion');
      var section = data.sections[sectionId];

      if (!section) continue;

      // NO mostrar badge si hay dato INCORRECTO
      if (section.worst_status === 'INCORRECTO') continue;

      var badge = createBadge(section);
      if (badge) {
        el.appendChild(badge);
      }
    }
  }

  function createBadge(section) {
    var div = document.createElement('div');
    div.className = 'verificacion-badge';

    var dateStr = formatDate(section.last_verified);
    var sourcesStr = section.sources.join(' · ');

    if (section.worst_status === 'CORRECTO') {
      div.classList.add('verificacion-badge--ok');
      div.innerHTML = '<span class="verificacion-badge__icon">✓</span>' +
        '<span class="verificacion-badge__text">' +
        'Verificado al ' + dateStr +
        (sourcesStr ? ' · Fuente: ' + sourcesStr : '') +
        '</span>';
    } else if (section.worst_status === 'NO_VERIFICABLE') {
      div.classList.add('verificacion-badge--neutral');
      div.innerHTML = '<span class="verificacion-badge__icon">○</span>' +
        '<span class="verificacion-badge__text">' +
        'Información basada en ' + sourcesStr +
        ' · Verificación automática limitada' +
        '</span>';
    } else if (section.worst_status === 'FUENTE_INACCESIBLE') {
      div.classList.add('verificacion-badge--warning');
      div.innerHTML = '<span class="verificacion-badge__icon">△</span>' +
        '<span class="verificacion-badge__text">' +
        'Última verificación: ' + dateStr +
        ' · Fuente temporalmente no disponible' +
        '</span>';
    }

    return div;
  }

  function renderFooter(data) {
    var footer = document.querySelector('[data-verificacion-footer]');
    if (!footer) return;

    var s = data.summary;
    var dateStr = formatDate(s.last_full_verification);
    var verified = s.correcto + '/' + s.total_claims;

    footer.innerHTML =
      '<div class="verificacion-footer">' +
      '<p class="verificacion-footer__date">' +
      'Información actualizada al ' + dateStr +
      '</p>' +
      '<p class="verificacion-footer__stats">' +
      verified + ' datos verificados automáticamente' +
      '</p>' +
      '<p class="verificacion-footer__sources">' +
      'Fuentes: Mineduc · Biblioteca del Congreso Nacional' +
      '</p>' +
      '</div>';
  }

  function formatDate(isoString) {
    if (!isoString) return 'fecha no disponible';
    var d = new Date(isoString);
    return d.getDate() + ' de ' + MONTHS_ES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  // Iniciar cuando DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

### 3. CSS (`public/css/verificacion.css`)

```css
/* === Verification Badges === */

.verificacion-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-top: 1rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  line-height: 1.4;
  font-family: system-ui, -apple-system, sans-serif;
}

.verificacion-badge__icon {
  flex-shrink: 0;
  font-size: 0.875rem;
}

.verificacion-badge__text {
  color: inherit;
}

/* Estado: Verificado (verde sutil) */
.verificacion-badge--ok {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

/* Estado: No verificable (gris) */
.verificacion-badge--neutral {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  color: #6b7280;
}

/* Estado: Fuente inaccesible (amarillo) */
.verificacion-badge--warning {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}

/* === Footer de Verificación === */

.verificacion-footer {
  text-align: center;
  padding: 1.5rem 1rem;
  margin-top: 2rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.8125rem;
  color: #6b7280;
}

.verificacion-footer__date {
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
}

.verificacion-footer__stats,
.verificacion-footer__sources {
  margin: 0.125rem 0;
}

/* Dark mode support (si se implementa en el futuro) */
@media (prefers-color-scheme: dark) {
  .verificacion-badge--ok {
    background-color: #052e16;
    border-color: #166534;
    color: #bbf7d0;
  }

  .verificacion-badge--neutral {
    background-color: #1f2937;
    border-color: #374151;
    color: #9ca3af;
  }

  .verificacion-badge--warning {
    background-color: #451a03;
    border-color: #92400e;
    color: #fde68a;
  }

  .verificacion-footer {
    border-top-color: #374151;
    color: #9ca3af;
  }

  .verificacion-footer__date {
    color: #d1d5db;
  }
}

/* Responsive */
@media (max-width: 640px) {
  .verificacion-badge {
    font-size: 0.75rem;
    padding: 0.375rem 0.5rem;
  }
}
```

### 4. Atributos HTML en las páginas

Agregar `data-verificacion="section-id"` a las secciones relevantes:

**En `index.html`**:
```html
<!-- Sección de fechas escolares -->
<section class="key-facts" data-verificacion="school-dates">
  ...
</section>

<!-- Sección de feriados -->
<section class="feriados" data-verificacion="holidays">
  ...
</section>

<!-- Footer de verificación -->
<footer data-verificacion-footer></footer>
```

**En `data/template.html`** (páginas regionales):
```html
<section class="calendar-section" data-verificacion="school-dates">
  ...
</section>

<footer data-verificacion-footer></footer>
```

**En `vacaciones-invierno-2026.html`**:
```html
<section class="content" data-verificacion="school-dates">
  ...
</section>
```

### 5. Integración con `generate-pages.js`

Agregar al pipeline de generación:

```javascript
// Al final de generate-pages.js, después de generar health.json

// Generar verificacion.json si existen los datos de verificación
var verificationResultsPath = path.join(dataDir, 'verification-results.json');
if (fs.existsSync(verificationResultsPath)) {
  console.log('Generating verificacion.json...');
  // Importar y ejecutar la función de generación
  // (o incluir la lógica directamente en generate-pages.js)
  require('./generate-verificacion.js');
}
```

Y agregar `verificacion.js` y `verificacion.css` a las páginas HTML:

```html
<!-- En el <head> -->
<link rel="stylesheet" href="/css/verificacion.css">

<!-- Al final del <body> -->
<script src="/js/verificacion.js" defer></script>
```

---

## Implementación Paso a Paso

### Paso 1: CSS (`public/css/verificacion.css`) (~15min)

Crear el archivo CSS con los estilos de los badges. Verificar que los colores son coherentes con el diseño existente (primary: #7c3aed, accent: #2563eb). Los verdes/amarillos/grises de los badges son neutros y no deberían chocar.

### Paso 2: JS IIFE (`public/js/verificacion.js`) (~45min)

1. Implementar la IIFE completa
2. Manejar el caso de que `verificacion.json` no exista (graceful — no mostrar nada)
3. Formatear fechas en español
4. Testear con un `verificacion.json` de prueba

### Paso 3: Generador (`scripts/generate-verificacion.js`) (~45min)

1. Mapeo de categorías a section IDs
2. Lógica de "peor estado" por sección
3. Generación del JSON de salida
4. Integración con `generate-pages.js`

### Paso 4: Atributos HTML (~30min)

1. Agregar `data-verificacion` a secciones de `index.html`
2. Agregar `data-verificacion` a `data/template.html`
3. Agregar `data-verificacion` a landing pages SEO
4. Agregar `data-verificacion-footer` a todas las páginas
5. Incluir CSS y JS en las páginas

### Paso 5: Test visual (~30min)

1. Generar datos de prueba para cada estado (CORRECTO, NO_VERIFICABLE, FUENTE_INACCESIBLE)
2. Verificar rendering en desktop y mobile
3. Verificar que no aparece badge cuando no hay datos
4. Verificar que no aparece badge para INCORRECTO
5. Verificar que el footer muestra resumen correcto

---

## Premortem Pesimista

### Riesgo 1: FOUC (Flash of Unstyled Content) o badge tardío
**Escenario**: El badge aparece 1-2 segundos después de que la página se renderiza, causando un salto visual.
**Probabilidad**: Media (depende de la velocidad de carga de verificacion.json).
**Impacto**: Mala experiencia visual, pérdida de confianza ("¿por qué la página saltó?").
**Mitigación**:
- El JSON es pequeño (<5KB) y se sirve desde Cloudflare CDN (edge) — carga rápida
- Los badges se insertan con `appendChild`, no `innerHTML` de toda la sección
- Reservar espacio CSS: `[data-verificacion]::after { content: ''; min-height: 2.5rem; }` (retirar cuando el badge se renderiza)
- Alternativa: pre-renderizar los badges en `generate-pages.js` directamente en el HTML, sin necesidad de fetch. Esto elimina FOUC completamente pero acopla más el sistema.

### Riesgo 2: Badge visible con datos incorrectos
**Escenario**: El verificador dice CORRECTO, el badge muestra "✓ Verificado", pero el dato en realidad está mal (falso positivo del verificador).
**Probabilidad**: Baja (<5% si las mitigaciones de Fase 3 funcionan).
**Impacto**: Alto — el badge da falsa confianza.
**Mitigación**:
- El badge NUNCA dice "los datos son correctos". Dice "Verificado al [fecha] contra [fuente]". Esto es factualmente verdadero: la verificación se ejecutó en esa fecha contra esa fuente.
- Si el veredicto fue `NO_VERIFICABLE`, el badge dice "Verificación automática limitada" — honesto.
- Incluir enlace a la fuente original: el usuario puede verificar por sí mismo.

### Riesgo 3: Fecha de verificación antigua genera desconfianza
**Escenario**: La última verificación fue hace 60 días. El badge dice "Verificado al 15 de enero de 2026". El usuario piensa "esto está desactualizado".
**Probabilidad**: Media (si los crons fallan o no se ejecutan).
**Impacto**: El badge daña en vez de ayudar.
**Mitigación**:
- Si la fecha de verificación es >45 días atrás → mostrar badge neutral (gris) con "Verificación pendiente" en vez de la fecha antigua
- Esto incentiva a mantener los crons funcionando
- En `validate.js`: WARNING si `verification-results.json` tiene más de 45 días

### Riesgo 4: Sobrecarga visual en mobile
**Escenario**: En pantallas pequeñas, los badges de verificación ocupan demasiado espacio vertical y empujan el contenido importante.
**Probabilidad**: Media.
**Mitigación**:
- En mobile (<640px): badges más compactos (font-size: 0.75rem, padding reducido)
- Considerar: en mobile, mostrar solo el footer global, no badges por sección
- CSS: `@media (max-width: 640px) { .verificacion-badge { display: none; } }` como opción extrema

### Riesgo 5: El badge interfiere con SEO/performance
**Escenario**: Google penaliza por contenido dinámico añadido con JS, o el JSON adicional afecta Core Web Vitals.
**Probabilidad**: Baja.
**Mitigación**:
- El JSON es <5KB (negligible)
- El JS es <2KB (negligible)
- Los badges son texto, no imágenes — no afectan LCP
- Alternativa SEO-friendly: pre-renderizar badges en HTML durante build (sin fetch de JSON)
- Schema markup: agregar `dateModified` al structured data existente, alimentado por la fecha de verificación

---

## Decisión Arquitectónica: Pre-render vs. Client-side

| Aspecto | Pre-render (en build) | Client-side (fetch JSON) |
|---|---|---|
| FOUC | Ninguno | Posible |
| SEO | Visible a crawlers | Invisible a crawlers |
| Complejidad | Mayor (modificar generate-pages.js) | Menor (IIFE independiente) |
| Actualización | Requiere re-build | Actualiza con JSON |
| Caché | Badge se cachea con HTML | JSON se cachea independientemente |

**Recomendación**: Implementar **ambos**:
1. Pre-render un badge estático mínimo ("Fuentes: Mineduc · BCN · Verificado al [fecha]") directamente en el HTML durante `generate-pages.js`
2. El IIFE enriquece con badges detallados por sección si `verificacion.json` está disponible
3. Esto da lo mejor de ambos mundos: SEO + granularidad

---

## Criterios de Éxito

- [ ] Badge visible en desktop y mobile sin saltos visuales
- [ ] 3 variantes visuales funcionando: CORRECTO (verde), NO_VERIFICABLE (gris), FUENTE_INACCESIBLE (amarillo)
- [ ] INCORRECTO NO muestra badge (el dato debe corregirse primero)
- [ ] Footer global muestra resumen de verificación
- [ ] Degradación graceful: si no existe `verificacion.json`, no se muestra nada (sin errores en consola)
- [ ] CSS responsive: badges compactos en mobile
- [ ] Pre-render mínimo en HTML (fecha + fuentes) para SEO
- [ ] Performance: <5KB JSON + <2KB JS adicional
