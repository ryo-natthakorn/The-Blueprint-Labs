/* ============================================================
   LIGATURE — a specimen you conduct
   The hero is the conductor's podium: pointer X bends weight,
   Y bends optical size, sliders and chips reach every axis.
   The rest of the sheet re-sets itself in whatever instance
   you conduct. No canvas on screen: the medium is the type.
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const $ = (s) => document.querySelector(s);

/* ---------- the instance: shown values ease toward goals ---------- */

const AX = {
  wght: { min: 100, max: 900 },
  opsz: { min: 9, max: 144 },
  soft: { min: 0, max: 100 },
  wonk: { min: 0, max: 1 },
};
const now = { wght: 400, opsz: 72, soft: 0, wonk: 0 };
const goal = { ...now };
let italic = false;

const vfs = (s) => `"wght" ${s.wght.toFixed(0)}, "opsz" ${s.opsz.toFixed(1)}, "SOFT" ${s.soft.toFixed(0)}, "WONK" ${s.wonk > 0.5 ? 1 : 0}`;

/* ---------- elements ---------- */

const stage = $('#stage');
const specimen = $('#specimen');
const guidesEl = $('#guides');
const cross = $('#cross');
const crossH = cross.querySelector('.cross-h');
const crossV = cross.querySelector('.cross-v');
const markX = $('#mark-x');
const markY = $('#mark-y');
const hint = $('#hint');
const instName = $('#instance-name');
const instVals = $('#instance-vals');
const sliders = {
  wght: [$('#s-wght'), $('#o-wght')],
  opsz: [$('#s-opsz'), $('#o-opsz')],
  soft: [$('#s-soft'), $('#o-soft')],
};
const wonkBtn = $('#t-wonk');
const italBtn = $('#t-ital');
const shuffleBtn = $('#shuffle');
const modeBtn = $('#mode');
const useWord = $('#use-word');

/* ---------- names a type designer would give the instance ---------- */

function weightName(w) {
  const names = [[150, 'Thin'], [250, 'ExtraLight'], [350, 'Light'], [450, 'Regular'], [550, 'Medium'], [650, 'SemiBold'], [750, 'Bold'], [850, 'ExtraBold']];
  for (const [lim, n] of names) if (w < lim) return n;
  return 'Black';
}
function opszName(o) {
  if (o < 18) return 'Text';
  if (o < 36) return 'Deck';
  if (o < 72) return 'Display';
  return 'Poster';
}
function instanceName(s) {
  const parts = [weightName(s.wght), opszName(s.opsz)];
  if (s.soft >= 70) parts.push('SuperSoft');
  else if (s.soft >= 20) parts.push('Soft');
  if (s.wonk > 0.5) parts.push('Wonky');
  if (italic) parts.push('Italic');
  return parts.join(' · ');
}

/* ---------- metrics (em) measured once from the face ---------- */

const metrics = { asc: 0.95, cap: 0.7, xh: 0.48, desc: 0.25, fAsc: 0.98, fDesc: 0.26 };
function measureMetrics() {
  const c = document.createElement('canvas').getContext('2d');
  c.font = '400 200px Fraunces';
  const m = (t) => c.measureText(t);
  const H = m('H'), x = m('x'), d = m('d'), p = m('p');
  if (!H.actualBoundingBoxAscent) return;
  metrics.cap = H.actualBoundingBoxAscent / 200;
  metrics.xh = x.actualBoundingBoxAscent / 200;
  metrics.asc = d.actualBoundingBoxAscent / 200;
  metrics.desc = p.actualBoundingBoxDescent / 200;
  metrics.fAsc = (H.fontBoundingBoxAscent || 196) / 200;
  metrics.fDesc = (H.fontBoundingBoxDescent || 52) / 200;
}

/* baseline of a line-height:1 box, in px from the box top */
const baselineIn = (size) => (size - (metrics.fAsc + metrics.fDesc) * size) / 2 + metrics.fAsc * size;

function drawGuides(container, top, size, withLabels) {
  const base = top + baselineIn(size);
  const lines = [
    ['ascender', base - metrics.asc * size, ''],
    ['cap height', base - metrics.cap * size, 'is-under'],
    ['x-height', base - metrics.xh * size, 'is-x'],
    ['baseline', base, 'is-base'],
    ['descender', base + metrics.desc * size, ''],
  ];
  // labels sit above their line (cap height below); drop any that would collide
  const kept = [];
  container.innerHTML = lines.map(([name, y, cls]) => {
    const em = name === 'baseline' ? '0' : ((base - y) / size).toFixed(2).replace('-0.', '−0.').replace(/^0\./, '0.');
    const ly = cls === 'is-under' ? y + 6 : y - 16;
    const room = withLabels && kept.every((k) => Math.abs(k - ly) > 15);
    if (room) kept.push(ly);
    const label = room ? `<span class="guide-label">${name}<b>${em}</b></span>` : '';
    return `<div class="guide ${cls}" style="top:${y.toFixed(1)}px">${label}</div>`;
  }).join('');
}

/* ---------- specimen word: fit for its widest instance ---------- */

const WORDS = ['Marmalade', 'Quixotic', 'Aqueduct', 'Filigree', 'Rhapsody', 'Bergamot', 'Gossamer', 'Wrought', 'Hangdog', 'Typecast', 'Nocturne', 'Kumquat'];
let wordIx = 0;
let word = specimen.textContent.trim();
let fitSize = 160;
const meter = document.createElement('span');
meter.setAttribute('aria-hidden', 'true');
meter.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-family:Fraunces;font-size:100px;line-height:1';
document.body.appendChild(meter);

function fitSpecimen() {
  const r = stage.getBoundingClientRect();
  const narrow = r.width < 700;
  const usableW = r.width - (narrow ? 24 : 120);
  const usableH = r.height - (narrow ? 70 : 110);
  meter.textContent = word || 'Aa';
  meter.style.fontStyle = italic ? 'italic' : 'normal';
  let widest = 0;
  for (const w of [100, 900]) for (const o of [30, 144]) {
    meter.style.fontVariationSettings = `"wght" ${w}, "opsz" ${o}, "SOFT" 100, "WONK" 1`;
    widest = Math.max(widest, meter.getBoundingClientRect().width);
  }
  fitSize = Math.max(28, Math.min((usableW / widest) * 100, usableH * 0.82, 340));
  specimen.style.fontSize = `${fitSize.toFixed(1)}px`;
  placeGuides();
}

function placeGuides() {
  const sr = stage.getBoundingClientRect();
  const wr = specimen.getBoundingClientRect();
  drawGuides(guidesEl, wr.top - sr.top, fitSize, sr.width >= 760);
}

function setWord(w, animate) {
  const apply = () => {
    word = w;
    specimen.textContent = w;
    useWord.textContent = w.charAt(0).toUpperCase() + w.slice(1);
    fitSpecimen();
  };
  if (!animate || reduceMotion) { apply(); return; }
  specimen.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)' }], { duration: 220, easing: 'ease-in' })
    .finished.then(() => {
      apply();
      specimen.animate([{ opacity: 0, filter: 'blur(8px)', transform: 'translateY(0.04em)' }, { opacity: 1, filter: 'blur(0px)', transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)' });
    });
}

shuffleBtn.addEventListener('click', () => {
  wordIx = (wordIx + 1) % WORDS.length;
  setWord(WORDS[wordIx], true);
});

// typing your own word: one line, letters only up to 16 characters
specimen.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); specimen.blur(); }
});
specimen.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = (e.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' ').slice(0, 16);
  document.execCommand('insertText', false, text);
});
specimen.addEventListener('input', () => {
  let t = specimen.textContent.replace(/[\r\n]+/g, ' ');
  if (t.length > 16) {
    t = t.slice(0, 16);
    specimen.textContent = t;
    const sel = window.getSelection();
    sel.selectAllChildren(specimen);
    sel.collapseToEnd();
  }
  word = t.trim();
  useWord.textContent = word ? word.charAt(0).toUpperCase() + word.slice(1) : 'Marmalade';
  clearTimeout(fitSpecimen.t);
  fitSpecimen.t = setTimeout(fitSpecimen, 120);
  touch();
});
specimen.addEventListener('blur', () => {
  if (!specimen.textContent.trim()) setWord(WORDS[wordIx], false);
});

/* ---------- conducting ---------- */

let lastInput = -1e9;
let conducting = false;
const touch = () => { lastInput = performance.now(); hint.style.opacity = '0'; };

function stageGeom() {
  const r = stage.getBoundingClientRect();
  const narrow = r.width < 760;
  const left = narrow ? 0 : parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.6;
  const bottom = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.7;
  const ix = INSET_X, iy = INSET_Y;
  return { r, left: left + ix, top: iy, bottom, w: r.width - left - ix * 2, h: r.height - bottom - iy * 2 };
}

const INSET_X = 26, INSET_Y = 20;
stage.addEventListener('pointermove', (e) => {
  const g = stageGeom();
  const fx = Math.min(1, Math.max(0, (e.clientX - g.r.left - g.left) / g.w));
  const fy = Math.min(1, Math.max(0, (e.clientY - g.r.top - g.top) / g.h));
  if (e.pointerType === 'touch') {
    // sideways drags conduct weight; vertical drags stay page scroll
    goal.wght = AX.wght.min + fx * 800;
  } else {
    goal.wght = AX.wght.min + fx * 800;
    goal.opsz = AX.opsz.max - fy * 135;
  }
  crossH.style.transform = `translateY(${(e.clientY - g.r.top).toFixed(1)}px)`;
  crossV.style.transform = `translateX(${(e.clientX - g.r.left).toFixed(1)}px)`;
  cross.classList.add('on');
  conducting = true;
  touch();
});
stage.addEventListener('pointerleave', () => { cross.classList.remove('on'); conducting = false; });

for (const [key, [input]] of Object.entries(sliders)) {
  input.addEventListener('input', () => {
    goal[key] = +input.value;
    if (reduceMotion) now[key] = goal[key];
    touch();
  });
}
wonkBtn.addEventListener('click', () => {
  goal.wonk = goal.wonk > 0.5 ? 0 : 1;
  wonkBtn.setAttribute('aria-pressed', String(goal.wonk > 0.5));
  touch();
});
italBtn.addEventListener('click', () => {
  italic = !italic;
  italBtn.setAttribute('aria-pressed', String(italic));
  document.documentElement.style.setProperty('--fs', italic ? 'italic' : 'normal');
  specimen.style.fontStyle = italic ? 'italic' : 'normal';
  fitSpecimen();
  dirty = true;
  touch();
});

/* ---------- rulers ---------- */

function buildRulers() {
  const x = $('#ruler-x');
  let html = '';
  for (let w = 100; w <= 900; w += 50) {
    const f = ((w - 100) / 800) * 100;
    const major = w % 100 === 0;
    html += `<span class="tick${major ? ' major' : ''}" style="left:${f}%"></span>`;
    if (w % 200 === 100) html += `<span class="tick-label" style="left:${f}%">${w}</span>`;
  }
  x.innerHTML = html;
  const y = $('#ruler-y');
  html = '';
  for (let o = 9; o <= 144; o += 9) {
    const f = ((144 - o) / 135) * 100;
    const major = [9, 36, 72, 108, 144].includes(o) || o === 144;
    html += `<span class="tick${major ? ' major' : ''}" style="top:${f}%"></span>`;
  }
  for (const o of [9, 36, 72, 108, 144]) html += `<span class="tick-label" style="top:${((144 - o) / 135) * 100}%">${o}</span>`;
  y.innerHTML = html;
}

/* ---------- 02 — optical-size waterfall ---------- */

const FALL_SIZES = [120, 84, 60, 42, 30, 21, 15, 12, 9];
const FALL_TEXT = 'Handgloves — the quick bergamot jumps over 1,964 lazy figs';
const waterfall = $('#waterfall');
const fallLines = [];
let opszAuto = true;
function buildWaterfall() {
  waterfall.innerHTML = '';
  fallLines.length = 0;
  const k = Math.min(1, (window.innerWidth - 40) / 700);
  for (const s of FALL_SIZES) {
    const px = Math.round(9 + (s - 9) * k);
    const row = document.createElement('div');
    row.className = 'fall';
    row.innerHTML = `<span class="fall-size"><b>${px}</b> px<br>opsz <i class="o">${Math.min(144, px)}</i></span><span class="fall-text vf">${FALL_TEXT}</span>`;
    const text = row.querySelector('.fall-text');
    text.style.fontSize = `${px}px`;
    text.style.setProperty('--o', String(Math.min(144, px)));
    waterfall.appendChild(row);
    fallLines.push({ px, text, label: row.querySelector('.o') });
  }
}
function setOpszMode(auto) {
  opszAuto = auto;
  $('#opsz-auto').setAttribute('aria-pressed', String(auto));
  $('#opsz-off').setAttribute('aria-pressed', String(!auto));
  for (const l of fallLines) {
    const o = auto ? Math.min(144, l.px) : 144;
    l.text.style.setProperty('--o', String(o));
    l.label.textContent = String(o);
  }
}
$('#opsz-auto').addEventListener('click', () => setOpszMode(true));
$('#opsz-off').addEventListener('click', () => setOpszMode(false));

/* ---------- 03 — design space ---------- */

const SPACE_W = [100, 233, 367, 500, 633, 767, 900];
const SPACE_O = [144, 72, 36, 18, 9];
const spaceGrid = $('#space-grid');
let youEl, youTag;
function buildSpace() {
  const frag = document.createDocumentFragment();
  for (const o of SPACE_O) {
    for (const w of SPACE_W) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell';
      b.style.fontVariationSettings = `"wght" ${w}, "opsz" ${o}, "SOFT" var(--soft), "WONK" var(--wonk)`;
      b.setAttribute('aria-label', `Set weight ${w} and optical size ${o}`);
      b.innerHTML = `Ag<span class="cell-lab">${w} · ${o}</span>`;
      b.addEventListener('click', () => {
        goal.wght = w; goal.opsz = o;
        if (reduceMotion) { now.wght = w; now.opsz = o; }
        touch();
      });
      frag.appendChild(b);
    }
  }
  spaceGrid.appendChild(frag);
  const you = document.createElement('div');
  you.className = 'space-you';
  you.setAttribute('aria-hidden', 'true');
  you.innerHTML = '<span class="space-you-h"></span><span class="space-you-v"></span><span class="space-you-dot"></span><span class="space-you-tag"></span>';
  spaceGrid.appendChild(you);
  youEl = you;
  youTag = you.querySelector('.space-you-tag');
}
function placeYou() {
  const fx = 0.5 / 7 + ((now.wght - 100) / 800) * (6 / 7);
  const r = THREEish.clamp(Math.log2(144) - Math.log2(now.opsz), 0, 4);
  const fy = (r + 0.5) / 5;
  const X = `${(fx * 100).toFixed(2)}%`, Y = `${(fy * 100).toFixed(2)}%`;
  youEl.children[0].style.top = Y;
  youEl.children[1].style.left = X;
  youEl.children[2].style.left = X; youEl.children[2].style.top = Y;
  youEl.children[3].style.left = X; youEl.children[3].style.top = Y;
  youTag.textContent = `you · ${Math.round(now.wght)} / ${Math.round(now.opsz)}`;
  // keep the tag inside the grid
  youTag.style.transform = fx > 0.72 ? 'translateX(calc(-100% - 1.2rem))' : 'none';
}
const THREEish = { clamp: (v, a, b) => Math.min(b, Math.max(a, v)) };

/* ---------- 04 — glyphs ---------- */

const GLYPHS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...'abcdefghijklmnopqrstuvwxyz', ...'0123456789',
  ...'&?!@#%*()[]{}/«»“”‘’.,:;…–—·•†‡§¶©®€£$¢+−×÷=<>°ßæœøåçéñüÆŒØÅÇÉÑÜ',
];
const NAMES = {
  '&': 'ampersand', '?': 'question mark', '!': 'exclamation mark', '@': 'commercial at', '#': 'number sign', '%': 'percent sign',
  '*': 'asterisk', '(': 'left parenthesis', ')': 'right parenthesis', '[': 'left square bracket', ']': 'right square bracket',
  '{': 'left curly bracket', '}': 'right curly bracket', '/': 'solidus', '«': 'left guillemet', '»': 'right guillemet',
  '“': 'left double quotation mark', '”': 'right double quotation mark', '‘': 'left single quotation mark', '’': 'right single quotation mark',
  '.': 'full stop', ',': 'comma', ':': 'colon', ';': 'semicolon', '…': 'horizontal ellipsis', '–': 'en dash', '—': 'em dash',
  '·': 'middle dot', '•': 'bullet', '†': 'dagger', '‡': 'double dagger', '§': 'section sign', '¶': 'pilcrow sign',
  '©': 'copyright sign', '®': 'registered sign', '€': 'euro sign', '£': 'pound sign', '$': 'dollar sign', '¢': 'cent sign',
  '+': 'plus sign', '−': 'minus sign', '×': 'multiplication sign', '÷': 'division sign', '=': 'equals sign', '<': 'less-than sign',
  '>': 'greater-than sign', '°': 'degree sign', 'ß': 'latin small letter sharp s', 'æ': 'latin small letter ae', 'œ': 'latin small ligature oe',
  'ø': 'latin small letter o with stroke', 'å': 'latin small letter a with ring above', 'ç': 'latin small letter c with cedilla',
  'é': 'latin small letter e with acute', 'ñ': 'latin small letter n with tilde', 'ü': 'latin small letter u with diaeresis',
  'Æ': 'latin capital letter ae', 'Œ': 'latin capital ligature oe', 'Ø': 'latin capital letter o with stroke',
  'Å': 'latin capital letter a with ring above', 'Ç': 'latin capital letter c with cedilla', 'É': 'latin capital letter e with acute',
  'Ñ': 'latin capital letter n with tilde', 'Ü': 'latin capital letter u with diaeresis',
};
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
function glyphName(ch) {
  if (/[A-Z]/.test(ch)) return `latin capital letter ${ch}`;
  if (/[a-z]/.test(ch)) return `latin small letter ${ch}`;
  if (/[0-9]/.test(ch)) return `digit ${DIGITS[+ch]}`;
  return NAMES[ch] || 'glyph';
}
const inspGlyph = $('#insp-glyph');
const inspStage = $('#insp-stage');
const inspGuides = $('#insp-guides');
let inspected = 'R';
let onCell = null;
function inspect(ch, cell) {
  inspected = ch;
  inspGlyph.textContent = ch;
  $('#insp-code').textContent = `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
  $('#insp-name').textContent = glyphName(ch);
  if (onCell) onCell.classList.remove('on');
  onCell = cell || null;
  if (onCell) onCell.classList.add('on');
  measureInspector();
}
function measureInspector() {
  const size = parseFloat(getComputedStyle(inspGlyph).fontSize);
  const gr = inspGlyph.getBoundingClientRect();
  const sr = inspStage.getBoundingClientRect();
  if (!size || !gr.width) return;
  $('#insp-adv').textContent = `advance ${(gr.width / size).toFixed(2)} em`;
  drawGuides(inspGuides, gr.top - sr.top, size, false);
}
function buildGlyphs() {
  const grid = $('#glyph-grid');
  const frag = document.createDocumentFragment();
  for (const ch of GLYPHS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'g vf';
    b.setAttribute('role', 'listitem');
    b.setAttribute('aria-label', glyphName(ch));
    b.textContent = ch;
    const go = () => inspect(ch, b);
    b.addEventListener('pointerenter', go);
    b.addEventListener('focus', go);
    b.addEventListener('click', go);
    frag.appendChild(b);
  }
  grid.appendChild(frag);
}

/* ---------- sections follow the instance while visible ---------- */

const sections = [...document.querySelectorAll('.sheet')];
const visible = new Set();
const setAt = new Map();   // when each section first came into view
let dirty = true;
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      visible.add(e.target);
      if (!setAt.has(e.target)) setAt.set(e.target, performance.now());
      dirty = true;
    } else visible.delete(e.target);
  }
}, { rootMargin: '120px 0px' });
sections.forEach((s) => io.observe(s));

let heroVisible = true;
let shownKey = '';
new IntersectionObserver(([e]) => {
  heroVisible = e.isIntersecting;
  // the hero skips updates while offscreen; publish the latest instance on return
  if (heroVisible) shownKey = '';
}).observe($('.hero'));

const ease3 = (t) => 1 - Math.pow(1 - t, 3);
let lastPush = 0;
function pushSections(t) {
  // type in a section "sets" from hairline to your instance as it arrives
  for (const s of visible) {
    const since = reduceMotion ? 1e9 : t - setAt.get(s);
    const k = ease3(Math.min(1, since / 1100));
    const w = 100 + (now.wght - 100) * k;
    s.style.setProperty('--wght', w.toFixed(0));
    s.style.setProperty('--opsz', now.opsz.toFixed(1));
    s.style.setProperty('--soft', now.soft.toFixed(0));
    s.style.setProperty('--wonk', now.wonk > 0.5 ? '1' : '0');
    if (k < 1) dirty = true;
  }
  if (visible.has($('#space'))) placeYou();
  if (visible.has($('#glyphs'))) measureInspector();
}

/* ---------- the loop ---------- */

let prev = performance.now();
function frame(t) {
  const dt = Math.min((t - prev) / 1000, 0.1);
  prev = t;

  // idle: after a quiet spell the specimen breathes through its axes
  const idle = !reduceMotion && t - lastInput > 9000 && !conducting && document.activeElement !== specimen;
  if (idle && heroVisible) {
    const s = t / 1000;
    goal.wght = 500 + Math.sin(s * 0.55) * 330;
    goal.opsz = 76 + Math.cos(s * 0.37) * 58;
  }

  const k = reduceMotion ? 1 : 1 - Math.pow(idle ? 0.25 : 0.0006, dt);
  let moving = false;
  for (const key of Object.keys(now)) {
    const d = goal[key] - now[key];
    if (Math.abs(d) > 0.01) { now[key] += d * k; moving = true; }
    else now[key] = goal[key];
  }

  const key = `${now.wght.toFixed(0)}|${now.opsz.toFixed(1)}|${now.soft.toFixed(0)}|${now.wonk > 0.5}|${italic}`;
  if (key !== shownKey) {
    shownKey = key;
    dirty = true;
    if (heroVisible) {
      specimen.style.fontVariationSettings = vfs(now);
      markX.style.left = `calc(26px + ${((now.wght - 100) / 800).toFixed(4)} * (100% - 52px))`;
      markY.style.top = `calc(20px + ${((144 - now.opsz) / 135).toFixed(4)} * (100% - 40px))`;
      instName.textContent = instanceName(now);
      instVals.textContent = `wght ${Math.round(now.wght)} · opsz ${Math.round(now.opsz)} · SOFT ${Math.round(now.soft)} · WONK ${now.wonk > 0.5 ? 1 : 0}${italic ? ' · ital' : ''}`;
      for (const [k2, [input, out]] of Object.entries(sliders)) {
        if (document.activeElement !== input) input.value = String(Math.round(now[k2]));
        out.textContent = String(Math.round(now[k2]));
      }
    }
  }

  // sections: at most ~12 updates a second, and only those on screen
  if (dirty && t - lastPush > (moving ? 80 : 0)) {
    lastPush = t;
    dirty = false;
    pushSections(t);
  }

  requestAnimationFrame(frame);
}

/* ---------- screen / proof ---------- */

function setProof(on) {
  document.documentElement.classList.toggle('proof', on);
  modeBtn.setAttribute('aria-pressed', String(on));
  document.querySelector('meta[name="theme-color"]').setAttribute('content', on ? '#efe9dd' : '#111114');
  try { localStorage.setItem('ligature-proof', on ? '1' : '0'); } catch (e) { /* private mode */ }
}
modeBtn.addEventListener('click', () => setProof(!document.documentElement.classList.contains('proof')));
try { if (localStorage.getItem('ligature-proof') === '1') setProof(true); } catch (e) { /* ignore */ }

/* ---------- boot ---------- */

buildRulers();
buildWaterfall();
buildSpace();
buildGlyphs();

let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    const wide = window.innerWidth;
    if (Math.abs(wide - buildWaterfall.w) > 40) { buildWaterfall(); setOpszMode(opszAuto); buildWaterfall.w = wide; }
    fitSpecimen();
    measureInspector();
    dirty = true;
  }, 120);
});
buildWaterfall.w = window.innerWidth;

document.fonts.ready.then(() => {
  measureMetrics();
  fitSpecimen();
  inspect('R', null);
  if (!reduceMotion) lastInput = performance.now() - 7000; // breathe soon after arrival
  requestAnimationFrame(frame);
});
if (coarse) hint.style.opacity = '1';
