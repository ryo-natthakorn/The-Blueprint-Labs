/* ============================================================
   SUMINAGA — mathematical marbling
   Faithful digital suminagashi. Every ink drop is a polygon of
   points on still water; each new drop pushes every older point
   outward along the exact conformal-map formula the medium
   obeys, and a dragged stylus combs the whole basin. Nothing is
   simulated per-pixel — the ink is pure geometry, so it stays
   razor sharp at any size.
   ============================================================ */

const canvas = document.getElementById('water');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 760px)').matches;

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
window.addEventListener('resize', resize);

/* ---------- the drops ---------- */

const POINTS = isMobile ? 110 : 170;    // vertices per drop
const MAX_DROPS = isMobile ? 42 : 64;
const drops = [];                        // oldest first; painted in order

let inkColor = '#26262b';
let paleColor = '#8e8e96';
let alternate = 0;                       // ink ring / pale ring / paper ring

function addDrop(cx, cy, r, color) {
  // push every existing point away: P' = C + (P-C) * sqrt(1 + r^2/|P-C|^2)
  const r2 = r * r;
  for (const d of drops) {
    const pts = d.pts;
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pts[i] - cx, dy = pts[i + 1] - cy;
      const dist2 = dx * dx + dy * dy || 0.0001;
      const scale = Math.sqrt(1 + r2 / dist2);
      pts[i] = cx + dx * scale;
      pts[i + 1] = cy + dy * scale;
    }
  }
  const pts = new Float32Array(POINTS * 2);
  for (let i = 0; i < POINTS; i++) {
    const a = (i / POINTS) * Math.PI * 2;
    pts[i * 2] = cx + Math.cos(a) * r;
    pts[i * 2 + 1] = cy + Math.sin(a) * r;
  }
  drops.push({ pts, color });
  if (drops.length > MAX_DROPS) drops.shift();
}

/* stylus comb: points shift parallel to the stroke, falling off with
   distance from the stylus path — the "tine" deformation */
function tine(x, y, dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const ux = dx / len, uy = dy / len;
  const Z = Math.min(len, 40) * 0.9;      // stroke strength
  const FALLOFF = 22;                      // sharpness of the comb
  for (const d of drops) {
    const pts = d.pts;
    for (let i = 0; i < pts.length; i += 2) {
      // perpendicular distance to the stylus point (local approximation)
      const px = pts[i] - x, py = pts[i + 1] - y;
      const dist = Math.hypot(px, py);
      const m = Z * FALLOFF / (dist + FALLOFF);
      pts[i] += ux * m;
      pts[i + 1] += uy * m;
    }
  }
}

/* ---------- interaction ---------- */

const whisper = document.getElementById('whisper');
let whisperFaded = false;
let lastAction = performance.now();
let dragging = false;
let dragMoved = 0;
let lx = 0, ly = 0;
let needsPaint = true;

function fadeWhisper() {
  if (!whisperFaded) { whisper.style.opacity = '0'; whisperFaded = true; }
}

function dropAt(x, y, big = false) {
  const base = big ? 60 : 34;
  const colors = [inkColor, paleColor, '#f2ecdf'];
  addDrop(x, y, base * (0.75 + Math.random() * 0.5), colors[alternate % 3]);
  alternate++;
  lastAction = performance.now();
  needsPaint = true;
}

canvas.addEventListener('pointerdown', (e) => {
  dragging = true; dragMoved = 0;
  lx = e.clientX; ly = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  fadeWhisper();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lx, dy = e.clientY - ly;
  dragMoved += Math.hypot(dx, dy);
  if (dragMoved > 6) {
    tine(e.clientX, e.clientY, dx, dy);
    lastAction = performance.now();
    needsPaint = true;
  }
  lx = e.clientX; ly = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  if (dragMoved <= 6) dropAt(e.clientX, e.clientY);   // a tap is a drop
});
canvas.addEventListener('pointercancel', () => { dragging = false; });

/* tea selection re-inks the stylus */
const teaButtons = [...document.querySelectorAll('.tea')];
teaButtons.forEach((b) => {
  b.addEventListener('click', () => {
    teaButtons.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    inkColor = b.dataset.color;
    paleColor = b.dataset.pale;
    b.style.setProperty('--c-active', inkColor);
    alternate = 0;
  });
});

document.getElementById('clear').addEventListener('click', () => {
  drops.length = 0;
  alternate = 0;
  needsPaint = true;
});

/* ---------- ambient life ---------- */

function ambientDrop() {
  const m = Math.min(W, H);
  dropAt(
    W * 0.5 + (Math.random() - 0.5) * m * 0.55,
    H * 0.5 + (Math.random() - 0.5) * m * 0.45,
    Math.random() < 0.25,
  );
}

/* opening composition — the basin is never empty when you arrive */
function overture() {
  const cx = W * 0.46, cy = H * 0.52;
  for (let i = 0; i < 7; i++) {
    const colors = ['#26262b', '#8e8e96', '#f2ecdf'];
    addDrop(cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 40,
      42 + i * 14, colors[i % 3]);
  }
  addDrop(W * 0.68, H * 0.34, 46, '#4a6b52');
  addDrop(W * 0.68, H * 0.34, 30, '#f2ecdf');
  addDrop(W * 0.3, H * 0.68, 40, '#8a4a3b');
  addDrop(W * 0.3, H * 0.68, 26, '#f2ecdf');
  // one long comb stroke through everything
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    tine(W * (0.2 + t * 0.6), H * (0.3 + Math.sin(t * 3.1) * 0.2 + t * 0.3), 14, 6);
  }
  needsPaint = true;
}

/* ---------- painting ---------- */

function paint(swirlT) {
  ctx.fillStyle = '#f2ecdf';
  ctx.fillRect(0, 0, W, H);

  // paper grain vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(60, 50, 30, 0.12)');

  for (const d of drops) {
    const pts = d.pts;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
  }

  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/* the water itself turns, imperceptibly — a living basin */
function swirl(dt) {
  const cx = W / 2, cy = H / 2;
  const rate = 0.012 * dt;
  for (const d of drops) {
    const pts = d.pts;
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pts[i] - cx, dy = pts[i + 1] - cy;
      const r = Math.hypot(dx, dy);
      const a = rate * Math.exp(-r / (Math.min(W, H) * 0.55));
      const cos = Math.cos(a), sin = Math.sin(a);
      pts[i] = cx + dx * cos - dy * sin;
      pts[i + 1] = cy + dx * sin + dy * cos;
    }
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (!reduceMotion) {
    swirl(dt);
    needsPaint = true;
    // if the guest just watches, the house pours for them
    if (now - lastAction > 5200 && drops.length < MAX_DROPS - 4) {
      ambientDrop();
      lastAction = now - 2800;   // next ambient drop sooner, but not instant
    }
  }

  if (needsPaint) {
    paint(now / 1000);
    needsPaint = false;
  }
  requestAnimationFrame(frame);
}

overture();
paint(0);
requestAnimationFrame(frame);
