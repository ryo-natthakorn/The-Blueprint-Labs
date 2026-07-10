/* ============================================================
   SOMNE — one window, six hundred kilometres
   The scrollbar is the timetable. World distance is a piecewise
   ease between station anchors, so the train genuinely brakes,
   pauses, and pulls away at each halt. Every layer of the view
   is procedurally infinite — ridge lines, farm lights, poles
   and sagging wire keyed to hashed world indices — under a sky
   that runs 22:04 to dawn.
   ============================================================ */

const canvas = document.getElementById('window-view');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 760px)').matches;

let W = 0, H = 0, DPR = 1, HOR = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  HOR = H * 0.62;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
window.addEventListener('resize', resize);

/* ---------- timetable ----------
   anchors: [scrollP, worldX, clockHour]; between anchors the
   world position eases, which brakes the train into stations. */

const KM = 900;                      // px per "worldX unit" scale factor below
const ANCHORS = [
  [0.0, 0, 22.07],
  [0.18, 6, 23.62],                  // Larkspur approach
  [0.26, 6.6, 23.7],                 // stopped at Larkspur (worldX nearly flat)
  [0.5, 16, 27.2],                   // the long dark (03:12 = 27.2 on a 24h+ clock)
  [0.62, 21, 27.4],                  // Mirensee stop
  [0.9, 30, 30.35],
  [1.0, 31, 30.52],                  // Iskar Coast, 06:31
];
const STATIONS = [
  { x: 6.6, name: 'LARKSPUR HALT' },
  { x: 21, name: 'MIRENSEE' },
  { x: 31, name: 'ISKAR COAST' },
];

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function timetable(P) {
  let i = 0;
  while (i < ANCHORS.length - 2 && ANCHORS[i + 1][0] < P) i++;
  const [p0, x0, h0] = ANCHORS[i], [p1, x1, h1] = ANCHORS[i + 1];
  const u = smoothstep(p0, p1, P);
  return [x0 + (x1 - x0) * u, h0 + (h1 - h0) * u];
}

/* ---------- scroll ---------- */

let scrollP = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollP = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) e.target.classList.add('aboard');
}, { threshold: 0.3 });
document.querySelectorAll('.berth').forEach(s => io.observe(s));

/* ---------- procedural helpers ---------- */

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ---------- sky ---------- */

function skyColors(hour) {
  // 22:00 deep night -> 04:30 blackest -> 06:31 dawn
  const dawn = smoothstep(28.6, 30.6, hour);          // 04:36 → 06:36
  const dusk = 1 - smoothstep(22.0, 23.2, hour);      // fading departure glow
  const top = [
    8 + dawn * 32 + dusk * 6,
    10 + dawn * 42 + dusk * 8,
    22 + dawn * 74 + dusk * 22,
  ];
  const low = [
    14 + dawn * 210 + dusk * 40,
    17 + dawn * 120 + dusk * 26,
    32 + dawn * 96 + dusk * 44,
  ];
  return [top, low, dawn];
}

/* ---------- layers ---------- */

function ridge(worldX, factor, base, amp, color, seedOff) {
  const off = worldX * KM * factor;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  const STEP = 26;
  for (let sx = -STEP; sx <= W + STEP; sx += STEP) {
    const k = (sx + off) / 190;
    const y = base
      + Math.sin(k * 1.7 + seedOff) * amp * 0.5
      + Math.sin(k * 0.6 + seedOff * 2.7) * amp
      + (hash(Math.floor(k * 2) + seedOff) - 0.5) * amp * 0.35;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(W + STEP, H);
  ctx.closePath();
  ctx.fill();
}

function farmLights(worldX, factor, y0, spacing, seedOff, dawn) {
  const off = worldX * KM * factor;
  const first = Math.floor(off / spacing);
  const visible = Math.ceil(W / spacing) + 2;
  for (let i = 0; i <= visible; i++) {
    const k = first + i;
    const h1 = hash(k + seedOff);
    if (h1 < 0.62) continue;                 // most of the night is empty
    const x = k * spacing - off + (h1 - 0.5) * spacing * 0.6;
    const y = y0 + hash(k * 3 + seedOff) * 30;
    const warm = 0.55 + hash(k * 7) * 0.45;
    // house silhouette
    ctx.fillStyle = 'rgba(4, 5, 10, 0.9)';
    ctx.fillRect(x - 10, y - 9, 20, 9);
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 9); ctx.lineTo(x, y - 16); ctx.lineTo(x + 12, y - 9);
    ctx.fill();
    // one lit window
    ctx.fillStyle = `rgba(232, 180, 90, ${warm * (1 - dawn * 0.8)})`;
    ctx.fillRect(x - 3, y - 7, 4, 4);
  }
}

function poles(worldX, factor, dawn) {
  const off = worldX * KM * factor;
  const spacing = 420;
  const first = Math.floor(off / spacing);
  const visible = Math.ceil(W / spacing) + 2;
  const topY = HOR - H * 0.34;
  ctx.strokeStyle = 'rgba(3, 4, 8, 0.96)';
  for (let i = -1; i <= visible; i++) {
    const k = first + i;
    const x = k * spacing - off;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, HOR + 30);
    ctx.lineTo(x, topY);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 26, topY + 6); ctx.lineTo(x + 26, topY + 6);
    ctx.moveTo(x - 18, topY + 18); ctx.lineTo(x + 18, topY + 18);
    ctx.stroke();
    // sagging wire to the next pole
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, topY + 6);
    ctx.quadraticCurveTo(x + spacing / 2, topY + 6 + 34, x + spacing, topY + 6);
    ctx.moveTo(x, topY + 18);
    ctx.quadraticCurveTo(x + spacing / 2, topY + 18 + 30, x + spacing, topY + 18);
    ctx.stroke();
  }
}

function stations(worldX, factor, dawn) {
  const off = worldX * KM * factor;
  for (const st of STATIONS) {
    const x = st.x * KM * factor - off + W * 0.5;
    if (x < -700 || x > W + 700) continue;
    const py = HOR + 26;
    // platform
    ctx.fillStyle = '#05070d';
    ctx.fillRect(x - 320, py, 640, 14);
    // canopy + legs
    ctx.fillRect(x - 220, py - 104, 440, 10);
    ctx.fillRect(x - 200, py - 96, 8, 96);
    ctx.fillRect(x + 192, py - 96, 8, 96);
    // lamps along the platform
    for (let i = -2; i <= 2; i++) {
      const lx = x + i * 128;
      ctx.fillStyle = '#05070d';
      ctx.fillRect(lx - 2, py - 66, 4, 66);
      const g = ctx.createRadialGradient(lx, py - 70, 0, lx, py - 70, 42);
      g.addColorStop(0, `rgba(232, 180, 90, ${0.5 - dawn * 0.3})`);
      g.addColorStop(1, 'rgba(232, 180, 90, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lx, py - 70, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5d9a8';
      ctx.beginPath();
      ctx.arc(lx, py - 70, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // sign
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(x - 95, py - 58, 190, 26);
    ctx.strokeStyle = 'rgba(236, 229, 216, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 95, py - 58, 190, 26);
    ctx.fillStyle = '#ece5d8';
    ctx.font = '600 13px "Karla", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(st.name, x, py - 40);
  }
}

/* Mirensee: the lake with the riding moon */
function lake(worldX, factor, moonX, moonY, dawn) {
  const off = worldX * KM * factor;
  const lakeStart = 18.4 * KM * factor - off + W * 0.5;
  const lakeEnd = 20.4 * KM * factor - off + W * 0.5;
  if (lakeEnd < 0 || lakeStart > W) return;
  const y = HOR + 8;
  ctx.fillStyle = 'rgba(16, 24, 44, 0.9)';
  ctx.fillRect(Math.max(0, lakeStart), y, Math.min(W, lakeEnd) - Math.max(0, lakeStart), H - y);
  // moon path on the water
  if (moonX > Math.max(0, lakeStart) && moonX < Math.min(W, lakeEnd)) {
    const g = ctx.createLinearGradient(0, y, 0, H);
    g.addColorStop(0, `rgba(220, 228, 245, ${0.4 - dawn * 0.3})`);
    g.addColorStop(1, 'rgba(220, 228, 245, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(moonX - 7, y);
    ctx.lineTo(moonX + 7, y);
    ctx.lineTo(moonX + 30, H);
    ctx.lineTo(moonX - 30, H);
    ctx.closePath();
    ctx.fill();
  }
}

/* ---------- HUD ---------- */

const mfTime = document.getElementById('mf-time');
const mfSpeed = document.getElementById('mf-speed');
const mfNext = document.getElementById('mf-next');

function fmtClock(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/* ---------- loop ---------- */

let worldX = 0, hour = 22.07;
let lastWX = 0;
let last = performance.now();
let t = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!reduceMotion) t += dt;

  const [wxGoal, hGoal] = timetable(scrollP);
  const ease = reduceMotion ? 1 : 1 - Math.pow(0.004, dt);
  worldX += (wxGoal - worldX) * ease;
  hour += (hGoal - hour) * ease;
  const speed = Math.abs(worldX - lastWX) / Math.max(dt, 0.001);
  lastWX = worldX;

  /* sky */
  const [top, low, dawn] = skyColors(hour);
  const sky = ctx.createLinearGradient(0, 0, 0, HOR);
  sky.addColorStop(0, `rgb(${top[0] | 0},${top[1] | 0},${top[2] | 0})`);
  sky.addColorStop(1, `rgb(${low[0] | 0},${low[1] | 0},${low[2] | 0})`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HOR + 10);

  /* stars fade with dawn; they drift slower than everything */
  const starAlpha = (1 - dawn) * 0.9;
  if (starAlpha > 0.02) {
    const soff = worldX * KM * 0.015;
    for (let i = 0; i < (isMobile ? 60 : 130); i++) {
      const sx = ((hash(i) * 1.4 * W - soff) % (W + 40) + W + 40) % (W + 40) - 20;
      const sy = hash(i + 100) * HOR * 0.85;
      const tw = reduceMotion ? 0.7 : 0.5 + Math.sin(t * 1.6 + i * 2.3) * 0.4;
      ctx.fillStyle = `rgba(225, 232, 248, ${starAlpha * tw * hash(i + 50)})`;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
  }

  /* the moon rides with you, slowly overtaken */
  const moonX = W * 0.72 - worldX * KM * 0.01;
  const moonY = H * 0.18 + Math.sin(worldX * 0.2) * 8;
  ctx.fillStyle = `rgba(228, 234, 246, ${0.95 - dawn * 0.6})`;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = sky;
  ctx.beginPath();
  ctx.arc(moonX - 8, moonY - 5, 17, 0, Math.PI * 2);
  ctx.fill();

  /* landscape, back to front */
  ridge(worldX, 0.06, HOR - H * 0.15, H * 0.05, `rgba(${10 + dawn * 40 | 0}, ${13 + dawn * 26 | 0}, ${26 + dawn * 30 | 0}, 1)`, 3);
  ridge(worldX, 0.14, HOR - H * 0.06, H * 0.04, `rgba(${7 + dawn * 26 | 0}, ${9 + dawn * 17 | 0}, ${18 + dawn * 20 | 0}, 1)`, 11);
  ridge(worldX, 0.32, HOR + 2, H * 0.025, 'rgba(5, 6, 12, 1)', 29);
  /* ground */
  ctx.fillStyle = '#04050a';
  ctx.fillRect(0, HOR + 18, W, H - HOR);
  lake(worldX, 0.32, moonX, moonY, dawn);
  farmLights(worldX, 0.32, HOR - 6, 300, 17, dawn);
  stations(worldX, 1, dawn);
  poles(worldX, 1, dawn);

  /* motion blur streaks when at speed */
  if (speed > 3 && !reduceMotion) {
    ctx.strokeStyle = `rgba(236, 229, 216, ${Math.min(0.16, speed * 0.01)})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = HOR + 24 + i * ((H - HOR) / 9);
      const seg = 60 + i * 40;
      const off = (worldX * KM * (1.1 + i * 0.16)) % (seg * 2);
      for (let x = -off; x < W; x += seg * 2) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + seg, y);
        ctx.stroke();
      }
    }
  }

  /* cabin sway */
  if (!reduceMotion && speed > 0.5) {
    const sway = Math.sin(t * 6.3) * Math.min(2.2, speed * 0.12);
    canvas.style.transform = `translateY(${sway.toFixed(2)}px)`;
  } else {
    canvas.style.transform = '';
  }

  /* HUD */
  mfTime.textContent = fmtClock(hour);
  mfSpeed.textContent = `${Math.round(speed * 38)} km/h`;
  const next = STATIONS.find(s => s.x > worldX + 0.3);
  mfNext.textContent = next ? next.name : 'TERMINUS';

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
