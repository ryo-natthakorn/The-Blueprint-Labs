import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
const isCoarse = window.matchMedia('(pointer: coarse)').matches;
const lowPower = (navigator.hardwareConcurrency || 8) <= 4;

// high: full desktop build. mid: phones, tablets, low-core machines.
const TIER = (isSmallScreen || isCoarse || lowPower) ? 'mid' : 'high';
const COUNT = TIER === 'high' ? 65536 : 20000;

const BANDS = 128;              // log-spaced spectrum bands, 40 Hz – 12 kHz
const F_MIN = 40, F_MAX = 12000;
const bandToFreq = (u) => F_MIN * Math.pow(F_MAX / F_MIN, u);
const freqToBand = (f) => Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN);

const $ = (id) => document.getElementById(id);
const intro = $('intro');
const listening = $('listening');
const enterBtn = $('enter-sound');
const chordName = $('chord-name');
const levelReadout = $('level-readout');
const muteBtn = $('mute');
const leaveBtn = $('leave');
const readout = $('cursor-readout');
const playHint = $('play-hint');
const specCanvas = $('spectrum');
const specCtx = specCanvas.getContext('2d');
const srStatus = $('sr-status');
const announce = (msg) => { srStatus.textContent = msg; };

if (isCoarse) playHint.textContent = 'Tap the aurora to play a note · pick a mood below';

/* ==================================================================
   Audio: a generative score (pad, sub, bell arpeggio) through a
   generated convolution reverb and a tape-ish delay. The analyser
   feeds the aurora; every bell also sends a ripple to its own
   frequency on the curtain.
================================================================== */
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const MOODS = [
  {
    name: 'Aurora I', wave: 'sawtooth', cutoff: 1100, q: 0.7, sub: 0.2, step: 0.52, density: 0.46, chordSecs: 8,
    scale: [57, 60, 62, 64, 67], bellShift: 0, decay: 3.2, ratio: 3.5,
    chords: [
      { name: 'Am9', notes: [45, 55, 60, 71] },
      { name: 'Fmaj9', notes: [41, 52, 57, 67] },
      { name: 'Cmaj7/G', notes: [43, 52, 59, 60] },
      { name: 'Em7', notes: [40, 50, 55, 62] },
    ],
  },
  {
    name: 'Borealis', wave: 'square', cutoff: 1900, q: 0.9, sub: 0.1, step: 0.3, density: 0.55, chordSecs: 6.4,
    scale: [62, 64, 66, 69, 71], bellShift: 12, decay: 2.1, ratio: 2.0,
    chords: [
      { name: 'Dsus2', notes: [50, 57, 64, 69] },
      { name: 'Gmaj7♯11', notes: [43, 54, 61, 62] },
      { name: 'Bm11', notes: [47, 57, 64, 66] },
      { name: 'Asus4', notes: [45, 57, 62, 64] },
    ],
  },
  {
    name: 'Zenith', wave: 'triangle', cutoff: 520, q: 1.2, sub: 0.55, step: 1.1, density: 0.36, chordSecs: 10,
    scale: [50, 53, 55, 57, 60], bellShift: -12, decay: 4.6, ratio: 1.41,
    chords: [
      { name: 'Dm(add9)', notes: [38, 45, 52, 53] },
      { name: 'B♭maj7', notes: [34, 45, 50, 53] },
      { name: 'Gm9', notes: [31, 46, 50, 57] },
      { name: 'A7sus4', notes: [33, 43, 50, 52] },
    ],
  },
];

let audio = null;
let moodIndex = 0;
let chordIndex = 0;
let chordTimer = null;
let schedTimer = null;
let muted = false;
const pendingRipples = [];   // { at: audioTime, u, strength }

function makeImpulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function createAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.72;
  analyser.minDecibels = -96;
  analyser.maxDecibels = -22;
  master.connect(comp).connect(analyser).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(ctx, 3.4, 2.8);
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.55;
  reverb.connect(reverbReturn).connect(master);

  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.42;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.34;
  const delayTone = ctx.createBiquadFilter();
  delayTone.type = 'lowpass';
  delayTone.frequency.value = 2600;
  delay.connect(delayTone).connect(feedback).connect(delay);
  const delayReturn = ctx.createGain();
  delayReturn.gain.value = 0.3;
  delayTone.connect(delayReturn).connect(master);

  // pad
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1100;
  filter.Q.value = 0.7;
  const padBus = ctx.createGain();
  padBus.gain.value = 0.85;
  filter.connect(padBus);
  padBus.connect(master);
  const padSend = ctx.createGain();
  padSend.gain.value = 0.5;
  padBus.connect(padSend).connect(reverb);
  padBus.connect(delay);

  const voices = [];
  for (let i = 0; i < 4; i++) {
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = (i - 1.5) * 0.35;
    g.gain.value = 0;
    b.detune.value = 7 + i * 3;
    a.detune.value = -4 - i;
    a.connect(g); b.connect(g);
    g.connect(pan).connect(filter);
    a.start(); b.start();
    voices.push({ a, b, g });
  }

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  const subGain = ctx.createGain();
  subGain.gain.value = 0;
  sub.connect(subGain).connect(master);
  sub.start();

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 340;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  // bells: FM sine voices, mostly wet
  const bellBus = ctx.createGain();
  bellBus.gain.value = 0.9;
  bellBus.connect(master);
  const bellSend = ctx.createGain();
  bellSend.gain.value = 0.9;
  bellBus.connect(bellSend).connect(reverb);
  bellBus.connect(delay);

  return {
    ctx, master, filter, voices, sub, subGain, analyser, bellBus,
    freq: new Uint8Array(analyser.frequencyBinCount),
    wave: new Float32Array(analyser.fftSize),
  };
}

function bell(freq, when, vel, pan, decay, ratio) {
  const { ctx, bellBus } = audio;
  const car = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const env = ctx.createGain();
  const panner = ctx.createStereoPanner();
  car.frequency.value = freq;
  mod.frequency.value = freq * ratio;
  modGain.gain.setValueAtTime(freq * 1.6 * vel, when);
  modGain.gain.exponentialRampToValueAtTime(0.5, when + decay * 0.5);
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(0.12 * vel, when + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  panner.pan.value = pan;
  mod.connect(modGain).connect(car.frequency);
  car.connect(env).connect(panner).connect(bellBus);
  car.start(when); mod.start(when);
  car.stop(when + decay + 0.05); mod.stop(when + decay + 0.05);
}

const scaleNote = (scale, degree) => scale[((degree % 5) + 5) % 5] + 12 * Math.floor(degree / 5);

function applyChord() {
  if (!audio) return;
  const mood = MOODS[moodIndex];
  const chord = mood.chords[chordIndex % mood.chords.length];
  const now = audio.ctx.currentTime;
  audio.voices.forEach((v, i) => {
    v.a.type = mood.wave;
    v.b.type = mood.wave;
    const f = midi(chord.notes[i]);
    v.a.frequency.setTargetAtTime(f, now, 0.5);
    v.b.frequency.setTargetAtTime(f, now, 0.8);
    v.g.gain.cancelScheduledValues(now);
    v.g.gain.setTargetAtTime(0.018, now, 0.35);
    v.g.gain.setTargetAtTime(0.05, now + 0.4 + i * 0.6, 1.3);
  });
  audio.sub.frequency.setTargetAtTime(midi(chord.notes[0] - 12 * (chord.notes[0] > 40 ? 1 : 0)), now, 0.8);
  audio.subGain.gain.setTargetAtTime(mood.sub * 0.16, now, 1.2);
  audio.filter.frequency.setTargetAtTime(mood.cutoff, now, 1.5);
  audio.filter.Q.setTargetAtTime(mood.q, now, 1.0);
  chordName.textContent = `${mood.name} · ${chord.name}`;
  chordName.classList.remove('is-new');
  void chordName.offsetWidth;
  chordName.classList.add('is-new');
  // reduced motion: a new still for each chord, once it has swelled in
  if (prefersReducedMotion) setTimeout(() => { if (mode === 'listening') renderStill(); }, 2600);
  // the chord root also blooms on the curtain
  queueRipple(midi(chord.notes[0]), now + 0.1, 0.55);
  chordIndex++;
}

let nextStep = 0;
let stepIndex = 0;
let degree = 5;

function queueRipple(freq, at, strength) {
  if (pendingRipples.length > 24) pendingRipples.shift();
  pendingRipples.push({ at, u: freqToBand(freq), strength });
}

function scheduleBells() {
  if (!audio) return;
  const mood = MOODS[moodIndex];
  const ctx = audio.ctx;
  if (nextStep < ctx.currentTime) nextStep = ctx.currentTime + 0.05;
  while (nextStep < ctx.currentTime + 0.3) {
    if (!muted && Math.random() < mood.density) {
      degree = Math.max(0, Math.min(11, degree + [-2, -1, -1, 1, 1, 2, 3][Math.floor(Math.random() * 7)]));
      const f = midi(scaleNote(mood.scale, degree) + mood.bellShift);
      const vel = 0.35 + Math.random() * 0.5;
      bell(f, nextStep, vel, (Math.random() - 0.5) * 1.2, mood.decay, mood.ratio);
      queueRipple(f, nextStep, vel);
    }
    nextStep += mood.step * (stepIndex % 2 ? 0.88 : 1.12);
    stepIndex++;
  }
}

function startScore() {
  clearInterval(chordTimer);
  clearInterval(schedTimer);
  applyChord();
  chordTimer = setInterval(applyChord, MOODS[moodIndex].chordSecs * 1000);
  schedTimer = setInterval(scheduleBells, 90);
}

function pluck(u) {
  if (!audio || muted) return;
  const mood = MOODS[moodIndex];
  const d = Math.round(u * 14);
  const f = midi(scaleNote(mood.scale, d) + mood.bellShift - 5 + (mood.bellShift < 0 ? 12 : 0));
  const now = audio.ctx.currentTime;
  bell(f, now, 0.95, (u - 0.5) * 1.6, mood.decay * 1.2, mood.ratio);
  pendingRipples.push({ at: now, u, strength: 1.7, pluck: true });
}

/* ------------------------------------------------------------------
   Spectrum analysis: 128 log bands, attack/release smoothed. Before
   sound starts (or while muted) a slow procedural spectrum keeps the
   curtain breathing.
------------------------------------------------------------------ */
const bands = new Float32Array(BANDS);
const raw = new Float32Array(BANDS);
const specBytes = new Uint8Array(BANDS);
let levelDb = -Infinity;
let level = 0;   // 0..1 loudness, nudges the camera

function idleSpectrum(t, i) {
  const u = i / BANDS;
  return 0.16 + 0.12 * Math.sin(u * 9 + t * 0.7) * Math.sin(u * 3.1 - t * 0.4) + 0.08 * Math.sin(u * 23 + t * 1.3);
}

function analyse(t) {
  let live = false;
  if (audio && !muted && audio.ctx.state === 'running') {
    live = true;
    audio.analyser.getByteFrequencyData(audio.freq);
    audio.analyser.getFloatTimeDomainData(audio.wave);
    let sum = 0;
    for (let i = 0; i < audio.wave.length; i++) sum += audio.wave[i] * audio.wave[i];
    const rms = Math.sqrt(sum / audio.wave.length);
    levelDb = rms > 1e-5 ? 20 * Math.log10(rms) : -Infinity;
  } else {
    levelDb = -Infinity;
  }
  const binHz = audio ? audio.ctx.sampleRate / audio.analyser.fftSize : 0;
  for (let i = 0; i < BANDS; i++) {
    if (live) {
      const f0 = bandToFreq(i / BANDS), f1 = bandToFreq((i + 1) / BANDS);
      const b0 = Math.floor(f0 / binHz), b1 = Math.max(b0 + 1, Math.ceil(f1 / binHz));
      let s = 0;
      for (let b = b0; b < b1; b++) s = Math.max(s, audio.freq[b]);
      // contrast stretch with a gentle high-frequency tilt, so peaks read as peaks
      const r = s / 255 + (i / BANDS) * 0.12;
      raw[i] = Math.pow(Math.max(0, Math.min(1, (r - 0.36) / 0.5)), 1.3) + idleSpectrum(t, i) * 0.12;
    } else {
      raw[i] = idleSpectrum(t, i);
    }
  }
  let total = 0;
  for (let i = 0; i < BANDS; i++) {
    // neighbouring bands blur together into a continuous curtain edge
    const v = raw[Math.max(0, i - 1)] * 0.25 + raw[i] * 0.5 + raw[Math.min(BANDS - 1, i + 1)] * 0.25;
    const k = v > bands[i] ? 0.4 : 0.07;   // fast attack, slow release
    bands[i] += (v - bands[i]) * k;
    specBytes[i] = Math.min(255, bands[i] * 255);
    total += bands[i];
  }
  level += ((live ? total / BANDS : 0.1) - level) * 0.08;
}

/* ==================================================================
   Scene
================================================================== */
const canvas = $('scene');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  renderer = null;
}
if (!renderer) document.documentElement.classList.add('no-webgl');

let scene, camera, composer, points, mirror, stars, ribbons, uniforms, specTex, finalPass;
const ribbonReveal = { value: 0 };
const headRot = new THREE.Matrix3();
const tmpM4 = new THREE.Matrix4();
const tmpEuler = new THREE.Euler();
const layout = { introFloor: -2.3, listenFloor: -2.6, mirror: 1 };

/* -- Headphone, sampled into points ------------------------------ */
function buildHeadphone(count) {
  const parts = [];
  const CUP_X = 1.62, CUP_Y = -0.85;
  const CUP_PROFILE = [[0.9, 0], [1.0, 0.04], [1.04, 0.16], [1.03, 0.32], [0.98, 0.42], [0.86, 0.5], [0.62, 0.55], [0.3, 0.57], [0.02, 0.575]]
    .map(([r, h]) => new THREE.Vector2(r, h));
  // cups are slightly oval: taller than deep
  const oval = new THREE.Matrix4().makeTranslation(0, CUP_Y, 0)
    .multiply(new THREE.Matrix4().makeScale(1, 1.12, 0.9))
    .multiply(new THREE.Matrix4().makeTranslation(0, -CUP_Y, 0));
  const add = (geo, weight, shade, matrix, isCup = false) => {
    if (matrix) geo.applyMatrix4(matrix);
    if (isCup) geo.applyMatrix4(oval);
    parts.push({ geo, weight, shade });
  };
  const M = (x, y, z, rx = 0, ry = 0, rz = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

  // headband: outer shell + two suspension rails
  const band = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-CUP_X, 0.5, 0), new THREE.Vector3(-1.62, 1.12, 0), new THREE.Vector3(-1.22, 1.86, 0),
    new THREE.Vector3(0, 2.24, 0), new THREE.Vector3(1.22, 1.86, 0), new THREE.Vector3(1.62, 1.12, 0), new THREE.Vector3(CUP_X, 0.5, 0),
  ]);
  add(new THREE.TubeGeometry(band, 160, 0.1, 14), 0.17, 1.0);
  const strap = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.48, 0.72, 0), new THREE.Vector3(-1.12, 1.55, 0), new THREE.Vector3(0, 1.92, 0),
    new THREE.Vector3(1.12, 1.55, 0), new THREE.Vector3(1.48, 0.72, 0),
  ]);
  add(new THREE.TubeGeometry(strap, 120, 0.045, 8), 0.035, 0.55, M(0, 0, 0.16));
  add(new THREE.TubeGeometry(strap, 120, 0.045, 8), 0.035, 0.55, M(0, 0, -0.16));
  for (const side of [-1, 1]) {
    // yoke: half ring around the cup
    add(new THREE.TorusGeometry(1.2, 0.05, 10, 90, Math.PI), 0.05, 0.95, M(side * CUP_X, CUP_Y, 0, 0, Math.PI / 2, 0), true);
    // cup: one lathed shell from the cushion seat to a domed back (axis along x)
    const cup = new THREE.LatheGeometry(CUP_PROFILE, 96);
    add(cup, 0.24, 0.85, M(side * (CUP_X - 0.2), CUP_Y, 0, 0, 0, -side * Math.PI / 2), true);
    // grille ring on the back
    add(new THREE.TorusGeometry(0.6, 0.035, 8, 80), 0.03, 1.25, M(side * (CUP_X + 0.32), CUP_Y, 0, 0, Math.PI / 2, 0), true);
    // cushion
    add(new THREE.TorusGeometry(0.76, 0.24, 24, 80), 0.13, 0.5, M(side * (CUP_X - 0.32), CUP_Y, 0, 0, Math.PI / 2, 0), true);
  }

  const totalW = parts.reduce((s, p) => s + p.weight, 0);
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const shade = new Float32Array(count);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  let k = 0;
  parts.forEach((part, idx) => {
    const n0 = idx === parts.length - 1 ? count - k : Math.round((part.weight / totalW) * count);
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(part.geo)).build();
    for (let i = 0; i < n0 && k < count; i++, k++) {
      sampler.sample(p, n);
      pos.set([p.x, p.y, p.z], k * 3);
      nrm.set([n.x, n.y, n.z], k * 3);
      shade[k] = part.shade;
    }
    part.geo.dispose();
  });
  return { pos, nrm, shade };
}

const NOISE_GLSL = /* glsl */`
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

// Spectrum + ripples at band position u, shared by the particles and the ribbons.
const ENERGY_GLSL = /* glsl */`
  uniform sampler2D uSpectrum;
  uniform vec3 uRipples[8];
  float bandEnergy(float u, float t) {
    float e = texture2D(uSpectrum, vec2(u, 0.5)).r;
    for (int i = 0; i < 8; i++) {
      vec3 r = uRipples[i];
      float age = t - r.y;
      if (age > 0.0 && age < 5.0) {
        float d = abs(u - r.x);
        float front = age * 0.16;
        e += r.z * exp(-age * 0.9) * exp(-pow((d - front) * 16.0, 2.0)) * 0.35;
        e += r.z * exp(-age * 1.8) * exp(-d * d * 260.0) * 0.55;
      }
    }
    return e;
  }
  float curtainFold(float u, float t, float layer) {
    return sin(u * 5.3 + t * 0.23 + layer * 2.1) * 1.3
         + sin(u * 11.7 - t * 0.17 + layer * 1.3) * 0.4
         + sin(u * 2.1 + t * 0.11) * 0.7
         - layer * 1.4 + 0.4;
  }
`;

const FIELD_VERT = /* glsl */`
  attribute vec3 aHead;
  attribute vec3 aHeadN;
  attribute vec4 aSeed;   // x: band position u, y: climb phase, z: curtain layer, w: random
  attribute float aShade;
  uniform float uTime, uMorph, uAssemble, uAlphaScale, uPixelRatio, uSize, uCurtainSize, uMirror, uFloorY, uMirrorAmt;
  uniform mat3 uHeadRot;
  uniform vec3 uHeadPos;
  uniform float uHeadScale;
  uniform vec3 uCurtain;   // width, height, base y
  uniform vec2 uMouse;
  uniform float uMouseStrength;
  uniform vec3 uColA, uColB, uColC;
  varying vec3 vColor;
  varying float vAlpha;
  ${NOISE_GLSL}
  ${ENERGY_GLSL}

  vec3 aurora(float t) {
    t = clamp(t, 0.0, 1.0);
    return mix(mix(uColA, uColB, smoothstep(0.0, 0.55, t)), uColC, smoothstep(0.55, 1.0, t));
  }

  void main() {
    float t = uTime;

    /* ---- headphone ---- */
    vec3 hp = uHeadRot * (aHead * uHeadScale) + uHeadPos;
    vec3 hn = normalize(uHeadRot * aHeadN);
    float lambert = max(dot(hn, normalize(vec3(-0.45, 0.65, 0.62))), 0.0);
    float rim = pow(1.0 - abs(hn.z), 2.6);
    float sheen = 0.5 + 0.5 * sin(dot(aHead, vec3(1.3, 0.9, 0.7)) * 1.4 - t * 0.6);
    vec3 hCol = vec3(0.72, 0.76, 0.92) * (0.16 + lambert * 0.85) * aShade
              + aurora(fract(aHead.y * 0.18 + aHead.x * 0.08 + 0.45 + t * 0.02)) * (rim * 0.9 + sheen * 0.12);
    float hAlpha = 0.55 + rim * 0.35;
    // assemble from a loose cloud on load
    vec3 scatterDir = vec3(snoise(aHead * 0.7 + 3.1), snoise(aHead * 0.7 + 7.7), snoise(aHead * 0.7 + 13.3));
    hp += scatterDir * (1.0 - uAssemble) * 5.0;

    /* ---- aurora curtain ---- */
    float u = aSeed.x;
    float layer = floor(aSeed.z * 3.0);
    float energy = bandEnergy(u, t);
    float speed = 0.035 + 0.05 * aSeed.w + energy * 0.04;
    float v = pow(fract(aSeed.y + t * speed), 1.7);   // crowd the bright lower edge
    float hgt = uCurtain.y * (0.16 + energy * (0.95 + 0.22 * layer));
    vec3 cp = vec3((u - 0.5) * uCurtain.x, uCurtain.z + v * hgt, curtainFold(u, t, layer));
    cp.x += sin(cp.y * 0.7 + t * 0.5 + layer) * 0.2 * v;
    cp.z += sin(v * 6.0 + t * 0.8 + u * 30.0) * 0.05;
    float rays = 0.55 + 0.45 * sin(u * 240.0 + sin(u * 31.0 + t * 0.5) * 4.0 + layer * 7.0);
    float cBright = smoothstep(0.0, 0.04, v) * pow(1.0 - v, 1.2) * (0.1 + energy * 0.8) * rays;
    vec3 cCol = aurora(v * 0.62 + u * 0.42 + layer * 0.05);
    cCol = mix(cCol, vec3(0.9, 1.0, 0.97), smoothstep(0.55, 1.2, energy) * (1.0 - v) * 0.6);
    float cAlpha = cBright;

    /* ---- morph: per-particle delay, a swirl in between ---- */
    float m = clamp(uMorph * 1.55 - aSeed.w * 0.55, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    vec3 p = mix(hp, cp, m);
    float burst = sin(m * 3.14159);
    vec3 q = p * 0.32 + vec3(0.0, 0.0, t * 0.15);
    p += vec3(snoise(q), snoise(q + 17.0) * 0.6, snoise(q + 31.0)) * burst * 1.3;
    p.y += burst * (0.8 + aSeed.w * 1.4);      // the shape lifts as it dissolves into light

    vec3 col = mix(hCol, cCol, m) * (1.0 + burst * 0.6);
    float alpha = mix(hAlpha, cAlpha, m);

    // dark-glass floor reflection
    if (uMirror > 0.5) {
      float below = p.y - uFloorY;
      p.y = uFloorY - below;
      alpha *= uMirrorAmt * 0.2 * smoothstep(3.2, 0.0, below);
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // cursor parts the field
    vec2 screen = mv.xy / -mv.z;
    vec2 toMouse = screen - uMouse;
    float md = length(toMouse);
    float push = uMouseStrength * smoothstep(0.32, 0.0, md);
    mv.xy += normalize(toMouse + 0.0001) * push * 0.9;
    col += aurora(0.2) * push * 0.6;

    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.55 + aSeed.w * 0.9) * mix(1.0, uCurtainSize * (1.0 + energy * 0.6), m);
    gl_PointSize = size * uPixelRatio * (11.0 / -mv.z);
    vColor = col;
    vAlpha = alpha * uAlphaScale;
  }
`;

/* Aurora curtains: one ribbon per layer, its top edge drawn by the
   spectrum, lit brightest along the lower hem with drifting rays. */
const RIBBON_VERT = /* glsl */`
  uniform float uTime, uLayer, uMirror, uFloorY, uMirrorAmt, uReveal;
  uniform vec3 uCurtain;
  varying vec2 vUv;
  varying float vEnergy;
  varying float vFade;
  ${ENERGY_GLSL}
  void main() {
    float u = position.x + 0.5;
    // rows: -1 = bottom of the soft skirt under the hem, 0 = hem, 1 = top
    float v = position.y * 2.0;
    float t = uTime;
    float e = bandEnergy(u, t);
    float hgt = uCurtain.y * (0.16 + e * (0.95 + 0.22 * uLayer)) * (0.08 + 0.92 * uReveal);   // curtains grow up from the hem
    float y = v < 0.0 ? v * 0.32 : v * hgt;
    vec3 p = vec3((u - 0.5) * uCurtain.x, uCurtain.z + y, curtainFold(u, t, uLayer));
    p.x += sin(p.y * 0.7 + t * 0.5 + uLayer) * 0.2 * max(v, 0.0);
    float fade = smoothstep(0.0, 0.35, uReveal) * smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.94, u);
    if (uMirror > 0.5) {
      float below = p.y - uFloorY;
      p.y = uFloorY - below;
      fade *= uMirrorAmt * 0.13 * exp(-below * 0.35);
    }
    vUv = vec2(u, v);
    vEnergy = e;
    vFade = fade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const RIBBON_FRAG = /* glsl */`
  uniform float uTime, uLayer, uRibbonGain;
  uniform vec3 uColA, uColB, uColC;
  varying vec2 vUv;
  varying float vEnergy;
  varying float vFade;
  vec3 aurora(float t) {
    t = clamp(t, 0.0, 1.0);
    return mix(mix(uColA, uColB, smoothstep(0.0, 0.55, t)), uColC, smoothstep(0.55, 1.0, t));
  }
  void main() {
    float u = vUv.x, v = vUv.y, t = uTime;
    float rays = 0.55 + 0.45 * sin(u * 190.0 + t * 0.4 + sin(u * 23.0 + t * 0.3 + uLayer) * 3.0);
    rays *= 0.7 + 0.3 * sin(u * 61.0 - t * 0.25 + uLayer * 4.0);
    float vv = max(v, 0.0);
    float hem = (v < 0.0 ? exp(v * 3.2) * (1.0 + v) : exp(-v * 7.0)) * 0.85;
    float body = v < 0.0 ? 0.0 : pow(1.0 - vv, 1.6) * 0.55;
    float top = smoothstep(1.0, 0.72, vv);
    float intensity = (hem * (0.7 + 0.3 * rays) + body * rays) * top * (0.1 + vEnergy * 0.8);
    vec3 col = aurora(vv * 0.7 + u * 0.35 + uLayer * 0.05);
    col = mix(col, vec3(0.85, 1.0, 0.95), hem * 0.18 * smoothstep(0.5, 1.1, vEnergy));
    float a = intensity * vFade * (0.6 - uLayer * 0.12) * uRibbonGain;
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`;

const FIELD_FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    float a = (exp(-d2 * 30.0) + exp(-d2 * 8.0) * 0.3) * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`;

const FINAL_SHADER = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * 0.012;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      col *= smoothstep(0.95, 0.18, r2 * 1.6);
      vec3 base = vec3(0.016, 0.02, 0.047) * smoothstep(0.9, 0.1, r2 * 1.4);
      col = base + col * (1.0 - base);
      col += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * 0.03;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function initScene() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER === 'high' ? 2 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  // With post-processing the clear colour came out one sRGB-encode too bright
  // in the composer's target, so that path clears to black and the final
  // pass lays the night-navy base back in.
  renderer.setClearColor(TIER === 'high' ? 0x000000 : 0x04050c, 1);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);

  const head = buildHeadphone(COUNT);
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    // bias band positions slightly toward the middle, where the music lives
    const r = Math.random();
    seeds[i * 4] = r * 0.92 + 0.04 + (Math.random() - 0.5) * 0.04;
    seeds[i * 4 + 1] = Math.random();
    seeds[i * 4 + 2] = Math.random();
    seeds[i * 4 + 3] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(head.pos, 3)); // bounds only; shader positions
  geo.setAttribute('aHead', new THREE.BufferAttribute(head.pos, 3));
  geo.setAttribute('aHeadN', new THREE.BufferAttribute(head.nrm, 3));
  geo.setAttribute('aShade', new THREE.BufferAttribute(head.shade, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);

  specTex = new THREE.DataTexture(specBytes, BANDS, 1, THREE.RedFormat, THREE.UnsignedByteType);
  specTex.magFilter = THREE.LinearFilter;
  specTex.minFilter = THREE.LinearFilter;
  specTex.needsUpdate = true;

  uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uAssemble: { value: prefersReducedMotion ? 1 : 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uSize: { value: TIER === 'high' ? 1.25 : 2.1 },
    uCurtainSize: { value: TIER === 'high' ? 2.4 : 1.9 },
    // three times the points plus bloom on the high tier, so each point carries less light
    uAlphaScale: { value: TIER === 'high' ? 0.62 : 1 },
    uRibbonGain: { value: TIER === 'high' ? 0.85 : 1 },
    uMirror: { value: 0 },
    uMirrorAmt: { value: 1 },
    uFloorY: { value: -2.3 },
    uHeadRot: { value: headRot },
    uHeadPos: { value: new THREE.Vector3(2.6, 0.2, 0) },
    uHeadScale: { value: 1 },
    uSpectrum: { value: specTex },
    uCurtain: { value: new THREE.Vector3(15, 4.6, -1.9) },
    uRipples: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, -99, 0)) },
    uMouse: { value: new THREE.Vector2(9, 9) },
    uMouseStrength: { value: 0 },
    uColA: { value: new THREE.Color('#46f0c0') },
    uColB: { value: new THREE.Color('#7a5cff') },
    uColC: { value: new THREE.Color('#ff5ca8') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const mirrorMat = mat.clone();
  mirrorMat.uniforms = { ...uniforms, uMirror: { value: 1 } };
  if (TIER === 'high') {
    mirror = new THREE.Points(geo, mirrorMat);
    mirror.frustumCulled = false;
    scene.add(mirror);
  }

  // aurora ribbons (plus their reflections)
  ribbons = [];
  const ribbonGeo = new THREE.PlaneGeometry(1, 1, TIER === 'high' ? 320 : 180, 2);
  for (const mirrored of [0, 1]) {
    for (let layer = 0; layer < 3; layer++) {
      const rm = new THREE.ShaderMaterial({
        uniforms: {
          uTime: uniforms.uTime, uSpectrum: uniforms.uSpectrum, uRipples: uniforms.uRipples,
          uCurtain: uniforms.uCurtain, uColA: uniforms.uColA, uColB: uniforms.uColB, uColC: uniforms.uColC,
          uFloorY: uniforms.uFloorY, uMirrorAmt: uniforms.uMirrorAmt, uReveal: ribbonReveal,
          uLayer: { value: layer }, uMirror: { value: mirrored }, uRibbonGain: uniforms.uRibbonGain,
        },
        vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG,
        transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      });
      const mesh = new THREE.Mesh(ribbonGeo, rm);
      mesh.frustumCulled = false;
      mesh.renderOrder = -1;
      scene.add(mesh);
      ribbons.push(mesh);
    }
  }

  // distant stars
  const starCount = TIER === 'high' ? 1600 : 700;
  const sp = new Float32Array(starCount * 3);
  const ss = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    sp[i * 3] = (Math.random() - 0.5) * 120;
    sp[i * 3 + 1] = Math.random() * 50 - 6;
    sp[i * 3 + 2] = -30 - Math.random() * 40;
    ss[i] = Math.random();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
  stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uPixelRatio: uniforms.uPixelRatio },
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTime; uniform float uPixelRatio; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.6 + aSeed * 1.4) * uPixelRatio;
        vA = (0.25 + 0.75 * aSeed) * (0.6 + 0.4 * sin(uTime * (0.6 + aSeed * 2.0) + aSeed * 40.0)); }`,
    fragmentShader: /* glsl */`varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.75, 0.8, 1.0), smoothstep(0.5, 0.0, d) * vA * 0.55);
      #include <colorspace_fragment>
    }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(stars);

  if (TIER === 'high') {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.3, 0.3));
    composer.addPass(new OutputPass());
    finalPass = new ShaderPass(FINAL_SHADER);
    composer.addPass(finalPass);
    document.documentElement.classList.add('has-post');
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.documentElement.classList.add('no-webgl'); });
  applyLayout();
}

function applyLayout() {
  const w = window.innerWidth, h = window.innerHeight;
  const aspect = w / h;
  const portrait = aspect < 0.95;
  camera.aspect = aspect;
  camera.position.set(0, portrait ? 0.4 : 0.15, portrait ? 15 : 12);
  camera.updateProjectionMatrix();
  const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const halfW = halfH * aspect;
  if (portrait) {
    // the copy sits in the lower half, so the product fits the band above it
    const s = Math.min(1.0, (halfW * 0.72) / 1.95, (halfH * 0.58) / 4.3);
    uniforms.uHeadScale.value = s;
    uniforms.uHeadPos.value.set(0, halfH * 0.5, 0);
    layout.introFloor = halfH * 0.5 - 2.05 * s;
    layout.mirror = 0.25;
    uniforms.uCurtain.value.set(halfW * 2.5, halfH * 1.05, -halfH * 0.2);
    layout.listenFloor = -halfH * 0.2 - 0.45;
  } else {
    const s = Math.min(1.15, (halfW * 0.4) / 1.95);
    uniforms.uHeadScale.value = s;
    uniforms.uHeadPos.value.set(halfW * 0.4, 0.25, 0);
    layout.introFloor = 0.25 - 2.05 * s;
    layout.mirror = 1;
    uniforms.uCurtain.value.set(halfW * 2.3, halfH * 1.0, -halfH * 0.27);
    layout.listenFloor = -halfH * 0.27 - 0.5;
  }
  layout.portrait = portrait;
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
  if (finalPass) finalPass.uniforms.uRes.value.set(w, h);
  sizeSpectrum();
}

/* ==================================================================
   State, input, loop
================================================================== */
let mode = 'intro';           // 'intro' | 'listening'
let morph = 0;                // eased 0..1
let morphTarget = 0;
let assemble = prefersReducedMotion ? 1 : 0;
const mouse = new THREE.Vector2(9, 9);
const mouseNdc = new THREE.Vector2(0, 0);
let pointerActive = false;
let lastPointer = 0;
let rippleSlot = 0;
let readoutTimer = 0;
const clock = new THREE.Clock();

function enterListening() {
  if (!audio) {
    try {
      audio = createAudio();
    } catch (err) {
      audio = null;
    }
    if (audio) {
      startScore();
      audio.master.gain.setTargetAtTime(0.9, audio.ctx.currentTime, 1.4);
    }
  } else if (!muted) {
    audio.master.gain.setTargetAtTime(0.9, audio.ctx.currentTime, 0.6);
  }
  audio?.ctx.resume();
  mode = 'listening';
  morphTarget = 1;
  announce(audio ? `Listening. ${MOODS[moodIndex].name} is playing.` : 'Listening room open. Sound is not available in this browser.');
  document.body.classList.add('is-listening');
  intro.hidden = true;
  listening.hidden = false;
  listening.querySelector('.chip[aria-pressed="true"]')?.focus({ preventScroll: true });
  if (prefersReducedMotion) renderStill();
}

function leaveListening() {
  mode = 'intro';
  morphTarget = 0;
  announce('Sound paused. Back to the product.');
  document.body.classList.remove('is-listening');
  listening.hidden = true;
  intro.hidden = false;
  readout.classList.remove('is-on');
  if (audio) audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.5);
  enterBtn.focus({ preventScroll: true });
  if (prefersReducedMotion) renderStill();
}

function setMood(i) {
  moodIndex = i;
  chordIndex = 0;
  document.querySelectorAll('.chip[data-mood]').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.mood) === i)));
  document.body.dataset.mood = String(i);
  announce(`${MOODS[i].name} selected.`);
  if (audio) startScore();
  else chordName.textContent = `${MOODS[i].name} · ${MOODS[i].chords[0].name}`;
}

function setMuted(m) {
  muted = m;
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  announce(muted ? 'Muted.' : 'Sound on.');
  if (audio) audio.master.gain.setTargetAtTime(muted ? 0 : 0.9, audio.ctx.currentTime, 0.25);
}

enterBtn.addEventListener('click', enterListening);
leaveBtn.addEventListener('click', leaveListening);
muteBtn.addEventListener('click', () => setMuted(!muted));
document.querySelectorAll('.chip[data-mood]').forEach((chip) => {
  chip.addEventListener('click', () => setMood(Number(chip.dataset.mood)));
});

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (mode !== 'listening') return;
  if (e.key === '1' || e.key === '2' || e.key === '3') setMood(Number(e.key) - 1);
  else if (e.key === 'm' || e.key === 'M') setMuted(!muted);
  else if (e.key === 'Escape') leaveListening();
});

// Cast from the cursor onto the middle curtain's depth (z = -1) to find the band under it.
const raycaster = new THREE.Raycaster();
const curtainPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1);
const hit = new THREE.Vector3();
function screenToBand(clientX, clientY) {
  if (!camera) return clientX / window.innerWidth;
  raycaster.setFromCamera({ x: (clientX / window.innerWidth) * 2 - 1, y: -(clientY / window.innerHeight) * 2 + 1 }, camera);
  if (!raycaster.ray.intersectPlane(curtainPlane, hit)) return 0.5;
  return THREE.MathUtils.clamp(hit.x / uniforms.uCurtain.value.x + 0.5, 0, 1);
}

function formatHz(f) {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 2)} kHz` : `${Math.round(f)} Hz`;
}

window.addEventListener('pointermove', (e) => {
  mouseNdc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  pointerActive = true;
  lastPointer = performance.now();
  if (mode === 'listening' && e.pointerType === 'mouse' && !e.target.closest('button, a')) {
    const u = screenToBand(e.clientX, e.clientY);
    readout.textContent = `${formatHz(bandToFreq(u))}`;
    readout.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 14}px)`;
    readout.classList.add('is-on');
  } else {
    readout.classList.remove('is-on');
  }
});
document.addEventListener('pointerleave', () => { pointerActive = false; readout.classList.remove('is-on'); });

window.addEventListener('pointerdown', (e) => {
  if (mode !== 'listening' || e.target.closest('button, a, .dock')) return;
  const u = screenToBand(e.clientX, e.clientY);
  pluck(u);
  if (e.pointerType !== 'mouse') {
    readout.textContent = formatHz(bandToFreq(u));
    readout.style.transform = `translate(${e.clientX - 30}px, ${e.clientY - 48}px)`;
    readout.classList.add('is-on');
    clearTimeout(readoutTimer);
    readoutTimer = setTimeout(() => readout.classList.remove('is-on'), 900);
  }
  if (prefersReducedMotion) renderStill();
});

// Moves due ripples onto the GPU. `age` back-dates them (still frames
// show a ripple already spreading instead of an invisible one at age 0).
function flushRipples(t, age = 0) {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  for (let i = pendingRipples.length - 1; i >= 0; i--) {
    const r = pendingRipples[i];
    if (r.at > now) continue;
    if (uniforms && (!prefersReducedMotion || r.pluck)) {
      uniforms.uRipples.value[rippleSlot].set(r.u, t - age, r.strength);
      rippleSlot = (rippleSlot + 1) % 8;
    }
    pendingRipples.splice(i, 1);
  }
}

/* ---- HUD spectrum strip ---- */
let specW = 0, specH = 0;
function sizeSpectrum() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = specCanvas.getBoundingClientRect();
  specW = Math.max(1, Math.round(r.width * dpr));
  specH = Math.max(1, Math.round(r.height * dpr));
  specCanvas.width = specW;
  specCanvas.height = specH;
}
const specGrad = () => {
  const g = specCtx.createLinearGradient(0, 0, specW, 0);
  g.addColorStop(0, '#46f0c0'); g.addColorStop(0.55, '#7a5cff'); g.addColorStop(1, '#ff5ca8');
  return g;
};
let specFill = null;
const peaks = new Float32Array(64);
const peakHold = new Uint8Array(64);
function drawSpectrum() {
  if (specW !== Math.round(specCanvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2))) sizeSpectrum();
  if (!specFill || specFill.w !== specW) specFill = { w: specW, g: specGrad() };
  specCtx.clearRect(0, 0, specW, specH);
  const n = 64;
  const gap = specW / n;
  const bw = Math.max(1, gap * 0.5);
  specCtx.fillStyle = specFill.g;
  const dot = Math.max(1, Math.round(specH * 0.035));
  for (let i = 0; i < n; i++) {
    const v = Math.min(1, (bands[i * 2] + bands[i * 2 + 1]) * 0.5 * 1.15);
    const bh = Math.max(specH * 0.04, v * specH);
    const x = i * gap + (gap - bw) / 2;
    specCtx.globalAlpha = 0.35 + v * 0.65;
    specCtx.fillRect(x, specH - bh, bw, bh);
    // peak hold: a marker that waits, then falls
    if (v >= peaks[i]) { peaks[i] = v; peakHold[i] = 24; }
    else if (peakHold[i] > 0) peakHold[i]--;
    else peaks[i] = Math.max(v, peaks[i] - 0.012);
    specCtx.globalAlpha = 0.9;
    specCtx.fillRect(x, specH - Math.max(specH * 0.04, peaks[i] * specH) - dot * 2, bw, dot);
  }
  specCtx.globalAlpha = 1;
}

let shownDb = -60;
let hudTextAt = 0;
function updateHud() {
  const now = performance.now();
  if (Number.isFinite(levelDb)) shownDb += (levelDb - shownDb) * 0.25;
  if (now - hudTextAt > 120) {
    hudTextAt = now;
    levelReadout.textContent = Number.isFinite(levelDb) ? `${shownDb.toFixed(1).replace('-', '−')} dBFS` : '−∞ dBFS';
  }
  drawSpectrum();
}

function updateHead(t) {
  const mx = pointerActive ? mouseNdc.x : 0;
  const my = pointerActive ? mouseNdc.y : 0;
  const yaw = -0.72 + Math.sin(t * 0.21) * 0.3 + mx * 0.45;
  const pitch = 0.2 + Math.sin(t * 0.17) * 0.05 - my * 0.2;
  tmpEuler.set(pitch, yaw, Math.sin(t * 0.13) * 0.04);
  tmpM4.makeRotationFromEuler(tmpEuler);
  headRot.setFromMatrix4(tmpM4);
}

let frame = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  analyse(t);
  flushRipples(t);

  // ease morph and the load-in assembly
  const dir = morphTarget > morph ? 1 : -1;
  morph = THREE.MathUtils.clamp(morph + dir * dt / (dir > 0 ? 2.8 : 1.8), 0, 1);
  if (Math.abs(morphTarget - morph) < 0.001) morph = morphTarget;
  assemble = Math.min(1, assemble + dt / 2.6);
  const em = morph < 0.5 ? 4 * morph ** 3 : 1 - (-2 * morph + 2) ** 3 / 2;
  const ea = 1 - (1 - assemble) ** 3;

  uniforms.uTime.value = t;
  uniforms.uMorph.value = em;
  uniforms.uAssemble.value = ea;
  ribbonReveal.value = THREE.MathUtils.smoothstep(em, 0.35, 1);
  uniforms.uFloorY.value = THREE.MathUtils.lerp(layout.introFloor, layout.listenFloor, em);
  uniforms.uMirrorAmt.value = THREE.MathUtils.lerp(layout.mirror, 1, em);
  specTex.needsUpdate = true;
  updateHead(t);

  // cursor influence fades out after the pointer rests
  const idle = performance.now() - lastPointer > 2200;
  const wantStrength = pointerActive && !idle && mode === 'listening' && !isCoarse ? 1 : 0;
  uniforms.uMouseStrength.value += (wantStrength - uniforms.uMouseStrength.value) * 0.06;
  mouse.set(mouseNdc.x * camera.aspect * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), mouseNdc.y * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  uniforms.uMouse.value.lerp(mouse, 0.12);

  // camera: slow drift, gentle parallax that recentres when the pointer rests
  const px = pointerActive && !idle ? mouseNdc.x : 0;
  const py = pointerActive && !idle ? mouseNdc.y : 0;
  camera.position.x += ((px * 0.7 + Math.sin(t * 0.07) * 0.4) * em - camera.position.x) * 0.03;
  const baseY = layout.portrait ? 0.4 : 0.15;
  camera.position.y += (baseY + py * 0.35 * em + level * 0.3 - camera.position.y) * 0.03;
  camera.lookAt(0, layout.portrait ? 0 : -0.2 * em, 0);

  if (mode === 'listening' && frame % 2 === 0) updateHud();
  if (finalPass) finalPass.uniforms.uTime.value = t;
  frame++;

  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// Reduced motion: finished still frames, re-rendered on state changes.
const STILL_T = 6.5;
function renderStill() {
  if (!renderer) return;
  const t = STILL_T;
  morph = mode === 'listening' ? 1 : 0;
  for (let i = 0; i < 40; i++) analyse(t);   // let the smoothing settle on the current spectrum
  uniforms.uRipples.value.forEach((r) => r.set(0, -99, 0));
  flushRipples(t, 0.45);
  uniforms.uTime.value = t;
  uniforms.uMorph.value = morph;
  uniforms.uAssemble.value = 1;
  ribbonReveal.value = morph;
  uniforms.uFloorY.value = morph ? layout.listenFloor : layout.introFloor;
  uniforms.uMirrorAmt.value = morph ? 1 : layout.mirror;
  uniforms.uMouseStrength.value = 0;
  specTex.needsUpdate = true;
  updateHead(1.2);
  camera.position.x = 0;
  camera.lookAt(0, layout.portrait ? 0 : -0.2 * morph, 0);
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

if (renderer) {
  initScene();
  window.addEventListener('resize', () => {
    applyLayout();
    if (prefersReducedMotion) renderStill();
  });
  if (prefersReducedMotion) {
    renderStill();
    // the meters still read out, without animating the field
    setInterval(() => {
      if (mode !== 'listening') return;
      analyse(STILL_T);
      flushRipples(STILL_T);
      updateHud();
    }, 250);
  } else {
    tick();
  }
} else {
  // No WebGL: the CSS aurora stands in, the synth and HUD still work.
  const hudLoop = () => {
    analyse(performance.now() / 1000);
    flushRipples(0);
    if (mode === 'listening') updateHud();
    requestAnimationFrame(hudLoop);
  };
  window.addEventListener('resize', sizeSpectrum);
  hudLoop();
}

document.addEventListener('visibilitychange', () => {
  if (!audio) return;
  if (document.hidden) audio.ctx.suspend();
  else if (mode === 'listening') audio.ctx.resume();
});
