# 🖥️ Remote Control

Convierte tu teléfono en un **touchpad + teclado inalámbrico** para controlar tu PC desde el navegador, sin instalar nada en el móvil.

---

## ⚡ Inicio rápido

```bash
cd remote_control
./start.sh
```

Verás algo así en la terminal:

```
====================================================
  🖥️   Remote Control Server
====================================================
  IP local:  192.168.1.42
  Web:       http://192.168.1.42:8080
  WebSocket: ws://192.168.1.42:8765
----------------------------------------------------
  Abre la URL en tu teléfono (misma red WiFi)
  Ctrl+C para detener
====================================================
```

Abre la URL `http://192.168.1.xx:8080` en el navegador del teléfono.  
**PC y teléfono deben estar en la misma red WiFi.**

---

## 📋 Requisitos

| Componente | Versión |
|------------|---------|
| Python       | 3.7 +   |
| python3-xlib | cualquiera |
| websockets   | cualquiera |

Instalar manualmente si hace falta:

```bash
pip3 install python3-xlib websockets
```

> **Linux únicamente.** Funciona con cualquier entorno de escritorio X11 (GNOME, KDE, XFCE, etc.).

---

## 📱 Controles disponibles

### 🖱️ Touchpad
| Gesto | Acción |
|-------|--------|
| Deslizar 1 dedo | Mover cursor |
| Toque corto 1 dedo | Clic izquierdo |
| Toque corto 2 dedos | Clic derecho |
| Deslizar 2 dedos | Scroll |
| Botón **Izquierdo** | Clic izquierdo |
| Botón **Derecho** | Clic derecho |
| Mantener botón (400 ms) | Mouse down (arrastrar) |
| Doble tap botón izquierdo | Doble clic |
| Botones ▲▼ Scroll | Scroll rápido continuo |

### ⌨️ Teclado
- **Campo de texto** → escribe y pulsa ↵ para enviar al PC
- **Teclas especiales**: Esc, Tab, Backspace, Delete, Enter, flechas, PgUp/Dn…
- **Atajos**: Ctrl+C/V/X/Z/A/S/W, Alt+Tab, Alt+F4, Win/Super, terminal, Task Manager

### 🎵 Media
- Anterior / Play-Pause / Siguiente
- Silenciar / Bajar volumen / Subir volumen
- Bloquear pantalla
- Screenshot (Print Screen)

---

## 🗂️ Estructura del proyecto

```
remote_control/
├── server.py          ← Servidor Python (HTTP + WebSocket)
├── start.sh           ← Lanzador
└── web/
    ├── index.html     ← Interfaz del mando
    ├── style.css      ← Estilos
    ├── app.js         ← Lógica WebSocket y controles
    └── config.js      ← Generado automáticamente (IP del servidor)
```

---

## 🔧 Configuración avanzada

Edita las constantes al inicio de `server.py`:

```python
WEB_PORT = 8080   # Puerto de la página web
WS_PORT  = 8765   # Puerto WebSocket
```

---

## 🛡️ Seguridad

La app sólo escucha en la red local. No expongas los puertos al exterior.  
Si necesitas usarlo fuera de casa, considera tunelizar con SSH.

---

## 🐛 Solución de problemas

| Problema | Solución |
|----------|----------|
| "Sin conexión" en el móvil | Verifica que PC y móvil estén en la misma WiFi |
| Puerto en uso | Cambia `WEB_PORT` o `WS_PORT` en `server.py` |
| El cursor no se mueve | Asegúrate de que `DISPLAY=:0` esté definido al lanzar el servidor |
| Error `No module named Xlib` | Ejecuta: `pip3 install python3-xlib` |
| Firewall bloquea | Abre los puertos 8080 y 8765 en el firewall del PC |
# remote-control
# remote-control
