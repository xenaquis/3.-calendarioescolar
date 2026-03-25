#!/usr/bin/env node
/* notify-telegram.js — Envia notificaciones de cambios BCN via Telegram Bot API.
   Sin dependencias npm. Usa modulo nativo https de Node.js.

   Lee JSON desde stdin con la estructura:
   {
     "changes": [
       {
         "data_key": "feriado_ano_nuevo",
         "texto_antes": "old verbatim text",
         "texto_despues": "new verbatim text",
         "evaluacion": "sin_impacto|requiere_revision|actualizar",
         "claim_text": "1 de enero es feriado legal"
       }
     ],
     "total_claims_checked": 15,
     "detection_date": "2026-03-25T06:00:00Z"
   }

   Variables de entorno:
     - TELEGRAM_BOT_TOKEN (requerido salvo --dry-run)
     - TELEGRAM_CHAT_ID   (requerido salvo --dry-run)

   Uso:
     echo '{"changes":[...],...}' | node scripts/notify-telegram.js
     echo '{"changes":[...],...}' | node scripts/notify-telegram.js --dry-run
*/

(function () {
  'use strict';

  var https = require('https');
  var url   = require('url');

  // ── Constantes ───────────────────────────────────────────────────────────
  var SHEET_ID   = '160WyrLOm6nV2MAg1cusYvSbVzOWnqYWIt8O5MgXRvF4';
  var SHEET_URL  = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID;
  var MAX_MSG    = 4096;
  var TRUNCATE   = 300; // chars maximos por bloque de texto

  var EVAL_EMOJI = {
    sin_impacto:       '\u26ab', // circulo negro (representa verde en Telegram)
    requiere_revision: '\ud83d\udfe1', // circulo amarillo
    actualizar:        '\ud83d\udd34'  // circulo rojo
  };

  // Telegram no permite circulo verde unicode en todos los clientes; usamos check verde
  EVAL_EMOJI['sin_impacto'] = '\u2705'; // check verde

  // ── CLI args ──────────────────────────────────────────────────────────────
  function parseArgs() {
    var args = process.argv.slice(2);
    return {
      dryRun: args.indexOf('--dry-run') !== -1
    };
  }

  // ── Leer stdin ────────────────────────────────────────────────────────────
  function readStdin(callback) {
    var chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (chunk) {
      chunks.push(chunk);
    });
    process.stdin.on('end', function () {
      var raw = chunks.join('');
      if (!raw.trim()) {
        callback(new Error('stdin vacio: se esperaba JSON con campo "changes"'));
        return;
      }
      try {
        var data = JSON.parse(raw);
        callback(null, data);
      } catch (e) {
        callback(new Error('JSON invalido en stdin: ' + e.message));
      }
    });
    process.stdin.on('error', function (e) {
      callback(new Error('Error leyendo stdin: ' + e.message));
    });
  }

  // ── Truncar texto ─────────────────────────────────────────────────────────
  function truncate(text, maxLen) {
    if (!text) { return '(sin texto)'; }
    var s = String(text);
    if (s.length <= maxLen) { return s; }
    return s.slice(0, maxLen) + '... [truncado]';
  }

  // ── Escapar HTML para Telegram ────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Formatear mensaje HTML ────────────────────────────────────────────────
  function formatMessage(data) {
    var changes         = data.changes || [];
    var totalChecked    = data.total_claims_checked || 0;
    var detectionDate   = data.detection_date || new Date().toISOString();

    var header = '<b>Cambio detectado en articulado BCN</b>\n'
      + '<b>Fecha:</b> ' + escapeHtml(detectionDate) + '\n'
      + '<b>Claims revisados:</b> ' + totalChecked + '\n'
      + '<b>Cambios:</b> ' + changes.length + '\n';

    var blocks = [];
    for (var i = 0; i < changes.length; i++) {
      var ch         = changes[i];
      var dataKey    = ch.data_key    || '(desconocido)';
      var claimText  = ch.claim_text  || '(sin claim registrado)';
      var evaluacion = ch.evaluacion  || 'requiere_revision';
      var emoji      = EVAL_EMOJI[evaluacion] || '\u2753'; // ? como fallback
      var textBefore = truncate(ch.texto_antes, TRUNCATE);
      var textAfter  = truncate(ch.texto_despues, TRUNCATE);

      var block = '\n---\n\n'
        + '<b>Claim:</b> <code>' + escapeHtml(dataKey) + '</code>\n'
        + '<b>Afirmacion:</b> ' + escapeHtml(claimText) + '\n'
        + '<b>Evaluacion IA:</b> ' + emoji + ' ' + escapeHtml(evaluacion) + '\n\n'
        + '<b>Texto anterior:</b>\n'
        + '<pre>' + escapeHtml(textBefore) + '</pre>\n\n'
        + '<b>Texto actual (BCN):</b>\n'
        + '<pre>' + escapeHtml(textAfter) + '</pre>\n';

      blocks.push(block);
    }

    var footer = '\n<a href="' + SHEET_URL + '">Abrir Google Sheet</a>';

    return header + blocks.join('') + footer;
  }

  // ── Enviar mensaje (puede devolver multiples mensajes si excede limite) ───
  function buildMessages(data) {
    var full = formatMessage(data);
    if (full.length <= MAX_MSG) {
      return [full];
    }

    // Si excede el limite, enviar resumen + un mensaje por cambio
    var changes       = data.changes || [];
    var totalChecked  = data.total_claims_checked || 0;
    var detectionDate = data.detection_date || new Date().toISOString();

    var summary = '<b>Cambio detectado en articulado BCN</b>\n'
      + '<b>Fecha:</b> ' + escapeHtml(detectionDate) + '\n'
      + '<b>Claims revisados:</b> ' + totalChecked + '\n'
      + '<b>Cambios:</b> ' + changes.length + '\n'
      + '\u26a0\ufe0f Mensaje dividido por longitud — ver siguientes mensajes para detalles.\n'
      + '<a href="' + SHEET_URL + '">Abrir Google Sheet</a>';

    var msgs = [summary];

    for (var i = 0; i < changes.length; i++) {
      var ch         = changes[i];
      var dataKey    = ch.data_key    || '(desconocido)';
      var claimText  = ch.claim_text  || '(sin claim registrado)';
      var evaluacion = ch.evaluacion  || 'requiere_revision';
      var emoji      = EVAL_EMOJI[evaluacion] || '\u2753';

      // Reducir truncate si sigue siendo demasiado largo
      var textBefore = truncate(ch.texto_antes, 150);
      var textAfter  = truncate(ch.texto_despues, 150);

      var detail = '<b>Cambio ' + (i + 1) + '/' + changes.length + '</b>\n'
        + '<b>Claim:</b> <code>' + escapeHtml(dataKey) + '</code>\n'
        + '<b>Afirmacion:</b> ' + escapeHtml(claimText) + '\n'
        + '<b>Evaluacion IA:</b> ' + emoji + ' ' + escapeHtml(evaluacion) + '\n\n'
        + '<b>Texto anterior:</b>\n'
        + '<pre>' + escapeHtml(textBefore) + '</pre>\n\n'
        + '<b>Texto actual (BCN):</b>\n'
        + '<pre>' + escapeHtml(textAfter) + '</pre>\n'
        + '<a href="' + SHEET_URL + '">Abrir Google Sheet</a>';

      msgs.push(detail);
    }

    return msgs;
  }

  // ── POST a Telegram API ───────────────────────────────────────────────────
  function sendToTelegram(token, chatId, text, callback) {
    var body = JSON.stringify({
      chat_id:    chatId,
      text:       text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    var endpoint = 'https://api.telegram.org/bot' + token + '/sendMessage';
    var parsed   = url.parse(endpoint);

    var options = {
      hostname: parsed.hostname,
      path:     parsed.path,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    var req = https.request(options, function (res) {
      var chunks = [];
      res.on('data', function (d) { chunks.push(d); });
      res.on('end', function () {
        var responseBody = chunks.join('');
        if (res.statusCode === 200) {
          callback(null, responseBody);
        } else {
          callback(new Error(
            'Telegram API error: HTTP ' + res.statusCode + '\n' + responseBody
          ));
        }
      });
    });

    req.on('error', function (e) {
      callback(new Error('Error de red al contactar Telegram: ' + e.message));
    });

    req.write(body);
    req.end();
  }

  // ── Enviar multiples mensajes en serie ────────────────────────────────────
  function sendAllMessages(token, chatId, messages, index, callback) {
    if (index >= messages.length) {
      callback(null);
      return;
    }
    sendToTelegram(token, chatId, messages[index], function (err) {
      if (err) {
        callback(err);
        return;
      }
      sendAllMessages(token, chatId, messages, index + 1, callback);
    });
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  function main() {
    var opts = parseArgs();

    readStdin(function (err, data) {
      if (err) {
        console.error('notify-telegram: ' + err.message);
        process.exit(1);
      }

      if (!data.changes || !Array.isArray(data.changes)) {
        console.error('notify-telegram: JSON debe tener campo "changes" (array)');
        process.exit(1);
      }

      if (data.changes.length === 0) {
        console.log('notify-telegram: 0 cambios detectados. Sin notificacion.');
        process.exit(0);
      }

      var messages = buildMessages(data);

      if (opts.dryRun) {
        console.log('=== DRY-RUN: Mensaje(s) Telegram que se enviarian ===\n');
        for (var i = 0; i < messages.length; i++) {
          console.log('--- Mensaje ' + (i + 1) + ' de ' + messages.length + ' ---');
          console.log(messages[i]);
          console.log('');
        }
        console.log('=== FIN DRY-RUN (' + messages.length + ' mensaje(s), '
          + messages.reduce(function (acc, m) { return acc + m.length; }, 0)
          + ' chars total) ===');
        process.exit(0);
      }

      // Verificar variables de entorno
      var token  = process.env.TELEGRAM_BOT_TOKEN;
      var chatId = process.env.TELEGRAM_CHAT_ID;

      if (!token) {
        console.error('notify-telegram: Falta variable de entorno TELEGRAM_BOT_TOKEN');
        console.error('  Instrucciones: https://core.telegram.org/bots#botfather');
        console.error('  1. Crear bot con @BotFather en Telegram');
        console.error('  2. Copiar el token y agregarlo como secret en GitHub Actions');
        process.exit(1);
      }

      if (!chatId) {
        console.error('notify-telegram: Falta variable de entorno TELEGRAM_CHAT_ID');
        console.error('  Instrucciones: Enviar un mensaje al bot y usar:');
        console.error('  curl https://api.telegram.org/bot{TOKEN}/getUpdates');
        console.error('  El chat_id aparece en result[0].message.chat.id');
        process.exit(1);
      }

      console.log('notify-telegram: Enviando ' + messages.length
        + ' mensaje(s) a Telegram...');

      sendAllMessages(token, chatId, messages, 0, function (sendErr) {
        if (sendErr) {
          console.error('notify-telegram: ' + sendErr.message);
          process.exit(1);
        }

        console.log('Telegram notification sent (' + messages.length + ' mensaje(s))');
        console.log('--- Preview (primeros 500 chars) ---');
        console.log(messages[0].slice(0, 500));
        process.exit(0);
      });
    });
  }

  main();

})();
