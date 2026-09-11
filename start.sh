#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  Remote Control – Lanzador
# ─────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Verifica dependencias Python
python3 -c "import Xlib, websockets" 2>/dev/null || {
  echo ""
  echo "  ⚠️  Faltan dependencias. Instalando…"
  pip3 install python3-xlib websockets --quiet
}

# Asegura que DISPLAY esté definido (necesario para controlar X11)
export DISPLAY="${DISPLAY:-:0}"

echo ""
echo "  🚀 Iniciando Remote Control Server…"
echo ""

cd "$SCRIPT_DIR"
python3 server.py
