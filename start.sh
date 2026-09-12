#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Remote Control — Lanzador
#  Doble clic para iniciar. Abre el navegador automáticamente.
# ─────────────────────────────────────────────────────────────
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGFILE="$DIR/.server.log"
PIDFILE="$DIR/.server.pid"

# ── Mata instancia anterior si existe ────────────────────────
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE")
  kill "$OLD_PID" 2>/dev/null || true
  rm -f "$PIDFILE"
fi

# ── Instala dependencias silenciosamente si faltan ───────────
python3 -c "import websockets, PIL, Xlib" 2>/dev/null || {
  pip3 install websockets Pillow python3-xlib --quiet \
    --disable-pip-version-check 2>>"$LOGFILE" || true
}

# ── Inicia el servidor en segundo plano ──────────────────────
export DISPLAY="${DISPLAY:-:0}"
cd "$DIR"
nohup python3 server.py > "$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"

# ── Espera a que el servidor esté listo (máx 8 seg) ─────────
for i in $(seq 1 16); do
  sleep 0.5
  if curl -s http://localhost:8080/ -o /dev/null 2>/dev/null; then
    break
  fi
done

# ── Abre el navegador en la página con el código ─────────────
URL="http://localhost:8080"

if command -v xdg-open &>/dev/null; then
  xdg-open "$URL"
elif command -v firefox &>/dev/null; then
  firefox "$URL" &
elif command -v google-chrome &>/dev/null; then
  google-chrome "$URL" &
elif command -v chromium-browser &>/dev/null; then
  chromium-browser "$URL" &
fi
