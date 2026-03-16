// workers/calendar-monitor/index.js
// Calendar Monitor — calendarioescolar.cl
// Cloudflare Worker | Cron: lunes 08:00 UTC
//
// Que hace:
//   1. Verifica health.json del sitio (dataYear, antiguedad)
//   2. Monitorea Ley 2.977 de feriados en BCN via XML API
//   3. Detecta cuando Mineduc publica calendarios del ano siguiente
//
// No publica nada. Solo detecta, analiza y alerta.
// El humano siempre decide si actualizar data/calendar-config.json.
//
// Setup:
//   cd workers/calendar-monitor
//   npx wrangler kv namespace create CALENDAR_KV   <- anotar el ID → pegar en wrangler.toml
//   npx wrangler secret put DEEPSEEK_API_KEY
//   npx wrangler secret put MONITOR_SECRET
//   npx wrangler secret put ALERT_WEBHOOK_URL      (o TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
//   npx wrangler deploy
//
// Test:   GET https://tu-worker.workers.dev/trigger?secret=TU_SECRET
// Health: GET https://tu-worker.workers.dev/health
//
// ACTUALIZACION ANUAL (cada noviembre cuando cambia el ano escolar):
//   1. Actualizar CURRENT_YEAR, SCHOOL_START, SCHOOL_END, WINTER_START, WINTER_END
//   2. Actualizar SITE_FERIADOS con los 7 feriados del nuevo ano
//   3. Resetear KV key 'url:mineduc-calendarios-siguiente:status' (eliminarla)
//      para que el monitor vuelva a alertar cuando publiquen los calendarios del ano +2

var VERSION = '1.0.0';
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
// Mantener sincronizado con data/calendar-config.json
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
//
// URL texto: https://www.bcn.cl/leychile/navegar?idNorma={id}
// URL XML:   https://www.bcn.cl/leychile/consulta/obtxml?opt=7&idNorma={id}
//
// idNorma VERIFICADOS (no editar sin comprobar en bcn.cl/leychile):
//   Ley 2.977  → idNorma=23639  → https://www.bcn.cl/leychile/navegar?idNorma=23639
//   Ley 19.668 → idNorma=160270 → https://www.bcn.cl/leychile/navegar?idNorma=160270
//   Ley 21.357 → idNorma=1161743 → https://www.bcn.cl/leychile/navegar?idNorma=1161743
//
// FORMATO XML REAL DE BCN (verificado):
//   Leyes modernas: <EstructuraFuncional tipoParte="Artículo"><Texto>...</Texto></EstructuraFuncional>
//   Leyes antiguas: <ESTRUCTURA_FUNCIONAL nombre_parte="PRIMERO"><TEXTOS><TEXTO>...</TEXTO></TEXTOS></ESTRUCTURA_FUNCIONAL>
//   No hay tag <ARTICULO NUM="N"> — los articulos van en EstructuraFuncional/Texto
//   Por esto se hashea TODO el contenido textual, no articulos individuales
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
    description: 'Traslada a lunes los feriados 29 junio (San Pedro/Pablo) y 12 octubre (Enc. Dos Mundos) cuando caen martes-viernes',
    actionIfChanged: 'Verificar si cambia la regla de traslado de San Pedro/Pablo y 12 octubre. Recalcular fechas reales en calendar-config.json.'
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
// Si aparecen al menos 2 de estos keywords en la pagina = calendarios publicados
var MINEDUC_POSITIVE_KEYWORDS = ['.pdf', 'resolucion', 'descargar', 'calendario regional', 'exenta'];
// Si aparece alguno de estos = pagina de error que retorna 200 (falso positivo)
var MINEDUC_NEGATIVE_KEYWORDS = ['no encontrado', '404', 'page not found', 'error 404'];

// ============================================================
// EXPORT DEFAULT — Cloudflare Workers ES modules
// ============================================================
export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);

    if (url.pathname === '/health') {
      return handleHealthEndpoint(env);
    }

    if (url.pathname === '/trigger') {
      var secret = url.searchParams.get('secret');
      if (!env.MONITOR_SECRET || secret !== env.MONITOR_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      ctx.waitUntil(runMonitor(env));
      return new Response(
        JSON.stringify({ ok: true, message: 'Monitor iniciado', version: VERSION }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      'Calendar Monitor v' + VERSION + '\n' +
      'GET /health           — estado del monitor\n' +
      'GET /trigger?secret=X — ejecutar manualmente',
      { status: 200, headers: { 'Content-Type': 'text/plain' } }
    );
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runMonitor(env));
  }
};

// ============================================================
// MAIN ORCHESTRATION
// ============================================================
async function runMonitor(env) {
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
      await sendAlert('[SITIO] health.json ERROR: ' + healthResult.message, 'HIGH', env);
      report.alerts.push({ type: 'SITE_HEALTH_ERROR', urgency: 'HIGH' });
    } else if (healthResult.status === 'warning') {
      await sendAlert('[SITIO] health.json ADVERTENCIA: ' + healthResult.message, 'MEDIUM', env);
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
      var lawResult = await checkBcnLaw(lawKey, lawConfig, env);
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
        env
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
    if (daysDiff > 45) {
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
async function checkBcnLaw(lawKey, lawConfig, env) {
  console.log('[calendar-monitor] Verificando ' + lawKey + ' (idNorma=' + lawConfig.idNorma + ')');

  // 1. Fetch XML de BCN
  var xml = await fetchBcnXml(lawConfig.idNorma);
  if (!xml) {
    await sendAlert(
      '[BCN] No se pudo obtener XML para ' + lawConfig.sourceName + '\n' +
      'idNorma: ' + lawConfig.idNorma + '\n' +
      'Puede ser problema temporal de BCN. Si persiste, verificar idNorma.',
      'MEDIUM',
      env
    );
    return { status: 'fetch_failed', lawKey: lawKey };
  }

  // 2. Extraer texto de articulos
  var extracted = extractLawText(xml);
  if (!extracted) {
    await sendAlert(
      '[BCN] Fallo en extraccion de texto para ' + lawConfig.sourceName + '\n' +
      'El XML no tiene estructura reconocible. BCN puede haber cambiado el formato.\n' +
      'Revisar extractLawText() en el worker.',
      'MEDIUM',
      env
    );
    return { status: 'extraction_failed', lawKey: lawKey };
  }

  // 3. Hash SHA-256 del texto extraido
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

  // Primera ejecucion: guardar hash base y salir
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

  // 4. Hash cambio — analizar con DeepSeek
  console.log('[calendar-monitor] Cambio detectado en ' + lawKey + ' — analizando...');
  var cleanText = cleanForLlm(extracted, 3000);
  var analysis = await analyzeChange(lawConfig, cleanText, env);

  // Guardar nuevo hash independientemente del resultado del LLM
  if (env.CALENDAR_KV) {
    try { await env.CALENDAR_KV.put(kvKey, currentHash); } catch (e) { /* ignore */ }
  }

  if (!analysis) {
    // Sin LLM: alerta conservadora con el texto crudo
    await sendAlert(
      '[LEY] Cambio en texto de ' + lawConfig.sourceName + '\n' +
      'No se pudo analizar (sin DEEPSEEK_API_KEY o error de API).\n\n' +
      'Accion: ' + lawConfig.actionIfChanged,
      'MEDIUM',
      env
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
      env
    );
    return { status: 'changed_no_action', lawKey: lawKey, analysis: analysis };
  }

  // 5. REQUIERE ACTUALIZACION — segunda llamada DeepSeek para sugerencia
  var suggestion = await generateUpdateSuggestion(lawConfig, cleanText, analysis, env);

  var suggestionText = '';
  if (suggestion) {
    // Guardar en KV para referencia
    if (env.CALENDAR_KV) {
      try {
        await env.CALENDAR_KV.put(
          'pending:' + lawKey,
          JSON.stringify({ analysis: analysis, suggestion: suggestion, timestamp: new Date().toISOString() }),
          { expirationTtl: 60 * 60 * 24 * 30 }
        );
      } catch (e) { /* ignore */ }
    }
    // Incluir sugerencia en la alerta directamente
    suggestionText = '\n\nSUGERENCIA DE ACTUALIZACION:\n' +
      JSON.stringify(suggestion.feriadosSugeridos || [], null, 2) + '\n\n' +
      'Checklist humano:\n' +
      (suggestion.humanChecklist || []).map(function(s) { return '- ' + s; }).join('\n') + '\n\n' +
      'Confianza: ' + (suggestion.confidence || '?') + '\n' +
      'Advertencia: ' + (suggestion.warning || '');
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
    env
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

  // Ya alertado — no re-alertar hasta que el humano resetee la key en KV
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

  // 404 o similar = pagina no existe todavia = normal hasta noviembre
  if (!response.ok) {
    console.log('[calendar-monitor] Mineduc ' + NEXT_YEAR + ' HTTP ' + response.status + ' — aun no publicado');
    return { status: 'not_published', httpStatus: response.status, published: false };
  }

  var html = await response.text();
  var htmlLower = html.toLowerCase();

  // Verificar keywords negativos (pagina de error que retorna 200)
  for (var n = 0; n < MINEDUC_NEGATIVE_KEYWORDS.length; n++) {
    if (htmlLower.indexOf(MINEDUC_NEGATIVE_KEYWORDS[n]) !== -1) {
      return { status: 'not_published', reason: 'keyword negativo encontrado', published: false };
    }
  }

  // Contar keywords positivos — umbral: al menos 2
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

// Extrae el contenido textual de los articulos del XML de BCN.
//
// El formato XML de BCN varia segun la epoca de digitacion:
//
//   Leyes modernas (ej: 19.668, 21.357):
//     <EstructuraFuncional tipoParte="Artículo" idParte="XXXXXXX">
//       <Texto>contenido del articulo</Texto>
//     </EstructuraFuncional>
//
//   Leyes antiguas (ej: 2.977 de 1915):
//     <ESTRUCTURA_FUNCIONAL nombre_parte="PRIMERO">
//       <TEXTOS><TEXTO>ART. PRIMERO.- contenido</TEXTO></TEXTOS>
//     </ESTRUCTURA_FUNCIONAL>
//
// Estrategia: extraer TODO el contenido de articulos (no filtrar por numero),
// concatenar y hashear. Si el hash cambia en cualquier articulo, se detecta.
// DeepSeek determina si el cambio es relevante para el sitio.
//
// Retorna null solo si el XML no tiene estructura reconocible (alerta de formato roto).
function extractLawText(xml) {
  if (!xml) return null;
  var parts = [];

  // Patron 1: formato moderno — <EstructuraFuncional tipoParte="Artículo">...<Texto>...</Texto>
  var re1 = /<EstructuraFuncional[^>]*tipoParte="Art[^"]*"[^>]*>([\s\S]*?)<\/EstructuraFuncional>/gi;
  var m1;
  while ((m1 = re1.exec(xml)) !== null) {
    // Extraer contenido de <Texto> dentro del EstructuraFuncional
    var textoMatch = m1[1].match(/<Texto>([\s\S]*?)<\/Texto>/i);
    if (textoMatch) parts.push(textoMatch[1].trim());
  }

  if (parts.length === 0) {
    // Patron 2: formato antiguo — <ESTRUCTURA_FUNCIONAL>...<TEXTO>...</TEXTO>
    var re2 = /<TEXTO>([\s\S]*?)<\/TEXTO>/gi;
    var m2;
    while ((m2 = re2.exec(xml)) !== null) {
      var content = m2[1].trim();
      if (content.length > 10) parts.push(content); // filtrar tags vacios
    }
  }

  if (parts.length === 0) {
    // Patron 3: cualquier tag <Texto> o <texto> (variante mixta)
    var re3 = /<[Tt]exto>([\s\S]*?)<\/[Tt]exto>/g;
    var m3;
    while ((m3 = re3.exec(xml)) !== null) {
      var c = m3[1].trim();
      if (c.length > 10) parts.push(c);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}

// Strip tags XML, decode entidades, colapsar whitespace, truncar
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
// LLM — DeepSeek
// Call #1: ¿Requiere actualizar el sitio?
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
// LLM — DeepSeek
// Call #2: Sugerencia de actualizacion del JSON
// Solo se llama si analyzeChange devuelve requiresUpdate: true
// ============================================================
async function generateUpdateSuggestion(lawConfig, cleanText, analysis, env) {
  if (!env.DEEPSEEK_API_KEY) return null;

  var prompt = 'El sitio calendarioescolar.cl necesita actualizar sus datos de feriados.\n\n' +
    'Cambio detectado en: ' + lawConfig.sourceName + '\n' +
    'Analisis: ' + analysis.summary + '\n' +
    'Feriados afectados: ' + (analysis.affectedFeriados || []).join(', ') + '\n\n' +
    'Texto legal:\n' + cleanText + '\n\n' +
    'Estructura actual de data/calendar-config.json:\n' +
    '{\n' +
    '  "year": ' + CURRENT_YEAR + ',\n' +
    '  "schoolStart": "' + SCHOOL_START + '",\n' +
    '  "winterStart": "' + WINTER_START + '",\n' +
    '  "winterEnd": "' + WINTER_END + '",\n' +
    '  "schoolEnd": "' + SCHOOL_END + '",\n' +
    '  "feriados": ' + JSON.stringify(SITE_FERIADOS) + '\n' +
    '}\n\n' +
    'Responde SOLO con JSON valido:\n' +
    '{\n' +
    '  "feriadosSugeridos": [{"date": "YYYY-MM-DD", "nombre": "...", "accion": "AGREGAR o MODIFICAR o ELIMINAR"}],\n' +
    '  "humanChecklist": ["pasos que el humano debe verificar antes de actualizar"],\n' +
    '  "warning": "advertencias importantes",\n' +
    '  "confidence": "HIGH o MEDIUM o LOW"\n' +
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
        max_tokens: 600,
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
// ALERTAS
// Soporta: Telegram (texto plano), Discord, Slack, ntfy.sh
// ============================================================
async function sendAlert(message, urgency, env) {
  if (!env) return;
  urgency = urgency || 'INFO';

  var emojis = { CRITICAL: '🚨', HIGH: '⚠️', MEDIUM: '📋', LOW: '📝', INFO: 'ℹ️' };
  var emoji = emojis[urgency] || 'ℹ️';
  var fullMessage = emoji + ' [Calendar Monitor — calendarioescolar.cl]\n\n' + message;

  // Telegram — texto plano (sin parse_mode para evitar errores de escape en mensajes dinamicos)
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: fullMessage
          // Sin parse_mode: texto plano, nunca falla por escaping
        })
      });
    } catch (e) {
      console.error('[calendar-monitor] Telegram error: ' + e.message);
    }
  }

  // Webhook generico (Discord, Slack, ntfy.sh)
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
        // ntfy.sh o webhook generico
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
function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}
