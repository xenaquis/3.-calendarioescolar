# Sistema de Validación Robusto — calendarioescolar.cl

## Idea Matriz

> **Trazabilidad Total**: cada dato mostrado al usuario debe ser trazable a una fuente oficial versionada, verificado periódicamente contra esa fuente, y transparente en su estado de verificación ante el usuario final.

El sitio calendarioescolar.cl tiene un solo producto: **información correcta sobre fechas escolares**. Si un dato es incorrecto, el sitio no tiene valor. Por tanto, el sistema de validación no es un accesorio — es la infraestructura core.

---

## Diagnóstico del Sistema Actual

### Lo que YA existe (y funciona bien)

| Componente | Qué hace | Cobertura |
|---|---|---|
| `validate.js` | Integridad estructural de JSON (16 regiones, campos requeridos, formatos ISO, coherencia cronológica) | Estructura ✓, Contenido ✗ |
| `build.sh` | Verificación pre-deploy (placeholders, existencia de archivos) | Build ✓ |
| `calendar-monitor` Worker | Monitoreo semanal de 4 leyes BCN via XML + DeepSeek para análisis de cambios | Feriados ✓, Fechas escolares ✗ |
| `health.json` | Metadata de generación (fecha, hashes, conteos) | Freshness ✓, Accuracy ✗ |
| `sync-from-sheet.js` | Sync Google Sheet → JSON | Transporte ✓, Validación de contenido ✗ |

### Lo que FALTA (gaps críticos)

1. **No hay registro de afirmaciones**: El sitio hace ~40+ afirmaciones factuales pero ninguna está mapeada a su fuente oficial.
2. **No hay verificación de contenido**: `validate.js` verifica que "2026-03-02" es una fecha válida, pero no verifica que el inicio de clases sea efectivamente el 2 de marzo según Mineduc.
3. **No hay monitoreo de fuentes de fechas escolares**: El monitor vigila leyes de feriados (BCN), pero NO vigila la Resolución Mineduc que define inicio/fin de clases y vacaciones.
4. **No hay transparencia**: El usuario no sabe cuándo se verificó la información ni contra qué fuente.
5. **No hay degradación visible**: Si una fuente cae, el sitio sigue mostrando datos sin indicar que no pudo re-verificar.

---

## Arquitectura Propuesta — 4 Fases

```
┌─────────────────────────────────────────────────────────────┐
│                    FASE 1: CIMIENTOS                        │
│         Registro estructurado de afirmaciones               │
│         afirmaciones.json — cada dato → fuente oficial      │
│                                                             │
│  Input: Auditoría manual del sitio                          │
│  Output: afirmaciones.json (~45 claims con source_url,      │
│          source_type, extraction_method, valor_esperado)     │
├─────────────────────────────────────────────────────────────┤
│                    FASE 2: SENSORES                         │
│         Monitor de salud de fuentes                         │
│         check-sources.js — ¿las URLs fuente responden?      │
│                                                             │
│  Input: afirmaciones.json → URLs únicas                     │
│  Output: source-health.json (status, latencia, último OK)   │
│  Cron: Semanal (GitHub Actions)                             │
├─────────────────────────────────────────────────────────────┤
│                    FASE 3: VERIFICADOR                      │
│         Verificación de contenido via DeepSeek              │
│         verify-content.js — ¿el dato del sitio coincide     │
│         con lo que dice la fuente oficial?                   │
│                                                             │
│  Input: afirmaciones.json + contenido de fuentes            │
│  Output: verification-results.json (CORRECTO/INCORRECTO/    │
│          NO_VERIFICABLE + evidence)                          │
│  Cron: Mensual o post-cambio en fuentes                     │
├─────────────────────────────────────────────────────────────┤
│                    FASE 4: TRANSPARENCIA                    │
│         Indicadores de verificación en frontend             │
│         verification-status.js (IIFE) + verificacion.json   │
│                                                             │
│  Input: verification-results.json + source-health.json      │
│  Output: Badges visuales "Verificado al DD/MM/YYYY"         │
│          + enlace a fuente oficial                           │
└─────────────────────────────────────────────────────────────┘
```

### Interacción con el sistema actual

```
SISTEMA ACTUAL                          SISTEMA NUEVO
─────────────                           ─────────────
validate.js (estructura)      ←─────→   afirmaciones.json (contenido)
  ↓ ambos bloquean build                  ↓
build.sh                                check-sources.js (salud fuentes)
  ↓                                       ↓
calendar-monitor (leyes BCN)  ←─────→   verify-content.js (contenido vs fuente)
  ↓                                       ↓
health.json (generación)      ←─────→   verificacion.json (verificación)
                                          ↓
                                        Frontend badges
```

**Principio de diseño**: El sistema nuevo NO reemplaza al actual. Lo complementa. `validate.js` sigue verificando estructura; el sistema nuevo verifica *contenido contra fuentes oficiales*.

---

## Inventario de Afirmaciones del Sitio

El sitio hace afirmaciones en estas categorías:

### Categoría A: Fechas del Año Escolar (~8 afirmaciones)
- Inicio de clases: 2 de marzo 2026
- Inicio vacaciones de invierno: 11 de julio 2026
- Fin vacaciones de invierno: 25 de julio 2026
- Fin año escolar: 11 de diciembre 2026
- Días de vacaciones de invierno por región (16 variantes)
- **Fuente**: Resolución Exenta Mineduc (publicada ~noviembre año anterior)
- **Dificultad**: PDF, no API. Cambia cada año.

### Categoría B: Feriados Nacionales (~14 afirmaciones)
- Fecha, nombre, tipo, ley que lo establece
- Traslado a lunes (si aplica)
- Contexto escolar (en período de clases o no)
- **Fuente**: Leyes BCN (XML API disponible)
- **Dificultad**: Baja. API estable, ya monitoreada por calendar-monitor.

### Categoría C: Información Derivada (~15 afirmaciones)
- Conteo de días de vacaciones
- "Quedan X días para vacaciones de invierno"
- Próximo feriado
- Días hábiles de clases por semestre
- **Fuente**: Calculada a partir de A + B
- **Dificultad**: Verificación aritmética, no requiere fuente externa.

### Categoría D: Información Contextual (~8 afirmaciones)
- Número de estudiantes afectados
- Cobertura regional
- Referencias a normativa general (LGE, DFL 2)
- **Fuente**: Mineduc estadísticas, BCN
- **Dificultad**: Media. Fuentes estables pero formato variable.

---

## Desafíos Identificados y Estrategia

### Desafío 1: Dispersión de formato de fuentes

| Fuente | Formato | Accesibilidad | Estrategia |
|---|---|---|---|
| Resolución Mineduc | PDF | Baja (cambia URL anual) | Snapshot manual + hash + URL archivada |
| BCN XML | XML/API | Alta | Fetch automático (ya implementado) |
| BCN HTML | HTML | Media | Fetch + extracción selectiva |
| Mineduc estadísticas | HTML/PDF | Baja | Snapshot + verificación manual |

**Decisión arquitectónica**: No intentar scraping universal. Clasificar fuentes en 3 tiers:
- **Tier 1 (automático)**: BCN XML → verificación programática completa
- **Tier 2 (semi-automático)**: HTML estable → fetch + DeepSeek para extracción
- **Tier 3 (manual-asistido)**: PDF/HTML inestable → snapshot local + hash + alerta si hash cambia

### Desafío 2: Problemas de scraping

**Estrategia**: No hacer scraping agresivo. En su lugar:
1. Para fuentes Tier 1: API directa (BCN XML)
2. Para fuentes Tier 2: Fetch del HTML, extraer texto, enviar a DeepSeek para comparación
3. Para fuentes Tier 3: Almacenar snapshot del PDF/HTML como archivo local, calcular hash. Si el hash cambia → alerta para revisión humana. No intentar extracción automática de PDFs.

### Desafío 3: Alucinaciones de la IA

**Estrategia de mitigación en 3 capas**:
1. **Capa 1 — Verificación determinista primero**: Para categorías B (feriados) y C (derivados), usar comparación programática directa (string matching, cálculo aritmético). Sin IA. Cobertura esperada: ~60% de afirmaciones.
2. **Capa 2 — IA con contexto inyectado**: Para categoría A (fechas escolares) y D (contextual), enviar el texto fuente completo a DeepSeek como contexto. Prohibir uso de conocimiento paramétrico. Prompt: "Basándote EXCLUSIVAMENTE en el texto proporcionado..."
3. **Capa 3 — Validación cruzada**: Si DeepSeek dice CORRECTO pero el dato no aparece literalmente en el texto fuente → marcar como NO_VERIFICABLE en vez de CORRECTO. Sesgo conservador.

**Anti-alucinación adicional**:
- Exigir que DeepSeek cite la frase exacta del texto fuente que respalda su veredicto
- Si la cita no se encuentra en el texto fuente via string matching → descartar veredicto
- Log completo de prompt + response para auditoría

---

## Agentes Especialistas

El diseño se divide en 4 fases, cada una con su documento detallado:

| Fase | Documento | Agente Especialista | Entregable Principal |
|---|---|---|---|
| 1 | `FASE-1-registro-afirmaciones.md` | Ingeniero de Datos | `data/afirmaciones.json` |
| 2 | `FASE-2-monitor-fuentes.md` | Ingeniero de Infraestructura | `scripts/check-sources.js` + workflow |
| 3 | `FASE-3-verificacion-contenido.md` | Especialista IA/NLP | `scripts/verify-content.js` + workflow |
| 4 | `FASE-4-transparencia-frontend.md` | Ingeniero Frontend | IIFE + CSS + JSON generado |

### Dependencias entre fases

```
Fase 1 ──→ Fase 2 ──→ Fase 3 ──→ Fase 4
  │           │           │
  │           └───────────┴──→ Fase 4 (parcial)
  │
  └──→ Puede implementarse solo como mejora documental
```

- **Fase 1 es prerequisito** de todas las demás
- **Fase 2 y 3** pueden implementarse en paralelo después de Fase 1
- **Fase 4** necesita output de Fase 2 y/o Fase 3

---

## Escalabilidad: Páginas Nuevas y Crecimiento del Sitio

### Problema identificado

El diseño original acopla claims a páginas (`displayed_in: ["index.html"]`). Esto significa que si se agrega una página nueva (ej: `becas-2026.html`, `utiles-escolares.html`, `pae-2026.html`), el sistema de validación no se entera automáticamente de las nuevas afirmaciones.

### Solución: Modelo claim-centric, no page-centric

**Inversión del acoplamiento**: las claims se vinculan a **data paths** (dónde vive el dato en los JSON), no a páginas. Las páginas declaran qué datos consumen. La relación se resuelve en build time.

```
ANTES (no escala):
  claim → displayed_in: ["index.html", "vacaciones.html"]
  ❌ Página nueva usa el dato pero nadie actualiza displayed_in

DESPUÉS (escala):
  claim → data_path: "calendar-config.json → winterStart"
  página → declara: data-claims="winterStart,winterEnd"
  build → resuelve automáticamente qué claims cubren qué páginas
  ✓ Página nueva declara sus datos → queda automáticamente cubierta
```

### Mecanismo concreto: 3 capas de escalabilidad

#### Capa 1: Páginas declaran sus datos

Cada página HTML incluye un meta-tag o comentario que lista los data paths que consume:

```html
<!-- En cada página estática -->
<meta name="claim-data" content="schoolStart,winterStart,winterEnd,schoolEnd,feriados">

<!-- En template.html (páginas regionales) -->
<meta name="claim-data" content="schoolStart,winterStart,winterEnd,schoolEnd,inicio,vacacionesInicio,vacacionesFin,finAno,diasVacacionesInvierno">
```

Esto es la "declaración de dependencias" de la página respecto a datos verificables.

#### Capa 2: Claims se vinculan a data paths, no a páginas

En `afirmaciones.json`, `displayed_in` se vuelve campo **calculado**, no manual:

```json
{
  "id": "fecha-inicio-clases",
  "data_path": "calendar-config.json → schoolStart",
  "data_key": "schoolStart",
  "displayed_in": ["AUTO — se calcula en build time"]
}
```

El script de generación escanea todas las páginas HTML, lee su `meta[name=claim-data]`, y construye el mapping automáticamente.

#### Capa 3: Detector de claims huérfanas (build-time)

En `validate.js` o `build.sh`, agregar un check:

```
Para cada página HTML en public/:
  1. Leer meta[name=claim-data] → lista de data_keys
  2. Para cada data_key:
     ¿Existe un claim en afirmaciones.json con ese data_key?
     Si NO → ERROR: "página X usa dato Y pero no hay claim registrado"

Para cada claim en afirmaciones.json:
  ¿Alguna página declara su data_key?
  Si NO → WARNING: "claim X no es usada por ninguna página"
```

Esto significa:
- **Página nueva sin claims** → el build FALLA con error explícito
- **Claim sin página** → warning (puede ser un claim obsoleto)
- **Página nueva con claims existentes** → funciona automáticamente

### Categorías extensibles

Las categorías A-D se reemplazan por un sistema de tags abierto:

```json
{
  "id": "monto-beca-indigena",
  "tags": ["becas", "montos", "mineduc"],
  "verification_method": "deepseek",
  "source_id": "mineduc-becas-2026"
}
```

Esto permite que páginas nuevas sobre temas nuevos (becas, PAE, útiles) declaren sus fuentes sin forzar una taxonomía rígida.

### Flujo para agregar una página nueva

```
1. Crear la página HTML
2. Agregar <meta name="claim-data" content="...">
   con los data_keys que usa
3. Si los claims ya existen → listo, funciona automáticamente
4. Si son datos nuevos:
   a. Agregar la fuente a afirmaciones.json → sources
   b. Agregar los claims a afirmaciones.json → claims
   c. El build verifica coherencia
5. Fases 2-4 cubren los nuevos claims automáticamente
```

**Costo de agregar una página**: ~5 minutos si usa datos existentes, ~30 minutos si introduce datos nuevos con fuente nueva.

---

## Restricciones Técnicas (heredadas del proyecto)

- CERO frameworks, CERO npm dependencies, CERO bundlers
- JavaScript: IIFE, `var`, vanilla
- Verificación server-side: Node.js stdlib (scripts/) o Cloudflare Workers
- DeepSeek API: solo en CI/CD (GitHub Actions) o Workers, nunca en frontend
- Frontend: solo lee JSON pre-generados, nunca llama APIs
- Archivos generados van a `public/` o `data/`
- Scripts van a `scripts/`

---

## Métricas de Éxito

| Métrica | Objetivo | Medición |
|---|---|---|
| Cobertura de trazabilidad | 100% de afirmaciones tienen fuente documentada | `afirmaciones.json` completo |
| Cobertura de verificación automática | ≥60% verificable sin IA | Categorías B+C cubiertas |
| Detección de fuente rota | ≤7 días | Cron semanal + alerta |
| Detección de contenido desactualizado | ≤30 días | Cron mensual + DeepSeek |
| Transparencia al usuario | 100% de secciones con badge de verificación | Auditoría visual |
| Falsos positivos IA | <5% | Validación cruzada de citas |
| Costo mensual DeepSeek | <$0.10 USD | ~45 claims × prompt pequeño |

---

## Orden de Implementación Recomendado

1. **Fase 1** (~2h): Crear `afirmaciones.json`. Es trabajo manual-intelectual, no código. Pero es el cimiento de todo.
2. **Fase 2** (~3h): Monitor de fuentes. Valor inmediato: saber si una fuente murió.
3. **Fase 4** (~2h): Transparencia frontend. Puede funcionar solo con Fase 1 (mostrando "fuente: X" sin verificación automática).
4. **Fase 3** (~4h): Verificación con IA. La más compleja, la de mayor valor, pero necesita las anteriores.

---

## Documentos de Referencia

- `validacion/FASE-1-registro-afirmaciones.md` — Diseño completo del registro de afirmaciones
- `validacion/FASE-2-monitor-fuentes.md` — Diseño del monitor de salud de fuentes
- `validacion/FASE-3-verificacion-contenido.md` — Diseño del verificador de contenido con IA
- `validacion/FASE-4-transparencia-frontend.md` — Diseño de los indicadores frontend
- `BLUEPRINT.md` — Estado actual del proyecto
- `workers/calendar-monitor/index.js` — Monitor de leyes existente (no reemplazar)
