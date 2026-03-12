/* countdown.js — Countdown genérico reutilizable
   Uso: Countdown.init('countdown-el', '2026-06-15T00:00:00-04:00')
   El elemento necesita hijos con data-unit: days, hours, minutes, seconds */
var Countdown = (function () {
  var timers = [];

  function init(elementId, targetDateStr, opts) {
    var el = document.getElementById(elementId);
    if (!el) return;

    var target = new Date(targetDateStr).getTime();
    var onComplete = (opts && opts.onComplete) || null;
    var labels = (opts && opts.labels) || { days: 'días', hours: 'horas', minutes: 'min', seconds: 'seg' };

    function update() {
      var now = Date.now();
      var diff = target - now;

      if (diff <= 0) {
        el.innerHTML = (opts && opts.completeText) || '';
        if (onComplete) onComplete();
        return;
      }

      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);

      setUnit(el, 'days', d, labels.days);
      setUnit(el, 'hours', h, labels.hours);
      setUnit(el, 'minutes', m, labels.minutes);
      setUnit(el, 'seconds', s, labels.seconds);
    }

    function setUnit(container, unit, value, label) {
      var numEl = container.querySelector('[data-unit="' + unit + '"] .countdown__number');
      var labelEl = container.querySelector('[data-unit="' + unit + '"] .countdown__label');
      if (numEl) numEl.textContent = value;
      if (labelEl) labelEl.textContent = label;
    }

    update();
    var intervalId = setInterval(update, 1000);
    timers.push(intervalId);
    return intervalId;
  }

  function destroy() {
    timers.forEach(clearInterval);
    timers = [];
  }

  return { init: init, destroy: destroy };
})();
