import * as THREE from 'three';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;

/* ------------------------------------------------------------------
   A launch profile flown by scroll: pad → ignition → max-Q →
   Kármán line → orbit. The rocket stays near the origin; the world
   (pad, clouds, sky, Earth) moves around it.
------------------------------------------------------------------ */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmallScreen });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 4000);

/* ---------------- sky dome: blue → space by altitude ------------- */
const skyUniforms = {
  uSpace: { value: 0 },       // 0 = ground sky, 1 = vacuum
  uSunset: { value: 0.15 },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1800, 32, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uSpace;
      uniform float uSunset;
      varying vec3 vDir;
      void main() {
        float up = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizon = mix(vec3(0.72, 0.82, 0.95), vec3(0.98, 0.62, 0.38), uSunset);
        vec3 zenith = vec3(0.16, 0.38, 0.78);
        vec3 skyCol = mix(horizon, zenith, pow(up, 0.75));
        vec3 space = vec3(0.012, 0.016, 0.035);
        vec3 col = mix(skyCol, space, uSpace);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
);
scene.add(sky);

/* ---------------- stars (fade in past the Kármán line) ----------- */
const STAR_COUNT = isSmallScreen ? 900 : 2200;
const starPos = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  const v = new THREE.Vector3().randomDirection().multiplyScalar(1500);
  starPos.set([v.x, Math.abs(v.y) * (Math.random() > 0.3 ? 1 : -0.4), v.z], i * 3);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
scene.add(new THREE.Points(starGeo, starMat));

/* ---------------- lighting --------------------------------------- */
const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
sun.position.set(60, 80, 40);
scene.add(sun);
scene.add(new THREE.AmbientLight(0x8899cc, 0.55));
const flameLight = new THREE.PointLight(0xff7a3c, 0, 60, 2);
flameLight.position.set(0, -3.4, 0);
scene.add(flameLight);

/* ---------------- the vehicle ------------------------------------ */
const rocket = new THREE.Group();
scene.add(rocket);

const hull = new THREE.MeshStandardMaterial({ color: 0xe8eaf0, roughness: 0.35, metalness: 0.25 });
const dark = new THREE.MeshStandardMaterial({ color: 0x22262f, roughness: 0.5, metalness: 0.4 });
const accent = new THREE.MeshStandardMaterial({ color: 0xff7a3c, roughness: 0.5 });

const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 32), hull);
rocket.add(body);
const interstage = new THREE.Mesh(new THREE.CylinderGeometry(0.505, 0.505, 0.35, 32), dark);
interstage.position.y = 0.8;
rocket.add(interstage);
const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 32), hull);
nose.position.y = 3.8;
rocket.add(nose);
const band = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.18, 32), accent);
band.position.y = 2.6;
rocket.add(band);
const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.6, 24, 1, true), dark);
bell.position.y = -3.2;
rocket.add(bell);
for (let i = 0; i < 4; i++) {
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.7), dark);
  const a = (i / 4) * Math.PI * 2;
  fin.position.set(Math.cos(a) * 0.62, -2.6, Math.sin(a) * 0.62);
  fin.rotation.y = -a;
  rocket.add(fin);
}

/* ---------------- exhaust flame (shader cone) --------------------- */
const flameUniforms = { uTime: { value: 0 }, uPower: { value: 0 } };
const flame = new THREE.Mesh(
  new THREE.ConeGeometry(0.34, 4.4, 24, 10, true),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: flameUniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uPower;
      varying float vY;
      void main() {
        vY = uv.y; // 0 at engine (cone base, flipped up), 1 at tail tip
        vec3 p = position;
        float flicker = sin(uTime * 30.0 + position.y * 6.0) * 0.5 + sin(uTime * 47.0) * 0.5;
        p.x *= 1.0 + flicker * 0.14 * vY;
        p.z *= 1.0 + flicker * 0.14 * vY;
        p.y *= 0.25 + uPower * (0.9 + flicker * 0.08);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uPower;
      varying float vY;
      void main() {
        vec3 core = vec3(1.0, 0.92, 0.7);
        vec3 mid = vec3(1.0, 0.48, 0.18);
        vec3 edge = vec3(0.6, 0.15, 0.4);
        vec3 col = mix(core, mid, vY);
        col = mix(col, edge, pow(vY, 2.2));
        float alpha = (1.0 - vY) * uPower;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  })
);
flame.rotation.x = Math.PI;
flame.position.y = -5.6;
rocket.add(flame);

/* ---------------- pad + ground ----------------------------------- */
const world = new THREE.Group(); // slides down as we ascend
scene.add(world);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(220, 48),
  new THREE.MeshStandardMaterial({ color: 0x5c6650, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -4.1;
world.add(ground);

const padDeck = new THREE.Mesh(
  new THREE.CylinderGeometry(4.2, 4.6, 0.5, 8),
  new THREE.MeshStandardMaterial({ color: 0x777d88, roughness: 0.85 })
);
padDeck.position.y = -4;
world.add(padDeck);

const tower = new THREE.Group();
const towerMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.7, metalness: 0.3 });
for (let s = 0; s < 9; s++) {
  const seg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 1.1), towerMat);
  seg.position.y = -3.2 + s * 1.25;
  const strut = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.3), towerMat);
  strut.position.y = seg.position.y + 0.6;
  tower.add(seg, strut);
}
tower.position.set(-3.4, 0, -1.5);
world.add(tower);

/* ---------------- clouds (canvas-sprite puffs) -------------------- */
function makePuffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const puffTex = makePuffTexture();

const cloudGroup = new THREE.Group();
scene.add(cloudGroup);
const CLOUDS = isSmallScreen ? 10 : 22;
const cloudSprites = [];
for (let i = 0; i < CLOUDS; i++) {
  const mat = new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0.85, depthWrite: false });
  const s = new THREE.Sprite(mat);
  const scale = 14 + Math.random() * 26;
  s.scale.set(scale, scale * 0.5, 1);
  s.position.set((Math.random() - 0.5) * 90, 0, -20 - Math.random() * 60);
  s.userData.band = Math.random(); // where in the ascent it lives
  cloudGroup.add(s);
  cloudSprites.push(s);
}

/* ---------------- launch smoke ------------------------------------ */
const SMOKE = isSmallScreen ? 18 : 40;
const smokeSprites = [];
for (let i = 0; i < SMOKE; i++) {
  const mat = new THREE.SpriteMaterial({ map: puffTex, color: 0xcfd3d9, transparent: true, opacity: 0, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.userData.angle = Math.random() * Math.PI * 2;
  s.userData.speed = 2 + Math.random() * 5;
  s.userData.rise = Math.random() * 1.5;
  world.add(s);
  smokeSprites.push(s);
}

/* ---------------- Earth + atmosphere rim -------------------------- */
const earthUniforms = { uTime: { value: 0 } };
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(300, 64, 48),
  new THREE.ShaderMaterial({
    uniforms: earthUniforms,
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPos;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }

      void main() {
        vec2 uv = vec2(atan(vPos.z, vPos.x) * 3.0, vPos.y * 0.02 + uTime * 0.004);
        float land = fbm(uv * 1.6);
        vec3 ocean = vec3(0.05, 0.22, 0.45);
        vec3 landCol = vec3(0.18, 0.32, 0.16);
        vec3 desert = vec3(0.55, 0.45, 0.28);
        vec3 surf = mix(ocean, mix(landCol, desert, noise(uv * 4.0)), smoothstep(0.52, 0.62, land));
        float clouds = smoothstep(0.55, 0.75, fbm(uv * 2.3 + 40.0));
        surf = mix(surf, vec3(0.95), clouds * 0.85);
        float light = clamp(dot(vNormal, normalize(vec3(0.5, 0.7, 0.4))), 0.04, 1.0);
        gl_FragColor = vec4(surf * light, 1.0);
      }
    `,
  })
);
earth.position.y = -1200;
scene.add(earth);

const atmo = new THREE.Mesh(
  new THREE.SphereGeometry(306, 64, 48),
  new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vNormal;
      void main() {
        float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, -1.0))), 3.5);
        gl_FragColor = vec4(vec3(0.35, 0.65, 1.0), rim * 0.9);
      }
    `,
  })
);
atmo.position.copy(earth.position);
scene.add(atmo);

/* ------------------------------------------------------------------
   Scroll → mission time
------------------------------------------------------------------ */
let scrollProgress = 0;
let p = 0; // smoothed

function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

const chapters = document.querySelectorAll('.chapter');
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in-view'); });
}, { threshold: 0.3 });
chapters.forEach((c) => io.observe(c));

/* camera keyframes: [p, camX, camY, camZ, lookX, lookY, lookZ] */
const CAM_KEYS = [
  [0.00, 7, 1.5, 15, 0, 2.5, 0],
  [0.12, 4, -2.5, 9, 0, -2.8, 0],
  [0.28, 8, 0.5, 13, 0, 1, 0],
  [0.50, 10, 3, 17, 0, 0, 0],
  [0.75, 11, 5, 21, 0, -1.5, 0],
  [1.00, 6, 9, 26, 0, -3, 0],
];
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
function sampleCamera(t) {
  let a = CAM_KEYS[0], b = CAM_KEYS[CAM_KEYS.length - 1];
  for (let i = 0; i < CAM_KEYS.length - 1; i++) {
    if (t >= CAM_KEYS[i][0] && t <= CAM_KEYS[i + 1][0]) { a = CAM_KEYS[i]; b = CAM_KEYS[i + 1]; break; }
  }
  const span = b[0] - a[0] || 1;
  let f = (t - a[0]) / span;
  f = f * f * (3 - 2 * f);
  camPos.set(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f);
  camLook.set(a[4] + (b[4] - a[4]) * f, a[5] + (b[5] - a[5]) * f, a[6] + (b[6] - a[6]) * f);
}

/* telemetry */
const telAlt = document.getElementById('tel-alt');
const telVel = document.getElementById('tel-vel');
const telPhase = document.getElementById('tel-phase');
const PHASES = [
  [0.02, 'PRE-LAUNCH'], [0.14, 'IGNITION'], [0.30, 'MAX-Q'],
  [0.52, 'STAGE 1 BURN'], [0.68, 'KÁRMÁN LINE'], [0.86, 'MECO'], [1.01, 'ORBIT'],
];

const smooth = (a, b, x) => THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);

const clock = new THREE.Clock();
let frame = 0;

function composeFrame(t) {
  p += (scrollProgress - p) * 0.06;

  const ignition = smooth(0.08, 0.16, p);   // engines light
  const ascent = Math.pow(smooth(0.12, 1.0, p), 1.6); // altitude curve
  const spaceness = smooth(0.45, 0.72, p);  // sky → vacuum
  const orbitPhase = smooth(0.72, 0.95, p); // MECO and float
  const shake = (smooth(0.16, 0.3, p) - smooth(0.34, 0.5, p)) * 0.22 // max-Q window
              + ignition * (1 - smooth(0.3, 0.45, p)) * 0.06;

  /* world slides down: pad falls away fast */
  world.position.y = -ascent * 620;

  /* clouds: each lives in an altitude band and streaks past */
  cloudSprites.forEach((s) => {
    const bandY = 40 + s.userData.band * 480;
    s.position.y = bandY - ascent * 620;
    s.material.opacity = 0.85 * (1 - spaceness);
  });

  /* launch smoke at the pad */
  const smokeLife = ignition * (1 - smooth(0.28, 0.42, p));
  smokeSprites.forEach((s, i) => {
    const life = (t * 0.35 + i / SMOKE) % 1;
    const r = 1.2 + life * s.userData.speed * 2.2;
    s.position.set(Math.cos(s.userData.angle) * r, -3.6 + life * s.userData.rise * 2.5, Math.sin(s.userData.angle) * r);
    const sc = 2 + life * 7;
    s.scale.set(sc, sc, 1);
    s.material.opacity = smokeLife * (1 - life) * 0.75;
  });

  /* flame */
  const power = ignition * (1 - orbitPhase);
  flameUniforms.uTime.value = t;
  flameUniforms.uPower.value = power;
  flameLight.intensity = power * 60;

  /* sky, stars, sun — horizon warms as the air thins */
  skyUniforms.uSpace.value = spaceness;
  skyUniforms.uSunset.value = 0.15 + smooth(0.3, 0.6, p) * 0.45;
  starMat.opacity = spaceness;
  sun.intensity = 2.2 - spaceness * 0.6;

  /* Earth rises into view for the orbit act */
  const earthY = THREE.MathUtils.lerp(-1200, -318, smooth(0.5, 0.88, p));
  earth.position.y = earthY;
  atmo.position.y = earthY;
  earthUniforms.uTime.value = t;
  earth.rotation.y = t * 0.008 + p * 0.6;

  /* gravity turn: pitch over once high, slow roll program on the way */
  rocket.rotation.z = -orbitPhase * Math.PI * 0.42 + (Math.random() - 0.5) * shake * 0.08;
  rocket.rotation.y = smooth(0.2, 0.7, p) * Math.PI * 0.5;
  rocket.position.y = Math.sin(t * 0.8) * 0.12 * orbitPhase; // weightless drift
  rocket.position.x = orbitPhase * 2.5 + (Math.random() - 0.5) * shake * 0.3;

  /* camera + shake */
  sampleCamera(p);
  camera.position.copy(camPos);
  if (shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  camera.lookAt(camLook);

  /* telemetry (throttled) */
  if (frame % 5 === 0) {
    const altKm = ascent * 400;
    telAlt.textContent = altKm < 100 ? `${altKm.toFixed(1)} km` : `${altKm.toFixed(0)} km`;
    telVel.textContent = `${Math.round(Math.pow(p, 1.4) * 7660)} m/s`;
    for (const [limit, name] of PHASES) {
      if (p <= limit) { telPhase.textContent = name; break; }
    }
  }
  frame++;

  renderer.render(scene, camera);
}

function tick() {
  composeFrame(clock.getElapsedTime());
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (prefersReducedMotion) renderReduced();
});

/* Reduced motion: hold the orbit tableau as a still image. */
function renderReduced() {
  p = 1;
  scrollProgress = 1;
  composeFrame(2);
  telPhase.textContent = 'ORBIT';
}

if (prefersReducedMotion) {
  renderReduced();
} else {
  tick();
}
