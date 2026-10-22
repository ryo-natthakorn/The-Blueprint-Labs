const canvas = document.getElementById("deck"),
  ctx = canvas.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches,
  low = innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4;
let W, H, DPR, scale, offsetX, offsetY;
function resize() {
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  DPR = Math.min(devicePixelRatio || 1, low ? 1.5 : 2);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  scale = Math.min(W / 820, H / 490);
  offsetX = (W - 820 * scale) / 2;
  offsetY = (H - 490 * scale) / 2;
}
resize();
addEventListener("resize", resize);
const A2 = 110;
const st = (n) => A2 * Math.pow(2, n / 12);
const RECORDS = [
  {
    title: "DUST LOOPS VOL.2",
    artist: "CASSETTE GHOST",
    vinyl: "#241d18",
    labelBg: "#f2762e",
    labelInk: "#171310",
    bpm: 82,
    swing: 0.62,
    chords: [
      [0, 3, 7, 10],
      [5, 8, 12, 15],
      [-2, 2, 5, 10],
      [3, 7, 10, 14],
    ],
    bassNotes: [0, 0, 5, -2],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    crackle: 0.05,
  },
  {
    title: "NIGHT BUS",
    artist: "MIRA WELLS",
    vinyl: "#181c26",
    labelBg: "#5a7fd4",
    labelInk: "#f0e5d3",
    bpm: 70,
    swing: 0.56,
    chords: [
      [0, 4, 7, 11],
      [-4, 0, 3, 7],
      [-2, 2, 5, 9],
      [-7, -3, 0, 4],
    ],
    bassNotes: [0, -4, -2, -7],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    crackle: 0.035,
  },
  {
    title: "PAPER MOON",
    artist: "THE INTERVAL",
    vinyl: "#20241b",
    labelBg: "#c8b394",
    labelInk: "#171310",
    bpm: 96,
    swing: 0.66,
    chords: [
      [0, 4, 7, 9],
      [2, 5, 9, 12],
      [-3, 0, 4, 7],
      [5, 9, 12, 16],
    ],
    bassNotes: [0, 2, -3, 5],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    hat: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
    crackle: 0.02,
  },
  {
    title: "STATIC BLOOM",
    artist: "FOYER",
    vinyl: "#26181f",
    labelBg: "#8a5a74",
    labelInk: "#f0e5d3",
    bpm: 58,
    swing: 0.5,
    chords: [
      [0, 7, 12, 14],
      [-5, 2, 7, 12],
      [-2, 5, 10, 14],
      [-7, 0, 7, 10],
    ],
    bassNotes: [0, -5, -2, -7],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    crackle: 0.08,
  },
];
let recIndex = 0;

// The sleeve artwork is drawn locally. No photographs or external artwork.
function covers() {
  document.querySelectorAll("[data-cover]").forEach((c) => {
    c.width = c.height = 512;
    const g = c.getContext("2d"),
      i = +c.dataset.cover,
      rec = RECORDS[i];
    g.fillStyle = rec.labelBg;
    g.fillRect(0, 0, 512, 512);
    if (i === 0) {
      g.fillStyle = "#281d15";
      for (let j = 0; j < 5; j++) {
        g.save();
        g.translate(258, 265);
        g.rotate(-0.28 + j * 0.08);
        g.lineWidth = 15;
        g.strokeStyle = j % 2 ? "#f2d6aa" : "#342419";
        g.strokeRect(-160 + j * 27, -160 + j * 27, 320 - j * 54, 320 - j * 54);
        g.restore();
      }
      g.fillStyle = "#241a12";
      g.font = "68px Anton";
      g.fillText("DUST LOOPS", 25, 86);
      g.font = '28px "Space Mono"';
      g.fillText("VOLUME 2", 25, 124);
    }
    if (i === 1) {
      g.fillStyle = "#132f62";
      g.fillRect(0, 0, 512, 512);
      for (let j = 0; j < 12; j++) {
        g.strokeStyle = j % 2 ? "#476fbe" : "#7898d3";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-70 + j * 47, 512);
        g.lineTo(330 + j * 24, 0);
        g.stroke();
      }
      g.fillStyle = "#f1ca8e";
      g.beginPath();
      g.arc(337, 188, 82, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#122951";
      g.fillRect(0, 300, 512, 95);
      g.fillStyle = "#d7e3eb";
      g.font = "83px Anton";
      g.fillText("NIGHT BUS", 25, 378);
      g.font = '18px "Space Mono"';
      g.fillText("MIRA WELLS", 28, 425);
    }
    if (i === 2) {
      g.fillStyle = "#c6b99e";
      g.fillRect(0, 0, 512, 512);
      g.fillStyle = "#3f5044";
      g.beginPath();
      g.arc(256, 260, 176, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#e8ddbc";
      g.beginPath();
      g.arc(314, 208, 145, 0, Math.PI * 2);
      g.fill();
      for (let j = 0; j < 20; j++) {
        g.strokeStyle = "#243c3440";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(30, 180 + j * 12);
        g.lineTo(483, 350 + j * 7);
        g.stroke();
      }
      g.fillStyle = "#2c3e32";
      g.font = "63px Anton";
      g.fillText("PAPER MOON", 25, 78);
      g.font = '20px "Space Mono"';
      g.fillText("THE INTERVAL", 27, 475);
    }
    if (i === 3) {
      g.fillStyle = "#442c43";
      g.fillRect(0, 0, 512, 512);
      for (let j = 0; j < 20; j++) {
        g.save();
        g.translate(256, 260);
        g.rotate((j * Math.PI) / 10);
        g.fillStyle = j % 2 ? "#c891a1" : "#a56984";
        g.beginPath();
        g.ellipse(0, 77, 32, 133, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.fillStyle = "#442c43";
      g.beginPath();
      g.arc(256, 260, 68, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#f1dccc";
      g.font = "57px Anton";
      g.fillText("STATIC BLOOM", 25, 76);
      g.font = '22px "Space Mono"';
      g.fillText("FOYER", 27, 475);
    }
    // Printed halftone and small catalogue furniture.
    g.fillStyle = "#171310";
    g.globalAlpha = 0.14;
    for (let y = 0; y < 512; y += 6)
      for (let x = 0; x < 512; x += 6) {
        g.beginPath();
        g.arc(x + (y % 12 ? 3 : 0), y, 0.65, 0, Math.PI * 2);
        g.fill();
      }
    g.globalAlpha = 1;
    g.fillStyle = rec.labelInk;
    g.font = '11px "Space Mono"';
    g.textAlign = "right";
    g.fillText("HT—00" + (i + 1), 485, 494);
    g.textAlign = "left";
  });
}
document.fonts.ready.then(covers);
covers();

let AC = null,
  mix = null,
  toneFilter = null,
  master = null,
  analyser = null,
  crackleGain = null,
  crackleSource = null,
  hatNoise = null;
let playing = false,
  loading = false,
  rate = 1,
  rpmBase = 1,
  pitch = 0,
  dragBend = 0,
  nextBeat = 0,
  step = 0,
  bar = 0,
  timer = null,
  startTime = 0,
  elapsed = 0,
  transportToken = 0;
const voices = new Set(),
  play = document.getElementById("play"),
  status = document.getElementById("audio-status");
const speed = () => rate * rpmBase;
function ensureAudio() {
  if (AC) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) throw new Error("Web Audio unavailable");
  AC = new AudioCtor();
  mix = AC.createGain();
  mix.gain.value = 0;
  toneFilter = AC.createBiquadFilter();
  toneFilter.type = "lowpass";
  toneFilter.frequency.value = 5000;
  master = AC.createGain();
  master.gain.value = +document.getElementById("volume").value / 100;
  const limiter = AC.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.ratio.value = 5;
  analyser = AC.createAnalyser();
  analyser.fftSize = 512;
  mix
    .connect(toneFilter)
    .connect(master)
    .connect(limiter)
    .connect(analyser)
    .connect(AC.destination);
  const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate),
    d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++)
    d[i] =
      Math.random() < 0.003
        ? (Math.random() * 2 - 1) * 0.8
        : (Math.random() * 2 - 1) * 0.015;
  crackleSource = AC.createBufferSource();
  crackleSource.buffer = buf;
  crackleSource.loop = true;
  crackleGain = AC.createGain();
  crackleGain.gain.value = RECORDS[recIndex].crackle * 2;
  crackleSource.connect(crackleGain).connect(mix);
  crackleSource.start();
  hatNoise = AC.createBuffer(1, AC.sampleRate * 0.2, AC.sampleRate);
  const hd = hatNoise.getChannelData(0);
  for (let i = 0; i < hd.length; i++) hd[i] = Math.random() * 2 - 1;
  setTone();
  AC.addEventListener("statechange", () => {
    if (playing && AC.state !== "running")
      pause("Playback paused. Drop the needle to resume.");
  });
}
function envelope(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function track(source, nodes, detune = 0) {
  const voice = { source, nodes, detune };
  voices.add(voice);
  source.onended = () => {
    voices.delete(voice);
    source.disconnect();
    nodes.forEach((n) => n.disconnect());
  };
  return voice;
}
function oscillator(
  t,
  freq,
  type,
  peak,
  attack,
  duration,
  detune = 0,
  cutoff = 0,
) {
  const o = AC.createOscillator(),
    g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.setValueAtTime(detune + 1200 * Math.log2(speed()), t);
  envelope(g, t, attack, peak, duration);
  const nodes = [g];
  if (cutoff) {
    const filter = AC.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    o.connect(filter).connect(g);
    nodes.push(filter);
  } else o.connect(g);
  g.connect(mix);
  track(o, nodes, detune);
  o.start(t);
  o.stop(t + attack + duration + 0.08);
  return o;
}
function kick(t) {
  const o = oscillator(t, 125, "sine", 0.56, 0.004, 0.22);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
}
function hat(t, open) {
  const s = AC.createBufferSource(),
    g = AC.createGain(),
    hp = AC.createBiquadFilter();
  s.buffer = hatNoise;
  s.detune.value = 1200 * Math.log2(speed());
  hp.type = "highpass";
  hp.frequency.value = 7000;
  envelope(g, t, 0.002, open ? 0.09 : 0.055, open ? 0.15 : 0.035);
  s.connect(hp).connect(g).connect(mix);
  track(s, [hp, g]);
  s.start(t);
  s.stop(t + 0.2);
}
function schedule() {
  if (!playing || AC.state !== "running" || document.hidden) return;
  const rec = RECORDS[recIndex],
    dur = 60 / rec.bpm / 4 / speed();
  if (nextBeat < AC.currentTime - 0.03) nextBeat = AC.currentTime + 0.025;
  let count = 0;
  while (nextBeat < AC.currentTime + 0.1 && count++ < 8) {
    const t = nextBeat + (step % 2 ? dur * (rec.swing * 2 - 1) : 0);
    if (rec.kick[step]) kick(t);
    if (rec.hat[step]) hat(t, Math.random() < 0.12);
    if (step % 4 === 0 && Math.random() < 0.9)
      oscillator(
        t,
        st(rec.bassNotes[bar % 4]) / 2,
        "triangle",
        0.25,
        0.02,
        dur * 3,
      );
    if (step === 0)
      for (const s of rec.chords[bar % 4])
        for (const det of [-4, 3])
          oscillator(
            t,
            st(s) * 2,
            "sawtooth",
            0.026,
            0.24,
            dur * 13,
            det,
            1600,
          );
    if (Math.random() < 0.06) {
      const notes = rec.chords[bar % 4];
      oscillator(
        t,
        st(notes[Math.floor(Math.random() * notes.length)] + 24),
        "sine",
        0.07,
        0.01,
        0.5,
      );
    }
    step++;
    if (step === 16) {
      step = 0;
      bar++;
    }
    nextBeat += dur;
  }
}
function stopVoices() {
  if (!AC) return;
  for (const v of [...voices]) {
    try {
      v.source.stop(AC.currentTime + 0.035);
    } catch {}
  }
}
function retune() {
  rate = Math.max(0.35, Math.min(1.8, (1 + pitch / 100) * (1 + dragBend)));
  if (AC) {
    const cents = 1200 * Math.log2(speed());
    for (const v of voices) {
      if (v.source.detune) {
        v.source.detune.cancelScheduledValues(AC.currentTime);
        v.source.detune.setTargetAtTime(v.detune + cents, AC.currentTime, 0.02);
      } else if (v.source.playbackRate)
        v.source.playbackRate.setTargetAtTime(speed(), AC.currentTime, 0.02);
    }
    crackleSource.playbackRate.setTargetAtTime(speed(), AC.currentTime, 0.03);
  }
  document.getElementById("tempo").textContent =
    `${Math.round(RECORDS[recIndex].bpm * speed())} BPM / ${rpmBase === 1 ? "33⅓" : "45"} RPM`;
}
function syncTransport() {
  play.innerHTML = playing
    ? "Lift the needle<span>PAUSE LISTENING</span>"
    : "Drop the needle<span>START LISTENING</span>";
  play.setAttribute("aria-pressed", String(playing));
  document.getElementById("status-dot").classList.toggle("on", playing);
}
function pause(message = "Needle lifted. The record will wait.") {
  transportToken++;
  if (playing && AC) elapsed += AC.currentTime - startTime;
  playing = false;
  clearInterval(timer);
  timer = null;
  if (AC) {
    mix.gain.cancelScheduledValues(AC.currentTime);
    mix.gain.setTargetAtTime(0, AC.currentTime, 0.012);
    stopVoices();
  }
  syncTransport();
  status.textContent = message;
}
async function start() {
  const token = ++transportToken;
  loading = true;
  play.disabled = true;
  try {
    ensureAudio();
    await AC.resume();
    if (token !== transportToken || document.hidden) return;
    playing = true;
    startTime = AC.currentTime;
    step = 0;
    bar = 0;
    nextBeat = AC.currentTime + 0.08;
    mix.gain.cancelScheduledValues(AC.currentTime);
    mix.gain.setTargetAtTime(1, AC.currentTime, 0.025);
    crackleGain.gain.setTargetAtTime(
      RECORDS[recIndex].crackle * 2,
      AC.currentTime,
      0.1,
    );
    retune();
    clearInterval(timer);
    timer = setInterval(schedule, 25);
    schedule();
    status.textContent = `Now playing: ${RECORDS[recIndex].title.toLowerCase()}.`;
    syncTransport();
  } catch {
    playing = false;
    status.textContent =
      "Audio could not start. Try dropping the needle again.";
    syncTransport();
  } finally {
    loading = false;
    play.disabled = false;
  }
}
play.addEventListener("click", () => {
  if (loading) return;
  playing ? pause() : start();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (playing || loading))
    pause("Paused while you were away. Drop the needle to continue.");
});
addEventListener("pagehide", () => pause());
const TITLES = [
    "Dust Loops, Vol. 2",
    "Night Bus",
    "Paper Moon",
    "Static Bloom",
  ],
  ARTISTS = ["Cassette Ghost", "Mira Wells", "The Interval", "Foyer"];
document.querySelectorAll("[data-rec]").forEach((b) =>
  b.addEventListener("click", () => {
    const wasPlaying = playing;
    if (wasPlaying) pause();
    recIndex = +b.dataset.rec;
    elapsed = 0;
    step = 0;
    bar = 0;
    document
      .querySelectorAll("[data-rec]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.getElementById("track-title").textContent = TITLES[recIndex];
    document.getElementById("track-artist").textContent =
      `${ARTISTS[recIndex]} · HT-00${recIndex + 1}`;
    retune();
    status.textContent = `${TITLES[recIndex]} is on the deck.`;
    if (wasPlaying) start();
  }),
);
document.querySelectorAll("[data-rpm]").forEach((b) =>
  b.addEventListener("click", () => {
    rpmBase = b.dataset.rpm === "45" ? 1.35 : 1;
    document
      .querySelectorAll("[data-rpm]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    retune();
  }),
);
function setPitch(value) {
  pitch = Math.max(-8, Math.min(8, value));
  document.getElementById("pitch").value = pitch;
  document.getElementById("pitch-out").textContent =
    (pitch >= 0 ? "+" : "") + pitch.toFixed(1) + "%";
  retune();
}
document
  .getElementById("pitch")
  .addEventListener("input", (e) => setPitch(+e.target.value));
document
  .getElementById("pitch-reset")
  .addEventListener("click", () => setPitch(0));
document.getElementById("volume").addEventListener("input", (e) => {
  document.getElementById("volume-out").textContent = e.target.value;
  if (master)
    master.gain.setTargetAtTime(+e.target.value / 100, AC.currentTime, 0.03);
});
function setTone() {
  const v = +document.getElementById("tone").value;
  document.getElementById("tone-out").textContent =
    v < 33 ? "Soft" : v < 70 ? "Warm" : "Open";
  if (toneFilter)
    toneFilter.frequency.setTargetAtTime(
      900 * Math.pow(14, v / 100),
      AC.currentTime,
      0.04,
    );
}
document.getElementById("tone").addEventListener("input", setTone);
let angle = 0,
  dragging = false,
  lastAngle = 0,
  arm = 0,
  vu = 0,
  lastRate = 0,
  lastUi = 0;
function point(e) {
  const r = canvas.getBoundingClientRect();
  return [
    (e.clientX - r.left - offsetX) / scale,
    (e.clientY - r.top - offsetY) / scale,
  ];
}
canvas.addEventListener("pointerdown", (e) => {
  const [x, y] = point(e);
  if (Math.hypot(x - 300, y - 246) > 179) return;
  dragging = true;
  lastAngle = Math.atan2(y - 246, x - 300);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const [x, y] = point(e),
    a = Math.atan2(y - 246, x - 300);
  let da = a - lastAngle;
  if (da > Math.PI) da -= Math.PI * 2;
  if (da < -Math.PI) da += Math.PI * 2;
  angle += da;
  lastAngle = a;
  dragBend = Math.max(-0.6, Math.min(0.6, da * 6));
  retune();
});
function endDrag() {
  dragging = false;
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
addEventListener("blur", endDrag);
canvas.addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) return;
  e.preventDefault();
  setPitch(e.key === "Home" ? 0 : pitch + (e.key === "ArrowRight" ? 1 : -1));
});
function round(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
function circle(x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const rec = RECORDS[recIndex];
  // Rubber feet, layered walnut plinth and brushed alloy top plate.
  ctx.shadowColor = "#0009";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 13;
  round(32, 58, 756, 390, 13, "#4c3020");
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  round(63, 440, 82, 14, 4, "#0c0c0a");
  round(675, 440, 82, 14, 4, "#0c0c0a");
  const wood = ctx.createLinearGradient(0, 400, 0, 452);
  wood.addColorStop(0, "#7d5134");
  wood.addColorStop(0.4, "#5a3926");
  wood.addColorStop(1, "#39251b");
  round(32, 385, 756, 63, 10, wood);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(32, 385, 756, 63, 10);
  ctx.clip();
  for (let i = 0; i < 17; i++) {
    ctx.strokeStyle = i % 3 ? "#b27b4c18" : "#24160e30";
    ctx.beginPath();
    ctx.moveTo(31, 389 + i * 3);
    ctx.bezierCurveTo(210, 382 + i * 3, 590, 401 + i * 2, 789, 390 + i * 3);
    ctx.stroke();
  }
  ctx.restore();
  const plate = ctx.createLinearGradient(0, 48, 700, 425);
  plate.addColorStop(0, "#8f9487");
  plate.addColorStop(0.4, "#747a6f");
  plate.addColorStop(1, "#4b514b");
  round(43, 47, 734, 374, 8, plate, "#bdc0aa");
  ctx.fillStyle = "#ffffff06";
  for (let y = 53; y < 416; y += 3) ctx.fillRect(49, y, 721, 1);
  for (const [x, y] of [
    [57, 61],
    [763, 61],
    [57, 407],
    [763, 407],
  ]) {
    circle(x, y, 3, "#3b403b", "#a4aa9b");
    ctx.strokeStyle = "#aeb1a2";
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y - 1);
    ctx.lineTo(x + 1.5, y + 1);
    ctx.stroke();
  }
  // Platter bevel and strobe rings.
  const rim = ctx.createLinearGradient(120, 60, 480, 421);
  rim.addColorStop(0, "#d1d3bd");
  rim.addColorStop(0.3, "#4b5049");
  rim.addColorStop(0.65, "#a5aa98");
  rim.addColorStop(1, "#333933");
  circle(300, 246, 186, "#222722");
  circle(300, 243, 180, rim, "#b9bca9");
  circle(300, 243, 169, "#262824");
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2 + angle * 0.6,
        r = 174 + row * 5;
      circle(
        300 + Math.cos(a) * r,
        243 + Math.sin(a) * r,
        1.3,
        row ? "#171b16" : "#d1d3ba",
      );
    }
  ctx.save();
  ctx.translate(300, 243);
  ctx.rotate(angle);
  circle(0, 0, 164, rec.vinyl);
  for (let r = 62; r < 161; r += 2) {
    ctx.strokeStyle = r % 10 < 3 ? "#d6d1b71d" : "#d6d1b70c";
    ctx.lineWidth = 0.7;
    circle(0, 0, r, null, ctx.strokeStyle);
  }
  ctx.rotate(-angle);
  const sheen = ctx.createConicGradient(-0.7, 0, 0);
  sheen.addColorStop(0, "#ffffff00");
  sheen.addColorStop(0.12, "#ffffff12");
  sheen.addColorStop(0.26, "#ffffff00");
  sheen.addColorStop(0.58, "#ffffff0c");
  sheen.addColorStop(0.72, "#ffffff00");
  circle(0, 0, 164, sheen);
  ctx.rotate(angle);
  circle(0, 0, 59, rec.labelBg);
  ctx.fillStyle = rec.labelInk;
  ctx.textAlign = "center";
  ctx.font = "16px Anton";
  ctx.fillText("HALFTONE", 0, -29);
  ctx.font = '7px "Space Mono"';
  ctx.fillText(rec.title, 0, -11);
  ctx.fillText(rec.artist, 0, 10);
  ctx.fillText("HT—00" + (recIndex + 1) + "   SIDE A", 0, 30);
  circle(0, 0, 5, "#aeb2a0", "#31352f");
  circle(0, 0, 2, "#f3f1d4");
  ctx.restore();
  // Gimbal, counterweight, cue lever and bent aluminium tonearm.
  circle(630, 120, 37, "#394039", "#acb09c");
  circle(630, 120, 27, "#8b9384", "#c9ccba");
  circle(630, 120, 14, "#424a42");
  ctx.save();
  ctx.translate(630, 120);
  ctx.rotate(arm * 0.9);
  ctx.strokeStyle = "#171c1799";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(4, 5);
  ctx.lineTo(14, 194);
  ctx.lineTo(-14, 234);
  ctx.stroke();
  ctx.strokeStyle = "#c2c7b5";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, -27);
  ctx.lineTo(10, 190);
  ctx.lineTo(-18, 230);
  ctx.stroke();
  ctx.strokeStyle = "#f0f0dc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -27);
  ctx.lineTo(8, 190);
  ctx.lineTo(-20, 230);
  ctx.stroke();
  round(-14, -52, 29, 34, 5, "#414941", "#acb09e");
  for (let y = -46; y < -20; y += 4) {
    ctx.strokeStyle = "#7c8476";
    ctx.beginPath();
    ctx.moveTo(-12, y);
    ctx.lineTo(12, y);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(-18, 230);
  ctx.rotate(0.55);
  round(-10, -4, 20, 42, 3, "#272c26", "#a1a58e");
  round(-8, 24, 16, 12, 1, rec.labelBg);
  ctx.fillStyle = "#b4bba6";
  ctx.fillRect(-4, 4, 2, 12);
  ctx.fillRect(2, 4, 2, 12);
  ctx.restore();
  ctx.restore();
  round(661, 219, 23, 14, 3, "#373e35");
  round(668, 207, 8, 30, 3, "#a4ab96");
  // Warm back-lit VU meter, printed scales and level needle.
  round(528, 315, 115, 70, 5, "#333a31", "#a8ae98");
  round(535, 322, 101, 53, 2, "#d4c99f");
  ctx.strokeStyle = "#746a4c";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(586, 376, 43, Math.PI * 1.13, Math.PI * 1.88);
  ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 1.13 + (i / 10) * Math.PI * 0.75;
    ctx.strokeStyle = i > 8 ? "#ae5232" : "#71694e";
    ctx.beginPath();
    ctx.moveTo(586 + Math.cos(a) * 37, 376 + Math.sin(a) * 37);
    ctx.lineTo(586 + Math.cos(a) * 43, 376 + Math.sin(a) * 43);
    ctx.stroke();
  }
  const meter = reduced ? (playing ? 0.22 : 0) : vu,
    a = Math.PI * 1.14 + Math.min(1, meter) * Math.PI * 0.7;
  ctx.strokeStyle = "#b15130";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(586, 375);
  ctx.lineTo(586 + Math.cos(a) * 42, 375 + Math.sin(a) * 42);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#5b513c";
  ctx.font = '7px "Space Mono"';
  ctx.fillText("STEREO / VU", 585, 368);
  // Physical switch and machined speed dial.
  circle(706, 356, 26, "#424a40", "#c0c5ad");
  circle(706, 356, 21, "#717b68", "#30372e");
  ctx.strokeStyle = "#e5e5ca";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(706, 356);
  ctx.lineTo(706 + (rpmBase === 1 ? -9 : 11), 339);
  ctx.stroke();
  circle(94, 372, 15, "#30372d", "#afb69c");
  circle(94, 372, 5, playing ? "#ed823e" : "#665f3d");
  ctx.fillStyle = "#23291f";
  ctx.textAlign = "left";
  ctx.font = '10px "Space Mono"';
  ctx.fillText("HALFTONE", 535, 266);
  ctx.font = '7px "Space Mono"';
  ctx.fillText("DIRECT DRIVE / HT—01", 535, 283);
  ctx.fillText("POWER", 76, 401);
  ctx.textAlign = "center";
  ctx.fillText("33⅓     45", 706, 398);
  ctx.restore();
}
const samples = new Uint8Array(256);
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!dragging && Math.abs(dragBend) > 0.0001) {
    dragBend *= Math.exp(-dt * 6);
    retune();
  }
  if (playing && !dragging && !reduced) angle += dt * 3.49 * speed();
  if (!playing && !dragging && !reduced) angle += dt * 0.015;
  arm += (Number(playing) - arm) * (reduced ? 1 : 1 - Math.exp(-dt * 7));
  if (playing && analyser && !reduced) {
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const v of samples) sum += ((v - 128) / 128) ** 2;
    vu += (Math.sqrt(sum / samples.length) * 4 - vu) * 0.25;
  } else vu *= 0.88;
  if (now - lastUi > 250) {
    lastUi = now;
    const t = Math.floor(elapsed + (playing ? AC.currentTime - startTime : 0));
    document.getElementById("elapsed").textContent =
      `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
