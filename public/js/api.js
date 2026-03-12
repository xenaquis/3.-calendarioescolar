/* api.js — Fetch wrapper con cache en memoria + retry
   Solo para arquetipo C (sitios dinámicos con Worker).
   Uso: API.get('/api/data').then(d => ...) */
var API = (function () {
  var cache = {};
  var DEFAULT_TTL = 5 * 60 * 1000; // 5 min

  function get(endpoint, ttlMs) {
    var ttl = ttlMs || DEFAULT_TTL;
    var key = endpoint;
    var cached = cache[key];

    if (cached && Date.now() - cached.ts < ttl) {
      return Promise.resolve(cached.data);
    }

    return fetch(endpoint)
      .then(function (res) {
        if (!res.ok) throw new Error('API ' + res.status);
        return res.json();
      })
      .then(function (data) {
        cache[key] = { data: data, ts: Date.now() };
        return data;
      })
      .catch(function (err) {
        // Servir stale si hay cache expirado
        if (cached) return cached.data;
        throw err;
      });
  }

  function clearCache() {
    cache = {};
  }

  return { get: get, clearCache: clearCache };
})();
