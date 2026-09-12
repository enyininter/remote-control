// config.js
// En red local este archivo es sobreescrito por server.py con los valores reales.
// En Vercel (o cualquier hosting externo) los valores se leen de localStorage
// y se configuran desde la pantalla de ajustes de la app.
(function () {
  const saved = JSON.parse(localStorage.getItem("rc_config") || "{}");
  window.SERVER_IP   = saved.SERVER_IP   || "";
  window.WS_PORT     = saved.WS_PORT     || 8765;
  window.STREAM_PORT = saved.STREAM_PORT || 8766;
  window.SCREEN_W    = saved.SCREEN_W    || 1366;
  window.SCREEN_H    = saved.SCREEN_H    || 768;
  // Indica que estamos en modo remoto (no red local)
  window.RC_REMOTE   = !saved.SERVER_IP ? true : false;
})();
