import * as THREE from 'three';

/* ============================================================
   MAISON VELA — one length of silk
   A real Verlet cloth: ~2,300 particles, structural + shear
   constraints, gravity, a breathing ambient wind, and the
   pointer as a hand moving through the fabric. Rendered as a
   double-sided physical material with silk sheen; the woven
   label is a canvas texture. The dye buttons re-dye the cloth,
   not the page.
   ============================================================ */

const canvas = document.getElementById('atelier');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 760px)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101012);
scene.fog = new THREE.Fog(0x101012, 8, 26);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, -0.3, 11.2);
camera.lookAt(0, -0.3, 0);

/* ---------- lighting: one warm key, one cool rim ---------- */

scene.add(new THREE.AmbientLight(0x404048, 0.7));
const key = new THREE.SpotLight(0xfff1dc, 260, 40, 0.7, 0.5, 2);
key.position.set(6, 7, 8);
scene.add(key);
const rim = new THREE.SpotLight(0x9db4d8, 140, 40, 0.8, 0.6, 2);
rim.position.set(-7, 3, -5);
scene.add(rim);
const under = new THREE.PointLight(0xd8b08a, 30, 18, 2);
under.position.set(0, -6, 3);
scene.add(under);

/* ---------- the woven label texture ---------- */

function makeLabel(inkColor, clothColor) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1536;
  const g = c.getContext('2d');
  g.fillStyle = clothColor;
  g.fillRect(0, 0, c.width, c.height);
  // weave: subtle warp/weft lines
  g.globalAlpha = 0.05;
  for (let y = 0; y < c.height; y += 3) {
    g.fillStyle = y % 6 ? '#000000' : '#ffffff';
    g.fillRect(0, y, c.width, 1);
  }
  for (let x = 0; x < c.width; x += 3) {
    g.fillStyle = x % 6 ? '#000000' : '#ffffff';
    g.fillRect(x, 0, 1, c.height);
  }
  g.globalAlpha = 1;
  g.fillStyle = inkColor;
  g.textAlign = 'center';
  g.font = '300 92px "Cormorant Garamond", serif';
  g.fillText('M A I S O N', c.width / 2, 560);
  g.font = '300 176px "Cormorant Garamond", serif';
  g.fillText('V E L A', c.width / 2, 740);
  g.font = '200 34px "Jost", sans-serif';
  g.fillText('C O L L E C T I O N   N º 7', c.width / 2, 860);
  g.strokeStyle = inkColor;
  g.lineWidth = 2;
  g.strokeRect(180, 420, c.width - 360, 520);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- cloth sim ---------- */

const CW = isMobile ? 28 : 42;      // particles across
const CH = isMobile ? 40 : 58;      // particles down
const REST = 0.12;                  // rest length
const clothW = (CW - 1) * REST;
const clothH = (CH - 1) * REST;
const TOPY = clothH / 2 + 0.2;      // hang so the banner is centered in frame

const N = CW * CH;
const pos = new Float32Array(N * 3);
const old = new Float32Array(N * 3);
const pinned = new Uint8Array(N);

function idx(x, y) { return y * CW + x; }

for (let y = 0; y < CH; y++) {
  for (let x = 0; x < CW; x++) {
    const i = idx(x, y) * 3;
    pos[i] = (x / (CW - 1) - 0.5) * clothW;
    pos[i + 1] = TOPY - (y / (CH - 1)) * clothH;
    pos[i + 2] = Math.sin(x * 0.7) * 0.02;
    old[i] = pos[i]; old[i + 1] = pos[i + 1]; old[i + 2] = pos[i + 2];
  }
}
// pin the top edge at intervals — a hung banner, not a stretched one
for (let x = 0; x < CW; x++) {
  if (x % 3 === 0 || x === CW - 1) pinned[idx(x, 0)] = 1;
}

const constraints = [];
for (let y = 0; y < CH; y++) {
  for (let x = 0; x < CW; x++) {
    if (x < CW - 1) constraints.push([idx(x, y), idx(x + 1, y), REST]);
    if (y < CH - 1) constraints.push([idx(x, y), idx(x, y + 1), REST]);
    if (x < CW - 1 && y < CH - 1) {
      constraints.push([idx(x, y), idx(x + 1, y + 1), REST * Math.SQRT2]);
      constraints.push([idx(x + 1, y), idx(x, y + 1), REST * Math.SQRT2]);
    }
  }
}

const GRAV = -3.4;
const DAMP = reduceMotion ? 0.94 : 0.985;
const ITER = 3;

const hand = { x: 0, y: 0, vx: 0, vy: 0, active: false };

function simulate(dt, t) {
  const windBase = reduceMotion ? 0 : (Math.sin(t * 0.6) * 0.55 + Math.sin(t * 1.7) * 0.3 + 0.65);
  for (let i = 0; i < N; i++) {
    if (pinned[i]) continue;
    const j = i * 3;
    const x = pos[j], y = pos[j + 1], z = pos[j + 2];
    let ax = 0, ay = GRAV, az = 0;
    // ambient wind, stronger lower on the banner, textured by position
    const lowness = (TOPY - y) / clothH;
    az += windBase * (0.5 + lowness) * (0.7 + Math.sin(x * 1.3 + t * 1.1) * 0.3);
    ax += windBase * 0.3 * Math.sin(y * 0.9 + t * 0.8);
    // the hand: a moving pressure field
    if (hand.active) {
      const dx = x - hand.x, dy = y - hand.y;
      const d2 = dx * dx + dy * dy;
      const force = Math.exp(-d2 * 1.4) * 30;
      const handSpeed = Math.min(2.5, Math.hypot(hand.vx, hand.vy));
      ax += hand.vx * force;
      ay += hand.vy * force * 0.4;
      az += force * handSpeed * 0.7;   // only a moving hand displaces the silk
    }
    const nx = x + (x - old[j]) * DAMP + ax * dt * dt;
    const ny = y + (y - old[j + 1]) * DAMP + ay * dt * dt;
    const nz = z + (z - old[j + 2]) * DAMP + az * dt * dt;
    old[j] = x; old[j + 1] = y; old[j + 2] = z;
    pos[j] = nx; pos[j + 1] = ny; pos[j + 2] = nz;
  }
  for (let k = 0; k < ITER; k++) {
    for (let ci = 0; ci < constraints.length; ci++) {
      const [a, b, rest] = constraints[ci];
      const ja = a * 3, jb = b * 3;
      let dx = pos[jb] - pos[ja], dy = pos[jb + 1] - pos[ja + 1], dz = pos[jb + 2] - pos[ja + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
      const diff = (dist - rest) / dist * 0.5;
      dx *= diff; dy *= diff; dz *= diff;
      if (!pinned[a]) { pos[ja] += dx; pos[ja + 1] += dy; pos[ja + 2] += dz; }
      if (!pinned[b]) { pos[jb] -= dx; pos[jb + 1] -= dy; pos[jb + 2] -= dz; }
    }
  }
}

/* ---------- cloth mesh ---------- */

const clothGeo = new THREE.PlaneGeometry(clothW, clothH, CW - 1, CH - 1);
const DYES = {
  ivory: { cloth: '#e8e2d5', ink: '#2a2620', hex: 0xe8e2d5 },
  oxblood: { cloth: '#5e1f24', ink: '#e8ddc8', hex: 0x5e1f24 },
  ink: { cloth: '#1d2430', ink: '#cfd8e8', hex: 0x1d2430 },
  sage: { cloth: '#8a9781', ink: '#22291e', hex: 0x8a9781 },
};
const clothMat = new THREE.MeshPhysicalMaterial({
  map: makeLabel(DYES.ivory.ink, DYES.ivory.cloth),
  color: 0xffffff,
  side: THREE.DoubleSide,
  roughness: 0.55,
  metalness: 0,
  sheen: 1,
  sheenRoughness: 0.4,
  sheenColor: new THREE.Color(0xfff4e0),
});
const cloth = new THREE.Mesh(clothGeo, clothMat);
scene.add(cloth);

/* a rail to hang it from */
{
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, clothW + 1.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 0.35, metalness: 0.9 }),
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.y = TOPY + 0.02;
  scene.add(rail);
}

function pushToGeometry() {
  const attr = clothGeo.attributes.position;
  attr.array.set(pos);
  attr.needsUpdate = true;
  clothGeo.computeVertexNormals();
}

/* ---------- pointer -> hand in cloth space ---------- */

const raycastPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();
let lastHx = 0, lastHy = 0, lastMove = 0;

const breath = document.getElementById('breath');
let breathFaded = false;

window.addEventListener('pointermove', (e) => {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(raycastPlane, hit)) {
    const now = performance.now();
    const dtm = Math.max(8, now - lastMove);
    hand.vx = THREE.MathUtils.clamp((hit.x - lastHx) / dtm * 1000, -8, 8);
    hand.vy = THREE.MathUtils.clamp((hit.y - lastHy) / dtm * 1000, -8, 8);
    hand.x = hit.x; hand.y = hit.y;
    hand.active = true;
    lastHx = hit.x; lastHy = hit.y; lastMove = now;
    if (!breathFaded && Math.abs(hand.vx) > 2) {
      breath.style.opacity = '0';
      breathFaded = true;
    }
  }
});
window.addEventListener('pointerleave', () => { hand.active = false; });

/* ---------- dyes ---------- */

const dyeButtons = [...document.querySelectorAll('.dye')];
dyeButtons.forEach((b) => {
  b.addEventListener('click', () => {
    dyeButtons.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const dye = DYES[b.dataset.dye];
    clothMat.map?.dispose();
    clothMat.map = makeLabel(dye.ink, dye.cloth);
    clothMat.needsUpdate = true;
    // a dye change is a gust — the cloth reacts to being handled
    if (!reduceMotion) {
      for (let i = 0; i < N; i++) {
        if (pinned[i]) continue;
        old[i * 3 + 2] -= (0.5 + Math.random() * 0.6) * 0.12;
      }
    }
  });
});

/* ---------- resize + loop ---------- */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let acc = 0;
const STEP = 1 / 90;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // fixed-step integration keeps the cloth stable on slow frames
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 4) {
    simulate(STEP, t);
    acc -= STEP;
    steps++;
  }
  hand.vx *= 0.86; hand.vy *= 0.86;

  pushToGeometry();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* settle the drape before first paint so it never shows as a flat plane */
for (let i = 0; i < 90; i++) simulate(STEP, i * STEP);
pushToGeometry();
frame();
