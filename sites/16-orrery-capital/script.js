import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ============================================================
   ORRERY — the market as celestial mechanics
   40,000 instruments in nested orbital shells, integrated
   entirely in the vertex shader: base Keplerian motion plus a
   volatility term that degrades the orbits from clockwork into
   storm. The pointer is a gravitational anomaly. Regime shifts
   re-tune every orbit's eccentricity at once.
   ============================================================ */

const canvas = document.getElementById('sky');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 760px)').matches;

const COUNT = isMobile ? 14000 : 40000;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050810);
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 400);

/* ---------- particle attributes ---------- */

const geo = new THREE.BufferGeometry();
{
  const shell = new Float32Array(COUNT);      // orbital radius
  const phase = new Float32Array(COUNT);      // starting angle
  const speed = new Float32Array(COUNT);
  const incl = new Float32Array(COUNT * 2);   // orbital plane tilt
  const size = new Float32Array(COUNT);
  const tint = new Float32Array(COUNT);       // 0 gold .. 1 teal
  const seed = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    // five broad shells (asset classes), each fuzzy
    const band = Math.floor(Math.pow(Math.random(), 1.4) * 5);
    shell[i] = 9 + band * 6.5 + (Math.random() - 0.5) * 4.2;
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = (0.12 + Math.random() * 0.1) * Math.sqrt(30 / shell[i]); // inner = faster
    incl[i * 2] = (Math.random() - 0.5) * 0.5 + band * 0.05;
    incl[i * 2 + 1] = Math.random() * Math.PI * 2;
    size[i] = 0.6 + Math.pow(Math.random(), 3) * 2.6;
    tint[i] = band / 4 + (Math.random() - 0.5) * 0.25;
    seed[i] = Math.random() * 100;
  }
  // positions are computed in-shader; the attribute is a placeholder
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setAttribute('aShell', new THREE.BufferAttribute(shell, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aIncl', new THREE.BufferAttribute(incl, 2));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
}

const uniforms = {
  uTime: { value: 0 },
  uVol: { value: 0.16 },          // volatility 0..1
  uRegime: { value: 0 },          // eccentricity flavor
  uPointer: { value: new THREE.Vector3(999, 999, 0) },
  uPixelRatio: { value: renderer.getPixelRatio() },
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    attribute float aShell, aPhase, aSpeed, aSize, aTint, aSeed;
    attribute vec2 aIncl;
    uniform float uTime, uVol, uRegime, uPixelRatio;
    uniform vec3 uPointer;
    varying float vTint;
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
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPixelRatio * (86.0 / -mv.z) * (1.0 + vHeat * 1.4);
    }
  `,
  fragmentShader: /* glsl */`
    varying float vTint;
    varying float vHeat;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      vec3 gold = vec3(0.83, 0.66, 0.31);
      vec3 teal = vec3(0.31, 0.80, 0.77);
      vec3 col = mix(gold, teal, clamp(vTint, 0.0, 1.0));
      col += vHeat * vec3(0.9, 0.5, 0.3);
      gl_FragColor = vec4(col, a * 0.85);
    }
  `,
});

scene.add(new THREE.Points(geo, material));

/* faint orbital rails */
{
  const railMat = new THREE.LineBasicMaterial({ color: 0xe9e2d0, transparent: true, opacity: 0.05 });
  for (let b = 0; b < 5; b++) {
    const r = 9 + b * 6.5;
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), railMat);
    ring.rotation.x = b * 0.05;
    scene.add(ring);
  }
}

/* the sun at the center of the machine */
{
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xd4a94e }),
  );
  scene.add(sun);
}

/* ---------- bloom ---------- */

let composer = null;
if (!isMobile) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.85, 0.1);
  composer.addPass(bloom);
}

/* ---------- interaction ---------- */

let yaw = 0.4, pitch = 0.42, yawGoal = 0.4, pitchGoal = 0.42;
let dragging = false, lx = 0, ly = 0;

canvas.addEventListener('pointerdown', (e) => {
  dragging = true; lx = e.clientX; ly = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  // pointer as gravity, in orrery plane coordinates
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = -(e.clientY / window.innerHeight) * 2 + 1;
  uniforms.uPointer.value.set(nx * 30, ny * 10, ny * 18);
  if (!dragging) return;
  yawGoal += (e.clientX - lx) * 0.004;
  pitchGoal = THREE.MathUtils.clamp(pitchGoal + (e.clientY - ly) * 0.003, 0.08, 1.2);
  lx = e.clientX; ly = e.clientY;
});
const stopDrag = () => { dragging = false; };
canvas.addEventListener('pointerup', stopDrag);
canvas.addEventListener('pointercancel', stopDrag);
canvas.addEventListener('pointerleave', () => uniforms.uPointer.value.set(999, 999, 0));

const volInput = document.getElementById('vol');
let volGoal = 0.16;
volInput.addEventListener('input', () => { volGoal = volInput.value / 100; });

/* regimes retune the whole machine */
const REGIMES = [
  { name: 'EQUILIBRIUM', ecc: 0.0, vol: 0.14 },
  { name: 'EXPANSION', ecc: 0.55, vol: 0.3 },
  { name: 'DISLOCATION', ecc: 1.0, vol: 0.78 },
  { name: 'MEAN REVERSION', ecc: 0.25, vol: 0.1 },
];
let regimeIndex = 0;
let eccGoal = 0;
const regimeEl = document.getElementById('m-regime');
document.getElementById('regime').addEventListener('click', () => {
  regimeIndex = (regimeIndex + 1) % REGIMES.length;
  const r = REGIMES[regimeIndex];
  regimeEl.textContent = r.name;
  eccGoal = r.ecc;
  volGoal = r.vol;
  volInput.value = String(Math.round(r.vol * 100));
});

/* ---------- fake tape ---------- */

{
  const SYMS = ['KPL', 'ORB', 'EPCY', 'TIDE', 'AXH', 'NMBR', 'VLT', 'QRN', 'SGMA', 'HLX', 'PRSM', 'DRFT', 'LMN', 'CSTR', 'FGV'];
  let html = '';
  for (const s of SYMS) {
    const chg = (Math.random() * 6 - 2.6).toFixed(2);
    const cls = +chg >= 0 ? 'up' : 'down';
    const px = (8 + Math.random() * 420).toFixed(2);
    html += `<span class="sym">${s}</span> ${px} <span class="${cls}">${+chg >= 0 ? '▲' : '▼'} ${Math.abs(+chg)}%</span>`;
  }
  document.getElementById('tape').innerHTML = html + html; // seamless loop
}

/* realized vol metric follows the dial */
const volEl = document.getElementById('m-vol');

/* ---------- resize + loop ---------- */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  uniforms.uPixelRatio.value = renderer.getPixelRatio();
});

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!reduceMotion) {
    uniforms.uTime.value += dt;
    if (!dragging) yawGoal += dt * 0.03;
  }

  uniforms.uVol.value += (volGoal - uniforms.uVol.value) * 0.03;
  uniforms.uRegime.value += (eccGoal - uniforms.uRegime.value) * 0.02;
  volEl.textContent = `${(uniforms.uVol.value * 68 + 2).toFixed(1)}%`;

  yaw += (yawGoal - yaw) * 0.06;
  pitch += (pitchGoal - pitch) * 0.06;
  const R = 66;
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
