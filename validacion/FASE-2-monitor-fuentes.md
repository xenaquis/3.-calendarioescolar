# Fase 2: Monitor de Salud de Fuentes

> **Agente Especialista**: Ingeniero de Infraestructura
> **Idea Matriz aplicada**: Si la fuente oficial está caída o cambió, la verificación no puede completarse. Detectar la ruptura es el primer paso — antes de verificar contenido, verificar que la fuente existe.

---

## Objetivo

Crear un sistema que periódicamente verifica que todas las URLs de fuentes oficiales registradas en `afirmaciones.json` están accesibles, y alerta cuando una fuente se rompe o cambia.

---

## Problema que Resuelve

Hoy, si Mineduc cambia la URL de la resolución del calendario escolar o BCN tiene downtime, nadie se entera hasta que alguien intenta verificar manualmente. El calendar-monitor existente solo vigila 4 leyes BCN específicas — no cubre las URLs de Mineduc ni otras fuentes.

---

## Relación con el Sistema Actual

```
EXISTENTE: calendar-monitor Worker
  → Vigila 4 leyes BCN via XML API
  → Compara fechaVersion
  → Alerta via Telegram
  → NO cubre URLs de Mineduc, estadísticas, ni fuentes HTML

NUEVO: check-sources (GitHub Actions)
  → Vigila TODAS las URLs en afirmaciones.json
  → Solo verifica accesibilidad (HTTP status + hash)
  → Alerta via Telegram (mismo bot, mismo chat)
  → Complementa al monitor, NO lo reemplaza
```

**Decisión arquitectónica**: GitHub Actions (no Worker) porque:
1. No necesita estado persistente (KV)
2. Se ejecuta semanalmente, no necesita baja latencia
3. Puede acceder al repo directamente (leer afirmaciones.json, actualizar source-health.json)
4. Más simple de mantener

---

## Entregables

### 1. `scripts/check-sources.js`

Script Node.js (stdlib only — `https`, `http`, `crypto`, `fs`, `path`) que:

```javascript
// Pseudocódigo del flujo principal

// 1. Leer afirmaciones.json
var afirmaciones = loadJSON('data/afirmaciones.json');

// 2. Extraer URLs únicas de fuentes
var sources = Object.values(afirmaciones.sources);

// 3. Para cada fuente, verificar accesibilidad
var results = [];
for (var i = 0; i < sources.length; i++) {
  var source = sources[i];
  var result = {
    id: source.id,
    url: source.url,
    tier: source.tier,
    checked_at: new Date().toISOString(),
    status: null,         // "ok" | "broken" | "changed" | "timeout" | "error"
    http_status: null,
    response_time_ms: null,
    content_hash: null,   // SHA-256 del body (solo para Tier 1 y 2)
    previous_hash: null,
    hash_changed: false,
    error: null
  };

  try {
    // Fetch con timeout de 15 segundos
    var response = await fetchWithTimeout(source.url, 15000);
    result.http_status = response.statusCode;
    result.response_time_ms = response.elapsed;

    if (response.statusCode >= 200 && response.statusCode < 400) {
      result.status = 'ok';

      // Para Tier 1 y 2: calcular hash del contenido
      if (source.tier <= 2) {
        result.content_hash = sha256(response.body);

        // Comparar con hash anterior
        var previousHealth = loadPreviousHealth();
        if (previousHealth && previousHealth[source.id]) {
          result.previous_hash = previousHealth[source.id].content_hash;
          if (result.content_hash !== result.previous_hash && result.previous_hash !== null) {
            result.status = 'changed';
            result.hash_changed = true;
          }
        }
      }

      // Para Tier 3 (PDFs): verificar que el Content-Type es correcto
      if (source.tier === 3) {
        var ct = response.headers['content-type'] || '';
        if (ct.indexOf('pdf') === -1 && ct.indexOf('html') === -1) {
          result.status = 'error';
          result.error = 'Content-Type inesperado: ' + ct;
        }
      }
    } else {
      result.status = 'broken';
    }
  } catch (err) {
    result.status = err.code === 'TIMEOUT' ? 'timeout' : 'error';
    result.error = err.message;
  }

  results.push(result);
}

// 4. Generar source-health.json
var health = {
  checked_at: new Date().toISOString(),
  total_sources: results.length,
  ok: results.filter(r => r.status === 'ok').length,
  broken: results.filter(r => r.status === 'broken').length,
  changed: results.filter(r => r.status === 'changed').length,
  errors: results.filter(r => r.status === 'error' || r.status === 'timeout').length,
  sources: {}
};
results.forEach(function(r) { health.sources[r.id] = r; });

// 5. Escribir data/source-health.json
writeJSON('data/source-health.json', health);

// 6. Si hay problemas, preparar alerta
var problems = results.filter(r => r.status !== 'ok');
if (problems.length > 0) {
  console.log('ALERTA: ' + problems.length + ' fuentes con problemas');
  // Output para el workflow que envía a Telegram
  problems.forEach(function(p) {
    console.log('  ' + p.id + ': ' + p.status + ' (' + (p.error || p.http_status) + ')');
  });
  // Exit code especial para que el workflow sepa que hay alertas
  process.exit(2);
}

// 7. Si algún hash cambió, marcar para re-verificación
var changed = results.filter(r => r.hash_changed);
if (changed.length > 0) {
  console.log('CAMBIO DETECTADO en ' + changed.length + ' fuentes');
  changed.forEach(function(c) {
    console.log('  ' + c.id + ': hash cambió');
  });
  // Esto dispara verify-content.js en Fase 3
}
```

### 2. `data/source-health.json` (generado automáticamente)

```json
{
  "checked_at": "2026-03-17T08:00:00Z",
  "total_sources": 6,
  "ok": 5,
  "broken": 0,
  "changed": 1,
  "errors": 0,
  "sources": {
    "mineduc-resolucion-2026": {
      "id": "mineduc-resolucion-2026",
      "url": "https://www.mineduc.cl/...",
      "tier": 3,
      "checked_at": "2026-03-17T08:00:01Z",
      "status": "ok",
      "http_status": 200,
      "response_time_ms": 1250,
      "content_hash": null,
      "hash_changed": false,
      "error": null
    },
    "bcn-ley-2977": {
      "id": "bcn-ley-2977",
      "url": "https://www.bcn.cl/leychile/servicios/exportar?idNorma=23639&formato=xml",
      "tier": 1,
      "checked_at": "2026-03-17T08:00:02Z",
      "status": "changed",
      "http_status": 200,
      "response_time_ms": 890,
      "content_hash": "def456...",
      "previous_hash": "abc123...",
      "hash_changed": true,
      "error": null
    }
  }
}
```

### 3. `.github/workflows/check-sources.yml`

```yaml
name: Check Source Health

on:
  schedule:
    - cron: '0 10 * * 1'  # Lunes 10:00 UTC (07:00 Chile)
  workflow_dispatch:       # Manual trigger

jobs:
  check-sources:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Check source URLs
        id: check
        run: node scripts/check-sources.js
        continue-on-error: true

      - name: Commit health update
        if: always()
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/source-health.json
          git diff --staged --quiet || git commit -m "chore: update source health [skip ci]"
          git push

      - name: Alert on problems
        if: steps.check.outcome == 'failure'
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          # Leer problemas del source-health.json
          PROBLEMS=$(node -e "
            var h = require('./data/source-health.json');
            var p = Object.values(h.sources).filter(function(s) { return s.status !== 'ok'; });
            p.forEach(function(s) {
              console.log('• ' + s.id + ': ' + s.status + (s.error ? ' — ' + s.error : ''));
            });
          ")

          MSG="⚠️ *Fuentes con problemas — calendarioescolar.cl*%0A%0A${PROBLEMS}%0A%0ARevisado: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

          curl -s -X POST \
            "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="${MSG}" \
            -d parse_mode="Markdown"

      - name: Alert on content changes
        if: always()
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          CHANGED=$(node -e "
            var h = require('./data/source-health.json');
            var c = Object.values(h.sources).filter(function(s) { return s.hash_changed; });
            if (c.length === 0) process.exit(1);
            c.forEach(function(s) {
              console.log('• ' + s.id + ': contenido cambió');
            });
          " 2>/dev/null) || exit 0

          MSG="🔄 *Contenido cambió en fuentes — calendarioescolar.cl*%0A%0A${CHANGED}%0A%0AVerificar si los datos del sitio siguen siendo correctos."

          curl -s -X POST \
            "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="${MSG}" \
            -d parse_mode="Markdown"
```

### 4. Integración con `generate-pages.js`

Agregar al final de la generación, en el bloque de health.json:

```javascript
// Incluir estado de fuentes en health.json si existe
var sourceHealthPath = path.join(__dirname, '..', 'data', 'source-health.json');
if (fs.existsSync(sourceHealthPath)) {
  var sourceHealth = JSON.parse(fs.readFileSync(sourceHealthPath, 'utf8'));
  healthData.sourceHealth = {
    lastChecked: sourceHealth.checked_at,
    totalSources: sourceHealth.total_sources,
    ok: sourceHealth.ok,
    broken: sourceHealth.broken,
    changed: sourceHealth.changed
  };
}
```

---

## Manejo de Casos Especiales

### Fuentes Tier 1 (BCN XML)
- Fetch directo al endpoint API
- Hash del body XML completo
- Si hash cambia → el calendar-monitor probablemente ya lo detectó via fechaVersion, pero este sistema actúa como respaldo
- Timeout generoso (15s) porque BCN puede ser lenta

### Fuentes Tier 2 (HTML estable)
- Fetch del HTML completo
- Hash del body (puede cambiar por elementos dinámicos — CSS, ads, timestamps)
- **Mitigación de falsos positivos por HTML dinámico**: Extraer solo el `<main>` o `<article>` del HTML antes de hashear. Si no existe un contenedor semántico claro, hashear el texto plano (strip tags).
- Si hash cambia → marcar como "changed" pero no alertar como "broken"

### Fuentes Tier 3 (PDFs de Mineduc)
- Solo verificar accesibilidad (HTTP 200 + Content-Type contiene "pdf")
- NO hashear el contenido descargado (PDFs son grandes, cambian por metadata)
- Comparar contra snapshot local: si el PDF en la URL es diferente al snapshot → alerta
- **Cómo comparar PDFs**: Descargar, calcular SHA-256, comparar contra `data/snapshots/*.sha256`

### Redirects (3xx)
- Seguir hasta 3 redirects
- Si redirect final es 200 → OK pero registrar la URL final
- Si la URL final difiere de la URL registrada → WARNING (la fuente se movió)

### Certificados SSL
- Si hay error de certificado → marcar como "error" con detalle
- No ignorar errores SSL (las fuentes oficiales deben tener HTTPS válido)

---

## Implementación Paso a Paso

### Paso 1: Crear `scripts/check-sources.js` (~1.5h)

1. Función `fetchWithTimeout(url, timeoutMs)` usando `https.get` nativo
2. Función `sha256(content)` usando `crypto.createHash`
3. Función `loadPreviousHealth()` que lee `data/source-health.json` si existe
4. Lógica principal: iterar fuentes, verificar, generar output
5. Exit codes: 0 = todo OK, 2 = problemas detectados

### Paso 2: Crear workflow `.github/workflows/check-sources.yml` (~30min)

Usar los secrets existentes (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID ya configurados para calendar-monitor).

### Paso 3: Integrar con health.json (~15min)

Agregar resumen de source-health al health.json generado.

### Paso 4: Test manual (~30min)

1. Ejecutar `node scripts/check-sources.js` localmente
2. Verificar que `data/source-health.json` se genera correctamente
3. Simular una URL rota (cambiar temporalmente una URL en afirmaciones.json)
4. Verificar que la alerta se construye correctamente

---

## Premortem Pesimista

### Riesgo 1: Falsos positivos por contenido dinámico
**Escenario**: Una página HTML incluye un timestamp o contador de visitas. El hash cambia cada semana sin que el contenido relevante cambie. Se genera una alerta inútil cada lunes.
**Probabilidad**: Alta para fuentes Tier 2 (HTML).
**Impacto**: Fatiga de alertas → se ignoran alertas reales.
**Mitigación**:
- Para fuentes Tier 2: extraer solo texto del `<main>` antes de hashear (strip tags, normalize whitespace)
- Implementar "cooldown de cambio": si el hash cambió las últimas 3 semanas consecutivas → marcar fuente como "dinámica" y dejar de alertar por hash, solo alertar por HTTP status
- Incluir flag `"hash_monitoring": false` en la fuente para deshabilitar tracking de hash

### Riesgo 2: BCN downtime coincide con check semanal
**Escenario**: BCN tiene mantenimiento los lunes (cuando corre el cron). Todas las fuentes BCN aparecen como "broken". Alerta masiva.
**Probabilidad**: Media (BCN tiene downtime documentado).
**Mitigación**:
- Si TODAS las fuentes BCN fallan simultáneamente → clasificar como "bcn_downtime" en vez de "broken"
- No alertar por downtime masivo de un solo proveedor (es mantenimiento, no ruptura)
- Retry automático 6 horas después: agregar segundo cron `0 16 * * 1` (16:00 UTC) que solo corre si el check de las 10:00 falló

### Riesgo 3: Mineduc cambia URL sin redirect
**Escenario**: Mineduc reestructura su sitio web. La URL de la resolución devuelve 404. No hay redirect.
**Probabilidad**: Alta (Mineduc cambia URLs frecuentemente entre años).
**Mitigación**:
- Para fuentes Mineduc Tier 3: el snapshot local es el respaldo
- La alerta incluye instrucción: "Buscar nueva URL en mineduc.cl y actualizar afirmaciones.json"
- Incluir `url_alternativa` (BCN suele tener copia de resoluciones Mineduc)
- La verificación de contenido (Fase 3) puede funcionar con el snapshot local mientras se encuentra la URL nueva

### Riesgo 4: Rate limiting o bloqueo por fetch automático
**Escenario**: BCN o Mineduc bloquean requests de GitHub Actions (IP de datacenter, User-Agent de bot).
**Probabilidad**: Baja (6 requests semanales es muy poco).
**Mitigación**:
- User-Agent descriptivo: "CalendarioEscolar-SourceMonitor/1.0 (+https://calendarioescolar.cl)"
- Delay de 2 segundos entre requests (no bombardear)
- Si una fuente devuelve 403/429 → clasificar como "blocked" y sugerir verificación manual

### Riesgo 5: El workflow falla silenciosamente
**Escenario**: El workflow tiene un error de sintaxis o el secret expiró. No corre. Nadie se entera porque no hay "alerta de no-alerta".
**Probabilidad**: Media.
**Mitigación**:
- Heartbeat: Si `source-health.json` tiene `checked_at` > 14 días → `validate.js` emite WARNING
- Agregar al health.json check en calendar-monitor: si `source-health.json` no se actualiza en 14 días → alerta Telegram

---

## Criterios de Éxito

- [ ] `scripts/check-sources.js` ejecuta sin dependencias externas (Node.js stdlib only)
- [ ] Verifica todas las URLs en `afirmaciones.json` (Tier 1, 2 y 3)
- [ ] Genera `data/source-health.json` con estado de cada fuente
- [ ] Alerta via Telegram cuando una fuente está rota o cambió
- [ ] Maneja correctamente: timeouts, redirects, SSL errors, BCN downtime masivo
- [ ] No genera falsos positivos por contenido HTML dinámico
- [ ] Heartbeat: detecta si el propio monitor dejó de funcionar
- [ ] Cron semanal + trigger manual funcionando
