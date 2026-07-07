# FUENTES DE VERDAD — calendarioescolar.cl

> Documento generado: 2026-03-12
> Metodología: auditoría multi-experto (investigador web, abogado, economista) + premortem.
> Actualizar este archivo cada noviembre junto con los datos del año escolar.

---

## 1. INVENTARIO DE INFORMACIÓN Y FUENTES OFICIALES

### A. FECHAS DEL CALENDARIO ESCOLAR (por región)

| Dato | Fuente Última de Verdad | URL de Acceso | API? | Periodicidad |
|------|------------------------|---------------|------|-------------|
| Inicio de clases por región | **Resolución Exenta Mineduc** publicada en Diario Oficial | `https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-{AÑO}/` | NO — PDF | Anual (noviembre) |
| Vacaciones invierno inicio/fin por región | Resolución Exenta Mineduc | Misma URL | NO — PDF | Anual (noviembre) |
| Fin de año escolar por región | Resolución Exenta Mineduc | Misma URL | NO — PDF | Anual (noviembre) |
| Fiestas Patrias escolares | Resolución Exenta + Ley 2.977 | Misma URL | NO — PDF | Anual (noviembre) |

**Portal centralizado Mineduc (verificado 2026):**
```
https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-2026/
https://www.ayudamineduc.cl/ficha/calendarios-escolares-regionales
```

**URLs de PDFs regionales reales (patrón 2026):**
```
https://metropolitana.mineduc.cl/wp-content/uploads/sites/9/2025/12/DD_4079499_251215_P.pdf
https://maule.mineduc.cl/wp-content/uploads/sites/11/2025/12/CER-Maule.pdf
https://antofagasta.mineduc.cl/wp-content/uploads/sites/5/2025/12/CER-2026_Antofagasta.pdf
https://loslagos.mineduc.cl/wp-content/uploads/sites/15/2025/12/CALENDARIO-ESCOLAR-LOS-LAGOS-2026-1.pdf
https://aysen.mineduc.cl/wp-content/uploads/sites/16/2025/12/REX-N%C2%B0618-CALENDARIO-ESCOLAR-DEL-ANO-2026.pdf
```
Patrón general: `https://[region].mineduc.cl/wp-content/uploads/sites/[N]/YYYY/MM/[nombre].pdf`

**Fallbacks en orden de confiabilidad:**
1. Diario Oficial: `https://www.diarioficial.cl/` (buscar "Resolución Exenta Calendario Escolar")
2. Transparencia Mineduc: `https://transparencia.mineduc.cl/normativa_a6.html`
3. Portales regionales Mineduc: `https://[region].mineduc.cl/`
4. Resoluciones del año anterior como referencia estructural (fechas cambian ±2 semanas)
5. **NUNCA**: Wikipedia, sitios de terceros no identificados

**Riesgos críticos:**
- El PDF puede estar en imagen escaneada (no parseable automáticamente)
- La URL cambia cada año sin redirección estable
- Mineduc puede emitir circulares regionales posteriores con ajustes (buscar en portales regionales)
- En años de transición de gobierno (2025→2026) la publicación puede retrasarse hasta enero
- En emergencias nacionales (pandemia, catástrofe) las fechas pueden cambiar con 48h de aviso

---

### B. FERIADOS EN PERÍODO ESCOLAR

#### B1. Reglas de cálculo

| Feriado | Tipo | Regla de Cálculo | Fuente Legal | URL BCN |
|---------|------|-----------------|-------------|---------|
| Viernes Santo | **Movible** | Pascua − 2 días | Ley 2.977 | `https://www.bcn.cl/leychile/Navegar?idNorma=23639` |
| Corpus Christi | **Movible** | Pascua + 60 días (siempre jueves) | Ley 2.977 (Ley 20.148 reemplazó CC por Virgen del Carmen, pero sigue en calendario escolar) | `https://www.bcn.cl/leychile/Navegar?idNorma=23639` |
| San Pedro y San Pablo | Semi-movible | 29 jun; si cae sáb/dom → lunes siguiente | Ley 19.668 (traslado) | `https://www.bcn.cl/leychile/Navegar?idNorma=160270` |
| Día del Trabajo | Fijo | 1 de mayo | Ley 2.977 | `https://www.bcn.cl/leychile/Navegar?idNorma=23639` |
| Glorias Navales | Fijo | 21 de mayo | Ley 2.977 | `https://www.bcn.cl/leychile/Navegar?idNorma=23639` |
| Encuentro de Dos Mundos | Fijo | 12 de octubre | Ley 19.668 (traslado a lunes) | `https://www.bcn.cl/leychile/Navegar?idNorma=160270` |
| Inmaculada Concepción | Fijo | 8 de diciembre | Ley 2.977 | `https://www.bcn.cl/leychile/Navegar?idNorma=23639` |

**NOTA (corregido 2026-03-16):** El idNorma=22209 referenciado anteriormente para Ley 2.977 era INCORRECTO. El correcto es idNorma=23639.
Ley 20.357 NO es de feriados — es la Ley de Crímenes de Lesa Humanidad (error histórico en este documento).
Ley 20.148 (idNorma=257080) estableció el 16 de julio (Virgen del Carmen) en reemplazo de Corpus Christi.
Ley 19.668 (idNorma=160270) estableció el traslado a lunes de San Pedro y San Pablo + Encuentro de Dos Mundos.

**Algoritmo de Pascua (Computus — Meeus/Jones/Butcher):**
Implementado en `scripts/validate.js` como validación automática.
La fecha de Corpus Christi DEBE verificarse algorítmicamente cada año antes de actualizar el JSON.

```javascript
// Verificación mínima: node -e "..."
// Ver scripts/validate.js función computeEaster()
```

#### B2. Feriados existentes en ley pero que NO necesariamente afectan la escuela

Estos feriados existen legalmente pero pueden caer en fin de semana o en períodos de vacaciones.
**Deben verificarse anualmente** para determinar si se agregan al calendar-config.json:

| Feriado | Fecha | 2026 cae en | ¿Afecta escuela 2026? |
|---------|-------|------------|----------------------|
| Día de los Pueblos Indígenas | 21 junio | Domingo | NO (ya es no-escolar) |
| Virgen del Carmen | 16 julio | Sábado | NO (ya es vacaciones) |
| Asunción de la Virgen | 15 agosto | Sábado | NO (fin de semana) |
| Día Iglesias Evangélicas | 31 octubre | Sábado | NO (fin de semana) |
| Todos los Santos | 1 noviembre | Domingo | NO (fin de semana) |

En otros años estos feriados SÍ pueden caer en días de clases → revisar cada noviembre.

#### B3. Fuente última para feriados

**Fuente definitiva:** BCN — Biblioteca del Congreso Nacional, texto vigente de Ley 2.977 y modificaciones.
- URL: `https://www.bcn.cl/leychile/Navegar?idNorma=23639` (idNorma correcto — el 22209 era incorrecto)

**Cross-validación automatizable:** FeriadosApp API (tercero confiable, no oficial)
- URL: `https://www.feriadosapp.com/api`
- Uso: verificar que las fechas del JSON coinciden con los feriados legales del año

**No existe API oficial del gobierno chileno para feriados.**

---

### C. DATOS COMPUTADOS (dinámicos en browser)

| Stat | Cálculo | Fuente datos |
|------|---------|-------------|
| Semana del año escolar | `Math.ceil((hoy - schoolStart) / 7)` | `window.CALENDAR_CONFIG.schoolStart` (ISO) |
| Días para vacaciones | `winterStart - hoy` | `window.CALENDAR_CONFIG.winterStart` (ISO) |
| Próximo feriado | Primer feriado ≥ hoy en array | `window.CALENDAR_CONFIG.feriados[]` |

Todos los cálculos son client-side (app.js). No requieren fuente externa en tiempo real.

---

### D. ESTRUCTURA GEOPOLÍTICA

| Dato | Fuente | Riesgo de cambio |
|------|--------|-----------------|
| 16 regiones de Chile | Ley 21.074 (2018, creó Ñuble) | Bajo. Proyecto de Región de Aconcagua (Ley 21.468) podría materializarse |
| Nombres oficiales | Decretos presidenciales | Muy bajo |
| Slugs de URL | Internos (definidos en pages.json) | No aplica |

Si se crea una nueva región, se requiere: nuevo slug en pages.json + nuevo chip en index.html + nueva página generada.

---

## 2. JERARQUÍA DE FUENTES (pirámide)

```
Nivel 1 (máxima autoridad):
  └── Diario Oficial de Chile (diarioficial.cl)
      → Resoluciones Exentas Mineduc
      → Leyes (BCN: bcn.cl/leychile)

Nivel 2 (publicación oficial derivada):
  └── mineduc.cl/resoluciones-de-calendarios-escolares-regionales-{AÑO}/
      → PDFs regionales en [region].mineduc.cl
      → ayudamineduc.cl/ficha/calendarios-escolares-regionales

Nivel 3 (fuente operativa interna — el repo git):
  └── data/pages.json (editado directamente, o vía pipeline PDF con --fix)
      data/calendar-config.json

Nivel 4 (artefactos generados, NUNCA editar):
  └── public/js/regions-data.js
      public/js/calendar-config.js
      public/region/[slug]/index.html (x16)
      public/health.json
```

---

## 3. PROTOCOLO DE ACTUALIZACIÓN ANUAL

### Trigger: Mineduc publica calendarios del año siguiente (~noviembre)

**El agente autónomo debe detectar:**
```
GET https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-{AÑO+1}/
→ Si la página existe y tiene PDFs → ESCALADA HUMANA OBLIGATORIA
```

**Checklist humano (no automatizable):**
- [ ] Descargar PDFs de las 16 regiones (o el centralizado si existe)
- [ ] Extraer fechas de inicio, vacaciones invierno, fin de año por región
- [ ] Verificar Corpus Christi = Pascua + 60 (usar algoritmo, no copiar del año anterior)
- [ ] Verificar San Pedro y San Pablo: ¿cae sáb/dom? → mover al lunes
- [ ] Verificar qué feriados "secundarios" caen en días de clases ese año nuevo
- [ ] Actualizar `data/pages.json` (16 regiones) — directo o vía pipeline PDF (`extract-pdf.yml` con --fix)
- [ ] Actualizar `data/calendar-config.json` (year, fechas, feriados) + extender tabla SOLSTICIO en check-feriados.js
- [ ] Actualizar FAQ hardcodeadas en index.html (fechas en texto de `<details>`)
- [ ] Actualizar Schema.org JSON-LD en index.html (fechas en `acceptedAnswer`)
- [ ] Actualizar landings estáticas: vacaciones-invierno-{AÑO}.html, cuando-empiezan-clases-{AÑO}.html
- [ ] `npm run generate` + `node scripts/validate.js` + `node scripts/check-feriados.js` → push a main (deploya)
- [ ] Verificar health.json: dataYear correcto

---

## 4. MONITOREO AUTOMÁTICO (agente autónomo)

### Frecuencia diaria:
```
GET https://calendarioescolar.cl/health.json
→ status = "ok"
→ dataYear = año actual
→ generatedDate < 30 días
```

### Frecuencia semanal:
- Confirmar que GitHub Action sync-deploy.yml ejecutó sin errores
- Verificar que `https://calendarioescolar.cl/` carga correctamente

### Frecuencia mensual (octubre-enero):
- Detectar publicación de nuevos calendarios en Mineduc:
  `https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-{AÑO+1}/`
- Si la página aparece → NOTIFICAR HUMANO INMEDIATAMENTE

### Escaladas obligatorias al humano:
- Nueva Resolución Exenta detectada en Mineduc
- health.json → dataYear incorrecto
- Cualquier error de deploy en GitHub Actions
- Cambio legislativo en feriados (requiere suscripción a alertas BCN)

---

## 5. ERRORES IDENTIFICADOS Y CORREGIDOS (2026-03-12)

### ERROR CORREGIDO: Corpus Christi 2026

**Problema:** `data/calendar-config.json` y `public/index.html` tenían Corpus Christi el 8 de junio (lunes).

**Causa raíz:** Dato copiado de 2023 (Pascua 2023 = 9 abril, Corpus Christi 2023 = 8 junio) sin recalcular para 2026.

**Corrección:**
- Pascua 2026 = 5 de abril (domingo) — calculado con algoritmo Meeus/Jones/Butcher
- Corpus Christi 2026 = 5 abril + 60 días = **4 de junio (jueves)**
- Archivos corregidos: `data/calendar-config.json`, `public/index.html`

**Verificación:** `node -e "var p=new Date('2026-04-05'); p.setUTCDate(p.getUTCDate()+60); console.log(p.toISOString().split('T')[0])"`
Resultado: `2026-06-04` ✓

### CONFIRMADO CORRECTO: Tabla de 7 feriados en período escolar

Los 4 feriados que inicialmente parecían "faltantes" (Pueblos Indígenas, Asunción, Iglesias Evangélicas, Todos los Santos) caen todos en fin de semana en 2026 → no afectan la escuela → la tabla de 7 feriados es correcta para 2026.

**Deben verificarse anualmente** (en otros años pueden caer en días de clase).

---

## 6. RIESGOS CRÍTICOS (premortem)

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Mineduc publica calendario tarde (enero) | Media | Alto | Monitorear desde octubre |
| PDF en imagen escaneada (no parseable) | Baja | Alto | Lectura humana obligatoria |
| Circular regional modifica fechas post-PDF | Baja | Alto | Revisar portales regionales además del central |
| Corpus Christi calculado de año anterior | Alta | Alto | Validación algorítmica automática en validate.js |
| Nuevo feriado por ley del Congreso | Muy baja | Medio | Suscribirse a alertas BCN |
| GOOGLE_API_KEY (Gemini) expira | Media | Alto | Monitorear health.json + fecha de generación |
| Nueva región creada por ley | Muy baja | Medio | Revisión anual de estructura geopolítica |
| Sitio publica dato incorrecto a usuarios | Media | Crítico | Validación en validate.js + disclaimer en footer |

**Disclaimer recomendado en footer del sitio:**
> "Fechas basadas en la Resolución Exenta del Ministerio de Educación. Siempre confirma con tu establecimiento educacional."

---

## 7. DEUDA TÉCNICA PENDIENTE

| Item | Descripción | Prioridad |
|------|------------|-----------|
| FAQ hardcodeadas | Fechas en `<details>` de index.html no se generan desde datos | Alta |
| Schema.org hardcodeado | `acceptedAnswer` en JSON-LD no se actualiza automáticamente | Media |
| Landings con año en nombre | `vacaciones-invierno-2026.html` requiere nuevo archivo cada año | Media |
| validate.js sin verificación Pascua | No valida que Corpus Christi/Viernes Santo sean correctos | Alta |
| Tabla feriados no generada | La tabla de index.html está hardcodeada, no viene del JSON | Alta |

---

*Fuentes consultadas en esta auditoría:*
- Mineduc: `https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-2026/`
- Ayuda Mineduc: `https://www.ayudamineduc.cl/ficha/calendarios-escolares-regionales`
- Diario Oficial: `https://www.diarioficial.cl/`
- BCN — Ley 2.977: `https://www.bcn.cl/leychile/Navegar?idNorma=23639`
- FeriadosApp API: `https://www.feriadosapp.com/api`
- Datos abiertos Mineduc: `https://centroestudios.mineduc.cl/datos-abiertos/`
