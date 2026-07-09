/* ============================================================
   KOPPAR — roast the batch yourself
   A thermodynamic toy: hold for heat, release to coast. Bean
   temperature follows a lag model, 140 beans tumble in a drawn
   copper drum and darken through the true color stages, first
   and second crack pop visibly, and a profile logger draws the
   curve underneath — with your crack markers on it.
   ============================================================ */

const canvas = document.getElementById('roaster');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 820px)').matches;

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

/* ---------- roast model ---------- */

const roast = {
  heatOn: false,
  airTemp: 21,        // what the burner gives the drum
  beanTemp: 21,       // what the beans actually are
  time: 0,            // roast clock, seconds
  level: 0,           // 0 green .. 1 charcoal, follows temp exposure
  curve: [],          // [time, beanTemp] samples
  events: [],         // { time, temp, label }
  firstCrack: false,
  secondCrack: false,
  ruined: false,
  started: false,
};

const STAGES = [
  { until: 0.06, name: 'GREEN', notes: ['grass', 'hay', 'raw pea'], advice: 'unroasted. hold the heat.' },
  { until: 0.2, name: 'DRYING', notes: ['steam', 'wet grass', 'cereal'], advice: 'moisture leaving. keep it steady.' },
  { until: 0.36, name: 'YELLOWING', notes: ['bread', 'toast', 'barley'], advice: 'maillard has begun — sugars waking up.' },
  { until: 0.52, name: 'CINNAMON', notes: ['malt', 'lemon', 'green apple'], advice: 'bright and grassy still. most people go further.' },
  { until: 0.66, name: 'CITY', notes: ['caramel', 'hazelnut', 'cane sugar'], advice: 'first crack behind you. this is the honest roast.' },
  { until: 0.78, name: 'FULL CITY', notes: ['cocoa', 'brown butter', 'fig'], advice: 'sweetness peaking. a fine place to stop.' },
  { until: 0.88, name: 'VIENNA', notes: ['dark chocolate', 'molasses', 'smoke'], advice: 'oils surfacing. the bean is losing its origin.' },
  { until: 0.97, name: 'FRENCH', notes: ['carbon', 'burnt sugar', 'ash'], advice: 'this is roast flavor now, not coffee flavor.' },
  { until: 2, name: 'CHARCOAL', notes: ['regret'], advice: 'you have made fuel. new batch?' },
];

function beanColor(level, shade = 0) {
  // green -> straw -> cinnamon -> chestnut -> espresso -> black
  const stops = [
    [0, [138, 148, 100]],
    [0.2, [176, 165, 110]],
    [0.38, [196, 158, 96]],
    [0.55, [150, 96, 55]],
    [0.72, [96, 58, 34]],
    [0.88, [52, 32, 22]],
    [1, [24, 18, 15]],
  ];
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1][0] < level) i++;
  const [l0, c0] = stops[i], [l1, c1] = stops[i + 1];
  const t = Math.min(1, Math.max(0, (level - l0) / (l1 - l0)));
  const r = c0[0] + (c1[0] - c0[0]) * t - shade;
  const g = c0[1] + (c1[1] - c0[1]) * t - shade;
  const b = c0[2] + (c1[2] - c0[2]) * t - shade;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* ---------- beans in the drum ---------- */

const BEANS = isMobile ? 80 : 140;
const beans = Array.from({ length: BEANS }, () => {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random());
  return {
    a, r,
    rot: Math.random() * Math.PI * 2,
    size: 0.75 + Math.random() * 0.5,
    shade: Math.random() * 26,
    jx: 0, jy: 0,
  };
});

/* pops: starburst particles at first/second crack */
const pops = [];
function popBurst(cx, cy, drumR, count, strength) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * drumR * 0.7;
    pops.push({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
      vx: (Math.random() - 0.5) * strength, vy: (Math.random() - 0.7) * strength,
      life: 1,
    });
  }
}

/* ---------- UI ---------- */

const heatBtn = document.getElementById('heat');
const batchBtn = document.getElementById('batch');
const cupRoast = document.getElementById('cup-roast');
const cupTemp = document.getElementById('cup-temp');
const cupNotes = document.getElementById('cup-notes');
const cupAdvice = document.getElementById('cup-advice');

function setHeat(on) {
  if (roast.ruined && on) return;
  roast.heatOn = on;
  if (on) roast.started = true;
  heatBtn.classList.toggle('on', on);
}
heatBtn.addEventListener('pointerdown', (e) => { heatBtn.setPointerCapture(e.pointerId); setHeat(true); });
heatBtn.addEventListener('pointerup', () => setHeat(false));
heatBtn.addEventListener('pointercancel', () => setHeat(false));
window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); setHeat(true); } });
window.addEventListener('keyup', (e) => { if (e.code === 'Space') setHeat(false); });
window.addEventListener('blur', () => setHeat(false));

function newBatch() {
  roast.heatOn = false;
  roast.airTemp = 21;
  roast.beanTemp = 21;
  roast.time = 0;
  roast.level = 0;
  roast.curve = [];
  roast.events = [];
  roast.firstCrack = false;
  roast.secondCrack = false;
  roast.ruined = false;
  roast.started = false;
  heatBtn.classList.remove('on');
  for (const b of beans) b.shade = Math.random() * 26;
}
batchBtn.addEventListener('click', newBatch);

let lastStage = null;
function updateCard() {
  const stage = STAGES.find(s => roast.level <= s.until) || STAGES[STAGES.length - 1];
  if (stage !== lastStage) {
    lastStage = stage;
    cupRoast.textContent = stage.name;
    cupNotes.innerHTML = stage.notes.map(n => `<li>${n}</li>`).join('');
    cupAdvice.textContent = stage.advice;
  }
  cupTemp.textContent = Math.round(roast.beanTemp);
}

/* ---------- physics + drawing ---------- */

let drumAngle = 0;
let shake = 0;
let sampleAcc = 0;

function update(dt) {
  // burner
  if (roast.heatOn) roast.airTemp = Math.min(260, roast.airTemp + dt * 26);
  else roast.airTemp = Math.max(21, roast.airTemp - dt * 14);
  // beans lag the air
  roast.beanTemp += (roast.airTemp - roast.beanTemp) * dt * 0.16;

  if (roast.started && !roast.ruined) {
    roast.time += dt;
    // development accumulates when beans are hot
    if (roast.beanTemp > 130) {
      roast.level = Math.min(1, roast.level + dt * (roast.beanTemp - 130) * 0.00045);
    }
    sampleAcc += dt;
    if (sampleAcc > 0.4) {
      roast.curve.push([roast.time, roast.beanTemp]);
      if (roast.curve.length > 400) roast.curve.shift();
      sampleAcc = 0;
    }
    if (!roast.firstCrack && roast.beanTemp >= 196 && roast.level > 0.4) {
      roast.firstCrack = true;
      roast.events.push({ time: roast.time, temp: roast.beanTemp, label: 'FIRST CRACK' });
      shake = 1;
    }
    if (!roast.secondCrack && roast.beanTemp >= 224 && roast.level > 0.72) {
      roast.secondCrack = true;
      roast.events.push({ time: roast.time, temp: roast.beanTemp, label: 'SECOND CRACK' });
      shake = 1;
    }
    if (roast.level >= 1) {
      roast.ruined = true;
      roast.heatOn = false;
      heatBtn.classList.remove('on');
      roast.events.push({ time: roast.time, temp: roast.beanTemp, label: 'CHARCOAL' });
    }
  }

  const spin = reduceMotion ? (roast.heatOn ? 1.4 : 0) : (0.9 + (roast.heatOn ? 0.9 : 0));
  drumAngle += dt * spin;
  shake = Math.max(0, shake - dt * 1.8);
}

function draw(t) {
  ctx.fillStyle = '#f6f0e4';
  ctx.fillRect(0, 0, W, H);

  const cx = W * (isMobile ? 0.5 : 0.46);
  const cy = H * (isMobile ? 0.36 : 0.42);
  const R = Math.min(W, H) * (isMobile ? 0.24 : 0.27);

  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 7, (Math.random() - 0.5) * shake * 7);

  // heat haze rising when the burner is on
  if (roast.airTemp > 60) {
    const haze = (roast.airTemp - 60) / 200;
    for (let i = 0; i < 5; i++) {
      const hx = cx - R * 0.6 + i * R * 0.3;
      const wob = reduceMotion ? 0 : Math.sin(t * 2.2 + i * 1.7) * 10;
      const g = ctx.createLinearGradient(0, cy + R * 1.15, 0, cy - R * 1.6);
      g.addColorStop(0, `rgba(176, 101, 58, ${0.13 * haze})`);
      g.addColorStop(1, 'rgba(176, 101, 58, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(hx + wob, cy - R * 0.2, 14, R * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // drum shell
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#b0653a';
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(47, 32, 25, 0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy, R + 8, 0, Math.PI * 2);
  ctx.stroke();
  // drum window
  const win = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
  win.addColorStop(0, 'rgba(255, 252, 244, 0.9)');
  win.addColorStop(1, 'rgba(238, 226, 202, 0.9)');
  ctx.fillStyle = win;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 5, 0, Math.PI * 2);
  ctx.fill();

  // vanes
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R - 5, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(176, 101, 58, 0.5)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    const a = drumAngle + (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2);
    ctx.lineTo(cx + Math.cos(a) * R * 0.96, cy + Math.sin(a) * R * 0.96);
    ctx.stroke();
  }

  // beans, tumbling in the lower half
  for (const b of beans) {
    const tumble = drumAngle * (0.5 + b.size * 0.3) + b.a * 7;
    // beans pool at the bottom and get flung up the rising side
    const poolA = Math.PI / 2 + Math.sin(tumble) * (0.55 + b.r * 0.45);
    const poolR = R * (0.35 + b.r * 0.55);
    const bx = cx + Math.cos(poolA) * poolR + Math.sin(tumble * 1.7) * 6;
    const by = cy + Math.sin(poolA) * poolR * 0.9 - Math.abs(Math.sin(tumble)) * R * 0.12;
    const s = R * 0.052 * b.size;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(b.rot + tumble);
    ctx.fillStyle = beanColor(roast.level, b.shade);
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    // centre cut
    ctx.strokeStyle = 'rgba(246, 240, 228, 0.5)';
    ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, 0);
    ctx.quadraticCurveTo(0, s * 0.22, s * 0.7, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // crack pops
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.life -= 0.03;
    p.x += p.vx; p.y += p.vy; p.vy += 0.12;
    if (p.life <= 0) { pops.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(176, 101, 58, ${p.life})`;
    ctx.lineWidth = 1.6;
    const s = 4 * p.life;
    ctx.beginPath();
    ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
    ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
    ctx.stroke();
  }
  // random pops while crack windows are open
  if (!reduceMotion) {
    if (roast.firstCrack && roast.beanTemp > 193 && roast.level < 0.62 && Math.random() < 0.2) {
      popBurst(cx, cy, R, 2, 3);
    }
    if (roast.secondCrack && roast.beanTemp > 220 && Math.random() < 0.3) {
      popBurst(cx, cy, R, 3, 2);
    }
  }

  ctx.restore();

  drawProfile(t);
}

/* the roast logger strip along the bottom */
function drawProfile() {
  const px = W * 0.08, pw = W * 0.84;
  const py = H * (isMobile ? 0.72 : 0.74), ph = H * 0.16;

  ctx.strokeStyle = 'rgba(47, 32, 25, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py); ctx.lineTo(px, py + ph); ctx.lineTo(px + pw, py + ph);
  ctx.stroke();

  ctx.font = '300 10px "DM Sans", sans-serif';
  ctx.fillStyle = 'rgba(47, 32, 25, 0.5)';
  ctx.textAlign = 'left';
  ctx.fillText('260°', px + 4, py + 8);
  ctx.fillText('21°', px + 4, py + ph - 3);
  ctx.textAlign = 'right';
  ctx.fillText(`${roast.time.toFixed(0)}s`, px + pw, py + ph + 14);

  // reference lines for the cracks
  for (const [temp, label] of [[196, '1st crack'], [224, '2nd crack']]) {
    const y = py + ph - ((temp - 21) / 239) * ph;
    ctx.strokeStyle = 'rgba(176, 101, 58, 0.25)';
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(px, y); ctx.lineTo(px + pw, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(176, 101, 58, 0.6)';
    ctx.fillText(label, px + pw - 54, y - 4);
  }

  if (roast.curve.length > 1) {
    const tMax = Math.max(40, roast.time);
    ctx.strokeStyle = '#b0653a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < roast.curve.length; i++) {
      const [ct, temp] = roast.curve[i];
      const x = px + (ct / tMax) * pw;
      const y = py + ph - ((temp - 21) / 239) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (const ev of roast.events) {
      const x = px + (ev.time / tMax) * pw;
      const y = py + ph - ((ev.temp - 21) / 239) * ph;
      ctx.fillStyle = '#2f2019';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillText(ev.label, x, y - 10);
    }
  }
}

/* ---------- loop ---------- */

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw(now / 1000);
  updateCard();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
