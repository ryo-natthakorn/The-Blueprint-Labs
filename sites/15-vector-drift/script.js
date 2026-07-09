/* ============================================================
   VECTOR DRIFT — the studio site IS the demo
   A complete pseudo-3D lane runner in one canvas: banded sun,
   parallax ridge line, scrolling perspective grid, pylons and
   shards projected from a virtual roadway, chiptune bleeps from
   a two-oscillator WebAudio synth. Attract mode plays itself.
   ============================================================ */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let W = 0, H = 0, DPR = 1, HORIZON = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  HORIZON = H * 0.42;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
window.addEventListener('resize', resize);

/* ---------- tiny synth ---------- */

let audioCtx = null;
let sndOn = false;
const muteBtn = document.getElementById('mute');
muteBtn.addEventListener('click', () => {
  sndOn = !sndOn;
  if (sndOn && !audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  muteBtn.setAttribute('aria-pressed', String(sndOn));
  muteBtn.textContent = sndOn ? 'SND ON' : 'SND OFF';
});
function bleep(freq, dur = 0.09, type = 'square', vol = 0.05, slide = 0) {
  if (!sndOn || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* ---------- game state ---------- */

const LANES = 5;
const state = {
  mode: 'title',          // title | play | crash
  laneX: 0,               // player x in road units, -1 .. 1
  laneGoal: 0,
  speed: 26,              // road units / s
  dist: 0,
  score: 0,
  best: +(localStorage.getItem('vd-best') || 0),
  shake: 0,
  flash: 0,
  attractT: 0,
  entities: [],           // { z, lane, kind } kind: pylon | gate | shard
  nextSpawn: 10,
  stars: Array.from({ length: 90 }, () => ({
    x: Math.random(), y: Math.random() * 0.38, r: Math.random() * 1.3 + 0.3,
    tw: Math.random() * Math.PI * 2,
  })),
};

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const speedEl = document.getElementById('speed');
const overlay = document.getElementById('overlay');
const ovKicker = document.getElementById('ov-kicker');
const ovLine = document.getElementById('ov-line');
const startBtn = document.getElementById('start');
bestEl.textContent = state.best;

function startGame() {
  state.mode = 'play';
  state.laneX = 0; state.laneGoal = 0;
  state.speed = 26;
  state.dist = 0; state.score = 0;
  state.entities = [];
  state.nextSpawn = 16;
  overlay.classList.add('hidden');
  bleep(220, 0.16, 'square', 0.06, 660);
}
startBtn.addEventListener('click', startGame);

function crash() {
  state.mode = 'crash';
  state.shake = 1;
  state.flash = 1;
  bleep(160, 0.4, 'sawtooth', 0.08, -140);
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('vd-best', String(state.best));
    bestEl.textContent = state.best;
  }
  setTimeout(() => {
    ovKicker.textContent = 'SIGNAL LOST';
    ovLine.textContent = `run: ${state.score.toLocaleString('en-US')} · best: ${state.best.toLocaleString('en-US')} — the grid is patient`;
    startBtn.textContent = 'RE-SYNC';
    overlay.classList.remove('hidden');
    state.mode = 'title';
  }, 900);
}

/* ---------- input ---------- */

const keys = {};
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && state.mode === 'title') { startGame(); return; }
  keys[e.key] = true;
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

let touchX = null;
canvas.addEventListener('pointerdown', (e) => { touchX = e.clientX; });
canvas.addEventListener('pointermove', (e) => {
  if (touchX === null || state.mode !== 'play') return;
  state.laneGoal += ((e.clientX - touchX) / W) * 3.4;
  state.laneGoal = Math.max(-1, Math.min(1, state.laneGoal));
  touchX = e.clientX;
});
canvas.addEventListener('pointerup', () => { touchX = null; });

/* ---------- projection ----------
   road x: -1..1 across, z: 0 at player, 100 at horizon */
function project(x, z) {
  const p = 1 / (1 + z * 0.09);                 // perspective factor
  const sx = W / 2 + x * (W * 0.75) * p;
  const sy = HORIZON + (H - HORIZON) * p * 1.02 - (H - HORIZON) * 0.02;
  return [sx, sy, p];
}

/* ---------- spawning ---------- */

function spawn() {
  const roll = Math.random();
  const lane = Math.floor(Math.random() * LANES);
  const laneToX = l => (l / (LANES - 1)) * 2 - 1;
  if (roll < 0.52) {
    state.entities.push({ z: 100, x: laneToX(lane), kind: 'pylon' });
  } else if (roll < 0.72) {
    // a gate: pylons on every lane but one
    const open = Math.floor(Math.random() * LANES);
    for (let l = 0; l < LANES; l++) {
      if (l !== open && l !== (open + 1) % LANES) {
        state.entities.push({ z: 100, x: laneToX(l), kind: 'pylon' });
      }
    }
  } else {
    state.entities.push({ z: 100, x: laneToX(lane), kind: 'shard', spin: Math.random() * 7 });
  }
}

/* ---------- drawing ---------- */

function drawSky(t) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON * 1.25);
  g.addColorStop(0, '#0d0116');
  g.addColorStop(0.62, '#26043a');
  g.addColorStop(1, '#57104f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HORIZON * 1.25);

  // stars
  for (const s of state.stars) {
    const a = 0.35 + Math.sin(t * 1.8 + s.tw) * 0.3;
    ctx.fillStyle = `rgba(232, 228, 244, ${a})`;
    ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
  }

  // banded sun
  const sunR = Math.min(W, H) * 0.19;
  const sx = W / 2, sy = HORIZON - sunR * 0.18;
  const sg = ctx.createLinearGradient(0, sy - sunR, 0, sy + sunR);
  sg.addColorStop(0, '#ffd23d');
  sg.addColorStop(0.55, '#ff3d9a');
  sg.addColorStop(1, '#b3186e');
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sg;
  ctx.fillRect(sx - sunR, sy - sunR, sunR * 2, sunR * 2);
  // sliding gaps
  ctx.fillStyle = '#1c0330';
  for (let i = 0; i < 6; i++) {
    const gy = sy - sunR * 0.05 + i * sunR * 0.18 + ((t * 12) % (sunR * 0.18));
    ctx.fillRect(sx - sunR, gy, sunR * 2, 2 + i * 1.4);
  }
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(sx, sy, sunR * 0.4, sx, sy, sunR * 2.4);
  halo.addColorStop(0, 'rgba(255, 61, 154, 0.35)');
  halo.addColorStop(1, 'rgba(255, 61, 154, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, HORIZON * 1.3);
  ctx.restore();

  // ridge line
  ctx.fillStyle = '#12021f';
  ctx.beginPath();
  ctx.moveTo(0, HORIZON);
  for (let i = 0; i <= 30; i++) {
    const x = (i / 30) * W;
    const y = HORIZON - Math.abs(Math.sin(i * 1.7) * 26 + Math.sin(i * 0.6) * 34) * (i % 2 ? 0.7 : 1);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, HORIZON);
  ctx.closePath();
  ctx.fill();
}

function drawGrid(t) {
  const g = ctx.createLinearGradient(0, HORIZON, 0, H);
  g.addColorStop(0, '#12021f');
  g.addColorStop(1, '#1e0333');
  ctx.fillStyle = g;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  ctx.lineWidth = 1.5;
  // longitudinal lines
  for (let i = -8; i <= 8; i++) {
    const x = i / 5;
    const [x0] = project(x, 0);
    const [x1] = project(x, 100);
    const grad = ctx.createLinearGradient(0, H, 0, HORIZON);
    grad.addColorStop(0, 'rgba(255, 61, 154, 0.8)');
    grad.addColorStop(1, 'rgba(255, 61, 154, 0.06)');
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0, H);
    ctx.lineTo(x1, HORIZON);
    ctx.stroke();
  }
  // transverse lines rushing at you
  const SPACING = 7;
  const offset = (state.dist % SPACING);
  for (let z = -offset; z < 100; z += SPACING) {
    if (z < 0) continue;
    const [, y, p] = project(0, z);
    ctx.strokeStyle = `rgba(41, 230, 255, ${0.05 + p * 0.55})`;
    ctx.lineWidth = 0.6 + p * 1.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawShip(t) {
  const [sx, sy, p] = project(state.laneX, 2.4);
  const s = Math.min(W, H) * 0.05;
  const tilt = (state.laneGoal - state.laneX) * 2.2;
  ctx.save();
  ctx.translate(sx, sy - s * 0.5);
  ctx.rotate(tilt * 0.35);
  // engine glow
  const eg = ctx.createRadialGradient(0, s * 0.55, 0, 0, s * 0.55, s * 1.3);
  eg.addColorStop(0, 'rgba(41, 230, 255, 0.9)');
  eg.addColorStop(1, 'rgba(41, 230, 255, 0)');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(0, s * 0.55, s * (1.1 + Math.sin(t * 30) * 0.12), 0, Math.PI * 2);
  ctx.fill();
  // hull — a clean vector wedge
  ctx.strokeStyle = '#29e6ff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#29e6ff';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.85, s * 0.5);
  ctx.lineTo(s * 0.3, s * 0.24);
  ctx.lineTo(0, s * 0.5);
  ctx.lineTo(-s * 0.3, s * 0.24);
  ctx.lineTo(-s * 0.85, s * 0.5);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(13, 1, 22, 0.85)';
  ctx.fill();
  ctx.restore();
}

function drawEntities(t) {
  // painter's order: far first
  const sorted = [...state.entities].sort((a, b) => b.z - a.z);
  for (const e of sorted) {
    const [x, y, p] = project(e.x, e.z);
    if (e.kind === 'pylon') {
      const h = (H - HORIZON) * 0.34 * p;
      const w = h * 0.22;
      ctx.strokeStyle = `rgba(255, 61, 154, ${0.35 + p * 0.65})`;
      ctx.lineWidth = 1 + p * 2;
      ctx.shadowColor = '#ff3d9a';
      ctx.shadowBlur = 10 * p;
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.lineTo(x, y - h);
      ctx.lineTo(x + w, y);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = `rgba(87, 6, 51, ${0.5 + p * 0.4})`;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      const s = (H - HORIZON) * 0.09 * p;
      const spin = t * 3 + (e.spin || 0);
      ctx.save();
      ctx.translate(x, y - s * 1.4);
      ctx.rotate(spin);
      ctx.strokeStyle = `rgba(255, 210, 61, ${0.5 + p * 0.5})`;
      ctx.lineWidth = 1 + p * 1.6;
      ctx.shadowColor = '#ffd23d';
      ctx.shadowBlur = 12 * p;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  }
}

/* ---------- update ---------- */

function update(dt, t) {
  const playing = state.mode === 'play';
  const attract = state.mode === 'title' && !reduceMotion;

  if (playing) {
    if (keys.ArrowLeft || keys.a || keys.A) state.laneGoal -= dt * 2.6;
    if (keys.ArrowRight || keys.d || keys.D) state.laneGoal += dt * 2.6;
    state.laneGoal = Math.max(-1, Math.min(1, state.laneGoal));
    state.speed = Math.min(26 + state.dist * 0.012, 68);
  } else if (attract) {
    // the cabinet plays itself, badly and beautifully
    state.attractT += dt;
    state.laneGoal = Math.sin(state.attractT * 0.7) * 0.8;
    state.speed = 20;
  } else {
    state.speed = 0;
  }

  state.laneX += (state.laneGoal - state.laneX) * Math.min(1, dt * 9);

  if (playing || attract) {
    state.dist += state.speed * dt;
    if (playing) state.score += Math.round(state.speed * dt * 2);

    state.nextSpawn -= state.speed * dt;
    if (state.nextSpawn <= 0) {
      spawn();
      state.nextSpawn = 12 + Math.random() * 14 - Math.min(8, state.dist * 0.002);
    }

    for (let i = state.entities.length - 1; i >= 0; i--) {
      const e = state.entities[i];
      e.z -= state.speed * dt;
      if (e.z < 1.2 && e.z > -1 && Math.abs(e.x - state.laneX) < 0.16) {
        if (e.kind === 'shard') {
          state.entities.splice(i, 1);
          if (playing) {
            state.score += 250;
            state.flash = 0.25;
            bleep(880, 0.1, 'square', 0.05, 440);
          }
          continue;
        }
        if (playing) { crash(); return; }
      }
      if (e.z < -3) state.entities.splice(i, 1);
    }
  }

  state.shake = Math.max(0, state.shake - dt * 2.4);
  state.flash = Math.max(0, state.flash - dt * 2);

  scoreEl.textContent = state.score.toLocaleString('en-US');
  speedEl.textContent = playing ? `${Math.round(state.speed * 8)} km/h` : '—';
}

/* ---------- loop ---------- */

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;

  update(dt, t);

  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake * 22, (Math.random() - 0.5) * state.shake * 22);
  }
  drawSky(reduceMotion && state.mode === 'title' ? 0 : t);
  drawGrid(t);
  drawEntities(t);
  if (state.mode !== 'crash' || state.shake > 0.4) drawShip(t);
  ctx.restore();

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
