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

  function load() {
    if (loaded) return;
    loaded = true;

    var slot = document.querySelector('.adsbygoogle');
    if (!slot) return;

    var client = slot.getAttribute('data-ad-client');
    if (!client || client.indexOf('XXXX') !== -1) return; // No configurado

    var s = document.createElement('script');
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + client;
    s.async = true;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);

    s.onload = function () {
      var slots = document.querySelectorAll('.adsbygoogle');
      for (var i = 0; i < slots.length; i++) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) { /* slot ya inicializado */ }
      }
    };
  }

  return { init: init };
})();
