/* ══════════════════════════════════════════════════════════
   Remote Control – app.js
══════════════════════════════════════════════════════════ */

const PAIR_API = "/api/pair";   // Vercel serverless function

// ── Elementos de UI ───────────────────────────────────────
const pairScreen = document.getElementById("pairScreen");
const statusBar  = document.getElementById("statusBar");
const tabsNav    = document.getElementById("tabs");

function showApp() {
  pairScreen.style.display = "none";
  statusBar.style.display  = "flex";
  tabsNav.style.display    = "flex";
  document.querySelectorAll(".tab-content").forEach(s => {
    s.style.display = s.classList.contains("active") ? "flex" : "none";
  });
}

function showPair(err) {
  pairScreen.style.display = "flex";
  statusBar.style.display  = "none";
  tabsNav.style.display    = "none";
  document.querySelectorAll(".tab-content").forEach(s => s.style.display = "none");
  if (err) { document.getElementById("pairError").textContent = err; }
}

// ── Inputs de código (6 dígitos) ──────────────────────────
const digits = [...document.querySelectorAll(".digit")];

digits.forEach((inp, i) => {
  inp.addEventListener("input", () => {
    inp.value = inp.value.replace(/\D/g, "").slice(-1);
    if (inp.value && i < digits.length - 1) digits[i + 1].focus();
    // Auto-conectar cuando se completan los 6 dígitos
    if (digits.every(d => d.value)) tryPair();
  });
  inp.addEventListener("keydown", e => {
    if (e.key === "Backspace" && !inp.value && i > 0) digits[i - 1].focus();
    if (e.key === "Enter") tryPair();
  });
  // Al pegar el código completo en el primer campo
  inp.addEventListener("paste", e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
    [...text.slice(0, 6)].forEach((ch, j) => { if (digits[j]) digits[j].value = ch; });
    if (text.length >= 6) tryPair();
    else digits[Math.min(text.length, 5)].focus();
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
  document.getElementById("btnPair").textContent   = "Buscando…";
  document.getElementById("btnPair").disabled      = true;

  try {
    const res  = await fetch(`${PAIR_API}?code=${code}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Código no encontrado o expirado");
    }

    // Guarda la config y arranca
    const cfg = {
      SERVER_IP:   data.ip,
      WS_PORT:     data.ws_port     || 8765,
      STREAM_PORT: data.stream_port || 8766,
      SCREEN_W:    data.screen_w    || 1366,
      SCREEN_H:    data.screen_h    || 768,
    };
    localStorage.setItem("rc_config", JSON.stringify(cfg));

    // Aplica los valores globales sin recargar
    window.SERVER_IP   = cfg.SERVER_IP;
    window.WS_PORT     = cfg.WS_PORT;
    window.STREAM_PORT = cfg.STREAM_PORT;
    window.SCREEN_W    = cfg.SCREEN_W;
    window.SCREEN_H    = cfg.SCREEN_H;

    showApp();
    initApp();

  } catch (e) {
    document.getElementById("pairError").textContent = e.message;
  } finally {
    document.getElementById("btnPair").textContent = "Conectar →";
    document.getElementById("btnPair").disabled    = false;
  }
}

// ── Botón ⚙️ para desconectar y volver al código ─────────
document.getElementById("btnSettings").addEventListener("click", () => {
  localStorage.removeItem("rc_config");
  digits.forEach(d => d.value = "");
  showPair();
  setTimeout(() => digits[0].focus(), 100);
});

// ── Arranque ─────────────────────────────────────────────
// Si hay config guardada de una sesión previa, entra directo
const _saved = JSON.parse(localStorage.getItem("rc_config") || "{}");
if (_saved.SERVER_IP) {
  window.SERVER_IP   = _saved.SERVER_IP;
  window.WS_PORT     = _saved.WS_PORT     || 8765;
  window.STREAM_PORT = _saved.STREAM_PORT || 8766;
  window.SCREEN_W    = _saved.SCREEN_W    || 1366;
  window.SCREEN_H    = _saved.SCREEN_H    || 768;
  showApp();
  initApp();
} else {
  showPair();
  setTimeout(() => digits[0].focus(), 300);
}

// ══════════════════════════════════════════════════════════
//  INIT — se llama cuando ya tenemos IP y puertos
// ══════════════════════════════════════════════════════════
function initApp() {

  const SERVER_IP   = window.SERVER_IP;
  const WS_PORT     = window.WS_PORT;
  const STREAM_PORT = window.STREAM_PORT;
  const SCREEN_W    = window.SCREEN_W;
  const SCREEN_H    = window.SCREEN_H;

  // ── WebSocket control ───────────────────────────────────
  let ws = null, wsReady = false, reconnTimer = null;

  const statusDot  = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  function setStatus(s, t) { statusDot.className = `dot ${s}`; statusText.textContent = t; }

  function connect() {
    setStatus("connecting", "Conectando…");
    ws = new WebSocket(`ws://${SERVER_IP}:${WS_PORT}`);
    ws.onopen  = () => { wsReady=true;  setStatus("connected",    `Conectado · ${SERVER_IP}`); clearTimeout(reconnTimer); };
    ws.onclose = () => { wsReady=false; setStatus("disconnected", "Sin conexión…"); reconnTimer=setTimeout(connect, 3000); };
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
      document.querySelectorAll(".tab-content").forEach(s => { s.classList.remove("active"); s.style.display="none"; });
      tab.classList.add("active");
      const sec = document.getElementById(`tab-${tab.dataset.tab}`);
      sec.classList.add("active"); sec.style.display = "flex";
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

  canvas.width  = SCREEN_W;
  canvas.height = SCREEN_H;

  let zoom = 1, panX = 0, panY = 0;
  const ZOOM_MIN = 1, ZOOM_MAX = 8;

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

  function resetZoom() { zoom=1; panX=0; panY=0; applyTransform(); }
  document.getElementById("btnResetZoom").addEventListener("click", resetZoom);

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

    streamWs.onmessage = async (e) => {
      try {
        const bmp = await createImageBitmap(new Blob([e.data], { type: "image/jpeg" }));
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        bmp.close(); frameN++;
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

  // Zoom/pan con 2 dedos
  let st = { dist: null, mid: null };
  function dist2(a,b){ return Math.hypot(b.clientX-a.clientX, b.clientY-a.clientY); }
  function mid2(a,b) { return { x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2 }; }

  screenWrap.addEventListener("touchstart", e => {
    e.preventDefault();
    if (e.touches.length===2){ st.dist=dist2(e.touches[0],e.touches[1]); st.mid=mid2(e.touches[0],e.touches[1]); }
  }, { passive:false });

  screenWrap.addEventListener("touchmove", e => {
    e.preventDefault();
    if (e.touches.length!==2) return;
    const [t0,t1]=[e.touches[0],e.touches[1]];
    const nd=dist2(t0,t1), nm=mid2(t0,t1), r=screenWrap.getBoundingClientRect();
    if (st.dist){ const f=nd/st.dist, ax=nm.x-r.left-r.width/2, ay=nm.y-r.top-r.height/2, pz=zoom;
      zoom=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,zoom*f)); panX=ax-(ax-panX)*(zoom/pz); panY=ay-(ay-panY)*(zoom/pz); }
    if (st.mid){ panX+=nm.x-st.mid.x; panY+=nm.y-st.mid.y; }
    st.dist=nd; st.mid=nm; applyTransform();
  }, { passive:false });

  screenWrap.addEventListener("touchend", e => {
    e.preventDefault();
    if (e.touches.length<2){ st.dist=null; st.mid=null; }
    if (e.touches.length===0) applyTransform();
  }, { passive:false });

  // ══════════════════════════════════════════════════════════
  //  JOYSTICK
  // ══════════════════════════════════════════════════════════
  const joyBase=document.getElementById("joystickBase"), joyKnob=document.getElementById("joystickKnob");
  const JOY_RADIUS=36, JOY_DEADZONE=4, JOY_SPEED=18, JOY_INTERVAL=16;
  let joyActive=false, joyVec={x:0,y:0}, joyTimer=null, joyTouchId=null;

  function joyCenter(){ const r=joyBase.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; }

  function setKnob(ox,oy){
    const d=Math.hypot(ox,oy), cl=d>JOY_RADIUS?JOY_RADIUS/d:1;
    joyKnob.style.transform=`translate(calc(-50% + ${ox*cl}px),calc(-50% + ${oy*cl}px))`;
    const n=Math.min(d,JOY_RADIUS)/JOY_RADIUS;
    joyVec=d<JOY_DEADZONE?{x:0,y:0}:{x:(ox/d)*n,y:(oy/d)*n};
  }

  function resetKnob(){ joyKnob.style.transform="translate(-50%,-50%)"; joyVec={x:0,y:0}; joyBase.classList.remove("active"); }

  function joyTick(){
    if (!joyActive||(joyVec.x===0&&joyVec.y===0)) return;
    const sp=JOY_SPEED*Math.pow(Math.hypot(joyVec.x,joyVec.y),1.5);
    const dx=Math.round(joyVec.x*sp), dy=Math.round(joyVec.y*sp);
    if (dx||dy) send({action:"move",dx,dy});
  }

  joyBase.addEventListener("touchstart", e=>{ e.preventDefault(); if(joyTouchId!==null)return;
    const t=e.changedTouches[0]; joyTouchId=t.identifier; joyActive=true; joyBase.classList.add("active");
    const c=joyCenter(); setKnob(t.clientX-c.x,t.clientY-c.y); joyTimer=setInterval(joyTick,JOY_INTERVAL); vibrate(15);
  },{passive:false});

  joyBase.addEventListener("touchmove", e=>{ e.preventDefault();
    const t=[...e.changedTouches].find(x=>x.identifier===joyTouchId); if(!t)return;
    const c=joyCenter(); setKnob(t.clientX-c.x,t.clientY-c.y);
  },{passive:false});

  function joyEnd(e){ e.preventDefault();
    const t=[...e.changedTouches].find(x=>x.identifier===joyTouchId); if(!t)return;
    joyActive=false; joyTouchId=null; clearInterval(joyTimer); resetKnob();
  }
  joyBase.addEventListener("touchend",    joyEnd, {passive:false});
  joyBase.addEventListener("touchcancel", joyEnd, {passive:false});

  // ── Botones de clic ──────────────────────────────────────
  document.getElementById("cbLeft").addEventListener("pointerdown",  e=>{ e.preventDefault(); send({action:"click",button:"left"});  vibrate(25); });
  document.getElementById("cbRight").addEventListener("pointerdown", e=>{ e.preventDefault(); send({action:"click",button:"right"}); vibrate(25); });

  let scIv=null;
  function startSc(dir){ const dy=dir==="up"?30:-30; send({action:"scroll",dy}); scIv=setInterval(()=>send({action:"scroll",dy}),120); }
  function stopSc(){ clearInterval(scIv); scIv=null; }
  const cbSU=document.getElementById("cbScrlUp"), cbSD=document.getElementById("cbScrlDn");
  cbSU.addEventListener("pointerdown",()=>startSc("up")); cbSU.addEventListener("pointerup",stopSc); cbSU.addEventListener("pointerleave",stopSc);
  cbSD.addEventListener("pointerdown",()=>startSc("down")); cbSD.addEventListener("pointerup",stopSc); cbSD.addEventListener("pointerleave",stopSc);

  // ── Teclado ──────────────────────────────────────────────
  const typeInput=document.getElementById("typeInput");
  function sendText(t){ if(!t)return; send({action:"type",text:t}); typeInput.value=""; vibrate(15); }
  document.getElementById("btnSend").addEventListener("click",()=>{ sendText(typeInput.value.trim()); send({action:"key",key:"enter"}); });
  document.getElementById("btnClear").addEventListener("click",()=>{ typeInput.value=""; typeInput.focus(); });
  typeInput.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); sendText(typeInput.value.trim()); send({action:"key",key:"enter"}); }});
  document.querySelectorAll(".kbtn:not(.hotkey)").forEach(b=>b.addEventListener("click",()=>{ send({action:"key",key:b.dataset.key}); vibrate(15); }));
  document.querySelectorAll(".kbtn.hotkey").forEach(b=>b.addEventListener("click",()=>{ send({action:"hotkey",keys:JSON.parse(b.dataset.keys)}); vibrate(20); }));

  // ── Media ────────────────────────────────────────────────
  document.querySelectorAll(".mbig").forEach(b=>b.addEventListener("click",()=>{
    if(b.dataset.key)    send({action:"key",   key:b.dataset.key});
    if(b.dataset.hotkey) send({action:"hotkey",keys:JSON.parse(b.dataset.hotkey)});
    vibrate(20);
  }));

} // fin initApp()
