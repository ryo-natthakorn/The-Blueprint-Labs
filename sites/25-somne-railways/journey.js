import * as THREE from 'three';
import { SKY_VERT, SKY_FRAG } from '/sites/25-somne-railways/sky.js';

/* ============================================================
   SOMNE — berth 14, the 22:04 from Veldt Central
   You are in the compartment; the world outside is rendered to
   a target and seen through the glass. The train runs in real
   time: scrolling only chooses the chapter (and the clock), the
   train brakes onto each platform, pulls away, and passes
   through tunnels where the country changes.
   World units are metres. The train runs along +x; the window
   looks toward −z.
   ============================================================ */

const canvas = document.getElementById('berth');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = () => innerWidth <= 760;
const lowEnd = phone() || (navigator.hardwareConcurrency || 8) <= 4;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const EYE = 2.0;                          // eye height above the ground beside the track

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = Math.min(devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const OUT_SCALE = lowEnd ? 0.7 : Math.min(DPR, 1.35);
const rtOut = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: lowEnd ? 0 : 4, depthBuffer: true });

/* ============================================================
   THE JOURNEY: chapters, clock, plan
   ============================================================ */
const sections = [...document.querySelectorAll('.berth')];
let centres = [];
function measure() {
  centres = sections.map((s) => s.offsetTop + s.offsetHeight / 2);
}
function chapterNow() {
  const mid = scrollY + innerHeight / 2;
  if (mid <= centres[0]) return 0;
  for (let i = 0; i < centres.length - 1; i++) {
    if (mid < centres[i + 1]) return i + (mid - centres[i]) / (centres[i + 1] - centres[i]);
  }
  return centres.length - 1;
}
const HOURS = [22.07, 22.1, 23.62, 26.0, 27.2, 30.52];         // 22:04 … 06:31 (hours past midnight + 24)
const ROUTE = [0, 0.01, 0.22, 0.45, 0.67, 1];
const pick = (arr, c) => { const i = Math.min(Math.floor(c), arr.length - 2); return lerp(arr[i], arr[i + 1], clamp(c - i, 0, 1)); };
const STATIONS = { veldt: 'Veldt Central', larkspur: 'Larkspur Halt', iskar: 'Iskar Coast' };
function planFor(c) {
  if (c < 0.6) return { stop: 'veldt', biome: 'city' };
  if (c < 1.55) return { run: 26, biome: c < 1.3 ? 'city' : 'fields' };
  if (c < 2.5) return { stop: 'larkspur', biome: 'fields' };
  if (c < 3.55) return { run: 36, biome: 'fields' };
  if (c < 4.5) return { run: 21, biome: 'lake' };
  return { stop: 'iskar', biome: 'coast' };
}
const nextName = (c) => (c < 2.3 ? 'Larkspur Halt' : c < 4.3 ? 'Mirensee' : c < 4.98 ? 'Iskar Coast' : 'Terminus');

/* ============================================================
   THE WORLD OUTSIDE
   ============================================================ */
const world = new THREE.Scene();
const outCam = new THREE.PerspectiveCamera(50, 1, 0.3, 3000);
const MOON = new THREE.Vector3(0.26, 0.21, -0.94).normalize();
const SUN = new THREE.Vector3(0.95, -0.06, -0.3).normalize();

const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, depthTest: false, depthWrite: false,
  uniforms: {
    uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() },
    uPix: { value: 0.001 }, uTime: { value: 0 }, uDawn: { value: 0 }, uRain: { value: 1 }, uCityGlow: { value: 1 },
    uCityEnd: { value: 1e9 }, uLake: { value: 0 }, uCoast: { value: 0 }, uBlur: { value: 0 }, uQ: { value: lowEnd ? 0 : 1 },
    uMoonDir: { value: MOON }, uSunDir: { value: SUN },
  },
}));
sky.frustumCulled = false;
sky.renderOrder = -1000;
world.add(sky);
const SU = sky.material.uniforms;

const moonLight = new THREE.DirectionalLight(0xaebfe0, 0.5);
moonLight.position.copy(MOON).multiplyScalar(100);
world.add(moonLight, moonLight.target);
const hemi = new THREE.HemisphereLight(0x27304a, 0x0a0906, 0.6);
world.add(hemi);
world.fog = new THREE.FogExp2(0x05070d, 0.006);

// motion smear: near scenery is stretched along the track by the distance it moves while the "shutter" is open
const SMEAR = { value: 0 };
function smearable(mat, width) {
  mat.transparent = width > 0;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSmear = SMEAR;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSmear;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += step(0.0, transformed.x) * uSmear;');
    if (width > 0) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uSmear;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>\ngl_FragColor.a *= ${width.toFixed(3)} / (${width.toFixed(3)} + uSmear);`);
    }
  };
  return mat;
}

/* ---------- materials ---------- */
const M = {
  pole: smearable(new THREE.MeshLambertMaterial({ color: 0x1b140f }), 0.26),
  wire: new THREE.LineBasicMaterial({ color: 0x07080a }),
  tree: smearable(new THREE.MeshLambertMaterial({ color: 0x0c140f }), 0),
  conifer: smearable(new THREE.MeshLambertMaterial({ color: 0x08100c }), 0),
  wall: smearable(new THREE.MeshLambertMaterial({ color: 0x17130f }), 0),
  roof: smearable(new THREE.MeshLambertMaterial({ color: 0x0f0d0d }), 0),
  window: smearable(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.55, 0.22) }), 1.0),
  sodium: smearable(new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 2.4, 0.7) }), 0.4),
  dark: smearable(new THREE.MeshLambertMaterial({ color: 0x0b0b0c }), 0.3),
  reed: smearable(new THREE.MeshLambertMaterial({ color: 0x0a0d09 }), 0),
};
const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
function glow(color, size, k = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(color).multiplyScalar(k), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(size, size, 1);
  return s;
}

/* ---------- deterministic randomness ---------- */
function rng(seed) {
  let s = (seed * 2654435761) % 4294967296 || 7;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

/* ---------- biomes along the line ---------- */
const T = { x: 0, v: 0, target: null, stoppedFor: 0, biome: 'city' };
let segments = [{ x: -Infinity, biome: 'city' }];
const biomeAt = (x) => { let b = segments[0].biome; for (const s of segments) if (x >= s.x) b = s.biome; return b; };

/* ---------- scenery chunks ---------- */
const CHUNK = 100;
const chunks = new Map();
let tunnel = null;
const stations = [];
const inTunnel = (x) => tunnel && x > tunnel.x0 - 6 && x < tunnel.x1 + 6;
const nearStation = (x) => stations.some((s) => Math.abs(x - s.x) < s.half + 6);
const geo = {
  pole: new THREE.CylinderGeometry(0.11, 0.14, 7.4, 6).translate(0, 3.7, 0),
  arm: new THREE.BoxGeometry(1.7, 0.1, 0.1),
  crown: new THREE.IcosahedronGeometry(1, 1),
  cone: new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
  blade: new THREE.ConeGeometry(1, 1, 3).translate(0, 0.5, 0),
  trunk: new THREE.CylinderGeometry(0.12, 0.16, 1, 5).translate(0, 0.5, 0),
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  roof: (() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 0.55); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5); })(),
  pane: new THREE.PlaneGeometry(1, 1),
};
function instanced(g, m, list, parent) {
  if (!list.length) return;
  const im = new THREE.InstancedMesh(g, m, list.length);
  const o = new THREE.Object3D();
  list.forEach((p, i) => {
    o.position.set(p[0], p[1], p[2]);
    o.scale.set(p[3], p[4], p[5]);
    o.rotation.set(p[7] || 0, p[6] || 0, p[8] || 0);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.frustumCulled = false;
  parent.add(im);
}
const POLE_Z = -14, POLE_GAP = 52;
const wireY = [6.85, 6.35];
function buildChunk(k) {
  const x0 = k * CHUNK, b = biomeAt(x0 + CHUNK / 2);
  const g = new THREE.Group();
  const r = rng(k * 7919 + b.length * 131);
  const L = { pole: [], arm: [], crown: [], cone: [], trunk: [], wall: [], roof: [], win: [], sodium: [], dark: [], reed: [] };
  // telegraph poles and their sagging wires, on a global grid
  const wires = [];
  for (let j = Math.ceil(x0 / POLE_GAP); j * POLE_GAP < x0 + CHUNK; j++) {
    const x = j * POLE_GAP;
    if (inTunnel(x) || nearStation(x)) continue;
    L.pole.push([x, 0, POLE_Z, 1, 1, 1]);
    L.arm.push([x, wireY[0], POLE_Z, 1, 1, 1], [x, wireY[1], POLE_Z, 0.7, 1, 1]);
    if (inTunnel(x + POLE_GAP) || nearStation(x + POLE_GAP)) continue;
    for (const [wi, y] of wireY.entries()) {
      for (const dx of wi ? [-0.25, 0.25] : [-0.7, -0.25, 0.25, 0.7]) {
        const pts = [];
        for (let s = 0; s <= 14; s++) {
          const u = s / 14;
          pts.push(new THREE.Vector3(x + u * POLE_GAP, y + 0.08 - 0.62 * 4 * u * (1 - u), POLE_Z + dx * 0.15));
        }
        wires.push(pts);
      }
    }
  }
  for (const pts of wires) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), M.wire));
  const free = (x) => !inTunnel(x);
  const n = (base) => Math.round(base * (lowEnd ? 0.45 : 1));
  if (b === 'fields' || b === 'lake') {
    // woods come and go in patches; the rest is open field with hedgerow trees
    const wood = b === 'fields' && r() < 0.55;
    const count = b === 'lake' ? 0 : n(wood ? 70 : 18);
    for (let i = 0; i < count; i++) {
      const x = x0 + r() * CHUNK, z = -(22 + Math.pow(r(), 0.8) * (b === 'lake' ? 6 : 150));
      if (!free(x)) continue;
      const h = 7 + r() * 9;
      if (r() < 0.45) {
        L.cone.push([x, 0, z, 1.4 + r() * 1.2, h * 1.15, 1.4 + r() * 1.2]);
      } else {
        const w = 2.2 + r() * 2.6;
        L.trunk.push([x, 0, z, 1, h * 0.45, 1]);
        L.crown.push([x, h * 0.62, z, w, h * 0.42, w]);
      }
    }
    if (b === 'fields' && r() < 0.42) {
      // a farmhouse, sometimes awake
      const x = x0 + 15 + r() * 70, z = -(45 + r() * 110), w = 9 + r() * 5, d = 7 + r() * 3, h = 5 + r() * 2;
      if (free(x)) {
        L.wall.push([x, 0, z, w, h, d]);
        L.roof.push([x, h, z, w * 1.05, h * 0.8, d * 1.1, 0]);
        const lit = r();
        for (let wi = 0; wi < 3; wi++) {
          if (r() < lit) L.win.push([x - w * 0.3 + wi * w * 0.3, h * (0.35 + 0.35 * (wi % 2)), z + d / 2 + 0.02, 0.8, 0.9, 1]);
        }
      }
    }
    if (b === 'lake') {
      for (let i = 0; i < n(60); i++) {
        const x = x0 + r() * CHUNK, z = -(7.5 + r() * 4.5), h = 0.7 + r() * 1.2;
        if (!free(x)) continue;
        for (let k = 0; k < 7; k++) L.reed.push([x + (r() - 0.5) * 0.5, 0, z + (r() - 0.5) * 0.4, 0.025, h * (0.6 + r() * 0.5), 0.025, 0, (r() - 0.5) * 0.35, (r() - 0.5) * 0.45]);
      }
    }
  } else if (b === 'city') {
    // the edge of the city: sheds, flats, sodium masts over the yard
    for (let i = 0; i < n(9); i++) {
      const x = x0 + r() * CHUNK, z = -(28 + r() * 120), w = 10 + r() * 22, d = 10 + r() * 14, h = 6 + Math.pow(r(), 2) * 30;
      if (!free(x)) continue;
      L.wall.push([x, 0, z, w, h, d]);
      const rows = Math.floor(h / 3.2), cols = Math.floor(w / 3.4);
      for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
        if (r() < 0.24) L.win.push([x - w / 2 + 1.7 + cx * 3.4, 1.6 + ry * 3.2, z + d / 2 + 0.03, 0.9, 1.1, 1]);
      }
    }
    for (let j = 0; j < 2; j++) {
      const x = x0 + 25 + j * 50 + r() * 10;
      if (!free(x) || nearStation(x)) continue;
      L.dark.push([x, 0, -14, 0.35, 16, 0.35]);
      L.sodium.push([x, 16, -14, 1.2, 0.3, 0.6]);
      const s = glow(0xffa040, 9, 1.4);
      s.position.set(x, 15.7, -14);
      g.add(s);
    }
  } else if (b === 'coast') {
    for (let i = 0; i < n(80); i++) {
      const x = x0 + r() * CHUNK;
      if (!free(x)) continue;
      for (let k = 0; k < 5; k++) L.reed.push([x + (r() - 0.5) * 0.6, 0, -(7 + r() * 8), 0.02, 0.3 + r() * 0.6, 0.02, 0, (r() - 0.5) * 0.6, (r() - 0.5) * 0.7]);
    }
  }
  instanced(geo.pole, M.pole, L.pole, g);
  instanced(geo.arm, M.pole, L.arm, g);
  instanced(geo.trunk, M.tree, L.trunk, g);
  instanced(geo.crown, M.tree, L.crown, g);
  instanced(geo.cone, M.conifer, L.cone, g);
  instanced(geo.box, M.wall, L.wall, g);
  instanced(geo.roof, M.roof, L.roof, g);
  instanced(geo.pane, M.window, L.win, g);
  instanced(geo.box, M.dark, L.dark, g);
  instanced(geo.box, M.sodium, L.sodium, g);
  instanced(geo.blade, M.reed, L.reed, g);
  world.add(g);
  return g;
}
function disposeGroup(g) {
  g.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    if (o.isLine) o.geometry.dispose();
    if (o.isSprite) o.material.dispose();
  });
  g.removeFromParent();
}
function updateChunks() {
  const k0 = Math.floor((T.x - 260) / CHUNK), k1 = Math.floor((T.x + 220) / CHUNK);
  for (const [k, g] of chunks) if (k < k0 || k > k1) { disposeGroup(g); chunks.delete(k); }
  for (let k = k0; k <= k1; k++) if (!chunks.has(k)) chunks.set(k, buildChunk(k));
}
function rebuildChunks() {
  for (const g of chunks.values()) disposeGroup(g);
  chunks.clear();
  updateChunks();
}

/* ---------- tunnels: where the country changes ---------- */
const tunnelMat = new THREE.ShaderMaterial({
  uniforms: { uCamX: { value: 0 }, uSmear: SMEAR, uLamp: { value: 1 } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `
    varying vec3 vW; uniform float uCamX, uSmear, uLamp;
    float h(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    float n(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      float sm = max(uSmear, 0.02);
      // soot-dark brick, smeared along the track
      float rock = n(vec2(vW.x / (1.0 + sm), vW.y) * 1.6) * 0.6 + n(vec2(vW.x / (0.3 + sm), vW.y * 4.0)) * 0.4;
      vec3 c = vec3(0.006, 0.0055, 0.005) * (0.6 + 0.8 * rock);
      // our own lit windows, thrown on the wall and travelling with us
      float wx = mod(vW.x - uCamX + 1.1, 2.6);
      float win = smoothstep(0.1, 0.35, wx) * smoothstep(1.6, 1.35, wx) * smoothstep(1.0, 1.3, vW.y) * smoothstep(2.9, 2.6, vW.y);
      c += vec3(0.022, 0.014, 0.007) * win * (0.3 + 0.7 * uLamp);
      // tunnel lamps every 24 m, streaked by speed
      float lx = mod(vW.x, 24.0) - 12.0;
      float along = clamp(lx, -sm * 0.5, sm * 0.5);
      float dl = length(vec2(lx - along, (vW.y - 4.2) * 1.2));
      c += vec3(2.6, 1.3, 0.4) * exp(-dl * dl * 30.0) * (0.25 / (0.25 + sm)) + vec3(0.12, 0.06, 0.02) * exp(-dl * 1.6);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const hillMat = new THREE.MeshLambertMaterial({ color: 0x07090b });
function buildTunnel(x0, len) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, 40), tunnelMat);
  wall.position.set(x0 + len / 2, 10, -3.1);
  g.add(wall);
  // the portal faces and the hill the line goes into
  for (const x of [x0, x0 + len]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9, 7), M.dark);
    p.position.set(x, 4.5, -6.6);
    g.add(p);
  }
  const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), hillMat);
  hill.scale.set(len / 2 + 30, 48, 110);
  hill.position.set(x0 + len / 2, -16, -120);
  g.add(hill);
  world.add(g);
  return g;
}

/* ---------- stations ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function nameBoard(name) {
  return canvasTex(1024, 180, (g, w, h) => {
    g.fillStyle = '#12224a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9d2c3';
    g.lineWidth = 10;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#ece5d8';
    g.font = '600 92px Karla, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name.toUpperCase(), w / 2, h / 2 + 4);
  });
}
function clockFace(hh, mm) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#efe8da';
    g.beginPath(); g.arc(128, 128, 122, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#1a1a1a';
    for (let i = 0; i < 12; i++) { g.save(); g.translate(128, 128); g.rotate((i * Math.PI) / 6); g.fillRect(-4, -110, 8, i % 3 ? 16 : 26); g.restore(); }
    const hand = (a, len, wdt) => { g.save(); g.translate(128, 128); g.rotate(a); g.fillRect(-wdt / 2, -len, wdt, len + 14); g.restore(); };
    hand(((hh % 12) + mm / 60) * Math.PI / 6, 62, 11);
    hand(mm * Math.PI / 30, 96, 7);
  });
}
// platform with lamp pools painted in (cheap baked light)
function platformTex(len, lamps, wet) {
  const pxm = Math.min(4096, len * 20) / len;              // pixels per metre along the platform
  return canvasTex(Math.round(len * pxm), 128, (g, w, h) => {
    const pzm = h / (PLAT_Z0 - PLAT_Z1);
    g.fillStyle = wet ? '#151311' : '#24211e';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    // flagstone joints
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 0; x < w; x += pxm * 1.2) g.fillRect(x, 0, 1.5, h * 0.84);
    for (const lx of lamps) {
      // a pool of lamplight about three metres across, under the lamp at the back of the platform
      const x = (lx / len + 0.5) * w;
      g.save();
      g.translate(x, h * 0.12);
      g.scale(pxm, pzm);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 3.4);
      gr.addColorStop(0, wet ? 'rgba(255,186,110,0.85)' : 'rgba(255,186,110,0.6)');
      gr.addColorStop(0.45, wet ? 'rgba(255,170,90,0.28)' : 'rgba(255,170,90,0.18)');
      gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr;
      g.fillRect(-4, -1, 8, 6);
      g.restore();
    }
    g.fillStyle = 'rgba(214, 178, 74, 0.55)';     // the line you stand behind
    g.fillRect(0, h * 0.86, w, h * 0.05);
    g.fillStyle = 'rgba(200, 196, 186, 0.35)';
    g.fillRect(0, h * 0.95, w, h * 0.05);
  });
}
const PLAT_Z0 = -1.0, PLAT_Z1 = -5.6, PLAT_Y = 0.95;
// Veldt's hall: brick, tall arched windows, warm light, one big clock-less arch
function hallTex() {
  return canvasTex(2048, 384, (g, w, h) => {
    g.fillStyle = '#1b1410';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) { g.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.1})`; g.fillRect(0, y, w, 1); }
    const bay = 96;
    for (let x = 24; x < w - bay; x += bay) {
      const lit = Math.random() < 0.72;
      const gx = x + 18, gw = bay - 36, gy = 70, gh = 230;
      const gr = g.createLinearGradient(0, gy, 0, gy + gh);
      gr.addColorStop(0, lit ? '#f2c27a' : '#2a201a');
      gr.addColorStop(1, lit ? '#b8743a' : '#1a140f');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(gx, gy + gh); g.lineTo(gx, gy + gw / 2); g.arc(gx + gw / 2, gy + gw / 2, gw / 2, Math.PI, 0); g.lineTo(gx + gw, gy + gh); g.closePath();
      g.fill();
      g.strokeStyle = '#120d0a';
      g.lineWidth = 4;
      g.beginPath();
      for (let k = 1; k < 3; k++) { g.moveTo(gx + (gw * k) / 3, gy + 10); g.lineTo(gx + (gw * k) / 3, gy + gh); }
      for (let k = 1; k < 5; k++) { g.moveTo(gx, gy + gw / 2 + ((gh - gw / 2) * k) / 5); g.lineTo(gx + gw, gy + gw / 2 + ((gh - gw / 2) * k) / 5); }
      g.stroke();
    }
    g.fillStyle = '#0e0a08';
    g.fillRect(0, h - 40, w, 40);
  });
}
function viewHalfAt(depth) { return depth * Math.tan(THREE.MathUtils.degToRad(outCam.fov / 2)) * outCam.aspect; }
function buildStation(kind, x) {
  const g = new THREE.Group();
  g.position.x = x;
  const vw = Math.max(1.4, viewHalfAt(4.6));
  const len = kind === 'larkspur' ? 70 : kind === 'veldt' ? 200 : 150;
  const half = len / 2;
  const wet = kind === 'veldt';
  const lamps = [];
  for (let lx = 0.78 * vw; lx < half; lx += 13) lamps.push(lx);
  for (let lx = 0.78 * vw - 13; lx > -half; lx -= 13) lamps.push(lx);
  const plat = new THREE.Mesh(new THREE.BoxGeometry(len, PLAT_Y, PLAT_Z0 - PLAT_Z1), [
    new THREE.MeshBasicMaterial({ color: 0x0b0a09 }), new THREE.MeshBasicMaterial({ color: 0x0b0a09 }),
    new THREE.MeshBasicMaterial({ map: platformTex(len, lamps, wet), color: new THREE.Color(0.32, 0.3, 0.28) }),
    new THREE.MeshBasicMaterial({ color: 0x050505 }),
    new THREE.MeshBasicMaterial({ color: 0x0e0c0a }), new THREE.MeshBasicMaterial({ color: 0x0e0c0a }),
  ]);
  plat.material[2].map.rotation = 0;
  plat.position.set(0, PLAT_Y / 2, (PLAT_Z0 + PLAT_Z1) / 2);
  g.add(plat);
  const lampMat = smearable(new THREE.MeshLambertMaterial({ color: 0x15130f }), 0.14);
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.3) });
  const lampsK = [];
  for (const lx of lamps) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.0, 8).translate(0, 1.5, 0), lampMat);
    post.position.set(lx, PLAT_Y, -4.9);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.3), headMat);
    head.position.set(lx, PLAT_Y + 3.02, -4.9);
    const gl = glow(0xffb870, 2.2, 1.4);
    gl.position.set(lx, PLAT_Y + 2.9, -4.85);
    g.add(post, head, gl);
    lampsK.push(gl);
    if (wet) {
      // the lamp again, broken up in the wet platform
      const ref = glow(0xffb870, 1, 0.9);
      ref.scale.set(0.9, 2.6, 1);
      ref.position.set(lx, PLAT_Y + 0.02, -3.6);
      g.add(ref);
      lampsK.push(ref);
    }
  }
  const signX = 0.12 * vw;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.46), new THREE.MeshBasicMaterial({ map: nameBoard(STATIONS[kind]), color: new THREE.Color(0.9, 0.9, 0.9) }));
  const dark = (w, h, d, x, y, z, mat = lampMat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
  if (kind === 'veldt' || kind === 'iskar') {
    // a long canopy on columns, lit from beneath
    const under = new THREE.MeshBasicMaterial({ color: kind === 'veldt' ? 0x2a1d12 : 0x1c1714 });
    dark(len * 0.8, 0.22, 5.4, 0, PLAT_Y + 4.25, -3.5, under);
    for (let cx = -len * 0.38; cx <= len * 0.38; cx += 9) dark(0.18, 4.2, 0.18, cx + 4, PLAT_Y + 2.1, -5.4);
  }
  board.position.set(signX, PLAT_Y + 1.85, -5.2);
  dark(0.08, 2.1, 0.08, signX - 1.15, PLAT_Y + 1.05, -5.25);
  dark(0.08, 2.1, 0.08, signX + 1.15, PLAT_Y + 1.05, -5.25);
  g.add(board);
  // a bench under the board
  dark(1.8, 0.08, 0.45, signX + (kind === 'larkspur' ? 0 : -2.2), PLAT_Y + 0.46, -4.6);
  dark(1.8, 0.4, 0.06, signX + (kind === 'larkspur' ? 0 : -2.2), PLAT_Y + 0.72, -4.82);
  const st = { kind, x, half, group: g, lamps: lampsK, signal: null, green: false };
  if (kind === 'veldt') {
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), new THREE.MeshBasicMaterial({ map: clockFace(22, 4), color: new THREE.Color(0.95, 0.92, 0.85) }));
    clock.position.set(signX + 2.3, PLAT_Y + 2.15, -5.15);
    dark(0.06, 1.6, 0.06, signX + 2.3, PLAT_Y + 0.8, -5.25);
    g.add(clock);
    // the station hall behind: arched windows, lit within
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(64, 12), new THREE.MeshBasicMaterial({ map: hallTex(), color: new THREE.Color(0.16, 0.14, 0.12) }));
    facade.position.set(0, 6, -12);
    g.add(facade);
  }
  if (kind === 'larkspur') {
    // a shelter, and the signal at the end of the platform
    const shed = dark(4.2, 2.6, 2.4, signX + vw * 1.5 + 2.5, PLAT_Y + 1.3, -7.4, new THREE.MeshLambertMaterial({ color: 0x15110e }));
    shed.material.transparent = false;
    instanced(geo.pane, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.33, 0.15) }), [[signX + vw * 1.5 + 2.5, PLAT_Y + 1.1, -6.18, 1.1, 0.8, 1]], g);
    const sx = signX + 0.62 * vw;
    dark(0.12, 2.6, 0.12, sx, PLAT_Y + 1.3, -5.9);
    dark(0.42, 0.9, 0.22, sx, PLAT_Y + 2.85, -5.8, new THREE.MeshLambertMaterial({ color: 0x0b0b0b }));
    const red = glow(0xff2a1a, 0.9, 2.6), green = glow(0x34ff8a, 0.9, 2.6);
    red.position.set(sx, PLAT_Y + 3.1, -5.66);
    green.position.set(sx, PLAT_Y + 2.66, -5.66);
    green.visible = false;
    g.add(red, green);
    st.signal = { red, green };
  }
  world.add(g);
  stations.push(st);
  return st;
}
function clearStations(keep, all = false) {
  for (let i = stations.length - 1; i >= 0; i--) {
    const s = stations[i];
    if (s === keep) continue;
    if (all || s.x < T.x - 320) { disposeGroup(s.group); stations.splice(i, 1); }
  }
}

/* ============================================================
   THE COMPARTMENT
   ============================================================ */
const cabin = new THREE.Scene();
const cabCam = new THREE.PerspectiveCamera(50, 1, 0.02, 10);
const WALL_Z = -0.6;
let cab = null;                     // the current window build
const lampLight = new THREE.PointLight(0xffb36b, 0.08, 2.2, 2);
cabin.add(lampLight);
const cabAmb = new THREE.HemisphereLight(0x2a3350, 0x120c08, 0.5);
cabin.add(cabAmb);
{
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x140c08);
  const blob = (x, y, z, s, c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 8), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); env.add(m); };
  blob(0.5, 1.5, 0.5, 0.6, 0xffc58a);
  blob(0, 0, -3, 1.6, 0x24304d);
  blob(-2, 0.4, 1, 0.8, 0x6b3a22);
  cabin.environment = pm.fromScene(env, 0.04).texture;
  pm.dispose();
}
function woodTex(base, lines) {
  const t = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * w;
      g.strokeStyle = `rgba(${lines}, ${0.08 + Math.random() * 0.18})`;
      g.lineWidth = 0.6 + Math.random() * 2.2;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 16) g.lineTo(x + Math.sin(y * 0.013 + i) * 7 + Math.sin(y * 0.05 + i * 3) * 1.6, y);
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const C = {
  wall: new THREE.MeshStandardMaterial({ map: woodTex('#3a1e14', '20, 8, 4'), roughness: 0.38, metalness: 0, color: 0xb59a8a }),
  trim: new THREE.MeshStandardMaterial({ color: 0xc09553, roughness: 0.26, metalness: 0.9 }),
  sill: new THREE.MeshStandardMaterial({ map: woodTex('#4a2818', '24, 10, 4'), roughness: 0.3, metalness: 0 }),
  curtain: new THREE.MeshPhysicalMaterial({ color: 0x3a0d1a, roughness: 0.86, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xd07a86), side: THREE.DoubleSide }),
  china: new THREE.MeshStandardMaterial({ color: 0xf1ece3, roughness: 0.22, metalness: 0 }),
  tea: new THREE.MeshStandardMaterial({ color: 0x3a1a08, roughness: 0.05, metalness: 0 }),
  shade: new THREE.MeshStandardMaterial({ color: 0xe9d2a8, roughness: 0.9, emissive: new THREE.Color(0xffb067), emissiveIntensity: 0.9, side: THREE.DoubleSide }),
};
const glassMat = new THREE.ShaderMaterial({
  uniforms: {
    uOut: { value: rtOut.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uExposure: { value: 2.2 },
    uLamp: { value: 1 }, uWet: { value: 1 }, uSpeed: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 },
    uRefl: { value: new THREE.Color(0.0065, 0.0042, 0.0026) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uOut; uniform vec2 uRes; uniform float uExposure, uLamp, uWet, uSpeed, uTime, uAspect; uniform vec3 uRefl;
    float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    vec2 h22(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
    // one layer of drops on the glass: returns refraction offset (xy) and coverage (z)
    vec3 drops(vec2 p, float cell, float seed) {
      // in a moving train the air throws the drops back along the glass
      float drift = uSpeed * 0.06;
      p.x += uTime * drift * (0.6 + 0.4 * seed);
      vec2 g = p / cell;
      vec2 id = floor(g), f = fract(g) - 0.5;
      float h = h21(id + seed * 17.0);
      if (h < 0.55) return vec3(0.0);
      vec2 o = (h22(id + seed) - 0.5) * 0.5;
      // stopped: some drops creep down; moving: they stretch out sideways
      float slide = fract(uTime * 0.05 * (0.4 + h) + h * 7.0);
      o.y -= (1.0 - smoothstep(0.0, 4.0, uSpeed)) * step(0.82, h) * (slide - 0.5) * 0.8;
      vec2 q = f - o;
      float stretch = 1.0 + clamp(uSpeed * 0.14, 0.0, 4.0);
      q.x /= stretch;
      float r = 0.14 + 0.18 * h21(id + 3.1 + seed);
      float d = length(q) / r;
      if (d > 1.0) {
        // a little trail of water left behind a moving drop
        float tr = smoothstep(0.06, 0.0, abs(q.y)) * step(0.0, q.x) * smoothstep(1.6 * stretch, 0.0, q.x / r) * clamp(uSpeed * 0.05, 0.0, 1.0);
        return vec3(0.0, 0.0, tr * 0.3);
      }
      vec2 n = q / r;
      float glint = pow(max(dot(normalize(vec3(n, sqrt(max(1.0 - dot(n, n), 0.0)))), normalize(vec3(-0.5, 0.6, 0.6))), 0.0), 40.0);
      return vec3(-n * r * cell * 0.9, 0.35 + smoothstep(0.75, 1.0, d) * 0.65 + glint * 6.0);
    }
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main() {
      vec2 suv = gl_FragCoord.xy / uRes;
      vec2 gp = vec2(vUv.x * uAspect, vUv.y);
      vec2 off = vec2(0.0);
      float cover = 0.0;
      if (uWet > 0.01) {
        vec3 a = drops(gp, 0.045, 1.0), b = drops(gp + 0.37, 0.022, 2.0);
        off = (a.xy + b.xy * 0.7) * uWet;
        cover = max(a.z, b.z) * uWet;
      }
      vec3 o = texture2D(uOut, suv + off * vec2(1.0 / uAspect, 1.0)).rgb;
      // drops pick up a little of the cabin light and darken at their rims
      o = o * (1.0 - min(cover, 1.0) * 0.22) + uRefl * cover * 2.0 * (0.3 + uLamp);
      // the glass: a faint, warm reflection of the lit compartment behind you
      float top = smoothstep(0.1, 1.0, vUv.y);
      vec3 refl = uRefl * (0.35 + 0.65 * top) * uLamp;
      refl += uRefl * 4.0 * exp(-pow(length((vUv - vec2(0.5, 0.92)) * vec2(uAspect, 1.0)) * 5.0, 2.0)) * uLamp;
      vec3 c = o * 0.93 + refl;
      c = aces(c * uExposure);
      gl_FragColor = vec4(toSRGB(c), 1.0);
    }`,
});
function roundRect(path, x0, y0, x1, y1, r) {
  path.moveTo(x0 + r, y0);
  path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r);
  path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1);
  path.lineTo(x0 + r, y1); path.quadraticCurveTo(x0, y1, x0, y1 - r);
  path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
  return path;
}
function curtain(x0, x1, y0, y1, side) {
  const w = x1 - x0, h = y1 - y0;
  const geo = new THREE.PlaneGeometry(w, h, 56, 30);
  const p = geo.attributes.position;
  const tie = y0 + h * 0.38 - (y0 + y1) / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const u = (x / w + 0.5);                        // 0 at the window-side edge for the left curtain
    const outer = side < 0 ? 0 : 1;
    const gather = 1 - 0.32 * Math.exp(-Math.pow((y - tie) / (h * 0.2), 2));
    const nx = side < 0 ? (u * gather - 0.5) * w : ((u - 1) * gather + 0.5) * w;
    const folds = Math.sin(u * Math.PI * 7 + side) * 0.007 * (1.2 - 0.4 * Math.abs(u - outer)) + Math.sin(u * Math.PI * 2.3) * 0.004;
    p.setXYZ(i, nx, y, folds + (1 - gather) * 0.012);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, C.curtain);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z + 0.035);
  return m;
}
function ticketTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#e9dcc0';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a2c2c';
    g.lineWidth = 6;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#2a2320';
    g.font = '600 46px "Playfair Display", serif';
    g.fillText('SOMNE', 40, 82);
    g.font = '500 26px Karla, sans-serif';
    g.fillText('VELDT CENTRAL  →  ISKAR COAST', 40, 132);
    g.fillText('22:04  ·  CAR 7  ·  BERTH 14', 40, 176);
    g.fillStyle = '#8a2c2c';
    g.font = '600 26px Karla, sans-serif';
    g.fillText('SLEEPER', 380, 82);
  });
}
const ticketMap = ticketTex();
document.fonts?.ready.then(() => { const t = ticketTex(); ticketMap.image = t.image; ticketMap.needsUpdate = true; });
function buildCabin() {
  if (cab) { cab.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); cab.removeFromParent(); }
  cab = new THREE.Group();
  const aspect = innerWidth / innerHeight;
  const hv = -WALL_Z * Math.tan(THREE.MathUtils.degToRad(cabCam.fov / 2)), hw = hv * aspect;
  const portrait = aspect < 0.85;
  const x0 = -hw * (portrait ? 0.9 : 0.87), x1 = -x0;
  const y0 = portrait ? -hv * 0.3 : -hv * 0.72, y1 = portrait ? hv * 0.8 : hv * 0.7;
  const r = 0.09 * Math.min(x1 - x0, y1 - y0);
  // the wall, with the window cut out
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-hw * 3, -hv * 3); wallShape.lineTo(hw * 3, -hv * 3); wallShape.lineTo(hw * 3, hv * 3); wallShape.lineTo(-hw * 3, hv * 3); wallShape.closePath();
  wallShape.holes.push(roundRect(new THREE.Path(), x0, y0, x1, y1, r));
  const wallGeo = new THREE.ShapeGeometry(wallShape, 12);
  const uv = wallGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.2, uv.getY(i) * 2.2);
  const wall = new THREE.Mesh(wallGeo, C.wall);
  wall.position.z = WALL_Z;
  cab.add(wall);
  // brass trim around the opening
  const e = 0.018;
  const trimShape = roundRect(new THREE.Shape(), x0 - e, y0 - e, x1 + e, y1 + e, r + e);
  trimShape.holes.push(roundRect(new THREE.Path(), x0, y0, x1, y1, r));
  const trim = new THREE.Mesh(new THREE.ExtrudeGeometry(trimShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 14 }), C.trim);
  trim.position.z = WALL_Z;
  cab.add(trim);
  // the glass, a little way back
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 0.02, y1 - y0 + 0.02), glassMat);
  glass.position.set(0, (y0 + y1) / 2, WALL_Z - 0.03);
  cab.add(glass);
  glassMat.uniforms.uAspect.value = (x1 - x0) / (y1 - y0);
  // velvet curtains, tied back
  const cw = (x1 - x0) * (portrait ? 0.08 : 0.06);
  cab.add(curtain(x0 - 0.035, x0 + cw, y0 - 0.03, y1 + 0.06, -1));
  cab.add(curtain(x1 - cw, x1 + 0.035, y0 - 0.03, y1 + 0.06, 1));
  for (const s of [-1, 1]) {
    const cord = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0035, 8, 20), C.trim);
    cord.position.set(s * (x1 - cw * 0.35), y0 + (y1 - y0) * 0.38, WALL_Z + 0.05);
    cab.add(cord);
  }
  // the sill: a ticket, a cup of tea
  const sill = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.08, 0.014, 0.12), C.sill);
  sill.position.set(0, y0 - 0.007 - e, WALL_Z + 0.06);
  cab.add(sill);
  const sillTop = y0 - e;
  const cupX = portrait ? x0 + 0.2 : x1 - (x1 - x0) * 0.25;
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.005, 32), C.china);
  saucer.position.set(cupX, sillTop + 0.0025, WALL_Z + 0.07);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.016, 0.032, 32, 1, true), C.china);
  cup.position.set(cupX, sillTop + 0.021, WALL_Z + 0.07);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.021, 32), C.tea);
  tea.rotation.x = -Math.PI / 2;
  tea.position.set(cupX, sillTop + 0.033, WALL_Z + 0.07);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0025, 8, 20, Math.PI * 1.3), C.china);
  handle.position.set(cupX + 0.024, sillTop + 0.022, WALL_Z + 0.07);
  handle.rotation.z = -Math.PI * 0.65;
  cab.add(saucer, cup, tea, handle);
  cab.userData.steam = new THREE.Vector3(cupX, sillTop + 0.04, WALL_Z + 0.07);
  const ticket = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshStandardMaterial({ map: ticketMap, roughness: 0.8 }));
  ticket.rotation.set(-Math.PI / 2, 0, 0.12);
  ticket.position.set(portrait ? x0 + 0.07 : x0 + (x1 - x0) * 0.2, sillTop + 0.001, WALL_Z + 0.075);
  cab.add(ticket);
  // the reading lamp above the window
  const lampPos = new THREE.Vector3(0, y1 + Math.min(0.05, (hv - y1) * 0.5), WALL_Z + 0.05);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 8), C.trim);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(lampPos.x, lampPos.y + 0.012, WALL_Z + 0.03);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.019, 0.018, 28, 1, true), C.shade);
  shade.position.copy(lampPos);
  if (!portrait) cab.add(arm, shade);       // on a phone the lamp is just out of sight above the window
  lampLight.position.copy(lampPos).add(new THREE.Vector3(0, -0.01, 0.02));
  cabin.add(cab);
  cab.userData.rect = { x0, x1, y0, y1, hv, hw };
}

/* ============================================================
   UI, LOOP
   ============================================================ */
const $ = (id) => document.getElementById(id);
const ui = { time: $('mf-time'), speed: $('mf-speed'), next: $('mf-next'), fill: $('route-fill'), train: $('route-train'), lamp: $('lamp') };
const state = { c: 0, cSmooth: 0, hour: 22.07, lamp: true, lampK: 1, wet: 1, dawn: 0, cityGlow: 1, active: -1, time: 0, cityEnd: 1e9 };
ui.lamp.addEventListener('click', () => {
  state.lamp = !state.lamp;
  ui.lamp.setAttribute('aria-pressed', String(state.lamp));
  ui.lamp.querySelector('span').textContent = state.lamp ? 'Reading lamp on' : 'Reading lamp off';
  if (reduceMotion) requestRender();
});
function fmtClock(h) {
  const mins = Math.floor(h * 60 + 1e-6);
  return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
let lastHud = '';
function hud() {
  // while we are running in to a platform, that platform is next
  const next = T.target && T.target.x - T.x > 0.5 ? STATIONS[T.target.kind] : T.target && T.target.kind === 'iskar' ? 'Terminus' : nextName(state.c);
  const s = `${fmtClock(state.hour)}|${Math.round(T.v * 3.6)}|${next}`;
  if (s !== lastHud) {
    ui.time.textContent = fmtClock(state.hour);
    ui.speed.textContent = `${Math.round(T.v * 3.6)} km/h`;
    ui.next.textContent = next;
    lastHud = s;
  }
  const r = pick(ROUTE, state.cSmooth) * 100;
  ui.fill.style.width = `${r}%`;
  ui.train.style.left = `${r}%`;
  const a = clamp(Math.round(state.c), 0, sections.length - 1);
  if (a !== state.active) {
    sections.forEach((s, i) => s.classList.toggle('aboard', i === a));
    state.active = a;
  }
}

/* ---------- the train ---------- */
const ACCEL = 1.25, BRAKE = 4.2;
function setBiome(b) {
  if (T.biome === b) return;
  const prev = T.biome;
  T.biome = b;
  SU.uLake.value = b === 'lake' ? 1 : 0;
  SU.uCoast.value = b === 'coast' ? 1 : 0;
  if (b === 'city') state.cityEnd = 1e9;
  else if (prev === 'city') state.cityEnd = T.x + 260;
}
function wantsTunnel(a, b) { return a !== b && (a === 'lake' || b === 'lake' || a === 'coast' || b === 'coast'); }
function driveTrain(dt, plan) {
  // the country: change it now, or behind a tunnel
  if (plan.biome !== T.biome && !tunnel) {
    if (wantsTunnel(T.biome, plan.biome) && !reduceMotion) {
      const x0 = T.x + Math.max(140, T.v * 4.5), len = Math.max(150, T.v * 6);
      tunnel = { x0, x1: x0 + len, to: plan.biome, switched: false, group: buildTunnel(x0, len) };
      rebuildChunks();
    } else {
      segments.push({ x: Math.floor((T.x + 220) / CHUNK + 1) * CHUNK, biome: plan.biome });
      if (segments.length > 8) segments.shift();
      setBiome(plan.biome);
      if (reduceMotion) { segments = [{ x: -Infinity, biome: plan.biome }]; rebuildChunks(); }
    }
  }
  if (tunnel && !tunnel.switched && T.x > tunnel.x0 + 10) {
    tunnel.switched = true;
    segments = [{ x: -Infinity, biome: tunnel.to }];
    setBiome(tunnel.to);
    clearStations(T.target, true);
    rebuildChunks();
  }
  if (tunnel && T.x > tunnel.x1 + 400) { disposeGroup(tunnel.group); tunnel = null; rebuildChunks(); }
  // stopping and starting
  if (plan.stop) {
    if (!T.target || T.target.kind !== plan.stop) {
      let at = T.x + Math.max(reduceMotion ? 0 : 140, (T.v * T.v) / (2 * BRAKE) + 4);
      if (tunnel && !tunnel.switched) at = Math.max(at, tunnel.x1 + 160);
      if (reduceMotion) at = T.x;
      T.target = buildStation(plan.stop, at);
      T.stoppedFor = 0;
      // the country around a platform is the platform's own, however fast you scrolled
      if (!tunnel || tunnel.switched) {
        segments.push({ x: at - T.target.half - 160, biome: plan.biome });
        segments.sort((a, b) => a.x - b.x);
        segments = segments.filter((sg, i) => i === 0 || sg.x <= at - T.target.half - 160 || sg.biome === plan.biome);
        setBiome(plan.biome);
      }
      rebuildChunks();
    }
    const rem = T.target.x - T.x;
    if (reduceMotion || rem < 0.03) {
      T.v = 0;
      T.x = T.target.x;
      T.stoppedFor += dt;
    } else {
      const vStop = Math.sqrt(2 * BRAKE * 0.8 * rem);
      T.v = Math.min(T.v + ACCEL * 1.6 * dt, vStop, 38);
      T.x = Math.min(T.x + T.v * dt, T.target.x);
    }
  } else {
    T.target = null;
    const vmax = plan.run;
    T.v = T.v < vmax ? Math.min(vmax, T.v + ACCEL * dt) : Math.max(vmax, T.v - 1.4 * dt);
    if (reduceMotion) T.v = 0;
    T.x += T.v * dt;
  }
  clearStations(T.target || null);
  // Larkspur's signal clears a moment after we stop
  for (const s of stations) {
    if (s.signal && s === T.target && T.stoppedFor > 2.4 && !s.green) {
      s.green = true;
      s.signal.red.visible = false;
      s.signal.green.visible = true;
    }
  }
}

/* ---------- frame ---------- */
const WARP = clamp(+new URLSearchParams(location.search).get('warp') || 1, 1, 8);
const clock = new THREE.Clock();
const fogCol = new THREE.Color();
function sizeAll() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  const fov = w / h < 0.85 ? 70 : 58;
  for (const cam of [outCam, cabCam]) { cam.fov = fov; cam.aspect = w / h; cam.updateProjectionMatrix(); }
  rtOut.setSize(Math.round(w * OUT_SCALE), Math.round(h * OUT_SCALE));
  glassMat.uniforms.uRes.value.set(w * DPR, h * DPR);
  SU.uPix.value = (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))) / (h * OUT_SCALE);
  buildCabin();
  measure();
}
let renderQueued = false;
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; step(0); });
}
function step(dt) {
  state.time += dt;
  state.c = chapterNow();
  state.cSmooth = reduceMotion ? state.c : lerp(state.cSmooth, state.c, 1 - Math.exp(-dt * 2.5));
  const plan = planFor(state.c);
  if (reduceMotion) {
    // stills: each chapter is its own place on the line
    const place = Math.round(clamp(state.c, 0, 5)) * 6000;
    if (Math.abs(T.x - place) > 1 && !plan.stop) { T.x = place; T.target = null; clearStations(null, true); rebuildChunks(); }
    if (plan.stop && (!T.target || T.target.kind !== plan.stop)) { T.x = place; T.target = null; clearStations(null, true); }
  }
  driveTrain(dt, plan);
  updateChunks();
  // the clock, the sky, the weather
  state.hour = pick(HOURS, state.cSmooth);
  state.dawn = smooth(28.9, 30.5, state.hour);
  const rainGoal = 1 - smooth(0.7, 1.6, state.cSmooth);
  state.wet = reduceMotion ? rainGoal : clamp(state.wet + (rainGoal - state.wet) * Math.min(1, dt * (rainGoal > state.wet ? 1.5 : 0.05 + T.v * 0.008)), 0, 1);
  const glowGoal = T.biome === 'city' ? 1 : 0;
  state.cityGlow = reduceMotion ? glowGoal : state.cityGlow + (glowGoal - state.cityGlow) * Math.min(1, dt * 0.25);
  state.lampK = reduceMotion ? (state.lamp ? 1 : 0) : state.lampK + ((state.lamp ? 1 : 0) - state.lampK) * Math.min(1, dt * 6);
  // camera: the carriage rides the rail joints
  const speedK = clamp(T.v / 30, 0, 1.3);
  const jp = (T.x / 25) % 1;
  const bob = reduceMotion ? 0 : (Math.exp(-jp * 26) - Math.exp(-((jp + 0.075) % 1) * 26) * 0.6) * 0.012 * speedK + Math.sin(state.time * 6.7) * 0.0025 * speedK;
  outCam.position.set(T.x, EYE + bob, 0);
  outCam.rotation.set(0, 0, reduceMotion ? 0 : Math.sin(state.time * 1.1) * 0.0018 * speedK);
  outCam.updateMatrixWorld();
  SMEAR.value = reduceMotion ? 0 : T.v / 50;
  // sky uniforms
  SU.uProjInv.value.copy(outCam.projectionMatrixInverse);
  SU.uCamWorld.value.copy(outCam.matrixWorld);
  SU.uCam.value.copy(outCam.position);
  SU.uTime.value = reduceMotion ? 7 : state.time;
  SU.uDawn.value = state.dawn;
  SU.uRain.value = rainGoal * 0.9 + state.wet * 0.1;
  SU.uCityGlow.value = state.cityGlow;
  SU.uCityEnd.value = state.cityEnd;
  SU.uBlur.value = SMEAR.value;
  tunnelMat.uniforms.uCamX.value = T.x;
  tunnelMat.uniforms.uLamp.value = state.lampK;
  // light outside follows the hour
  moonLight.intensity = 0.45 * (1 - state.dawn) * (1 - SU.uRain.value * 0.7) + 0.6 * state.dawn;
  moonLight.color.setRGB(lerp(0.68, 1.0, state.dawn), lerp(0.75, 0.72, state.dawn), lerp(0.88, 0.62, state.dawn));
  hemi.intensity = 0.5 + 0.9 * state.dawn;
  hemi.color.setRGB(lerp(0.15, 0.6, state.dawn), lerp(0.19, 0.42, state.dawn), lerp(0.29, 0.45, state.dawn));
  fogCol.setRGB(lerp(0.012, 0.3, state.dawn) + 0.022 * state.cityGlow, lerp(0.016, 0.17, state.dawn) + 0.011 * state.cityGlow, lerp(0.032, 0.17, state.dawn) + 0.004 * state.cityGlow);
  world.fog.color.copy(fogCol);
  world.fog.density = lerp(0.0055, 0.011, SU.uRain.value);
  for (const s of stations) for (const l of s.lamps) l.material.opacity = 1 - state.dawn * 0.6;
  renderer.setRenderTarget(rtOut);
  renderer.clear();
  renderer.render(world, outCam);
  renderer.setRenderTarget(null);
  // the compartment
  const atStation = T.target && Math.abs(T.target.x - T.x) < 30 ? 1 - Math.abs(T.target.x - T.x) / 30 : 0;
  const inT = tunnel && T.x > tunnel.x0 && T.x < tunnel.x1 ? 1 : 0;
  lampLight.intensity = 0.08 * state.lampK;
  C.shade.emissiveIntensity = 0.15 + 0.85 * state.lampK;
  cabAmb.intensity = 0.25 + 0.5 * state.dawn + 0.35 * atStation * (1 - state.dawn) - 0.15 * inT;
  cabAmb.color.setRGB(lerp(0.17, 0.75, state.dawn) + atStation * 0.3, lerp(0.2, 0.5, state.dawn) + atStation * 0.18, lerp(0.32, 0.5, state.dawn) + atStation * 0.05);
  const G = glassMat.uniforms;
  G.uTime.value = state.time;
  G.uSpeed.value = T.v;
  G.uWet.value = state.wet;
  G.uLamp.value = state.lampK;
  G.uExposure.value = lerp(2.6, 1.6, state.dawn) * (1 + (1 - state.lampK) * 0.35);
  renderer.render(cabin, cabCam);
  hud();
}
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05) * WARP;
  step(dt);
  requestAnimationFrame(loop);
}

addEventListener('resize', () => { sizeAll(); if (reduceMotion) requestRender(); });
sizeAll();
// the 22:04 is standing at Veldt Central when you arrive
T.target = buildStation('veldt', 0);
rebuildChunks();
document.fonts?.ready.then(() => { measure(); if (reduceMotion) requestRender(); });
if (reduceMotion) {
  addEventListener('scroll', requestRender, { passive: true });
  step(0);
} else {
  requestAnimationFrame(loop);
}
