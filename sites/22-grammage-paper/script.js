import * as THREE from 'three';

/* ============================================================
   GRAMMAGE — one sheet, six creases, flight
   A real fold engine, not a canned animation: the sheet is a
   vertex grid, each crease is a hinge line in current space,
   and every fold rotates its cached membership of vertices
   about that hinge with Rodrigues' rotation. Scroll drives the
   fold schedule; the last stretch retargets the hinge angles
   into a flyable dart and sends it across the room.
   ============================================================ */

const canvas = document.getElementById('bench');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 760px)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f0e7);
scene.fog = new THREE.Fog(0xf3f0e7, 10, 26);

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(1.3, -0.5, 6.4);
camera.lookAt(0.5, 0, 0);

scene.add(new THREE.AmbientLight(0xfff8ec, 1.15));
const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
sun.position.set(3, 5, 6);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xd8e2ec, 0.7);
fill.position.set(-4, -2, 3);
scene.add(fill);

/* ---------- paper texture ---------- */

function paperTexture() {
  const c = document.createElement('canvas');
  c.width = 700; c.height = 1000;
  const g = c.getContext('2d');
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, c.width, c.height);
  // rag fibre
  for (let i = 0; i < 2600; i++) {
    g.strokeStyle = `rgba(${180 + Math.random() * 40}, ${172 + Math.random() * 40}, ${150 + Math.random() * 40}, 0.09)`;
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const a = Math.random() * Math.PI;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
    g.stroke();
  }
  // watermark stamp
  g.save();
  g.translate(c.width / 2, c.height * 0.62);
  g.rotate(-0.06);
  g.globalAlpha = 0.1;
  g.fillStyle = '#2b2a26';
  g.font = '700 44px "Libre Caslon Text", serif';
  g.textAlign = 'center';
  g.fillText('G R A M M A G E', 0, 0);
  g.font = '400 22px "Archivo Narrow", sans-serif';
  g.fillText('COTTON RAG · 90 GSM', 0, 36);
  g.restore();
  // deckle edge darkening
  g.strokeStyle = 'rgba(120, 110, 90, 0.25)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ---------- sheet grid ---------- */

const GX = isMobile ? 36 : 54;   // columns
const GY = isMobile ? 50 : 74;   // rows
const SHEET_W = 1.4, SHEET_H = 2.0;

const sheetGeo = new THREE.PlaneGeometry(SHEET_W, SHEET_H, GX - 1, GY - 1);
const flat = Float32Array.from(sheetGeo.attributes.position.array); // pristine copy
const NVERT = flat.length / 3;

const paper = new THREE.Mesh(sheetGeo, new THREE.MeshStandardMaterial({
  map: paperTexture(),
  side: THREE.DoubleSide,
  roughness: 0.9,
  metalness: 0,
}));
const rig = new THREE.Group();   // flight carrier
rig.add(paper);
scene.add(rig);

/* soft contact shadow */
const shadowTexCanvas = document.createElement('canvas');
shadowTexCanvas.width = shadowTexCanvas.height = 128;
{
  const g = shadowTexCanvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, 'rgba(60, 55, 40, 0.34)');
  grad.addColorStop(1, 'rgba(60, 55, 40, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
}
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(3.4, 2.4),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowTexCanvas), transparent: true, depthWrite: false }),
);
shadow.position.set(0, -1.35, -0.4);
shadow.scale.set(1, 0.4, 1);
scene.add(shadow);

/* ---------- the fold table ----------
   Each fold: hinge {p, d} in current space at fold start, a
   member test in current space, an eased target angle, and the
   scroll window [t0, t1] it animates across. */

const D = Math.PI / 180;
const folds = [
  { // I — spine: fold fully, then open to a remembered crease
    t0: 0.06, t1: 0.20,
    hinge: () => [[0, 0], [0, 1]],
    member: (x, y, z) => x < 0,
    angle: u => -(Math.sin(u * Math.PI) * 166 + u * 10) * D,
    flightAngle: -10 * D,
  },
  { // II — left shoulder
    t0: 0.22, t1: 0.36,
    hinge: () => [[0, SHEET_H / 2], [-Math.SQRT1_2, -Math.SQRT1_2]],
    member: (x, y, z) => (y - SHEET_H / 2) > x - 0.001,   // above/left of the 45° crease
    angle: u => ease(u) * -172 * D,
    flightAngle: -172 * D,
  },
  { // II — right shoulder
    t0: 0.22, t1: 0.36,
    hinge: () => [[0, SHEET_H / 2], [Math.SQRT1_2, -Math.SQRT1_2]],
    member: (x, y, z) => (y - SHEET_H / 2) > -x - 0.001,
    angle: u => ease(u) * 172 * D,
    flightAngle: 172 * D,
  },
  { // III — left taper (steeper crease through the nose)
    t0: 0.38, t1: 0.52,
    hinge: () => {
      const dir = norm(-0.26, -SHEET_H);
      return [[0, SHEET_H / 2], dir];
    },
    member: (x, y, z) => x < -0.26 * (SHEET_H / 2 - y) / SHEET_H - 0.001,
    angle: u => ease(u) * -168 * D,
    flightAngle: -168 * D,
  },
  { // III — right taper
    t0: 0.38, t1: 0.52,
    hinge: () => {
      const dir = norm(0.26, -SHEET_H);
      return [[0, SHEET_H / 2], dir];
    },
    member: (x, y, z) => x > 0.26 * (SHEET_H / 2 - y) / SHEET_H + 0.001,
    angle: u => ease(u) * 168 * D,
    flightAngle: 168 * D,
  },
  { // IV — the keel: close it on the first promise
    t0: 0.54, t1: 0.66,
    hinge: () => [[0, 0], [0, 1]],
    member: (x, y, z) => x < -0.001,
    angle: u => ease(u) * -166 * D,
    flightAngle: -70 * D,       // the body opens into a V for flight
  },
  { // V — near wing: the keel-flipped layer, which lands behind (z < 0)
    t0: 0.68, t1: 0.8,
    hinge: () => [[0.3, 0], [0, 1]],
    member: (x, y, z) => x > 0.3 && z < -0.05,
    angle: u => ease(u) * 150 * D,
    flightAngle: 96 * D,
  },
  { // V — far wing: the base layer (z near 0 and above)
    t0: 0.68, t1: 0.8,
    hinge: () => [[0.3, 0], [0, 1]],
    member: (x, y, z) => x > 0.3 && z >= -0.05,
    angle: u => ease(u) * -150 * D,
    flightAngle: -96 * D,
  },
];

function ease(u) { return u * u * (3 - 2 * u); }
function norm(x, y) { const l = Math.hypot(x, y); return [x / l, y / l]; }

/* membership + hinge caches, filled when a fold first wakes */
for (const f of folds) { f.cached = null; }

const work = new Float32Array(flat.length);

function applyFolds(P, flightBlend) {
  work.set(flat);

  for (const f of folds) {
    const u = THREE.MathUtils.clamp((P - f.t0) / (f.t1 - f.t0), 0, 1);
    if (u <= 0) { f.cached = null; continue; }

    if (!f.cached) {
      // freeze hinge + membership in the space that exists right now
      const [[px, py], [dx, dy]] = f.hinge();
      const members = new Uint8Array(NVERT);
      for (let i = 0; i < NVERT; i++) {
        if (f.member(work[i * 3], work[i * 3 + 1], work[i * 3 + 2])) members[i] = 1;
      }
      f.cached = { px, py, dx, dy, members };
    }

    let a = f.angle(u);
    if (flightBlend > 0) a = a + (f.flightAngle - a) * flightBlend;
    if (Math.abs(a) < 0.0001) continue;

    const { px, py, dx, dy, members } = f.cached;
    const cos = Math.cos(a), sin = Math.sin(a);
    // Rodrigues about the axis (dx, dy, 0) through (px, py, 0)
    for (let i = 0; i < NVERT; i++) {
      if (!members[i]) continue;
      const j = i * 3;
      let vx = work[j] - px, vy = work[j + 1] - py, vz = work[j + 2];
      const dot = vx * dx + vy * dy;
      const cx = dy * vz, cy = -dx * vz, cz = dx * vy - dy * vx;
      work[j] = px + vx * cos + cx * sin + dx * dot * (1 - cos);
      work[j + 1] = py + vy * cos + cy * sin + dy * dot * (1 - cos);
      work[j + 2] = vz * cos + cz * sin;
    }
  }

  sheetGeo.attributes.position.array.set(work);
  sheetGeo.attributes.position.needsUpdate = true;
  sheetGeo.computeVertexNormals();
}

/* ---------- flight path + trail ---------- */

const TRAIL_N = 90;
const trailPts = new Float32Array(TRAIL_N * 3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPts, 3));
const trail = new THREE.Line(trailGeo, new THREE.LineDashedMaterial({
  color: 0xb4432f, dashSize: 0.09, gapSize: 0.07, transparent: true, opacity: 0,
}));
scene.add(trail);

function flightPos(q, out) {
  out.set(
    -0.6 + q * 9.5,
    -0.4 + Math.sin(q * Math.PI * 0.9) * 2.1 + q * 1.4,
    -q * 3.5,
  );
  return out;
}
const fp = new THREE.Vector3();
const fpNext = new THREE.Vector3();

/* ---------- scroll + sections ---------- */

let scrollP = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollP = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) e.target.classList.add('set');
}, { threshold: 0.3 });
document.querySelectorAll('.crease').forEach(s => io.observe(s));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- loop ---------- */

let P = 0;
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  P += (scrollP - P) * (reduceMotion ? 1 : Math.min(1, dt * 7));

  const FLIGHT_START = 0.84;
  const flight = THREE.MathUtils.clamp((P - FLIGHT_START) / (1 - FLIGHT_START), 0, 1);

  applyFolds(Math.min(P, FLIGHT_START), ease(Math.min(1, flight * 2.2)));

  if (flight > 0) {
    const q = ease(flight);
    flightPos(q, fp);
    flightPos(Math.min(1, q + 0.02), fpNext);
    rig.position.copy(fp);
    rig.lookAt(fpNext);            // orient along the path
    rig.rotateX(Math.PI / 2);      // nose (+y of the sheet) forward
    rig.rotateY(reduceMotion ? 0 : Math.sin(t * 1.7) * 0.1 + q * 0.5); // bank
    shadow.material.opacity = 1 - q;
    // trail
    for (let i = 0; i < TRAIL_N; i++) {
      flightPos(q * (i / (TRAIL_N - 1)), fpNext);
      trailPts[i * 3] = fpNext.x; trailPts[i * 3 + 1] = fpNext.y; trailPts[i * 3 + 2] = fpNext.z;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trail.computeLineDistances();
    trail.material.opacity = Math.min(0.65, q * 2);
  } else {
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);
    if (!reduceMotion) {
      rig.rotation.y = Math.sin(t * 0.4) * 0.1;
      rig.rotation.x = Math.cos(t * 0.33) * 0.06;
    }
    shadow.material.opacity = 1;
    trail.material.opacity = 0;
  }
  shadow.position.x = rig.position.x;

  // camera eases right as the story progresses
  camera.position.x = 1.3 + P * 1.1;
  camera.lookAt(0.5 + P * 2.4, P * 0.8, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
