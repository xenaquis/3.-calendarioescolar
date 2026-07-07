// workers/calendar-monitor/index.js
// Calendar Monitor — calendarioescolar.cl
// Cloudflare Worker | Cron: lunes 08:00 UTC
//
// Que hace:
//   1. Verifica health.json del sitio (dataYear, antiguedad)
//   2. Monitorea leyes de feriados via BCN XML API (fuente: Diario Oficial)
//      - Compara fechaVersion del XML (= fecha publicacion en DO) en vez de hash de texto
//      - Separa articulos transitorios para detectar vigencia futura
//      - Incluye numero de edicion DO en alertas
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

var VERSION = '1.2.0';
var CURRENT_YEAR = 2026;
var NEXT_YEAR = CURRENT_YEAR + 1;
var RATE_LIMIT_MS = 2000; // ms entre requests a BCN

// Periodo escolar actual — actualizar cada noviembre
// Sincronizado con data/calendar-config.json (milestone-361, 2026-07-06):
// schoolStart = ingreso de estudiantes; schoolEnd = ultimo dia JEC nacional.
var SCHOOL_START  = '2026-03-04';
var SCHOOL_END    = '2026-12-04';
var WINTER_START  = '2026-06-22';
var WINTER_END    = '2026-07-03';

// ============================================================
// FERIADOS ACTUALES DEL SITIO
// Mantener sincronizado con data/calendar-config.json → feriados[]
// Estos son los feriados que caen en periodo escolar
// ============================================================
// CORREGIDO milestone-361: la lista anterior incluia Corpus Christi 4-jun
// (NO es feriado desde 2007 — check-feriados.js lo bloquearia en build) y
// omitia Virgen del Carmen 16-jul. Fuente: data/calendar-config.json
// (feriadosCompletos con contexto 'en-clases').
var SITE_FERIADOS = [
  { date: '2026-04-03', nombre: 'Viernes Santo' },
  { date: '2026-05-01', nombre: 'Dia del Trabajo' },
  { date: '2026-05-21', nombre: 'Glorias Navales' },
  { date: '2026-07-16', nombre: 'Virgen del Carmen' },
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
        '5. Editar data/calendar-config.json y data/pages.json en el repo; el push a main deploya',
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
    // Umbral 3 dias (antes 30): el deploy es DIARIO — con 3 dias este
    // watchdog habria detectado el apagon de crons del 23-30 jun en 72h.
    if (daysDiff > 3) {
      warnings.push('Sin regenerar hace ' + daysDiff + ' dias (deploy diario caido?)');
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
    // Dedup: solo alertar una vez cada 30 dias para no generar ruido semanal
    var failKvKey = 'law:' + lawKey + ':fetch-fail-notified';
    var alreadyNotified = env.CALENDAR_KV ? await env.CALENDAR_KV.get(failKvKey) : null;
    if (!alreadyNotified) {
      await sendAlert(
        '[BCN] No se pudo obtener XML para ' + lawConfig.sourceName + '\n' +
        'idNorma: ' + lawConfig.idNorma + '\n' +
        'BCN puede no tener XML disponible para esta norma, o es un problema temporal.\n' +
        'Si persiste, verificar si BCN cambio el idNorma o el formato de export.',
        'MEDIUM',
        env,
        null
      );
      if (env.CALENDAR_KV) {
        try { await env.CALENDAR_KV.put(failKvKey, '1', { expirationTtl: 60 * 60 * 24 * 30 }); } catch (e) { /* ignore */ }
      }
    } else {
      console.log('[calendar-monitor] BCN sin XML para ' + lawKey + ' — ya notificado, saltando alerta');
    }
    return { status: 'fetch_failed', lawKey: lawKey };
  }

  // fechaVersion = fecha de publicacion en DO de la ultima modificacion legal
  var currentFechaVersion = extractFechaVersion(xml);
  var doMeta = extractDoMetadata(xml);

  if (!currentFechaVersion) {
    await sendAlert(
      '[BCN] Fallo en extraccion de fechaVersion para ' + lawConfig.sourceName + '\n' +
      'idNorma: ' + lawConfig.idNorma + '\n' +
      'El XML no tiene el atributo fechaVersion esperado. BCN puede haber cambiado su formato.\n' +
      'Revisar extractFechaVersion() en el worker.',
      'MEDIUM',
      env,
      null
    );
    return { status: 'extraction_failed', lawKey: lawKey };
  }

  var kvKey = 'law:' + lawKey + ':fecha-version';
  var storedFechaVersion = null;

  if (env.CALENDAR_KV) {
    try {
      storedFechaVersion = await env.CALENDAR_KV.get(kvKey);
    } catch (e) {
      console.error('[calendar-monitor] KV get error: ' + e.message);
    }
  }

  if (!storedFechaVersion) {
    console.log('[calendar-monitor] Primera ejecucion para ' + lawKey + ' — guardando fechaVersion base: ' + currentFechaVersion);
    if (env.CALENDAR_KV) {
      try { await env.CALENDAR_KV.put(kvKey, currentFechaVersion); } catch (e) { /* ignore */ }
    }
    return { status: 'initialized', lawKey: lawKey, fechaVersion: currentFechaVersion };
  }

  if (storedFechaVersion === currentFechaVersion) {
    console.log('[calendar-monitor] Sin cambios en ' + lawKey + ' (fechaVersion=' + currentFechaVersion + ')');
    return { status: 'unchanged', lawKey: lawKey };
  }

  // fechaVersion cambio — modificacion legal real publicada en DO
  console.log('[calendar-monitor] Cambio detectado en ' + lawKey + ': ' + storedFechaVersion + ' \u2192 ' + currentFechaVersion);

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

  var cleanArticulos = cleanForLlm(extracted.articulos, 2500);
  var cleanTransitorios = extracted.transitorios ? cleanForLlm(extracted.transitorios, 800) : '';

  // Actualizar KV con la nueva fechaVersion
  if (env.CALENDAR_KV) {
    try { await env.CALENDAR_KV.put(kvKey, currentFechaVersion); } catch (e) { /* ignore */ }
  }

  var analysis = await analyzeChange(lawConfig, cleanArticulos, cleanTransitorios, doMeta, env);

  if (!analysis) {
    await sendAlert(
      '[LEY] Cambio detectado en ' + lawConfig.sourceName + '\n' +
      'Modificacion: ' + storedFechaVersion + ' \u2192 ' + currentFechaVersion + '\n' +
      (doMeta.numeroFuente ? 'Edicion DO: ' + doMeta.numeroFuente + '\n' : '') +
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
      'Modificacion detectada: ' + storedFechaVersion + ' \u2192 ' + currentFechaVersion + '\n' +
      (doMeta.numeroFuente ? 'Edicion DO: ' + doMeta.numeroFuente + '\n' : '') +
      (analysis.hasTransitorias ? '\u26A0\uFE0F Contiene disposiciones transitorias\n' : '') +
      (analysis.esCambioFuturo ? '\uD83D\uDCC5 Vigencia futura: ' + (analysis.vigenciaDesde || 'ver analisis') + '\n' : '') +
      '\nResumen: ' + analysis.summary + '\n' +
      'Razon: ' + analysis.reason + '\n\n' +
      'Conclusion: No requiere actualizar el sitio.',
      'LOW',
      env,
      null
    );
    return { status: 'changed_no_action', lawKey: lawKey, analysis: analysis };
  }

  // REQUIERE ACTUALIZACION — segunda llamada DeepSeek para sugerencia
  var suggestion = await generateUpdateSuggestion(lawConfig, cleanArticulos, cleanTransitorios, doMeta, analysis, env);

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
    'Modificacion detectada: ' + storedFechaVersion + ' \u2192 ' + currentFechaVersion + '\n' +
    (doMeta.numeroFuente ? 'Edicion DO: ' + doMeta.numeroFuente + '\n' : '') +
    (analysis.hasTransitorias ? '\u26A0\uFE0F Disposiciones transitorias: SI\n' : '') +
    (analysis.esCambioFuturo ? '\uD83D\uDCC5 Vigencia futura: ' + (analysis.vigenciaDesde || 'ver analisis') + '\n' : '') +
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
    var text = await response.text();
    // Validar que BCN devolvio XML real (algunas normas no tienen export XML disponible)
    if (text.indexOf('<?xml') === -1 && text.indexOf('<Norma') === -1) {
      console.warn('[calendar-monitor] BCN no devolvio XML para idNorma=' + idNorma + ' — norma sin XML disponible o formato no reconocido');
      return null;
    }
    return text;
  } catch (e) {
    console.error('[calendar-monitor] fetchBcnXml error: ' + e.message);
    return null;
  }
}

function extractLawText(xml) {
  if (!xml) return null;
  var articulosParts = [];
  var transitoriosParts = [];

  var re = /<EstructuraFuncional([^>]*)>([\s\S]*?)<\/EstructuraFuncional>/gi;
  var m;
  while ((m = re.exec(xml)) !== null) {
    var attrs = m[1];
    var inner = m[2];
    var transAttr = attrs.match(/transitorio="([^"]*)"/i);
    var isTransitorio = transAttr && transAttr[1] !== 'no transitorio' && transAttr[1].length > 0;
    var textoMatch = inner.match(/<Texto>([\s\S]*?)<\/Texto>/i);
    if (textoMatch) {
      var text = textoMatch[1].trim();
      if (isTransitorio) {
        transitoriosParts.push(text);
      } else {
        articulosParts.push(text);
      }
    }
  }

  // Fallback: XMLs sin EstructuraFuncional
  if (articulosParts.length === 0 && transitoriosParts.length === 0) {
    var re2 = /<[Tt]exto>([\s\S]*?)<\/[Tt]exto>/g;
    var m2;
    while ((m2 = re2.exec(xml)) !== null) {
      var c = m2[1].trim();
      if (c.length > 10) articulosParts.push(c);
    }
  }

  if (articulosParts.length === 0 && transitoriosParts.length === 0) return null;

  return {
    articulos: articulosParts.join('\n\n'),
    transitorios: transitoriosParts.join('\n\n')
  };
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

// Extrae el atributo fechaVersion del tag raiz <Norma>
// Equivale a la fecha de publicacion en DO de la ultima modificacion legal
function extractFechaVersion(xml) {
  if (!xml) return null;
  var m = xml.match(/fechaVersion="([^"]+)"/);
  return m ? m[1] : null;
}

// Extrae numero de edicion del Diario Oficial desde los metadatos BCN
function extractDoMetadata(xml) {
  if (!xml) return {};
  var meta = {};
  var mFuente = xml.match(/<NumeroFuente>([^<]+)<\/NumeroFuente>/);
  if (mFuente) meta.numeroFuente = mFuente[1].trim();
  return meta;
}

// ============================================================
// LLM — DeepSeek Call #1: ¿Requiere actualizar el sitio?
// ============================================================
async function analyzeChange(lawConfig, cleanArticulos, cleanTransitorios, doMeta, env) {
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
    'La ley afecta: ' + lawConfig.description + '\n' +
    (doMeta.numeroFuente ? 'Publicado en Diario Oficial edicion: ' + doMeta.numeroFuente + '\n' : '') +
    '\nARTICULOS VIGENTES:\n' + cleanArticulos + '\n\n' +
    (cleanTransitorios ? 'ARTICULOS TRANSITORIOS (pueden aplicar solo a ciertos anos):\n' + cleanTransitorios + '\n\n' : '') +
    'INSTRUCCION CRITICA sobre disposiciones transitorias:\n' +
    '  Si hay articulos transitorios, identifica EXPLICITAMENTE su fecha de vigencia.\n' +
    '  Si el cambio rige solo para un ano futuro, urgency debe ser "LOW".\n\n' +
    'Responde SOLO con JSON valido:\n' +
    '{\n' +
    '  "requiresUpdate": true o false,\n' +
    '  "affectedFeriados": ["YYYY-MM-DD de feriados del sitio potencialmente afectados"],\n' +
    '  "urgency": "HIGH o MEDIUM o LOW",\n' +
    '  "summary": "resumen del cambio en maximo 2 oraciones",\n' +
    '  "reason": "por que requiere o no actualizacion",\n' +
    '  "hasTransitorias": true o false,\n' +
    '  "vigenciaDesde": "YYYY o YYYY-MM-DD si aplica, o null si es inmediata",\n' +
    '  "esCambioFuturo": true o false\n' +
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
async function generateUpdateSuggestion(lawConfig, cleanArticulos, cleanTransitorios, doMeta, analysis, env) {
  if (!env.DEEPSEEK_API_KEY) return null;

  var prompt = 'El sitio calendarioescolar.cl necesita actualizar sus datos de feriados.\n\n' +
    'Cambio detectado en: ' + lawConfig.sourceName + '\n' +
    'Analisis: ' + analysis.summary + '\n' +
    'Feriados afectados: ' + (analysis.affectedFeriados || []).join(', ') + '\n' +
    (doMeta.numeroFuente ? 'Diario Oficial edicion: ' + doMeta.numeroFuente + '\n' : '') +
    (analysis.hasTransitorias ? 'ATENCION: Contiene disposiciones transitorias\n' : '') +
    (analysis.esCambioFuturo ? 'Vigencia futura: ' + (analysis.vigenciaDesde || 'ver analisis') + '\n' : '') +
    '\nARTICULOS VIGENTES:\n' + cleanArticulos + '\n\n' +
    (cleanTransitorios ? 'ARTICULOS TRANSITORIOS:\n' + cleanTransitorios + '\n\n' : '') +
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
