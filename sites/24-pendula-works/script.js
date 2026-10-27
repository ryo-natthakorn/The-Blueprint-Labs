import * as THREE from 'three';

/* ============================================================
   PENDULA — the machine thinks in ink
   A rotary harmonograph as a sculpture. The sheet rides the top
   of a gimbaled pendulum that swings in circles under the table;
   the pen arm is hinged on top of a second one at the corner.
   Their two damped motions, in a musical interval with a hair of
   detune, make the drawing. Each frame's new pen path is drawn
   as a feathered ribbon into a paper render target that never
   clears, so the ink builds up where the pen lingers. Every
   moving part follows the same equations as the line.
   ============================================================ */

const canvas = document.getElementById('gallery');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => innerWidth <= 820;
const lowEnd = small() || (navigator.hardwareConcurrency || 8) <= 4;
const PI = Math.PI;
const clamp = THREE.MathUtils.clamp;
const ease = (u) => u * u * (3 - 2 * u);

/* ---------- the harmonograph ---------- */
const RATIOS = [[1, 1], [2, 1], [3, 2], [4, 3], [5, 4], [5, 3]];
const NAMES = ['Unison', 'Octave', 'Fifth', 'Fourth', 'Third', 'Sixth'];
const INKS = { sepia: '#3b2a1f', indigo: '#25305a', vermilion: '#b23a24' };
const W_PEN = 5.2;                       // the pen pendulum, rad/s (about 0.83 Hz)
const P = { ratio: 2, detune: 0.006, phase: PI / 2, decayK: 4, ink: 'sepia' };
let A;                                   // this étude's amplitudes, in sheet units (the sheet spans ±0.5)
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// the sheet circles against the pen, which is what makes rosettes rather than plain spirals
function newAmplitudes(first) {
  A = first
    ? { pen: 0.22, penE: 0.9, paper: 0.145, paperE: 0.96, p0: 0.6 }
    : { pen: 0.19 + rnd() * 0.05, penE: 0.84 + rnd() * 0.16, paper: 0.12 + rnd() * 0.05, paperE: 0.88 + rnd() * 0.12, p0: rnd() * PI * 2 };
}
const decayOf = (k) => 0.016 * k;
function freqs() {
  const [p, q] = RATIOS[P.ratio];
  return { a: W_PEN, b: (W_PEN * q / p) * (1 + P.detune) };
}
// pen and sheet offsets at time t (seconds since the strike)
const M = { penX: 0, penY: 0, papX: 0, papY: 0, energy: 1 };
function motion(t, out = M) {
  const { a, b } = freqs();
  const d = decayOf(P.decayK);
  const ep = Math.exp(-d * t), eq = Math.exp(-d * 0.8 * t);
  out.penX = A.pen * Math.sin(a * t + P.phase + A.p0) * ep;
  out.penY = A.pen * A.penE * Math.cos(a * t + P.phase + A.p0) * ep;
  out.papX = A.paper * Math.sin(b * t + A.p0) * eq;
  out.papY = -A.paper * A.paperE * Math.cos(b * t + A.p0) * eq;
  out.energy = ep;
  return out;
}
const vRef = () => { const { a, b } = freqs(); return A.pen * a + A.paper * b; };

/* ---------- renderer & scene ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowEnd ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const BG = 0xe6dfd2;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 4, 9);
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.05, 40);

const hemi = new THREE.HemisphereLight(0xfff6e8, 0xb9ad98, 1.1);
scene.add(hemi);
const spot = new THREE.SpotLight(0xfff0d8, 24, 10, 0.55, 0.7, 1.4);
spot.position.set(1.4, 3.6, 1.2);
spot.target.position.set(0, 0.9, 0);
spot.castShadow = true;
spot.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
spot.shadow.bias = -0.0002;
spot.shadow.normalBias = 0.012;
spot.shadow.radius = 6;
scene.add(spot, spot.target);
const fill = new THREE.DirectionalLight(0xdfe6ef, 0.6);
fill.position.set(-2.5, 2, 2.2);
scene.add(fill);

/* ---------- materials ---------- */
function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5b3b25';
  g.fillRect(0, 0, 1024, 256);
  let s = 3;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 220; i++) {
    const y = r() * 256;
    g.strokeStyle = `rgba(${28 + r() * 34 | 0}, ${15 + r() * 18 | 0}, ${8 + r() * 10 | 0}, ${0.16 + r() * 0.32})`;
    g.lineWidth = 0.5 + r() * 2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 16) g.lineTo(x, y + Math.sin(x * 0.006 + i) * 5 + Math.sin(x * 0.03 + i * 2) * 1.2);
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255, 220, 170, ${0.03 + r() * 0.04})`;
    g.fillRect(r() * 1024, r() * 256, 40 + r() * 200, 1 + r() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const walnut = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.42, metalness: 0 });
const brass = new THREE.MeshStandardMaterial({ color: 0xc29a48, roughness: 0.26, metalness: 1 });
const darkBrass = new THREE.MeshStandardMaterial({ color: 0x7a5f2a, roughness: 0.34, metalness: 1 });
const steel = new THREE.MeshStandardMaterial({ color: 0xa4a9ab, roughness: 0.22, metalness: 1 });

// a soft gallery environment for the metal
{
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x968c7c);
  const panel = (x, y, z, w, h, c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(2, 4, 2, 3, 2, 0xfff3e0);
  panel(-3, 1.5, 1, 1, 3, 0xdfe6ee);
  panel(0, 1, -4, 6, 2, 0xc9bfae);
  panel(0, -3, 0, 8, 8, 0x3e352c);
  scene.environment = pm.fromScene(env, 0.02).texture;
  pm.dispose();
}

/* ---------- the room ---------- */
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0xd3c9b7, roughness: 0.92 }));
floor.rotation.x = -PI / 2;
floor.receiveShadow = true;
scene.add(floor);

/* ---------- the sculpture ---------- */
const TOP_Y = 0.9;                        // the table top
const T = 1.24, TH = 0.05;                // table size and thickness
const SHEET = 0.5;                        // sheet size, metres
const HC = 0.2;                           // centre pendulum: pivot to platform
const HP = 0.4;                           // pen pendulum: pivot to arm hinge
const PIVOT_C = new THREE.Vector3(0, TOP_Y + 0.035, 0);
const PIVOT_P = new THREE.Vector3(0.47, TOP_Y + 0.035, -0.4);
const UP = new THREE.Vector3(0, 1, 0);

const machine = new THREE.Group();
scene.add(machine);
function add(geo, mat, x, y, z, parent = machine) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d, mat, x, y, z) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
// table: a frame with a square well for the centre pendulum
const rail = 0.34;
box(T, TH, rail, walnut, 0, TOP_Y, -(T / 2 - rail / 2));
box(T, TH, rail, walnut, 0, TOP_Y, T / 2 - rail / 2);
box(rail, TH, T - 2 * rail, walnut, -(T / 2 - rail / 2), TOP_Y, 0);
box(rail, TH, T - 2 * rail, walnut, T / 2 - rail / 2, TOP_Y, 0);
const legH = TOP_Y - TH / 2;
for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
  const leg = add(new THREE.CylinderGeometry(0.03, 0.022, legH, 16), walnut, x * (T / 2 - 0.06), legH / 2, z * (T / 2 - 0.06));
  leg.rotation.set(z * 0.035, 0, -x * 0.035);
}
box(T - 0.16, 0.035, 0.035, walnut, 0, 0.22, -(T / 2 - 0.06));
box(T - 0.16, 0.035, 0.035, walnut, 0, 0.22, T / 2 - 0.06);
// brass gimbal rings where the pendulums pass through
function gimbal(pos, r) {
  const g = new THREE.Group();
  g.position.copy(pos);
  const outer = add(new THREE.TorusGeometry(r, 0.011, 12, 64), brass, 0, 0, 0, g);
  outer.rotation.x = PI / 2;
  const inner = add(new THREE.TorusGeometry(r * 0.55, 0.008, 10, 48), darkBrass, 0, 0, 0, g);
  inner.rotation.x = PI / 2;
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.008, 0.008, r * 0.5, 10), darkBrass, s * r * 0.77, 0, 0, g).rotation.z = PI / 2;
  machine.add(g);
  return inner;
}
gimbal(PIVOT_C, 0.12);
gimbal(PIVOT_P, 0.06);

// centre pendulum: rod and bob swing below, the platform rides on top and stays level
const centre = new THREE.Group();
centre.position.copy(PIVOT_C);
machine.add(centre);
add(new THREE.CylinderGeometry(0.011, 0.011, 0.78, 12), steel, 0, -0.39, 0, centre);
add(new THREE.CylinderGeometry(0.1, 0.1, 0.13, 48), brass, 0, -0.74, 0, centre);
add(new THREE.CylinderGeometry(0.104, 0.104, 0.012, 48), darkBrass, 0, -0.67, 0, centre);
add(new THREE.CylinderGeometry(0.104, 0.104, 0.012, 48), darkBrass, 0, -0.81, 0, centre);
add(new THREE.CylinderGeometry(0.014, 0.014, HC - 0.01, 12), steel, 0, (HC - 0.01) / 2, 0, centre);
const platform = new THREE.Group();
machine.add(platform);
add(new THREE.BoxGeometry(0.545, 0.02, 0.545), walnut, 0, -0.01, 0, platform);
add(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), darkBrass, 0, -0.026, 0, platform);
const RT_SIZE = lowEnd ? 1024 : 2048;
const paperRT = new THREE.WebGLRenderTarget(RT_SIZE, RT_SIZE, {
  depthBuffer: false, generateMipmaps: true,
  minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
});
paperRT.texture.anisotropy = 8;
const sheetMat = new THREE.MeshStandardMaterial({ map: paperRT.texture, color: 0xd9d6d0, roughness: 0.9 });
// the sheet holds sRGB values (so ink blends the way it looks on paper); decode them here
sheetMat.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
    vec4 sampledDiffuseColor = texture2D( map, vMapUv );
    sampledDiffuseColor.rgb = pow( sampledDiffuseColor.rgb, vec3( 2.2 ) );
    diffuseColor *= sampledDiffuseColor;`);
};
const sheet = add(new THREE.PlaneGeometry(SHEET, SHEET), sheetMat, 0, 0.001, 0, platform);
sheet.rotation.x = -PI / 2;
sheet.castShadow = false;
// four brass corner clips hold the sheet
for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.03, 0.006, 0.03), brass, x * (SHEET / 2 - 0.008), 0.004, z * (SHEET / 2 - 0.008), platform).rotation.y = PI / 4;

// pen pendulum at the far-right corner, with the pen arm hinged on its top
const penPend = new THREE.Group();
penPend.position.copy(PIVOT_P);
machine.add(penPend);
add(new THREE.CylinderGeometry(0.009, 0.009, 0.7, 12), steel, 0, -0.35, 0, penPend);
add(new THREE.SphereGeometry(0.07, 32, 20), brass, 0, -0.7, 0, penPend);
add(new THREE.CylinderGeometry(0.011, 0.014, HP, 12), darkBrass, 0, HP / 2, 0, penPend);
add(new THREE.SphereGeometry(0.018, 16, 12), brass, 0, HP, 0, penPend);
const arm = new THREE.Group();
machine.add(arm);
const ARM_LEN = Math.hypot(PIVOT_P.x, PIVOT_P.z);
add(new THREE.BoxGeometry(0.012, 0.014, ARM_LEN + 0.1), walnut, 0, 0, -(ARM_LEN + 0.1) / 2 + 0.1, arm);
add(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 24), brass, 0, 0, 0.11, arm).rotation.x = PI / 2;
const pen = new THREE.Group();
add(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 16), brass, 0, 0.055, 0, pen);
add(new THREE.ConeGeometry(0.008, 0.012, 16), new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.35 }), 0, 0.006, 0, pen).rotation.x = PI;
add(new THREE.CylinderGeometry(0.011, 0.011, 0.016, 16), darkBrass, 0, 0.09, 0, pen);
machine.add(pen);
// an inkwell on the left rail
add(new THREE.CylinderGeometry(0.035, 0.04, 0.05, 32), new THREE.MeshPhysicalMaterial({ color: 0x2b2420, roughness: 0.05, clearcoat: 1 }), -0.44, TOP_Y + 0.05, 0.42);
add(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 24), brass, -0.44, TOP_Y + 0.081, 0.42);

/* ---------- state ---------- */
const S = { t: 0, etude: 1, lifted: false, look: false, lookK: 0, ended: false };
const SPENT = 0.08;
const END = () => Math.log(1 / SPENT) / decayOf(P.decayK);   // when the energy is spent

/* ---------- the machine follows the same equations ---------- */
const q = new THREE.Quaternion(), u = new THREE.Vector3(), hinge = new THREE.Vector3(), penTop = new THREE.Vector3();
// tilt a pendulum so that the point h above its pivot is displaced by (dx, dz)
function tilt(dx, dz, h) {
  const r2 = dx * dx + dz * dz;
  u.set(dx, Math.sqrt(Math.max(h * h - r2, 0)), dz).divideScalar(h);
  return q.setFromUnitVectors(UP, u);
}
function poseMachine(t) {
  motion(t);
  // sheet +x is the room's +x, sheet +y is the room's −z
  centre.quaternion.copy(tilt(M.papX * SHEET, -M.papY * SHEET, HC));
  platform.position.copy(u).multiplyScalar(HC).add(PIVOT_C);
  penPend.quaternion.copy(tilt(M.penX * SHEET, -M.penY * SHEET, HP));
  hinge.copy(u).multiplyScalar(HP).add(PIVOT_P);
  // the arm carries the pen from the hinge to the sheet's centre at rest
  const lift = S.lifted ? 0.03 : 0;
  pen.position.set(hinge.x - PIVOT_P.x, platform.position.y + 0.0015 + lift, hinge.z - PIVOT_P.z);
  penTop.copy(pen.position).setY(pen.position.y + 0.09);
  arm.position.copy(hinge);
  arm.lookAt(penTop);
  arm.rotateY(PI);
}

/* ---------- ink on paper ---------- */
const inkCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1);
const baseScene = new THREE.Scene();
const paperBase = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: { uSeed: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }',
  fragmentShader: `
    varying vec2 vUv; uniform float uSeed;
    float h(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    float n(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 p = vUv * 700.0 + uSeed * 13.0;
      float tooth = n(p) * 0.5 + n(p * 2.7) * 0.3 + n(p * 0.21) * 0.2;
      float fibre = smoothstep(0.8, 0.96, n(vec2(vUv.x * 2200.0, vUv.y * 140.0) + uSeed));
      float cloud = n(vUv * 6.0 + uSeed);
      // sRGB values, as on the page
      vec3 c = vec3(0.925, 0.9, 0.845) * (1.0 - tooth * 0.05 - fibre * 0.035 - cloud * 0.03);
      vec2 e = abs(vUv - 0.5);
      float m = max(e.x, e.y);
      c *= 1.0 - 0.06 * smoothstep(0.452, 0.456, m) * (1.0 - smoothstep(0.458, 0.464, m));
      gl_FragColor = vec4(c, 1.0);
    }`,
}));
paperBase.frustumCulled = false;
baseScene.add(paperBase);

const inkScene = new THREE.Scene();
const MAXP = 4096;
const ribbonPos = new Float32Array(MAXP * 2 * 3);
const ribbonSide = new Float32Array(MAXP * 2);
const ribbonAlpha = new Float32Array(MAXP * 2);
const ribbonIdx = new Uint16Array((MAXP - 1) * 6);
for (let i = 0; i < MAXP - 1; i++) ribbonIdx.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6);
const ribbonGeo = new THREE.BufferGeometry();
ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonPos, 3).setUsage(THREE.DynamicDrawUsage));
ribbonGeo.setAttribute('side', new THREE.BufferAttribute(ribbonSide, 1).setUsage(THREE.DynamicDrawUsage));
ribbonGeo.setAttribute('alpha', new THREE.BufferAttribute(ribbonAlpha, 1).setUsage(THREE.DynamicDrawUsage));
ribbonGeo.setIndex(new THREE.BufferAttribute(ribbonIdx, 1));
const inkMat = new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false,
  uniforms: { uInk: { value: new THREE.Color().setStyle(INKS.sepia, THREE.LinearSRGBColorSpace) } },
  vertexShader: `
    attribute float side; attribute float alpha; varying float vSide; varying float vA;
    void main(){ vSide = side; vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    varying float vSide; varying float vA; uniform vec3 uInk;
    void main(){ float edge = 1.0 - smoothstep(0.35, 1.0, abs(vSide)); gl_FragColor = vec4(uInk, vA * edge); }`,
});
const ribbon = new THREE.Mesh(ribbonGeo, inkMat);
ribbon.frustumCulled = false;
inkScene.add(ribbon);

function intoSheet(sc) {
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(paperRT);
  renderer.autoClear = false;
  renderer.render(sc, inkCam);
  renderer.autoClear = true;
  renderer.setRenderTarget(prev);
}
function clearSheet() {
  paperBase.material.uniforms.uSeed.value = rnd() * 100;
  intoSheet(baseScene);
}

// draw the pen's path between times t0 and t1 into the sheet
const D = { penX: 0, penY: 0, papX: 0, papY: 0, energy: 1 };
const xs = new Float32Array(MAXP), ys = new Float32Array(MAXP), es = new Float32Array(MAXP);
function inkSpan(t0, t1) {
  const v = vRef();
  const n = clamp(Math.ceil((t1 - t0) * v * 420), 2, MAXP);
  const dt = (t1 - t0) / (n - 1);
  for (let i = 0; i < n; i++) {
    motion(t0 + dt * i, D);
    xs[i] = D.penX - D.papX;
    ys[i] = D.penY - D.papY;
    es[i] = D.energy;
  }
  const px = 1 / 1024;                    // line widths are set in 1024ths of the sheet
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    let tx = xs[i1] - xs[i0], ty = ys[i1] - ys[i0];
    const l = Math.hypot(tx, ty) || 1e-6;
    tx /= l; ty /= l;
    // ink pools where the pen slows; the line fines down as the energy runs out
    const speed = l / ((i1 - i0) * dt);
    const slow = 1 - clamp(speed / (0.55 * v * (0.3 + 0.7 * es[i])), 0, 1);
    const w = (3.0 + 2.0 * slow * slow) * px * (0.55 + 0.45 * es[i]);
    const al = (0.76 + 0.22 * slow) * (0.82 + 0.18 * es[i]);
    const j = i * 2;
    ribbonPos[j * 3] = xs[i] - ty * w; ribbonPos[j * 3 + 1] = ys[i] + tx * w;
    ribbonPos[j * 3 + 3] = xs[i] + ty * w; ribbonPos[j * 3 + 4] = ys[i] - tx * w;
    ribbonSide[j] = -1; ribbonSide[j + 1] = 1;
    ribbonAlpha[j] = ribbonAlpha[j + 1] = al;
  }
  ribbonGeo.setDrawRange(0, (n - 1) * 6);
  for (const k of ['position', 'side', 'alpha']) ribbonGeo.attributes[k].needsUpdate = true;
  intoSheet(inkScene);
}

function fastDraw() {
  // reduced motion: a whole étude at once
  const end = END();
  const step = (MAXP - 8) / (vRef() * 420);
  for (let t = 0; t < end; t += step) inkSpan(t, Math.min(end, t + step));
  S.t = end;
  S.ended = true;
}

/* ---------- camera ---------- */
// the room view looks at the machine's middle from a fixed direction, at a distance that fits it in the free space
const ROOM_DIR = new THREE.Vector3(0.58, 0.8, 0.72).normalize();
const ROOM_LOOK = new THREE.Vector3(-0.04, 0.72, 0.0);
const MACHINE_R = 0.95;
const VIEW = {
  room: { pos: new THREE.Vector3(), look: ROOM_LOOK },
  top: { pos: new THREE.Vector3(), look: new THREE.Vector3(0.0, PIVOT_C.y + HC, 0.0) },
};
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  pointer.x = e.clientX / innerWidth - 0.5;
  pointer.y = e.clientY / innerHeight - 0.5;
}, { passive: true });
function frameCamera() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  let cx, cy, room;
  const head = document.querySelector('.works')?.getBoundingClientRect();
  const top = head ? head.bottom + 8 : 60;
  if (small()) {
    const bench = document.querySelector('.bench');
    const bottom = bench ? bench.offsetTop - 8 : h * 0.6;
    cx = w / 2; cy = (top + bottom) / 2; camera.fov = 36;
    room = Math.min(w * 0.8, bottom - top);
  } else {
    const bench = document.querySelector('.bench')?.getBoundingClientRect();
    const right = bench && bench.width ? bench.left : w * 0.7;
    cx = right * 0.57; cy = h * 0.53; camera.fov = 30;
    room = Math.min(right * 0.66, h - top - 90);
  }
  // distance at which the machine's bounding sphere spans the free space
  const d = (MACHINE_R * (h / 2)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / (0.5 * room);
  VIEW.room.pos.copy(ROOM_DIR).multiplyScalar(d).add(ROOM_LOOK);
  // the floor fades out a little beyond the machine, whatever the distance
  scene.fog.near = d + 0.6;
  scene.fog.far = d + 5.5;
  // looking down at the drawing: the sheet fills the same free space
  const dt = (SHEET * 0.58 * (h / 2)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / (0.5 * room);
  VIEW.top.pos.set(0, VIEW.top.look.y + dt, 0.002 * dt);
  const fw = 2 * Math.max(cx, w - cx), fh = 2 * Math.max(cy, h - cy);
  camera.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, w, h);
  camera.updateProjectionMatrix();
}

/* ---------- UI ---------- */
const $ = (id) => document.getElementById(id);
const ui = {
  etude: $('etude'), freq: $('freq'), energy: $('energy'), note: $('note'),
  detune: $('detune'), detuneOut: $('detune-out'), phase: $('phase'), phaseOut: $('phase-out'),
  decay: $('decay'), decayOut: $('decay-out'), lift: $('lift'), look: $('look'), keep: $('keep'), strike: $('strike'),
};
let lastNote = '';
function note(s) { if (s !== lastNote) { ui.note.textContent = s; lastNote = s; } }
let lastEnergy = -1;
function updateReadout() {
  const [p, q] = RATIOS[P.ratio];
  ui.freq.textContent = `${p} : ${(q * (1 + P.detune)).toFixed(3)}`;
  motion(S.t, D);
  const e = Math.round(D.energy * 100);
  if (e !== lastEnergy) { ui.energy.style.width = `${e}%`; lastEnergy = e; }
}
function newSheet(bump) {
  if (bump) { S.etude++; ui.etude.textContent = S.etude; }
  newAmplitudes();
  clearSheet();
  S.t = 0;
  S.ended = false;
  if (reduceMotion) fastDraw();
  updateReadout();
}
document.querySelectorAll('[data-ratio]').forEach((b) => b.addEventListener('click', () => {
  P.ratio = +b.dataset.ratio;
  document.querySelectorAll('[data-ratio]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  newSheet(true);
  note(`${NAMES[P.ratio]}. A fresh sheet is on the platform.`);
}));
document.querySelectorAll('[data-ink]').forEach((b) => b.addEventListener('click', () => {
  P.ink = b.dataset.ink;
  inkMat.uniforms.uInk.value.setStyle(INKS[P.ink], THREE.LinearSRGBColorSpace);   // raw sRGB, no conversion
  document.querySelectorAll('[data-ink]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  if (reduceMotion) newSheet(false);
  note(reduceMotion ? `The étude, drawn in ${P.ink}.` : `${b.textContent.trim()} ink from here on.`);
}));
const decayName = (k) => (k <= 3 ? 'patient' : k <= 6 ? 'gentle' : 'hasty');
const detuneText = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v / 50).toFixed(2)}%`;
ui.detune.addEventListener('input', () => { ui.detuneOut.textContent = detuneText(+ui.detune.value); });
ui.phase.addEventListener('input', () => { ui.phaseOut.textContent = `${ui.phase.value}°`; });
ui.decay.addEventListener('input', () => { ui.decayOut.textContent = decayName(+ui.decay.value); });
// a new tuning takes effect on release, on a fresh sheet
for (const el of [ui.detune, ui.phase, ui.decay]) {
  el.addEventListener('change', () => {
    P.detune = +ui.detune.value / 5000;
    P.phase = (+ui.phase.value * PI) / 180;
    P.decayK = +ui.decay.value;
    newSheet(true);
    note('Retuned. A fresh sheet is on the platform.');
  });
}
ui.strike.addEventListener('click', () => {
  newSheet(true);
  note(reduceMotion ? `Étude nº ${S.etude}, finished.` : 'Struck. The machine is drawing.');
});
ui.lift.addEventListener('click', () => {
  S.lifted = !S.lifted;
  ui.lift.setAttribute('aria-pressed', String(S.lifted));
  ui.lift.querySelector('span').textContent = S.lifted ? 'Lower the pen' : 'Lift the pen';
  note(S.lifted ? 'Pen lifted. The pendulums keep swinging.' : 'Pen down.');
});
ui.look.addEventListener('click', () => {
  S.look = !S.look;
  document.body.classList.toggle('looking', S.look);
  ui.look.setAttribute('aria-pressed', String(S.look));
  ui.look.querySelector('span').textContent = S.look ? 'Back to the room' : 'Look at the drawing';
});
ui.keep.addEventListener('click', () => {
  const n = RT_SIZE;
  const buf = new Uint8Array(n * n * 4);
  renderer.readRenderTargetPixels(paperRT, 0, 0, n, n, buf);
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) img.data.set(buf.subarray((n - 1 - y) * n * 4, (n - y) * n * 4), y * n * 4);
  g.putImageData(img, 0, 0);
  const [p, q] = RATIOS[P.ratio];
  g.fillStyle = 'rgba(59, 42, 31, 0.72)';
  g.font = `${Math.round(n * 0.013)}px Marcellus, Georgia, serif`;
  g.textAlign = 'right';
  g.fillText(`Pendula · Harmonograph Nº 3 · Étude nº ${S.etude} · ${NAMES[P.ratio]} ${p} : ${q}`, n * 0.94, n * 0.965);
  c.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pendula-etude-${String(S.etude).padStart(2, '0')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    note(`Étude nº ${S.etude} kept, as a picture.`);
  }, 'image/png');
});

/* ---------- loop ---------- */
const clock = new THREE.Clock();
function render(dt = 1) {
  poseMachine(S.t);
  const goal = S.look ? 1 : 0;
  S.lookK = reduceMotion ? goal : S.lookK + (goal - S.lookK) * (1 - Math.exp(-dt * 3.2));
  const room = VIEW.room;
  const k = ease(S.lookK);
  camPos.copy(room.pos).lerp(VIEW.top.pos, k);
  camLook.copy(room.look).lerp(VIEW.top.look, k);
  if (!reduceMotion) {
    pointer.sx += (pointer.x - pointer.sx) * 0.04;
    pointer.sy += (pointer.y - pointer.sy) * 0.04;
    camPos.x += pointer.sx * 0.3 * (1 - k);
    camPos.y -= pointer.sy * 0.15 * (1 - k);
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  renderer.render(scene, camera);
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t1 = S.t + dt;
  if (!S.lifted && !S.ended) inkSpan(S.t, t1);
  S.t = t1;
  if (!S.ended && Math.exp(-decayOf(P.decayK) * S.t) < SPENT) {
    S.ended = true;
    note('The energy is spent. Strike for a new étude, or keep this sheet.');
  }
  updateReadout();
  render(dt);
  requestAnimationFrame(frame);
}

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  frameCamera();
  if (reduceMotion) render();
}
addEventListener('resize', onResize);
newAmplitudes(true);
frameCamera();
clearSheet();
if (reduceMotion) {
  fastDraw();
  updateReadout();
  note('A finished étude. Strike, or retune, for another.');
  // reduced motion: the machine rests and the room redraws only when something changes
  const still = () => requestAnimationFrame(() => render());
  for (const el of document.querySelectorAll('button')) el.addEventListener('click', still);
  for (const el of document.querySelectorAll('input')) el.addEventListener('change', still);
  document.fonts?.ready.then(still);
  render();
} else {
  // the machine was struck a little before you arrived
  const head = 14;
  for (let t = 0; t < head; t += 3) inkSpan(t, Math.min(head, t + 3));
  S.t = head;
  requestAnimationFrame(frame);
}
