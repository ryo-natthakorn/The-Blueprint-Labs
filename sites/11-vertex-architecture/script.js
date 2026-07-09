import * as THREE from 'three';

/* ============================================================
   VERTEX — living blueprints
   Three unbuilt projects draw themselves, line by line, on one
   drawing sheet. Segments are generated procedurally, sorted
   into a plausible drafting order, and revealed via drawRange.
   ============================================================ */

const canvas = document.getElementById('drawing');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 880px)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a1b30, 90, 220);

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 500);

const INK = 0x7fd4ff;
const INK_DIM = 0x2e5f86;
const REDLINE = 0xff8f7a;

/* ---------- segment helpers ---------- */

function seg(list, ax, ay, az, bx, by, bz) {
  list.push(ax, ay, az, bx, by, bz);
}

function rect(list, cx, z, w, d, y) {
  const hw = w / 2, hd = d / 2;
  seg(list, cx - hw, y, z - hd, cx + hw, y, z - hd);
  seg(list, cx + hw, y, z - hd, cx + hw, y, z + hd);
  seg(list, cx + hw, y, z + hd, cx - hw, y, z + hd);
  seg(list, cx - hw, y, z + hd, cx - hw, y, z - hd);
}

function circleSegs(list, cx, cz, r, y, n = 48, a0 = 0, a1 = Math.PI * 2) {
  for (let i = 0; i < n; i++) {
    const t0 = a0 + (a1 - a0) * (i / n);
    const t1 = a0 + (a1 - a0) * ((i + 1) / n);
    seg(list,
      cx + Math.cos(t0) * r, y, cz + Math.sin(t0) * r,
      cx + Math.cos(t1) * r, y, cz + Math.sin(t1) * r);
  }
}

/* dimension line with end ticks, drawn on the ground plane */
function dimLine(list, ax, az, bx, bz, tick = 1.2) {
  seg(list, ax, 0.02, az, bx, 0.02, bz);
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const px = -dz / len, pz = dx / len;
  seg(list, ax - px * tick, 0.02, az - pz * tick, ax + px * tick, 0.02, az + pz * tick);
  seg(list, bx - px * tick, 0.02, bz - pz * tick, bx + px * tick, 0.02, bz + pz * tick);
}

/* ---------- the three designs ---------- */

function buildTower() {
  const g = [];   // ground / site work, drawn first
  const s = [];   // structure, drawn bottom-up
  const r = [];   // redline markup, drawn last

  rect(g, 0, 0, 46, 46, 0);                    // site boundary
  rect(g, 0, 0, 30, 30, 0.01);                 // plot
  dimLine(g, -23, 27, 23, 27);                 // site width dim
  dimLine(g, 27, -23, 27, 23);                 // site depth dim
  seg(g, -23, 0, -30, 23, 0, -30);             // street edge
  seg(g, -23, 0, -33, 23, 0, -33);

  const FLOORS = 38, H = 62, BASE = 20;
  const lvl = i => (i / FLOORS) * H;
  const wid = i => BASE * (1 - 0.42 * (i / FLOORS)); // taper

  // floor plates + corner columns, interleaved so it rises floor by floor
  for (let i = 0; i < FLOORS; i++) {
    const y0 = lvl(i), y1 = lvl(i + 1);
    const w0 = wid(i), w1 = wid(i + 1);
    const c0 = w0 / 2, c1 = w1 / 2;
    // four corner columns for this storey
    seg(s, -c0, y0, -c0, -c1, y1, -c1);
    seg(s, c0, y0, -c0, c1, y1, -c1);
    seg(s, c0, y0, c0, c1, y1, c1);
    seg(s, -c0, y0, c0, -c1, y1, c1);
    // plate above
    rect(s, 0, 0, w1, w1, y1);
    // diagonal bracing on two faces, every 4 floors
    if (i % 4 === 0 && i + 4 <= FLOORS) {
      const yT = lvl(i + 4), wT = wid(i + 4) / 2;
      seg(s, -c0, y0, -c0, wT, yT, -wT);
      seg(s, c0, y0, -c0, -wT, yT, -wT);
      seg(s, -c0, y0, c0, wT, yT, wT);
      seg(s, c0, y0, c0, -wT, yT, wT);
    }
  }
  // core
  for (let i = 0; i <= 4; i++) {
    const x = -3 + (i / 4) * 6;
    seg(s, x, 0, 0, x * 0.58, H, 0);
  }
  // crown mast + tuned damper outline
  const topW = wid(FLOORS) / 2;
  seg(s, 0, H, 0, 0, H + 9, 0);
  seg(s, -topW, H, -topW, 0, H + 9, 0);
  seg(s, topW, H, -topW, 0, H + 9, 0);
  seg(s, topW, H, topW, 0, H + 9, 0);
  seg(s, -topW, H, topW, 0, H + 9, 0);
  rect(s, 0, 0, 5, 5, H - 4);

  // redlines: setback arrow + a lazy revision circle near the crown
  circleSegs(r, 0, 0, 8, H + 4, 26);
  dimLine(r, -BASE / 2 - 4, 0, -wid(FLOORS) / 2 - 4, 0);
  seg(r, -BASE / 2 - 4, 0.02, 0, -BASE / 2 - 4, H, 0);

  return { ground: g, structure: s, redline: r };
}

function buildPavilion() {
  const g = [], s = [], r = [];

  rect(g, 0, 0, 60, 44, 0);
  dimLine(g, -30, 26, 30, 26);
  // approach path
  seg(g, 0, 0.01, 22, 0, 0.01, 34);
  seg(g, -2.4, 0.01, 22, -2.4, 0.01, 34);
  seg(g, 2.4, 0.01, 22, 2.4, 0.01, 34);
  // reflecting pool
  rect(g, -19, 8, 12, 16, 0.02);
  rect(g, -19, 8, 10.4, 14.4, 0.02);

  const W = 40, D = 28, Hc = 5.2;
  // column grid 7 x 5, skipping the courtyard void
  const nx = 7, nz = 5;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = -W / 2 + (ix / (nx - 1)) * W;
      const z = -D / 2 + (iz / (nz - 1)) * D;
      const inCourt = Math.abs(x) < 8 && Math.abs(z) < 6;
      if (inCourt) continue;
      seg(s, x, 0, z, x, Hc, z);
      // column base plate
      rect(s, x, z, 1.4, 1.4, 0.03);
    }
  }
  // roof plane, doubled for thickness
  rect(s, 0, 0, W + 4, D + 4, Hc);
  rect(s, 0, 0, W + 4, D + 4, Hc + 0.9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    seg(s, sx * (W + 4) / 2, Hc, sz * (D + 4) / 2, sx * (W + 4) / 2, Hc + 0.9, sz * (D + 4) / 2);
  // courtyard void cut through the roof
  rect(s, 0, 0, 16, 12, Hc);
  rect(s, 0, 0, 16, 12, Hc + 0.9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    seg(s, sx * 8, Hc, sz * 6, sx * 8, Hc + 0.9, sz * 6);
  // roof joists
  for (let i = 1; i < 10; i++) {
    const x = -W / 2 - 2 + (i / 10) * (W + 4);
    if (Math.abs(x) < 8) {
      seg(s, x, Hc, -D / 2 - 2, x, Hc, -6);
      seg(s, x, Hc, 6, x, Hc, D / 2 + 2);
    } else {
      seg(s, x, Hc, -D / 2 - 2, x, Hc, D / 2 + 2);
    }
  }
  // the courtyard tree — recursive branching
  (function branch(x, y, z, ax, az, len, depth) {
    const nx2 = x + ax * len, ny = y + len, nz2 = z + az * len;
    seg(s, x, y, z, nx2, ny, nz2);
    if (depth === 0) return;
    branch(nx2, ny, nz2, ax + 0.42, az + 0.18, len * 0.62, depth - 1);
    branch(nx2, ny, nz2, ax - 0.38, az - 0.3, len * 0.62, depth - 1);
    if (depth === 3) branch(nx2, ny, nz2, ax + 0.05, az + 0.5, len * 0.55, depth - 1);
  })(0, 0, 0, 0, 0, 2.6, 4);

  // redline: circle the tree, annotate the void
  circleSegs(r, 0, 0, 10, 3, 22);
  dimLine(r, -8, -9, 8, -9);

  return { ground: g, structure: s, redline: r };
}

function buildArchive() {
  const g = [], s = [], r = [];

  rect(g, 0, 0, 52, 52, 0);
  circleSegs(g, 0, 0, 20, 0.01, 56);
  dimLine(g, -20, 24, 20, 24);
  // radial paving joints
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    seg(g, Math.cos(a) * 20, 0.01, Math.sin(a) * 20, Math.cos(a) * 24, 0.01, Math.sin(a) * 24);
  }

  const R = 14, H = 26, LEVELS = 6, RIBS = 24;
  // ring beams level by level with the ribs between them
  for (let l = 0; l < LEVELS; l++) {
    const y0 = (l / LEVELS) * H, y1 = ((l + 1) / LEVELS) * H;
    for (let i = 0; i < RIBS; i++) {
      const a = (i / RIBS) * Math.PI * 2;
      seg(s, Math.cos(a) * R, y0, Math.sin(a) * R, Math.cos(a) * R, y1, Math.sin(a) * R);
    }
    circleSegs(s, 0, 0, R, y1, RIBS * 2);
  }
  // interior stacks — concentric drums
  circleSegs(s, 0, 0, 8.5, 0.02, 40);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    seg(s, Math.cos(a) * 8.5, 0, Math.sin(a) * 8.5, Math.cos(a) * 8.5, H * 0.75, Math.sin(a) * 8.5);
  }
  circleSegs(s, 0, 0, 8.5, H * 0.75, 40);
  // the spiral ramp — the signature move
  const TURNS = 3.2, SPIRAL_N = 200;
  for (let i = 0; i < SPIRAL_N; i++) {
    const t0 = i / SPIRAL_N, t1 = (i + 1) / SPIRAL_N;
    const a0 = t0 * TURNS * Math.PI * 2, a1 = t1 * TURNS * Math.PI * 2;
    const r0 = 11.4 - t0 * 1.6, r1 = 11.4 - t1 * 1.6;
    seg(s,
      Math.cos(a0) * r0, t0 * H * 0.86 + 0.4, Math.sin(a0) * r0,
      Math.cos(a1) * r1, t1 * H * 0.86 + 0.4, Math.sin(a1) * r1);
    if (i % 10 === 0) { // balustrade posts
      seg(s,
        Math.cos(a0) * r0, t0 * H * 0.86 + 0.4, Math.sin(a0) * r0,
        Math.cos(a0) * r0, t0 * H * 0.86 + 1.5, Math.sin(a0) * r0);
    }
  }
  // oculus + roof compression ring
  circleSegs(s, 0, 0, R, H, 48);
  circleSegs(s, 0, 0, 5, H + 3.4, 32);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    seg(s, Math.cos(a) * R, H, Math.sin(a) * R, Math.cos(a) * 5, H + 3.4, Math.sin(a) * 5);
  }

  // redline: mark the oculus, question the ramp gradient
  circleSegs(r, 0, 0, 7.5, H + 3.6, 20);
  seg(r, 11.4, 0.4, 0, 15.5, 5, 6);

  return { ground: g, structure: s, redline: r };
}

const DESIGNS = [
  {
    name: 'MERIDIAN TOWER', sheet: 'A-101 · MASSING',
    height: 182, floors: 38, gfa: 42600, status: 'CONCEPT',
    note: '"the client asked for a landmark.<br>we asked the site first."',
    build: buildTower, camR: 105, camY: 40, target: 30,
  },
  {
    name: 'COURTYARD PAVILION', sheet: 'A-201 · ROOF PLAN',
    height: 6, floors: 1, gfa: 1240, status: 'DESIGN DEV',
    note: '"one roof, forty columns,<br>and a tree that was here first."',
    build: buildPavilion, camR: 78, camY: 34, target: 3,
  },
  {
    name: 'THE CIRCLE ARCHIVE', sheet: 'A-301 · SECTION',
    height: 30, floors: 6, gfa: 5800, status: 'COMPETITION',
    note: '"every shelf faces the void.<br>you read by walking downhill."',
    build: buildArchive, camR: 88, camY: 36, target: 14,
  },
];

/* ---------- geometry -> Three objects ---------- */

function makeLayer(positions, color, opacity) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const lines = new THREE.LineSegments(geo, mat);
  lines.geometry.setDrawRange(0, 0);
  return lines;
}

const world = new THREE.Group();
scene.add(world);

/* draw-tip glow: a soft sprite that rides the pen */
const tipCanvas = document.createElement('canvas');
tipCanvas.width = tipCanvas.height = 64;
{
  const c = tipCanvas.getContext('2d');
  const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(200,240,255,1)');
  grad.addColorStop(0.25, 'rgba(127,212,255,0.8)');
  grad.addColorStop(1, 'rgba(127,212,255,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, 64, 64);
}
const tip = new THREE.Sprite(new THREE.SpriteMaterial({
  map: new THREE.CanvasTexture(tipCanvas),
  transparent: true, depthTest: false, blending: THREE.AdditiveBlending,
}));
tip.scale.set(3.2, 3.2, 1);
tip.visible = false;
scene.add(tip);

/* ---------- design state machine ---------- */

let current = null;      // { layers, counts, design }
let drawT = 0;           // 0..1 draw progress of current design
let erasing = false;
let pendingIndex = -1;
let activeIndex = 0;

const annoEls = {
  height: document.querySelector('#anno-height .anno-val'),
  floors: document.querySelector('#anno-floors .anno-val'),
  area: document.querySelector('#anno-area .anno-val'),
  status: document.querySelector('#anno-status .anno-val'),
};
const tbProject = document.getElementById('tb-project');
const tbSheet = document.getElementById('tb-sheet');
const siteNote = document.getElementById('site-note');

function mount(index) {
  if (current) {
    for (const l of current.layers) {
      world.remove(l);
      l.geometry.dispose();
      l.material.dispose();
    }
  }
  const design = DESIGNS[index];
  const { ground, structure, redline } = design.build();
  const layers = [
    makeLayer(ground, INK_DIM, 0.85),
    makeLayer(structure, INK, 0.95),
    makeLayer(redline, REDLINE, 0.9),
  ];
  for (const l of layers) world.add(l);
  current = {
    layers,
    counts: [ground.length / 6, structure.length / 6, redline.length / 6],
    design,
  };
  tbProject.textContent = design.name;
  tbSheet.textContent = design.sheet;
  siteNote.innerHTML = design.note;
  camGoal.r = design.camR;
  camGoal.y = design.camY;
  targetGoal = design.target;
}

/* apply drawT (0..1) to the three layers sequentially:
   ground 0-0.18, structure 0.18-0.9, redline 0.9-1 */
function applyDraw(t) {
  const spans = [[0, 0.18], [0.18, 0.9], [0.9, 1]];
  let tipSet = false;
  for (let i = 0; i < 3; i++) {
    const [a, b] = spans[i];
    const local = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
    const nSegs = Math.floor(current.counts[i] * local);
    current.layers[i].geometry.setDrawRange(0, nSegs * 2);
    // park the pen tip at the end of the newest visible segment
    if (!tipSet && local > 0 && local < 1) {
      const pos = current.layers[i].geometry.attributes.position;
      const vi = Math.max(0, nSegs * 2 - 1);
      tip.position.set(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
      tip.visible = true;
      tipSet = true;
    }
  }
  if (!tipSet) tip.visible = false;

  // annotations count with the structure span
  const p = THREE.MathUtils.clamp((t - 0.18) / 0.72, 0, 1);
  const ease = 1 - Math.pow(1 - p, 3);
  const d = current.design;
  annoEls.height.textContent = `${Math.round(d.height * ease)} m`;
  annoEls.floors.textContent = `${Math.max(1, Math.round(d.floors * ease))}`;
  annoEls.area.textContent = `${Math.round(d.gfa * ease).toLocaleString('en-US')} m²`;
  annoEls.status.textContent = t > 0.92 ? d.status : '· · ·';
  siteNote.style.opacity = t > 0.95 ? 1 : 0;
  siteNote.style.transition = 'opacity 1.2s ease';
}

/* ---------- camera: gentle auto-orbit + drag ---------- */

const camGoal = { theta: 0.6, phi: 1.12, r: 105, y: 40 };
const camNow = { theta: 0.6, phi: 1.12, r: 105 };
let targetGoal = 30, targetNow = 30;
let autoSpin = !reduceMotion;
let dragging = false, lastX = 0, lastY = 0, spinVel = 0;

canvas.addEventListener('pointerdown', (e) => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  camGoal.theta -= dx * 0.005;
  camGoal.phi = THREE.MathUtils.clamp(camGoal.phi - dy * 0.004, 0.5, 1.45);
  spinVel = -dx * 0.005;
  autoSpin = false;
});
const endDrag = () => { dragging = false; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camGoal.r = THREE.MathUtils.clamp(camGoal.r + e.deltaY * 0.08, 45, 180);
}, { passive: false });

/* ---------- design switching ---------- */

const buttons = [...document.querySelectorAll('.dwg')];
function select(index, instant = false) {
  if (index === activeIndex && current && !instant) return;
  buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
  activeIndex = index;
  if (instant || reduceMotion || !current) {
    mount(index);
    drawT = reduceMotion ? 1 : 0;
    erasing = false;
    if (reduceMotion) applyDraw(1);
  } else {
    erasing = true;       // rewind current drawing, then mount the next
    pendingIndex = index;
  }
}
buttons.forEach((b) => b.addEventListener('click', () => select(+b.dataset.design)));

/* ---------- resize ---------- */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- main loop ---------- */

const DRAW_SPEED = 1 / 9;   // full drawing in ~9s
const ERASE_SPEED = 1 / 1.6;
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!reduceMotion) {
    if (erasing) {
      drawT = Math.max(0, drawT - dt * ERASE_SPEED);
      if (drawT === 0) {
        erasing = false;
        mount(pendingIndex);
      }
    } else if (drawT < 1) {
      drawT = Math.min(1, drawT + dt * DRAW_SPEED);
    }
    applyDraw(drawT);
  }

  if (autoSpin) camGoal.theta += dt * 0.07;
  else if (!dragging) {
    camGoal.theta += spinVel;
    spinVel *= 0.92;
  }

  camNow.theta += (camGoal.theta - camNow.theta) * 0.08;
  camNow.phi = (camNow.phi ?? camGoal.phi) + (camGoal.phi - (camNow.phi ?? camGoal.phi)) * 0.08;
  camNow.r += (camGoal.r - camNow.r) * 0.04;
  targetNow += (targetGoal - targetNow) * 0.04;

  const ty = targetNow * 0.5;
  camera.position.set(
    Math.sin(camNow.theta) * Math.sin(camNow.phi) * camNow.r,
    Math.cos(camNow.phi) * camNow.r + ty,
    Math.cos(camNow.theta) * Math.sin(camNow.phi) * camNow.r,
  );
  camera.lookAt(0, ty, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

camNow.phi = camGoal.phi;
mount(0);
if (reduceMotion) { drawT = 1; applyDraw(1); }
frame();
