# Fase 3: Verificación de Contenido via IA

> **Agente Especialista**: Especialista IA/NLP
> **Idea Matriz aplicada**: Verificar que lo que el sitio dice coincide con lo que la fuente oficial dice. No basta con que la fuente esté viva (Fase 2) — hay que comparar el contenido.

---

## Objetivo

Crear un sistema que compara automáticamente cada afirmación del sitio contra el contenido real de su fuente oficial, usando DeepSeek para fuentes complejas y verificación determinista para datos simples.

---

## Problema que Resuelve

Hoy, si Mineduc publica una nueva resolución que cambia el inicio de clases de marzo 2 a marzo 3, el sitio seguirá mostrando marzo 2 indefinidamente. El calendar-monitor vigila leyes de feriados, pero NO verifica que las fechas escolares del sitio coincidan con la resolución Mineduc.

---

## Arquitectura de Verificación en 3 Capas

```
              Afirmación del sitio
                      │
                      ▼
         ┌──── Capa 1: Determinista ────┐
         │  ¿Es verificable sin IA?     │
         │  • Fecha fija (siempre 1 mayo)│
         │  • Cálculo aritmético        │
         │  • Valor en XML BCN          │
         │  Cobertura: ~60%             │
         └──────────┬───────────────────┘
                    │ NO verificable
                    ▼
         ┌──── Capa 2: IA con contexto ─┐
         │  DeepSeek con texto fuente    │
         │  inyectado como contexto      │
         │  Prompt: "basándote SOLO en   │
         │  el texto proporcionado..."   │
         │  Cobertura: ~35%             │
         └──────────┬───────────────────┘
                    │ IA no puede verificar
                    ▼
         ┌──── Capa 3: Manual ──────────┐
         │  Marcar como NO_VERIFICABLE  │
         │  Alertar para revisión humana │
         │  Cobertura: ~5%             │
         └──────────────────────────────┘
```

### Veredictos posibles

| Veredicto | Significado | Acción |
|---|---|---|
| `CORRECTO` | El dato del sitio coincide con la fuente | Ninguna |
| `INCORRECTO` | El dato del sitio contradice la fuente | ALERTA CRÍTICA — corregir dato |
| `NO_VERIFICABLE` | No se pudo verificar automáticamente | Alerta informativa — verificar manualmente |
| `FUENTE_INACCESIBLE` | La fuente no respondió | No verificar — esperar a que vuelva |

**NO existe veredicto "IMPRECISO"**. Si la IA no está segura → `NO_VERIFICABLE`. Esto es una lección del sistema de las40horas.

---

## Entregables

### 1. `scripts/verify-content.js`

```javascript
// Pseudocódigo del verificador

// === CONFIGURACIÓN ===
var DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
var DEEPSEEK_MODEL = 'deepseek-chat';

// === CAPA 1: VERIFICACIÓN DETERMINISTA ===

function verifyDeterministic(claim) {
  // Feriados de fecha fija
  if (claim.verification_method === 'deterministic' && claim.category === 'feriados') {
    // Para feriados con fecha fija (1 mayo, 21 mayo, 18 sep, etc.)
    // Verificar que la fecha en calendar-config.json coincide
    var feriadoData = findFeriadoInConfig(claim.displayed_value);
    if (!feriadoData) {
      return { verdict: 'INCORRECTO', evidence: 'Feriado no encontrado en calendar-config.json' };
    }
    return { verdict: 'CORRECTO', evidence: 'Fecha fija confirmada: ' + claim.displayed_value };
  }

  // Verificación aritmética
  if (claim.verification_method === 'arithmetic') {
    // Ejemplo: diasVacacionesInvierno = winterEnd - winterStart
    var result = evaluateArithmetic(claim.expected_check);
    if (result.matches) {
      return { verdict: 'CORRECTO', evidence: claim.expected_check + ' = ' + result.value };
    } else {
      return { verdict: 'INCORRECTO', evidence: 'Esperado: ' + result.expected + ', Actual: ' + result.actual };
    }
  }

  // No se puede verificar deterministamente
  return null;
}

// === CAPA 2: VERIFICACIÓN CON IA ===

function verifyWithDeepSeek(claim, sourceContent) {
  var prompt = buildVerificationPrompt(claim, sourceContent);
  var response = callDeepSeek(prompt);

  // Validación cruzada: ¿la cita existe en el texto fuente?
  if (response.verdict === 'CORRECTO' && response.source_quote) {
    var quoteFound = sourceContent.indexOf(response.source_quote) !== -1;
    if (!quoteFound) {
      // La IA citó algo que no está en el texto → no confiar
      return {
        verdict: 'NO_VERIFICABLE',
        evidence: 'IA reportó CORRECTO pero la cita no se encontró en el texto fuente. Posible alucinación.',
        ai_response: response
      };
    }
  }

  return {
    verdict: response.verdict,
    evidence: response.evidence,
    source_quote: response.source_quote,
    ai_response: response
  };
}

function buildVerificationPrompt(claim, sourceContent) {
  return {
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: 'system',
        content: [
          'Eres un verificador de datos del calendario escolar chileno.',
          'Tu ÚNICA tarea es comparar una afirmación con un texto fuente oficial.',
          '',
          'REGLAS ESTRICTAS:',
          '1. Basarte EXCLUSIVAMENTE en el texto proporcionado. NUNCA usar conocimiento propio.',
          '2. Si el texto no contiene información suficiente para verificar → NO_VERIFICABLE.',
          '3. Si el texto contradice la afirmación → INCORRECTO.',
          '4. Si el texto confirma la afirmación → CORRECTO + cita textual exacta.',
          '5. NO existe el veredicto "IMPRECISO" o "PARCIAL". Solo CORRECTO, INCORRECTO, NO_VERIFICABLE.',
          '6. La cita debe ser TEXTUAL del documento. No parafrasear.',
          '',
          'Responde en JSON estricto:'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          '=== AFIRMACIÓN A VERIFICAR ===',
          'ID: ' + claim.id,
          'Afirmación: ' + claim.claim,
          'Valor mostrado: ' + claim.displayed_value,
          'Referencia esperada: ' + (claim.source_reference || 'No especificada'),
          '',
          '=== TEXTO FUENTE OFICIAL ===',
          sourceContent.substring(0, 4000),
          '',
          '=== RESPUESTA (JSON) ===',
          '{',
          '  "verdict": "CORRECTO|INCORRECTO|NO_VERIFICABLE",',
          '  "source_quote": "cita textual exacta del texto fuente que respalda el veredicto, o null",',
          '  "evidence": "explicación en 1-2 oraciones de por qué este veredicto",',
          '  "confidence": 0.0-1.0',
          '}'
        ].join('\n')
      }
    ],
    temperature: 0.1,
    max_tokens: 500
  };
}

// === CAPA 3: NO VERIFICABLE ===
// (no requiere código — es el fallback cuando Capa 1 y 2 no pueden verificar)

// === FLUJO PRINCIPAL ===

function main() {
  var afirmaciones = loadJSON('data/afirmaciones.json');
  var sourceHealth = loadJSON('data/source-health.json');
  var results = [];

  afirmaciones.claims.forEach(function(claim) {
    var result = {
      id: claim.id,
      claim: claim.claim,
      displayed_value: claim.displayed_value,
      verified_at: new Date().toISOString(),
      verified_by: null,
      verdict: null,
      evidence: null,
      source_quote: null
    };

    // ¿La fuente está accesible?
    var source = afirmaciones.sources[claim.source_id];
    if (source && sourceHealth.sources[source.id] &&
        sourceHealth.sources[source.id].status === 'broken') {
      result.verdict = 'FUENTE_INACCESIBLE';
      result.evidence = 'Fuente ' + source.id + ' no disponible';
      result.verified_by = 'source_health';
      results.push(result);
      return;
    }

    // Capa 1: Intentar verificación determinista
    var deterministicResult = verifyDeterministic(claim);
    if (deterministicResult) {
      result.verdict = deterministicResult.verdict;
      result.evidence = deterministicResult.evidence;
      result.verified_by = 'deterministic';
      results.push(result);
      return;
    }

    // Capa 2: Verificación con IA (solo si la fuente tiene contenido accesible)
    if (claim.verification_method === 'deepseek' && source) {
      var sourceContent = fetchSourceContent(source);
      if (sourceContent) {
        var aiResult = verifyWithDeepSeek(claim, sourceContent);
        result.verdict = aiResult.verdict;
        result.evidence = aiResult.evidence;
        result.source_quote = aiResult.source_quote;
        result.verified_by = 'deepseek';
        results.push(result);
        return;
      }
    }

    // Capa 3: No verificable
    result.verdict = 'NO_VERIFICABLE';
    result.evidence = 'No se pudo verificar automáticamente';
    result.verified_by = 'none';
    results.push(result);
  });

  // Generar output
  var output = {
    verified_at: new Date().toISOString(),
    total_claims: results.length,
    correcto: results.filter(r => r.verdict === 'CORRECTO').length,
    incorrecto: results.filter(r => r.verdict === 'INCORRECTO').length,
    no_verificable: results.filter(r => r.verdict === 'NO_VERIFICABLE').length,
    fuente_inaccesible: results.filter(r => r.verdict === 'FUENTE_INACCESIBLE').length,
    results: results
  };

  writeJSON('data/verification-results.json', output);

  // Alertas
  var incorrectos = results.filter(r => r.verdict === 'INCORRECTO');
  if (incorrectos.length > 0) {
    console.log('ALERTA CRITICA: ' + incorrectos.length + ' afirmaciones INCORRECTAS');
    incorrectos.forEach(function(r) {
      console.log('  ' + r.id + ': ' + r.evidence);
    });
    process.exit(1);
  }
}
```

### 2. `data/verification-results.json` (generado automáticamente)

```json
{
  "verified_at": "2026-03-17T10:00:00Z",
  "total_claims": 45,
  "correcto": 38,
  "incorrecto": 0,
  "no_verificable": 5,
  "fuente_inaccesible": 2,
  "results": [
    {
      "id": "fecha-inicio-clases",
      "claim": "El año escolar 2026 comienza el 2 de marzo",
      "displayed_value": "2026-03-02",
      "verified_at": "2026-03-17T10:00:01Z",
      "verified_by": "deepseek",
      "verdict": "CORRECTO",
      "evidence": "La Resolución Exenta establece el inicio del año escolar 2026 para el 2 de marzo",
      "source_quote": "El año escolar lectivo 2026 se iniciará el día 2 de marzo"
    }
  ]
}
```

### 3. `.github/workflows/verify-content.yml`

```yaml
name: Verify Content Against Sources

on:
  schedule:
    - cron: '0 12 1 * *'  # Día 1 de cada mes, 12:00 UTC
  workflow_dispatch:
    inputs:
      force_all:
        description: 'Re-verificar todas las afirmaciones (incluso las ya verificadas)'
        required: false
        default: 'false'
  workflow_run:
    workflows: ["Check Source Health"]
    types: [completed]
    # Se dispara después del check de fuentes, para re-verificar si algo cambió

jobs:
  verify:
    runs-on: ubuntu-latest
    # Solo correr si fue disparado manualmente, por cron, o si el check de fuentes detectó cambios
    if: >
      github.event_name != 'workflow_run' ||
      github.event.workflow_run.conclusion == 'success'
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Verify content
        id: verify
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          FORCE_ALL: ${{ github.event.inputs.force_all || 'false' }}
        run: node scripts/verify-content.js
        continue-on-error: true

      - name: Commit results
        if: always()
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/verification-results.json
          git diff --staged --quiet || git commit -m "chore: update verification results [skip ci]"
          git push

      - name: Alert on INCORRECTO
        if: steps.verify.outcome == 'failure'
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          INCORRECTOS=$(node -e "
            var r = require('./data/verification-results.json');
            r.results.filter(function(c) { return c.verdict === 'INCORRECTO'; }).forEach(function(c) {
              console.log('🚨 ' + c.id + ': ' + c.evidence);
            });
          ")

          MSG="🚨 *DATOS INCORRECTOS — calendarioescolar.cl*%0A%0A${INCORRECTOS}%0A%0AAcción requerida: verificar y corregir datos."

          curl -s -X POST \
            "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="${MSG}" \
            -d parse_mode="Markdown"

      - name: Summary
        if: always()
        run: |
          node -e "
            var r = require('./data/verification-results.json');
            console.log('=== VERIFICACIÓN DE CONTENIDO ===');
            console.log('Total: ' + r.total_claims);
            console.log('Correcto: ' + r.correcto);
            console.log('Incorrecto: ' + r.incorrecto);
            console.log('No verificable: ' + r.no_verificable);
            console.log('Fuente inaccesible: ' + r.fuente_inaccesible);
          "
```

---

## Obtención de Contenido por Tipo de Fuente

### Fuentes Tier 1 (BCN XML)

```javascript
function fetchBcnXmlContent(source) {
  // Fetch XML desde API BCN
  var xml = fetchUrl(source.api_endpoint);

  // Extraer texto de artículos (strip XML tags)
  // BCN XML tiene estructura: <norma><articulos><articulo>...</articulo></articulos></norma>
  var textContent = extractTextFromXml(xml);

  return textContent; // Texto plano de los artículos
}
```

### Fuentes Tier 2 (HTML)

```javascript
function fetchHtmlContent(source) {
  var html = fetchUrl(source.url);

  // Extraer texto del contenido principal
  // Buscar <main>, <article>, o <div class="content">
  var mainContent = extractMainContent(html);

  // Strip tags HTML, normalizar whitespace
  var textContent = stripTags(mainContent);

  return textContent;
}
```

### Fuentes Tier 3 (PDF — Mineduc)

```javascript
function fetchPdfContent(source) {
  // NO intentar parsear PDF en CI.
  // Usar el snapshot local si existe.

  if (source.snapshot_local && fs.existsSync(source.snapshot_local + '.txt')) {
    // Pre-requisito: el texto del PDF fue extraído manualmente y guardado como .txt
    return fs.readFileSync(source.snapshot_local + '.txt', 'utf8');
  }

  // Si no hay snapshot de texto → NO_VERIFICABLE
  return null;
}
```

**Flujo para PDFs de Mineduc**:
1. Cuando se publica la resolución (~noviembre), descargar manualmente el PDF
2. Extraer texto del PDF (copy-paste o herramienta local) → guardar como `data/snapshots/mineduc-resolucion-2026.txt`
3. El verificador usa este texto como fuente
4. Si el PDF en la URL cambia (detectado por Fase 2) → re-extraer texto manualmente

---

## Estrategia Anti-Alucinación (Detalle)

### Principio: La IA es culpable hasta que demuestre inocencia

1. **Contexto inyectado, no paramétrico**: El prompt incluye el texto completo de la fuente. Se le prohíbe usar conocimiento propio.

2. **Validación de citas**: Si la IA dice `CORRECTO` y proporciona una `source_quote`:
   - Buscar la cita exacta en el texto fuente (string indexOf)
   - Si no se encuentra → descartar veredicto, marcar como `NO_VERIFICABLE`
   - Tolerancia: normalizar whitespace y acentos antes de comparar

3. **Temperatura mínima**: `temperature: 0.1` para minimizar varianza.

4. **Sin categoría gris**: No existe "IMPRECISO" ni "PARCIAL". La IA decide CORRECTO, INCORRECTO, o admite que no puede verificar.

5. **Log completo**: Guardar prompt + response para cada verificación en un archivo de log (`data/verification-log.jsonl`). Esto permite auditar las decisiones de la IA.

6. **Umbral de confianza**: Si la IA reporta `confidence < 0.7` → tratar como `NO_VERIFICABLE` independientemente del veredicto.

### Datos que NUNCA pasan por la IA

| Tipo de dato | Método de verificación | Por qué no necesita IA |
|---|---|---|
| Feriado de fecha fija | Comparación de string | "1 de mayo" es siempre "1 de mayo" |
| Cálculo aritmético | Evaluación directa | `winterEnd - winterStart = 14` |
| Conteo de regiones | `pages.json.length === 16` | No necesita interpretación |
| Año del calendario | `calendarConfig.year === 2026` | Comparación directa |
| Feriado en XML BCN | XPath/regex en XML | Datos estructurados, no necesitan NLP |

### Datos que SÍ pasan por la IA

| Tipo de dato | Por qué necesita IA | Riesgo de alucinación |
|---|---|---|
| Inicio de clases según Resolución Mineduc | PDF con lenguaje legal | Medio — texto suele ser explícito |
| Vacaciones según Resolución Mineduc | PDF con lenguaje legal | Medio |
| Contexto escolar de feriados | Interpretación de si cae en período escolar | Bajo — cálculo simple una vez extraída la fecha |
| Estadísticas de cobertura | HTML con tablas | Medio — formato puede variar |

---

## Manejo de Costos

### Estimación de costo DeepSeek

| Variable | Valor |
|---|---|
| Claims que pasan por IA | ~15 (de 45 totales) |
| Tokens por prompt (contexto + claim) | ~2000 input |
| Tokens por respuesta | ~200 output |
| Costo input DeepSeek | ~$0.14/M tokens |
| Costo output DeepSeek | ~$0.28/M tokens |
| **Costo por ejecución** | **~$0.005 USD** |
| **Costo mensual (1x/mes)** | **~$0.005 USD** |
| **Costo anual** | **~$0.06 USD** |

El costo es negligible. No es necesario optimizar.

### Optimización opcional: Cache de verificación

Si una fuente no cambió (hash idéntico en Fase 2) y la afirmación no cambió, reusar el resultado anterior:

```javascript
// Antes de verificar con IA
if (previousResult &&
    previousResult.verdict === 'CORRECTO' &&
    !sourceHealth.sources[source.id].hash_changed &&
    claim.displayed_value === previousResult.displayed_value) {
  // Reusar resultado anterior
  result.verdict = 'CORRECTO';
  result.evidence = previousResult.evidence + ' (cache — fuente sin cambios)';
  result.verified_by = 'cache';
  return;
}
```

---

## Implementación Paso a Paso

### Paso 1: Verificadores deterministas (~1h)

1. Función para verificar fechas fijas (string matching)
2. Función para evaluar expresiones aritméticas simples
3. Función para buscar valores en XML BCN
4. Tests con datos actuales

### Paso 2: Integración DeepSeek (~1.5h)

1. Función `callDeepSeek(prompt)` usando `https.request` nativo
2. Prompt engineering con las reglas anti-alucinación
3. Parser de respuesta JSON
4. Validación cruzada de citas
5. Test con 2-3 claims reales

### Paso 3: Orquestador principal (~1h)

1. Flujo principal: cargar datos → Capa 1 → Capa 2 → Capa 3
2. Generación de `verification-results.json`
3. Lógica de alertas
4. Lógica de cache

### Paso 4: Workflow GitHub Actions (~30min)

1. Cron mensual + trigger por cambio de fuentes
2. Alertas Telegram
3. Commit automático de resultados

### Paso 5: Extracción de texto del PDF Mineduc (~30min, manual)

1. Descargar el PDF de la resolución vigente
2. Extraer texto (copy-paste)
3. Guardar como `data/snapshots/mineduc-resolucion-2026.txt`
4. Ejecutar verificación completa

---

## Premortem Pesimista

### Riesgo 1: DeepSeek alucina un CORRECTO con cita inventada
**Escenario**: La IA dice que el inicio de clases es correcto y cita "El año escolar se iniciará el 2 de marzo" — pero esa frase no está en el texto de la resolución (la resolución dice algo ligeramente diferente).
**Probabilidad**: Media (modelos LLM frecuentemente parafrasean).
**Impacto**: Falso positivo — se cree verificado algo que no lo está.
**Mitigación**:
- Validación cruzada de citas (ya descrita): indexOf estricto
- Normalización antes de comparar: lowercase, quitar acentos, normalizar espacios
- Si la cita normalizada tiene >80% de overlap con algún segmento del texto (fuzzy match con ventana deslizante) → aceptar. Si <80% → `NO_VERIFICABLE`.
- Implementar `data/verification-log.jsonl` con prompt completo + respuesta para auditoría posterior

### Riesgo 2: Cambio de API de DeepSeek
**Escenario**: DeepSeek cambia su API, modifica precios, o deja de funcionar.
**Probabilidad**: Baja a corto plazo, media a largo plazo.
**Impacto**: La verificación con IA deja de funcionar.
**Mitigación**:
- Degradación graceful: si DeepSeek falla → claims quedan como `NO_VERIFICABLE`, no como error
- El ~60% de claims verificadas deterministamente siguen funcionando
- La función `callDeepSeek` es un punto único de acoplamiento — fácil de reemplazar por otra API (OpenAI, Anthropic, etc.)
- Timeout de 30 segundos por llamada

### Riesgo 3: El texto del PDF Mineduc es ambiguo
**Escenario**: La resolución dice "el año escolar se iniciará a partir de la primera semana de marzo" en vez de una fecha específica. La IA no puede verificar la fecha exacta.
**Probabilidad**: Baja (las resoluciones suelen ser específicas).
**Impacto**: Claims de fechas escolares quedan como `NO_VERIFICABLE`.
**Mitigación**:
- Es el resultado correcto: si la fuente no dice la fecha exacta, la afirmación no se puede verificar automáticamente
- Alerta manual: "Claim X no verificable — revisar resolución manualmente"
- El usuario decide si el dato es correcto o si la resolución es ambigua

### Riesgo 4: Falso INCORRECTO que dispara alarma innecesaria
**Escenario**: La resolución dice "2 de marzo de 2026" y el sitio dice "2026-03-02". La IA no reconoce que son equivalentes y dice INCORRECTO.
**Probabilidad**: Media (formatos de fecha diferentes).
**Impacto**: Alerta crítica falsa → pérdida de confianza en el sistema.
**Mitigación**:
- En el prompt, instruir explícitamente: "Las fechas pueden estar en formatos diferentes (ISO: 2026-03-02, español: 2 de marzo de 2026). Ambos formatos son equivalentes."
- Pre-procesamiento: convertir `displayed_value` de ISO a texto español e incluir ambas versiones en el prompt
- Si INCORRECTO con `confidence < 0.9` → NO_VERIFICABLE en vez de INCORRECTO
- Buffer: antes de alertar por INCORRECTO, ejecutar una segunda verificación con prompt reformulado. Si ambas dicen INCORRECTO → alertar. Si difieren → NO_VERIFICABLE.

### Riesgo 5: Costo se dispara por re-runs excesivos
**Escenario**: Un bug causa que el workflow corra en loop, haciendo cientos de llamadas a DeepSeek.
**Probabilidad**: Baja.
**Impacto**: Costo inesperado (aunque DeepSeek es barato).
**Mitigación**:
- Límite hard-coded: máximo 20 llamadas a DeepSeek por ejecución
- Si se supera → abortar con error
- GitHub Actions tiene límite de minutos mensual (2000 para free tier)

---

## Criterios de Éxito

- [ ] Capa 1 (determinista) cubre ≥60% de claims sin IA
- [ ] Capa 2 (DeepSeek) verifica claims restantes con texto fuente inyectado
- [ ] Validación cruzada de citas funciona (rechaza citas inventadas)
- [ ] Falsos positivos < 5% (verificado con muestra de 20 claims)
- [ ] Alerta Telegram cuando se detecta dato INCORRECTO
- [ ] Cache funciona: no re-verificar si fuente y dato no cambiaron
- [ ] Log completo en `data/verification-log.jsonl` para auditoría
- [ ] Costo < $0.10 USD/mes
- [ ] Degradación graceful si DeepSeek no disponible
