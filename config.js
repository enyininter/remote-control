// config.js — versión Vercel (sin datos del PC)
// Cuando server.py corre localmente, sobreescribe este archivo
// con SERVER_IP, puertos y PAIR_CODE reales.
// Desde Vercel este archivo no tiene nada → modo celular.
(function () {
  // Los valores de window.* pueden haber sido seteados por una versión
  // local de config.js — si no existen, los leemos de localStorage.
  const saved = JSON.parse(localStorage.getItem("rc_config") || "{}");
  window.SERVER_IP   = window.SERVER_IP   || saved.SERVER_IP   || "";
  window.WS_PORT     = window.WS_PORT     || saved.WS_PORT     || 8765;
  window.STREAM_PORT = window.STREAM_PORT || saved.STREAM_PORT || 8766;
  window.SCREEN_W    = window.SCREEN_W    || saved.SCREEN_W    || 1366;
  window.SCREEN_H    = window.SCREEN_H    || saved.SCREEN_H    || 768;
  window.PAIR_CODE   = window.PAIR_CODE   || "";
})();
