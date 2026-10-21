import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
const isCoarse = window.matchMedia('(pointer: coarse)').matches;
const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
const HIGH = !(isSmallScreen || isCoarse || lowPower);

/* ------------------------------------------------------------------
   A launch profile flown by scroll. Scroll maps to mission elapsed
   time (MET), keyed to each chapter's centre; everything else —
   altitude, speed, staging, sky, weather — follows MET. The rocket
   stays near the origin; the world falls away beneath it.
------------------------------------------------------------------ */

const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const smooth = (x) => x * x * (3 - 2 * x);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

function table(keys, x) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [x0, y0] = keys[i], [x1, y1] = keys[i + 1];
    if (x <= x1) return y0 + (y1 - y0) * smooth((x - x0) / (x1 - x0));
  }
  return keys[keys.length - 1][1];
}
const ALT_KM = [[0, 0], [12, 0.25], [35, 3.2], [72, 11], [110, 30], [154, 66], [192, 100], [300, 190], [420, 320], [520, 400]];
const VEL_MS = [[0, 0], [12, 40], [35, 180], [72, 480], [110, 1100], [154, 2200], [192, 2650], [300, 4400], [420, 6300], [520, 7660]];

const canvas = document.getElementById('scene');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  renderer = null;
}

/* ------------------------------------------------------------------
   Shared GLSL
------------------------------------------------------------------ */
const NOISE = /* glsl */`
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < OCTAVES; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }
`;
const DEFINES = { OCTAVES: HIGH ? 6 : 4 };
const OUT = /* glsl */`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

/* ------------------------------------------------------------------
   Canvas textures
------------------------------------------------------------------ */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function liveryTexture(soot) {
  return canvasTex(1024, 2048, (g, w, h) => {
    g.fillStyle = '#f2f3f5';
    g.fillRect(0, 0, w, h);
    // panel seams
    g.strokeStyle = 'rgba(120,126,138,0.35)';
    g.lineWidth = 2;
    for (let y = 96; y < h; y += 180) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x < w; x += 256) { g.beginPath(); g.moveTo(x + 40, 0); g.lineTo(x + 40, h); g.stroke(); }
    // rivet lines
    g.fillStyle = 'rgba(110,116,128,0.35)';
    for (let y = 96; y < h; y += 180) for (let x = 0; x < w; x += 16) g.fillRect(x, y + 6, 2, 2);
    // vertical wordmark on one face
    g.save();
    g.translate(w * 0.13, h * 0.62);
    g.rotate(-Math.PI / 2);
    g.fillStyle = '#14171d';
    g.font = '600 120px "Michroma", "Arial Black", sans-serif';
    g.fillText('NOVA ORBIT', 0, 0);
    g.restore();
    // orange band
    g.fillStyle = '#ff7a3c';
    g.fillRect(0, h * 0.08, w, 34);
    // soot rising from the base
    if (soot) {
      const grd = g.createLinearGradient(0, h, 0, h * 0.55);
      grd.addColorStop(0, 'rgba(40,34,30,0.75)');
      grd.addColorStop(0.35, 'rgba(60,52,46,0.25)');
      grd.addColorStop(1, 'rgba(60,52,46,0)');
      g.fillStyle = grd;
      g.fillRect(0, h * 0.55, w, h * 0.45);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(40,34,30,${Math.random() * 0.12})`;
        const x = Math.random() * w, y = h - Math.random() * h * 0.4;
        g.fillRect(x, y, 2 + Math.random() * 6, 20 + Math.random() * 120);
      }
    }
  });
}

// A billowing puff: value-noise fbm cut by a soft radial falloff, lit from above.
function puffTexture(seed = 1) {
  const S = 128;
  const rnd = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return h - Math.floor(h); };
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = rnd(xi, yi), b = rnd(xi + 1, yi), c = rnd(xi, yi + 1), d = rnd(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y) => { let f = 0, a = 0.5; for (let i = 0; i < 5; i++) { f += a * vn(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return f; };
  return canvasTex(S, S, (g) => {
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const nx = x / S - 0.5, ny = y / S - 0.5;
        const r = Math.sqrt(nx * nx + ny * ny) * 2;
        const n = fbm(x / 22 + seed * 3, y / 22);
        const a = Math.max(0, Math.min(1, (n * 1.3 - r * 1.0) * 1.5)) * Math.max(0, 1 - r * r);
        const shade = 0.72 + 0.28 * (1 - y / S) + (n - 0.5) * 0.3;    // brighter crowns, darker bellies
        const i = (y * S + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, shade * 255));
        img.data[i + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

function concreteTexture() {
  return canvasTex(1024, 1024, (g, w) => {
    g.fillStyle = '#7b7975';
    g.fillRect(0, 0, w, w);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,38,36' : '160,158,152'},${Math.random() * 0.08})`;
      const r = 4 + Math.random() * 40;
      g.beginPath(); g.arc(Math.random() * w, Math.random() * w, r, 0, Math.PI * 2); g.fill();
    }
    // slab joints
    g.strokeStyle = 'rgba(30,28,26,0.35)';
    g.lineWidth = 2;
    for (let k = 0; k <= w; k += w / 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, w); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); }
    // scorch from a hundred launches around the mount
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w * 0.42);
    grd.addColorStop(0, 'rgba(18,16,14,0.85)');
    grd.addColorStop(0.35, 'rgba(30,26,22,0.45)');
    grd.addColorStop(1, 'rgba(30,26,22,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
}

function gridFinTexture() {
  return canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#2a2d33';
    g.fillRect(0, 0, w, w);
    g.globalCompositeOperation = 'destination-out';
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) g.fillRect(6 + x * 15, 6 + y * 15, 10, 10);
  });
}

function glowTexture() {
  return canvasTex(256, 256, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.08, 'rgba(255,244,220,0.9)');
    grd.addColorStop(0.3, 'rgba(255,200,140,0.25)');
    grd.addColorStop(1, 'rgba(255,170,100,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
}

/* ------------------------------------------------------------------
   Scene objects (built in initScene)
------------------------------------------------------------------ */
let scene, camera, composer;
let rocket, stage1, upper, les, lesFlame, plume1, plume2, vapor, sunLight, hemi, flameLight;
const coldGas = [];
let world, ground, deck, cloudDeck, cumulus = [], steam = [], trail = [], streaks, stars, sky, earth, clouds, atmo, sunSprite;
let skyU, groundU, deckU, earthU, plumeU1, plumeU2, vaporU;
const sunDir = new THREE.Vector3();
const DAWN_SUN = new THREE.Vector3(0.72, 0.1, -0.68).normalize();
const DAY_SUN = new THREE.Vector3(0.55, 0.62, -0.56).normalize();    // high sun for the blue-planet view
const ORBIT_SUN = new THREE.Vector3(-0.12, -0.3, -1).normalize();   // just under the limb
const EARTH_R = 2000;
const DECK_Y = 180;           // cloud deck, 3 km
const KM = 60;                // world units per km near the ground

function plumeMaterial(vacuumBias, tint) {
  const u = {
    uTime: { value: 0 }, uPower: { value: 0 }, uVac: { value: vacuumBias }, uLen: { value: 14 },
    uRadius: { value: 0.5 }, uTint: { value: new THREE.Color(tint) }, uGain: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, defines: DEFINES,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uTime, uPower, uVac, uLen, uRadius;
      varying float vY;
      varying vec3 vN;
      varying vec3 vView;
      varying float vAng;
      void main() {
        // CylinderGeometry: y in [-0.5, 0.5]; 0 at the nozzle, 1 at the tail
        float y = 0.5 - position.y;
        vY = y;
        vAng = atan(position.z, position.x);
        float swell = mix(1.0 + y * 0.9, 1.0 + pow(y, 0.45) * 7.0, uVac);
        float neck = 1.0 - 0.18 * sin(y * 3.14159) * (1.0 - uVac);
        float flick = 1.0 + 0.06 * sin(uTime * 37.0 + y * 21.0) + 0.04 * sin(uTime * 23.0 - y * 13.0);
        vec3 p = vec3(position.x * swell * neck * flick * uRadius, -y * uLen * (0.35 + 0.65 * uPower), position.z * swell * neck * flick * uRadius);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime, uPower, uVac, uLen, uGain;
      uniform vec3 uTint;
      varying float vY;
      varying vec3 vN;
      varying vec3 vView;
      varying float vAng;
      ${NOISE}
      void main() {
        float y = vY;
        float edge = pow(abs(dot(normalize(vN), vView)), 1.4);         // brighter through the middle
        float turb = fbm(vec3(vAng * 1.6, y * 7.0 - uTime * 9.0, uTime * 0.7));
        // Mach diamonds in thick air
        float diamonds = pow(abs(sin(y * uLen * 0.55)), 12.0) * (1.0 - uVac) * smoothstep(0.75, 0.0, y);
        float core = exp(-y * mix(3.2, 1.6, uVac));
        float inten = (core * (0.55 + turb * 0.7) + diamonds * 1.4) * edge;
        vec3 hot = vec3(1.0, 0.95, 0.82);
        vec3 warm = mix(vec3(1.0, 0.55, 0.18), uTint, uVac);
        vec3 col = mix(hot, warm, smoothstep(0.02, 0.35, y));
        col = mix(col, vec3(0.75, 0.22, 0.3) * (1.0 - uVac) + uTint * 0.4 * uVac, smoothstep(0.35, 1.0, y));
        float a = inten * uPower * smoothstep(1.0, 0.6, y) * mix(1.0, 0.28, uVac);
        gl_FragColor = vec4(col * a * mix(2.2, 1.3, uVac) * uGain, a);
        ${OUT}
      }
    `,
  });
  return { mat, u };
}

function buildRocket() {
  rocket = new THREE.Group();
  stage1 = new THREE.Group();
  upper = new THREE.Group();
  rocket.add(stage1, upper);
  scene.add(rocket);

  const white1 = new THREE.MeshPhysicalMaterial({ map: liveryTexture(true), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, metalness: 0.05 });
  const white2 = new THREE.MeshPhysicalMaterial({ map: liveryTexture(false), roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.35, metalness: 0.05 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x1a1c21, roughness: 0.55, metalness: 0.35 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3b3e45, roughness: 0.35, metalness: 0.85, emissive: 0xff5a1a, emissiveIntensity: 0, side: THREE.DoubleSide });
  rocket.userData.nozzleMetal = metal;
  const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const shadow = (m) => { m.castShadow = HIGH; m.receiveShadow = HIGH; return m; };

  // stage 1
  stage1.add(shadow(new THREE.Mesh(lathe([[0.02, -5.0], [0.5, -5.0], [0.55, -4.86], [0.55, 3.4]]), white1)));
  stage1.add(shadow(new THREE.Mesh(lathe([[0.556, 3.38], [0.556, 4.22]]), carbon)));
  // octaweb + nine engines
  const bellGeo = lathe([[0.045, 0], [0.06, -0.08], [0.1, -0.3], [0.13, -0.55]], 24);
  const bellPositions = [[0, 0]];
  for (let i = 0; i < 8; i++) bellPositions.push([Math.cos(i / 8 * Math.PI * 2) * 0.36, Math.sin(i / 8 * Math.PI * 2) * 0.36]);
  // centre engine first, then four opposed pairs, a beat apart
  const IGN_ORDER = [0, 1, 5, 3, 7, 2, 6, 4, 8];
  rocket.userData.bells = bellPositions.map(([x, z], i) => {
    const m = metal.clone();
    const b = new THREE.Mesh(bellGeo, m);
    b.position.set(x, -5.0, z);
    stage1.add(b);
    const slot = IGN_ORDER.indexOf(i);
    return { m, at: -3.2 + (slot === 0 ? 0 : Math.ceil(slot / 2) * 0.42) };
  });
  // landing legs (stowed) and grid fins (stowed)
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4;
    const leg = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.06), carbon));
    leg.position.set(Math.cos(a) * 0.58, -3.0, Math.sin(a) * 0.58);
    leg.rotation.y = -a + Math.PI / 2;
    stage1.add(leg);
  }
  const finMat = new THREE.MeshStandardMaterial({ map: gridFinTexture(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
  rocket.userData.fins = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * 0.56, 3.05, Math.sin(a) * 0.56);
    pivot.rotation.y = -a;
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), finMat);
    fin.position.set(0.0, -0.21, 0.0);
    fin.rotation.y = Math.PI / 2;
    pivot.add(fin);
    stage1.add(pivot);
    rocket.userData.fins.push(pivot);
  }

  // upper stage: vacuum bell (hidden by the interstage until staging), tank, trunk, capsule
  upper.add(new THREE.Mesh(lathe([[0.1, 4.2], [0.14, 4.05], [0.28, 3.55], [0.44, 2.95]], 48), metal));
  upper.add(shadow(new THREE.Mesh(lathe([[0.02, 4.2], [0.55, 4.2], [0.55, 6.6]]), white2)));
  upper.add(shadow(new THREE.Mesh(lathe([[0.553, 6.6], [0.553, 7.12]]), new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.6, metalness: 0.4 }))));
  const capsuleMat = new THREE.MeshPhysicalMaterial({ color: 0xeceef2, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  upper.add(shadow(new THREE.Mesh(lathe([[0.55, 7.12], [0.52, 7.3], [0.32, 8.4], [0.2, 8.68], [0.06, 8.78], [0.0, 8.79]]), capsuleMat)));
  // window ports — four seats, four windows
  // cabin light behind the glass: four small warm windows, one per seat
  const winMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0f1a, roughness: 0.05, metalness: 0.2, clearcoat: 1, emissive: 0xffc98a, emissiveIntensity: 0.55 });
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.4;
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), winMat);
    const r = 0.442;
    w.position.set(Math.cos(a) * r, 7.78, Math.sin(a) * r);
    w.lookAt(Math.cos(a) * 3, 7.78 + 1.3, Math.sin(a) * 3);
    upper.add(w);
  }
  // launch escape tower
  les = new THREE.Group();
  const lesMat = new THREE.MeshStandardMaterial({ color: 0xe9ebef, roughness: 0.4 });
  les.add(new THREE.Mesh(lathe([[0.06, 8.75], [0.07, 9.8], [0.11, 9.95], [0.11, 10.4], [0.0, 10.9]], 24), lesMat));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.18, 10), carbon);
    n.position.set(Math.cos(a) * 0.12, 10.0, Math.sin(a) * 0.12);
    n.rotation.z = Math.cos(a) * 0.5; n.rotation.x = -Math.sin(a) * 0.5;
    les.add(n);
  }
  upper.add(les);
  lesFlame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  lesFlame.position.set(0, 9.8, 0);
  lesFlame.scale.set(1.6, 1.6, 1);
  lesFlame.visible = false;
  les.add(lesFlame);
  const gasTex = puffTexture();
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: gasTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
    g.visible = false;
    rocket.add(g);
    coldGas.push(g);
  }

  // exhaust
  const plumeGeo = new THREE.CylinderGeometry(1, 1, 1, 40, 48, true);
  const p1 = plumeMaterial(0, '#ffb070');
  plumeU1 = p1.u;
  plume1 = new THREE.Mesh(plumeGeo, p1.mat);
  plume1.position.y = -5.5;
  plume1.frustumCulled = false;
  stage1.add(plume1);
  const p2 = plumeMaterial(1, '#9fc4ff');
  plumeU2 = p2.u;
  plumeU2.uRadius.value = 0.42;
  plumeU2.uGain.value = 2.2;      // a vacuum plume is faint; keep it just readable
  plume2 = new THREE.Mesh(plumeGeo, p2.mat);
  plume2.position.y = 2.95;
  plume2.frustumCulled = false;
  upper.add(plume2);

  flameLight = new THREE.PointLight(0xff8a40, 0, 120, 1.6);
  flameLight.position.set(0, -7, 0);
  stage1.add(flameLight);

  // vapour cone at max-Q
  vaporU = { uTime: { value: 0 }, uAmount: { value: 0 } };
  vapor = new THREE.Mesh(
    lathe([[0.6, 4.1], [0.9, 3.4], [1.5, 2.3], [2.2, 1.0], [2.6, 0.2]], 64),
    new THREE.ShaderMaterial({
      uniforms: vaporU, defines: DEFINES, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec3 vP; varying vec3 vN; varying vec3 vV;
        void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uAmount; varying vec3 vP; varying vec3 vN; varying vec3 vV;
        ${NOISE}
        void main() {
          float n = fbm(vec3(atan(vP.z, vP.x) * 2.0, vP.y * 2.4 + uTime * 6.0, uTime));
          float along = smoothstep(4.1, 3.4, vP.y) * smoothstep(0.1, 1.4, vP.y);
          float rim = 1.0 - abs(dot(normalize(vN), vV));
          float a = smoothstep(0.35, 0.8, n) * along * (0.3 + rim * 0.9) * uAmount * 0.75;
          gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a);
          ${OUT}
        }`,
    })
  );
  vapor.frustumCulled = false;
  vapor.renderOrder = 2;
  stage1.add(vapor);
}

function buildWorld() {
  world = new THREE.Group();
  scene.add(world);

  // ground: scrub, marsh and coast at dawn
  groundU = { uSunDir: { value: sunDir }, uHaze: { value: new THREE.Color() }, uFade: { value: 1 } };
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30000, 30000, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: groundU, defines: DEFINES, transparent: true, depthWrite: true,
      vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir; uniform vec3 uHaze; uniform float uFade; varying vec3 vW;
        ${NOISE}
        void main() {
          vec2 q = vW.xz;
          vec3 local = vW - cameraPosition;
          float dist = length(local);
          float n = fbm(vec3(q * 0.0035, 1.0));
          float n2 = fbm(vec3(q * 0.02, 4.0));
          float coast = q.x + (fbm(vec3(q * 0.0011, 7.0)) - 0.5) * 1400.0;
          float ocean = smoothstep(520.0, 600.0, coast);
          vec3 scrub = mix(vec3(0.16, 0.19, 0.1), vec3(0.3, 0.27, 0.16), n2);
          vec3 marsh = vec3(0.12, 0.16, 0.13);
          vec3 land = mix(scrub, marsh, smoothstep(0.5, 0.66, n));
          land = mix(land, vec3(0.62, 0.55, 0.42), smoothstep(470.0, 540.0, coast) * (1.0 - ocean));   // beach
          float pad = smoothstep(46.0, 38.0, length(q));
          land = mix(land, vec3(0.42, 0.41, 0.39), pad);
          float sunUp = max(uSunDir.y, 0.0);
          vec3 lit = land * (0.16 + 1.1 * sunUp) * vec3(1.0, 0.82, 0.66);
          vec3 view = normalize(local);
          vec3 nrm = normalize(vec3((n2 - 0.5) * 0.08, 1.0, (n - 0.5) * 0.08));
          float glint = pow(max(dot(reflect(view, nrm), uSunDir), 0.0), 120.0);
          vec3 sea = vec3(0.03, 0.1, 0.17) + uHaze * 0.18 + vec3(1.0, 0.75, 0.5) * glint * 3.0;
          vec3 col = mix(lit, sea, ocean);
          float haze = 1.0 - exp(-dist * 0.00042);
          col = mix(col, uHaze, haze);
          gl_FragColor = vec4(col, uFade);
          ${OUT}
        }`,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -5.9;
  world.add(ground);

  // pad deck with flame trench and hold-downs
  const concrete = new THREE.MeshStandardMaterial({ color: 0xffffff, map: concreteTexture(), roughness: 0.95 });
  deck = new THREE.Mesh(new THREE.BoxGeometry(34, 0.7, 30), concrete);
  deck.position.y = -5.55;
  deck.receiveShadow = HIGH;
  world.add(deck);
  const trench = new THREE.Mesh(new THREE.BoxGeometry(34.2, 0.72, 3.4), new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 1 }));
  trench.position.y = -5.545;
  world.add(trench);
  const mount = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 2.6), new THREE.MeshStandardMaterial({ color: 0x4d4f53, roughness: 0.7, metalness: 0.4 }));
  mount.position.y = -5.15;
  world.add(mount);

  // lattice tower with a crew access arm
  const steel = new THREE.MeshStandardMaterial({ color: 0x7d838c, roughness: 0.6, metalness: 0.55 });
  const tower = new THREE.Group();
  const TH = 19;
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, TH, 0.16), steel);
    leg.position.set(x, -5.2 + TH / 2, z);
    leg.castShadow = HIGH;
    tower.add(leg);
  }
  for (let k = 0; k < 16; k++) {
    const y = -4.8 + k * 1.2;
    for (const [rx, rz, len] of [[0, -0.9, 1.8], [0, 0.9, 1.8], [-0.9, 0, 1.8], [0.9, 0, 1.8]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(rx === 0 ? len : 0.08, 0.08, rz === 0 ? len : 0.08), steel);
      bar.position.set(rx, y, rz);
      tower.add(bar);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(rx === 0 ? 2.3 : 0.06, 0.06, rz === 0 ? 2.3 : 0.06), steel);
      brace.position.set(rx, y + 0.6, rz);
      brace.rotation[rx === 0 ? 'z' : 'x'] = 0.58 * (k % 2 ? 1 : -1);
      tower.add(brace);
    }
  }
  const arm = new THREE.Group();
  const armBeam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.9), steel);
  armBeam.position.x = 1.6;
  const room = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.2), new THREE.MeshStandardMaterial({ color: 0xdadde2, roughness: 0.5 }));
  room.position.x = 3.15;
  arm.add(armBeam, room);
  arm.position.set(0.9, 7.7, 0);
  tower.add(arm);
  tower.userData.arm = arm;
  tower.position.set(-4.6, 0, -1.8);
  world.add(tower);
  world.userData.tower = tower;
  // lightning masts
  for (const [x, z] of [[-16, -12], [14, -14], [-12, 13]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 30, 8), steel);
    mast.position.set(x, -5.2 + 15, z);
    world.add(mast);
  }

  // cloud deck at 3 km: seen as a ceiling, punched through, then a sea below
  deckU = { uSunDir: { value: sunDir }, uAbove: { value: 0 }, uFade: { value: 1 }, uTime: { value: 0 }, uHaze: groundU.uHaze };
  cloudDeck = new THREE.Mesh(
    new THREE.PlaneGeometry(26000, 26000, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: deckU, defines: DEFINES, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir; uniform float uAbove, uFade, uTime; uniform vec3 uHaze; varying vec3 vW;
        ${NOISE}
        void main() {
          vec2 q = vW.xz * 0.0016 + vec2(uTime * 0.004, 0.0);
          float n = fbm(vec3(q, 2.0));
          float dens = smoothstep(0.42, 0.72, n);
          float dist = length(vW - cameraPosition);
          vec3 top = mix(vec3(0.9, 0.78, 0.72), vec3(1.0, 0.96, 0.92), smoothstep(0.5, 0.85, n));
          vec3 under = mix(vec3(0.3, 0.3, 0.36), vec3(0.62, 0.55, 0.52), smoothstep(0.42, 0.62, n));
          vec3 col = mix(under, top, uAbove) * mix(0.75, 1.0, smoothstep(0.42, 0.8, n));
          col = mix(col, uHaze, smoothstep(800.0, 6000.0, dist));
          float a = dens * uFade * smoothstep(9000.0, 2500.0, dist);
          gl_FragColor = vec4(col, a);
          ${OUT}
        }`,
    })
  );
  cloudDeck.rotation.x = -Math.PI / 2;
  cloudDeck.position.y = DECK_Y;
  cloudDeck.renderOrder = 1;
  world.add(cloudDeck);

  const puffs = [puffTexture(1), puffTexture(2), puffTexture(3)];
  const puff = puffs[0];
  // cumulus sprites around the deck, so the crossing has parallax
  const CUM = HIGH ? 46 : 20;
  for (let i = 0; i < CUM; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.9 }));
    const r = 18 + Math.random() * 260;
    const a = Math.random() * Math.PI * 2;
    s.position.set(Math.cos(a) * r, DECK_Y - 30 + Math.random() * 60, Math.sin(a) * r - 40);
    const sc = 40 + Math.random() * 90;
    s.scale.set(sc, sc * 0.6, 1);
    world.add(s);
    cumulus.push(s);
  }
  // water-deluge steam and launch smoke
  const STEAM = HIGH ? 110 : 44;
  for (let i = 0; i < STEAM; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffs[i % 3], color: 0xffffff, transparent: true, depthWrite: false, opacity: 0, rotation: Math.random() * Math.PI * 2 }));
    s.userData = { side: i % 2 ? 1 : -1, seed: Math.random(), spread: (Math.random() - 0.5) * 2, rise: 0.25 + Math.random() * Math.random() * 1.4, tone: 0.78 + Math.random() * 0.22, size: 0.7 + Math.random() * 0.8 };
    world.add(s);
    steam.push(s);
  }
  // exhaust trail left in the air
  const TRAIL = HIGH ? 90 : 40;
  for (let i = 0; i < TRAIL; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0xe8e2da, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { born: -1, y: 0, x: 0 };
    world.add(s);
    trail.push(s);
  }

  // speed streaks in the air (in the rocket's frame)
  const N = HIGH ? 140 : 60;
  const sp = new Float32Array(N * 6);
  const sd = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 26;
    sd.set([Math.cos(a) * r, Math.random() * 60 - 30, Math.sin(a) * r - 6], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  streaks.userData.seed = sd;
  streaks.frustumCulled = false;
  scene.add(streaks);
}

function buildSky() {
  skyU = { uSunDir: { value: sunDir }, uAlt: { value: 0 }, uHaze: { value: new THREE.Color() } };
  sky = new THREE.Mesh(
    new THREE.SphereGeometry(40000, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: skyU, side: THREE.BackSide, depthWrite: false,
      vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir; uniform float uAlt; uniform vec3 uHaze; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float dip = -uAlt * 0.16;
          float h = d.y - dip;
          vec3 zen = mix(vec3(0.03, 0.09, 0.26), vec3(0.0), smoothstep(0.0, 0.55, uAlt));
          vec3 mid = mix(vec3(0.2, 0.32, 0.58), vec3(0.0), smoothstep(0.0, 0.6, uAlt));
          vec3 hor = mix(vec3(0.92, 0.5, 0.3), vec3(0.18, 0.36, 0.8), smoothstep(0.05, 0.4, uAlt));
          hor *= 1.0 - smoothstep(0.6, 0.95, uAlt);
          float hh = clamp(h, 0.0, 1.0);
          vec3 col = mix(hor, mid, smoothstep(0.0, mix(0.22, 0.06, uAlt), hh));
          col = mix(col, zen, smoothstep(0.1, 0.8, hh));
          // below the horizon: the same haze the ground and cloud deck fade into, so no seam shows
          col = h < 0.0 ? mix(mix(uHaze, hor, 0.35), vec3(0.03, 0.04, 0.07) * (1.0 - uAlt), clamp(-h * 2.5, 0.0, 1.0) * uAlt) : col;
          // thin blue limb band at altitude
          col += vec3(0.16, 0.38, 1.0) * exp(-abs(h) * 70.0) * smoothstep(0.2, 0.5, uAlt) * (1.0 - smoothstep(0.8, 0.97, uAlt)) * 0.7;
          float sd = max(dot(d, uSunDir), 0.0);
          col += vec3(1.0, 0.62, 0.34) * pow(sd, 10.0) * 0.4 * (1.0 - uAlt * 0.85);
          col += vec3(1.0, 0.85, 0.6) * pow(sd, 90.0) * 0.5;
          gl_FragColor = vec4(col, 1.0);
          ${OUT}
        }`,
    })
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // stars
  const STARS = HIGH ? 4200 : 1600;
  const pos = new Float32Array(STARS * 3);
  const mag = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(30000);
    pos.set([v.x, v.y, v.z], i * 3);
    mag[i] = Math.pow(Math.random(), 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
  stars = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */`attribute float aMag; uniform float uPR; varying float vM;
      void main(){ vM = aMag; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; gl_PointSize = (0.8 + aMag * 2.2) * uPR; }`,
    fragmentShader: /* glsl */`uniform float uOpacity; varying float vM;
      void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), smoothstep(0.5, 0.0, d) * (0.35 + vM * 0.65) * uOpacity); }`,
  }));
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  scene.add(stars);

  // the sun itself
  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd9b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sunSprite.scale.set(3400, 3400, 1);
  sunSprite.renderOrder = -8;
  scene.add(sunSprite);
}

function buildEarth() {
  earthU = { uSunDir: { value: sunDir }, uTime: { value: 0 }, uFade: { value: 0 } };
  const common = { defines: DEFINES, transparent: true };
  earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R, 160, 120),
    new THREE.ShaderMaterial({
      ...common, uniforms: earthU,
      vertexShader: /* glsl */`varying vec3 vP; varying vec3 vN; varying vec3 vW;
        void main(){ vP = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir; uniform float uTime, uFade; varying vec3 vP; varying vec3 vN; varying vec3 vW;
        ${NOISE}
        void main() {
          vec3 p = vP * 9.0;                       // continents a few hundred units across
          float cont = fbm(p + 3.0);
          float land = smoothstep(0.56, 0.59, cont);       // about two-thirds ocean
          float hills = fbm(p * 6.0);
          vec3 landCol = mix(vec3(0.16, 0.26, 0.11), vec3(0.5, 0.42, 0.27), smoothstep(0.45, 0.7, hills));
          landCol = mix(landCol, vec3(0.86, 0.9, 0.95), smoothstep(0.78, 0.86, abs(vP.y)));
          vec3 sea = mix(vec3(0.01, 0.06, 0.16), vec3(0.03, 0.16, 0.3), smoothstep(0.35, 0.5, cont));
          vec3 surf = mix(sea, landCol, land);
          vec3 n = normalize(vN);
          float day = dot(n, uSunDir);
          float lit = smoothstep(-0.08, 0.25, day);
          vec3 v = normalize(cameraPosition - vW);
          float spec = pow(max(dot(reflect(-uSunDir, n), v), 0.0), 60.0) * (1.0 - land) * lit;
          vec3 col = surf * (0.03 + lit * 1.15) + vec3(1.0, 0.85, 0.65) * spec * 1.4;
          // dawn warmth along the terminator
          col += vec3(0.9, 0.38, 0.12) * exp(-pow((day - 0.04) * 14.0, 2.0)) * 0.16;
          // city lights on the night side
          float city = smoothstep(0.8, 0.95, vnoise(p * 90.0)) * smoothstep(0.5, 0.7, fbm(p * 4.0)) * land;
          col += vec3(1.0, 0.7, 0.36) * city * (1.0 - smoothstep(-0.12, 0.03, day)) * 1.8;
          gl_FragColor = vec4(col, uFade);
          ${OUT}
        }`,
    })
  );
  scene.add(earth);

  clouds = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.0015, 160, 120),
    new THREE.ShaderMaterial({
      ...common, uniforms: earthU, depthWrite: false,
      vertexShader: /* glsl */`varying vec3 vP; varying vec3 vN;
        void main(){ vP = normalize(position); vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir; uniform float uTime, uFade; varying vec3 vP; varying vec3 vN;
        ${NOISE}
        void main() {
          float c = fbm(vP * 34.0 + vec3(uTime * 0.01, 0.0, 0.0));
          float a = smoothstep(0.52, 0.78, c);
          float day = dot(normalize(vN), uSunDir);
          vec3 col = mix(vec3(0.015, 0.018, 0.03), vec3(1.0, 0.98, 0.95), smoothstep(-0.02, 0.3, day));
          col = mix(col, vec3(1.0, 0.55, 0.3), exp(-pow((day - 0.03) * 16.0, 2.0)) * 0.6);
          gl_FragColor = vec4(col, a * 0.8 * uFade);
          ${OUT}
        }`,
    })
  );
  scene.add(clouds);

  atmo = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.0055, 160, 120),   // thin enough that the camera stays outside it
    new THREE.ShaderMaterial({
      ...common, uniforms: earthU, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`varying vec3 vN; varying vec3 vW;
        void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir; uniform float uFade; varying vec3 vN; varying vec3 vW;
        void main() {
          vec3 v = normalize(vW - cameraPosition);
          vec3 n = normalize(vN);
          float rim = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 6.0);
          float sunSide = dot(-n, uSunDir);                     // BackSide: -n faces outward on the far limb
          float lit = smoothstep(-0.45, 0.15, sunSide);
          float forward = pow(max(dot(v, uSunDir), 0.0), 6.0);
          vec3 col = mix(vec3(1.0, 0.38, 0.12), vec3(0.22, 0.52, 1.0), smoothstep(-0.15, 0.35, sunSide));
          col = mix(col, vec3(1.0, 0.75, 0.45), forward * 0.6);
          gl_FragColor = vec4(col * rim * (lit * 1.4 + forward * 3.0) * uFade, 1.0);
          ${OUT}
        }`,
    })
  );
  scene.add(atmo);
}

function initScene() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, HIGH ? 2 : 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = HIGH;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();

  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.3, 90000);

  sunDir.copy(DAWN_SUN);
  sunLight = new THREE.DirectionalLight(0xffd2a6, 3.0);
  sunLight.castShadow = HIGH;
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 });
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight, sunLight.target);
  hemi = new THREE.HemisphereLight(0x9fb4d8, 0x3b3226, 0.55);
  scene.add(hemi);

  buildSky();
  buildWorld();
  buildRocket();
  buildEarth();

  if (HIGH) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.92));
    composer.addPass(new OutputPass());
  }
  resize();
}

const view = { portrait: false, pull: 1 };
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  view.portrait = camera.aspect < 0.9;
  // portrait: a taller lens, pulled back, with the vehicle in the upper half above the copy
  camera.fov = view.portrait ? 50 : 40;
  view.pull = view.portrait ? clamp(1.05 / camera.aspect, 1.2, 1.9) : 1;
  if (view.portrait) camera.setViewOffset(w, h, 0, h * 0.14, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
  measureChapters();
}

/* ------------------------------------------------------------------
   Scroll → MET, keyed to the chapter centres
------------------------------------------------------------------ */
const chapters = [...document.querySelectorAll('.chapter')];
let metKeys = [[0, -20], [1, 520]];
// Cards hold still while their chapter plays: centred on desktop, a caption above the timeline on phones.
function stickCards() {
  const portrait = window.innerWidth <= 720;
  chapters.forEach((c) => {
    const card = c.querySelector('.card');
    const h = card.offsetHeight;
    const top = portrait ? window.innerHeight - h - 88 : (window.innerHeight - h) / 2;
    card.style.setProperty('--stick', `${Math.max(64, Math.round(top))}px`);
  });
}
function measureChapters() {
  stickCards();
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return;
  metKeys = chapters.map((c, i) => {
    const centre = c.offsetTop + c.offsetHeight / 2 - window.innerHeight / 2;
    let p = clamp(centre / max, 0, 1);
    if (i === 0) p = 0;
    if (i === chapters.length - 1) p = 1;
    return [p, Number(c.dataset.met)];
  });
  placeTimeline();
}
function metAt(p) {
  for (let i = 0; i < metKeys.length - 1; i++) {
    const [p0, m0] = metKeys[i], [p1, m1] = metKeys[i + 1];
    if (p <= p1) return m0 + (m1 - m0) * clamp((p - p0) / Math.max(1e-4, p1 - p0), 0, 1);
  }
  return metKeys[metKeys.length - 1][1];
}
function pAt(met) {
  for (let i = 0; i < metKeys.length - 1; i++) {
    const [p0, m0] = metKeys[i], [p1, m1] = metKeys[i + 1];
    if (met <= m1) return p0 + (p1 - p0) * clamp((met - m0) / Math.max(1e-4, m1 - m0), 0, 1);
  }
  return 1;
}

let scrollP = 0;
let shownP = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollP = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  updateActiveChapter(scrollP);
  if (prefersReducedMotion) requestStill();
}
window.addEventListener('scroll', readScroll, { passive: true });

// One card at a time: the chapter whose key point is nearest the scroll position.
let activeChapter = -1;
function updateActiveChapter(p) {
  let best = 0, bestD = Infinity;
  metKeys.forEach(([kp], i) => { const d = Math.abs(p - kp); if (d < bestD) { bestD = d; best = i; } });
  if (best === activeChapter) return;
  activeChapter = best;
  chapters.forEach((c, i) => c.classList.toggle('in-view', i === best));
}

/* telemetry + timeline */
const $ = (id) => document.getElementById(id);
const telMet = $('tel-met'), telAlt = $('tel-alt'), telVel = $('tel-vel'), telPhase = $('tel-phase');
const timelineFill = $('timeline-fill');
const timelineEvents = [...document.querySelectorAll('#timeline-events li')];
const whiteout = document.querySelector('.whiteout');
function placeTimeline() {
  timelineEvents.forEach((li) => { li.style.left = `${(pAt(Number(li.dataset.met)) * 100).toFixed(2)}%`; });
}
const PHASES = [[-1, 'PRE-LAUNCH'], [12, 'LIFTOFF'], [55, 'ASCENT'], [90, 'MAX-Q'], [150, 'STAGE 1 BURN'], [162, 'STAGING'], [185, 'STAGE 2 BURN'], [215, 'KÁRMÁN LINE'], [500, 'STAGE 2 BURN'], [1e9, 'ORBIT']];
function fmtMet(s) {
  const sign = s < 0 ? '−' : '+';
  const a = Math.abs(Math.round(s));
  return `T${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------
   Frame
------------------------------------------------------------------ */
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const tmp = new THREE.Vector3();
const upperCentre = new THREE.Vector3(0, 6.2, 0);
const HAZE_DAWN = new THREE.Color(0.78, 0.5, 0.36);
const HAZE_HIGH = new THREE.Color(0.22, 0.36, 0.72);

// camera offsets from the look target, keyed by MET: [met, x, y, z, lookYOffset]
const CAM = [
  [-20, 15, -0.5, 33, 1.5],
  [2, 12, 0.8, 23, -5.0],          // low on the pad: engines, flame and deluge steam in frame
  [20, 11, -1.5, 22, -2.2],
  [45, 9, 0, 22, 0],
  [72, 6.5, 1.5, 15.5, 1.2],
  [150, 9, 2, 19, 0.5],
  [170, 15, 4, 28, -1],
  [192, 12, 6, 27, -1.5],
  [400, -3, 4.5, 21, -1.2],
  [520, -9, 3.6, 19, -1.6],
];
function sampleCam(met) {
  let a = CAM[0], b = CAM[CAM.length - 1];
  for (let i = 0; i < CAM.length - 1; i++) if (met >= CAM[i][0] && met <= CAM[i + 1][0]) { a = CAM[i]; b = CAM[i + 1]; break; }
  if (met < CAM[0][0]) b = a;
  const f = smooth(clamp((met - a[0]) / Math.max(1e-3, b[0] - a[0]), 0, 1));
  camPos.set(lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f));
  return lerp(a[4], b[4], f);
}

function rumble(t, amount) {
  if (amount <= 0) return [0, 0, 0];
  const n = (f, ph) => Math.sin(t * f + ph) * 0.5 + Math.sin(t * f * 1.73 + ph * 2.1) * 0.3 + Math.sin(t * f * 2.91 + ph * 0.7) * 0.2;
  return [n(31, 0.3) * amount, n(27, 1.9) * amount, n(9, 4.1) * amount * 0.04];
}

let lastTrailMet = -999;
let trailIdx = 0;
let frame = 0;

function composeFrame(t, dt, still) {
  if (still) shownP = scrollP;
  else shownP += (scrollP - shownP) * (1 - Math.exp(-dt * 3.2));
  const met = metAt(shownP);
  const alt = table(ALT_KM, met);
  const vel = table(VEL_MS, met);

  /* engines */
  const power1 = sstep(-3.2, 1.2, met) * (1 - sstep(149, 154, met));
  const power2 = sstep(159, 163, met) * (1 - sstep(496, 504, met));   // SECO before the orbit chapter
  const vac = sstep(8, 60, alt);
  const flick = still ? 1 : 0.9 + 0.1 * Math.sin(t * 40) * Math.sin(t * 23);
  plumeU1.uTime.value = plumeU2.uTime.value = still ? 1.3 : t;
  plumeU1.uPower.value = power1 * flick;
  plumeU1.uVac.value = vac * 0.85;
  plumeU1.uLen.value = lerp(15, 34, vac);
  plumeU1.uRadius.value = lerp(0.48, 0.62, vac);
  plumeU2.uPower.value = power2;
  plumeU2.uLen.value = 26;
  plume1.visible = power1 > 0.002;
  plume2.visible = power2 > 0.002;
  flameLight.intensity = power1 * lerp(320, 60, sstep(0.2, 2, alt)) * flick;
  rocket.userData.nozzleMetal.emissiveIntensity = power2 * 0.35;
  rocket.userData.bells.forEach((b) => {
    b.m.emissiveIntensity = sstep(b.at, b.at + 0.35, met) * (1 - sstep(149, 154, met)) * 1.4;
  });

  /* the world falls away */
  const hVis = Math.min(alt, 30) * KM;
  world.position.y = -hVis;
  const lowWorld = 1 - sstep(16, 30, alt);
  world.visible = lowWorld > 0.001;
  groundU.uFade.value = lowWorld;
  deckU.uFade.value = lowWorld;
  deckU.uAbove.value = hVis > DECK_Y - 2 ? 1 : 0;
  deckU.uTime.value = still ? 0 : t;
  const arm = world.userData.tower.userData.arm;
  arm.rotation.y = sstep(-18, -8, met) * 1.2;          // crew access arm swings away before launch

  /* sky, light, haze */
  const space = sstep(3, 90, alt);
  // dawn on the pad, a high sun over the blue planet, then night and an orbital sunrise
  sunDir.copy(DAWN_SUN).lerp(DAY_SUN, sstep(20, 110, alt)).lerp(ORBIT_SUN, sstep(230, 380, alt)).normalize();
  // orbital sunrise: the sun climbs over the limb through the final chapter
  sunDir.y += lerp(-0.02, 0.12, sstep(380, 520, met)) * sstep(300, 380, alt);
  sunDir.normalize();
  skyU.uAlt.value = space;
  stars.material.uniforms.uOpacity.value = sstep(0.45, 0.85, space);
  groundU.uHaze.value.copy(HAZE_DAWN).lerp(HAZE_HIGH, sstep(1, 12, alt));
  skyU.uHaze.value.copy(groundU.uHaze.value);
  sunLight.color.setRGB(1, lerp(0.82, 0.97, space), lerp(0.65, 0.93, space));
  sunLight.intensity = lerp(3.0, 3.8, space);
  hemi.intensity = lerp(0.55, 0.12, space);
  scene.environmentIntensity = lerp(0.35, 0.12, space);
  sunSprite.position.copy(sunDir).multiplyScalar(30000);
  sunSprite.material.opacity = lerp(0.85, 1, space);

  /* Earth from orbit */
  const earthIn = sstep(20, 45, alt);
  earth.visible = clouds.visible = atmo.visible = earthIn > 0.001;
  const dSurf = lerp(18, 60, sstep(30, 400, alt));
  earth.position.set(0, -EARTH_R - dSurf, -200);
  clouds.position.copy(earth.position);
  atmo.position.copy(earth.position);
  earthU.uFade.value = earthIn;
  earthU.uTime.value = still ? 0 : t;
  earth.rotation.y = met * 0.0016;
  clouds.rotation.y = met * 0.0018;

  /* vehicle attitude and staging */
  const pitch = sstep(14, 420, met) * 1.2;
  rocket.rotation.set(0, sstep(6, 22, met) * Math.PI * 0.5, -pitch);
  const sep = met - 156;
  if (sep > 0) {
    stage1.position.y = -(sep * 0.55 + sep * sep * 0.05);
    stage1.position.x = -sep * 0.1;
    stage1.rotation.z = sep * 0.03 + sep * sep * 0.0016;
    stage1.rotation.x = sep * 0.012;
    rocket.userData.fins.forEach((f) => { f.rotation.z = -sstep(2, 6, sep) * Math.PI / 2; });
  } else {
    stage1.position.set(0, 0, 0);
    stage1.rotation.set(0, 0, 0);
    rocket.userData.fins.forEach((f) => { f.rotation.z = 0; });
  }
  stage1.visible = sep < 40;
  // cold-gas puffs at the interstage as the stages part
  coldGas.forEach((g, i) => {
    const k = sep > 0 && sep < 3.5 && !still ? sep / 3.5 : (still && sep > 0 && sep < 3.5 ? 0.3 : -1);
    g.visible = k >= 0;
    if (!g.visible) return;
    const a = i / coldGas.length * Math.PI * 2;
    const r = 0.7 + k * 3.2;
    tmp.set(Math.cos(a) * r, 3.9 - k * 0.6, Math.sin(a) * r);
    g.position.copy(tmp);
    g.scale.setScalar(0.6 + k * 2.6);
    g.material.opacity = (1 - k) * 0.7;
  });
  const lesOut = met - 178;
  les.position.set(lesOut > 0 ? lesOut * 0.15 : 0, lesOut > 0 ? lesOut * 1.6 + lesOut * lesOut * 0.6 : 0, 0);
  les.visible = lesOut < 20;
  lesFlame.visible = lesOut > 0 && lesOut < 2.2;
  lesFlame.material.opacity = lesFlame.visible ? (1 - lesOut / 2.2) : 0;
  // weightless drift once in orbit
  rocket.position.y = still ? 0 : Math.sin(t * 0.6) * 0.15 * sstep(504, 520, met);

  /* vapour cone, shake, speed streaks */
  const maxQ = bell(met, 72, 13);
  vaporU.uAmount.value = maxQ;
  vaporU.uTime.value = still ? 1.1 : t;
  vapor.visible = maxQ > 0.02;
  const punch = bell(hVis, DECK_Y, 26);
  whiteout.style.opacity = (punch * (still ? 0.3 : 0.75)).toFixed(3);   // a still parked in the cloud stays readable
  const shakeAmt = still ? 0 : (bell(met, 2, 9) * 0.1 + punch * 0.22 + maxQ * 0.28 + bell(met, 157, 2.5) * 0.25) * (isCoarse ? 0.6 : 1);

  const streakA = sstep(15, 40, met) * (1 - sstep(16, 30, alt)) * (still ? 0 : 1);   // only where there is air
  streaks.visible = streakA > 0.01;
  if (streaks.visible) {
    const pos = streaks.geometry.attributes.position.array;
    const sd = streaks.userData.seed;
    const len = 2 + vel * 0.006;
    for (let i = 0; i < sd.length / 3; i++) {
      const y = ((sd[i * 3 + 1] - t * (40 + vel * 0.08)) % 60 + 60) % 60 - 30;
      pos[i * 6] = sd[i * 3]; pos[i * 6 + 1] = y; pos[i * 6 + 2] = sd[i * 3 + 2];
      pos[i * 6 + 3] = sd[i * 3]; pos[i * 6 + 4] = y + len; pos[i * 6 + 5] = sd[i * 3 + 2];
    }
    streaks.geometry.attributes.position.needsUpdate = true;
    streaks.material.opacity = streakA * 0.35;
    streaks.rotation.z = -pitch;
  }

  /* steam from the trench, smoke trail, cumulus */
  const steamK = sstep(-4, 0, met) * (1 - sstep(25, 45, met));
  const tt = still ? 6 : t;
  steam.forEach((s, i) => {
    const u = s.userData;
    const life = (tt * 0.12 + u.seed) % 1;
    const out = 5 + Math.pow(life, 0.7) * (26 + u.seed * 34) * (0.6 + 0.4 * sstep(-2, 6, met));
    s.position.set(u.side * out, -5.4 + Math.pow(life, 1.6) * (3 + u.rise * 10), u.spread * (2.5 + life * 14));
    const sc = (2.2 + life * 13) * u.size;
    s.scale.set(sc * 1.2, sc, 1);
    s.material.opacity = steamK * Math.sin(Math.min(1, life * 1.6) * Math.PI * 0.5) * (1 - life) * 0.85;
    const warm = power1 * Math.max(0, 1 - out / 26) * (1 - life);
    s.material.color.setRGB(1, 1 - warm * 0.4, 1 - warm * 0.7).multiplyScalar(u.tone * lerp(0.72, 1.0, life));
    s.visible = s.material.opacity > 0.005;
  });
  // lay trail puffs in the air as we climb (in world space, so they fall behind)
  if (!still && power1 > 0.5 && alt < 26 && met - lastTrailMet > 0.6) {
    lastTrailMet = met;
    const s = trail[trailIdx++ % trail.length];
    tmp.set(0, -9, 0).applyEuler(rocket.rotation);
    s.userData.born = met;
    s.position.set(tmp.x + (Math.random() - 0.5), tmp.y + hVis, tmp.z + (Math.random() - 0.5));
  }
  trail.forEach((s) => {
    const age = met - s.userData.born;
    const alive = s.userData.born > -900 && age >= 0 && age < 70;
    s.visible = alive && !still;
    if (!s.visible) return;
    const sc = 3 + age * 1.2;
    s.scale.set(sc, sc, 1);
    s.material.opacity = (1 - age / 70) * 0.5 * lowWorld;
  });
  cumulus.forEach((s) => { s.material.opacity = 0.9 * lowWorld * (deckU.uAbove.value ? 0.85 : 1); });

  /* camera: offsets from the active vehicle, plus rumble */
  const lookY = sampleCam(met);
  const target = tmp.copy(sep > 2 ? upperCentre : new THREE.Vector3(0, 1.5, 0));
  rocket.updateMatrixWorld();
  camLook.copy(target);
  rocket.localToWorld(camLook);
  camLook.y += lookY;
  if (met > 150) camLook.lerp(rocket.localToWorld(upperCentre.clone()), sstep(150, 165, met));
  camera.position.copy(camLook).addScaledVector(camPos, view.pull);
  const [rx, ry, rr] = rumble(t, shakeAmt);
  camera.position.x += rx;
  camera.position.y += ry;
  camera.lookAt(camLook);
  camera.rotation.z += rr;
  sunLight.target.position.copy(camLook);
  sunLight.position.copy(camLook).addScaledVector(sunDir, 80);

  /* HUD */
  if (frame % 3 === 0 || still) {
    telMet.textContent = fmtMet(met);
    telAlt.textContent = alt < 100 ? `${alt.toFixed(1)} km` : `${alt.toFixed(0)} km`;
    telVel.textContent = `${Math.round(vel).toLocaleString('en-US')} m/s`;
    telPhase.textContent = PHASES.find(([m]) => met < m)[1];
    timelineFill.style.transform = `scaleX(${shownP.toFixed(4)})`;
    timelineEvents.forEach((li) => li.classList.toggle('is-past', met >= Number(li.dataset.met) - 0.5));
  }
  document.body.classList.toggle('is-space', space > 0.55);
  frame++;

  if (composer) composer.render();
  else renderer.render(scene, camera);
}

const clock = new THREE.Clock();
let elapsed = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  composeFrame(elapsed, dt, false);
  requestAnimationFrame(tick);
}

// Reduced motion: scroll still flies the profile, as a sequence of stills.
let stillQueued = false;
function requestStill() {
  if (!scene || stillQueued) return;
  stillQueued = true;
  requestAnimationFrame(() => { stillQueued = false; composeFrame(0, 0, true); });
}

if (renderer) {
  initScene();
  readScroll();
  window.addEventListener('resize', () => { resize(); if (prefersReducedMotion) requestStill(); });
  window.addEventListener('load', () => { measureChapters(); readScroll(); });
  if (prefersReducedMotion) requestStill();
  else tick();
} else {
  document.documentElement.classList.add('no-webgl');
  measureChapters();
  readScroll();
}
