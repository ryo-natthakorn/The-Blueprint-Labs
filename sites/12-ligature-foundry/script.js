/* ============================================================
   LIGATURE — a specimen you conduct
   The pointer is the type designer: X bends weight, Y bends
   optical size, the wheel softens terminals, W toggles wonk.
   A glyph waterfall at the foot of the page ripples in the
   pointer's wake. No canvas — the medium IS the typeface.
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const specimen = document.getElementById('specimen');
const wave = document.getElementById('wave');
const hint = document.getElementById('hint');

const WORDS = [
  'Marmalade', 'Quixotic', 'Aqueduct', 'Filigree', 'Rhapsody',
  'Bergamot', 'Softserve', 'Wrought', 'Gossamer', 'Typecast',
];
let wordIndex = 0;

/* ---------- live axis state, eased toward a target ---------- */

const axes = {
  wght: { val: 400, goal: 400, min: 100, max: 900 },
  opsz: { val: 72, goal: 72, min: 9, max: 144 },
  SOFT: { val: 0, goal: 0, min: 0, max: 100 },
  WONK: { val: 0, goal: 0, min: 0, max: 1 },
};

const hud = {
  wght: [document.getElementById('v-wght'), document.getElementById('b-wght')],
  opsz: [document.getElementById('v-opsz'), document.getElementById('b-opsz')],
  SOFT: [document.getElementById('v-soft'), document.getElementById('b-soft')],
  WONK: [document.getElementById('v-wonk'), document.getElementById('b-wonk')],
};

let pointerActive = false;
let idleT = Math.random() * 100;
let px = 0.5, py = 0.5;         // normalized pointer, drives the wave too
let hintDismissed = false;

window.addEventListener('pointermove', (e) => {
  pointerActive = true;
  px = e.clientX / window.innerWidth;
  py = e.clientY / window.innerHeight;
  axes.wght.goal = 100 + px * 800;
  axes.opsz.goal = 144 - py * 135;
  if (!hintDismissed && (px < 0.2 || px > 0.8)) {
    hint.style.opacity = '0';
    hintDismissed = true;
  }
});

window.addEventListener('wheel', (e) => {
  axes.SOFT.goal = Math.min(100, Math.max(0, axes.SOFT.goal + e.deltaY * 0.08));
}, { passive: true });

window.addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'W') {
    axes.WONK.goal = axes.WONK.goal > 0.5 ? 0 : 1;
  }
});

/* touch: a drag anywhere becomes the pointer */
window.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  pointerActive = true;
  px = t.clientX / window.innerWidth;
  py = t.clientY / window.innerHeight;
  axes.wght.goal = 100 + px * 800;
  axes.opsz.goal = 144 - py * 135;
}, { passive: true });

/* ---------- next word ---------- */

specimen.addEventListener('click', () => {
  wordIndex = (wordIndex + 1) % WORDS.length;
  if (reduceMotion) {
    specimen.textContent = WORDS[wordIndex];
    return;
  }
  specimen.classList.remove('swap');
  void specimen.offsetWidth; // restart the animation
  specimen.classList.add('swap');
  setTimeout(() => { specimen.textContent = WORDS[wordIndex]; }, 240);
});

/* ---------- glyph waterfall ---------- */

const GLYPHS = 'AaBbGgKkQqRrSsWw&?!§*'.split('');
const glyphEls = [];
{
  const frag = document.createDocumentFragment();
  const count = window.innerWidth < 720 ? 12 : GLYPHS.length;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.textContent = GLYPHS[i % GLYPHS.length];
    frag.appendChild(s);
    glyphEls.push(s);
  }
  wave.appendChild(frag);
}

/* ---------- the loop ---------- */

function setSpecimen(w, o, s, k) {
  specimen.style.fontVariationSettings =
    `"wght" ${w.toFixed(0)}, "opsz" ${o.toFixed(1)}, "SOFT" ${s.toFixed(0)}, "WONK" ${k > 0.5 ? 1 : 0}`;
}

function updateHud() {
  for (const key of Object.keys(axes)) {
    const a = axes[key];
    const [valEl, barEl] = hud[key];
    if (!valEl) continue;
    valEl.textContent = key === 'WONK' ? (a.val > 0.5 ? 'on' : 'off')
      : key === 'opsz' ? a.val.toFixed(0)
      : Math.round(a.val);
    barEl.style.transform = `scaleX(${((a.val - a.min) / (a.max - a.min)).toFixed(3)})`;
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // idle: the specimen breathes through its weight axis on its own
  if (!pointerActive && !reduceMotion) {
    idleT += dt;
    axes.wght.goal = 500 + Math.sin(idleT * 0.7) * 320;
    axes.opsz.goal = 76 + Math.cos(idleT * 0.45) * 55;
    px = 0.5 + Math.sin(idleT * 0.7) * 0.4;
  }

  const ease = reduceMotion ? 1 : 1 - Math.pow(0.001, dt); // ~snappy critically damped
  for (const key of Object.keys(axes)) {
    const a = axes[key];
    a.val += (a.goal - a.val) * ease;
  }

  setSpecimen(axes.wght.val, axes.opsz.val, axes.SOFT.val, axes.WONK.val);
  updateHud();

  // waterfall ripple: weight follows horizontal distance to the pointer
  const n = glyphEls.length;
  for (let i = 0; i < n; i++) {
    const gx = (i + 0.5) / n;
    const d = Math.abs(gx - px);
    const w = 300 + Math.max(0, 1 - d * 3.4) ** 2 * 600;
    const o = 30 + Math.max(0, 1 - d * 3.4) * 80;
    glyphEls[i].style.fontVariationSettings =
      `"wght" ${w.toFixed(0)}, "opsz" ${o.toFixed(0)}, "SOFT" ${axes.SOFT.val.toFixed(0)}, "WONK" ${axes.WONK.val > 0.5 ? 1 : 0}`;
    glyphEls[i].style.color = d < 0.06 ? 'var(--acid)' : '';
  }

  requestAnimationFrame(frame);
}

if (reduceMotion) {
  // static, well-set specimen; axes still respond to deliberate input
  setSpecimen(560, 100, 0, 0);
  updateHud();
  let rafPending = false;
  const applyOnce = () => {
    rafPending = false;
    for (const key of Object.keys(axes)) axes[key].val = axes[key].goal;
    setSpecimen(axes.wght.val, axes.opsz.val, axes.SOFT.val, axes.WONK.val);
    updateHud();
  };
  window.addEventListener('pointermove', () => {
    if (!rafPending) { rafPending = true; requestAnimationFrame(applyOnce); }
  });
  for (const g of glyphEls) {
    g.style.fontVariationSettings = '"wght" 400, "opsz" 40, "SOFT" 0, "WONK" 0';
  }
} else {
  requestAnimationFrame(frame);
}
