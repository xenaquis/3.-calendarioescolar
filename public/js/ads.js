/* ads.js — AdSense lazy loader (non-blocking para Core Web Vitals)
   Carga AdSense solo cuando el usuario interactúa o tras 3s.
   El pub-ID se lee del data attribute del primer slot. */
var Ads = (function () {
  var loaded = false;

  function init() {
    var events = ['scroll', 'click', 'touchstart', 'mousemove', 'keydown'];
    events.forEach(function (evt) {
      window.addEventListener(evt, load, { once: true, passive: true });
    });
    setTimeout(load, 3000);
  }

  // Slots de ejemplo del scaffold — NO existen en la cuenta AdSense. Pushearlos genera
  // requests a slots inexistentes y arriesga la política de la cuenta. Se ignoran hasta
  // tener IDs reales del panel AdSense.
  var PLACEHOLDER_SLOTS = ['1234567890', '0987654321', '1122334455'];

  function isReal(slot) {
    var id = slot.getAttribute('data-ad-slot');
    return id && PLACEHOLDER_SLOTS.indexOf(id) === -1;
  }

  function load() {
    if (loaded) return;
    loaded = true;

    var slot = document.querySelector('.adsbygoogle');
    if (!slot) return;

    var client = slot.getAttribute('data-ad-client');
    if (!client || client.indexOf('XXXX') !== -1) return; // No configurado

    // Solo cargar AdSense si hay al menos un slot REAL (no placeholder del scaffold).
    var realSlots = [];
    var all = document.querySelectorAll('.adsbygoogle');
    for (var j = 0; j < all.length; j++) {
      if (isReal(all[j])) realSlots.push(all[j]);
    }
    if (realSlots.length === 0) return;

    var s = document.createElement('script');
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + client;
    s.async = true;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);

    s.onload = function () {
      for (var i = 0; i < realSlots.length; i++) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) { /* slot ya inicializado */ }
      }
    };
  }

  return { init: init };
})();
