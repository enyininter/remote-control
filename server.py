#!/usr/bin/env python3
"""
Remote Control Server
– HTTP  WEB_PORT    : sirve la interfaz web
– WS    WS_PORT     : comandos teclado/ratón  (prioridad alta)
– WS    STREAM_PORT : streaming JPEG de pantalla (thread propio)
"""

import asyncio
import io
import json
import os
import queue
import random
import socket
import threading
import time
import urllib.request
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import websockets
from PIL import ImageGrab, Image

# ── Configuración ──────────────────────────────────────────
WEB_PORT    = 8080
WS_PORT     = 8765
STREAM_PORT = 8766

STREAM_FPS     = 5
STREAM_QUALITY = 78
STREAM_SCALE   = 1.0

# URL de la API de Vercel — ajusta si tu dominio es diferente
VERCEL_API = "https://remote-control-enyininter.vercel.app/api/pair"

WEB_DIR = Path(__file__).parent / "web"
os.environ.setdefault("DISPLAY", ":0")

# ── Backend X11 ────────────────────────────────────────────
from Xlib import display as xdisplay, X, XK
from Xlib.ext.xtest import fake_input

_display = xdisplay.Display()
_screen  = _display.screen()
_xlock   = threading.Lock()

SPECIAL_KEYS = {
    "up": XK.XK_Up, "down": XK.XK_Down, "left": XK.XK_Left, "right": XK.XK_Right,
    "home": XK.XK_Home, "end": XK.XK_End, "pageup": XK.XK_Page_Up, "pagedown": XK.XK_Page_Down,
    "enter": XK.XK_Return, "backspace": XK.XK_BackSpace, "delete": XK.XK_Delete,
    "tab": XK.XK_Tab, "esc": XK.XK_Escape, "space": XK.XK_space, "insert": XK.XK_Insert,
    "f1": XK.XK_F1,  "f2": XK.XK_F2,  "f3": XK.XK_F3,  "f4": XK.XK_F4,
    "f5": XK.XK_F5,  "f6": XK.XK_F6,  "f7": XK.XK_F7,  "f8": XK.XK_F8,
    "f9": XK.XK_F9,  "f10": XK.XK_F10, "f11": XK.XK_F11, "f12": XK.XK_F12,
    "ctrl": XK.XK_Control_L, "shift": XK.XK_Shift_L,
    "alt": XK.XK_Alt_L, "super": XK.XK_Super_L, "win": XK.XK_Super_L,
    "playpause": 0x1008FF14, "prevtrack": 0x1008FF16, "nexttrack": 0x1008FF17,
    "volumemute": 0x1008FF12, "volumedown": 0x1008FF11, "volumeup": 0x1008FF13,
    "printscreen": XK.XK_Print,
}

def _kc(ks):    return _display.keysym_to_keycode(ks)
def _kp(ks):
    kc = _kc(ks)
    if kc: fake_input(_display, X.KeyPress,   kc); _display.sync()
def _kr(ks):
    kc = _kc(ks)
    if kc: fake_input(_display, X.KeyRelease, kc); _display.sync()

def _resolve(name):
    name = name.lower()
    if name in SPECIAL_KEYS: return SPECIAL_KEYS[name]
    ks = XK.string_to_keysym(name)
    if ks: return ks
    if len(name) == 1: return ord(name)
    return None

def mouse_move_rel(dx, dy):
    with _xlock:
        p  = _display.screen().root.query_pointer()
        nx = max(0, min(_screen.width_in_pixels  - 1, p.root_x + dx))
        ny = max(0, min(_screen.height_in_pixels - 1, p.root_y + dy))
        fake_input(_display, X.MotionNotify, x=nx, y=ny); _display.sync()

def mouse_move_abs(x, y):
    with _xlock:
        nx = max(0, min(_screen.width_in_pixels  - 1, int(x)))
        ny = max(0, min(_screen.height_in_pixels - 1, int(y)))
        fake_input(_display, X.MotionNotify, x=nx, y=ny); _display.sync()

def mouse_btn(btn, press):
    m = {"left":1,"middle":2,"right":3}
    b = m.get(btn, 1)
    ev = X.ButtonPress if press else X.ButtonRelease
    with _xlock: fake_input(_display, ev, b); _display.sync()

def mouse_scroll(dy):
    btn = 4 if dy > 0 else 5
    with _xlock:
        for _ in range(max(1, abs(dy))):
            fake_input(_display, X.ButtonPress,   btn)
            fake_input(_display, X.ButtonRelease, btn)
        _display.sync()

def key_tap(name):
    ks = _resolve(name)
    if ks:
        with _xlock: _kp(ks); _kr(ks)

def hotkey(*names):
    ksyms = [_resolve(n) for n in names if _resolve(n)]
    with _xlock:
        for k in ksyms:          _kp(k)
        for k in reversed(ksyms): _kr(k)

def type_text(text):
    for ch in text:
        ks = _resolve(ch)
        if not ks: continue
        shift = ch.isupper() or ch in '!"#$%&\'()*+<>?@^_{}|~'
        with _xlock:
            if shift: _kp(XK.XK_Shift_L)
            _kp(ks); _kr(ks)
            if shift: _kr(XK.XK_Shift_L)

def handle_command(data):
    a = data.get("action")
    if   a == "move":        mouse_move_rel(int(data.get("dx",0)), int(data.get("dy",0)))
    elif a == "move_abs":    mouse_move_abs(data.get("x",0), data.get("y",0))
    elif a == "scroll":
        dy = data.get("dy", 0)
        if dy: mouse_scroll(max(1, abs(int(dy))//10) * (1 if dy>0 else -1))
    elif a == "click":       mouse_btn(data.get("button","left"),True);  mouse_btn(data.get("button","left"),False)
    elif a == "double_click":[mouse_btn("left",v) for v in (True,False,True,False)]
    elif a == "right_click": mouse_btn("right",True); mouse_btn("right",False)
    elif a == "mouse_down":  mouse_btn(data.get("button","left"),True)
    elif a == "mouse_up":    mouse_btn(data.get("button","left"),False)
    elif a == "key":         key_tap(data.get("key",""))
    elif a == "hotkey":
        keys = data.get("keys",[])
        if keys: hotkey(*keys)
    elif a in ("type","type_char"):
        t = data.get("text") or data.get("char","")
        if t: type_text(t)


# ── HTTP ───────────────────────────────────────────────────

class SilentHTTP(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=str(WEB_DIR), **kw)
    def log_message(self, *a): pass

def start_http():
    HTTPServer(("0.0.0.0", WEB_PORT), SilentHTTP).serve_forever()


# ── WebSocket: control (event loop principal) ──────────────

async def ws_control(websocket, path=None):
    addr = websocket.remote_address
    print(f"  📱 Control:  {addr[0]}:{addr[1]}")
    try:
        async for msg in websocket:
            try:   handle_command(json.loads(msg))
            except Exception as e: print(f"  ⚠️  {e}")
    except websockets.exceptions.ConnectionClosed: pass
    finally: print(f"  📴 Control off: {addr[0]}:{addr[1]}")


# ── Streaming: captura en thread dedicado ──────────────────
# Los frames se producen en un thread OS y se ponen en una cola.
# Un coroutine asyncio los recoge y los envía a los clientes.
# Así el WS de control nunca espera a que termine una captura.

_frame_queue: queue.Queue = queue.Queue(maxsize=2)   # buffer pequeño = baja latencia
_stream_clients: set = set()
_stream_clients_lock = threading.Lock()

def capture_thread():
    """Thread dedicado a capturar pantalla a FPS constante."""
    interval = 1.0 / STREAM_FPS
    do_resize = STREAM_SCALE < 1.0
    nw = int(_screen.width_in_pixels  * STREAM_SCALE)
    nh = int(_screen.height_in_pixels * STREAM_SCALE)
    buf = io.BytesIO()
    while True:
        t0 = time.monotonic()
        try:
            img = ImageGrab.grab()
            if do_resize:
                img = img.resize((nw, nh), Image.LANCZOS)
            buf.seek(0); buf.truncate()
            img.save(buf, format="JPEG", quality=STREAM_QUALITY,
                     optimize=False, subsampling=0)   # subsampling=0 → mejor color
            frame = buf.getvalue()
            try:   _frame_queue.put_nowait(frame)
            except queue.Full:
                try: _frame_queue.get_nowait()
                except queue.Empty: pass
                _frame_queue.put_nowait(frame)
        except Exception as e:
            print(f"  ⚠️  Captura: {e}")
        elapsed = time.monotonic() - t0
        time.sleep(max(0, interval - elapsed))


async def ws_stream(websocket, path=None):
    addr = websocket.remote_address
    print(f"  🖥️  Stream:   {addr[0]}:{addr[1]}")
    with _stream_clients_lock:
        _stream_clients.add(websocket)
    try:
        await websocket.wait_closed()
    except websockets.exceptions.ConnectionClosed: pass
    finally:
        with _stream_clients_lock:
            _stream_clients.discard(websocket)
        print(f"  📴 Stream off: {addr[0]}:{addr[1]}")


async def broadcast_loop():
    """Coroutine que lee frames de la cola y los envía a todos los clientes."""
    loop = asyncio.get_event_loop()
    while True:
        # Espera un frame sin bloquear el event loop
        frame = await loop.run_in_executor(None, _frame_queue.get)
        with _stream_clients_lock:
            clients = list(_stream_clients)
        if not clients:
            continue
        results = await asyncio.gather(
            *[c.send(frame) for c in clients],
            return_exceptions=True
        )
        # Limpia clientes caídos
        with _stream_clients_lock:
            for c, r in zip(clients, results):
                if isinstance(r, Exception):
                    _stream_clients.discard(c)


# ── Utilidades ─────────────────────────────────────────────

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:    s.connect(("8.8.8.8", 80)); return s.getsockname()[0]
    except: return "127.0.0.1"
    finally: s.close()

def generate_code():
    """Genera un código de 6 dígitos y lo registra en la API de Vercel."""
    code = f"{random.randint(0, 999999):06d}"
    ip   = get_local_ip()
    payload = json.dumps({
        "code":        code,
        "ip":          ip,
        "ws_port":     WS_PORT,
        "stream_port": STREAM_PORT,
        "screen_w":    _screen.width_in_pixels,
        "screen_h":    _screen.height_in_pixels,
    }).encode()
    try:
        req = urllib.request.Request(
            VERCEL_API, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=8)
        return code, ip
    except Exception as e:
        print(f"  ⚠️  No se pudo registrar el código: {e}")
        return code, ip

def delete_code(code):
    try:
        req = urllib.request.Request(
            f"{VERCEL_API}?code={code}", method="DELETE"
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass

def inject_config(ip):
    config = Path(__file__).parent / "web" / "config.js"
    if config.exists():
        config.write_text(
            f'window.SERVER_IP   = "{ip}";\n'
            f'window.WS_PORT     = {WS_PORT};\n'
            f'window.STREAM_PORT = {STREAM_PORT};\n'
            f'window.SCREEN_W    = {_screen.width_in_pixels};\n'
            f'window.SCREEN_H    = {_screen.height_in_pixels};\n'
        )


# ── Main ───────────────────────────────────────────────────

async def main():
    code, ip = generate_code()
    inject_config(ip)

    threading.Thread(target=start_http, daemon=True).start()
    threading.Thread(target=capture_thread, daemon=True).start()

    print("=" * 52)
    print("  🖥️   Remote Control Server")
    print("=" * 52)
    print(f"  IP local:    {ip}")
    print(f"  Web local:   http://{ip}:{WEB_PORT}")
    print(f"  Control WS:  ws://{ip}:{WS_PORT}")
    print(f"  Stream WS:   ws://{ip}:{STREAM_PORT}")
    print(f"  Resolución:  {_screen.width_in_pixels}x{_screen.height_in_pixels}")
    print("-" * 52)
    print(f"  📱 CÓDIGO DE EMPAREJAMIENTO:")
    print()
    print(f"       {'  '.join(list(code))}")
    print()
    print(f"  Ingresa este código en la app del celular")
    print(f"  Expira en 10 minutos")
    print("-" * 52)
    print("  Ctrl+C para detener")
    print("=" * 52)

    try:
        async with websockets.serve(ws_control, "0.0.0.0", WS_PORT):
            async with websockets.serve(ws_stream, "0.0.0.0", STREAM_PORT):
                await broadcast_loop()
    finally:
        delete_code(code)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n  👋 Servidor detenido.")
