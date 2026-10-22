import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/* ============================================================
   VECTOR DRIFT — the studio site is the cabinet
   A 3D neon runner: shader grid road, banded sun, scrolling
   wireframe ranges, a hull that banks, gates, sweepers, shards,
   near-miss multipliers and sectors that repaint the night.
   When nobody is playing, the cabinet runs its attract loop and
   an autopilot drives.
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const isSmall = () => window.innerWidth <= 720;
const HIGH = !(isSmall() || coarse || (navigator.hardwareConcurrency || 8) <= 4);

const $ = (s) => document.querySelector(s);
const el = {
  canvas: $('#game'), hud: $('#hud'), score: $('#score'), mult: $('#mult'), sector: $('#sector'), speed: $('#speed'),
  attract: $('#attract'), over: $('#over'), paused: $('#paused'), final: $('#final'), finalMeta: $('#final-meta'),
  initials: $('#initials'), initialsIn: $('#initials-in'), banner: $('#banner'), callouts: $('#callouts'),
  announce: $('#announce'), pauseBtn: $('#pause-btn'), mute: $('#mute'), start: $('#start'), restart: $('#restart'),
  toCabinet: $('#to-cabinet'), resume: $('#resume'), quit: $('#quit'), scores: $('#scores'),
};
const root = document.documentElement;

/* ============================================================
   High scores (kept in this browser only)
   ============================================================ */

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (err) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (err) { /* private mode */ } },
};
let table = store.get('vd-scores', null);
if (!Array.isArray(table) || table.length !== 5) {
  table = [{ n: 'NSG', s: 24000 }, { n: 'VEX', s: 16500 }, { n: 'ORA', s: 11000 }, { n: 'KAI', s: 6500 }, { n: 'LUX', s: 3000 }];
  const old = +store.get('vd-best', 0) || 0;   // the first cabinet only kept one number
  if (old > table[4].s) { table.push({ n: 'YOU', s: old }); table.sort((a, b) => b.s - a.s); table.length = 5; }
}
function renderScores(mark = -1) {
  el.scores.innerHTML = '';
  table.forEach((r, i) => {
    const li = document.createElement('li');
    if (i === mark) li.className = 'is-you';
    const b = document.createElement('b'); b.textContent = r.n;
    const s = document.createElement('span'); s.textContent = r.s.toLocaleString('en-US');
    li.append(b, s);
    el.scores.append(li);
  });
}
renderScores();

/* ============================================================
   Sound: opt-in, synthesised, nothing loaded
   ============================================================ */

const Sound = (() => {
  let ac = null, master, music, engine, engineFilter, engineGain, noise, timer = 0, step = 0, nextT = 0, on = false;
  const S16 = 60 / 112 / 4;
  const ROOTS = [45, 41, 48, 43];                 // A · F · C · G
  const ARP = [0, 12, 7, 12, 3, 12, 7, 15];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.5;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp).connect(ac.destination);
    music = ac.createGain(); music.gain.value = 0.45; music.connect(master);
    noise = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    engine = ac.createOscillator(); engine.type = 'sawtooth'; engine.frequency.value = 50;
    engineFilter = ac.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 400;
    engineGain = ac.createGain(); engineGain.gain.value = 0;
    engine.connect(engineFilter).connect(engineGain).connect(master);
    engine.start();
  }
  function tone(t, f, dur, type, vol, dest = master, cutoff = 0, slide = 0) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = o;
    if (cutoff) { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = cutoff; o.connect(f2); out = f2; }
    out.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function hiss(t, dur, vol, hp, dest = master, sweep = 0) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = hp ? 'highpass' : 'lowpass'; f.frequency.setValueAtTime(hp || 2400, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + dur + 0.02);
  }
  function schedule() {
    while (nextT < ac.currentTime + 0.12) {
      const bar = Math.floor(step / 16) % 4, s = step % 16, r = ROOTS[bar];
      tone(nextT, mtof(r + 12 + ARP[s % 8]), S16 * 0.8, 'square', 0.035, music, 1400);
      if (s % 4 === 0) tone(nextT, mtof(r), S16 * 3.6, 'triangle', 0.13, music);
      if (s % 2 === 1) hiss(nextT, 0.04, 0.03, 7000, music);
      if (s === 4 || s === 12) hiss(nextT, 0.16, 0.08, 0, music, 300);
      nextT += S16; step++;
    }
  }
  return {
    get on() { return on; },
    toggle() {
      on = !on;
      if (on) {
        if (!ac) init();
        ac.resume();
        nextT = ac.currentTime + 0.06;
        timer = setInterval(schedule, 25);
      } else {
        clearInterval(timer);
        if (ac) ac.suspend();
      }
      return on;
    },
    engine(speed, active) {
      if (!on) return;
      const t = ac.currentTime;
      engine.frequency.setTargetAtTime(36 + speed * 0.75, t, 0.12);
      engineFilter.frequency.setTargetAtTime(260 + speed * 14, t, 0.12);
      engineGain.gain.setTargetAtTime(active ? 0.03 : 0, t, 0.25);
    },
    duck(v) { if (on) music.gain.setTargetAtTime(v, ac.currentTime, 0.2); },
    sfx(name) {
      if (!on) return;
      const t = ac.currentTime;
      if (name === 'shard') { tone(t, 988, 0.07, 'square', 0.06); tone(t + 0.06, 1480, 0.12, 'square', 0.05); }
      else if (name === 'close') tone(t, 740, 0.07, 'sine', 0.09, master, 0, 220);
      else if (name === 'gate') { tone(t, 523, 0.07, 'square', 0.05); tone(t + 0.07, 784, 0.1, 'square', 0.05); }
      else if (name === 'sector') { tone(t, 330, 0.5, 'sawtooth', 0.05, master, 2200, 660); tone(t + 0.12, 495, 0.45, 'square', 0.03, master, 2400); }
      else if (name === 'start') tone(t, 220, 0.25, 'square', 0.06, master, 1800, 660);
      else if (name === 'crash') { hiss(t, 0.9, 0.22, 0, master, 120); tone(t, 180, 0.7, 'sawtooth', 0.09, master, 900, -150); }
    },
  };
})();

el.mute.addEventListener('click', toggleSound);
function toggleSound() {
  const on = Sound.toggle();
  el.mute.setAttribute('aria-pressed', String(on));
  el.mute.textContent = on ? 'SOUND ON' : 'SOUND OFF';
}

/* ============================================================
   Palettes: each sector repaints the night
   ============================================================ */

const PALETTES = [
  { name: 'MAGENTA HOUR', sunTop: '#ffd23d', sunBot: '#ff2e88', grid: '#ff3d9a', grid2: '#29e6ff', haze: '#3b0a4d', sky: '#07010f', mount: '#ff3d9a', hazard: '#ff3d9a', accent: '#29e6ff' },
  { name: 'CYAN DEEP', sunTop: '#c8fdff', sunBot: '#2a6cff', grid: '#29e6ff', grid2: '#8a5cff', haze: '#0a2448', sky: '#01030d', mount: '#29b8ff', hazard: '#ff4fa8', accent: '#ffd23d' },
  { name: 'GOLD RUSH', sunTop: '#fff3c0', sunBot: '#ff6a1a', grid: '#ffb02e', grid2: '#ff3d6e', haze: '#40140a', sky: '#0c0204', mount: '#ff8a2e', hazard: '#ff2e5a', accent: '#29e6ff' },
  { name: 'ULTRAVIOLET', sunTop: '#ffa6f4', sunBot: '#6a2cff', grid: '#b45cff', grid2: '#29ffd0', haze: '#1c0a40', sky: '#05010e', mount: '#b45cff', hazard: '#ff3d9a', accent: '#29ffd0' },
];
const KEYS = Object.keys(PALETTES[0]).filter((k) => k !== 'name');
const P = {}, PT = {};
for (const k of KEYS) { P[k] = new THREE.Color(PALETTES[0][k]); PT[k] = P[k].clone(); }
function setPalette(i) {
  const p = PALETTES[i % PALETTES.length];
  for (const k of KEYS) PT[k].set(p[k]);
  root.style.setProperty('--accent', p.accent);
  if (reduceMotion) for (const k of KEYS) P[k].copy(PT[k]);
}

/* ============================================================
   Renderer, or the marquee when there is no WebGL
   ============================================================ */

const hasGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (err) { return false; } })();
if (!hasGL) {
  root.classList.add('no-webgl');
  $('#no-gl').hidden = false;
  el.start.disabled = true;
} else {
  run();
}

function run() {
  let W = window.innerWidth, H = window.innerHeight;
  const DPR = Math.min(window.devicePixelRatio || 1, HIGH ? 1.75 : 1.5);
  const renderer = new THREE.WebGLRenderer({ canvas: el.canvas, antialias: !HIGH, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  if (!HIGH) root.classList.add('lofi');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.0062);
  scene.fog.color = P.haze;
  const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 1400);
  scene.add(camera);

  const U = { time: { value: 0 }, scroll: { value: 0 }, scrollG: { value: 0 }, fogD: { value: scene.fog.density } };
  const lineMats = [];
  const lineMat = (color, width, fog = true) => {
    const m = new LineMaterial({ color, linewidth: width, worldUnits: false, fog, transparent: true });
    lineMats.push(m);
    return m;
  };

  const GLSL_HASH = /* glsl */`
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }`;

  /* ---------- sky dome with stars ---------- */

  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uSky: { value: P.sky }, uHaze: { value: P.haze }, uTime: U.time },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: GLSL_HASH + /* glsl */`
      uniform vec3 uSky; uniform vec3 uHaze; uniform float uTime; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float e = d.y;
        vec3 col = mix(uHaze * 1.5, uSky, smoothstep(-0.02, 0.3, e));
        vec2 sp = vec2(atan(d.z, d.x) * 150.0, e * 170.0);
        vec2 cell = floor(sp), f = fract(sp) - 0.5;
        float h = hash12(cell);
        vec2 jitter = vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5;
        float star = step(0.982, h) * smoothstep(0.16, 0.0, length(f - jitter * 0.6));
        star *= smoothstep(0.03, 0.25, e) * (0.55 + 0.45 * sin(uTime * (0.8 + h * 3.0) + h * 50.0));
        col += vec3(0.85, 0.88, 1.0) * star * 0.9;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  sky.renderOrder = -2;
  scene.add(sky);

  /* ---------- the sun: bands that slide, a shimmer at its foot ---------- */

  const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { uTop: { value: P.sunTop }, uBot: { value: P.sunBot }, uTime: U.time },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform vec3 uTop; uniform vec3 uBot; uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        p.x += sin(p.y * 46.0 + uTime * 3.0) * 0.006 * smoothstep(0.0, -0.6, p.y);
        float r = length(p), R = 0.56;
        vec3 col = mix(uBot, uTop, smoothstep(-0.45, 0.5, p.y));
        float y = p.y / R;
        float band = 1.0;
        if (y < 0.3) {
          float k = 0.3 - y;
          float s = fract(k * 5.0 - uTime * 0.3);
          band = step(0.1 + k * 0.3, s);
        }
        float disc = smoothstep(R, R - 0.006, r) * band;
        float glow = exp(-max(r - R, 0.0) * 6.0) * 0.6 * (1.0 - smoothstep(R, R - 0.006, r));
        vec3 o = col * disc * 1.12 + mix(uBot, uTop, 0.25) * glow * 0.8;
        gl_FragColor = vec4(o, clamp(disc + glow, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, fog: false,
  }));
  sun.scale.set(330, 330, 1);
  sun.position.set(0, 66, -760);
  sun.renderOrder = -1;
  scene.add(sun);

  /* ---------- the grid road ---------- */

  const groundGeo = new THREE.PlaneGeometry(700, 900, 1, 1);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate(0, 0, -430);
  const ground = new THREE.Mesh(groundGeo, new THREE.ShaderMaterial({
    uniforms: { uGrid: { value: P.grid }, uGrid2: { value: P.grid2 }, uHaze: { value: P.haze }, uSunBot: { value: P.sunBot }, uScroll: U.scrollG, uFogD: U.fogD },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform vec3 uGrid; uniform vec3 uGrid2; uniform vec3 uHaze; uniform vec3 uSunBot; uniform float uScroll; uniform float uFogD;
      varying vec3 vW;
      float gridLine(float v, float period, float w){
        float d = abs(fract(v / period - 0.5) - 0.5) * period;
        float fw = fwidth(v);
        return (1.0 - smoothstep(0.0, fw * 1.4 + w, d)) * smoothstep(period * 0.5, period * 0.12, fw);
      }
      void main(){
        float x = vW.x, z = vW.z - uScroll;
        float road = 1.0 - smoothstep(6.0, 6.6, abs(x));
        float lx = gridLine(x + 1.2, road > 0.5 ? 2.4 : 4.8, 0.015);   // lane boundaries
        float lz = gridLine(z, 6.0, 0.02);
        float edge = 1.0 - smoothstep(0.0, fwidth(x) * 2.0 + 0.06, abs(abs(x) - 6.0));
        vec3 col = vec3(0.012, 0.004, 0.03) + uHaze * 0.12;
        col += uGrid * lx * mix(0.28, 0.75, road);
        col += uGrid2 * lz * mix(0.3, 0.75, road);
        col += uGrid2 * edge * 1.8;
        // the sun laid on the wet road
        float far = smoothstep(-60.0, -500.0, vW.z);
        col += uSunBot * exp(-abs(x) * 0.07) * far * 0.35;
        float dist = length(vW.xz - cameraPosition.xz);
        float keep = exp(-uFogD * uFogD * dist * dist);
        col = mix(uHaze * 1.2, col, keep);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  scene.add(ground);

  /* ---------- wireframe ranges, endless ---------- */

  const mountMat = new THREE.ShaderMaterial({
    uniforms: { uMount: { value: P.mount }, uHaze: { value: P.haze }, uScroll: U.scroll, uScrollG: U.scrollG, uFogD: U.fogD },
    vertexShader: GLSL_HASH + /* glsl */`
      uniform float uScroll; uniform float uScrollG;
      varying vec3 vW; varying float vH; varying float vZG;
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.07 + 13.1; a *= 0.5; } return s; }
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        float zw = w.z - uScroll;
        float side = abs(w.x);
        float rise = smoothstep(13.0, 46.0, side);
        float ridge = 1.0 - abs(vnoise(vec2(w.x * 0.012, zw * 0.012)) * 2.0 - 1.0);
        float h = (fbm(vec2(w.x * 0.03, zw * 0.03)) * 0.65 + ridge * ridge * 0.6) * 62.0 * rise;
        h *= 0.55 + 0.45 * smoothstep(40.0, 160.0, side);
        w.y = h - 0.5;
        vW = w.xyz; vH = h; vZG = w.z - uScrollG;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uMount; uniform vec3 uHaze; uniform float uFogD;
      varying vec3 vW; varying float vH; varying float vZG;
      float gridLine(float v, float period){
        float d = abs(fract(v / period - 0.5) - 0.5) * period;
        float fw = fwidth(v);
        return (1.0 - smoothstep(0.0, fw * 1.3 + 0.02, d)) * smoothstep(period * 0.5, period * 0.1, fw);
      }
      void main(){
        float l = max(gridLine(vW.x, 5.0), gridLine(vZG, 5.0));
        vec3 col = vec3(0.01, 0.003, 0.025);
        col += uMount * l * (0.22 + 0.62 * smoothstep(4.0, 50.0, vH));
        float dist = length(vW.xz - cameraPosition.xz);
        float keep = exp(-uFogD * uFogD * dist * dist * 0.55);
        col = mix(uHaze * 1.3, col, keep);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  for (const sx of [-1, 1]) {
    const g = new THREE.PlaneGeometry(300, 900, HIGH ? 120 : 70, HIGH ? 200 : 110);
    g.rotateX(-Math.PI / 2);
    g.translate(sx * 158, 0, -430);
    const m = new THREE.Mesh(g, mountMat);
    m.frustumCulled = false;
    scene.add(m);
  }

  /* ---------- speed streaks ---------- */

  const STREAKS = HIGH ? 160 : 70;
  const streakPos = new Float32Array(STREAKS * 6);
  const streakSeed = Array.from({ length: STREAKS }, () => ({ x: 0, y: 0, z: 0 }));
  const respawnStreak = (s, z) => {
    const side = Math.random() < 0.5 ? -1 : 1;
    s.x = side * (2 + Math.pow(Math.random(), 0.7) * 34);
    s.y = 0.3 + Math.random() * 16;
    s.z = z;
  };
  streakSeed.forEach((s) => respawnStreak(s, -Math.random() * 220));
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streakMat = new THREE.LineBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  streaks.frustumCulled = false;
  scene.add(streaks);

  /* ---------- the hull ---------- */

  const ship = new THREE.Group();
  const hullGeo = new THREE.BufferGeometry();
  {
    const v = [
      0, 0.16, -1.7,     // 0 nose
      -1.15, 0, 0.75,    // 1 left tip
      1.15, 0, 0.75,     // 2 right tip
      0, 0.02, 0.6,      // 3 tail
      0, 0.46, 0.15,     // 4 canopy ridge
      0, -0.16, 0.1,     // 5 keel
      -1.0, 0.4, 0.85,   // 6 left fin
      1.0, 0.4, 0.85,    // 7 right fin
      -0.85, 0.02, 0.35, // 8 left fin root
      0.85, 0.02, 0.35,  // 9 right fin root
    ];
    const idx = [0, 1, 4, 0, 4, 2, 4, 1, 3, 4, 3, 2, 0, 5, 1, 0, 2, 5, 5, 3, 1, 5, 2, 3, 1, 6, 8, 2, 9, 7];
    hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    hullGeo.setIndex(idx);
    hullGeo.computeVertexNormals();
  }
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshBasicMaterial({ color: 0x0a0214, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: THREE.DoubleSide }));
  const hullEdges = new THREE.EdgesGeometry(hullGeo, 1);
  const shipLines = new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(hullEdges), lineMat(0x29e6ff, HIGH ? 2.2 : 2.6));
  ship.add(hull, shipLines);
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const engineGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x29e6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  engineGlow.position.set(0, 0.08, 0.85);
  engineGlow.material.opacity = 0.75;
  ship.add(engineGlow);
  ship.scale.setScalar(0.95);
  scene.add(ship);

  // wingtip ribbons, laid flat behind the hull
  const TRAIL = 8;
  const trails = [-0.94, 0.94].map((ox) => {
    const pos = new Float32Array(TRAIL * 2 * 3), a = new Float32Array(TRAIL * 2);
    const idx = [];
    for (let i = 0; i < TRAIL - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    for (let i = 0; i < TRAIL; i++) a[i * 2] = a[i * 2 + 1] = Math.pow(1 - i / (TRAIL - 1), 1.6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aA', new THREE.BufferAttribute(a, 1));
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: P.accent } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol * vA * 1.4, vA);\n#include <colorspace_fragment>\n}',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { ox, pts: [], pos, mesh };
  });

  /* ---------- hazards and shards, pooled ---------- */

  // neon cuts through the haze: hazard edges ignore fog so they read from far off
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x1a0626, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const hazardLines = lineMat(0xff3d9a, HIGH ? 2.4 : 2.8, false);
  const shardLines = lineMat(0xffd23d, HIGH ? 2.2 : 2.6, false);
  const padMat = new THREE.MeshBasicMaterial({ color: 0xff3d9a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const padGeo = new THREE.RingGeometry(0.9, 1.25, 4, 1, Math.PI / 4);
  padGeo.rotateX(-Math.PI / 2);
  padGeo.translate(0, 0.03, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3d9a, fog: false });
  const railMat = new THREE.MeshBasicMaterial({ color: 0xff3d9a, transparent: true, opacity: 0.35, fog: true, depthWrite: false });

  const pylonGeo = new THREE.ConeGeometry(0.72, 2.7, 4, 1);
  pylonGeo.rotateY(Math.PI / 4);
  pylonGeo.translate(0, 1.35, 0);
  const pylonEdges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(pylonGeo));
  const droneGeo = new THREE.IcosahedronGeometry(0.66, 0);
  const droneEdges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(droneGeo));
  const shardGeo = new THREE.OctahedronGeometry(0.46);
  const shardEdges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(shardGeo));
  const postGeo = new THREE.BoxGeometry(0.16, 2.1, 0.16);
  postGeo.translate(0, 1.05, 0);
  const beamGeo = new THREE.BoxGeometry(1, 0.07, 0.07);

  const pools = { pylon: [], drone: [], shard: [], gate: [] };
  function make(kind) {
    const g = new THREE.Group();
    if (kind === 'pylon') g.add(new THREE.Mesh(pylonGeo, darkMat), new LineSegments2(pylonEdges, hazardLines), new THREE.Mesh(padGeo, padMat));
    else if (kind === 'drone') {
      const body = new THREE.Group();
      body.add(new THREE.Mesh(droneGeo, darkMat), new LineSegments2(droneEdges, hazardLines));
      body.position.y = 0.95;
      g.add(body);
      const pad = new THREE.Mesh(padGeo, padMat);
      body.add(pad);
      pad.position.y = -0.92;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.03), railMat);
      rail.position.y = 0.04;
      g.add(rail);
      g.userData.body = body; g.userData.rail = rail;
    } else if (kind === 'shard') {
      const body = new THREE.Group();
      body.add(new THREE.Mesh(shardGeo, darkMat), new LineSegments2(shardEdges, shardLines));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd23d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
      glow.scale.setScalar(2.2);
      body.add(glow);
      body.position.y = 1.0;
      g.add(body);
      g.userData.body = body;
    } else if (kind === 'gate') {
      g.userData.posts = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(postGeo, beamMat); g.add(m); return m; });
      g.userData.beams = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(beamGeo, beamMat); g.add(m); return m; });
    }
    scene.add(g);
    return g;
  }
  function take(kind) {
    const g = pools[kind].pop() || make(kind);
    g.visible = true;
    return g;
  }
  function give(e) {
    e.obj.visible = false;
    pools[e.kind].push(e.obj);
  }

  /* ---------- sparks: shard pickups, the crash ---------- */

  const SPARKS = 220;
  const sparkPos = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS), sparkVel = new Float32Array(SPARKS * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('aLife', new THREE.BufferAttribute(sparkLife, 1));
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 1 }, uMap: { value: glowTex } },
    vertexShader: 'uniform float uPx; attribute float aLife; varying float vL; void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uPx * (2.0 + 9.0 * aLife) * (14.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D uMap; varying float vL; void main(){ float a = texture2D(uMap, gl_PointCoord).a * vL; gl_FragColor = vec4(vec3(1.0, 0.86, 0.35) * a * 1.6, a);\n#include <colorspace_fragment>\n}',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  let sparkIx = 0;
  function burst(x, y, z, n, spread) {
    for (let k = 0; k < n; k++) {
      const i = sparkIx++ % SPARKS;
      sparkPos[i * 3] = x; sparkPos[i * 3 + 1] = y; sparkPos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const s = spread * (0.4 + Math.random() * 0.6);
      sparkVel[i * 3] = Math.cos(a) * Math.cos(b) * s; sparkVel[i * 3 + 1] = Math.sin(b) * s + 1.5; sparkVel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
      sparkLife[i] = 1;
    }
  }

  // the hull comes apart along its edges
  const shardsOfHull = (() => {
    const src = hullEdges.attributes.position.array;
    const n = src.length / 6;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(src.length);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x29e6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat);
    lines.visible = false;
    lines.frustumCulled = false;
    scene.add(lines);
    const segs = Array.from({ length: n }, () => ({ c: new THREE.Vector3(), a: new THREE.Vector3(), v: new THREE.Vector3(), axis: new THREE.Vector3(), w: 0, ang: 0 }));
    const tmp = new THREE.Vector3(), q = new THREE.Quaternion();
    return {
      start() {
        ship.updateMatrixWorld();
        for (let i = 0; i < n; i++) {
          const s = segs[i];
          const p0 = new THREE.Vector3(src[i * 6], src[i * 6 + 1], src[i * 6 + 2]).applyMatrix4(ship.matrixWorld);
          const p1 = new THREE.Vector3(src[i * 6 + 3], src[i * 6 + 4], src[i * 6 + 5]).applyMatrix4(ship.matrixWorld);
          s.c.copy(p0).add(p1).multiplyScalar(0.5);
          s.a.copy(p1).sub(p0).multiplyScalar(0.5);
          s.v.copy(s.c).sub(ship.position).normalize().multiplyScalar(3 + Math.random() * 6);
          s.v.y += 2 + Math.random() * 3; s.v.z += 4;
          s.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
          s.w = (Math.random() - 0.5) * 12; s.ang = 0;
        }
        mat.color.copy(P.accent);
        mat.opacity = 1;
        lines.visible = true;
      },
      update(dt) {
        if (!lines.visible) return;
        for (let i = 0; i < n; i++) {
          const s = segs[i];
          s.v.y -= 9 * dt;
          s.c.addScaledVector(s.v, dt);
          s.ang += s.w * dt;
          q.setFromAxisAngle(s.axis, s.ang);
          tmp.copy(s.a).applyQuaternion(q);
          pos[i * 6] = s.c.x - tmp.x; pos[i * 6 + 1] = s.c.y - tmp.y; pos[i * 6 + 2] = s.c.z - tmp.z;
          pos[i * 6 + 3] = s.c.x + tmp.x; pos[i * 6 + 4] = s.c.y + tmp.y; pos[i * 6 + 5] = s.c.z + tmp.z;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = Math.max(0, mat.opacity - dt * 0.5);
        if (mat.opacity <= 0) lines.visible = false;
      },
      hide() { lines.visible = false; },
    };
  })();

  /* ---------- post: bloom and a CRT ---------- */

  let composer = null, crtPass = null, bloom = null;
  if (HIGH) {
    const rt = new THREE.WebGLRenderTarget(W * DPR, H * DPR, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(DPR);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.62, 0.5, 0.32);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    crtPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(W * DPR, H * DPR) }, uWarp: { value: reduceMotion ? 0.5 : 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uWarp; varying vec2 vUv;
        void main(){
          vec2 c = vUv - 0.5;
          float r2 = dot(c, c);
          vec2 uv = 0.5 + c * (1.0 + uWarp * 0.075 * r2);
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
          vec2 off = c * 0.0035 * uWarp;
          vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
          col *= 0.9 + 0.1 * sin(uv.y * uRes.y * 1.5708);
          col *= 1.0 - r2 * 0.85;
          col += (fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.025;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    composer.addPass(crtPass);
  }

  /* ============================================================
     Game state
     ============================================================ */

  const LANES = [-4.8, -2.4, 0, 2.4, 4.8];
  const LIM = 5.3;
  const SPAWN_Z = -240;
  const S = {
    mode: 'attract', x: 0, goal: 0, steerVel: 0, speed: 34, dist: 0, gameT: 0,
    score: 0, chain: 0, mult: 1, chainT: 0, sector: 1, near: 0, shardsGot: 0,
    nextSpawn: 50, timeScale: 1, shake: 0, autoT: 0, flash: 0,
  };
  const ents = [];
  const keys = {};
  const sectorAt = (n) => 4000 * (n - 1) + 1000 * (n - 1) * (n - 2);

  function clearEnts() { while (ents.length) give(ents.pop()); }

  function addEnt(kind, x, z, extra = {}) {
    const e = { kind, x, z, obj: take(kind), passed: false, ...extra };
    e.obj.position.set(x, 0, z);
    ents.push(e);
    return e;
  }
  function addGate(gx, gh, z) {
    const e = addEnt('gate', 0, z, { gx, gh });
    const { posts, beams } = e.obj.userData;
    const spans = [[-6.4, gx - gh], [gx + gh, 6.4]].filter(([a, b]) => b - a > 0.2);
    posts.forEach((p) => { p.visible = false; });
    beams.forEach((b) => { b.visible = false; });
    let pi = 0, bi = 0;
    for (const [a, b] of spans) {
      for (const px of [a, b]) { const p = posts[pi++]; p.visible = true; p.position.set(px, 0, 0); }
      for (const y of [0.45, 1.05, 1.65]) { const m = beams[bi++]; m.visible = true; m.position.set((a + b) / 2, y, 0); m.scale.x = b - a; }
    }
    return e;
  }

  /* patterns: one is chosen per spawn, weighted by sector */
  function spawnPattern(attract, z0 = SPAWN_Z) {
    const sec = attract ? 1 : S.sector;
    const lane = () => LANES[Math.floor(Math.random() * 5)];
    const w = {
      single: 3, pair: sec >= 1 ? 1.6 : 0, gate: 0.9 + sec * 0.35, shards: 1.3,
      drone: sec >= 2 ? 0.8 + sec * 0.3 : 0, slalom: sec >= 2 ? 1 : 0, wall: sec >= 3 ? 0.6 + sec * 0.15 : 0,
      zigzag: sec >= 3 ? 0.5 + sec * 0.15 : 0,
    };
    let roll = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
    let pick = 'single';
    for (const [k, v] of Object.entries(w)) { if ((roll -= v) <= 0) { pick = k; break; } }
    const z = z0;
    if (pick === 'single') {
      const l = lane();
      addEnt('pylon', l, z);
      if (Math.random() < 0.5) { let s = lane(); if (s === l) s = LANES[(LANES.indexOf(l) + 2) % 5]; addEnt('shard', s, z - 6); }
      return 10;
    }
    if (pick === 'pair') {
      const a = Math.floor(Math.random() * 5); let b = Math.floor(Math.random() * 5); if (b === a) b = (a + 2) % 5;
      addEnt('pylon', LANES[a], z); addEnt('pylon', LANES[b], z);
      return 12;
    }
    if (pick === 'gate') {
      const gh = sec <= 2 ? 2.4 : 1.45;
      const gx = sec <= 2 ? (Math.random() < 0.5 ? -1.2 : 1.2) + (Math.random() < 0.5 ? -1.2 : 1.2) : lane();
      addGate(THREE.MathUtils.clamp(gx, -6.4 + gh, 6.4 - gh), gh, z);
      addEnt('shard', THREE.MathUtils.clamp(gx, -4.8, 4.8), z - 2.5);
      return 18;
    }
    if (pick === 'shards') {
      const l = lane();
      for (let k = 0; k < 4; k++) addEnt('shard', l, z - k * 5);
      return 24;
    }
    if (pick === 'drone') {
      const amp = 2.4 + Math.random() * 1.6;
      const cx = THREE.MathUtils.clamp(lane(), -6 + amp, 6 - amp);
      const e = addEnt('drone', cx, z, { cx, amp, w: 1.1 + Math.random() * 0.6 + sec * 0.08, ph: Math.random() * 6.28 });
      e.obj.userData.rail.scale.x = amp * 2 + 1.3;
      return 16;
    }
    if (pick === 'slalom') {
      // a spine down the middle with gates of pylons stepping out to either side
      const flip = Math.random() < 0.5 ? 1 : 3;
      for (let k = 0; k < 4; k++) {
        addEnt('pylon', LANES[2], z - k * 15);
        addEnt('pylon', LANES[(k % 2) ? 4 - flip : flip], z - k * 15);
      }
      addEnt('shard', LANES[flip === 1 ? 0 : 4], z - 22);
      return 60;
    }
    if (pick === 'zigzag') {
      // rows of four with the gap swinging across: you have to move
      const gaps = Math.random() < 0.5 ? [0, 3, 1] : [4, 1, 3];
      const step = Math.max(30, S.speed * 0.5);
      gaps.forEach((g, k) => {
        LANES.forEach((x, i) => { if (i !== g) addEnt('pylon', x, z - k * step); });
        addEnt('shard', LANES[g], z - k * step);
      });
      return step * 2 + 10;
    }
    // wall: four pylons abreast, one lane open
    const open = Math.floor(Math.random() * 5);
    LANES.forEach((x, i) => { if (i !== open) addEnt('pylon', x, z); });
    addEnt('shard', LANES[open], z);
    return 16;
  }

  /* ---------- callouts, banner, HUD ---------- */

  const vProj = new THREE.Vector3();
  function callout(text, x, y, z, color) {
    if (el.callouts.childElementCount > 6) el.callouts.firstElementChild.remove();
    vProj.set(x, y, z).project(camera);
    const d = document.createElement('div');
    d.className = 'callout';
    d.textContent = text;
    d.style.left = `${(vProj.x * 0.5 + 0.5) * W}px`;
    d.style.top = `${(-vProj.y * 0.5 + 0.5) * H}px`;
    d.style.setProperty('--c', color);
    el.callouts.append(d);
    setTimeout(() => d.remove(), 1200);
  }
  function banner(big, small) {
    el.banner.innerHTML = '';
    el.banner.append(document.createTextNode(big));
    if (small) { const s = document.createElement('small'); s.textContent = small; el.banner.append(s); }
    el.banner.classList.remove('show');
    void el.banner.offsetWidth;
    el.banner.classList.add('show');
  }
  const shown = {};
  function setText(node, key, v) { if (shown[key] !== v) { shown[key] = v; node.textContent = v; } }
  function hud() {
    setText(el.score, 'score', Math.floor(S.score).toLocaleString('en-US'));
    const m = `×${S.mult}`;
    if (shown.mult !== m && shown.mult !== undefined) { el.mult.parentElement.classList.remove('bump'); void el.mult.offsetWidth; el.mult.parentElement.classList.add('bump'); }
    setText(el.mult, 'mult', m);
    setText(el.sector, 'sector', String(S.sector).padStart(2, '0'));
    setText(el.speed, 'speed', S.mode === 'play' ? String(Math.round(S.speed * 9)) : '—');
  }

  function addChain(n) {
    S.chain += n;
    S.chainT = 0;
    S.mult = Math.min(8, 1 + Math.floor(S.chain / 3));
  }

  /* ---------- modes ---------- */

  function setMode(m) {
    S.mode = m;
    root.classList.toggle('playing', m === 'play' || m === 'paused');
    root.classList.toggle('attract-on', m === 'attract');
    el.pauseBtn.hidden = !(m === 'play' && coarse);
  }

  function startGame() {
    if (S.mode === 'play') return;
    clearEnts();
    shardsOfHull.hide();
    Object.assign(S, { x: 0, goal: 0, steerVel: 0, speed: 42, dist: 0, gameT: 0, score: 0, chain: 0, mult: 1, chainT: 0, sector: 1, near: 0, shardsGot: 0, nextSpawn: 70, timeScale: 1, shake: 0 });
    setPalette(0);
    ship.visible = true;
    trails.forEach((t) => { t.pts.length = 0; });
    el.attract.classList.add('off');
    el.attract.inert = true; // faded out, so out of the tab order and the accessibility tree
    el.over.hidden = true;
    el.paused.hidden = true;
    setMode('play');
    el.canvas.focus({ preventScroll: true });
    Sound.sfx('start');
    Sound.duck(0.3);
    banner('SECTOR 01', PALETTES[0].name);
  }

  function crash() {
    setMode('dying');
    Sound.sfx('crash');
    burst(S.x, 0.8, 0, 60, 9);
    shardsOfHull.start();
    ship.visible = false;
    if (!reduceMotion) { S.timeScale = 0.22; S.shake = 1; }
    el.announce.textContent = `Signal lost. Score ${Math.floor(S.score).toLocaleString('en-US')}.`;
    setTimeout(showOver, reduceMotion ? 700 : 1500);
  }

  function showOver() {
    S.timeScale = 1;
    setMode('over');
    const sc = Math.floor(S.score);
    el.final.textContent = sc.toLocaleString('en-US');
    el.finalMeta.textContent = `sector ${String(S.sector).padStart(2, '0')} · ${S.near} near misses · ${S.shardsGot} shards · cabinet record ${Math.max(sc, table[0].s).toLocaleString('en-US')}`;
    el.over.hidden = false;
    const qualifies = sc > table[4].s;
    el.initials.hidden = !qualifies;
    el.initialsIn.value = '';
    Sound.duck(0.45);
    if (qualifies) el.initialsIn.focus(); else el.restart.focus();
  }

  el.initials.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = (el.initialsIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'YOU').slice(0, 3);
    const entry = { n, s: Math.floor(S.score) };
    table.push(entry);
    table.sort((a, b) => b.s - a.s);
    table.length = 5;
    store.set('vd-scores', table);
    renderScores(table.indexOf(entry));
    el.initials.hidden = true;
    el.announce.textContent = `${n} signed the cabinet.`;
    el.restart.focus();
  });

  function toCabinet(card = 0) {
    setMode('attract');
    el.over.hidden = true;
    el.paused.hidden = true;
    el.attract.classList.remove('off');
    el.attract.inert = false;
    clearEnts();
    shardsOfHull.hide();
    ship.visible = true;
    S.speed = 34; S.score = 0; S.mult = 1; S.sector = 1;
    setPalette(0);
    showCard(card);
    Sound.duck(0.45);
    if (reduceMotion) stillLife(); else prefill();
    el.start.focus();
  }

  function pause() {
    if (S.mode !== 'play') return;
    setMode('paused');
    el.paused.hidden = false;
    Sound.engine(0, false);
    Sound.duck(0.15);
    el.resume.focus();
  }
  function resume() {
    if (S.mode !== 'paused') return;
    el.paused.hidden = true;
    setMode('play');
    Sound.duck(0.3);
    el.canvas.focus({ preventScroll: true });
  }

  el.start.addEventListener('click', startGame);
  el.restart.addEventListener('click', startGame);
  el.toCabinet.addEventListener('click', () => toCabinet(1));
  el.resume.addEventListener('click', resume);
  el.quit.addEventListener('click', () => toCabinet(0));
  el.pauseBtn.addEventListener('click', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  /* ---------- attract cards ---------- */

  const cards = [...document.querySelectorAll('.card')];
  const dots = [...document.querySelectorAll('.dot')];
  let cardIx = 0, cardT = 0, cardHold = false;
  function showCard(i) {
    cardIx = (i + cards.length) % cards.length;
    cards.forEach((c, k) => c.classList.toggle('is-on', k === cardIx));
    dots.forEach((d, k) => d.setAttribute('aria-pressed', String(k === cardIx)));
    cardT = 0;
  }
  dots.forEach((d) => d.addEventListener('click', () => showCard(+d.dataset.go)));
  el.attract.addEventListener('pointerenter', () => { cardHold = true; });
  el.attract.addEventListener('pointerleave', () => { cardHold = false; });
  el.attract.addEventListener('focusin', () => { cardHold = true; });
  el.attract.addEventListener('focusout', () => { cardHold = false; });

  /* ---------- input ---------- */

  const STEER = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };
  window.addEventListener('keydown', (e) => {
    if (e.target === el.initialsIn) return;
    const k = e.key;
    if (k === 'm' || k === 'M') { toggleSound(); return; }
    if (S.mode === 'play') {
      if (k === 'p' || k === 'P' || k === 'Escape') { e.preventDefault(); pause(); return; }
      if (k in STEER) { keys[k] = true; e.preventDefault(); }
    } else if (S.mode === 'paused') {
      if (k === 'p' || k === 'P' || k === 'Escape') { e.preventDefault(); resume(); }
    } else if (S.mode === 'attract' || S.mode === 'over') {
      const onControl = e.target.closest && e.target.closest('button, a, input');
      if ((k === ' ' || k === 'Enter') && !onControl) { e.preventDefault(); startGame(); }
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  let drag = null;
  el.canvas.addEventListener('pointerdown', (e) => {
    if (S.mode !== 'play') return;
    drag = { id: e.pointerId, x0: e.clientX, g0: S.goal };
    el.canvas.setPointerCapture(e.pointerId);
  });
  el.canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || S.mode !== 'play') return;
    const span = W * (isSmall() ? 0.62 : 0.4);
    S.goal = THREE.MathUtils.clamp(drag.g0 + ((e.clientX - drag.x0) / span) * 2 * LIM, -LIM, LIM);
  });
  const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  el.canvas.addEventListener('pointerup', endDrag);
  el.canvas.addEventListener('pointercancel', endDrag);

  /* ---------- the autopilot that plays in the window ---------- */

  function autopilot(dt) {
    S.autoT -= dt;
    if (S.autoT > 0) return;
    S.autoT = 0.25;
    let best = S.goal, bestScore = -Infinity;
    for (const lx of LANES) {
      let clear = 140, bonus = 0;
      for (const e of ents) {
        if (e.z > 2 || e.z < -90) continue;
        if (e.kind === 'gate') { if (Math.abs(lx - e.gx) > e.gh - 0.9) clear = Math.min(clear, -e.z); continue; }
        const near = e.kind === 'drone' ? Math.abs(e.cx - lx) < e.amp + 1.4 : Math.abs(e.x - lx) < 1.3;
        if (near) {
          if (e.kind === 'shard') bonus += 20; else clear = Math.min(clear, -e.z);
        }
      }
      const score = clear + bonus - Math.abs(lx - S.x) * 2;
      if (score > bestScore) { bestScore = score; best = lx; }
    }
    S.goal = best;
  }

  // the attract road is never empty when you arrive
  function prefill() {
    clearEnts();
    let z = -46;
    while (z > SPAWN_Z) z -= spawnPattern(true, z) + 22 + Math.random() * 12;
    S.nextSpawn = 20;
  }

  /* a still composition for reduced motion: the attract scene holds a pose */
  function stillLife() {
    clearEnts();
    addEnt('pylon', -2.4, -26); addEnt('pylon', 4.8, -48); addEnt('pylon', 0, -80);
    addEnt('shard', 2.4, -34); addEnt('shard', 2.4, -40); addEnt('shard', 2.4, -46);
    addGate(-2.4, 2.4, -120);
    addEnt('drone', 1.2, -64, { cx: 1.2, amp: 2.6, w: 0, ph: 0.6 }).obj.userData.rail.scale.x = 6.5;
  }

  /* ============================================================
     Frame
     ============================================================ */

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    if (composer) {
      composer.setSize(W, H);
      bloom.setSize(W, H);
      crtPass.uniforms.uRes.value.set(W * DPR, H * DPR);
    }
    for (const m of lineMats) m.resolution.set(W, H);
    sparkMat.uniforms.uPx.value = DPR * (H / 900);
  }
  window.addEventListener('resize', resize);
  resize();
  if (reduceMotion) stillLife(); else prefill();

  const clock = new THREE.Clock();
  const look = new THREE.Vector3();
  let roll = 0;

  function update(dt, realDt) {
    const playing = S.mode === 'play';
    const attract = S.mode === 'attract';
    const dying = S.mode === 'dying';
    const over = S.mode === 'over';
    const moving = !reduceMotion || playing || dying;

    if (playing) {
      let dir = 0;
      for (const k in STEER) if (keys[k]) dir += STEER[k];
      dir = Math.sign(dir);
      if (dir) S.goal = THREE.MathUtils.clamp(S.goal + dir * (14 + S.speed * 0.09) * dt, -LIM, LIM);
      S.speed = 42 + 56 * (1 - Math.exp(-S.dist / 7000)) + (S.sector - 1) * 2.5;
    } else if (attract) {
      if (!reduceMotion) autopilot(dt);
      S.speed = reduceMotion ? 0 : 34;
    } else if (over) {
      S.speed += ((reduceMotion ? 0 : 10) - S.speed) * Math.min(1, realDt * 1.5);
    }

    const px = S.x;
    S.x += (S.goal - S.x) * (1 - Math.pow(0.0004, dt));
    S.steerVel = dt > 0 ? (S.x - px) / dt : 0;

    if (!moving) return;
    S.gameT += dt;
    const dz = S.speed * dt;
    S.dist += dz;

    if (playing) {
      S.score += dz * 0.6 * S.mult;
      S.chainT += dt;
      if (S.chainT > 6 && S.chain > 0) { S.chain = Math.max(0, S.chain - 3); S.mult = Math.min(8, 1 + Math.floor(S.chain / 3)); S.chainT = 0; }
      if (S.score >= sectorAt(S.sector + 1)) {
        S.sector++;
        const p = PALETTES[(S.sector - 1) % PALETTES.length];
        setPalette(S.sector - 1);
        banner(`SECTOR ${String(S.sector).padStart(2, '0')}`, p.name);
        el.announce.textContent = `Sector ${S.sector}, ${p.name.toLowerCase()}.`;
        Sound.sfx('sector');
      }
    }

    if (playing || attract) {
      S.nextSpawn -= dz;
      if (S.nextSpawn <= 0) {
        const len = spawnPattern(attract);
        // breathing room is measured in time, so it survives the speed
        const secs = Math.max(0.42, (attract ? 1.0 : 0.95) - S.sector * 0.07) + Math.random() * 0.3;
        S.nextSpawn = len + secs * Math.max(S.speed, 30);
      }
    }

    for (let i = ents.length - 1; i >= 0; i--) {
      const e = ents[i];
      e.z += dz;
      if (e.kind === 'drone') {
        e.x = e.cx + Math.sin(e.ph + S.gameT * e.w) * e.amp;
        e.obj.position.x = e.cx;
        e.obj.userData.body.position.x = e.x - e.cx;
        e.obj.userData.body.rotation.y += dt * 2;
        e.obj.userData.body.rotation.x += dt * 1.3;
      } else {
        e.obj.position.x = e.x;
      }
      if (e.kind === 'shard') { e.obj.userData.body.rotation.y += dt * 3; e.obj.userData.body.position.y = 1.0 + Math.sin(S.gameT * 4 + e.z) * 0.12; }
      e.obj.position.z = e.z;

      // the moment it reaches the hull
      if (playing && !e.passed && e.z >= -1.0) {
        const dx = Math.abs(e.x - S.x);
        if (e.kind === 'shard') {
          if (dx < 1.15) {
            e.passed = true;
            const pts = 500 * S.mult;
            S.score += pts; S.shardsGot++;
            burst(e.x, 1.0, e.z, 22, 5);
            callout(`◆ +${pts}`, e.x, 1.8, e.z, '#ffd23d');
            Sound.sfx('shard');
            give(e); ents.splice(i, 1);
            continue;
          }
          if (e.z > 1.2) e.passed = true;
        } else if (e.kind === 'gate') {
          e.passed = true;
          if (Math.abs(S.x - e.gx) > e.gh - 0.62) { crash(); return; }
          const pts = 200 * S.mult;
          S.score += pts; addChain(2);
          callout(`THREADED +${pts}`, S.x, 2.4, 0, PALETTES[(S.sector - 1) % PALETTES.length].accent);
          Sound.sfx('gate');
        } else {
          const hitR = e.kind === 'drone' ? 1.3 : 1.12;
          if (dx < hitR) { crash(); return; }
          if (e.z > 0.7) {
            e.passed = true;
            if (dx < hitR + 1.1) {
              S.near++; addChain(1);
              S.flash = 1;
              const pts = 100 * S.mult;
              S.score += pts;
              callout(`CLOSE +${pts}`, e.x, 2.6, 0, '#29e6ff');
              Sound.sfx('close');
            }
          }
        }
      }
      if (e.z > 14) { give(e); ents.splice(i, 1); }
    }
  }

  function frame() {
    const realDt = Math.min(clock.getDelta(), 0.05);
    if (S.timeScale < 1) S.timeScale = Math.min(1, S.timeScale + realDt * 0.6);
    const paused = S.mode === 'paused';
    const dt = paused ? 0 : realDt * S.timeScale;
    if (!reduceMotion && !paused) U.time.value += realDt;

    update(dt, realDt);

    // palette drift toward the sector's colours
    const pk = 1 - Math.pow(0.25, realDt);
    for (const k of KEYS) P[k].lerp(PT[k], pk);
    hazardLines.color.copy(P.hazard);
    padMat.color.copy(P.hazard);
    // lasers hum; the hull's edges flare on a near miss
    const hum = reduceMotion ? 0 : Math.sin(U.time.value * 37) * 0.25 + Math.sin(U.time.value * 61) * 0.15;
    beamMat.color.copy(P.hazard).multiplyScalar((HIGH ? 2.4 : 1.6) + hum);
    S.flash = Math.max(0, S.flash - realDt * 3);
    shipLines.material.linewidth = (HIGH ? 2.2 : 2.6) + S.flash * 2.5;
    railMat.color.copy(P.hazard);
    shipLines.material.color.copy(P.accent).lerp(new THREE.Color(1, 1, 1), S.flash * 0.6);
    engineGlow.material.color.copy(P.accent);
    streakMat.color.copy(P.grid2).lerp(new THREE.Color(1, 1, 1), 0.55);

    U.scroll.value = S.dist;
    U.scrollG.value = S.dist % 600;

    // hull: banks into the turn, hovers, breathes
    const bank = THREE.MathUtils.clamp(-S.steerVel * 0.07, -0.65, 0.65);
    ship.position.set(S.x, 0.62 + (reduceMotion ? 0 : Math.sin(U.time.value * 3.1) * 0.05), 0);
    ship.rotation.set(0.04, THREE.MathUtils.clamp(-S.steerVel * 0.02, -0.25, 0.25), bank);
    engineGlow.scale.setScalar(0.8 + (reduceMotion ? 0 : Math.sin(U.time.value * 40) * 0.08) + S.speed * 0.004);

    // trails: the past positions of each wingtip, carried back by the road
    const dz = S.speed * dt;
    for (const tr of trails) {
      for (const p of tr.pts) p.z += dz;
      const cos = Math.cos(bank), sin = Math.sin(bank);
      const wx = S.x + tr.ox * 0.95 * cos, wy = ship.position.y + tr.ox * 0.95 * sin * 0.9;
      const head = tr.pts[0];
      if (ship.visible) {
        if (!head || head.z - 0.75 > 0.45) tr.pts.unshift({ x: wx, y: wy, z: 0.75 });
        else { head.x = wx; head.y = wy; }
      }
      while (tr.pts.length > TRAIL || (tr.pts.length && tr.pts[tr.pts.length - 1].z > 2.2)) tr.pts.pop();
      const n = tr.pts.length;
      for (let i = 0; i < TRAIL; i++) {
        const p = tr.pts[Math.min(i, n - 1)] || { x: wx, y: wy, z: 0.75 };
        const w = 0.05 * (1 - i / TRAIL) * (n ? 1 : 0);
        tr.pos[i * 6] = p.x - w; tr.pos[i * 6 + 1] = p.y; tr.pos[i * 6 + 2] = p.z;
        tr.pos[i * 6 + 3] = p.x + w; tr.pos[i * 6 + 4] = p.y; tr.pos[i * 6 + 5] = p.z;
      }
      tr.mesh.geometry.attributes.position.needsUpdate = true;
      tr.mesh.visible = n > 1;
    }

    // streaks
    const sk = THREE.MathUtils.clamp((S.speed - 20) / 70, 0, 1);
    streakMat.opacity = reduceMotion && S.mode !== 'play' ? 0.15 : 0.08 + sk * 0.5;
    for (let i = 0; i < STREAKS; i++) {
      const s = streakSeed[i];
      s.z += dz * 1.5;
      if (s.z > 10) respawnStreak(s, -200 - Math.random() * 40);
      const len = 0.4 + S.speed * 0.08;
      streakPos[i * 6] = s.x; streakPos[i * 6 + 1] = s.y; streakPos[i * 6 + 2] = s.z;
      streakPos[i * 6 + 3] = s.x; streakPos[i * 6 + 4] = s.y; streakPos[i * 6 + 5] = s.z - len;
    }
    streakGeo.attributes.position.needsUpdate = true;

    // sparks and hull fragments
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) continue;
      sparkLife[i] = Math.max(0, sparkLife[i] - realDt * 1.1);
      sparkVel[i * 3 + 1] -= 6 * realDt;
      sparkPos[i * 3] += sparkVel[i * 3] * realDt;
      sparkPos[i * 3 + 1] = Math.max(0.05, sparkPos[i * 3 + 1] + sparkVel[i * 3 + 1] * realDt);
      sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * realDt + dz;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.aLife.needsUpdate = true;
    shardsOfHull.update(realDt * (S.mode === 'dying' ? 0.6 : 1));

    // camera: low and close on wide screens, higher and wider on tall ones
    const aspect = W / H;
    const portrait = aspect < 0.9;
    const baseFov = aspect >= 1.2 ? 62 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(Math.tan(THREE.MathUtils.degToRad(31)), 0.44 / aspect)));
    camera.fov = baseFov + (reduceMotion ? 0 : sk * 9);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    S.shake = Math.max(0, S.shake - realDt * 1.8);
    const sh = S.shake * S.shake * 0.5;
    camera.position.set(S.x * (portrait ? 0.82 : 0.52) + (Math.random() - 0.5) * sh, (portrait ? 3.7 : 2.45) + (Math.random() - 0.5) * sh, portrait ? 9.4 : 7.6);
    look.set(S.x * 0.32, portrait ? 0.4 : 0.95, -32);
    camera.lookAt(look);
    roll += ((reduceMotion ? 0 : THREE.MathUtils.clamp(-S.steerVel * 0.006, -0.07, 0.07)) - roll) * Math.min(1, realDt * 4);
    camera.rotateZ(roll);
    sky.position.copy(camera.position);
    U.fogD.value = scene.fog.density;

    // attract cards turn over on their own unless someone is reading
    if (S.mode === 'attract' && !reduceMotion && !cardHold) {
      cardT += realDt;
      if (cardT > 6.5) showCard(cardIx + 1);
    }

    Sound.engine(S.speed, S.mode === 'play');
    hud();

    if (composer) {
      crtPass.uniforms.uTime.value = reduceMotion ? 0 : U.time.value * 60;
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  setMode('attract');
  requestAnimationFrame(frame);
}
