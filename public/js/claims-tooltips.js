/* claims-tooltips.js — Popula tooltips BCN desde CLAIMS_DATA
   Generado por generate-pages.js, datos desde claims.json via Sheet */
;(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', function() {
    if (!window.CLAIMS_DATA) return;
    var badges = document.querySelectorAll('[data-claim-id]');
    for (var i = 0; i < badges.length; i++) {
      var claimId = badges[i].getAttribute('data-claim-id');
      var claim = window.CLAIMS_DATA[claimId];
      if (!claim || !claim.source_reference) continue;
      var tooltip = badges[i].querySelector('.bcn-tooltip');
      if (!tooltip) continue;
      var sourceName = claim.source_name || '';
      var text = claim.source_reference;
      if (sourceName) text += ', ' + sourceName;
      if (claim.extracto_verbatim) {
        var excerpt = claim.extracto_verbatim;
        if (excerpt.length > 200) excerpt = excerpt.substring(0, 197) + '...';
        text += ': «' + excerpt + '»';
      }
      tooltip.textContent = text;
    }
  });
})();
