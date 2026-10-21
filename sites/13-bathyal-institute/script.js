import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ============================================================
   BATHYAL — one continuous dive
   The scrollbar is a winch. Scroll maps to a station index, so
   the depth on the gauge always matches the station you read.
   Sunlight dies on schedule; below it the pointer aims the
   submersible's floodlight and the animals answer with light.
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
// phones and portrait tablets share one stacked layout (mirrors the CSS query)
const smallMQ = window.matchMedia('(max-width: 760px), (max-width: 1099px) and (max-aspect-ratio: 10/11)');
const isSmall = () => smallMQ.matches;
const HIGH = !(isSmall() || coarse || (navigator.hardwareConcurrency || 8) <= 4);
const T_STILL = 37.0;   // reduced motion freezes every animal in a formed pose

const $ = (s) => document.querySelector(s);
const hud = {
  depth: $('#hud-depth'), zone: $('#hud-zone'), press: $('#hud-press'), temp: $('#hud-temp'), light: $('#hud-light'),
  mark: $('#gauge-mark'), cue: $('#start-cue'), aim: $('#aim-hint'), lamp: $('#lamp'), log: $('#log'),
};

/* ============================================================
   Scroll → station index → depth
   ============================================================ */

const stations = [...document.querySelectorAll('.station')];
const DEPTHS = stations.map((s) => +s.dataset.depth);
const N = stations.length;
let centers = [];
function measureStations() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  centers = stations.map((s, i) => {
    const r = s.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const c = top + r.height / 2 - window.innerHeight / 2;
    return i === 0 ? 0 : Math.min(c, maxScroll);
  });
}
function scrollToU(y) {
  if (y <= centers[0]) return 0;
  for (let i = 0; i < N - 1; i++) {
    if (y < centers[i + 1]) return i + (y - centers[i]) / Math.max(1, centers[i + 1] - centers[i]);
  }
  return N - 1;
}
function depthAt(u) {
  const i = Math.min(N - 2, Math.floor(u));
  const f = THREE.MathUtils.clamp(u - i, 0, 1);
  return DEPTHS[i] + (DEPTHS[i + 1] - DEPTHS[i]) * f;
}
let uGoal = 0, uNow = 0;
const readScroll = () => { uGoal = scrollToU(window.scrollY); };

/* ---------- water ---------- */

const RAMP = [
  [0, [26, 112, 150]], [180, [14, 78, 118]], [450, [8, 52, 86]], [900, [4, 28, 50]],
  [1600, [2, 14, 28]], [3000, [1, 7, 15]], [6000, [1, 4, 9]],
];
function waterRGB(d) {
  let i = 0;
  while (i < RAMP.length - 2 && RAMP[i + 1][0] < d) i++;
  const [d0, c0] = RAMP[i], [d1, c1] = RAMP[i + 1];
  const t = THREE.MathUtils.clamp((d - d0) / (d1 - d0), 0, 1);
  return c0.map((v, k) => v + (c1[k] - v) * t);
}
const sunlight = (d) => Math.exp(-d / 210);

/* ---------- station + HUD text ---------- */

function zoneName(d) {
  if (d < 200) return 'Epipelagic · sunlit';
  if (d < 1000) return 'Mesopelagic · twilight';
  if (d < 4000) return 'Bathypelagic · midnight';
  return 'Abyssopelagic · abyss';
}
const LOG = [
  [0.82, 'Bait ball', '150 m'], [1.82, 'Crown jellies', '700 m'], [2.82, 'Siphonophore', '1,600 m'],
  [3.82, 'Black seadevil', '3,000 m'], [4.82, 'Giant squid', '4,500 m'], [5.82, 'Vent field', '6,000 m'],
];
let logged = 0;
function updateHud(d, u, lampActive) {
  hud.depth.textContent = Math.round(d).toLocaleString('en-US');
  hud.zone.textContent = zoneName(d);
  hud.press.textContent = `${Math.round(1 + d / 10).toLocaleString('en-US')} atm`;
  hud.temp.textContent = `${(2 + 19 * Math.exp(-d / 480)).toFixed(1)} °C`;
  const sun = sunlight(d);
  hud.light.textContent = sun > 0.005 ? `${Math.round(sun * 100)}%` : 'none';
  const f = d / 6000;
  hud.mark.style.top = `${(f * 100).toFixed(2)}%`;
  hud.mark.style.setProperty('--fill', `${(f * hud.mark.parentElement.clientHeight).toFixed(0)}px`);
  hud.cue.style.opacity = d > 30 ? '0' : '1';
  hud.lamp.classList.toggle('is-idle', !lampActive && lampOn);
  while (logged < LOG.length && u >= LOG[logged][0]) {
    const [, name, depth] = LOG[logged++];
    const li = document.createElement('li');
    li.innerHTML = `${name}<span>${depth}</span>`;
    hud.log.appendChild(li);
    while (hud.log.children.length > 4) hud.log.firstElementChild.remove();
  }
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) e.target.classList.add('lit');
}, { threshold: 0.25 });
stations.forEach((s) => io.observe(s));

/* ---------- floodlight switch ---------- */

let lampOn = true;
hud.lamp.addEventListener('click', () => {
  lampOn = !lampOn;
  hud.lamp.setAttribute('aria-pressed', String(lampOn));
  hud.lamp.querySelector('b').textContent = lampOn ? 'on' : 'off';
});

/* ============================================================
   Renderer (or the no-WebGL fallback)
   ============================================================ */

const canvas = $('#ocean');
let renderer = null;
const probe = document.createElement('canvas');
if (probe.getContext('webgl2') || probe.getContext('webgl')) {
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !HIGH, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
}

if (!renderer) {
  document.documentElement.classList.add('no-webgl');
  const paint = () => {
    measureStations();
    readScroll();
    const d = depthAt(uGoal);
    const [r, g, b] = waterRGB(d);
    document.body.style.backgroundColor = `rgb(${r | 0},${g | 0},${b | 0})`;
    updateHud(d, uGoal, false);
  };
  window.addEventListener('scroll', paint, { passive: true });
  window.addEventListener('resize', paint);
  paint();
} else {
  startOcean();
}

/* ============================================================
   The ocean
   ============================================================ */

function startOcean() {
  const SPACING = 34;
  const stationY = (i) => -i * SPACING;
  let FOCUS_X = isSmall() ? 0 : 3.4;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HIGH ? 1.75 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color();
  scene.fog = new THREE.FogExp2(0x0a3a55, 0.03);
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 160);
  camera.position.set(0, 0, 15);
  scene.add(camera);

  const U = {
    time: { value: reduceMotion ? T_STILL : 0 },
    fog: { value: 0.03 },
    beamPos: { value: new THREE.Vector3() },
    beamDir: { value: new THREE.Vector3(0, 0, -1) },
    beamCos: { value: Math.cos(0.42) },
    beamOn: { value: 0 },
    sun: { value: 1 },
  };

  /* ---------- background: water column, rays, the surface ---------- */

  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bgMat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Vector3() }, uBottom: { value: new THREE.Vector3() },
      uSun: U.sun, uTime: U.time, uSurface: { value: 1 }, uAspect: { value: 1 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      uniform vec3 uTop; uniform vec3 uBottom; uniform float uSun; uniform float uTime; uniform float uSurface; uniform float uAspect;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, uv.y));
        // soft god rays fanning from a sun above the frame
        vec2 p = vec2((uv.x - 0.5) * uAspect - 0.25, uv.y - 1.6);
        float a = atan(p.x, -p.y);
        float r = 0.0;
        r += pow(0.5 + 0.5 * sin(a * 23.0 + uTime * 0.21), 6.0);
        r += pow(0.5 + 0.5 * sin(a * 37.0 - uTime * 0.17 + 1.3), 8.0) * 0.8;
        r += pow(0.5 + 0.5 * sin(a * 11.0 + uTime * 0.11 + 2.1), 4.0) * 0.6;
        r *= smoothstep(-0.1, 0.9, uv.y) * (0.65 + 0.35 * noise(vec2(a * 6.0, uTime * 0.2)));
        col += vec3(0.55, 0.85, 1.0) * r * 0.075 * uSun;
        // Snell's window: the bright, shivering surface overhead
        float sh = noise(vec2(uv.x * 9.0 * uAspect, uv.y * 4.0 + uTime * 0.35)) * 0.6 + noise(vec2(uv.x * 23.0 * uAspect - uTime * 0.4, uv.y * 9.0)) * 0.4;
        float band = smoothstep(0.78, 1.0, uv.y);
        col += vec3(0.7, 0.92, 1.0) * band * (0.1 + 0.26 * sh) * uSurface;
        col = pow(col, vec3(2.2));   // to linear; tone mapping and output happen later
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));

  /* ---------- lights ---------- */

  const hemi = new THREE.HemisphereLight(0x9fdcf0, 0x02060c, 1.4);
  const sunLight = new THREE.DirectionalLight(0xd8f6ff, 2.4);
  sunLight.position.set(-3, 20, 6);
  scene.add(hemi, sunLight, sunLight.target);
  const flood = new THREE.SpotLight(0xfff1d6, 0, 46, 0.42, 0.55, 1.15);
  flood.position.set(0.4, -0.9, 0);
  camera.add(flood);
  const floodTarget = new THREE.Object3D();
  scene.add(floodTarget);
  flood.target = floodTarget;

  // the floodlight's haze: a short raymarch through the beam for every pixel
  const HAZE_STEPS = HIGH ? 22 : 11;
  const hazeMat = new THREE.ShaderMaterial({
    uniforms: {
      uInvProj: { value: camera.projectionMatrixInverse }, uCamWorld: { value: camera.matrixWorld },
      beamPos: U.beamPos, beamDir: U.beamDir, beamCos: U.beamCos, beamOn: U.beamOn, fog: U.fog, uDark: { value: 0 },
    },
    defines: { STEPS: HAZE_STEPS, STEP_L: (26 / HAZE_STEPS).toFixed(3) },
    vertexShader: 'varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      uniform mat4 uInvProj; uniform mat4 uCamWorld;
      uniform vec3 beamPos; uniform vec3 beamDir; uniform float beamCos; uniform float beamOn; uniform float fog; uniform float uDark;
      varying vec2 vNdc;
      void main(){
        vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0);
        vec3 rd = normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
        float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));   // interleaved gradient noise
        float acc = 0.0;
        for (int i = 0; i < STEPS; i++) {
          float t = 0.8 + (float(i) + j) * STEP_L;
          vec3 d = cameraPosition + rd * t - beamPos;
          float L = length(d);
          float c = dot(d / L, beamDir);
          acc += smoothstep(beamCos - 0.01, beamCos + 0.1, c) * exp(-L * 0.16) * exp(-fog * fog * t * t * 0.6);
        }
        acc *= STEP_L * beamOn * uDark * 0.013;
        gl_FragColor = vec4(vec3(0.82, 0.93, 1.0) * acc, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hazeMat);
  haze.frustumCulled = false;
  haze.renderOrder = 9;
  scene.add(haze);

  /* ---------- shared GLSL ---------- */

  const BEAM_GLSL = /* glsl */`
    uniform vec3 beamPos; uniform vec3 beamDir; uniform float beamCos; uniform float beamOn;
    float inBeam(vec3 p){
      vec3 d = p - beamPos; float L = length(d);
      float c = dot(d / L, beamDir);
      return beamOn * smoothstep(beamCos - 0.02, beamCos + 0.08, c) * exp(-L * 0.055);
    }`;
  const FOG_GLSL = /* glsl */`
    uniform float fog;
    float fogKeep(float dist){ return exp(-fog * fog * dist * dist); }`;

  /* ---------- marine snow, lit by the beam ---------- */

  const SNOW = HIGH ? 2600 : 900;
  const snowGeo = new THREE.BufferGeometry();
  {
    const p = new Float32Array(SNOW * 3), s = new Float32Array(SNOW);
    for (let i = 0; i < SNOW; i++) {
      p[i * 3] = (Math.random() - 0.5) * 30;
      p[i * 3 + 1] = Math.random() * 22;
      p[i * 3 + 2] = -18 + Math.random() * 30;
      s[i] = 0.5 + Math.random() * 1.6;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    snowGeo.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
  }
  const snowMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uCamY: { value: 0 }, uPx: { value: 1 } },
    vertexShader: BEAM_GLSL + FOG_GLSL + /* glsl */`
      uniform float time; uniform float uCamY; uniform float uPx; uniform float sun;
      attribute float aSize; varying float vB;
      void main(){
        vec3 p = position;
        p.y = uCamY + mod(p.y - uCamY - time * 0.12, 22.0) - 11.0;
        p.x += sin(time * 0.3 + position.z) * 0.15;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        vB = (0.18 + 0.4 * sun + inBeam(p) * 2.4 * smoothstep(2.5, 7.0, dist)) * fogKeep(dist * 0.8) * smoothstep(0.8, 3.0, dist);
        gl_PointSize = aSize * uPx * (14.0 / max(1.0, dist));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vB;
      void main(){
        vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d)) * vB;
        gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.frustumCulled = false;
  scene.add(snow);

  /* ---------- the dark between stations: things that flash ---------- */

  const BLINKS = HIGH ? 900 : 320;
  const blinkGeo = new THREE.BufferGeometry();
  {
    const p = new Float32Array(BLINKS * 3), a = new Float32Array(BLINKS * 3);
    for (let i = 0; i < BLINKS; i++) {
      p[i * 3] = (Math.random() - 0.5) * 44;
      p[i * 3 + 1] = Math.random() * 28;
      p[i * 3 + 2] = -26 + Math.random() * 32;
      a[i * 3] = Math.random() * 40;              // phase
      a[i * 3 + 1] = 2.5 + Math.random() * 9;     // period
      a[i * 3 + 2] = Math.random();               // species: blue, cyan, or a rare green
    }
    blinkGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    blinkGeo.setAttribute('aBlink', new THREE.BufferAttribute(a, 3));
  }
  const blinkMat = new THREE.ShaderMaterial({
    uniforms: { time: U.time, fog: U.fog, uCamY: { value: 0 }, uPx: { value: 1 }, uDark: { value: 0 } },
    vertexShader: FOG_GLSL + /* glsl */`
      uniform float time; uniform float uCamY; uniform float uPx; uniform float uDark;
      attribute vec3 aBlink; varying float vF; varying vec3 vC;
      void main(){
        vec3 p = position;
        p.y = uCamY + mod(p.y - uCamY + time * 0.05, 28.0) - 14.0;
        float k = mod(time + aBlink.x, aBlink.y);
        float f = smoothstep(0.0, 0.07, k) * exp(-k * 1.5);
        f += step(0.8, aBlink.z) * smoothstep(0.3, 0.37, k) * exp(-(k - 0.3) * 3.2) * 0.8;   // some answer twice
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        vF = f * uDark * fogKeep(dist * 0.7) * smoothstep(1.5, 4.0, dist);
        vC = aBlink.z < 0.55 ? vec3(0.3, 0.55, 1.0) : aBlink.z < 0.93 ? vec3(0.35, 0.95, 1.0) : vec3(0.45, 1.0, 0.55);
        gl_PointSize = uPx * (5.0 + 12.0 * f) * (13.0 / max(1.0, dist));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vF; varying vec3 vC;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = (exp(-d * d * 40.0) + exp(-d * d * 9.0) * 0.35) * vF;
        gl_FragColor = vec4(vC * a * 1.8, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const blinks = new THREE.Points(blinkGeo, blinkMat);
  blinks.frustumCulled = false;
  scene.add(blinks);

  /* ---------- creatures ---------- */

  const creatures = [];
  const rand = (() => { let s = 4242; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();

  // a verlet strand pool rendered as one additive line batch
  function strandBatch(count, pts, color, alpha) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * (pts - 1) * 6);
    const col = new Float32Array(count * (pts - 1) * 6);
    const c = new THREE.Color(color);
    for (let s = 0; s < count; s++) {
      for (let k = 0; k < pts - 1; k++) {
        const o = (s * (pts - 1) + k) * 6;
        const a0 = alpha * (1 - k / (pts - 1)), a1 = alpha * (1 - (k + 1) / (pts - 1));
        col.set([c.r * a0, c.g * a0, c.b * a0, c.r * a1, c.g * a1, c.b * a1], o);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    const P = new Float32Array(count * pts * 3), Q = new Float32Array(count * pts * 3);
    return {
      lines, mat, P, Q, count, pts,
      init(s, x, y, z, seg) { for (let k = 0; k < pts; k++) { const o = (s * pts + k) * 3; P[o] = Q[o] = x; P[o + 1] = Q[o + 1] = y - k * seg; P[o + 2] = Q[o + 2] = z; } },
      step(anchor, seg, grav, damp, dt) {
        for (let s = 0; s < count; s++) {
          const a = anchor(s);
          const o0 = s * pts * 3;
          P[o0] = a[0]; P[o0 + 1] = a[1]; P[o0 + 2] = a[2];
          for (let k = 1; k < pts; k++) {
            const o = o0 + k * 3;
            const vx = (P[o] - Q[o]) * damp, vy = (P[o + 1] - Q[o + 1]) * damp, vz = (P[o + 2] - Q[o + 2]) * damp;
            Q[o] = P[o]; Q[o + 1] = P[o + 1]; Q[o + 2] = P[o + 2];
            P[o] += vx; P[o + 1] += vy - grav * dt * dt; P[o + 2] += vz;
          }
          for (let it = 0; it < 2; it++) {
            for (let k = 1; k < pts; k++) {
              const o = o0 + k * 3, p = o - 3;
              const dx = P[o] - P[p], dy = P[o + 1] - P[p + 1], dz = P[o + 2] - P[p + 2];
              const L = Math.hypot(dx, dy, dz) || 1e-6;
              const f = (L - seg) / L;
              if (k === 1) { P[o] -= dx * f; P[o + 1] -= dy * f; P[o + 2] -= dz * f; }
              else { P[o] -= dx * f * 0.5; P[o + 1] -= dy * f * 0.5; P[o + 2] -= dz * f * 0.5; P[p] += dx * f * 0.5; P[p + 1] += dy * f * 0.5; P[p + 2] += dz * f * 0.5; }
            }
          }
        }
        const pos = geo.attributes.position.array;
        for (let s = 0; s < count; s++) {
          for (let k = 0; k < pts - 1; k++) {
            const a = (s * pts + k) * 3, o = (s * (pts - 1) + k) * 6;
            pos[o] = P[a]; pos[o + 1] = P[a + 1]; pos[o + 2] = P[a + 2];
            pos[o + 3] = P[a + 3]; pos[o + 4] = P[a + 4]; pos[o + 5] = P[a + 5];
          }
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  }

  // how much a world point sits in the floodlight (CPU twin of inBeam)
  const tmp = new THREE.Vector3();
  function beamAt(p) {
    if (U.beamOn.value <= 0) return 0;
    tmp.copy(p).sub(U.beamPos.value);
    const L = tmp.length();
    const c = tmp.dot(U.beamDir.value) / L;
    return U.beamOn.value * THREE.MathUtils.smoothstep(c, U.beamCos.value - 0.02, U.beamCos.value + 0.08) * Math.exp(-L * 0.055);
  }

  /* --- 1 · bait ball (150 m) ------------------------------------ */
  {
    const COUNT = HIGH ? 280 : 120;
    const body = new THREE.SphereGeometry(1, 14, 10);
    body.scale(0.045, 0.072, 0.21);
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.17, 0, 0.09, -0.32, 0, -0.09, -0.32], 3));
    tail.computeVertexNormals();
    const geo = mergeGeoms([body, tail]);
    const phase = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) phase[i] = rand() * 6.283;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    const mat = new THREE.MeshStandardMaterial({ color: 0xb8cad6, metalness: 0.55, roughness: 0.3, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.time = U.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float time; attribute float aPhase;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float tailW = smoothstep(0.05, -0.32, position.z);
          transformed.x += sin(time * 13.0 + aPhase + position.z * 16.0) * 0.05 * tailW;
          // counter-shading: darker back, silver flank
          `);
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.55, 1.15, smoothstep(0.6, -0.4, vNormal.y));');
    };
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    mesh.frustumCulled = false;
    const fish = Array.from({ length: COUNT }, () => {
      const e1 = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.5, rand() - 0.5).normalize();
      const e2 = new THREE.Vector3().crossVectors(e1, new THREE.Vector3(0, 1, 0)).normalize();
      if (rand() < 0.5) e2.negate();
      return { e1, e2, r: 0.9 + rand() * 2.2, w: (0.35 + rand() * 0.25) * (rand() < 0.88 ? 1 : -1), ph: rand() * 6.283, bob: rand() * 6.283 };
    });
    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);
    const m = new THREE.Matrix4(), q = new THREE.Vector3(), tg = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1);
    const qq = new THREE.Quaternion();
    creatures.push({
      y: stationY(1) + 0.4, group, range: 30,
      update(t) {
        const c = new THREE.Vector3(FOCUS_X + Math.sin(t * 0.07) * 0.8, this.y + Math.sin(t * 0.11) * 0.4, -3.2);
        for (let i = 0; i < COUNT; i++) {
          const f = fish[i];
          const th = f.ph + t * f.w;
          const r = f.r * (1 + 0.12 * Math.sin(t * 0.4 + f.bob));
          q.copy(c).addScaledVector(f.e1, Math.cos(th) * r).addScaledVector(f.e2, Math.sin(th) * r);
          q.y += Math.sin(t * 0.9 + f.bob) * 0.12;
          tg.copy(f.e1).multiplyScalar(-Math.sin(th) * Math.sign(f.w)).addScaledVector(f.e2, Math.cos(th) * Math.sign(f.w)).add(q);
          m.lookAt(tg, q, up);
          qq.setFromRotationMatrix(m);
          m.compose(q, qq, sc);
          mesh.setMatrixAt(i, m);
        }
        mesh.instanceMatrix.needsUpdate = true;
      },
    });
  }

  /* --- 2 · jellies (700 m) + the nightly migration --------------- */
  {
    const JELLY = 6;
    const STR = HIGH ? 12 : 7, PTS = HIGH ? 16 : 11;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 0.5;
      pts.push(new THREE.Vector2(Math.sin(a) * (1 - 0.08 * Math.sin(a * 2)), Math.cos(a) * 0.82 + 0.1));
    }
    pts.push(new THREE.Vector2(0.96, 0.02), new THREE.Vector2(0.88, 0.0));
    const bellGeo = new THREE.LatheGeometry(pts, 48);
    const group = new THREE.Group();
    scene.add(group);
    const jellies = [];
    for (let j = 0; j < JELLY; j++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { time: U.time, fog: U.fog, uPhase: { value: rand() * 6.28 }, uLit: { value: 0 }, uColor: { value: new THREE.Color(j % 3 === 2 ? '#d8a8ff' : '#a8e8ff') }, uGlow: { value: new THREE.Color(j % 3 === 2 ? '#ff79c6' : '#64f0d2') } },
        vertexShader: /* glsl */`
          uniform float time; uniform float uPhase;
          varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vDist;
          void main(){
            vec3 p = position;
            float c = 0.5 + 0.5 * sin(time * 1.6 + uPhase);
            float rim = 1.0 - smoothstep(0.0, 0.95, p.y);
            p.xz *= 1.0 - 0.2 * c * rim;
            p.y *= 1.0 + 0.1 * c;
            vP = position;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vV = -mv.xyz; vDist = -mv.z;
            vN = normalMatrix * normal;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: FOG_GLSL + /* glsl */`
          uniform vec3 uColor; uniform vec3 uGlow; uniform float uLit; uniform float time; uniform float uPhase;
          varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vDist;
          void main(){
            float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
            float ang = atan(vP.z, vP.x);
            float canals = smoothstep(0.93, 1.0, cos(ang * 8.0)) * smoothstep(0.06, 0.6, vP.y);
            float rimG = smoothstep(0.16, 0.0, vP.y);
            float gonad = smoothstep(0.12, 0.0, abs(length(vP.xz) - 0.38)) * smoothstep(0.5, 0.75, vP.y);
            float spark = pow(0.5 + 0.5 * sin(ang * 16.0 + time * 3.0 + uPhase), 12.0) * rimG;
            vec3 col = uColor * (0.18 + fres * 1.1) * (0.35 + uLit * 1.6) + uGlow * (rimG * 0.7 + canals * 0.35 + gonad * 0.5 + spark * 1.6);
            float a = 0.1 + fres * 0.5 + canals * 0.2 + rimG * 0.3;
            col *= a * fogKeep(vDist);
            gl_FragColor = vec4(col, a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const bell = new THREE.Mesh(bellGeo, mat);
      const size = 0.55 + rand() * 0.55;
      bell.scale.setScalar(size);
      group.add(bell);
      jellies.push({ bell, mat, size, ox: (rand() - 0.5) * 7, oy: (rand() - 0.5) * 5.5, oz: -6 + rand() * 6, ph: mat.uniforms.uPhase.value, rise: 0.1 + rand() * 0.12 });
    }
    const strands = strandBatch(JELLY * STR, PTS, '#9fe9ff', 0.55);
    group.add(strands.lines);
    // migration column: photophores of fish rising for the night
    const MIG = HIGH ? 260 : 120;
    const migGeo = new THREE.BufferGeometry();
    const mp = new Float32Array(MIG * 3);
    for (let i = 0; i < MIG; i++) { mp[i * 3] = (rand() - 0.5) * 3.2; mp[i * 3 + 1] = rand() * 40; mp[i * 3 + 2] = (rand() - 0.5) * 3; }
    migGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    const migMat = new THREE.ShaderMaterial({
      uniforms: { time: U.time, fog: U.fog, uPx: { value: 1 } },
      vertexShader: FOG_GLSL + /* glsl */`
        uniform float time; uniform float uPx; varying float vA;
        void main(){ vec3 p = position; p.y = mod(p.y + time * 0.6, 40.0) - 20.0; p.x += sin(time + position.z * 3.0) * 0.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); vA = fogKeep(-mv.z) * (0.5 + 0.5 * sin(time * 2.0 + position.x * 9.0)) * smoothstep(20.0, 14.0, abs(p.y));
          gl_PointSize = uPx * 3.0 * (14.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA; gl_FragColor = vec4(vec3(0.45, 0.75, 1.0) * a, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const migration = new THREE.Points(migGeo, migMat);
    migration.frustumCulled = false;
    group.add(migration);
    const P = new THREE.Vector3();
    let inited = false;
    creatures.push({
      y: stationY(2), group, range: 34, pointMats: [migMat],
      update(t, dt) {
        migration.position.set(FOCUS_X - 7.5, (stationY(1) + stationY(3)) / 2 + 2, -7);
        for (const jl of jellies) {
          jl.bell.position.set(FOCUS_X + jl.ox + Math.sin(t * 0.2 + jl.ph) * 0.4, this.y + jl.oy + Math.sin(t * jl.rise + jl.ph) * 0.9, jl.oz);
          jl.bell.rotation.z = Math.sin(t * 0.3 + jl.ph) * 0.12;
          P.copy(jl.bell.position);
          jl.mat.uniforms.uLit.value = beamAt(P);
        }
        const anchor = (s) => {
          const jl = jellies[Math.floor(s / STR)];
          const k = s % STR;
          const a = (k / STR) * Math.PI * 2;
          const c = 0.5 + 0.5 * Math.sin(t * 1.6 + jl.ph);
          const r = jl.size * (0.86 - 0.18 * c) * (k % 3 === 0 ? 0.35 : 1);
          return [jl.bell.position.x + Math.cos(a) * r, jl.bell.position.y + 0.02, jl.bell.position.z + Math.sin(a) * r];
        };
        if (!inited) {
          for (let s = 0; s < JELLY * STR; s++) { const a = anchor(s); strands.init(s, a[0], a[1], a[2], 0.16); }
          inited = true;
          for (let i = 0; i < 90; i++) strands.step(anchor, 0.16, 2.2, 0.9, 1 / 30);
        }
        if (dt > 0) strands.step(anchor, 0.16 * (1 + 0.1 * Math.sin(t)), 2.2, 0.9, Math.min(dt, 1 / 30));
      },
    });
  }

  /* --- 3 · siphonophore + comb jelly (1,600 m) ------------------- */
  {
    const BEADS = HIGH ? 72 : 48;
    const group = new THREE.Group();
    scene.add(group);
    const beadGeo = new THREE.SphereGeometry(0.075, 10, 8);
    const beadMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const beads = new THREE.InstancedMesh(beadGeo, beadMat, BEADS);
    beads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BEADS * 3), 3);
    beads.frustumCulled = false;
    group.add(beads);
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BEADS * 3), 3));
    glowGeo.setAttribute('aB', new THREE.BufferAttribute(new Float32Array(BEADS), 1));
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { fog: U.fog, uPx: { value: 1 } },
      vertexShader: FOG_GLSL + 'uniform float uPx; attribute float aB; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aB * fogKeep(-mv.z); gl_PointSize = uPx * 34.0 * (12.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = exp(-d * d * 26.0) * vA; gl_FragColor = vec4(vec3(0.35, 0.95, 0.9) * a, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const glows = new THREE.Points(glowGeo, glowMat);
    glows.frustumCulled = false;
    group.add(glows);
    const TENT = Math.floor(BEADS / 3);
    const strands = strandBatch(TENT, 12, '#7af7e0', 0.4);
    group.add(strands.lines);

    // comb jelly: a glassy body with eight rows of rainbow cilia
    const combMat = new THREE.ShaderMaterial({
      uniforms: { time: U.time, fog: U.fog, uLit: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vDist; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vDist = -mv.z; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }',
      fragmentShader: FOG_GLSL + /* glsl */`
        uniform float time; uniform float uLit; varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vDist;
        vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main(){
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
          float ang = atan(vP.z, vP.x);
          float row = smoothstep(0.9, 1.0, cos(ang * 4.0));
          float beat = 0.5 + 0.5 * sin(vP.y * 30.0 - time * 9.0);
          vec3 iris = hue(fract(vP.y * 1.6 - time * 0.7 + ang * 0.3));
          vec3 col = vec3(0.6, 0.85, 1.0) * fres * 0.35 + iris * row * beat * (0.25 + uLit * 2.2);
          float a = fres * 0.3 + row * 0.5;
          col *= fogKeep(vDist);
          gl_FragColor = vec4(col * a, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const comb = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), combMat);
    comb.scale.set(0.55, 0.85, 0.55);
    group.add(comb);

    const P = Array.from({ length: BEADS }, () => new THREE.Vector3());
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    let inited = false;
    creatures.push({
      y: stationY(3), group, range: 30, pointMats: [glowMat],
      update(t, dt) {
        const pos = glowGeo.attributes.position.array, br = glowGeo.attributes.aB.array;
        for (let i = 0; i < BEADS; i++) {
          const f = i / (BEADS - 1);
          const x = FOCUS_X - 8 + f * 16;
          P[i].set(x, this.y + 0.6 + Math.sin(f * 7 + t * 0.55) * 0.9 + Math.sin(f * 2.3 - t * 0.21) * 0.6, -3 + Math.sin(f * 4 + t * 0.35) * 1.6);
          const pulse = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(i * 0.45 - t * 2.6), 5);
          const lit = beamAt(P[i]);
          col.setHSL(0.47 + f * 0.18, 0.8, 0.45 + 0.25 * pulse).multiplyScalar(0.6 + pulse * 1.8 + lit);
          m.makeTranslation(P[i].x, P[i].y, P[i].z);
          m.scale(tmp.setScalar(i % 3 === 0 ? 1.35 : 0.9));
          beads.setMatrixAt(i, m);
          beads.setColorAt(i, col);
          pos[i * 3] = P[i].x; pos[i * 3 + 1] = P[i].y; pos[i * 3 + 2] = P[i].z;
          br[i] = pulse * 0.9;
        }
        beads.instanceMatrix.needsUpdate = true;
        beads.instanceColor.needsUpdate = true;
        glowGeo.attributes.position.needsUpdate = true;
        glowGeo.attributes.aB.needsUpdate = true;
        const anchor = (s) => { const p = P[s * 3]; return [p.x, p.y - 0.05, p.z]; };
        if (!inited) { for (let s = 0; s < TENT; s++) { const a = anchor(s); strands.init(s, a[0], a[1], a[2], 0.22); } inited = true; for (let i = 0; i < 80; i++) strands.step(anchor, 0.22, 1.6, 0.92, 1 / 30); }
        if (dt > 0) strands.step(anchor, 0.22, 1.6, 0.92, Math.min(dt, 1 / 30));
        comb.position.set(FOCUS_X - 2.6 + Math.sin(t * 0.17) * 0.6, this.y + 3.1 + Math.sin(t * 0.4) * 0.3, 1.2);
        comb.rotation.set(Math.sin(t * 0.3) * 0.25, t * 0.2, 0.2);
        combMat.uniforms.uLit.value = beamAt(comb.position);
      },
    });
  }

  /* --- 4 · anglerfish (3,000 m) ---------------------------------- */
  {
    const group = new THREE.Group();
    scene.add(group);
    const fish = new THREE.Group();
    group.add(fish);
    // body: a sphere pushed into a big-headed, tapering shape with bumps
    const bodyGeo = new THREE.SphereGeometry(1, 64, 44);
    {
      const p = bodyGeo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const x = v.x;
        const h = 0.42 + 0.58 * THREE.MathUtils.smoothstep(x, -0.95, 0.25);
        const w = 0.4 + 0.42 * THREE.MathUtils.smoothstep(x, -0.9, 0.3);
        v.y *= h; v.z *= w;
        // underbite: the lower jaw juts forward
        if (v.y < 0 && x > 0.2) v.x += 0.22 * THREE.MathUtils.smoothstep(x, 0.2, 1.0) * THREE.MathUtils.smoothstep(-v.y, 0.0, 0.5);
        // a flat-topped skull
        if (v.y > 0.25) v.y = 0.25 + (v.y - 0.25) * 0.8;
        const n = (vnoise(v.x * 6 + 3, v.y * 6 + v.z * 4) - 0.5) * 0.07 + (vnoise(v.x * 17, v.z * 17 + v.y * 9) - 0.5) * 0.035;
        v.multiplyScalar(1 + n);
        v.x *= 1.3;
        p.setXYZ(i, v.x, v.y, v.z);
      }
      bodyGeo.computeVertexNormals();
      // mottled skin: dark blotches, a paler throat
      const cols = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const m = vnoise(x * 4 + 11, y * 4 + z * 3) * 0.6 + vnoise(x * 11, z * 11 + y * 5) * 0.4;
        const k = 0.55 + m * 0.6 + (y < -0.1 && x > 0.3 ? 0.25 : 0);
        cols.set([k, k * 0.92, k * 0.88], i * 3);
      }
      bodyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    }
    const skin = new THREE.MeshStandardMaterial({ color: 0x7e6255, roughness: 0.3, metalness: 0.05 });
    const bodySkin = skin.clone();
    bodySkin.vertexColors = true;
    fish.add(new THREE.Mesh(bodyGeo, bodySkin));
    // the gape: a dark seam with needle teeth along both jaws
    const jawCurve = (lower) => new THREE.CatmullRomCurve3([-0.8, -0.4, 0, 0.4, 0.8].map((s) => new THREE.Vector3(1.28 + (lower ? 0.2 : 0.06) - Math.abs(s) * 0.55, (lower ? -0.12 : 0.02) - Math.abs(s) * 0.14, s * 0.52)));
    const seam = new THREE.Mesh(new THREE.TubeGeometry(jawCurve(true), 40, 0.07, 8), new THREE.MeshBasicMaterial({ color: 0x050202 }));
    seam.position.y = 0.03;
    fish.add(seam);
    const toothGeo = new THREE.ConeGeometry(0.022, 0.26, 6);
    toothGeo.translate(0, 0.13, 0);
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xe9f2ee, roughness: 0.25, emissive: 0x0d1614, transparent: true, opacity: 0.9 });
    const TEETH = 22;
    const teeth = new THREE.InstancedMesh(toothGeo, toothMat, TEETH);
    {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      for (let i = 0; i < TEETH; i++) {
        const lower = i % 2 === 0;
        const u = (i / (TEETH - 1));
        const p = jawCurve(lower).getPoint(0.08 + u * 0.84);
        const len = 0.6 + Math.sin(i * 2.3) * 0.25 + (1 - Math.abs(u - 0.5) * 2) * 0.6;
        q.setFromEuler(new THREE.Euler((lower ? 0 : Math.PI) + (u - 0.5) * 0.4, 0, (lower ? 0.35 : -0.35)));
        s.set(1, len, 1);
        m.compose(p, q, s);
        teeth.setMatrixAt(i, m);
      }
    }
    fish.add(teeth);
    // eyes, fins
    for (const sz of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.05, metalness: 0.3 }));
      eye.position.set(0.95, 0.24, sz * 0.36);
      fish.add(eye);
    }
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    for (let i = 0; i <= 8; i++) { const a = -0.9 + (i / 8) * 1.8; finShape.lineTo(-Math.cos(a) * 0.55 - 0.1 * Math.sin(i * 2), Math.sin(a) * 0.5); }
    finShape.lineTo(0, 0);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x3a2622, roughness: 0.6, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const tailFin = new THREE.Mesh(new THREE.ShapeGeometry(finShape), finMat);
    tailFin.position.set(-1.2, 0.02, 0);
    fish.add(tailFin);
    const pecs = [];
    for (const sz of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.ShapeGeometry(finShape), finMat);
      pec.scale.setScalar(0.55);
      pec.position.set(0.0, -0.12, sz * 0.36);
      pec.rotation.y = sz * 1.2;
      fish.add(pec);
      pecs.push(pec);
    }
    // the lure: illicium + glowing esca + its own light
    const lure = new THREE.Group();
    lure.position.set(0.85, 0.42, 0);
    fish.add(lure);
    const stalk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.25, 0.55, 0), new THREE.Vector3(0.75, 0.75, 0), new THREE.Vector3(1.05, 0.5, 0)]);
    lure.add(new THREE.Mesh(new THREE.TubeGeometry(stalk, 32, 0.022, 6), skin));
    const esca = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.4, 2.2), toneMapped: false }));
    esca.position.copy(stalk.getPoint(1));
    lure.add(esca);
    const escaGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x8affe6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    escaGlow.scale.setScalar(0.75);
    escaGlow.position.copy(esca.position);
    lure.add(escaGlow);
    const lureLight = new THREE.PointLight(0x9ffff0, 7, 7, 1.6);
    lureLight.position.copy(esca.position).add(new THREE.Vector3(0.12, 0, 0));
    lure.add(lureLight);
    fish.scale.setScalar(1.35);
    const fill = new THREE.PointLight(0x6a9cff, 5, 10, 1.3);
    fill.position.set(-1.5, 2.2, 3.5);
    group.add(fill);
    const poi4 = new THREE.Vector3();
    creatures.push({
      y: stationY(4), group, range: 30, station: 4, poi: poi4,
      update(t) {
        fish.position.set(FOCUS_X + 0.6 + Math.sin(t * 0.13) * 0.6, this.y + 0.1 + Math.sin(t * 0.37) * 0.25, -0.8 + Math.sin(t * 0.09) * 0.5);
        fill.position.set(fish.position.x + 1.6, fish.position.y + 2.4, fish.position.z - 2.2);
        fish.rotation.y = -2.75 + Math.sin(t * 0.11) * 0.14;
        fish.rotation.z = Math.sin(t * 0.21) * 0.05;
        lure.rotation.z = Math.sin(t * 1.1) * 0.12;
        lure.rotation.y = Math.sin(t * 0.7) * 0.15;
        const flick = 0.75 + 0.25 * Math.sin(t * 3.1) * Math.sin(t * 1.7);
        lureLight.intensity = 6 * flick;
        escaGlow.material.opacity = 0.7 + 0.3 * flick;
        tailFin.rotation.y = Math.sin(t * 1.8) * 0.35;
        pecs.forEach((p, i) => { p.rotation.x = Math.sin(t * 2.2 + i * 3) * 0.3; });
        poi4.set(0.2, 0.0, 0).applyMatrix4(fish.matrixWorld);
      },
    });
  }

  /* --- 5 · giant squid (4,500 m) — only the beam finds it -------- */
  {
    const group = new THREE.Group();
    scene.add(group);
    const squid = new THREE.Group();
    group.add(squid);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x7a2a20, roughness: 0.5, metalness: 0.0 });
    // mantle: lathe along +x, tail at the origin
    const prof = [[0, 0], [0.35, 0.8], [0.8, 2.2], [1.15, 4.2], [1.25, 6.2], [1.15, 7.6], [1.05, 8.4]].map(([r, y]) => new THREE.Vector2(r, y));
    const mantleGeo = new THREE.LatheGeometry(prof, 40);
    mantleGeo.rotateZ(-Math.PI / 2);
    const mantle = new THREE.Mesh(mantleGeo, skinMat);
    squid.add(mantle);
    // lateral fins at the tail
    const fin = new THREE.Shape();
    fin.moveTo(0, 0); fin.quadraticCurveTo(0.9, 1.7, 2.4, 0.05); fin.lineTo(2.4, -0.05); fin.quadraticCurveTo(0.9, -1.7, 0, 0);
    const finGeo = new THREE.ShapeGeometry(fin, 16);
    finGeo.rotateX(Math.PI / 2);
    const fins = new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ color: 0x8a3226, roughness: 0.55, side: THREE.DoubleSide }));
    fins.position.set(0.2, 0, 0);
    squid.add(fins);
    // head and the eye the size of a dinner plate
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), skinMat);
    head.scale.set(0.9, 0.85, 0.95);
    head.position.set(9.0, 0, 0);
    squid.add(head);
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.04, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.02 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0xc8a96a, roughness: 0.35, metalness: 0.6 });
    for (const sz of [1]) {
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.47, 32, 20), irisMat);
      iris.position.set(9.05, 0.12, sz * 0.62);
      squid.add(iris);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 20), eyeMat);
      eye.position.set(9.08, 0.12, sz * 0.66);
      squid.add(eye);
    }
    // eight arms and two long tentacles, bent in the vertex shader
    const arms = [];
    const ARMS = 10;
    for (let a = 0; a < ARMS; a++) {
      const tentacle = a >= 8;
      const L = tentacle ? 15 : 7 + (a % 4) * 0.6;
      const path = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(L, 0, 0));
      const g = new THREE.TubeGeometry(path, tentacle ? 96 : 60, 0.2, 8);
      const p = g.attributes.position, uv = g.attributes.uv;
      const aArm = new Float32Array(p.count).fill(a);
      for (let i = 0; i < p.count; i++) {
        const u = uv.getX(i);
        const taper = tentacle ? (u < 0.82 ? 0.55 - u * 0.35 : 0.5 + Math.sin((u - 0.82) / 0.18 * Math.PI) * 0.6) : 1.25 * (1 - u * 0.92);
        p.setY(i, p.getY(i) * taper);
        p.setZ(i, p.getZ(i) * taper);
      }
      g.setAttribute('aArm', new THREE.BufferAttribute(aArm, 1));
      const ang = (a / 8) * Math.PI * 2;
      g.rotateZ(tentacle ? (a === 8 ? 0.05 : -0.05) : Math.sin(ang) * 0.22);
      g.rotateY(tentacle ? (a === 8 ? 0.08 : -0.08) : Math.cos(ang) * 0.22);
      g.translate(9.7, Math.sin(ang) * 0.35, Math.cos(ang) * 0.35);
      arms.push(g);
    }
    const armGeo = mergeGeoms(arms, ['position', 'normal', 'uv', 'aArm']);
    const armMat = skinMat.clone();
    armMat.onBeforeCompile = (sh) => {
      sh.uniforms.time = U.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float time; attribute float aArm;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float s = uv.x; float w = s * s;
          transformed.y += sin(time * 0.55 + s * 4.5 + aArm * 1.9) * 1.1 * w;
          transformed.z += cos(time * 0.42 + s * 3.7 + aArm * 2.7) * 0.9 * w;
          transformed.x -= w * 0.6 * (1.0 + sin(time * 0.3 + aArm));`);
    };
    squid.add(new THREE.Mesh(armGeo, armMat));
    squid.scale.setScalar(0.62);
    const poi5 = new THREE.Vector3();
    const eyeAnchor = new THREE.Object3D();
    eyeAnchor.position.set(8.4, 0.1, 0.5);
    squid.add(eyeAnchor);
    creatures.push({
      y: stationY(5), group, range: 34, station: 5, poi: poi5,
      update(t) {
        const breathe = Math.sin(t * 0.8);
        mantle.scale.set(1, 1 + breathe * 0.04, 1 + breathe * 0.04);
        squid.position.set(FOCUS_X - 3.6 + Math.sin(t * 0.05) * 1.0, this.y + 0.3 + Math.sin(t * 0.23) * 0.35, -3.0);
        squid.rotation.set(0.15 + Math.sin(t * 0.17) * 0.06, -0.38 + Math.sin(t * 0.07) * 0.12, -0.12 + Math.sin(t * 0.13) * 0.05);
        fins.rotation.x = Math.sin(t * 0.9) * 0.25;
        squid.updateMatrixWorld();
        eyeAnchor.getWorldPosition(poi5);
      },
    });
  }

  /* --- 6 · vent field and Station VI (6,000 m) ------------------- */
  {
    const group = new THREE.Group();
    scene.add(group);
    const floorY = stationY(6) - 3.6;
    // terrain height in floor-local coordinates (the floor sits at x = FOCUS_X, z = -12)
    const floorH = (x, z) => vnoise(x * 0.12, z * 0.12) * 1.6 + vnoise(x * 0.5 + 7, z * 0.5) * 0.35 + vnoise(x * 1.7, z * 1.7 + 3) * 0.08 - 0.8;
    const groundAt = (wx, wz) => floorY + floorH(wx, wz + 12);
    // seafloor
    const floorGeo = new THREE.PlaneGeometry(80, 46, HIGH ? 160 : 90, HIGH ? 92 : 52);
    floorGeo.rotateX(-Math.PI / 2);
    {
      const p = floorGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        p.setY(i, floorH(x, z));
      }
      floorGeo.computeVertexNormals();
    }
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x3b3430, roughness: 0.95 }));
    floor.position.set(0, floorY, -12);
    group.add(floor);
    // chimneys
    const chimMat = new THREE.MeshStandardMaterial({ color: 0x3a302a, roughness: 0.85 });
    // mineral-crusted chimneys glow where the hot fluid seeps through
    chimMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vLocal;
          float h3(vec3 p){ return fract(sin(dot(p, vec3(17.1, 113.7, 59.3))) * 43758.5); }
          float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                       mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float n = n3(vLocal * vec3(3.2, 2.2, 3.2)) * 0.65 + n3(vLocal * 7.5) * 0.35;
          float crack = smoothstep(0.03, 0.0, abs(n - 0.5));
          float base = exp(-vLocal.y * 2.2);
          totalEmissiveRadiance += vec3(1.0, 0.34, 0.07) * (base * 0.7 + crack * base * 1.4 + crack * 0.04);`);
    };
    const vents = [[-3.4, -6.5, 5.6], [0.4, -10, 7.6], [3.8, -5.2, 4.4]];
    const smokeSystems = [];
    const ventLights = [];
    for (const [vx, vz, h] of vents) {
      const prof = [];
      for (let i = 0; i <= 18; i++) {
        const f = i / 18;
        prof.push(new THREE.Vector2(Math.max(0.12, (1.2 - f * 0.85) + Math.sin(f * 19 + vx) * 0.12 + (f > 0.9 ? 0.1 : 0)), f * h));
      }
      const g = new THREE.LatheGeometry(prof, 22);
      {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const k = 1 + (vnoise(x * 2.2 + vx, y * 1.3) - 0.5) * 0.5;
          p.setXYZ(i, x * k, y, z * k);
        }
        g.computeVertexNormals();
      }
      const chim = new THREE.Mesh(g, chimMat);
      chim.userData.base = [vx, vz, h];
      group.add(chim);
      const light = new THREE.PointLight(0xff7a2a, 9, 8, 1.6);
      group.add(light);
      ventLights.push([light, vx, vz]);
      smokeSystems.push(makeSmoke(h));
    }
    for (const s of smokeSystems) group.add(s.points);
    // tube worms around the bases
    const WORMS = HIGH ? 150 : 80;
    const tubeGeo = new THREE.CylinderGeometry(0.022, 0.03, 1, 6);
    tubeGeo.translate(0, 0.5, 0);
    const plumeGeo = new THREE.SphereGeometry(0.05, 8, 6);
    plumeGeo.scale(1, 1.6, 1);
    const tubes = new THREE.InstancedMesh(tubeGeo, new THREE.MeshStandardMaterial({ color: 0xe8e6dc, roughness: 0.6 }), WORMS);
    const plumes = new THREE.InstancedMesh(plumeGeo, new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0x5a0000, roughness: 0.5 }), WORMS);
    tubes.frustumCulled = plumes.frustumCulled = false;
    group.add(tubes, plumes);
    const worms = Array.from({ length: WORMS }, (_, i) => {
      const [vx, vz] = vents[i % 3];
      const a = rand() * 6.283, r = 0.95 + Math.pow(rand(), 1.6) * 1.3;
      return { x: vx + Math.cos(a) * r, z: vz + Math.sin(a) * r, h: 0.28 + rand() * 0.5, ph: rand() * 6.283, lean: (rand() - 0.5) * 0.3 };
    });
    // Station VI habitat
    const hab = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.4, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 3.4, 8, 24), hull);
    body.rotation.z = Math.PI / 2;
    hab.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.5, emissive: 0x1a4050 }));
    dome.position.set(0.6, 0.75, 0);
    hab.add(dome);
    const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.8), toneMapped: false });
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), winMat);
      w.position.set(-1.7 + i * 0.6, 0.05, 0.9);
      hab.add(w);
    }
    for (const [lx, lz] of [[-1.6, -0.6], [-1.6, 0.6], [1.6, -0.6], [1.6, 0.6]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6), hull);
      leg.position.set(lx, -1.2, lz);
      leg.rotation.z = lx > 0 ? 0.2 : -0.2;
      hab.add(leg);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), hull);
    mast.position.set(-1.4, 1.5, 0);
    hab.add(mast);
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff4040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    beacon.position.set(-1.4, 2.35, 0);
    beacon.scale.setScalar(0.9);
    hab.add(beacon);
    const habLight = new THREE.SpotLight(0xffd59a, 30, 18, 0.55, 0.6, 1.3);
    habLight.position.set(-0.2, -0.4, 0.6);
    hab.add(habLight);
    const habTarget = new THREE.Object3D();
    group.add(habTarget);
    habLight.target = habTarget;
    group.add(hab);

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), top = new THREE.Vector3();
    const poi6 = new THREE.Vector3();
    creatures.push({
      y: stationY(6), group, range: 36, pointMats: smokeSystems.map((x) => x.mat), floorY, station: 6, poi: poi6,
      update(t) {
        floor.position.x = FOCUS_X;
        group.children.forEach((c) => {
          if (c.userData.base) { const [vx, vz] = c.userData.base; c.position.set(FOCUS_X + vx, groundAt(vx, vz) - 0.35, vz); }
        });
        ventLights.forEach(([l, vx, vz], i) => {
          l.position.set(FOCUS_X + vx, groundAt(vx, vz) + 0.6, vz + 0.8);
          l.intensity = 8 + Math.sin(t * 3.3 + i * 2) * 1.5 + Math.sin(t * 7.1 + i) * 0.8;
        });
        smokeSystems.forEach((sm, i) => { const [vx, vz, h] = vents[i]; sm.points.position.set(FOCUS_X + vx, groundAt(vx, vz) - 0.35 + h, vz); });
        for (let i = 0; i < WORMS; i++) {
          const w = worms[i];
          const sway = Math.sin(t * 1.3 + w.ph) * 0.12 + w.lean;
          e.set(Math.cos(t * 0.9 + w.ph) * 0.08, 0, sway);
          q.setFromEuler(e);
          p.set(FOCUS_X + w.x, groundAt(w.x, w.z) - 0.05, w.z);
          s.set(1, w.h, 1);
          m.compose(p, q, s);
          tubes.setMatrixAt(i, m);
          top.set(0, w.h, 0).applyQuaternion(q).add(p);
          s.set(1, 1 + 0.15 * Math.sin(t * 2 + w.ph), 1);
          m.compose(top, q, s);
          plumes.setMatrixAt(i, m);
        }
        tubes.instanceMatrix.needsUpdate = true;
        plumes.instanceMatrix.needsUpdate = true;
        // the lab sits in the foreground, clear of the HUD, its lamp on the worms
        const hx = isSmall() ? 1.4 : 1.8, hz = isSmall() ? -3 : 1.2, hs = isSmall() ? 0.42 : 0.55;
        hab.scale.setScalar(hs);
        hab.position.set(FOCUS_X + hx, groundAt(hx, hz) + 1.85 * hs, hz);
        hab.rotation.y = 0.38;
        habTarget.position.set(FOCUS_X - 0.8, floorY, -6);
        beacon.material.opacity = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.2), 8);
        poi6.set(FOCUS_X + 0.4, groundAt(0.4, -10) + 4.5, -10);
      },
    });

    function makeSmoke(h) {
      const COUNT = HIGH ? 420 : 200;
      const geo = new THREE.BufferGeometry();
      const seed = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) { seed[i * 3] = rand(); seed[i * 3 + 1] = rand(); seed[i * 3 + 2] = rand(); }
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...U, uPx: { value: 1 } },
        vertexShader: BEAM_GLSL + FOG_GLSL + /* glsl */`
          uniform float time; uniform float uPx; attribute vec3 aSeed; varying float vA; varying vec3 vC;
          void main(){
            float s = fract(aSeed.x + time * (0.05 + aSeed.y * 0.03));
            float rise = s * 9.0;
            vec3 p = vec3(0.0, rise, 0.0);
            p.x += (sin(time * 0.7 + aSeed.z * 30.0 + rise * 0.8) * 0.35 + (aSeed.z - 0.5) * 0.5) * (0.3 + rise * 0.35);
            p.z += (cos(time * 0.6 + aSeed.y * 40.0 + rise * 0.6) * 0.35 + (aSeed.y - 0.5) * 0.4) * (0.3 + rise * 0.3);
            p.x += rise * rise * 0.02;
            vec4 wp = modelMatrix * vec4(p, 1.0);
            vec4 mv = viewMatrix * wp;
            float glow = exp(-rise * 0.9);
            float lit = inBeam(wp.xyz);
            vC = vec3(1.0, 0.45, 0.12) * glow * 2.0 + vec3(0.62, 0.64, 0.66) * lit * 2.2 + vec3(0.07, 0.075, 0.08);
            vA = (1.0 - s) * smoothstep(0.0, 0.06, s) * 0.42 * fogKeep(-mv.z);
            gl_PointSize = uPx * (0.9 + rise * 0.5) * 380.0 / max(1.0, -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */`
          varying float vA; varying vec3 vC;
          void main(){ float d = length(gl_PointCoord - 0.5); float a = exp(-d * d * 14.0) * vA; gl_FragColor = vec4(vC * a, a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      return { points, mat };
    }
  }

  /* ---------- your own light: bioluminescent sparks ---------- */

  const SPARKS = 180;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
  sparkGeo.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(SPARKS), 1));
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 1 } },
    vertexShader: 'uniform float uPx; attribute float aLife; varying float vL; void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uPx * (6.0 + 20.0 * aLife) * (10.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vL; void main(){ float d = length(gl_PointCoord - 0.5); float a = exp(-d * d * 22.0) * vL; gl_FragColor = vec4(vec3(0.4, 1.0, 0.85) * a * 1.6, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  const sparkVel = new Float32Array(SPARKS * 3);
  let sparkIx = 0;
  const pointMats = [snowMat, sparkMat, blinkMat, ...creatures.flatMap((c) => c.pointMats || [])];

  /* ---------- input: aim the floodlight ---------- */

  const pointer = new THREE.Vector2(0.25, -0.1);
  const aim = new THREE.Vector3();
  let pointerUntil = 0;
  const ray = new THREE.Raycaster();
  const sparkPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -3);
  let lastSpark = 0;
  function onPoint(e, isTap) {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    pointerUntil = performance.now() + (isTap ? 9000 : 6000);
    hud.aim.classList.remove('on');
    aimSeen = true;
    if (reduceMotion) return;
    const d = depthAt(uNow);
    const now = performance.now();
    if (d > 700 && now - lastSpark > 16) {
      lastSpark = now;
      ray.setFromCamera(pointer, camera);
      const p = new THREE.Vector3();
      if (ray.ray.intersectPlane(sparkPlane, p)) {
        const n = isTap ? 14 : 2;
        for (let k = 0; k < n; k++) {
          const i = sparkIx++ % SPARKS;
          sparkGeo.attributes.position.setXYZ(i, p.x, p.y, p.z);
          sparkGeo.attributes.aLife.setX(i, 1);
          sparkVel[i * 3] = (Math.random() - 0.5) * (isTap ? 1.4 : 0.3);
          sparkVel[i * 3 + 1] = (Math.random() - 0.5) * (isTap ? 1.4 : 0.3) + 0.1;
          sparkVel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        }
      }
    }
  }
  let aimSeen = false;
  window.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') onPoint(e, false); }, { passive: true });
  canvas.addEventListener('pointerdown', (e) => onPoint(e, true));

  /* ---------- post ---------- */

  let composer = null;
  if (HIGH) {
    composer = new EffectComposer(renderer);
    const bgPass = new RenderPass(bgScene, bgCam);
    const mainPass = new RenderPass(scene, camera);
    mainPass.clear = false;
    mainPass.clearDepth = true;
    composer.addPass(bgPass);
    composer.addPass(mainPass);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.55, 0.62));
    composer.addPass(new OutputPass());
  }

  /* ---------- sizing ---------- */

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
    bgMat.uniforms.uAspect.value = w / h;
    const px = renderer.getPixelRatio() * (h / 900);
    for (const m of pointMats) m.uniforms.uPx.value = px;
    FOCUS_X = isSmall() ? 0 : (w / h > 1.25 ? 2.6 : 1.8);
    measureStations();
    readScroll();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', readScroll, { passive: true });
  resize();
  uNow = uGoal;

  /* ---------- loop ---------- */

  const clock = new THREE.Clock();
  const lookAt = new THREE.Vector3();
  const poi = new THREE.Vector3();
  const beamDir = new THREE.Vector3();
  const fogC = new THREE.Color();
  let beamOnNow = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!reduceMotion) U.time.value += dt;
    const t = U.time.value;

    // winch: eased descent (instant under reduced motion)
    uNow += (uGoal - uNow) * (reduceMotion ? 1 : 1 - Math.pow(0.012, dt));
    const d = depthAt(uNow);
    const sun = sunlight(d);
    U.sun.value = sun;

    // water, fog, sunlight
    const [r, g, b] = waterRGB(d + 60);
    const [r2, g2, b2] = waterRGB(Math.max(0, d - 120));
    bgMat.uniforms.uBottom.value.set(r / 255, g / 255, b / 255);
    bgMat.uniforms.uTop.value.set(r2 / 255, g2 / 255, b2 / 255);
    bgMat.uniforms.uSurface.value = THREE.MathUtils.clamp(1 - d / 70, 0, 1);
    fogC.setRGB(Math.pow((r + r2) / 510, 2.2), Math.pow((g + g2) / 510, 2.2), Math.pow((b + b2) / 510, 2.2), THREE.LinearSRGBColorSpace);
    scene.fog.color.copy(fogC);
    const density = 0.028 + (1 - sun) * 0.022;
    scene.fog.density = density;
    U.fog.value = density;
    hemi.intensity = 0.06 + 1.5 * sun;
    sunLight.intensity = 2.6 * sun;

    // camera: a slight sway; the floor station looks down at the vents
    const camY = -uNow * SPACING;
    const sway = reduceMotion ? 0 : 1;
    const floorLook = THREE.MathUtils.smoothstep(uNow, 5.3, 6);
    const lift = isSmall() ? -1.7 : 0;
    camera.position.set(Math.sin(t * 0.21) * 0.25 * sway, camY + Math.sin(t * 0.33) * 0.15 * sway + floorLook * 0.5, 15 - floorLook * 1.5);
    lookAt.set(FOCUS_X * 0.12, camY + lift - floorLook * (isSmall() ? 1.1 : 2.6), 0);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    snowMat.uniforms.uCamY.value = camY;
    blinkMat.uniforms.uCamY.value = camY;
    blinkMat.uniforms.uDark.value = THREE.MathUtils.smoothstep(d, 450, 1100);
    hazeMat.uniforms.uDark.value = THREE.MathUtils.smoothstep(d, 300, 1000);

    // floodlight: follows the pointer, or rests on the station's animal
    const lampActive = lampOn && sun < 0.35;
    beamOnNow += ((lampActive ? 1 : 0) - beamOnNow) * (reduceMotion ? 1 : Math.min(1, dt * 2.5));
    flood.intensity = 70 * beamOnNow;
    U.beamOn.value = beamOnNow;
    const usePointer = performance.now() < pointerUntil || reduceMotion && aimSeen;
    if (usePointer) {
      ray.setFromCamera(pointer, camera);
      poi.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 16);
    } else {
      const host = creatures.find((c) => c.station === Math.round(uNow) && c.poi);
      if (host) poi.copy(host.poi);
      else poi.set(FOCUS_X, camY, -2);
      poi.x += Math.sin(t * 0.25) * 0.9 * sway;
      poi.y += Math.sin(t * 0.31) * 0.45 * sway;
    }
    aim.lerp(poi, reduceMotion ? 1 : 1 - Math.pow(0.02, dt));
    floodTarget.position.copy(aim);
    flood.updateMatrixWorld();
    const lp = new THREE.Vector3().setFromMatrixPosition(flood.matrixWorld);
    beamDir.copy(aim).sub(lp).normalize();
    U.beamPos.value.copy(lp);
    U.beamDir.value.copy(beamDir);
    haze.visible = beamOnNow > 0.01;
    hud.aim.classList.toggle('on', lampActive && !aimSeen && d > 600);

    // animals near the camera only
    for (const c of creatures) {
      c.group.visible = Math.abs(camY - c.y) < c.range;
      if (c.group.visible) c.update(t, reduceMotion ? 0 : dt);
    }

    // sparks drift and fade
    if (!reduceMotion) {
      const pos = sparkGeo.attributes.position.array, life = sparkGeo.attributes.aLife.array;
      for (let i = 0; i < SPARKS; i++) {
        if (life[i] <= 0) continue;
        life[i] = Math.max(0, life[i] - dt * 0.55);
        pos[i * 3] += sparkVel[i * 3] * dt; pos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt; pos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
        sparkVel[i * 3] *= 0.97; sparkVel[i * 3 + 1] *= 0.97;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.aLife.needsUpdate = true;
    }

    updateHud(d, uNow, lampActive);

    if (composer) composer.render();
    else {
      renderer.autoClear = false;
      renderer.clear();
      renderer.render(bgScene, bgCam);
      renderer.clearDepth();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ============================================================
   Helpers
   ============================================================ */

function mergeGeoms(list, keep = ['position', 'normal']) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const k of keep) {
    const size = parts[0].attributes[k].itemSize;
    const total = parts.reduce((n, g) => n + g.attributes[k].count, 0);
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of parts) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

function glowTexture() {
  if (glowTexture.tex) return glowTexture.tex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture.tex = new THREE.CanvasTexture(c);
  return glowTexture.tex;
}

function vnoise(x, y) {
  const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
