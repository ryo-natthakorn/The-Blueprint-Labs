/* ============================================================
   BATHYAL — one continuous dive
   The scrollbar is a winch. Depth drives everything: the water
   column's color, the death of sunlight, marine snow, and a
   cast of procedurally drawn animals keyed to real depth zones.
   Below the twilight line your pointer becomes bioluminescent.
   ============================================================ */

const canvas = document.getElementById('ocean');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 720px)').matches;

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
window.addEventListener('resize', resize);

const MAX_DEPTH = 6000;
let depth = 0;        // eased
let depthGoal = 0;
let lastDepth = 0;

function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  depthGoal = (max > 0 ? window.scrollY / max : 0) * MAX_DEPTH;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

/* ---------- water column color ---------- */

const RAMP = [
  [0, [42, 157, 196]],
  [180, [16, 94, 133]],
  [450, [8, 58, 92]],
  [900, [4, 30, 54]],
  [1600, [2, 14, 30]],
  [3000, [1, 6, 14]],
  [6000, [1, 3, 8]],
];
function waterColor(d, lighten = 0) {
  let i = 0;
  while (i < RAMP.length - 2 && RAMP[i + 1][0] < d) i++;
  const [d0, c0] = RAMP[i], [d1, c1] = RAMP[i + 1];
  const t = Math.min(1, Math.max(0, (d - d0) / (d1 - d0)));
  const r = c0[0] + (c1[0] - c0[0]) * t + lighten;
  const g = c0[1] + (c1[1] - c0[1]) * t + lighten;
  const b = c0[2] + (c1[2] - c0[2]) * t + lighten;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
const sunlight = d => Math.exp(-d / 210);

/* ---------- marine snow ---------- */

const SNOW_N = isMobile ? 90 : 200;
const snow = Array.from({ length: SNOW_N }, () => ({
  x: Math.random(), y: Math.random(),
  z: 0.3 + Math.random() * 0.7,          // parallax layer
  r: 0.5 + Math.random() * 1.4,
  drift: Math.random() * Math.PI * 2,
}));

/* ---------- bioluminescent pointer trail ---------- */

const trail = [];
let pointerX = -1, pointerY = -1;
window.addEventListener('pointermove', (e) => {
  pointerX = e.clientX; pointerY = e.clientY;
  if (depth > 700 && !reduceMotion) {
    trail.push({ x: e.clientX, y: e.clientY, life: 1, r: 1 + Math.random() * 2.5,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4 });
    if (trail.length > 140) trail.shift();
  }
});

/* ---------- creatures ----------
   Each has a home depth; screen Y = how far its depth is from ours. */

const M2PX = () => H / 640;    // metres → pixels for relative placement
const rand = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(424242);

const fishSchool = Array.from({ length: isMobile ? 22 : 44 }, () => ({
  ox: rand(), oy: (rand() - 0.5) * 300, ph: rand() * Math.PI * 2,
  sp: 0.5 + rand() * 0.8, size: 5 + rand() * 7,
}));
const jellies = Array.from({ length: 5 }, (_, i) => ({
  x: 0.14 + i * 0.18 + (rand() - 0.5) * 0.06,
  oy: (rand() - 0.5) * 420, ph: rand() * Math.PI * 2, size: 26 + rand() * 30,
}));
const siphoSegs = 34;
const anglers = [{ x: 0.62, oy: 0, size: 1 }];

function drawFish(x, y, size, dir, alpha, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.quadraticCurveTo(0, -size * 0.42, -size * 0.8, 0);
  ctx.quadraticCurveTo(0, size * 0.42, size, 0);
  // tail
  ctx.moveTo(-size * 0.7, 0);
  ctx.lineTo(-size * 1.25, -size * 0.4);
  ctx.lineTo(-size * 1.25, size * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawJelly(x, y, s, t, alpha) {
  const pulse = 1 + Math.sin(t * 1.6) * 0.12;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.8) * 14);
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
  g.addColorStop(0, 'rgba(140, 240, 255, 0.85)');
  g.addColorStop(0.5, 'rgba(90, 160, 255, 0.25)');
  g.addColorStop(1, 'rgba(90, 160, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2);
  ctx.fill();
  // bell
  ctx.beginPath();
  ctx.fillStyle = 'rgba(190, 245, 255, 0.75)';
  ctx.ellipse(0, 0, s * pulse, s * 0.72 * (2 - pulse), 0, Math.PI, 0);
  ctx.fill();
  // tentacles
  ctx.strokeStyle = 'rgba(160, 220, 255, 0.5)';
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s * 0.3, s * 0.1);
    ctx.quadraticCurveTo(
      i * s * 0.3 + Math.sin(t * 2 + i) * 8, s * 1.2,
      i * s * 0.34 + Math.sin(t * 1.3 + i * 2) * 14, s * 2.1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSiphonophore(t, baseY, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < siphoSegs; i++) {
    const p = i / siphoSegs;
    const x = W * (0.1 + p * 0.8);
    const y = baseY + Math.sin(p * 9 + t * 0.7) * 46 + Math.sin(p * 3 - t * 0.3) * 20;
    const r = 3 + Math.sin(p * 20 + t * 2) * 1.4;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
    g.addColorStop(0, 'rgba(120, 255, 220, 0.95)');
    g.addColorStop(1, 'rgba(120, 255, 220, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAngler(x, y, t, alpha) {
  const s = Math.min(W, H) * 0.11;
  ctx.save();
  ctx.translate(x + Math.sin(t * 0.4) * 20, y + Math.cos(t * 0.55) * 12);
  ctx.globalAlpha = alpha;
  // lure glow first — it's the only thing you truly see
  const lx = -s * 1.15, ly = -s * 0.52 + Math.sin(t * 2.2) * 5;
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * 0.85);
  g.addColorStop(0, 'rgba(220, 255, 240, 1)');
  g.addColorStop(0.12, 'rgba(140, 255, 215, 0.65)');
  g.addColorStop(1, 'rgba(140, 255, 215, 0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(lx, ly, s * 0.85, 0, Math.PI * 2); ctx.fill();
  // body silhouette, barely darker than water
  ctx.fillStyle = 'rgba(0, 2, 5, 0.88)';
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.quadraticCurveTo(-s * 0.5, -s * 0.62, s * 0.2, -s * 0.3);
  ctx.quadraticCurveTo(s * 0.9, -s * 0.1, s, 0);
  ctx.quadraticCurveTo(s * 0.7, s * 0.42, -s * 0.1, s * 0.46);
  ctx.quadraticCurveTo(-s * 0.7, s * 0.44, -s, 0);
  ctx.closePath();
  ctx.fill();
  // jaw + teeth hinted by the lure light
  ctx.strokeStyle = 'rgba(160, 235, 215, 0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.quadraticCurveTo(-s * 0.55, s * 0.15, -s * 0.2, s * 0.1);
  ctx.stroke();
  // lure stalk
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.5);
  ctx.quadraticCurveTo(-s * 0.95, -s * 0.85, lx, ly);
  ctx.stroke();
  ctx.restore();
}

function drawSquid(t, y, alpha) {
  const s = Math.min(W, H) * 0.34;
  const x = W * (1.15 - ((t * 0.012) % 1.5));  // slow pass, re-enters
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.3) * 22);
  ctx.rotate(-0.12);
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = 'rgba(2, 6, 12, 0.92)';
  // mantle
  ctx.beginPath();
  ctx.moveTo(s * 0.9, 0);
  ctx.quadraticCurveTo(s * 0.35, -s * 0.22, -s * 0.1, -s * 0.1);
  ctx.quadraticCurveTo(s * 0.35, s * 0.22, s * 0.9, 0);
  ctx.fill();
  // fins
  ctx.beginPath();
  ctx.moveTo(s * 0.55, -s * 0.03);
  ctx.quadraticCurveTo(s * 0.85, -s * 0.3, s * 0.95, -s * 0.02);
  ctx.moveTo(s * 0.55, s * 0.03);
  ctx.quadraticCurveTo(s * 0.85, s * 0.3, s * 0.95, s * 0.02);
  ctx.fill();
  // arms
  ctx.strokeStyle = 'rgba(2, 6, 12, 0.92)';
  for (let i = 0; i < 8; i++) {
    const a = (i - 3.5) * 0.09;
    ctx.lineWidth = 3.5 - Math.abs(i - 3.5) * 0.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, 0);
    ctx.quadraticCurveTo(
      -s * 0.6, a * s * 2.4 + Math.sin(t * 0.8 + i) * 8,
      -s * (1.05 + (i % 3) * 0.12), a * s * 3.2 + Math.sin(t * 0.5 + i * 2) * 14);
    ctx.stroke();
  }
  // one huge eye, catching nothing
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = 'rgba(120, 180, 200, 0.5)';
  ctx.beginPath();
  ctx.arc(s * 0.06, -s * 0.02, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVentField(offset, t, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const floorY = H - offset;
  // seafloor silhouette
  ctx.fillStyle = '#02060b';
  ctx.beginPath();
  ctx.moveTo(0, H + 40);
  ctx.lineTo(0, floorY + 60);
  const bumps = 9;
  for (let i = 0; i <= bumps; i++) {
    const x = (i / bumps) * W;
    const y = floorY + 60 + Math.sin(i * 2.7) * 26 - (i % 3) * 14;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H + 40);
  ctx.closePath();
  ctx.fill();
  // chimneys + smoke
  for (const cx of [0.28, 0.5, 0.74]) {
    const bx = cx * W, by = floorY + 40;
    ctx.fillStyle = '#03080f';
    ctx.beginPath();
    ctx.moveTo(bx - 26, by + 30);
    ctx.lineTo(bx - 8, by - 70);
    ctx.lineTo(bx + 8, by - 70);
    ctx.lineTo(bx + 30, by + 30);
    ctx.closePath();
    ctx.fill();
    // shimmering plume
    for (let i = 0; i < 14; i++) {
      const p = i / 14;
      const px2 = bx + Math.sin(t * 1.2 + p * 7 + cx * 40) * (6 + p * 30);
      const py2 = by - 74 - p * 200;
      ctx.fillStyle = `rgba(120, 140, 160, ${(0.16 * (1 - p)) * alpha})`;
      ctx.beginPath();
      ctx.arc(px2, py2, 4 + p * 20, 0, Math.PI * 2);
      ctx.fill();
    }
    // tube worms at the base
    for (let i = 0; i < 9; i++) {
      const wx = bx + (i - 4) * 9 + Math.sin(i * 9.2) * 4;
      const wy = by + 28;
      const sway = Math.sin(t * 1.4 + i) * 3;
      ctx.strokeStyle = 'rgba(230, 235, 240, 0.5)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + sway, wy - 16, wx + sway * 1.6, wy - 28);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 90, 90, 0.85)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(wx + sway * 1.6, wy - 28);
      ctx.lineTo(wx + sway * 1.7, wy - 33);
      ctx.stroke();
    }
  }
  // station VI — a small lit habitat
  const hx = W * 0.87, hy = floorY + 26;
  ctx.fillStyle = '#04090f';
  ctx.beginPath();
  ctx.ellipse(hx, hy, 46, 26, 0, Math.PI, 0);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const wx = hx - 22 + i * 22;
    const flick = 0.75 + Math.sin(t * 3 + i * 7) * 0.08;
    ctx.fillStyle = `rgba(255, 220, 140, ${flick * alpha})`;
    ctx.beginPath();
    ctx.arc(wx, hy - 8, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* window through which a creature layer is visible, in metres */
function zoneAlpha(d, center, span) {
  return Math.max(0, 1 - Math.abs(d - center) / span);
}

/* ---------- HUD ---------- */

const hudDepth = document.getElementById('hud-depth');
const hudPress = document.getElementById('hud-press');
const hudTemp = document.getElementById('hud-temp');
const hudLight = document.getElementById('hud-light');
const hudBar = document.getElementById('hud-bar');
const startCue = document.getElementById('start-cue');

function updateHud(d) {
  hudDepth.textContent = `${Math.round(d).toLocaleString('en-US')} m`;
  hudPress.textContent = `${(1 + d / 10).toFixed(0)} atm`;
  const temp = 2 + 19 * Math.exp(-d / 480);
  hudTemp.textContent = `${temp.toFixed(1)} °C`;
  const sun = sunlight(d);
  hudLight.textContent = sun > 0.005 ? `${Math.round(sun * 100)}%` : 'none';
  hudBar.style.height = `${(d / MAX_DEPTH) * 100}%`;
  startCue.style.opacity = d > 40 ? '0' : '1';
}

/* ---------- station reveal ---------- */

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) e.target.classList.add('lit');
}, { threshold: 0.35 });
document.querySelectorAll('.station').forEach(s => io.observe(s));

/* ---------- main loop ---------- */

let t = reduceMotion ? 40 : 0;   // frozen mid-scene, not at zero, so every creature has a formed pose
let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!reduceMotion) t += dt;

  depth += (depthGoal - depth) * (reduceMotion ? 1 : 1 - Math.pow(0.002, dt));
  const descentVel = (depth - lastDepth);
  lastDepth = depth;

  // water
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, waterColor(Math.max(0, depth - 160), 6));
  grad.addColorStop(1, waterColor(depth + 220));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // god rays near the surface
  const sun = sunlight(depth);
  if (sun > 0.02) {
    ctx.save();
    ctx.globalAlpha = sun * 0.5;
    for (let i = 0; i < 7; i++) {
      const bx = W * (0.08 + i * 0.14) + Math.sin(t * 0.24 + i * 2.1) * 60;
      const wTop = 24 + i * 6, wBot = 130 + i * 30;
      const g = ctx.createLinearGradient(0, -50, 0, H);
      g.addColorStop(0, 'rgba(210, 245, 255, 0.34)');
      g.addColorStop(1, 'rgba(210, 245, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx - wTop, -60);
      ctx.lineTo(bx + wTop, -60);
      ctx.lineTo(bx + wBot + Math.sin(t * 0.3 + i) * 40, H);
      ctx.lineTo(bx - wBot, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // marine snow — rises past you as you descend
  ctx.fillStyle = 'rgba(215, 235, 245, 0.5)';
  for (const p of snow) {
    p.y -= (descentVel * 0.004 + (reduceMotion ? 0 : 0.00013)) * p.z * 60;
    p.x += Math.sin(t * 0.5 + p.drift) * 0.00008;
    if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
    if (p.y > 1.02) { p.y = -0.02; p.x = Math.random(); }
    ctx.globalAlpha = 0.15 + p.z * 0.4;
    ctx.beginPath();
    ctx.arc(p.x * W, p.y * H, p.r * p.z, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const px2m = M2PX();
  // fish school (epipelagic)
  {
    const a = zoneAlpha(depth, 170, 220);
    if (a > 0) {
      const baseY = H / 2 + (170 - depth) * px2m * 0.6;
      for (const f of fishSchool) {
        const fx = ((f.ox + t * 0.016 * f.sp) % 1.2 - 0.1) * W;
        const fy = baseY + f.oy + Math.sin(t * f.sp * 2 + f.ph) * 10;
        drawFish(fx, fy, f.size, 1, a * 0.8, `rgba(6, 30, 44, ${0.75 * a})`);
      }
    }
  }
  // jellyfish (twilight)
  {
    const a = zoneAlpha(depth, 750, 320);
    if (a > 0) {
      const baseY = H / 2 + (750 - depth) * px2m * 0.6;
      for (const j of jellies) drawJelly(j.x * W, baseY + j.oy, j.size, t + j.ph, a);
    }
  }
  // siphonophore
  {
    const a = zoneAlpha(depth, 1600, 380);
    if (a > 0) drawSiphonophore(t, H / 2 + (1600 - depth) * px2m * 0.6, a);
  }
  // anglerfish
  {
    const a = zoneAlpha(depth, 2800, 500);
    if (a > 0) drawAngler(W * 0.6, H / 2 + (2800 - depth) * px2m * 0.5, t, a);
  }
  // the large silhouette
  {
    const a = zoneAlpha(depth, 4500, 550);
    if (a > 0) drawSquid(t, H / 2 + (4500 - depth) * px2m * 0.45, a);
  }
  // vent field / seafloor rises into frame near the bottom
  {
    const p = Math.max(0, Math.min(1, (depth - 5450) / 550));
    if (p > 0) drawVentField(p * H * 0.42, t, Math.min(1, p * 1.6));
  }

  // bioluminescent trail
  for (let i = trail.length - 1; i >= 0; i--) {
    const s = trail[i];
    s.life -= dt * 0.7;
    s.x += s.vx; s.y += s.vy;
    if (s.life <= 0) { trail.splice(i, 1); continue; }
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6 * s.life);
    g.addColorStop(0, `rgba(120, 255, 215, ${0.8 * s.life})`);
    g.addColorStop(1, 'rgba(120, 255, 215, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 6 * s.life, 0, Math.PI * 2);
    ctx.fill();
  }

  updateHud(depth);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
