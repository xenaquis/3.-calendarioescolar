/* analytics.js — GA4 minimal loader (non-blocking)
   Se activa solo si hay GA4 ID en el script tag o config. */
var Analytics = (function () {
  function init(measurementId) {
    if (!measurementId || measurementId.indexOf('XXXX') !== -1) return;

    // gtag
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', measurementId, { send_page_view: true });

    // Load gtag script
    var s = document.createElement('script');
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    s.async = true;
    document.head.appendChild(s);
  }

  return { init: init };
})();
