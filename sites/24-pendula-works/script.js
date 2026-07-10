/* ============================================================
   PENDULA — the machine thinks in ink
   A four-arm damped harmonograph, integrated in real time and
   drawn with accumulating ink on an unclearing canvas layer.
   Two ghost pendulum bobs swing at the table's edge so you can
   see the mechanism, not just its handwriting. Strike restarts
   the decay with fresh amplitudes; the intervals are musical
   ratios because Lissajous knew what he was doing.
   ============================================================ */

const canvas = document.getElementById('table');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 820px)').matches;

/* two layers: ink accumulates on an offscreen canvas */
const ink = document.createElement('canvas');
const inkCtx = ink.getContext('2d');

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ink.width = W * DPR;
  ink.height = H * DPR;
  inkCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  inkCtx.fillStyle = '#f4f1ea';
  inkCtx.fillRect(0, 0, W, H);
  redrawFromStart();
}

/* ---------- harmonograph model ---------- */

const RATIOS = [[1, 1], [2, 1], [3, 2], [4, 3], [5, 4], [5, 3]];
const params = {
  ratio: 2,          // index into RATIOS
  phase: Math.PI / 2,
  decay: 0.07,       // per-second amplitude decay
  seed: 1,
};
let amps = null;     // randomized per strike
let simT = 0;        // machine time
let penDown = true;
let etude = 1;

function randomizeAmps() {
  const r = () => 0.55 + Math.random() * 0.45;
  amps = {
    x1: r(), x2: r() * 0.5, y1: r(), y2: r() * 0.5,
    fx2: 2 + ((Math.random() * 3) | 0),      // secondary harmonics
    fy2: 2 + ((Math.random() * 3) | 0),
    p2: Math.random() * Math.PI * 2,
  };
}
randomizeAmps();

function penAt(t) {
  const [a, b] = RATIOS[params.ratio];
  const decay = Math.exp(-params.decay * t);
  const decay2 = Math.exp(-params.decay * 1.6 * t);
  const R = Math.min(W, H) * 0.34;
  const fx = a * 1.0, fy = b * 1.0;
  const x = (Math.sin(t * fx + params.phase) * amps.x1 * decay +
             Math.sin(t * fx * amps.fx2 + amps.p2) * amps.x2 * decay2) * R;
  const y = (Math.sin(t * fy) * amps.y1 * decay +
             Math.sin(t * fy * amps.fy2) * amps.y2 * decay2) * R;
  // the paper itself rotates imperceptibly (a rotary table)
  const rot = t * 0.006;
  const cx = W / 2 + (isMobile ? 0 : -W * 0.06);
  const cy = H / 2 + (isMobile ? -H * 0.08 : 0);
  return [
    cx + x * Math.cos(rot) - y * Math.sin(rot),
    cy + x * Math.sin(rot) + y * Math.cos(rot),
  ];
}

/* ---------- drawing ---------- */

const SPEED = 1.35;              // machine-seconds per real second

function inkSegment(t0, t1) {
  if (!penDown) return;
  inkCtx.strokeStyle = 'rgba(35, 33, 32, 0.4)';
  inkCtx.lineWidth = Math.max(0.5, 1.3 * Math.exp(-params.decay * t0 * 0.5));
  inkCtx.beginPath();
  let [x, y] = penAt(t0);
  inkCtx.moveTo(x, y);
  const n = Math.ceil((t1 - t0) * 60);
  for (let i = 1; i <= n; i++) {
    [x, y] = penAt(t0 + ((t1 - t0) * i) / n);
    inkCtx.lineTo(x, y);
  }
  inkCtx.stroke();
}

function redrawFromStart() {
  if (!amps) return;
  inkCtx.fillStyle = '#f4f1ea';
  inkCtx.fillRect(0, 0, W, H);
  // fast-forward everything already drawn
  const upto = reduceMotion ? 130 : simT;
  const step = 0.05;
  for (let t = 0; t < upto; t += step) inkSegment(t, Math.min(t + step, upto));
  if (reduceMotion) simT = Math.max(simT, 130);
}

/* ---------- the visible mechanism ---------- */

function drawMachine(t) {
  const [a, b] = RATIOS[params.ratio];
  const decay = Math.exp(-params.decay * t);
  // two bobs on the frame edges: x-pendulum below, y-pendulum at left
  const bobY = H - (isMobile ? 120 : 64);
  const bobX = 54;
  const xSwing = Math.sin(t * a + params.phase) * decay;
  const ySwing = Math.sin(t * b) * decay;

  ctx.strokeStyle = 'rgba(35, 33, 32, 0.3)';
  ctx.lineWidth = 1;
  // x rail
  ctx.beginPath();
  ctx.moveTo(W * 0.3, bobY);
  ctx.lineTo(W * 0.7, bobY);
  ctx.stroke();
  ctx.fillStyle = '#9c7c3c';
  ctx.beginPath();
  ctx.arc(W * 0.5 + xSwing * W * 0.17, bobY, 7, 0, Math.PI * 2);
  ctx.fill();
  if (!isMobile) {
    // y rail
    ctx.strokeStyle = 'rgba(35, 33, 32, 0.3)';
    ctx.beginPath();
    ctx.moveTo(bobX, H * 0.3);
    ctx.lineTo(bobX, H * 0.7);
    ctx.stroke();
    ctx.fillStyle = '#9c7c3c';
    ctx.beginPath();
    ctx.arc(bobX, H * 0.5 + ySwing * H * 0.16, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // pen head
  if (penDown && decay > 0.02) {
    const [px2, py2] = penAt(t);
    ctx.strokeStyle = '#9c7c3c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(px2, py2, 6 + decay * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#232120';
    ctx.beginPath();
    ctx.arc(px2, py2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------- controls ---------- */

const ratioIn = document.getElementById('ratio');
const phaseIn = document.getElementById('phase');
const decayIn = document.getElementById('decay');
const ratioOut = document.getElementById('ratio-out');
const phaseOut = document.getElementById('phase-out');
const decayOut = document.getElementById('decay-out');
const etudeEl = document.getElementById('etude');

function restart(newEtude = true) {
  simT = 0;
  penDown = true;
  if (newEtude) { etude++; etudeEl.textContent = etude; }
  inkCtx.fillStyle = '#f4f1ea';
  inkCtx.fillRect(0, 0, W, H);
  if (reduceMotion) redrawFromStart();
}

ratioIn.addEventListener('input', () => {
  params.ratio = +ratioIn.value;
  const [a, b] = RATIOS[params.ratio];
  ratioOut.textContent = `${a} : ${b}`;
  restart(false);
});
phaseIn.addEventListener('input', () => {
  params.phase = (+phaseIn.value * Math.PI) / 180;
  phaseOut.textContent = `${phaseIn.value}°`;
  restart(false);
});
decayIn.addEventListener('input', () => {
  params.decay = +decayIn.value / 100;
  decayOut.textContent = +decayIn.value < 6 ? 'patient' : +decayIn.value < 13 ? 'gentle' : 'hasty';
  restart(false);
});
document.getElementById('strike').addEventListener('click', () => {
  randomizeAmps();
  restart(true);
});
document.getElementById('lift').addEventListener('click', () => { penDown = !penDown; });

window.addEventListener('resize', resize);
resize();

/* ---------- loop ---------- */

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (!reduceMotion) {
    const t1 = simT + dt * SPEED;
    // several fine sub-segments so tight curves stay smooth
    const step = (t1 - simT) / 4;
    for (let i = 0; i < 4; i++) inkSegment(simT + step * i, simT + step * (i + 1));
    simT = t1;
  }

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(ink, 0, 0, W, H);
  drawMachine(reduceMotion ? 130 : simT);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
