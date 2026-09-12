/* ══════════════════════════════════════════════════════════
   Remote Control – app.js
   · Desde localhost  → PAIR_CODE presente → modo PC
   · Desde Vercel     → sin PAIR_CODE      → modo celular
══════════════════════════════════════════════════════════ */

const PAIR_API = "/api/pair";

// ── Refs de UI ────────────────────────────────────────────
const pairScreen = document.getElementById("pairScreen");
const pcCard     = document.getElementById("pcCard");
const phoneCard  = document.getElementById("phoneCard");
const statusBar  = document.getElementById("statusBar");
const tabsNav    = document.getElementById("tabs");

// ── Helpers de navegación ─────────────────────────────────
function showApp() {
  pairScreen.style.display = "none";
  statusBar.style.display  = "flex";
  tabsNav.style.display    = "flex";
  document.querySelectorAll(".tab-content").forEach(s => {
    s.style.display = s.classList.contains("active") ? "flex" : "none";
  });
}

function showPCMode() {
  pairScreen.style.display = "flex";
  pcCard.style.display     = "flex";
  phoneCard.style.display  = "none";
  statusBar.style.display  = "none";
  tabsNav.style.display    = "none";
  document.querySelectorAll(".tab-content").forEach(s => s.style.display = "none");
}

function showPhoneMode(err) {
  pairScreen.style.display = "flex";
  pcCard.style.display     = "none";
  phoneCard.style.display  = "flex";
  statusBar.style.display  = "none";
  tabsNav.style.display    = "none";
  document.querySelectorAll(".tab-content").forEach(s => s.style.display = "none");
  if (err) document.getElementById("pairError").textContent = err;
}

// ════════════════════════════════════════════════════════════
//  DETECCIÓN: PC (tiene PAIR_CODE en config.js local)
//            o celular (llega desde Vercel, sin PAIR_CODE)
// ════════════════════════════════════════════════════════════
const isPC = typeof window.PAIR_CODE === "string" && window.PAIR_CODE.length === 6;

if (isPC) {

  // ──────────────────────────────────────────────────────────
  //  MODO PC — muestra el código grande, entra a la app
  // ──────────────────────────────────────────────────────────
  showPCMode();

  // Muestra el código: "4 8 2  —  1 9 3"
  const c = window.PAIR_CODE;
  document.getElementById("codeDigits").textContent =
    c[0] + " " + c[1] + " " + c[2] + "  —  " + c[3] + " " + c[4] + " " + c[5];

  // Countdown 10 minutos
  let secs = 10 * 60;
  const countEl = document.getElementById("countdown");
  const cdTimer = setInterval(() => {
    secs--;
    if (secs <= 0) { clearInterval(cdTimer); countEl.textContent = "expirado"; return; }
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    countEl.textContent = `${m}:${s}`;
  }, 1000);

  // Nuevo código = recargar (start.sh ya tiene el servidor corriendo)
  document.getElementById("btnNewCode").addEventListener("click", () => location.reload());

  // El PC ya tiene SERVER_IP inyectado en config.js por server.py
  showApp();
  initApp();

} else {

  // ──────────────────────────────────────────────────────────
  //  MODO CELULAR — pide código o usa sesión guardada
  // ──────────────────────────────────────────────────────────
  const saved = JSON.parse(localStorage.getItem("rc_config") || "{}");

  if (saved.SERVER_IP) {
    // Sesión previa guardada → entra directo sin pedir código
    window.SERVER_IP   = saved.SERVER_IP;
    window.WS_PORT     = saved.WS_PORT     || 8765;
    window.STREAM_PORT = saved.STREAM_PORT || 8766;
    window.SCREEN_W    = saved.SCREEN_W    || 1366;
    window.SCREEN_H    = saved.SCREEN_H    || 768;
    showApp();
    initApp();
  } else {
    showPhoneMode();
    setTimeout(() => document.querySelector(".digit")?.focus(), 300);
  }

  // ── Inputs 6 dígitos ──────────────────────────────────────
  const digits = [...document.querySelectorAll(".digit")];

  digits.forEach((inp, i) => {
    inp.addEventListener("input", () => {
      inp.value = inp.value.replace(/\D/g, "").slice(-1);
      if (inp.value && i < digits.length - 1) digits[i + 1].focus();
      if (digits.every(d => d.value)) tryPair();
    });
    inp.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !inp.value && i > 0) digits[i - 1].focus();
      if (e.key === "Enter") tryPair();
    });
    inp.addEventListener("paste", e => {
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      [...t.slice(0, 6)].forEach((ch, j) => { if (digits[j]) digits[j].value = ch; });
      if (t.length >= 6) tryPair();
      else digits[Math.min(t.length, 5)].focus();
    });
  });

  document.getElementById("btnPair").addEventListener("click", tryPair);

  async function tryPair() {
    const code = digits.map(d => d.value).join("");
    if (code.length !== 6) {
      document.getElementById("pairError").textContent = "Ingresa los 6 dígitos";
      return;
    }
    document.getElementById("pairError").textContent = "";
    const btn = document.getElementById("btnPair");
    btn.textContent = "Buscando…"; btn.disabled = true;

    try {
      const res  = await fetch(`${PAIR_API}?code=${code}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Código no encontrado o expirado");

      const cfg = {
        SERVER_IP:   data.ip,
        WS_PORT:     data.ws_port     || 8765,
        STREAM_PORT: data.stream_port || 8766,
        SCREEN_W:    data.screen_w    || 1366,
        SCREEN_H:    data.screen_h    || 768,
      };
      localStorage.setItem("rc_config", JSON.stringify(cfg));
      Object.assign(window, {
        SERVER_IP:   cfg.SERVER_IP,
        WS_PORT:     cfg.WS_PORT,
        STREAM_PORT: cfg.STREAM_PORT,
        SCREEN_W:    cfg.SCREEN_W,
        SCREEN_H:    cfg.SCREEN_H,
      });
      showApp();
      initApp();

    } catch (e) {
      document.getElementById("pairError").textContent = e.message;
    } finally {
      btn.textContent = "Conectar →"; btn.disabled = false;
    }
  }

  // Botón ⚙️ → desconectar y volver al código
  document.getElementById("btnSettings").addEventListener("click", () => {
    localStorage.removeItem("rc_config");
    digits.forEach(d => d.value = "");
    showPhoneMode();
    setTimeout(() => digits[0].focus(), 100);
  });
}

// ══════════════════════════════════════════════════════════
//  INIT APP — arranca todo cuando ya tenemos IP y puertos
// ══════════════════════════════════════════════════════════
function initApp() {
  const SERVER_IP   = window.SERVER_IP;
  const WS_PORT     = window.WS_PORT     || 8765;
  const STREAM_PORT = window.STREAM_PORT || 8766;
  const SCREEN_W    = window.SCREEN_W    || 1366;
  const SCREEN_H    = window.SCREEN_H    || 768;

  // ── WebSocket control ───────────────────────────────────
  let ws = null, wsReady = false, reconnTimer = null;
  const statusDot  = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  function setStatus(s, t) {
    statusDot.className    = `dot ${s}`;
    statusText.textContent = t;
  }

  function connect() {
    setStatus("connecting", "Conectando…");
    ws = new WebSocket(`ws://${SERVER_IP}:${WS_PORT}`);
    ws.onopen  = () => { wsReady = true;  setStatus("connected",    `Conectado · ${SERVER_IP}`); clearTimeout(reconnTimer); };
    ws.onclose = () => { wsReady = false; setStatus("disconnected", "Sin conexión…"); reconnTimer = setTimeout(connect, 3000); };
    ws.onerror = () => ws.close();
  }

  function send(obj) {
    if (wsReady && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  connect();

  // ── Tabs ────────────────────────────────────────────────
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(s => {
        s.classList.remove("active"); s.style.display = "none";
      });
      tab.classList.add("active");
      const sec = document.getElementById(`tab-${tab.dataset.tab}`);
      sec.classList.add("active");
      sec.style.display = "flex";
    });
  });

  document.getElementById("btnFullscreen").addEventListener("click", () => {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  });

  document.addEventListener("contextmenu", e => e.preventDefault());
  const vibrate = ms => navigator.vibrate?.(ms);

  // ── Stream ──────────────────────────────────────────────
  const canvas     = document.getElementById("screenCanvas");
  const ctx        = canvas.getContext("2d", { alpha: false });
  const cursorDot  = document.getElementById("cursorDot");
  const streamSt   = document.getElementById("streamStatus");
  const btnStream  = document.getElementById("btnStream");
  const screenWrap = document.getElementById("screenWrap");

  canvas.width  = SCREEN_W;
  canvas.height = SCREEN_H;

  let zoom = 1, panX = 0, panY = 0;

  function applyTransform() {
    const cr = canvas.getBoundingClientRect();
    const wr = screenWrap.getBoundingClientRect();
    const maxX = Math.max(0, (cr.width  * zoom - wr.width)  / 2);
    const maxY = Math.max(0, (cr.height * zoom - wr.height) / 2);
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
    canvas.style.transform       = `translate(${panX}px,${panY}px) scale(${zoom})`;
    canvas.style.transformOrigin = "center center";
  }

  document.getElementById("btnResetZoom").addEventListener("click", () => {
    zoom = 1; panX = 0; panY = 0; applyTransform();
  });

  let streamWs = null, frameN = 0, fpsT = null;

  function startStream() {
    if (streamWs) streamWs.close();
    streamSt.textContent = "● Conectando…";
    streamSt.className   = "stream-buf";
    streamWs = new WebSocket(`ws://${SERVER_IP}:${STREAM_PORT}`);
    streamWs.binaryType = "arraybuffer";

    streamWs.onopen = () => {
      btnStream.textContent = "⏹ Detener";
      btnStream.classList.add("active");
      cursorDot.style.display = "block";
      fpsT = setInterval(() => {
        streamSt.textContent = `● ${frameN} fps`;
        streamSt.className   = frameN > 0 ? "stream-on" : "stream-buf";
        frameN = 0;
      }, 1000);
    };

    streamWs.onmessage = async (e) => {
      try {
        const bmp = await createImageBitmap(new Blob([e.data], { type: "image/jpeg" }));
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        bmp.close();
        frameN++;
      } catch (_) {}
    };

    streamWs.onclose = () => {
      btnStream.textContent = "▶ Iniciar";
      btnStream.classList.remove("active");
      cursorDot.style.display = "none";
      streamSt.textContent = "● Sin señal";
      streamSt.className   = "stream-off";
      clearInterval(fpsT);
    };
    streamWs.onerror = () => streamWs.close();
  }

  function stopStream() { streamWs?.close(); streamWs = null; }

  btnStream.addEventListener("click", () => {
    (streamWs && streamWs.readyState === WebSocket.OPEN) ? stopStream() : startStream();
  });

  // Zoom/pan 2 dedos
  const d2 = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  const m2 = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
  let st = { dist: null, mid: null };

  screenWrap.addEventListener("touchstart", e => {
    e.preventDefault();
    if (e.touches.length === 2) { st.dist = d2(e.touches[0], e.touches[1]); st.mid = m2(e.touches[0], e.touches[1]); }
  }, { passive: false });

  screenWrap.addEventListener("touchmove", e => {
    e.preventDefault();
    if (e.touches.length !== 2) return;
    const [t0, t1] = [e.touches[0], e.touches[1]];
    const nd = d2(t0, t1), nm = m2(t0, t1), r = screenWrap.getBoundingClientRect();
    if (st.dist) {
      const f = nd / st.dist, ax = nm.x - r.left - r.width / 2, ay = nm.y - r.top - r.height / 2, pz = zoom;
      zoom = Math.max(1, Math.min(8, zoom * f));
      panX = ax - (ax - panX) * (zoom / pz);
      panY = ay - (ay - panY) * (zoom / pz);
    }
    if (st.mid) { panX += nm.x - st.mid.x; panY += nm.y - st.mid.y; }
    st.dist = nd; st.mid = nm;
    applyTransform();
  }, { passive: false });

  screenWrap.addEventListener("touchend", e => {
    e.preventDefault();
    if (e.touches.length < 2) { st.dist = null; st.mid = null; }
    if (e.touches.length === 0) applyTransform();
  }, { passive: false });

  // ── Joystick ────────────────────────────────────────────
  const joyBase = document.getElementById("joystickBase");
  const joyKnob = document.getElementById("joystickKnob");
  let joyActive = false, joyVec = { x: 0, y: 0 }, joyTimer = null, joyTouchId = null;

  const joyCenter = () => {
    const r = joyBase.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  function setKnob(ox, oy) {
    const d = Math.hypot(ox, oy), cl = d > 36 ? 36 / d : 1;
    joyKnob.style.transform = `translate(calc(-50% + ${ox * cl}px), calc(-50% + ${oy * cl}px))`;
    const n = Math.min(d, 36) / 36;
    joyVec = d < 4 ? { x: 0, y: 0 } : { x: (ox / d) * n, y: (oy / d) * n };
  }

  function resetKnob() {
    joyKnob.style.transform = "translate(-50%,-50%)";
    joyVec = { x: 0, y: 0 };
    joyBase.classList.remove("active");
  }

  const joyTick = () => {
    if (!joyActive || (!joyVec.x && !joyVec.y)) return;
    const sp = 18 * Math.pow(Math.hypot(joyVec.x, joyVec.y), 1.5);
    const dx = Math.round(joyVec.x * sp), dy = Math.round(joyVec.y * sp);
    if (dx || dy) send({ action: "move", dx, dy });
  };

  joyBase.addEventListener("touchstart", e => {
    e.preventDefault();
    if (joyTouchId !== null) return;
    const t = e.changedTouches[0];
    joyTouchId = t.identifier; joyActive = true;
    joyBase.classList.add("active");
    const c = joyCenter(); setKnob(t.clientX - c.x, t.clientY - c.y);
    joyTimer = setInterval(joyTick, 16);
    vibrate(15);
  }, { passive: false });

  joyBase.addEventListener("touchmove", e => {
    e.preventDefault();
    const t = [...e.changedTouches].find(x => x.identifier === joyTouchId);
    if (!t) return;
    const c = joyCenter(); setKnob(t.clientX - c.x, t.clientY - c.y);
  }, { passive: false });

  const joyEnd = e => {
    e.preventDefault();
    const t = [...e.changedTouches].find(x => x.identifier === joyTouchId);
    if (!t) return;
    joyActive = false; joyTouchId = null;
    clearInterval(joyTimer); resetKnob();
  };
  joyBase.addEventListener("touchend",    joyEnd, { passive: false });
  joyBase.addEventListener("touchcancel", joyEnd, { passive: false });

  // ── Botones de clic ──────────────────────────────────────
  document.getElementById("cbLeft").addEventListener("pointerdown",  e => { e.preventDefault(); send({ action: "click", button: "left"  }); vibrate(25); });
  document.getElementById("cbRight").addEventListener("pointerdown", e => { e.preventDefault(); send({ action: "click", button: "right" }); vibrate(25); });

  let scIv = null;
  const startSc = dir => { const dy = dir === "up" ? 30 : -30; send({ action: "scroll", dy }); scIv = setInterval(() => send({ action: "scroll", dy }), 120); };
  const stopSc  = () => { clearInterval(scIv); scIv = null; };

  ["cbScrlUp", "cbScrlDn"].forEach(id => {
    const btn = document.getElementById(id);
    const dir = id === "cbScrlUp" ? "up" : "down";
    btn.addEventListener("pointerdown",  () => startSc(dir));
    btn.addEventListener("pointerup",    stopSc);
    btn.addEventListener("pointerleave", stopSc);
  });

  // ── Teclado ──────────────────────────────────────────────
  const typeInput = document.getElementById("typeInput");
  const sendText  = t => { if (!t) return; send({ action: "type", text: t }); typeInput.value = ""; vibrate(15); };

  document.getElementById("btnSend").addEventListener("click",  () => { sendText(typeInput.value.trim()); send({ action: "key", key: "enter" }); });
  document.getElementById("btnClear").addEventListener("click", () => { typeInput.value = ""; typeInput.focus(); });
  typeInput.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); sendText(typeInput.value.trim()); send({ action: "key", key: "enter" }); }
  });

  document.querySelectorAll(".kbtn:not(.hotkey)").forEach(b => b.addEventListener("click", () => { send({ action: "key", key: b.dataset.key }); vibrate(15); }));
  document.querySelectorAll(".kbtn.hotkey").forEach(b => b.addEventListener("click", () => { send({ action: "hotkey", keys: JSON.parse(b.dataset.keys) }); vibrate(20); }));

  // ── Media ────────────────────────────────────────────────
  document.querySelectorAll(".mbig").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.key)    send({ action: "key",    key:  b.dataset.key });
    if (b.dataset.hotkey) send({ action: "hotkey", keys: JSON.parse(b.dataset.hotkey) });
    vibrate(20);
  }));
}
