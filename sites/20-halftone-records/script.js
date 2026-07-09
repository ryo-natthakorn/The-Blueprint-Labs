/* ============================================================
   HALFTONE — the catalogue is a turntable
   A drawn deck (platter, strobe dots, tonearm, VU meters) and a
   fully generative WebAudio engine: four records, each a chord
   book + drum grammar, scheduled bar by bar so no two plays are
   the same. Dragging the platter bends the transport's rate —
   tempo and pitch together, like the real thing.
   ============================================================ */

const canvas = document.getElementById('deck');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 860px)').matches;

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
window.addEventListener('resize', resize);

/* ---------- catalogue ---------- */

// chords as semitone stacks from a root (Hz)
const A2 = 110;
const st = n => A2 * Math.pow(2, n / 12);
const RECORDS = [
  {
    title: 'DUST LOOPS VOL.2', artist: 'CASSETTE GHOST',
    vinyl: '#241d18', labelBg: '#f2762e', labelInk: '#171310',
    bpm: 82, swing: 0.62,
    chords: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 10], [3, 7, 10, 14]],
    bassNotes: [0, 0, 5, -2], kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], crackle: 0.05,
  },
  {
    title: 'NIGHT BUS', artist: 'MIRA WELLS',
    vinyl: '#181c26', labelBg: '#5a7fd4', labelInk: '#f0e5d3',
    bpm: 70, swing: 0.56,
    chords: [[0, 4, 7, 11], [-4, 0, 3, 7], [-2, 2, 5, 9], [-7, -3, 0, 4]],
    bassNotes: [0, -4, -2, -7], kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0], crackle: 0.035,
  },
  {
    title: 'PAPER MOON', artist: 'THE INTERVAL',
    vinyl: '#20241b', labelBg: '#c8b394', labelInk: '#171310',
    bpm: 96, swing: 0.66,
    chords: [[0, 4, 7, 9], [2, 5, 9, 12], [-3, 0, 4, 7], [5, 9, 12, 16]],
    bassNotes: [0, 2, -3, 5], kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    hat: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1], crackle: 0.02,
  },
  {
    title: 'STATIC BLOOM', artist: 'FOYER',
    vinyl: '#26181f', labelBg: '#8a5a74', labelInk: '#f0e5d3',
    bpm: 58, swing: 0.5,
    chords: [[0, 7, 12, 14], [-5, 2, 7, 12], [-2, 5, 10, 14], [-7, 0, 7, 10]],
    bassNotes: [0, -5, -2, -7], kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], crackle: 0.08,
  },
];
let recIndex = 0;

/* ---------- audio engine ---------- */

let AC = null, master = null, analyser = null, crackleGain = null;
let playing = false;
let rate = 1;          // platter rate multiplier (33rpm = 1)
let rpmBase = 1;       // 45rpm = 45/33.3
let nextBeat = 0;
let step = 0;
let bar = 0;

function ensureAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain();
  master.gain.value = 0.7;
  analyser = AC.createAnalyser();
  analyser.fftSize = 512;
  master.connect(analyser).connect(AC.destination);

  // endless crackle bed
  const len = AC.sampleRate * 2;
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.8 : (Math.random() * 2 - 1) * 0.02;
  }
  const src = AC.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = AC.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;
  crackleGain = AC.createGain();
  crackleGain.gain.value = 0;
  src.connect(lp).connect(crackleGain).connect(master);
  src.start();
}

function env(node, t0, a, peak, d) {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.exponentialRampToValueAtTime(peak, t0 + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function playKick(t0) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.setValueAtTime(120 * rate, t0);
  o.frequency.exponentialRampToValueAtTime(40 * rate, t0 + 0.12);
  env(g, t0, 0.004, 0.65, 0.22);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + 0.3);
}
function playHat(t0, open) {
  const len = AC.sampleRate * 0.08;
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource();
  s.buffer = buf;
  const hp = AC.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7500;
  const g = AC.createGain();
  env(g, t0, 0.002, open ? 0.14 : 0.08, open ? 0.16 : 0.045);
  s.connect(hp).connect(g).connect(master);
  s.start(t0);
}
function playBass(t0, freq, dur) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'triangle';
  o.frequency.value = freq * rate / 2;
  env(g, t0, 0.02, 0.34, dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.1);
}
function playChord(t0, semis, dur) {
  const lp = AC.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  const g = AC.createGain();
  env(g, t0, 0.28, 0.1, dur);
  lp.connect(g).connect(master);
  for (const s2 of semis) {
    for (const det of [-4, 3]) {
      const o = AC.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = st(s2) * 2 * rate;
      o.detune.value = det;
      o.connect(lp);
      o.start(t0); o.stop(t0 + dur + 0.5);
    }
  }
}
function playSparkle(t0) {
  const rec = RECORDS[recIndex];
  const semis = rec.chords[bar % rec.chords.length];
  const note = semis[(Math.random() * semis.length) | 0] + 24;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.value = st(note) * rate;
  env(g, t0, 0.01, 0.09, 0.5);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + 0.6);
}

function schedule() {
  if (!playing) return;
  const rec = RECORDS[recIndex];
  const stepDur = (60 / rec.bpm / 4) / (rate * rpmBase);
  while (nextBeat < AC.currentTime + 0.12) {
    const swungStep = step % 2 === 1 ? stepDur * (rec.swing * 2 - 1) : 0;
    const t0 = nextBeat + swungStep;
    if (rec.kick[step]) playKick(t0);
    if (rec.hat[step]) playHat(t0, Math.random() < 0.12);
    if (step % 4 === 0 && Math.random() < 0.85) {
      const bass = rec.bassNotes[bar % rec.bassNotes.length];
      playBass(t0, st(bass), stepDur * 3);
    }
    if (step === 0) {
      playChord(t0, rec.chords[bar % rec.chords.length], stepDur * 14);
    }
    if (Math.random() < 0.07) playSparkle(t0);
    step++;
    if (step >= 16) { step = 0; bar++; }
    nextBeat += stepDur;
  }
}

/* ---------- transport ---------- */

const playBtn = document.getElementById('play');
function setPlaying(on) {
  ensureAudio();
  if (AC.state === 'suspended') AC.resume();
  playing = on;
  playBtn.textContent = on ? 'LIFT THE NEEDLE' : 'DROP THE NEEDLE';
  if (on) {
    nextBeat = AC.currentTime + 0.1;
    step = 0; bar = 0;
    crackleGain.gain.setTargetAtTime(RECORDS[recIndex].crackle * 6, AC.currentTime, 0.4);
  } else {
    crackleGain.gain.setTargetAtTime(0, AC.currentTime, 0.15);
  }
}
playBtn.addEventListener('click', () => setPlaying(!playing));

document.querySelectorAll('.sleeve').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.sleeve').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    recIndex = +b.dataset.rec;
    bar = 0; step = 0;
    if (playing) crackleGain.gain.setTargetAtTime(RECORDS[recIndex].crackle * 6, AC.currentTime, 0.4);
  });
});
document.querySelectorAll('.rpm-btn').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.rpm-btn').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    rpmBase = b.dataset.rpm === '45' ? 45 / 33.33 : 1;
  });
});

/* ---------- platter drag = rate bend ---------- */

let platterAngle = 0;
let dragging = false;
let dragBend = 0;
let lastPointerAngle = 0;

function deckCenter() {
  return isMobile
    ? [W * 0.5, H * 0.34, Math.min(W, H) * 0.3]
    : [W * 0.44, H * 0.52, Math.min(W, H) * 0.31];
}

canvas.addEventListener('pointerdown', (e) => {
  const [cx, cy, R] = deckCenter();
  const d = Math.hypot(e.clientX - cx, e.clientY - cy);
  if (d < R * 1.05) {
    dragging = true;
    lastPointerAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const [cx, cy] = deckCenter();
  const a = Math.atan2(e.clientY - cy, e.clientX - cx);
  let da = a - lastPointerAngle;
  if (da > Math.PI) da -= Math.PI * 2;
  if (da < -Math.PI) da += Math.PI * 2;
  lastPointerAngle = a;
  dragBend = da * 9;
  platterAngle += da;
});
const endDrag = () => { dragging = false; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

/* ---------- drawing ---------- */

function drawDeck(t, level) {
  ctx.clearRect(0, 0, W, H);
  const [cx, cy, R] = deckCenter();
  const rec = RECORDS[recIndex];

  // plinth shadow
  const sh = ctx.createRadialGradient(cx, cy + R * 0.14, R * 0.6, cx, cy + R * 0.14, R * 1.5);
  sh.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
  sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sh;
  ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);

  // strobe dots ring
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + platterAngle * 0.5;
    ctx.fillStyle = i % 5 ? 'rgba(240, 229, 211, 0.22)' : 'rgba(242, 118, 46, 0.6)';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (R + 14), Math.sin(a) * (R + 14), 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // vinyl
  ctx.rotate(platterAngle);
  ctx.fillStyle = rec.vinyl;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  // grooves
  for (let r = R * 0.42; r < R * 0.97; r += 4) {
    ctx.strokeStyle = `rgba(240, 229, 211, ${0.03 + (r % 12 < 4 ? 0.04 : 0)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // light sheen that stays fixed while the record turns
  ctx.rotate(-platterAngle);
  const sheen = ctx.createLinearGradient(-R, -R, R, R);
  sheen.addColorStop(0.32, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(0.46, 'rgba(255, 255, 255, 0.07)');
  sheen.addColorStop(0.54, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(platterAngle);

  // label
  ctx.fillStyle = rec.labelBg;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rec.labelInk;
  ctx.font = `${R * 0.075}px "Anton", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(rec.title, 0, -R * 0.08);
  ctx.font = `${R * 0.05}px "Space Mono", monospace`;
  ctx.fillText(rec.artist, 0, R * 0.02);
  ctx.fillText('HALFTONE', 0, R * 0.14);
  ctx.fillStyle = '#171310';
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // tonearm
  const armBaseX = cx + R * 1.22, armBaseY = cy - R * 0.85;
  const armAngle = Math.PI * 0.72 + (playing ? 0.16 + Math.sin(t * 0.1) * 0.05 : -0.12);
  ctx.strokeStyle = '#c8b394';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(armBaseX, armBaseY);
  const elbowX = armBaseX + Math.cos(armAngle) * R * 0.7;
  const elbowY = armBaseY + Math.sin(armAngle) * R * 0.7;
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(elbowX + Math.cos(armAngle + 0.5) * R * 0.34, elbowY + Math.sin(armAngle + 0.5) * R * 0.34);
  ctx.stroke();
  ctx.fillStyle = '#f0e5d3';
  ctx.beginPath();
  ctx.arc(armBaseX, armBaseY, 11, 0, Math.PI * 2);
  ctx.fill();
  // headshell
  ctx.fillStyle = '#f2762e';
  ctx.save();
  ctx.translate(elbowX + Math.cos(armAngle + 0.5) * R * 0.34, elbowY + Math.sin(armAngle + 0.5) * R * 0.34);
  ctx.rotate(armAngle + 0.5);
  ctx.fillRect(-4, -7, 20, 14);
  ctx.restore();

  // VU meters
  const vux = isMobile ? W * 0.5 - 60 : cx + R * 1.05;
  const vuy = isMobile ? H * 0.34 + R + 44 : cy + R * 0.55;
  for (let m = 0; m < 2; m++) {
    const lv = Math.min(1, level * (m ? 0.85 : 1.05));
    ctx.strokeStyle = 'rgba(240, 229, 211, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vux + m * 66, vuy, 54, 30);
    const needleA = -Math.PI * 0.8 + lv * Math.PI * 0.6;
    ctx.strokeStyle = lv > 0.8 ? '#f2762e' : '#f0e5d3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vux + m * 66 + 27, vuy + 27);
    ctx.lineTo(vux + m * 66 + 27 + Math.cos(needleA) * 22, vuy + 27 + Math.sin(needleA) * 22);
    ctx.stroke();
  }
}

/* ---------- loop ---------- */

let vuLevel = 0;
const vuData = new Uint8Array(256);
let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;

  // rate follows the drag bend, then relaxes home
  if (!dragging) dragBend *= 0.9;
  rate = Math.max(0.25, Math.min(2.4, 1 + dragBend));

  if (playing) {
    schedule();
    if (!dragging && !reduceMotion) platterAngle += dt * 2.2 * rate * rpmBase;
    if (analyser) {
      analyser.getByteTimeDomainData(vuData);
      let sum = 0;
      for (let i = 0; i < vuData.length; i++) {
        const v = (vuData[i] - 128) / 128;
        sum += v * v;
      }
      vuLevel += (Math.sqrt(sum / vuData.length) * 3.2 - vuLevel) * 0.25;
    }
  } else {
    vuLevel *= 0.94;
    if (!dragging && !reduceMotion) platterAngle += dt * 0.05; // idle creep
  }

  drawDeck(t, vuLevel);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
