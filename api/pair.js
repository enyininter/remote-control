/**
 * /api/pair  — Relay de emparejamiento
 *
 * POST /api/pair        { code, ip, ws_port, stream_port, screen_w, screen_h }
 *   → Registra los datos del PC bajo ese código (TTL 10 min)
 *
 * GET  /api/pair?code=XXXXXX
 *   → Devuelve los datos del PC para ese código
 *
 * DELETE /api/pair?code=XXXXXX
 *   → Elimina el código (logout del PC)
 *
 * Los datos se guardan en memoria del proceso de Vercel.
 * Vercel puede tener múltiples instancias, pero para un uso personal
 * (una sola sesión activa) funciona perfectamente.
 * TTL de 10 minutos — el código expira solo.
 */

const store = {};   // { code: { data, expires } }
const TTL   = 10 * 60 * 1000;   // 10 minutos

function cleanup() {
  const now = Date.now();
  for (const k of Object.keys(store)) {
    if (store[k].expires < now) delete store[k];
  }
}

export default function handler(req, res) {
  // CORS — permite que la página en Vercel llame a esta API
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  cleanup();

  // ── POST: el PC registra su sesión ────────────────────────
  if (req.method === "POST") {
    const { code, ip, ws_port, stream_port, screen_w, screen_h } = req.body || {};

    if (!code || !ip) {
      return res.status(400).json({ error: "code and ip are required" });
    }

    // Código debe ser 6 dígitos
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "code must be 6 digits" });
    }

    store[code] = {
      data: { ip, ws_port: ws_port || 8765, stream_port: stream_port || 8766,
              screen_w: screen_w || 1366, screen_h: screen_h || 768 },
      expires: Date.now() + TTL,
    };

    return res.status(200).json({ ok: true, expires_in: TTL / 1000 });
  }

  // ── GET: el celular busca los datos por código ─────────────
  if (req.method === "GET") {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: "code is required" });

    const entry = store[code];
    if (!entry || entry.expires < Date.now()) {
      return res.status(404).json({ error: "code not found or expired" });
    }

    return res.status(200).json(entry.data);
  }

  // ── DELETE: el PC cierra sesión ───────────────────────────
  if (req.method === "DELETE") {
    const code = req.query.code;
    if (code && store[code]) delete store[code];
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: "method not allowed" });
}
