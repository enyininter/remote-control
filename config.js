// config.js
// Cuando el servidor local (server.py) está corriendo, sobreescribe
// este archivo con los valores reales + PAIR_CODE.
// Cuando se sirve desde Vercel, este archivo no tiene nada → modo celular.
(function () {
  const saved = JSON.parse(localStorage.getItem("rc_config") || "{}");
  window.SERVER_IP   = window.SERVER_IP   || saved.SERVER_IP   || "";
  window.WS_PORT     = window.WS_PORT     || saved.WS_PORT     || 8765;
  window.STREAM_PORT = window.STREAM_PORT || saved.STREAM_PORT || 8766;
  window.SCREEN_W    = window.SCREEN_W    || saved.SCREEN_W    || 1366;
  window.SCREEN_H    = window.SCREEN_H    || saved.SCREEN_H    || 768;
  window.PAIR_CODE   = window.PAIR_CODE   || "";
})();
