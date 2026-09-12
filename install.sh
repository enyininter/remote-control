#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Remote Control — Instalador
#  Ejecuta esto UNA SOLA VEZ. Después el servidor arranca
#  automáticamente cada vez que enciendas el PC.
# ─────────────────────────────────────────────────────────────
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME="$(whoami)"
PYTHON="$(which python3)"
SERVICE_NAME="remote-control"
SERVICE_FILE="$HOME/.config/systemd/user/${SERVICE_NAME}.service"
AUTOSTART_DIR="$HOME/.config/autostart"
AUTOSTART_FILE="${AUTOSTART_DIR}/remote-control-browser.desktop"

echo "🔧 Instalando Remote Control..."

# ── 1. Instala dependencias Python ───────────────────────────
echo "   Instalando dependencias Python..."
pip3 install websockets Pillow python3-xlib --quiet --disable-pip-version-check 2>/dev/null || true

# ── 2. Crea el servicio systemd de usuario ───────────────────
mkdir -p "$HOME/.config/systemd/user"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Remote Control Server
After=graphical-session.target
Wants=graphical-session.target

[Service]
Type=simple
ExecStart=${PYTHON} ${DIR}/server.py
WorkingDirectory=${DIR}
Restart=on-failure
RestartSec=3
Environment=DISPLAY=:0
Environment=HOME=${HOME}

[Install]
WantedBy=default.target
EOF

# ── 3. Habilita e inicia el servicio ─────────────────────────
systemctl --user daemon-reload
systemctl --user enable "${SERVICE_NAME}"
systemctl --user start  "${SERVICE_NAME}"

# ── 4. Autostart del navegador al iniciar sesión ─────────────
# Espera 5 segundos al login para que el servidor esté listo,
# luego abre el navegador en localhost:8080
mkdir -p "$AUTOSTART_DIR"

cat > "$AUTOSTART_FILE" << EOF
[Desktop Entry]
Type=Application
Name=Remote Control
Comment=Abre Remote Control en el navegador
Exec=bash -c 'sleep 5 && xdg-open http://localhost:8080'
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

echo ""
echo "✅ Instalación completa."
echo ""
echo "   El servidor arrancará automáticamente al encender el PC."
echo "   El navegador abrirá solo con el código de emparejamiento."
echo ""
echo "   URL del celular: https://remote-control-gamma.vercel.app"
echo ""
