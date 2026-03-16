// workers/calendar-monitor/index.js
// Calendar Monitor — calendarioescolar.cl
// Cloudflare Worker | Cron: lunes 08:00 UTC
//
// Que hace:
//   1. Verifica health.json del sitio (dataYear, antiguedad)
//   2. Monitorea Ley 2.977 de feriados en BCN via XML API
//   3. Detecta cuando Mineduc publica calendarios del ano siguiente
//
// Cuando detecta un feriado nuevo/modificado:
//   - DeepSeek analiza el cambio y genera feriadosSugeridos
//   - Guarda sugerencia en KV (pending:lawKey)
//   - Envia alerta Telegram con botones inline:
//       [✅ Aplicar automáticamente]  [❌ Ignorar]
//   - Boton Aplicar llama /apply-update → commit en GitHub → deploy.yml → generate → deploy
//   - El humano siempre aprueba con un tap antes de que se aplique nada
//
// Setup:
//   cd workers/calendar-monitor
//   npx wrangler kv namespace create CALENDAR_KV   <- anotar el ID → pegar en wrangler.toml
//   npx wrangler secret put DEEPSEEK_API_KEY
//   npx wrangler secret put MONITOR_SECRET
//   npx wrangler secret put GITHUB_TOKEN           <- PAT con scope contents:write
//   npx wrangler secret put ALERT_WEBHOOK_URL      (o TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
//   npx wrangler deploy
//
// Endpoints:
//   GET /health                        — estado del monitor
//   GET /trigger?secret=X              — ejecutar manualmente
//   GET /pending?secret=X              — ver sugerencias pendientes
//   GET /apply-update?secret=X&key=K  — aplicar sugerencia pendiente (abre en browser)
//   GET /dismiss?secret=X&key=K       — descartar sugerencia pendiente (abre en browser)
//
// ACTUALIZACION ANUAL (cada noviembre cuando cambia el ano escolar):
//   1. Actualizar CURRENT_YEAR, SCHOOL_START, SCHOOL_END, WINTER_START, WINTER_END
//   2. Actualizar SITE_FERIADOS con los 7 feriados del nuevo ano
//   3. Resetear KV key 'url:mineduc-calendarios-siguiente:status' (eliminarla)
//      para que el monitor vuelva a alertar cuando publiquen los calendarios del ano +2

var VERSION = '1.1.0';
var CURRENT_YEAR = 2026;
var NEXT_YEAR = CURRENT_YEAR + 1;
var RATE_LIMIT_MS = 2000; // ms entre requests a BCN

// Periodo escolar actual — actualizar cada noviembre
var SCHOOL_START  = '2026-03-02';
var SCHOOL_END    = '2026-12-12';
var WINTER_START  = '2026-07-11';
var WINTER_END    = '2026-07-25';

// ============================================================
// FERIADOS ACTUALES DEL SITIO
// Mantener sincronizado con data/calendar-config.json → feriados[]
// Estos son los feriados que caen en periodo escolar
// ============================================================
var SITE_FERIADOS = [
  { date: '2026-04-03', nombre: 'Viernes Santo' },
  { date: '2026-05-01', nombre: 'Dia del Trabajo' },
  { date: '2026-05-21', nombre: 'Glorias Navales' },
  { date: '2026-06-04', nombre: 'Corpus Christi' },
  { date: '2026-06-29', nombre: 'San Pedro y San Pablo' },
  { date: '2026-10-12', nombre: 'Encuentro de Dos Mundos' },
  { date: '2026-12-08', nombre: 'Inmaculada Concepcion' }
];

// ============================================================
// LEYES A MONITOREAR VIA BCN XML API
// ============================================================
var MONITORED_LAWS = {
  'ley-2977-feriados': {
    idNorma: '23639',
    sourceName: 'Ley 2.977 — Feriados legales Chile',
    description: 'Ley base que define: Viernes Santo, 1 mayo, 21 mayo, Corpus Christi, San Pedro y Pablo, 8 diciembre',
    actionIfChanged: 'Revisar TODOS los feriados en data/calendar-config.json y la tabla en public/index.html'
  },
  'ley-19668-traslado': {
    idNorma: '160270',
    sourceName: 'Ley 19.668 — Traslado de feriados a lunes',
    description: 'Traslada a lunes los feriados 29 junio (San Pedro/Pablo) y 12 octubre (Enc. Dos Mundos) cuando caen sábado o domingo',
    actionIfChanged: 'Verificar si cambia la regla de traslado de San Pedro/Pablo y 12 octubre. Recalcular fechas reales en calendar-config.json.'
  },
  'ley-20148-virgen-carmen': {
    idNorma: '257080',
    sourceName: 'Ley 20.148 — Virgen del Carmen / Corpus Christi',
    description: 'Estableció el 16 de julio (Virgen del Carmen) como feriado irrenunciable en reemplazo de Corpus Christi para efectos laborales. Corpus Christi sigue en calendarios escolares.',
    actionIfChanged: 'Verificar si cambia la relación entre Corpus Christi y Virgen del Carmen. Revisar el calendario escolar y si afecta la tabla de feriados del sitio.'
  },
  'ley-21357-pueblos-indigenas': {
    idNorma: '1161743',
    sourceName: 'Ley 21.357 — Dia de los Pueblos Indigenas',
    description: 'Feriado en el dia del solsticio de invierno (21-24 junio segun el ano). En 2026 cae domingo. En otros anos puede caer en periodo escolar.',
    actionIfChanged: 'Verificar fecha exacta del solsticio para el ano siguiente. Puede requerir agregar a calendar-config.json si cae en periodo escolar.'
  }
};

// ============================================================
// URL MINEDUC AÑO SIGUIENTE
// ============================================================
var MINEDUC_NEXT_URL = 'https://www.mineduc.cl/resoluciones-de-calendarios-escolares-regionales-' + NEXT_YEAR + '/';
var MINEDUC_POSITIVE_KEYWORDS = ['.pdf', 'resolucion', 'descargar', 'calendario regional', 'exenta'];
var MINEDUC_NEGATIVE_KEYWORDS = ['no encontrado', '404', 'page not found', 'error 404'];

// GitHub repo donde vive el proyecto — configurable via env.GITHUB_REPO
var GITHUB_REPO_DEFAULT = 'xenaquis/3.-calendarioescolar';
var CAL_CONFIG_PATH = 'data/calendar-config.json';

// ============================================================
// EXPORT DEFAULT — Cloudflare Workers ES modules
// ============================================================
export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);

    // ── GET /health ───────────────────────────────────────────
    if (url.pathname === '/health') {
      return handleHealthEndpoint(env);
    }

    // ── GET /trigger?secret=X ─────────────────────────────────
    if (url.pathname === '/trigger') {
      var secret = url.searchParams.get('secret');
      if (!env.MONITOR_SECRET || secret !== env.MONITOR_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      ctx.waitUntil(runMonitor(env, request));
      return new Response(
        JSON.stringify({ ok: true, message: 'Monitor iniciado', version: VERSION }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── GET /pending?secret=X ─────────────────────────────────
    if (url.pathname === '/pending') {
      var pendingSecret = url.searchParams.get('secret');
      if (!env.MONITOR_SECRET || pendingSecret !== env.MONITOR_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      var pendingList = {};
      var lawKeys = Object.keys(MONITORED_LAWS);
      for (var pi = 0; pi < lawKeys.length; pi++) {
        var pv = env.CALENDAR_KV ? await env.CALENDAR_KV.get('pending:' + lawKeys[pi]) : null;
        if (pv) pendingList[lawKeys[pi]] = JSON.parse(pv);
      }
      return new Response(JSON.stringify(pendingList, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── GET /apply-update?secret=X&key=K ─────────────────────
    if (url.pathname === '/apply-update') {
      var applySecret = url.searchParams.get('secret');
      if (!env.MONITOR_SECRET || applySecret !== env.MONITOR_SECRET) {
        return htmlResponse('401 — No autorizado', '❌ No autorizado', 'El enlace no es válido.', 401);
      }
      var applyKey = url.searchParams.get('key');
      if (!applyKey) {
        return htmlResponse('400 — Falta parámetro', '⚠️ Falta parámetro', 'Falta el parámetro key.', 400);
      }
      var applyResult = await handleApplyUpdate(applyKey, env);
      return applyResult;
    }

    // ── GET /dismiss?secret=X&key=K ──────────────────────────
    if (url.pathname === '/dismiss') {
      var dismissSecret = url.searchParams.get('secret');
      if (!env.MONITOR_SECRET || dismissSecret !== env.MONITOR_SECRET) {
        return htmlResponse('401 — No autorizado', '❌ No autorizado', 'El enlace no es válido.', 401);
      }
      var dismissKey = url.searchParams.get('key');
      if (!dismissKey) {
        return htmlResponse('400 — Falta parámetro', '⚠️ Falta parámetro', 'Falta el parámetro key.', 400);
      }
      if (env.CALENDAR_KV) {
        try { await env.CALENDAR_KV.delete('pending:' + dismissKey); } catch (e) { /* ignore */ }
      }
      return htmlResponse(
        'Sugerencia ignorada',
        '🗑️ Sugerencia descartada',
        'La sugerencia para <code>' + escapeHtml(dismissKey) + '</code> fue descartada.<br>No se realizaron cambios en el sitio.',
        200
      );
    }

    return new Response(
      'Calendar Monitor v' + VERSION + '\n' +
      'GET /health                        — estado del monitor\n' +
      'GET /trigger?secret=X              — ejecutar manualmente\n' +
      'GET /pending?secret=X              — ver sugerencias pendientes\n' +
      'GET /apply-update?secret=X&key=K  — aplicar sugerencia\n' +
      'GET /dismiss?secret=X&key=K       — descartar sugerencia',
      { status: 200, headers: { 'Content-Type': 'text/plain' } }
    );
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runMonitor(env, null));
  }
};

// ============================================================
// MAIN ORCHESTRATION
// ============================================================
async function runMonitor(env, request) {
  var workerUrl = getWorkerUrl(env, request);

  var report = {
    version: VERSION,
    timestamp: new Date().toISOString(),
    year: CURRENT_YEAR,
    alerts: [],
    checks: {}
  };

  console.log('[calendar-monitor] Iniciando run ' + report.timestamp);

  // --- CHECK 1: Health del sitio ---
  try {
    var healthResult = await checkSiteHealth();
    report.checks.siteHealth = healthResult;

    if (healthResult.status === 'error') {
      await sendAlert('[SITIO] health.json ERROR: ' + healthResult.message, 'HIGH', env, null);
      report.alerts.push({ type: 'SITE_HEALTH_ERROR', urgency: 'HIGH' });
    } else if (healthResult.status === 'warning') {
      await sendAlert('[SITIO] health.json ADVERTENCIA: ' + healthResult.message, 'MEDIUM', env, null);
      report.alerts.push({ type: 'SITE_HEALTH_WARNING', urgency: 'MEDIUM' });
    }
  } catch (e) {
    console.error('[calendar-monitor] checkSiteHealth error: ' + e.message);
    report.checks.siteHealth = { status: 'exception', error: e.message };
  }

  // --- CHECK 2: Leyes BCN ---
  var lawKeys = Object.keys(MONITORED_LAWS);
  for (var i = 0; i < lawKeys.length; i++) {
    var lawKey = lawKeys[i];
    var lawConfig = MONITORED_LAWS[lawKey];

    if (i > 0) await sleep(RATE_LIMIT_MS);

    try {
      var lawResult = await checkBcnLaw(lawKey, lawConfig, env, workerUrl);
      report.checks[lawKey] = lawResult;

      if (lawResult.status === 'changed_action_required') {
        report.alerts.push({ type: 'LAW_CHANGE', key: lawKey, urgency: 'HIGH' });
      }
    } catch (e) {
      console.error('[calendar-monitor] checkBcnLaw error (' + lawKey + '): ' + e.message);
      report.checks[lawKey] = { status: 'exception', error: e.message };
    }
  }

  // --- CHECK 3: Mineduc ano siguiente ---
  try {
    var mineducResult = await checkMineducUrl(env);
    report.checks.mineducNextYear = mineducResult;

    if (mineducResult.published) {
      report.alerts.push({ type: 'MINEDUC_PUBLISHED', urgency: 'CRITICAL' });
      await sendAlert(
        '[CRITICO] Mineduc publico calendarios ' + NEXT_YEAR + '!\n\n' +
        'URL: ' + MINEDUC_NEXT_URL + '\n\n' +
        'ACCION REQUERIDA:\n' +
        '1. Descargar PDFs de las 16 regiones\n' +
        '2. Extraer fechas de inicio, vacaciones invierno, fin de ano\n' +
        '3. Calcular Corpus Christi ' + NEXT_YEAR + ' con algoritmo Pascua (NO copiar ' + CURRENT_YEAR + ')\n' +
        '4. Verificar San Pedro y San Pablo: si cae sabado/domingo → mover al lunes\n' +
        '5. Actualizar Google Sheet → disparar sync-deploy.yml',
        'CRITICAL',
        env,
        null
      );
    }
  } catch (e) {
    console.error('[calendar-monitor] checkMineducUrl error: ' + e.message);
    report.checks.mineducNextYear = { status: 'exception', error: e.message };
  }

  // Guardar health report en KV (TTL 30 dias)
  if (env.CALENDAR_KV) {
    try {
      await env.CALENDAR_KV.put(
        'monitor:health',
        JSON.stringify(report),
        { expirationTtl: 60 * 60 * 24 * 30 }
      );
    } catch (e) {
      console.error('[calendar-monitor] KV write error: ' + e.message);
    }
  }

  var totalAlerts = report.alerts.length;
  console.log('[calendar-monitor] Run completo. Alertas: ' + totalAlerts);
  return report;
}

// ============================================================
// CHECK 1: health.json DEL SITIO
// ============================================================
async function checkSiteHealth() {
  var response;
  try {
    response = await fetch('https://calendarioescolar.cl/health.json', {
      headers: { 'User-Agent': 'calendar-monitor/' + VERSION }
    });
  } catch (e) {
    return { status: 'error', message: 'No se pudo conectar: ' + e.message };
  }

  if (!response.ok) {
    return { status: 'error', message: 'HTTP ' + response.status };
  }

  var health;
  try {
    health = await response.json();
  } catch (e) {
    return { status: 'error', message: 'JSON invalido en health.json' };
  }

  var warnings = [];

  if (health.dataYear !== CURRENT_YEAR) {
    warnings.push('dataYear=' + health.dataYear + ', esperado=' + CURRENT_YEAR);
  }

  if (health.generatedDate) {
    var generated = new Date(health.generatedDate);
    var daysDiff = Math.floor((Date.now() - generated.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      warnings.push('Sin regenerar hace ' + daysDiff + ' dias');
    }
  } else {
    warnings.push('Falta campo generatedDate');
  }

  if (health.status && health.status !== 'ok') {
    warnings.push('status=' + health.status);
  }

  if (warnings.length > 0) {
    return { status: 'warning', message: warnings.join(' | '), dataYear: health.dataYear };
  }

  return { status: 'ok', dataYear: health.dataYear, generatedDate: health.generatedDate };
}

// ============================================================
// CHECK 2: LEYES BCN
// ============================================================
async function checkBcnLaw(lawKey, lawConfig, env, workerUrl) {
  console.log('[calendar-monitor] Verificando ' + lawKey + ' (idNorma=' + lawConfig.idNorma + ')');

  var xml = await fetchBcnXml(lawConfig.idNorma);
  if (!xml) {
    await sendAlert(
      '[BCN] No se pudo obtener XML para ' + lawConfig.sourceName + '\n' +
      'idNorma: ' + lawConfig.idNorma + '\n' +
      'Puede ser problema temporal de BCN. Si persiste, verificar idNorma.',
      'MEDIUM',
      env,
      null
    );
    return { status: 'fetch_failed', lawKey: lawKey };
  }

  var extracted = extractLawText(xml);
  if (!extracted) {
    await sendAlert(
      '[BCN] Fallo en extraccion de texto para ' + lawConfig.sourceName + '\n' +
      'El XML no tiene estructura reconocible. BCN puede haber cambiado el formato.\n' +
      'Revisar extractLawText() en el worker.',
      'MEDIUM',
      env,
      null
    );
    return { status: 'extraction_failed', lawKey: lawKey };
  }

  var currentHash = await hashText(extracted);
  var kvKey = 'law:' + lawKey + ':hash';
  var storedHash = null;

  if (env.CALENDAR_KV) {
    try {
      storedHash = await env.CALENDAR_KV.get(kvKey);
    } catch (e) {
      console.error('[calendar-monitor] KV get error: ' + e.message);
    }
  }

  if (!storedHash) {
    console.log('[calendar-monitor] Primera ejecucion para ' + lawKey + ' — guardando hash base');
    if (env.CALENDAR_KV) {
      try { await env.CALENDAR_KV.put(kvKey, currentHash); } catch (e) { /* ignore */ }
    }
    return { status: 'initialized', lawKey: lawKey };
  }

  if (storedHash === currentHash) {
    console.log('[calendar-monitor] Sin cambios en ' + lawKey);
    return { status: 'unchanged', lawKey: lawKey };
  }

  // Hash cambio — analizar con DeepSeek
  console.log('[calendar-monitor] Cambio detectado en ' + lawKey + ' — analizando...');
  var cleanText = cleanForLlm(extracted, 3000);
  var analysis = await analyzeChange(lawConfig, cleanText, env);

  if (env.CALENDAR_KV) {
    try { await env.CALENDAR_KV.put(kvKey, currentHash); } catch (e) { /* ignore */ }
  }

  if (!analysis) {
    await sendAlert(
      '[LEY] Cambio en texto de ' + lawConfig.sourceName + '\n' +
      'No se pudo analizar (sin DEEPSEEK_API_KEY o error de API).\n\n' +
      'Accion: ' + lawConfig.actionIfChanged,
      'MEDIUM',
      env,
      null
    );
    return { status: 'changed_no_analysis', lawKey: lawKey };
  }

  if (!analysis.requiresUpdate) {
    await sendAlert(
      '[INFO] Cambio en ' + lawConfig.sourceName + '\n\n' +
      'Resumen: ' + analysis.summary + '\n' +
      'Razon: ' + analysis.reason + '\n\n' +
      'Conclusion: No requiere actualizar el sitio.',
      'LOW',
      env,
      null
    );
    return { status: 'changed_no_action', lawKey: lawKey, analysis: analysis };
  }

  // REQUIERE ACTUALIZACION — segunda llamada DeepSeek para sugerencia
  var suggestion = await generateUpdateSuggestion(lawConfig, cleanText, analysis, env);

  var suggestionText = '';
  var alertButtons = null;

  if (suggestion) {
    if (env.CALENDAR_KV) {
      try {
        await env.CALENDAR_KV.put(
          'pending:' + lawKey,
          JSON.stringify({ analysis: analysis, suggestion: suggestion, timestamp: new Date().toISOString() }),
          { expirationTtl: 60 * 60 * 24 * 30 }
        );
      } catch (e) { /* ignore */ }
    }

    suggestionText = '\n\nSUGERENCIA DEEPSEEK:\n' +
      JSON.stringify(suggestion.feriadosSugeridos || [], null, 2) + '\n\n' +
      'Checklist humano:\n' +
      (suggestion.humanChecklist || []).map(function(s) { return '- ' + s; }).join('\n') + '\n\n' +
      'Confianza: ' + (suggestion.confidence || '?') + '\n' +
      'Advertencia: ' + (suggestion.warning || 'ninguna');

    // Botones inline solo si hay workerUrl + secret configurados
    if (workerUrl && env.MONITOR_SECRET) {
      alertButtons = [[
        {
          text: '\u2705 Aplicar autom\u00e1ticamente',
          url: workerUrl + '/apply-update?secret=' + env.MONITOR_SECRET + '&key=' + encodeURIComponent(lawKey)
        },
        {
          text: '\u274c Ignorar',
          url: workerUrl + '/dismiss?secret=' + env.MONITOR_SECRET + '&key=' + encodeURIComponent(lawKey)
        }
      ]];
    }
  }

  await sendAlert(
    '[URGENTE] Cambio en feriados que requiere actualizar el sitio\n\n' +
    'Ley: ' + lawConfig.sourceName + '\n' +
    'Resumen: ' + analysis.summary + '\n' +
    'Urgencia: ' + (analysis.urgency || 'HIGH') + '\n\n' +
    'Accion: ' + lawConfig.actionIfChanged + '\n\n' +
    'Feriados actuales del sitio:\n' +
    SITE_FERIADOS.map(function(f) { return f.date + ' ' + f.nombre; }).join('\n') +
    suggestionText,
    'HIGH',
    env,
    alertButtons
  );

  return { status: 'changed_action_required', lawKey: lawKey, urgency: analysis.urgency || 'HIGH' };
}

// ============================================================
// CHECK 3: URL MINEDUC AÑO SIGUIENTE
// ============================================================
async function checkMineducUrl(env) {
  console.log('[calendar-monitor] Verificando Mineduc ' + NEXT_YEAR + ' → ' + MINEDUC_NEXT_URL);

  var kvKey = 'url:mineduc-calendarios-siguiente:status';
  var storedStatus = null;

  if (env.CALENDAR_KV) {
    try { storedStatus = await env.CALENDAR_KV.get(kvKey); } catch (e) { /* ignore */ }
  }

  if (storedStatus === 'PUBLISHED') {
    console.log('[calendar-monitor] Mineduc ' + NEXT_YEAR + ' ya fue marcado PUBLISHED — no re-alertar');
    return { status: 'already_published', published: false };
  }

  var response;
  try {
    response = await fetch(MINEDUC_NEXT_URL, {
      headers: { 'User-Agent': 'calendar-monitor/' + VERSION },
      redirect: 'follow'
    });
  } catch (e) {
    return { status: 'fetch_error', error: e.message, published: false };
  }

  if (!response.ok) {
    console.log('[calendar-monitor] Mineduc ' + NEXT_YEAR + ' HTTP ' + response.status + ' — aun no publicado');
    return { status: 'not_published', httpStatus: response.status, published: false };
  }

  var html = await response.text();
  var htmlLower = html.toLowerCase();

  for (var n = 0; n < MINEDUC_NEGATIVE_KEYWORDS.length; n++) {
    if (htmlLower.indexOf(MINEDUC_NEGATIVE_KEYWORDS[n]) !== -1) {
      return { status: 'not_published', reason: 'keyword negativo encontrado', published: false };
    }
  }

  var foundKeywords = [];
  for (var p = 0; p < MINEDUC_POSITIVE_KEYWORDS.length; p++) {
    if (htmlLower.indexOf(MINEDUC_POSITIVE_KEYWORDS[p]) !== -1) {
      foundKeywords.push(MINEDUC_POSITIVE_KEYWORDS[p]);
    }
  }

  if (foundKeywords.length >= 2) {
    console.log('[calendar-monitor] MINEDUC ' + NEXT_YEAR + ' PUBLICADO. Keywords: ' + foundKeywords.join(', '));
    if (env.CALENDAR_KV) {
      try { await env.CALENDAR_KV.put(kvKey, 'PUBLISHED'); } catch (e) { /* ignore */ }
    }
    return { status: 'published', foundKeywords: foundKeywords, published: true };
  }

  return { status: 'not_published', positiveKeywordsFound: foundKeywords.length, published: false };
}

// ============================================================
// BCN HELPERS
// ============================================================
async function fetchBcnXml(idNorma) {
  var url = 'https://www.bcn.cl/leychile/consulta/obtxml?opt=7&idNorma=' + idNorma;
  try {
    var response = await fetch(url, {
      headers: {
        'User-Agent': 'calendar-monitor/' + VERSION,
        'Accept': 'application/xml, text/xml, */*'
      }
    });
    if (!response.ok) {
      console.error('[calendar-monitor] BCN HTTP ' + response.status + ' para idNorma=' + idNorma);
      return null;
    }
    return await response.text();
  } catch (e) {
    console.error('[calendar-monitor] fetchBcnXml error: ' + e.message);
    return null;
  }
}

function extractLawText(xml) {
  if (!xml) return null;
  var parts = [];

  var re1 = /<EstructuraFuncional[^>]*tipoParte="Art[^"]*"[^>]*>([\s\S]*?)<\/EstructuraFuncional>/gi;
  var m1;
  while ((m1 = re1.exec(xml)) !== null) {
    var textoMatch = m1[1].match(/<Texto>([\s\S]*?)<\/Texto>/i);
    if (textoMatch) parts.push(textoMatch[1].trim());
  }

  if (parts.length === 0) {
    var re2 = /<TEXTO>([\s\S]*?)<\/TEXTO>/gi;
    var m2;
    while ((m2 = re2.exec(xml)) !== null) {
      var content = m2[1].trim();
      if (content.length > 10) parts.push(content);
    }
  }

  if (parts.length === 0) {
    var re3 = /<[Tt]exto>([\s\S]*?)<\/[Tt]exto>/g;
    var m3;
    while ((m3 = re3.exec(xml)) !== null) {
      var c = m3[1].trim();
      if (c.length > 10) parts.push(c);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}

function cleanForLlm(text, maxChars) {
  var clean = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > maxChars ? clean.substring(0, maxChars) + '...[truncado]' : clean;
}

async function hashText(text) {
  var encoder = new TextEncoder();
  var hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(hashBuffer))
    .map(function(b) { return b.toString(16).padStart(2, '0'); })
    .join('');
}

// ============================================================
// LLM — DeepSeek Call #1: ¿Requiere actualizar el sitio?
// ============================================================
async function analyzeChange(lawConfig, cleanText, env) {
  if (!env.DEEPSEEK_API_KEY) {
    console.warn('[calendar-monitor] Sin DEEPSEEK_API_KEY — saltando analisis LLM');
    return null;
  }

  var siteFeriadosStr = SITE_FERIADOS.map(function(f) {
    return '  ' + f.date + ' — ' + f.nombre;
  }).join('\n');

  var prompt = 'Eres un experto en derecho chileno y calendarios escolares.\n\n' +
    'El sitio calendarioescolar.cl muestra estos feriados en el periodo escolar ' + CURRENT_YEAR + ':\n' +
    siteFeriadosStr + '\n\n' +
    'Periodo escolar: ' + SCHOOL_START + ' a ' + SCHOOL_END + '\n' +
    'Vacaciones invierno: ' + WINTER_START + ' a ' + WINTER_END + '\n\n' +
    'Se detecto un cambio en el texto legal de:\n' +
    lawConfig.sourceName + '\n' +
    'La ley afecta: ' + lawConfig.description + '\n\n' +
    'Texto legal actual (puede estar truncado):\n' + cleanText + '\n\n' +
    'Responde SOLO con JSON valido:\n' +
    '{\n' +
    '  "requiresUpdate": true o false,\n' +
    '  "affectedFeriados": ["YYYY-MM-DD de feriados del sitio potencialmente afectados"],\n' +
    '  "urgency": "HIGH o MEDIUM o LOW",\n' +
    '  "summary": "resumen del cambio en maximo 2 oraciones",\n' +
    '  "reason": "por que requiere o no actualizacion"\n' +
    '}';

  try {
    var response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.DEEPSEEK_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      console.error('[calendar-monitor] DeepSeek error: ' + response.status);
      return null;
    }

    var data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    console.error('[calendar-monitor] analyzeChange error: ' + e.message);
    return null;
  }
}

// ============================================================
// LLM — DeepSeek Call #2: Sugerencia de actualizacion del JSON
// Pide el formato completo de feriadosCompletos para poder
// aplicar el cambio automáticamente via /apply-update
// ============================================================
async function generateUpdateSuggestion(lawConfig, cleanText, analysis, env) {
  if (!env.DEEPSEEK_API_KEY) return null;

  var prompt = 'El sitio calendarioescolar.cl necesita actualizar sus datos de feriados.\n\n' +
    'Cambio detectado en: ' + lawConfig.sourceName + '\n' +
    'Analisis: ' + analysis.summary + '\n' +
    'Feriados afectados: ' + (analysis.affectedFeriados || []).join(', ') + '\n\n' +
    'Texto legal:\n' + cleanText + '\n\n' +
    'Estructura actual de data/calendar-config.json (feriados en periodo escolar):\n' +
    JSON.stringify(SITE_FERIADOS, null, 2) + '\n\n' +
    'Ano escolar: ' + SCHOOL_START + ' a ' + SCHOOL_END + '\n' +
    'Vacaciones invierno: ' + WINTER_START + ' a ' + WINTER_END + '\n\n' +
    'Para cada feriado a agregar/modificar/eliminar, necesito el formato COMPLETO:\n' +
    '  date: "YYYY-MM-DD"\n' +
    '  nombre: "Nombre del feriado"\n' +
    '  accion: "AGREGAR | MODIFICAR | ELIMINAR"\n' +
    '  contexto: "en-clases | sin-impacto" (segun si cae en periodo escolar o no)\n' +
    '  tipo: "civil | laboral | patrio | conmemorativo | religioso"\n' +
    '  diaSemana: "Lunes | Martes | Miercoles | Jueves | Viernes | Sabado | Domingo"\n' +
    '  diaNum: numero del dia del mes (int)\n' +
    '  mes: "enero | febrero | marzo | ... | diciembre"\n' +
    '  notaContexto: "texto explicativo si sin-impacto, o null"\n' +
    '  nota: "nota legal o calculo (ej: Movil, Pascua+60 dias), o null"\n\n' +
    'Responde SOLO con JSON valido:\n' +
    '{\n' +
    '  "feriadosSugeridos": [{\n' +
    '    "date": "YYYY-MM-DD", "nombre": "...", "accion": "AGREGAR|MODIFICAR|ELIMINAR",\n' +
    '    "contexto": "en-clases|sin-impacto", "tipo": "...",\n' +
    '    "diaSemana": "...", "diaNum": N, "mes": "...",\n' +
    '    "notaContexto": "...", "nota": "..."\n' +
    '  }],\n' +
    '  "humanChecklist": ["pasos que el humano debe verificar antes de aplicar"],\n' +
    '  "warning": "advertencias importantes",\n' +
    '  "confidence": "HIGH|MEDIUM|LOW"\n' +
    '}';

  try {
    var response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.DEEPSEEK_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) return null;
    var data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    console.error('[calendar-monitor] generateUpdateSuggestion error: ' + e.message);
    return null;
  }
}

// ============================================================
// APPLY UPDATE via GitHub API
// Endpoint: GET /apply-update?secret=X&key=lawKey
// Flujo: KV pending → GitHub GET file → apply suggestion → GitHub PUT commit
//        → deploy.yml se dispara → generate → build → deploy
// ============================================================
async function handleApplyUpdate(lawKey, env) {
  var repo   = env.GITHUB_REPO  || GITHUB_REPO_DEFAULT;
  var token  = env.GITHUB_TOKEN;

  if (!token) {
    return htmlResponse(
      'Error de configuración',
      '⚠️ Falta GITHUB_TOKEN',
      'El secret GITHUB_TOKEN no está configurado en el worker.<br>' +
      'Configurar con: <code>npx wrangler secret put GITHUB_TOKEN</code>',
      500
    );
  }

  // 1. Leer sugerencia pendiente de KV
  var pendingRaw = null;
  if (env.CALENDAR_KV) {
    try { pendingRaw = await env.CALENDAR_KV.get('pending:' + lawKey); } catch (e) { /* ignore */ }
  }

  if (!pendingRaw) {
    return htmlResponse(
      'Sin pendiente',
      '🤷 No hay sugerencia pendiente',
      'No se encontró una sugerencia pendiente para <code>' + escapeHtml(lawKey) + '</code>.<br>' +
      'Puede que ya fue aplicada o descartada.',
      404
    );
  }

  var pendingData;
  try {
    pendingData = JSON.parse(pendingRaw);
  } catch (e) {
    return htmlResponse('Error', '❌ Error al parsear sugerencia', 'Datos en KV corruptos: ' + e.message, 500);
  }

  var feriadosSugeridos = (pendingData.suggestion && pendingData.suggestion.feriadosSugeridos) || [];
  if (feriadosSugeridos.length === 0) {
    return htmlResponse('Sin cambios', '⚠️ Sugerencia vacía', 'La sugerencia no contiene feriados a modificar.', 400);
  }

  // 2. Leer calendar-config.json desde GitHub
  var apiUrl = 'https://api.github.com/repos/' + repo + '/contents/' + CAL_CONFIG_PATH;
  var getRes;
  try {
    getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'calendar-monitor/' + VERSION
      }
    });
  } catch (e) {
    return htmlResponse('Error de red', '❌ Error al leer GitHub', 'No se pudo conectar a la API de GitHub: ' + e.message, 500);
  }

  if (!getRes.ok) {
    var getErr = await getRes.text();
    return htmlResponse('Error GitHub', '❌ Error al leer archivo', 'HTTP ' + getRes.status + ': ' + getErr, 500);
  }

  var fileData;
  try {
    fileData = await getRes.json();
  } catch (e) {
    return htmlResponse('Error', '❌ Respuesta inválida', 'La API de GitHub respondió con formato inesperado.', 500);
  }

  var currentJson;
  try {
    var decoded = base64ToUtf8(fileData.content);
    currentJson = JSON.parse(decoded);
  } catch (e) {
    return htmlResponse('Error', '❌ JSON inválido', 'No se pudo parsear calendar-config.json: ' + e.message, 500);
  }

  // 3. Aplicar cambios
  var updatedJson = applyFeriadosSuggestion(currentJson, feriadosSugeridos);

  // 4. Commit via GitHub API
  var newContent = utf8ToBase64(JSON.stringify(updatedJson, null, 2));
  var commitMessage = 'fix(feriados): apply calendar-monitor suggestion [' + lawKey + ']\n\n' +
    'Cambios sugeridos por DeepSeek, aprobados via Telegram.\n' +
    'Feriados modificados: ' + feriadosSugeridos.map(function(f) {
      return f.accion + ' ' + f.date + ' (' + f.nombre + ')';
    }).join(', ');

  var putRes;
  try {
    putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'calendar-monitor/' + VERSION
      },
      body: JSON.stringify({
        message: commitMessage,
        content: newContent,
        sha: fileData.sha
      })
    });
  } catch (e) {
    return htmlResponse('Error de red', '❌ Error al commitear', 'No se pudo conectar a la API de GitHub: ' + e.message, 500);
  }

  if (!putRes.ok) {
    var putErr = await putRes.text();
    return htmlResponse('Error GitHub', '❌ Error al commitear', 'HTTP ' + putRes.status + ': ' + putErr, 500);
  }

  // 5. Limpiar KV
  if (env.CALENDAR_KV) {
    try { await env.CALENDAR_KV.delete('pending:' + lawKey); } catch (e) { /* ignore */ }
  }

  // 6. Notificar resultado via Telegram
  var cambiosList = feriadosSugeridos.map(function(f) {
    return f.accion + ' ' + f.date + ' — ' + f.nombre;
  }).join('\n');

  await sendAlert(
    '\u2705 Actualizacion aplicada automaticamente\n\n' +
    'Ley: ' + lawKey + '\n\n' +
    'Cambios commiteados a GitHub:\n' + cambiosList + '\n\n' +
    'El deploy se iniciara en segundos (deploy.yml).\n' +
    'La tabla de feriados-2026.html se regenerara automaticamente.',
    'LOW',
    env,
    null
  );

  // 7. Respuesta HTML al browser
  return htmlResponse(
    '✅ Actualización aplicada',
    '✅ Cambio commiteado con éxito',
    '<p>Los siguientes cambios fueron aplicados a <code>data/calendar-config.json</code>:</p>' +
    '<ul>' + feriadosSugeridos.map(function(f) {
      return '<li><strong>' + escapeHtml(f.accion) + '</strong> ' + escapeHtml(f.date) + ' — ' + escapeHtml(f.nombre) + '</li>';
    }).join('') + '</ul>' +
    '<p>El deploy se inició automáticamente vía <code>deploy.yml</code>.<br>' +
    'La tabla de <code>feriados-2026.html</code> se regenerará en el proceso.</p>' +
    '<p style="color:#6b7280;font-size:0.875rem">Ley monitoreada: ' + escapeHtml(lawKey) + '</p>',
    200
  );
}

// Aplica feriadosSugeridos al objeto JSON de calendar-config
function applyFeriadosSuggestion(config, feriadosSugeridos) {
  var updated = JSON.parse(JSON.stringify(config)); // deep clone

  if (!updated.feriadosCompletos) updated.feriadosCompletos = [];
  if (!updated.feriados) updated.feriados = [];

  feriadosSugeridos.forEach(function(s) {
    var iC = updated.feriadosCompletos.findIndex(function(f) { return f.date === s.date; });
    var iF = updated.feriados.findIndex(function(f) { return f.date === s.date; });

    if (s.accion === 'AGREGAR') {
      if (iC === -1) {
        updated.feriadosCompletos.push({
          date:          s.date,
          nombre:        s.nombre,
          diaSemana:     s.diaSemana  || '',
          diaNum:        s.diaNum     || 0,
          mes:           s.mes        || '',
          tipo:          s.tipo       || 'civil',
          contexto:      s.contexto   || 'en-clases',
          notaContexto:  s.notaContexto !== undefined ? s.notaContexto : null,
          nota:          s.nota       !== undefined ? s.nota : null
        });
      }
      if (iF === -1 && s.contexto === 'en-clases') {
        updated.feriados.push({ date: s.date, nombre: s.nombre });
      }

    } else if (s.accion === 'MODIFICAR') {
      if (iC !== -1) {
        var entry = updated.feriadosCompletos[iC];
        if (s.nombre)        entry.nombre        = s.nombre;
        if (s.diaSemana)     entry.diaSemana     = s.diaSemana;
        if (s.diaNum)        entry.diaNum        = s.diaNum;
        if (s.mes)           entry.mes           = s.mes;
        if (s.tipo)          entry.tipo          = s.tipo;
        if (s.contexto)      entry.contexto      = s.contexto;
        if (s.notaContexto !== undefined) entry.notaContexto = s.notaContexto;
        if (s.nota        !== undefined) entry.nota        = s.nota;
      }
      if (iF !== -1 && s.nombre) {
        updated.feriados[iF].nombre = s.nombre;
      }

    } else if (s.accion === 'ELIMINAR') {
      if (iC !== -1) updated.feriadosCompletos.splice(iC, 1);
      if (iF !== -1) updated.feriados.splice(iF, 1);
    }
  });

  // Ordenar por fecha
  updated.feriadosCompletos.sort(function(a, b) { return a.date.localeCompare(b.date); });
  updated.feriados.sort(function(a, b) { return a.date.localeCompare(b.date); });

  return updated;
}

// ============================================================
// ALERTAS
// Soporta: Telegram (con botones inline), Discord, Slack, ntfy.sh
// buttons: array de inline_keyboard rows para Telegram, o null
// ============================================================
async function sendAlert(message, urgency, env, buttons) {
  if (!env) return;
  urgency = urgency || 'INFO';

  var emojis = { CRITICAL: '\uD83D\uDEA8', HIGH: '\u26A0\uFE0F', MEDIUM: '\uD83D\uDCCB', LOW: '\uD83D\uDCDD', INFO: '\u2139\uFE0F' };
  var emoji = emojis[urgency] || '\u2139\uFE0F';
  var fullMessage = emoji + ' [Calendar Monitor — calendarioescolar.cl]\n\n' + message;

  // Telegram — texto plano + botones inline opcionales
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      var tgPayload = {
        chat_id: env.TELEGRAM_CHAT_ID,
        text: fullMessage
      };
      if (buttons && buttons.length > 0) {
        tgPayload.reply_markup = JSON.stringify({ inline_keyboard: buttons });
      }
      await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tgPayload)
      });
    } catch (e) {
      console.error('[calendar-monitor] Telegram error: ' + e.message);
    }
  }

  // Webhook generico (Discord, Slack, ntfy.sh) — sin botones
  if (env.ALERT_WEBHOOK_URL) {
    var webhookUrl = env.ALERT_WEBHOOK_URL;
    try {
      if (webhookUrl.indexOf('discord.com') !== -1) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: fullMessage })
        });
      } else if (webhookUrl.indexOf('slack.com') !== -1) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullMessage })
        });
      } else {
        var priority = urgency === 'CRITICAL' ? 'urgent' : urgency === 'HIGH' ? 'high' : 'default';
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Title': 'Calendar Monitor',
            'Priority': priority
          },
          body: fullMessage
        });
      }
    } catch (e) {
      console.error('[calendar-monitor] Webhook error: ' + e.message);
    }
  }
}

// ============================================================
// HEALTH ENDPOINT
// ============================================================
async function handleHealthEndpoint(env) {
  var lastRunData = null;
  if (env.CALENDAR_KV) {
    try {
      var stored = await env.CALENDAR_KV.get('monitor:health');
      if (stored) lastRunData = JSON.parse(stored);
    } catch (e) { /* ignore */ }
  }

  return new Response(JSON.stringify({
    ok: true,
    version: VERSION,
    currentYear: CURRENT_YEAR,
    nextYear: NEXT_YEAR,
    monitoredLaws: Object.keys(MONITORED_LAWS).length,
    lastRun: lastRunData ? {
      timestamp: lastRunData.timestamp,
      alertCount: (lastRunData.alerts || []).length
    } : null
  }, null, 2), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================
// UTILS
// ============================================================

// Deriva la URL base del worker para construir botones
function getWorkerUrl(env, request) {
  if (env.WORKER_URL) return env.WORKER_URL.replace(/\/$/, '');
  if (request) {
    var u = new URL(request.url);
    return u.protocol + '//' + u.host;
  }
  return null;
}

// Decode GitHub base64 → UTF-8 string (soporta caracteres especiales)
function base64ToUtf8(b64) {
  var binary = atob(b64.replace(/\n/g, ''));
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// Encode UTF-8 string → base64 para GitHub API
function utf8ToBase64(str) {
  var bytes = new TextEncoder().encode(str);
  var binary = '';
  bytes.forEach(function(b) { binary += String.fromCharCode(b); });
  return btoa(binary);
}

// Escapar HTML para respuestas browser
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Generar respuesta HTML para endpoints que abren en browser
function htmlResponse(title, heading, body, status) {
  var ok = status < 400;
  var color = ok ? '#16a34a' : '#dc2626';
  var html = '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(title) + ' — Calendar Monitor</title>' +
    '<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:4rem auto;padding:1rem;line-height:1.6}' +
    'h2{color:' + color + '}code{background:#f3f4f6;padding:2px 6px;border-radius:4px}' +
    'ul{padding-left:1.5rem}li{margin-bottom:0.5rem}</style></head><body>' +
    '<h2>' + heading + '</h2>' + body +
    '<p style="margin-top:2rem;color:#6b7280;font-size:0.8rem">Calendar Monitor v' + VERSION + '</p>' +
    '</body></html>';
  return new Response(html, {
    status: status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}
