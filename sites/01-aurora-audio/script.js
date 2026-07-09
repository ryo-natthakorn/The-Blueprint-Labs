import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
const isCoarse = window.matchMedia('(pointer: coarse)').matches;

/* ------------------------------------------------------------------
   Scene: a breathing ribbon-field of particles shaped like a torus
   knot cross-section, displaced by curl-ish noise and the live
   audio analyser level.
------------------------------------------------------------------ */
const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  // No WebGL: leave the typographic layer on a gradient backdrop.
  canvas.style.background = 'radial-gradient(ellipse at 50% 40%, #141a3a 0%, #05060e 70%)';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060e, 0.05);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 11);

const COUNT = prefersReducedMotion ? 3000 : (isSmallScreen ? 4500 : 12000);

const positions = new Float32Array(COUNT * 3);
const seeds = new Float32Array(COUNT * 4);
for (let i = 0; i < COUNT; i++) {
  // distribute along a loose torus-knot path with radial scatter
  const t = (i / COUNT) * Math.PI * 2;
  const p = 2, q = 3;
  const r = 3.2 + Math.cos(q * t) * 1.1;
  const scatter = 0.55 + Math.random() * 0.9;
  positions[i * 3] = r * Math.cos(p * t) + (Math.random() - 0.5) * scatter;
  positions[i * 3 + 1] = r * Math.sin(p * t) * 0.6 + (Math.random() - 0.5) * scatter;
  positions[i * 3 + 2] = Math.sin(q * t) * 1.4 + (Math.random() - 0.5) * scatter;
  seeds[i * 4] = Math.random() * Math.PI * 2;   // phase
  seeds[i * 4 + 1] = 0.4 + Math.random() * 0.9; // speed
  seeds[i * 4 + 2] = Math.random();             // hue mix
  seeds[i * 4 + 3] = 0.5 + Math.random();       // size
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

const uniforms = {
  uTime: { value: 0 },
  uLevel: { value: 0 },       // smoothed audio level 0..1
  uBass: { value: 0 },
  uTreble: { value: 0 },
  uMouse: { value: new THREE.Vector2(0, 0) },
  uMouseStrength: { value: 0 },
  uPixelRatio: { value: renderer.getPixelRatio() },
  uColorA: { value: new THREE.Color('#46f0c0') },
  uColorB: { value: new THREE.Color('#7a5cff') },
  uColorC: { value: new THREE.Color('#ff5ca8') },
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    attribute vec4 aSeed;
    uniform float uTime;
    uniform float uLevel;
    uniform float uBass;
    uniform vec2 uMouse;
    uniform float uMouseStrength;
    uniform float uPixelRatio;
    varying float vMix;
    varying float vGlow;

    // cheap 3d noise via sines
    vec3 wobble(vec3 p, float t, vec4 seed) {
      float n1 = sin(p.y * 1.3 + t * seed.y + seed.x);
      float n2 = cos(p.x * 1.1 - t * seed.y * 0.8 + seed.x * 2.0);
      float n3 = sin(p.z * 1.7 + t * seed.y * 1.2);
      return vec3(n1, n2, n3);
    }

    void main() {
      vec3 p = position;
      float t = uTime;

      // breathing driven by audio level
      float breathe = 1.0 + uLevel * 0.55 + uBass * 0.35;
      p *= breathe;

      // per-particle drift
      p += wobble(position, t, aSeed) * (0.18 + uLevel * 0.6);

      // mouse repulsion in view plane
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vec2 screen = mv.xy / -mv.z;
      vec2 toMouse = screen - uMouse * 0.6;
      float d = length(toMouse);
      float push = uMouseStrength * smoothstep(0.45, 0.0, d);
      mv.xy += normalize(toMouse + 0.0001) * push * 1.6;

      gl_Position = projectionMatrix * mv;
      float size = aSeed.w * (1.6 + uLevel * 3.2) * uPixelRatio;
      gl_PointSize = size * (10.0 / -mv.z);

      vMix = aSeed.z;
      vGlow = uLevel;
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;
    uniform float uTreble;
    varying float vMix;
    varying float vGlow;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      float alpha = smoothstep(0.5, 0.05, d);
      vec3 col = mix(uColorA, uColorB, vMix);
      col = mix(col, uColorC, uTreble * vMix);
      col *= 0.75 + vGlow * 1.4;
      gl_FragColor = vec4(col, alpha * (0.35 + vGlow * 0.5));
    }
  `,
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// bloom
let composer = null;
if (!prefersReducedMotion && !isSmallScreen) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.7, 0.15);
  composer.addPass(bloom);
}

/* ------------------------------------------------------------------
   Generative synth. Three moods, each a chord set cycled slowly.
   Analyser drives the particle field + HUD.
------------------------------------------------------------------ */
const MOODS = [
  { name: 'Aurora I', chords: [[110, 164.81, 220, 329.63], [98, 146.83, 196, 293.66], [87.31, 130.81, 174.61, 261.63], [98, 155.56, 196, 311.13]], wave: 'sawtooth', cutoff: 900, sub: 0.3 },
  { name: 'Borealis', chords: [[146.83, 220, 293.66, 440], [130.81, 196, 261.63, 392], [164.81, 246.94, 329.63, 493.88], [110, 164.81, 220, 329.63]], wave: 'square', cutoff: 1400, sub: 0.15 },
  { name: 'Zenith', chords: [[55, 82.41, 110, 164.81], [49, 73.42, 98, 146.83], [61.74, 92.5, 123.47, 185], [55, 87.31, 110, 174.61]], wave: 'triangle', cutoff: 500, sub: 0.6 },
];

let audio = null;

function createAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.8;

  // feedback delay for space
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.42;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  delay.connect(feedback).connect(delay);
  delay.connect(wet);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.82;

  filter.connect(delay);
  filter.connect(master);
  wet.connect(master);
  master.connect(analyser).connect(ctx.destination);

  const voices = [];
  for (let i = 0; i < 4; i++) {
    const osc = ctx.createOscillator();
    const oscDetuned = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.type = 'sawtooth';
    oscDetuned.type = 'sawtooth';
    oscDetuned.detune.value = 8 + i * 3;
    osc.connect(gain);
    oscDetuned.connect(gain);
    gain.connect(filter);
    osc.start();
    oscDetuned.start();
    voices.push({ osc, oscDetuned, gain });
  }

  // sub oscillator
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  const subGain = ctx.createGain();
  subGain.gain.value = 0;
  sub.connect(subGain).connect(master);
  sub.start();

  // slow LFO on the filter for movement
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 320;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  return { ctx, master, filter, voices, sub, subGain, analyser, freqData: new Uint8Array(analyser.frequencyBinCount) };
}

let moodIndex = 0;
let chordIndex = 0;
let chordTimer = null;
let muted = false;

function applyChord() {
  if (!audio) return;
  const mood = MOODS[moodIndex];
  const chord = mood.chords[chordIndex % mood.chords.length];
  const now = audio.ctx.currentTime;
  audio.voices.forEach((v, i) => {
    v.osc.type = mood.wave;
    v.oscDetuned.type = mood.wave;
    v.osc.frequency.setTargetAtTime(chord[i], now, 0.6);
    v.oscDetuned.frequency.setTargetAtTime(chord[i], now, 0.9);
    // stagger voice swells
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setTargetAtTime(0.02, now, 0.4);
    v.gain.gain.setTargetAtTime(0.055, now + 0.5 + i * 0.7, 1.4);
  });
  audio.sub.frequency.setTargetAtTime(chord[0] / 2, now, 0.8);
  audio.subGain.gain.setTargetAtTime(mood.sub * 0.12, now, 1.2);
  audio.filter.frequency.setTargetAtTime(mood.cutoff, now, 1.5);
  chordIndex++;
}

function startChordCycle() {
  clearInterval(chordTimer);
  applyChord();
  chordTimer = setInterval(applyChord, 7000);
}

/* ------------------------------------------------------------------
   UI wiring
------------------------------------------------------------------ */
const intro = document.getElementById('intro');
const listening = document.getElementById('listening');
const enterBtn = document.getElementById('enter-sound');
const chordName = document.getElementById('chord-name');
const levelReadout = document.getElementById('level-readout');
const freqBars = [...document.querySelectorAll('.freq-bar')];
const muteBtn = document.getElementById('mute');

enterBtn.addEventListener('click', () => {
  if (!audio) {
    audio = createAudio();
    startChordCycle();
    audio.master.gain.setTargetAtTime(0.9, audio.ctx.currentTime, 1.2);
  }
  audio.ctx.resume();
  intro.hidden = true;
  listening.hidden = false;
  chordName.textContent = MOODS[moodIndex].name;
});

document.querySelectorAll('.chip[data-mood]').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip[data-mood]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    moodIndex = Number(chip.dataset.mood);
    chordIndex = 0;
    chordName.textContent = MOODS[moodIndex].name;
    startChordCycle();
  });
});

muteBtn.addEventListener('click', () => {
  if (!audio) return;
  muted = !muted;
  muteBtn.setAttribute('aria-pressed', String(muted));
  audio.master.gain.setTargetAtTime(muted ? 0 : 0.9, audio.ctx.currentTime, 0.3);
});

/* mouse / touch field bending */
const targetMouse = new THREE.Vector2();
let mouseStrength = 0;
window.addEventListener('pointermove', (e) => {
  targetMouse.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  mouseStrength = 1;
});
window.addEventListener('pointerleave', () => { mouseStrength = 0; });

/* ------------------------------------------------------------------
   Loop
------------------------------------------------------------------ */
const clock = new THREE.Clock();
let smoothedLevel = 0;

function sampleAudio() {
  if (!audio || muted) return { level: 0, bass: 0, treble: 0 };
  audio.analyser.getByteFrequencyData(audio.freqData);
  const n = audio.freqData.length;
  let bass = 0, mid = 0, treble = 0;
  const bassEnd = Math.floor(n * 0.08);
  const midEnd = Math.floor(n * 0.4);
  for (let i = 0; i < bassEnd; i++) bass += audio.freqData[i];
  for (let i = bassEnd; i < midEnd; i++) mid += audio.freqData[i];
  for (let i = midEnd; i < n; i++) treble += audio.freqData[i];
  bass /= bassEnd * 255;
  mid /= (midEnd - bassEnd) * 255;
  treble /= (n - midEnd) * 255;
  return { level: (bass + mid + treble) / 2.2, bass, treble: treble * 4 };
}

let frame = 0;
function tick() {
  const t = clock.getElapsedTime();
  const { level, bass, treble } = sampleAudio();
  smoothedLevel += (level - smoothedLevel) * 0.08;

  uniforms.uTime.value = t * 0.4;
  uniforms.uLevel.value = smoothedLevel;
  uniforms.uBass.value = bass;
  uniforms.uTreble.value = Math.min(treble, 1);
  uniforms.uMouse.value.lerp(targetMouse, 0.06);
  uniforms.uMouseStrength.value += (mouseStrength - uniforms.uMouseStrength.value) * 0.05;

  points.rotation.y = t * 0.05;
  points.rotation.x = Math.sin(t * 0.11) * 0.18;
  camera.position.z = 11 - smoothedLevel * 1.6;
  // gentle parallax toward the cursor
  camera.position.x += (uniforms.uMouse.value.x * 0.9 - camera.position.x) * 0.03;
  camera.position.y += (uniforms.uMouse.value.y * 0.6 - camera.position.y) * 0.03;
  camera.lookAt(0, 0, 0);

  // HUD (throttled)
  if (audio && frame % 4 === 0 && !listening.hidden) {
    const db = smoothedLevel > 0.001 ? (20 * Math.log10(smoothedLevel)).toFixed(1) + ' dB' : '−∞ dB';
    levelReadout.textContent = db;
    if (freqBars.length && !muted) {
      const step = Math.floor(audio.freqData.length / freqBars.length / 3);
      freqBars.forEach((bar, i) => {
        const v = audio.freqData[i * step + 2] / 255;
        bar.style.height = `${8 + v * 92}%`;
      });
    }
  }
  frame++;

  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function renderStatic() {
  uniforms.uTime.value = 4.2;
  uniforms.uLevel.value = 0.35;
  renderer.render(scene, camera);
}

document.addEventListener('visibilitychange', () => {
  if (!audio) return;
  if (document.hidden) audio.ctx.suspend();
  else if (!muted) audio.ctx.resume();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  if (prefersReducedMotion) renderStatic();
});

if (prefersReducedMotion) {
  // Static poster frame; audio still available but field stays calm.
  renderStatic();
  enterBtn.addEventListener('click', () => renderStatic());
} else {
  tick();
}
