/* ══════════════════════════════════════════════════════════
   Remote Control – app.js
══════════════════════════════════════════════════════════ */

const SERVER_IP   = window.SERVER_IP   || location.hostname;
const WS_PORT     = window.WS_PORT     || 8765;
const STREAM_PORT = window.STREAM_PORT || 8766;
const SCREEN_W    = window.SCREEN_W    || 1366;
const SCREEN_H    = window.SCREEN_H    || 768;

// ── WebSocket control ─────────────────────────────────────
let ws = null, wsReady = false, reconnTimer = null;

const statusDot  = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

function setStatus(s, t) { statusDot.className = `dot ${s}`; statusText.textContent = t; }

function connect() {
  setStatus("connecting", "Conectando…");
  ws = new WebSocket(`ws://${SERVER_IP}:${WS_PORT}`);
  ws.onopen  = () => { wsReady=true;  setStatus("connected",    `Conectado · ${SERVER_IP}`); clearTimeout(reconnTimer); };
  ws.onclose = () => { wsReady=false; setStatus("disconnected", "Sin conexión – reintentando…"); reconnTimer=setTimeout(connect,3000); };
  ws.onerror = () => ws.close();
}

function send(obj) {
  if (wsReady && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

connect();
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(s => s.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

document.getElementById("btnFullscreen").addEventListener("click", () => {
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
});
document.addEventListener("contextmenu", e => e.preventDefault());
function vibrate(ms) { navigator.vibrate?.(ms); }

// ══════════════════════════════════════════════════════════
//  STREAM — canvas + zoom/pan con 2 dedos
// ══════════════════════════════════════════════════════════
const canvas     = document.getElementById("screenCanvas");
const ctx        = canvas.getContext("2d", { alpha: false });
const cursorDot  = document.getElementById("cursorDot");
const streamSt   = document.getElementById("streamStatus");
const btnStream  = document.getElementById("btnStream");
const screenWrap = document.getElementById("screenWrap");

// Dimensiones internas del canvas = resolución exacta del escritorio
canvas.width  = SCREEN_W;
canvas.height = SCREEN_H;

// Estado zoom/pan — se aplica como transform CSS sobre el canvas
let zoom = 1, panX = 0, panY = 0;
const ZOOM_MIN = 1, ZOOM_MAX = 8;

function applyTransform() {
  // Obtiene las dimensiones visuales actuales del canvas (CSS auto)
  const cr = canvas.getBoundingClientRect();
  const wr = screenWrap.getBoundingClientRect();
  // Límites de pan: no se puede desplazar más allá del borde de la imagen escalada
  const maxX = Math.max(0, (cr.width  * zoom - wr.width)  / 2);
  const maxY = Math.max(0, (cr.height * zoom - wr.height) / 2);
  panX = Math.max(-maxX, Math.min(maxX, panX));
  panY = Math.max(-maxY, Math.min(maxY, panY));
  canvas.style.transform       = `translate(${panX}px,${panY}px) scale(${zoom})`;
  canvas.style.transformOrigin = "center center";
}

function resetZoom() { zoom=1; panX=0; panY=0; applyTransform(); }
document.getElementById("btnResetZoom").addEventListener("click", resetZoom);

// ── Streaming WebSocket ───────────────────────────────────
let streamWs = null, frameN = 0, fpsT = null;

function startStream() {
  if (streamWs) streamWs.close();
  streamSt.textContent = "● Conectando…"; streamSt.className = "stream-buf";
  streamWs = new WebSocket(`ws://${SERVER_IP}:${STREAM_PORT}`);
  streamWs.binaryType = "arraybuffer";

  streamWs.onopen = () => {
    btnStream.textContent = "⏹ Detener"; btnStream.classList.add("active");
    cursorDot.style.display = "block";
    fpsT = setInterval(() => {
      streamSt.textContent = `● ${frameN} fps`;
      streamSt.className   = frameN > 0 ? "stream-on" : "stream-buf";
      frameN = 0;
    }, 1000);
  };

  // createImageBitmap decodifica fuera del hilo principal
  streamWs.onmessage = async (e) => {
    try {
      const bmp = await createImageBitmap(new Blob([e.data], { type: "image/jpeg" }));
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      frameN++;
    } catch(_) {}
  };

  streamWs.onclose = () => {
    btnStream.textContent = "▶ Iniciar"; btnStream.classList.remove("active");
    cursorDot.style.display = "none";
    streamSt.textContent = "● Sin señal"; streamSt.className = "stream-off";
    clearInterval(fpsT);
  };
  streamWs.onerror = () => streamWs.close();
}

function stopStream() { streamWs?.close(); streamWs = null; }

btnStream.addEventListener("click", () => {
  (streamWs && streamWs.readyState === WebSocket.OPEN) ? stopStream() : startStream();
});

// ── Touch sobre el stream: SOLO zoom/pan con 2 dedos ─────
// 1 dedo no hace nada sobre el stream (el joystick controla el ratón)
// 2 dedos → pinch-to-zoom + pan

let st = { dist: null, mid: null };

function dist2(a, b) { return Math.hypot(b.clientX-a.clientX, b.clientY-a.clientY); }
function mid2(a, b)  { return { x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2 }; }

screenWrap.addEventListener("touchstart", e => {
  e.preventDefault();
  if (e.touches.length === 2) {
    st.dist = dist2(e.touches[0], e.touches[1]);
    st.mid  = mid2(e.touches[0],  e.touches[1]);
  }
}, { passive: false });

screenWrap.addEventListener("touchmove", e => {
  e.preventDefault();
  if (e.touches.length !== 2) return;
  const t0 = e.touches[0], t1 = e.touches[1];
  const newDist = dist2(t0, t1);
  const newMid  = mid2(t0, t1);
  const r = screenWrap.getBoundingClientRect();

  if (st.dist) {
    const factor   = newDist / st.dist;
    const ax = newMid.x - r.left - r.width  / 2;
    const ay = newMid.y - r.top  - r.height / 2;
    const prev = zoom;
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
    panX = ax - (ax - panX) * (zoom / prev);
    panY = ay - (ay - panY) * (zoom / prev);
  }
  if (st.mid) {
    panX += newMid.x - st.mid.x;
    panY += newMid.y - st.mid.y;
  }
  st.dist = newDist; st.mid = newMid;
  applyTransform();
}, { passive: false });

screenWrap.addEventListener("touchend", e => {
  e.preventDefault();
  if (e.touches.length < 2) { st.dist = null; st.mid = null; }
  if (e.touches.length === 0) applyTransform();
}, { passive: false });

// Actualiza el cursorDot en base a la posición real del ratón en pantalla
// (proporcionalmente sobre el canvas teniendo en cuenta zoom/pan)
function updateCursorFromAbs(screenX, screenY) {
  const r    = screenWrap.getBoundingClientRect();
  // posición en coordenadas del canvas normalizado [0,1]
  const nx   = screenX / SCREEN_W;
  const ny   = screenY / SCREEN_H;
  // posición en pixels del contenedor sin zoom
  const bx   = nx * r.width;
  const by   = ny * r.height;
  // aplicar zoom y pan
  const cx   = (bx - r.width /2) * zoom + panX + r.width  / 2;
  const cy   = (by - r.height/2) * zoom + panY + r.height / 2;
  cursorDot.style.left = `${cx}px`;
  cursorDot.style.top  = `${cy}px`;
}

// ══════════════════════════════════════════════════════════
//  JOYSTICK VIRTUAL
// ══════════════════════════════════════════════════════════
const joyBase  = document.getElementById("joystickBase");
const joyKnob  = document.getElementById("joystickKnob");

const JOY_RADIUS   = 36;   // máximo desplazamiento del knob en px
const JOY_DEADZONE = 4;    // zona muerta central
const JOY_SPEED    = 18;   // píxeles del ratón por tick al máximo
const JOY_INTERVAL = 16;   // ms entre envíos (~60 Hz)

let joyActive  = false;
let joyVec     = { x: 0, y: 0 };   // vector normalizado [-1,1]
let joyTimer   = null;
let joyTouchId = null;

function joyCenter() {
  const r = joyBase.getBoundingClientRect();
  return { x: r.left + r.width/2, y: r.top + r.height/2 };
}

function setKnob(ox, oy) {
  // ox,oy en px relativo al centro, clampeado al radio
  const d   = Math.hypot(ox, oy);
  const clamped = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
  const kx  = ox * clamped;
  const ky  = oy * clamped;
  joyKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  const norm = Math.min(d, JOY_RADIUS) / JOY_RADIUS;
  joyVec = d < JOY_DEADZONE
    ? { x:0, y:0 }
    : { x: (ox/d)*norm, y: (oy/d)*norm };
}

function resetKnob() {
  joyKnob.style.transform = "translate(-50%,-50%)";
  joyVec = { x:0, y:0 };
  joyBase.classList.remove("active");
}

function joyTick() {
  if (!joyActive || (joyVec.x === 0 && joyVec.y === 0)) return;
  // Aceleración cuadrática: más suave al inicio, más rápido al máximo
  const speed = JOY_SPEED * Math.pow(Math.hypot(joyVec.x, joyVec.y), 1.5);
  const dx = Math.round(joyVec.x * speed);
  const dy = Math.round(joyVec.y * speed);
  if (dx !== 0 || dy !== 0) send({ action:"move", dx, dy });
}

joyBase.addEventListener("touchstart", e => {
  e.preventDefault();
  if (joyTouchId !== null) return;
  const t = e.changedTouches[0];
  joyTouchId = t.identifier;
  joyActive  = true;
  joyBase.classList.add("active");
  const c = joyCenter();
  setKnob(t.clientX - c.x, t.clientY - c.y);
  joyTimer = setInterval(joyTick, JOY_INTERVAL);
  vibrate(15);
}, { passive: false });

joyBase.addEventListener("touchmove", e => {
  e.preventDefault();
  const t = [...e.changedTouches].find(x => x.identifier === joyTouchId);
  if (!t) return;
  const c = joyCenter();
  setKnob(t.clientX - c.x, t.clientY - c.y);
}, { passive: false });

function joyEnd(e) {
  e.preventDefault();
  const t = [...e.changedTouches].find(x => x.identifier === joyTouchId);
  if (!t) return;
  joyActive  = false;
  joyTouchId = null;
  clearInterval(joyTimer);
  resetKnob();
}
joyBase.addEventListener("touchend",    joyEnd, { passive:false });
joyBase.addEventListener("touchcancel", joyEnd, { passive:false });

// ── Botones de clic ───────────────────────────────────────
document.getElementById("cbLeft").addEventListener("pointerdown",  e => { e.preventDefault(); send({action:"click",button:"left"});  vibrate(25); });
document.getElementById("cbRight").addEventListener("pointerdown", e => { e.preventDefault(); send({action:"click",button:"right"}); vibrate(25); });

// Scroll: dispara en bucle mientras se mantiene pulsado
let scIv = null;
function startSc(dir) {
  const dy = dir === "up" ? 3 : -3;
  send({ action:"scroll", dy: dy*10 });
  scIv = setInterval(() => send({ action:"scroll", dy: dy*10 }), 120);
}
function stopSc() { clearInterval(scIv); scIv=null; }

const cbSU = document.getElementById("cbScrlUp");
const cbSD = document.getElementById("cbScrlDn");
cbSU.addEventListener("pointerdown",  () => startSc("up"));
cbSU.addEventListener("pointerup",    stopSc);
cbSU.addEventListener("pointerleave", stopSc);
cbSD.addEventListener("pointerdown",  () => startSc("down"));
cbSD.addEventListener("pointerup",    stopSc);
cbSD.addEventListener("pointerleave", stopSc);

// ══════════════════════════════════════════════════════════
//  TECLADO
// ══════════════════════════════════════════════════════════
const typeInput = document.getElementById("typeInput");
function sendText(t) { if(!t) return; send({action:"type",text:t}); typeInput.value=""; vibrate(15); }
document.getElementById("btnSend").addEventListener("click",  () => { sendText(typeInput.value.trim()); send({action:"key",key:"enter"}); });
document.getElementById("btnClear").addEventListener("click", () => { typeInput.value=""; typeInput.focus(); });
typeInput.addEventListener("keydown", e => { if(e.key==="Enter"){ e.preventDefault(); sendText(typeInput.value.trim()); send({action:"key",key:"enter"}); }});
document.querySelectorAll(".kbtn:not(.hotkey)").forEach(b => b.addEventListener("click", () => { send({action:"key",key:b.dataset.key}); vibrate(15); }));
document.querySelectorAll(".kbtn.hotkey").forEach(b => b.addEventListener("click", () => { send({action:"hotkey",keys:JSON.parse(b.dataset.keys)}); vibrate(20); }));

// ══════════════════════════════════════════════════════════
//  MEDIA
// ══════════════════════════════════════════════════════════
document.querySelectorAll(".mbig").forEach(b => b.addEventListener("click", () => {
  if (b.dataset.key)    send({action:"key",   key: b.dataset.key});
  if (b.dataset.hotkey) send({action:"hotkey",keys:JSON.parse(b.dataset.hotkey)});
  vibrate(20);
}));
