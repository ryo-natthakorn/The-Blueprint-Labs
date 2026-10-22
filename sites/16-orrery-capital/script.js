import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

/* ============================================================
   ORRERY — the market as celestial mechanics
   40,000 instruments in nested orbital shells, integrated
   entirely in the vertex shader: base Keplerian motion plus a
   volatility term that degrades the orbits from clockwork into
   storm. The pointer is a gravitational anomaly. Regime shifts
   re-tune every orbit's eccentricity at once.
   ============================================================ */

const canvas = document.getElementById("sky");
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const isMobile = innerWidth <= 700;
const low = isMobile || (navigator.hardwareConcurrency || 8) <= 4;
const stage = document.querySelector(".instrument");
const size = () => [stage.clientWidth, stage.clientHeight];
let paused = reduceMotion;
let selectedAsset = 0;

const COUNT = low ? 12000 : 40000;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1.25 : 1.75));
renderer.setSize(...size());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080d12);
const camera = new THREE.PerspectiveCamera(42, size()[0] / size()[1], 0.1, 400);

/* ---------- particle attributes ---------- */

const geo = new THREE.BufferGeometry();
{
  const shell = new Float32Array(COUNT); // orbital radius
  const phase = new Float32Array(COUNT); // starting angle
  const speed = new Float32Array(COUNT);
  const incl = new Float32Array(COUNT * 2); // orbital plane tilt
  const size = new Float32Array(COUNT);
  const tint = new Float32Array(COUNT);
  const bands = new Float32Array(COUNT); // 0 gold .. 1 teal
  const seed = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    // five broad shells (asset classes), each fuzzy
    const band = i % 5;
    bands[i] = band;
    shell[i] = 9 + band * 6.5 + (Math.random() - 0.5) * 2.0;
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = (0.12 + Math.random() * 0.1) * Math.sqrt(30 / shell[i]); // inner = faster
    incl[i * 2] = (Math.random() - 0.5) * 0.5 + band * 0.05;
    incl[i * 2 + 1] = Math.random() * Math.PI * 2;
    size[i] = 0.6 + Math.pow(Math.random(), 3) * 2.6;
    tint[i] = band / 4 + (Math.random() - 0.5) * 0.25;
    seed[i] = Math.random() * 100;
  }
  // positions are computed in-shader; the attribute is a placeholder
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3),
  );
  geo.setAttribute("aShell", new THREE.BufferAttribute(shell, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  geo.setAttribute("aIncl", new THREE.BufferAttribute(incl, 2));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aBand", new THREE.BufferAttribute(bands, 1));
  geo.setAttribute("aTint", new THREE.BufferAttribute(tint, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
}

const uniforms = {
  uTime: { value: 0 },
  uSelected: { value: 0 },
  uVol: { value: 0.16 }, // volatility 0..1
  uRegime: { value: 0 }, // eccentricity flavor
  uPointer: { value: new THREE.Vector3(999, 999, 0) },
  uPixelRatio: { value: renderer.getPixelRatio() },
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    attribute float aShell, aPhase, aSpeed, aSize, aTint, aSeed, aBand;
    attribute vec2 aIncl;
    uniform float uTime, uVol, uRegime, uPixelRatio, uSelected;
    uniform vec3 uPointer;
    varying float vTint;
    varying float vSelected;
    varying float vHeat;

    // cheap value noise
    float n1(float x) { return fract(sin(x * 127.1) * 43758.5453); }

    void main() {
      float ang = aPhase + uTime * aSpeed * (1.0 + uVol * 0.8);

      // eccentricity: regimes stretch the orbits differently
      float ecc = 1.0 + uRegime * 0.34 * sin(ang * 2.0 + aSeed);
      float r = aShell * ecc;

      // volatility knocks each body off its rail
      float wob = uVol * uVol * 7.5;
      vec3 p = vec3(cos(ang) * r, 0.0, sin(ang) * r);
      p.y += sin(ang * 3.0 + aSeed) * (0.4 + uVol * 4.0);
      p.x += sin(uTime * (1.0 + n1(aSeed) * 3.0) + aSeed * 9.0) * wob;
      p.z += cos(uTime * (1.2 + n1(aSeed + 1.0) * 3.0) + aSeed * 7.0) * wob;

      // tilt the orbital plane
      float ci = cos(aIncl.x), si = sin(aIncl.x);
      p = vec3(p.x, p.y * ci - p.z * si * 0.3, p.y * si * 0.3 + p.z * ci);
      float ca = cos(aIncl.y), sa = sin(aIncl.y);
      p = vec3(p.x * ca - p.z * sa, p.y, p.x * sa + p.z * ca);

      // the pointer is a slow-moving mass
      vec3 toP = uPointer - p;
      float d = length(toP);
      float pull = 26.0 / (d * d + 14.0);
      p += normalize(toP + 0.0001) * pull * 2.2;
      vHeat = pull;

      vTint = aTint;
      vSelected = abs(aBand - uSelected) < 0.5 ? 1.0 : 0.0;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPixelRatio * (86.0 / -mv.z) * (1.0 + vHeat * 1.4);
    }
  `,
  fragmentShader: /* glsl */ `
    varying float vTint;
    varying float vSelected;
    varying float vHeat;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      vec3 gold = vec3(0.83, 0.66, 0.31);
      vec3 teal = vec3(0.31, 0.80, 0.77);
      vec3 col = mix(gold, teal, clamp(vTint, 0.0, 1.0));
      col *= mix(0.60, 1.25, vSelected);
      col += vHeat * vec3(0.9, 0.5, 0.3);
      gl_FragColor = vec4(col, a * 0.9);
    }
  `,
});

const particles = new THREE.Points(geo, material);
particles.frustumCulled = false;
scene.add(particles);

/* faint orbital rails */
{
  const railMat = new THREE.LineBasicMaterial({
    color: 0xe9e2d0,
    transparent: true,
    opacity: 0.05,
  });
  for (let b = 0; b < 5; b++) {
    const r = 9 + b * 6.5;
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      railMat,
    );
    ring.rotation.x = b * 0.05;
    scene.add(ring);
  }
}

/* an armillary core: concentric brass circles, a machined axis and tick marks */
const brass = new THREE.MeshStandardMaterial({
  color: 0xb69556,
  metalness: 0.75,
  roughness: 0.32,
});
const core = new THREE.Group();
scene.add(core);
for (const [r, rx, ry] of [
  [3.3, 0, 0],
  [3.8, Math.PI / 2, 0],
  [4.3, 0, Math.PI / 2],
]) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.11, 8, 96), brass);
  m.rotation.set(rx, ry, 0);
  core.add(m);
}
const spindle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.18, 0.18, 10, 16),
  brass,
);
core.add(spindle);
const heart = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 20), brass);
core.add(heart);
const light = new THREE.DirectionalLight(0xffebbf, 3);
light.position.set(20, 40, 35);
scene.add(light, new THREE.HemisphereLight(0xbfd6dd, 0x171b20, 2));
const tickPts = [];
for (let i = 0; i < 180; i++) {
  const a = (i / 180) * Math.PI * 2;
  const r = 40;
  tickPts.push(
    new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
    new THREE.Vector3(
      Math.cos(a) * (r + (i % 5 ? 0.35 : 1.1)),
      0,
      Math.sin(a) * (r + (i % 5 ? 0.35 : 1.1)),
    ),
  );
}
scene.add(
  new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(tickPts),
    new THREE.LineBasicMaterial({
      color: 0xb5a47c,
      transparent: true,
      opacity: 0.28,
    }),
  ),
);
const tracers = [];
for (let band = 0; band < 5; band++) {
  const pts = [];
  for (let k = 0; k < 42; k++) {
    const a = (k / 42) * 0.52;
    pts.push(
      new THREE.Vector3(
        Math.cos(a) * (9 + band * 6.5),
        0,
        Math.sin(a) * (9 + band * 6.5),
      ),
    );
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({
      color: band < 2 ? 0xd4a94e : 0x73b6ad,
      transparent: true,
      opacity: 0.75,
    }),
  );
  scene.add(line);
  tracers.push(line);
}
let composer = null;
if (!low) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(new THREE.Vector2(...size()), 0.3, 0.5, 0.6),
  );
}

/* ---------- interaction ---------- */

let yaw = 0.4,
  pitch = 0.64,
  yawGoal = 0.4,
  pitchGoal = 0.64;
function markOrbit() {
  document.querySelectorAll("[data-view]").forEach((b) => {
    const active = b.dataset.view === "orbit";
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
}
let dragging = false,
  lx = 0,
  ly = 0;

canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  lx = e.clientX;
  ly = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  // pointer as gravity, in orrery plane coordinates
  const nx =
    ((e.clientX - canvas.getBoundingClientRect().left) / size()[0]) * 2 - 1;
  const ny =
    -((e.clientY - canvas.getBoundingClientRect().top) / size()[1]) * 2 + 1;
  uniforms.uPointer.value.set(nx * 30, ny * 10, ny * 18);
  if (!dragging) return;
  markOrbit();
  yawGoal += (e.clientX - lx) * 0.004;
  pitchGoal = THREE.MathUtils.clamp(
    pitchGoal + (e.clientY - ly) * 0.003,
    0.08,
    1.2,
  );
  lx = e.clientX;
  ly = e.clientY;
});
const stopDrag = () => {
  dragging = false;
};
canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);
canvas.addEventListener("pointerleave", () =>
  uniforms.uPointer.value.set(999, 999, 0),
);

const volInput = document.getElementById("vol");
let volGoal = 0.16;
volInput.addEventListener("input", () => {
  volGoal = volInput.value / 100;
});

const REGIMES = [
  {
    name: "Equilibrium",
    ecc: 0,
    vol: 0.16,
    note: "Low dispersion. Independent paths around a common centre.",
  },
  {
    name: "Expansion",
    ecc: 0.55,
    vol: 0.32,
    note: "Risk travels outward. Growth assets widen their orbit as capital finds new ground.",
  },
  {
    name: "Dislocation",
    ecc: 1,
    vol: 0.82,
    note: "Paths converge under stress. Diversification weakens when everything moves together.",
  },
  {
    name: "Mean reversion",
    ecc: 0.25,
    vol: 0.1,
    note: "The pull toward balance returns. Outer paths settle at different speeds.",
  },
];
const ASSETS = [
  [
    "Sovereign rates",
    "The inner clock. A reference point for the cost of time.",
  ],
  [
    "Corporate credit",
    "Between stability and growth. Spreads measure the price of trust.",
  ],
  [
    "Global equities",
    "The growth engine. A wider orbit, with more room for surprise.",
  ],
  [
    "Real assets",
    "Tangible foundations. A different response to inflation and scarcity.",
  ],
  ["Currencies", "Relative motion. Every price is measured against another."],
];
let regimeIndex = 0,
  eccGoal = 0;
const regimeEl = document.getElementById("m-regime");
document.querySelectorAll("[data-regime]").forEach((b) =>
  b.addEventListener("click", () => {
    regimeIndex = +b.dataset.regime;
    const r = REGIMES[regimeIndex];
    eccGoal = r.ecc;
    volGoal = r.vol;
    volInput.value = Math.round(r.vol * 100);
    regimeEl.textContent = r.name;
    document.getElementById("regime-note").textContent = r.note;
    document
      .querySelectorAll("[data-regime]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }),
);
document.querySelectorAll("[data-asset]").forEach((b) =>
  b.addEventListener("click", () => {
    selectedAsset = +b.dataset.asset;
    uniforms.uSelected.value = selectedAsset;
    document.querySelectorAll("[data-asset]").forEach((x) => {
      x.setAttribute("aria-pressed", String(x === b));
      x.classList.toggle("active", x === b);
    });
    document.getElementById("asset-no").textContent =
      `ORBIT 0${selectedAsset + 1} / 05`;
    document.getElementById("asset-title").textContent =
      ASSETS[selectedAsset][0];
    document.getElementById("asset-note").textContent =
      ASSETS[selectedAsset][1];
  }),
);
const motion = document.getElementById("motion");
motion.textContent = paused ? "Play motion" : "Pause motion";
motion.setAttribute("aria-pressed", String(paused));
motion.addEventListener("click", () => {
  paused = !paused;
  motion.textContent = paused ? "Play motion" : "Pause motion";
  motion.setAttribute("aria-pressed", String(paused));
});
document.querySelectorAll("[data-view]").forEach((b) =>
  b.addEventListener("click", () => {
    pitchGoal = b.dataset.view === "top" ? 1.52 : 0.64;
    document.querySelectorAll("[data-view]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-pressed", String(x === b));
    });
  }),
);
canvas.addEventListener("keydown", (e) => {
  if (
    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(e.key)
  )
    return;
  e.preventDefault();
  markOrbit();
  if (e.key === "ArrowLeft") yawGoal -= 0.16;
  if (e.key === "ArrowRight") yawGoal += 0.16;
  if (e.key === "ArrowUp") pitchGoal = Math.min(1.52, pitchGoal + 0.12);
  if (e.key === "ArrowDown") pitchGoal = Math.max(0.12, pitchGoal - 0.12);
  if (e.key === "Home") {
    yawGoal = 0.4;
    pitchGoal = 0.64;
  }
});
document.getElementById("m-count").textContent =
  COUNT.toLocaleString("en-US") + " instruments";
const volEl = document.getElementById("m-vol");
let lastUi = 0;
function showResponse(t) {
  if (t - lastUi < 0.1) return;
  lastUi = t;
  const v = uniforms.uVol.value;
  volEl.textContent = (v * 68 + 2).toFixed(1) + "%";
  document.getElementById("vol-out").textContent =
    Math.round(volGoal * 100) + " / 100";
  document.getElementById("coupling").textContent = (0.16 + v * 0.76).toFixed(
    2,
  );
  const pts = [];
  for (let i = 0; i <= 52; i++) {
    const x = i * 5;
    const y =
      50 +
      Math.sin(i * 0.31 + selectedAsset) * v * 20 +
      Math.sin(i * 0.79) * v * 12 +
      (i / 52 - 0.5) * eccGoal * 27;
    pts.push(`${i ? "L" : "M"}${x},${y.toFixed(1)}`);
  }
  document.getElementById("response-line").setAttribute("d", pts.join(""));
}

/* ---------- resize + loop ---------- */

window.addEventListener("resize", () => {
  camera.aspect = size()[0] / size()[1];
  camera.updateProjectionMatrix();
  renderer.setSize(...size());
  if (composer) composer.setSize(...size());
  uniforms.uPixelRatio.value = renderer.getPixelRatio();
});

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!paused) {
    uniforms.uTime.value += dt;
    if (!dragging && document.activeElement !== canvas) yawGoal += dt * 0.025;
  }

  uniforms.uVol.value +=
    (volGoal - uniforms.uVol.value) *
    (reduceMotion ? 1 : 1 - Math.exp(-dt * 4));
  uniforms.uRegime.value +=
    (eccGoal - uniforms.uRegime.value) *
    (reduceMotion ? 1 : 1 - Math.exp(-dt * 2));
  volEl.textContent = `${(uniforms.uVol.value * 68 + 2).toFixed(1)}%`;

  yaw += (yawGoal - yaw) * (reduceMotion ? 1 : 0.06);
  pitch += (pitchGoal - pitch) * (reduceMotion ? 1 : 0.06);
  const R = (126 + 34 * uniforms.uVol.value ** 2) / Math.min(1, camera.aspect);
  showResponse(clock.elapsedTime);
  tracers.forEach((line, i) => {
    line.rotation.y = -uniforms.uTime.value * (0.15 + i * 0.022) + i * 1.3;
    line.material.opacity = i === selectedAsset ? 0.9 : 0.2;
  });
  core.rotation.y = uniforms.uTime.value * 0.06;
  camera.position.set(
    Math.sin(yaw) * Math.cos(pitch) * R,
    Math.sin(pitch) * R,
    Math.cos(yaw) * Math.cos(pitch) * R,
  );
  camera.lookAt(0, 0, 0);

  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

if (reduceMotion) uniforms.uTime.value = 40; // a formed, interesting still
frame();
