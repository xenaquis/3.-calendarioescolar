#!/usr/bin/env node
/* check-sources.js — Monitor de salud de fuentes oficiales
   Uso: node scripts/check-sources.js

   Verifica accesibilidad de todas las URLs en data/afirmaciones.json.
   Genera data/source-health.json con estado de cada fuente.

   Exit codes:
     0 = todo OK (incluye "changed" — cambios de contenido son informativos)
     2 = problemas detectados (broken/error/timeout)
*/

var fs = require('fs');
var path = require('path');
var https = require('https');
var http = require('http');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '..');
var AFIRMACIONES_PATH = path.join(ROOT, 'data', 'afirmaciones.json');
var HEALTH_PATH = path.join(ROOT, 'data', 'source-health.json');
var TIMEOUT_MS = 15000;
var MAX_REDIRECTS = 3;
var DELAY_MS = 2000;
var USER_AGENT = 'CalendarioEscolar-SourceMonitor/1.0 (+https://calendarioescolar.cl)';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function loadPreviousHealth() {
  if (!fs.existsSync(HEALTH_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Extrae texto relevante de HTML para hasheo estable.
 * Prioriza <main>, luego <article>, luego todo el body.
 * Elimina tags HTML y normaliza whitespace.
 */
function extractStableContent(html) {
  var content = html;
  var mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    content = mainMatch[1];
  } else {
    var articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    }
  }
  return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fetch HTTP/HTTPS con timeout y seguimiento de redirects.
 */
function fetchWithTimeout(url, timeoutMs, redirectsLeft) {
  if (redirectsLeft === undefined) redirectsLeft = MAX_REDIRECTS;

  return new Promise(function (resolve, reject) {
    var startTime = Date.now();
    var mod = url.indexOf('https') === 0 ? https : http;

    var timer = setTimeout(function () {
      req.destroy();
      var err = new Error('Timeout despues de ' + timeoutMs + 'ms');
      err.code = 'TIMEOUT';
      reject(err);
    }, timeoutMs);

    var req = mod.get(url, { headers: { 'User-Agent': USER_AGENT } }, function (res) {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        if (redirectsLeft <= 0) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: '',
            elapsed: Date.now() - startTime,
            finalUrl: url
          });
          return;
        }
        var newUrl = res.headers.location;
        if (newUrl.indexOf('//') === -1) {
          // Relative redirect
          var parsed = new URL(url);
          newUrl = parsed.protocol + '//' + parsed.host + newUrl;
        }
        var remaining = timeoutMs - (Date.now() - startTime);
        if (remaining <= 0) remaining = 1000;
        fetchWithTimeout(newUrl, remaining, redirectsLeft - 1)
          .then(function (result) {
            result.elapsed = Date.now() - startTime;
            resolve(result);
          })
          .catch(reject);
        return;
      }

      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        clearTimeout(timer);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          elapsed: Date.now() - startTime,
          finalUrl: url
        });
      });
    });

    req.on('error', function (err) {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(AFIRMACIONES_PATH)) {
    console.log('ERROR: data/afirmaciones.json no existe');
    process.exit(1);
  }

  var afirmaciones;
  try {
    afirmaciones = JSON.parse(fs.readFileSync(AFIRMACIONES_PATH, 'utf8'));
  } catch (e) {
    console.log('ERROR: data/afirmaciones.json invalido — ' + e.message);
    process.exit(1);
  }

  var sources = Object.values(afirmaciones.sources);
  var previousHealth = loadPreviousHealth();

  console.log('Verificando ' + sources.length + ' fuentes...\n');

  var results = [];

  function checkSource(idx) {
    if (idx >= sources.length) {
      finalize(results, previousHealth);
      return;
    }

    var source = sources[idx];
    // Tier 1: usar api_endpoint si existe (endpoint XML estable)
    var checkUrl = source.api_endpoint || source.url;

    var result = {
      id: source.id,
      url: source.url,
      checked_url: checkUrl,
      tier: source.tier,
      checked_at: new Date().toISOString(),
      status: null,
      http_status: null,
      response_time_ms: null,
      content_hash: null,
      previous_hash: null,
      hash_changed: false,
      final_url: null,
      error: null
    };

    console.log('  [' + (idx + 1) + '/' + sources.length + '] ' + source.id + ' (tier ' + source.tier + ')');

    fetchWithTimeout(checkUrl, TIMEOUT_MS)
      .then(function (response) {
        result.http_status = response.statusCode;
        result.response_time_ms = response.elapsed;

        // Registrar URL final si fue redirigido
        if (response.finalUrl !== checkUrl) {
          result.final_url = response.finalUrl;
        }

        if (response.statusCode >= 200 && response.statusCode < 400) {
          result.status = 'ok';

          // Tier 1 y 2: calcular hash del contenido
          if (source.tier <= 2) {
            var contentToHash = response.body;

            // Tier 2 (HTML): extraer contenido estable para evitar falsos positivos
            if (source.type === 'html') {
              contentToHash = extractStableContent(response.body);
            }

            result.content_hash = sha256(contentToHash);

            // Comparar con hash anterior
            if (previousHealth && previousHealth.sources && previousHealth.sources[source.id]) {
              result.previous_hash = previousHealth.sources[source.id].content_hash;
              if (result.content_hash !== result.previous_hash && result.previous_hash !== null) {
                result.status = 'changed';
                result.hash_changed = true;
              }
            }
          }

          // Tier 3 (PDFs): verificar Content-Type
          if (source.tier === 3) {
            var ct = (response.headers['content-type'] || '').toLowerCase();
            if (ct.indexOf('pdf') === -1 && ct.indexOf('html') === -1) {
              result.status = 'error';
              result.error = 'Content-Type inesperado: ' + ct;
            }
          }

          if (result.final_url) {
            console.log('    \u2192 redirigido a: ' + result.final_url);
          }
        } else {
          result.status = 'broken';
        }

        var icon = result.status === 'ok' ? '\u2713' :
                   result.status === 'changed' ? '~' : '\u2717';
        console.log('    ' + icon + ' ' + result.status +
          ' (HTTP ' + result.http_status + ', ' + result.response_time_ms + 'ms)');
      })
      .catch(function (err) {
        result.status = err.code === 'TIMEOUT' ? 'timeout' : 'error';
        result.error = err.message;
        console.log('    \u2717 ' + result.status + ': ' + result.error);
      })
      .then(function () {
        results.push(result);
        if (idx < sources.length - 1) {
          return delay(DELAY_MS);
        }
      })
      .then(function () {
        checkSource(idx + 1);
      });
  }

  checkSource(0);
}

function finalize(results, previousHealth) {
  // BCN downtime detection: si TODAS las fuentes BCN fallan → downtime, no alertar
  var bcnSources = results.filter(function (r) { return r.id.indexOf('bcn-') === 0; });
  var bcnAllFailed = bcnSources.length > 0 && bcnSources.every(function (r) {
    return r.status !== 'ok' && r.status !== 'changed';
  });

  if (bcnAllFailed) {
    console.log('\n  \u26a0 Todas las fuentes BCN fallaron — posible downtime BCN (no se alertara)');
    bcnSources.forEach(function (r) {
      r.status = 'bcn_downtime';
    });
  }

  // Generar source-health.json
  var health = {
    checked_at: new Date().toISOString(),
    total_sources: results.length,
    ok: results.filter(function (r) { return r.status === 'ok'; }).length,
    broken: results.filter(function (r) { return r.status === 'broken'; }).length,
    changed: results.filter(function (r) { return r.status === 'changed'; }).length,
    errors: results.filter(function (r) {
      return r.status === 'error' || r.status === 'timeout';
    }).length,
    bcn_downtime: bcnAllFailed,
    sources: {}
  };

  results.forEach(function (r) { health.sources[r.id] = r; });

  fs.writeFileSync(HEALTH_PATH, JSON.stringify(health, null, 2));
  console.log('\nGenerado data/source-health.json');

  // Reporte
  console.log('\n=== Resultado ===');
  console.log('  OK: ' + health.ok + '/' + health.total_sources);
  if (health.changed > 0) console.log('  Cambios: ' + health.changed);
  if (health.broken > 0) console.log('  Rotas: ' + health.broken);
  if (health.errors > 0) console.log('  Errores: ' + health.errors);
  if (bcnAllFailed) console.log('  BCN downtime: si');

  // Exit code: solo errores reales (broken/error/timeout), no cambios ni BCN downtime
  var problems = results.filter(function (r) {
    return r.status === 'broken' || r.status === 'error' || r.status === 'timeout';
  });

  if (problems.length > 0) {
    console.log('\n  ALERTA: ' + problems.length + ' fuente(s) con problemas');
    problems.forEach(function (p) {
      console.log('    ' + p.id + ': ' + p.status + ' (' + (p.error || 'HTTP ' + p.http_status) + ')');
    });
    process.exit(2);
  }

  var changed = results.filter(function (r) { return r.hash_changed; });
  if (changed.length > 0) {
    console.log('\n  CAMBIO DETECTADO en ' + changed.length + ' fuente(s):');
    changed.forEach(function (c) {
      console.log('    ' + c.id + ': contenido cambio (hash diferente)');
    });
  }

  console.log('');
  process.exit(0);
}

main();
