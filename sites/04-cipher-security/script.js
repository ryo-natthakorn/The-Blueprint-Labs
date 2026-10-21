import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarse = window.matchMedia('(pointer: coarse)').matches;
const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
const HIGH = !(isCoarse || lowPower || window.innerWidth < 768);

/* ------------------------------------------------------------------
   The terminal is drawn to a 2D canvas on a monospace grid, then shown
   through a WebGL "tube": curvature, scanlines, mask, glow and phosphor
   persistence. A real <input> takes the keystrokes, and every printed
   line is mirrored into a hidden role="log" for assistive tech.

   Nobody needs to know a command: a numbered menu, tappable commands in
   the output, ghost suggestions, plain-word aliases, "did you mean" and
   a guided tour all lead to the same handful of commands.
------------------------------------------------------------------ */

const THEMES = {
  green: {
    bg: '#020a05', panel: [1, 8, 4], text: '#b8e6c9', ok: '#33f584', sys: '#2fb873', warn: '#ffc857', err: '#ff5468',
    info: '#62e2f0', heading: '#86ffb8', echo: '#d6f5e2', rain: [41, 242, 125], head: '#e8fff2', dim: '#0f5a33',
    ghost: '#2c7a51', link: '#62e2f0', key: '#02140a', keyBg: '#62e2f0', tour: '#ffc857',
    redact: '#1c8f55', inverse: '#33f584', inverseText: '#02140a', port: '#1d7a49', open: '#ffffff',
  },
  amber: {
    bg: '#0b0601', panel: [8, 4, 0], text: '#ffd9a0', ok: '#ffb347', sys: '#cf9440', warn: '#fff0a8', err: '#ff7a52',
    info: '#ffe2a8', heading: '#ffcf7a', echo: '#ffe8c4', rain: [255, 168, 60], head: '#fff4dc', dim: '#5e3d12',
    ghost: '#8a5c22', link: '#ffe2a8', key: '#1a0d00', keyBg: '#ffd27a', tour: '#fff0a8',
    redact: '#9a6524', inverse: '#ffb347', inverseText: '#1a0d00', port: '#8a5a1c', open: '#ffffff',
  },
};
let theme = THEMES.green;

/* ------------------------------------------------------------------
   DOM
------------------------------------------------------------------ */
const screenEl = document.getElementById('screen');
const crtCanvas = document.getElementById('crt');
const form = document.getElementById('prompt-form');
const input = document.getElementById('cmd');
const srLog = document.getElementById('sr-log');
const backLink = document.querySelector('.baseline a');

const term = document.createElement('canvas');
const ctx = term.getContext('2d');
const rainCanvas = document.createElement('canvas');
const rctx = rainCanvas.getContext('2d');

/* ------------------------------------------------------------------
   Layout on a character grid
------------------------------------------------------------------ */
const M = { dpr: 1, W: 0, H: 0, fs: 14, cw: 8, lh: 20, cols: 80, rows: 24, padX: 0, top: 0, bottom: 0, narrow: false };
const FONT = (w = 500) => `${w} ${M.fs}px "IBM Plex Mono", ui-monospace, monospace`;
const CURVE = { x: 0.045, y: 0.06 };

function layout() {
  const r = screenEl.getBoundingClientRect();
  M.dpr = Math.min(window.devicePixelRatio || 1, 2);
  M.W = Math.max(2, Math.round(r.width * M.dpr));
  M.H = Math.max(2, Math.round(r.height * M.dpr));
  const cssFs = r.width < 480 ? 13 : r.width < 900 ? 14.5 : Math.min(22, Math.max(15.5, r.width / 88));
  M.fs = Math.round(cssFs * M.dpr);
  term.width = rainCanvas.width = M.W;
  term.height = rainCanvas.height = M.H;
  ctx.font = FONT();
  M.cw = ctx.measureText('M').width;
  M.lh = Math.round(M.fs * 1.58);
  // leave room for the tube's curvature at the edges
  M.padX = Math.max(M.W * (r.width < 480 ? 0.05 : 0.06), M.cw * 2);
  M.cols = Math.floor((M.W - M.padX * 2) / M.cw);
  if (M.cols > 110) { M.cols = 110; M.padX = (M.W - M.cols * M.cw) / 2; }
  M.top = Math.round(M.H * 0.05 + M.lh * 2);
  M.bottom = Math.round(M.H * 0.05 + M.lh * 1.8);
  M.rows = Math.max(4, Math.floor((M.H - M.top - M.bottom) / M.lh));
  M.narrow = M.cols < 66;
  CURVE.x = r.width < 600 ? 0.025 : 0.045;
  CURVE.y = r.width < 600 ? 0.035 : 0.06;
  lines.forEach((L) => { L.cacheCols = -1; });
  initRain();
  // the real input sits over the prompt row so taps and IMEs land in the right place
  form.style.top = `${(M.H - M.bottom + M.lh * 0.2) / M.dpr}px`;
  form.style.left = `${(M.padX - M.cw) / M.dpr}px`;
  form.style.width = `${((M.cols + 2) * M.cw) / M.dpr}px`;
  form.style.height = `${(M.lh * 1.4) / M.dpr}px`;
  dirty = true;
  resizeGL();
}

/* ------------------------------------------------------------------
   Lines, wrapping, printing
   A segment is [cls, text, cmd?]; a segment with a cmd is a tappable link.
------------------------------------------------------------------ */
const lines = [];
let scrollBack = 0;
let dirty = true;
let fastForward = false;      // a tap or key while a command runs finishes its animation

function segsOf(parts) {
  return parts.map((p) => (typeof p === 'string' ? ['text', p] : p));
}
function mirror(text) {
  if (!text || !text.trim()) return;
  const p = document.createElement('p');
  p.textContent = text;
  srLog.appendChild(p);
  while (srLog.childNodes.length > 80) srLog.removeChild(srLog.firstChild);
}
function push(L, srText) {
  L.len = L.segs ? L.segs.reduce((n, [, t]) => n + [...t].length, 0) : 0;
  L.cacheCols = -1;
  lines.push(L);
  while (lines.length > 600) lines.shift();
  scrollBack = 0;
  dirty = true;
  if (srText !== null) mirror(srText ?? (L.segs || []).map(([, t]) => t).join(''));
  return L;
}
const print = (parts, opts = {}) => push({ segs: segsOf(parts), indent: opts.indent || 0, nowrap: !!opts.nowrap, reveal: Infinity }, opts.sr);
const say = (cls, text, opts) => print([[cls, text]], opts);
const blank = () => push({ segs: [], reveal: Infinity }, null);

const sleep = (ms) => new Promise((r) => setTimeout(r, prefersReducedMotion || fastForward ? 0 : ms));

function type(parts, opts = {}) {
  const instant = prefersReducedMotion || fastForward;
  const L = push({ segs: segsOf(parts), indent: opts.indent || 0, reveal: instant ? Infinity : 0, speed: opts.speed || 190 }, opts.sr);
  if (instant) return Promise.resolve();
  return new Promise((res) => { L.onDone = res; });
}

// A live block redraws every frame until it resolves.
function live(rows, drawFn) {
  return push({ block: { rows, draw: drawFn }, reveal: Infinity }, null);
}

function wrapLine(L, cols) {
  if (L.block) {
    if (L.cacheCols === cols) return L.rows;
    L.rows = Array.from({ length: L.block.rows }, (_, i) => ({ block: L.block, part: i }));
    L.cacheCols = cols;
    return L.rows;
  }
  const revealing = L.reveal < L.len;
  if (L.cacheCols === cols && !revealing) return L.rows;
  const chars = [];
  for (const [cls, t, cmd] of L.segs) for (const ch of t) chars.push([cls, ch, cmd]);
  const rows = [];
  if (!chars.length) rows.push([]);
  else if (L.nowrap) rows.push(chars.slice(0, cols));
  else {
    let start = 0;
    while (start < chars.length) {
      const indent = rows.length ? L.indent : 0;
      const w = cols - indent;
      let end = start + w;
      if (end < chars.length) {
        let k = end;
        while (k > start && chars[k][1] !== ' ') k--;
        if (k > start + w * 0.35) end = k + 1;
      } else end = chars.length;
      let row = chars.slice(start, end);
      if (rows.length) while (row.length && row[0][1] === ' ') row = row.slice(1);
      rows.push(indent ? [...Array(indent).fill(['pad', ' ']), ...row] : row);
      start = end;
    }
  }
  // typed reveal (indent padding doesn't count)
  let budget = Math.floor(L.reveal);
  const out = rows.map((row) => {
    const r = [];
    for (const c of row) {
      if (c[0] === 'pad') { r.push(c); continue; }
      if (budget <= 0) break;
      r.push(c);
      budget--;
    }
    return r;
  });
  L.rows = out.map((row) => {
    const runs = [];
    for (const [cls, ch, cmd] of row) {
      const last = runs[runs.length - 1];
      if (last && last[0] === cls && last[2] === cmd) last[1] += ch;
      else runs.push([cls, ch, cmd]);
    }
    return runs;
  });
  if (!revealing) L.cacheCols = cols;
  return L.rows;
}

/* ------------------------------------------------------------------
   Rain (drawn on its own canvas at ~30 Hz, then blitted)
------------------------------------------------------------------ */
const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF{}<>/*+-=';
let rain = [];
let rainBoost = 0;        // `matrix` takes over the screen
let rainBoostTarget = 0;
function initRain() {
  const cols = Math.ceil(M.W / M.cw);
  const rows = Math.ceil(M.H / M.lh) + 1;
  rain = Array.from({ length: cols }, () => ({
    y: Math.random() * rows * 2 - rows,
    speed: 5 + Math.random() * 14,
    len: 6 + Math.floor(Math.random() * 16),
    glyphs: Array.from({ length: rows }, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]),
    active: Math.random() < 0.55,
  }));
  rain.rows = rows;
  drawRain(0, true);
}
let lastRain = 0;
function drawRain(now, force = false) {
  if (!force && now - lastRain < 33) return;
  const dt = Math.max(0, Math.min(0.1, (now - lastRain) / 1000));
  lastRain = now;
  rctx.clearRect(0, 0, M.W, M.H);
  rctx.font = FONT(400);
  rctx.textBaseline = 'top';
  const [r, g, b] = theme.rain;
  const boost = 1 + rainBoost * 1.6;
  rain.forEach((col, i) => {
    if (!prefersReducedMotion) {
      col.y += col.speed * dt * boost;
      if (col.y - col.len > rain.rows) {
        col.y = -Math.random() * rain.rows * 0.6;
        col.speed = 5 + Math.random() * 14;
        col.active = Math.random() < 0.55 + rainBoost * 0.4;
      }
      if (Math.random() < 0.06) col.glyphs[(Math.random() * col.glyphs.length) | 0] = GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    if (!col.active && rainBoost < 0.3) return;
    const head = Math.floor(col.y);
    for (let k = 0; k < col.len; k++) {
      const row = head - k;
      if (row < 0 || row >= rain.rows) continue;
      const a = Math.pow(1 - k / col.len, 1.6) * (0.5 + rainBoost * 0.5);
      rctx.fillStyle = k === 0 ? theme.head : `rgba(${r},${g},${b},${a.toFixed(3)})`;
      rctx.fillText(col.glyphs[row % col.glyphs.length], i * M.cw, row * M.lh);
    }
  });
}

/* ------------------------------------------------------------------
   Drawing the terminal
------------------------------------------------------------------ */
let caretOn = true;
let busy = false;
let busyLabel = '';
let spinner = 0;
let hits = [];               // tappable command links, in canvas pixels
let hover = null;
const color = (cls) => theme[cls] || theme.text;

function fillRun(cls, text, x, y, cmd) {
  const n = [...text].length;
  if (cls === 'redact') {
    ctx.fillStyle = theme.redact;
    ctx.fillRect(x, y + M.lh * 0.18, n * M.cw, M.lh * 0.64);
    return n;
  }
  if (cls === 'barfill' || cls === 'barempty') {
    ctx.fillStyle = cls === 'barfill' ? theme.ok : theme.dim;
    ctx.fillRect(x, y + M.lh * 0.3, n * M.cw - M.cw * 0.15, M.lh * 0.4);
    return n;
  }
  if (cls === 'key') {
    // a key cap: [1]
    ctx.fillStyle = theme.keyBg;
    ctx.fillRect(x + M.cw * 0.05, y + M.lh * 0.12, n * M.cw - M.cw * 0.1, M.lh * 0.76);
    ctx.fillStyle = theme.key;
    ctx.font = FONT(600);
    ctx.fillText(text, x, y + (M.lh - M.fs) / 2);
    if (cmd) hits.push({ x, y, w: n * M.cw, h: M.lh, cmd });
    return n;
  }
  const isHover = cmd && hover && hover.cmd === cmd && hover.y === y;
  if (cmd) {
    if (isHover) {
      ctx.fillStyle = theme.dim;
      ctx.fillRect(x - M.cw * 0.2, y + M.lh * 0.06, n * M.cw + M.cw * 0.4, M.lh * 0.88);
    }
    hits.push({ x, y, w: n * M.cw, h: M.lh, cmd });
  }
  ctx.fillStyle = color(cls);
  ctx.font = FONT(cls === 'heading' || cls === 'tour' ? 600 : 500);
  const ty = y + (M.lh - M.fs) / 2;
  if (/^[\x20-\x7e]*$/.test(text)) ctx.fillText(text, x, ty);
  else {
    // anything outside ASCII goes one cell at a time, so fallback glyphs never shift the grid
    let i = 0;
    for (const ch of text) { ctx.fillText(ch, x + i * M.cw, ty); i++; }
  }
  if (cmd && cls === 'link') {
    ctx.fillStyle = color(cls);
    ctx.globalAlpha = isHover ? 1 : 0.55;
    ctx.fillRect(x, y + M.lh * 0.84, n * M.cw, Math.max(1, M.dpr));
    ctx.globalAlpha = 1;
  }
  return n;
}

function drawStatus() {
  const y = Math.round(M.H * 0.05);
  const x0 = M.padX - M.cw;
  const w = (M.cols + 2) * M.cw;
  ctx.fillStyle = theme.inverse;
  ctx.fillRect(x0, y, w, M.lh);
  ctx.fillStyle = theme.inverseText;
  ctx.font = FONT(600);
  const ty = y + (M.lh - M.fs) / 2;
  const d = new Date();
  const clock = [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, '0')).join(':');
  const left = M.narrow ? ' CIPHER // RED TEAM' : ' CIPHER // RED-TEAM SECURITY   field station terminal';
  const right = M.narrow ? `${clock} ` : `ONLINE   ${clock} `;
  ctx.fillText(left, x0, ty);
  ctx.fillText(right, x0 + w - right.length * M.cw, ty);
}

/* ghost suggestion for what's being typed */
function suggestion(v) {
  const q = v.trimStart().toLowerCase();
  if (!q || q.includes(' ')) return null;
  const hit = PRIMARY.find((c) => c.name.startsWith(q) && c.name !== q) || EXTRA.find((c) => c.name.startsWith(q) && c.name !== q);
  return hit || null;
}

function drawPrompt() {
  const y = M.H - M.bottom + M.lh * 0.45;
  let x = M.padX;
  // a thin rule above the prompt separates "what you type" from the output
  ctx.fillStyle = theme.dim;
  ctx.fillRect(M.padX - M.cw, y - M.lh * 0.32, (M.cols + 2) * M.cw, Math.max(1, M.dpr));
  if (busy) {
    const frames = '|/-\\';
    const msg = `${prefersReducedMotion ? '>' : frames[spinner % 4]} ${busyLabel || 'running'}…  ${M.narrow ? 'tap to skip' : 'tap or press any key to skip'}`;
    fillRun('sys', msg.slice(0, M.cols), x, y);
    return;
  }
  const ps1 = M.narrow ? '$ ' : 'visitor@cipher:~$ ';
  x += fillRun('ok', ps1, x, y) * M.cw;
  const room = M.cols - ps1.length - 1;
  const v = input.value;
  const caret = input.selectionStart ?? v.length;
  const shift = Math.max(0, caret - room);
  const shown = v.slice(shift, shift + room);
  fillRun('echo', shown, x, y);
  const focused = document.activeElement === input;
  if (!v) {
    const hint = M.narrow ? 'type or tap a command' : (focused ? 'type a number, a command, or a question' : `${isCoarse ? 'tap' : 'click'} here to type — or pick from the menu`);
    fillRun('ghost', ` ${hint}`.slice(0, room), x + M.cw, y);
  } else {
    const s = suggestion(v);
    if (s && caret === v.length) {
      const rest = s.name.slice(v.trimStart().length);
      const tail = M.narrow ? '' : `   ${s.label}  ·  tab ↹`;
      fillRun('ghost', `${rest}${tail}`.slice(0, Math.max(0, room - shown.length)), x + shown.length * M.cw, y);
    }
  }
  if (caretOn || prefersReducedMotion) {
    ctx.fillStyle = theme.ok;
    ctx.globalAlpha = focused ? 0.9 : 0.35;
    ctx.fillRect(x + (caret - shift) * M.cw, y + M.lh * 0.12, M.cw * 0.92, M.lh * 0.76);
    ctx.globalAlpha = 1;
  }
}

function draw(now) {
  hits = [];
  ctx.textBaseline = 'top';
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, M.W, M.H);
  drawRain(now);
  ctx.globalAlpha = 0.9;
  ctx.drawImage(rainCanvas, 0, 0);
  ctx.globalAlpha = 1;
  // the text panel dims the rain behind it (less so while `matrix` runs)
  const [pr, pg, pb] = theme.panel;
  ctx.fillStyle = `rgba(${pr},${pg},${pb},${(0.9 - rainBoost * 0.64).toFixed(3)})`;
  ctx.fillRect(M.padX - M.cw * 1.2, M.top - M.lh * 0.5, (M.cols + 2.4) * M.cw, M.rows * M.lh + M.lh * 1.0);

  drawStatus();

  const all = [];
  for (const L of lines) for (const r of wrapLine(L, M.cols)) all.push(r);
  const maxScroll = Math.max(0, all.length - M.rows);
  scrollBack = Math.max(0, Math.min(scrollBack, maxScroll));
  const start = Math.max(0, all.length - M.rows - scrollBack);
  const drawnBlocks = new Set();
  for (let i = 0; i < M.rows; i++) {
    const row = all[start + i];
    if (!row) continue;
    const y = M.top + i * M.lh;
    if (row.block) {
      if (drawnBlocks.has(row.block)) continue;
      drawnBlocks.add(row.block);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, M.top - M.lh * 0.5, M.W, M.rows * M.lh + M.lh * 0.5);
      ctx.clip();
      row.block.draw(M.padX, y - row.part * M.lh, now);
      ctx.restore();
      continue;
    }
    let x = M.padX;
    for (const [cls, t, cmd] of row) x += fillRun(cls, t, x, y, cmd) * M.cw;
  }
  if (scrollBack > 0) {
    const y = M.top + (M.rows - 1) * M.lh;
    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    ctx.fillRect(M.padX - M.cw, y, (M.cols + 2) * M.cw, M.lh);
    fillRun('link', `▼ ${scrollBack} more line${scrollBack === 1 ? '' : 's'} — back to the latest`, M.padX, y, '__bottom');
  }
  drawPrompt();
}

/* ------------------------------------------------------------------
   Live widgets: progress bars and the port sweep
------------------------------------------------------------------ */
const progress = (now, t0, ms) => (prefersReducedMotion || fastForward ? 1 : Math.max(0, Math.min(1, (now - t0) / ms)));

function bar(label, ms, cls = 'ok') {
  if (prefersReducedMotion) {
    const W = Math.max(8, Math.min(26, M.cols - 20));
    print([['info', label.padEnd(M.narrow ? 14 : 18)], ['barfill', '█'.repeat(W)], [cls, ' done']], { nowrap: true, sr: `${label}: done` });
    return Promise.resolve();
  }
  return new Promise((res) => {
    const t0 = performance.now();
    const L = live(1, (x, y, now) => {
      const W = Math.max(8, Math.min(26, M.cols - 21));
      const f = progress(now, t0, ms);
      const n = Math.round(W * f);
      let cx = x;
      cx += fillRun('info', label.padEnd(M.narrow ? 14 : 18), cx, y) * M.cw;
      cx += fillRun('barfill', '█'.repeat(n), cx, y) * M.cw;
      cx += fillRun('barempty', '░'.repeat(W - n), cx, y) * M.cw;
      fillRun(f >= 1 ? cls : 'sys', f >= 1 ? ' done' : ` ${String(Math.round(f * 100)).padStart(3)}%`, cx, y);
      if (f >= 1 && !L.done) { L.done = true; mirror(`${label}: done`); res(); }
    });
  });
}

const OPEN_PORTS = [22, 80, 443, 5432, 8080];
const RISKY = new Set([5432, 8080]);
function portSweep(ms) {
  const CELLS = 1024;               // ports 1–8192, eight per cell
  const gridCols = M.narrow ? 32 : 64;
  const gridRows = CELLS / gridCols;
  const blockRows = M.narrow ? 7 : 5;
  const openCells = new Map(OPEN_PORTS.map((p) => [Math.floor((p - 1) / 8), p]));
  return new Promise((res) => {
    const t0 = performance.now();
    const L = live(blockRows + 2, (x, y, now) => {
      const f = progress(now, t0, ms);
      const scanned = Math.floor(f * CELLS);
      const found = [...openCells].filter(([c]) => c < scanned).map(([, p]) => p);
      const doors = Math.round(f * 8192).toLocaleString('en-US');
      fillRun('info', M.narrow ? `doors checked ${doors.padStart(5)}` : `knocking on doors (ports)  ${doors.padStart(5)} / 8,192`, x, y);
      fillRun(found.length ? 'warn' : 'sys', `${M.narrow ? '' : '   '}open: ${found.length}`, x + (M.narrow ? 21 : 41) * M.cw, y);
      const gw = M.cols * M.cw;
      const gh = blockRows * M.lh - M.lh * 0.3;
      const cw = gw / gridCols, ch = gh / gridRows;
      const top = y + M.lh * 1.1;
      for (let i = 0; i < CELLS; i++) {
        const cx = x + (i % gridCols) * cw, cy = top + Math.floor(i / gridCols) * ch;
        const open = openCells.has(i);
        if (i < scanned) {
          const age = (scanned - i) / CELLS;
          if (open) {
            const risky = RISKY.has(openCells.get(i));
            const pulse = prefersReducedMotion ? 1 : 0.75 + 0.25 * Math.sin(now / 180 + i);
            ctx.fillStyle = risky ? theme.err : theme.open;
            ctx.globalAlpha = pulse;
            ctx.fillRect(cx - cw * 0.2, cy - ch * 0.2, cw * 1.2, ch * 1.2);
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = age < 0.03 ? theme.ok : theme.port;
            ctx.fillRect(cx + cw * 0.12, cy + ch * 0.12, cw * 0.62, ch * 0.62);
          }
        } else {
          ctx.fillStyle = theme.dim;
          ctx.fillRect(cx + cw * 0.38, cy + ch * 0.38, cw * 0.18, ch * 0.18);
        }
      }
      if (f < 1) {
        const i = scanned;
        ctx.fillStyle = theme.head;
        ctx.fillRect(x + (i % gridCols) * cw, top + Math.floor(i / gridCols) * ch, cw * 0.8, ch * 0.8);
      }
      // legend, so the picture explains itself
      const ly = top + gh + M.lh * 0.2;
      let lx = x;
      const swatch = (c, label) => {
        ctx.fillStyle = c;
        ctx.fillRect(lx, ly + M.lh * 0.32, M.cw * 0.7, M.lh * 0.36);
        lx += M.cw * 1.3;
        lx += fillRun('sys', label, lx, ly) * M.cw + M.cw * 2;
      };
      swatch(theme.port, 'closed');
      swatch(theme.open, 'open, fine');
      swatch(theme.err, 'open, risky');
      if (f >= 1 && !L.done) { L.done = true; mirror(`Checked 8,192 ports. ${OPEN_PORTS.length} open: ${OPEN_PORTS.join(', ')}. Two are risky.`); res(); }
    });
  });
}

/* ------------------------------------------------------------------
   Commands
------------------------------------------------------------------ */
const BANNER = [
  '  ██████╗██╗██████╗ ██╗  ██╗███████╗██████╗ ',
  ' ██╔════╝██║██╔══██╗██║  ██║██╔════╝██╔══██╗',
  ' ██║     ██║██████╔╝███████║█████╗  ██████╔╝',
  ' ██║     ██║██╔═══╝ ██╔══██║██╔══╝  ██╔══██╗',
  ' ╚██████╗██║██║     ██║  ██║███████╗██║  ██║',
  '  ╚═════╝╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝',
];
// the menu: what most visitors want, numbered
const PRIMARY = [
  { key: '1', name: 'services', label: 'what we do', short: 'what we do' },
  { key: '2', name: 'scan', label: 'watch a live demo scan', short: 'live scan' },
  { key: '3', name: 'casework', label: 'real results, names redacted', short: 'case files' },
  { key: '4', name: 'team', label: 'meet the operators', short: 'the team' },
  { key: '5', name: 'why', label: 'why hiring attackers works', short: 'why it works' },
  { key: '6', name: 'tour', label: 'the 60-second guided tour', short: 'tour' },
];
const EXTRA = [
  { name: 'help', label: 'show this menu' },
  { name: 'menu', label: 'show this menu' },
  { name: 'theme', label: 'switch green / amber screen' },
  { name: 'matrix', label: 'let the rain take over' },
  { name: 'clear', label: 'wipe the screen' },
  { name: 'history', label: 'what you typed' },
  { name: 'whoami', label: 'who are you' },
  { name: 'uptime', label: 'station status' },
  { name: 'date', label: 'the time' },
  { name: 'exit', label: 'leave' },
];
const history = [];
let historyIdx = 0;
const link = (text, cmd) => ['link', text, cmd];

function menu() {
  say('heading', M.narrow ? 'WHAT DO YOU WANT TO SEE?' : 'WHAT DO YOU WANT TO SEE?  tap one, or type its number');
  for (const c of PRIMARY) {
    if (M.narrow) print([['pad', ' '], ['key', ` ${c.key} `, c.name], ['pad', ' '], link(c.label, c.name)], { sr: `${c.key}: ${c.label} (${c.name})` });
    else print([['pad', '  '], ['key', ` ${c.key} `, c.name], ['pad', '  '], link(c.label.padEnd(30), c.name), ['ghost', c.name]], { sr: `${c.key}: ${c.label} (command: ${c.name})` });
  }
  blank();
  print([['sys', 'extras: '], link('theme', 'theme'), ['sys', ' · '], link('matrix', 'matrix'), ['sys', ' · '], link('clear', 'clear'), ['sys', M.narrow ? '' : '   ·   type anything — plain questions work too']]);
  blank();
}

function next(except) {
  const picks = PRIMARY.filter((c) => c.name !== except && c.name !== 'tour').slice(0, M.narrow ? 2 : 3);
  const parts = [['sys', 'next → ']];
  picks.forEach((c, i) => {
    parts.push(['key', ` ${c.key} `, c.name], ['pad', ' '], link(c.short, c.name));
    parts.push(['sys', i < picks.length - 1 ? '   ' : '']);
  });
  parts.push(['sys', '   '], link('menu', 'help'));
  print(parts, { nowrap: true, sr: `Next: ${picks.map((c) => `${c.key} ${c.label}`).join(', ')}, or menu.` });
  blank();
}

function table(rows) {
  rows.forEach(([port, service, note, level]) => {
    const cls = level === 'risk' ? 'err' : level === 'warn' ? 'warn' : 'ok';
    const mark = level === 'risk' ? '✗' : level === 'warn' ? '!' : '✓';
    if (M.narrow) {
      print([[cls, `  ${mark} ${port.padEnd(9)}`], ['sys', service]], { nowrap: true });
      print([[cls, `      ${note}`]], { indent: 6 });
    } else {
      print([[cls, `  ${mark} ${port.padEnd(10)}`], ['sys', service.padEnd(14)], [cls, note]], { indent: 28 });
    }
  });
}

const COMMANDS = {
  async help() {
    menu();
  },

  async services(args, quiet) {
    say('heading', 'WHAT WE DO');
    say('sys', 'Companies hire us to attack them — carefully, with permission — so they find the holes before criminals do.', { indent: 0 });
    blank();
    const s = [
      ['Penetration testing', 'we try to break into your websites and networks, like a real attacker would.'],
      ['Red team', 'a months-long, quiet campaign to reach one goal — say, the payroll system.'],
      ['Social engineering', 'we test the people: phishing emails, phone calls, walking in behind someone.'],
      ['Cloud review', 'leaked keys, open storage, accounts with far too much power.'],
      ['Incident rehearsal', 'a fire drill for the day something does go wrong.'],
    ];
    for (const [name, what] of s) {
      await type([['ok', `▸ ${name}`], ['sys', ` — ${what}`]], { indent: 2 });
    }
    blank();
    say('sys', 'Every engagement is authorised and scoped in writing, and reported in person.');
    blank();
    if (!quiet) next('services');
  },

  async scan(args, quiet) {
    const host = (args[0] || 'demo.target').replace(/[^a-z0-9.-]/gi, '').slice(0, 40) || 'demo.target';
    say('heading', `LIVE DEMO SCAN → ${host}`);
    say('sys', 'A pretend server. We knock on all its doors (network ports) and note which ones answer. Nothing real is touched.');
    blank();
    await sleep(250);
    await bar(M.narrow ? 'find server' : 'find the server', 450);
    await portSweep(2600);
    await bar(M.narrow ? 'who answers' : 'ask who answers', 700);
    await bar(M.narrow ? 'encryption' : 'check encryption', 600);
    blank();
    say('heading', M.narrow ? 'WHAT WE FOUND' : 'WHAT WE FOUND        port      service       verdict');
    table([
      ['22', 'ssh', 'remote login, keys only — fine', 'ok'],
      ['80', 'http', 'sends everyone to the secure site — fine', 'ok'],
      ['443', 'https', 'modern encryption — fine', 'ok'],
      ['8080', 'admin panel', 'a control panel anyone can find — fix this', 'warn'],
      ['5432', 'database', 'the database faces the open internet — fix this today', 'risk'],
    ]);
    blank();
    await type([['warn', 'In plain words: three doors are fine, two should never have been open.']]);
    say('sys', 'That took ninety seconds. A real engagement goes much deeper.');
    blank();
    if (!quiet) next('scan');
  },

  async casework(args, quiet) {
    say('heading', 'CASE FILES — CLIENT NAMES REDACTED BY CONTRACT');
    const cases = [
      ['2025', 'Regional bank', 'Took full control of the network in 6 hours, starting from a ', 'printer', '. The printer has been spoken to.'],
      ['2025', 'Logistics app', 'Found a ', 'secret key', ' left inside their public phone app. Changed before breakfast.'],
      ['2024', 'Hospital group', 'Copied a staff badge and walked into the ', 'server room', '. Doors and badges rebuilt.'],
      ['2024', 'Software company', 'Closed a hole in their ', 'build system', ' 11 days before a real attacker tried it.'],
    ];
    for (const [year, client, a, secret, b] of cases) {
      await type([['info', `▸ ${year} · ${client}`]]);
      print([['sys', `  ${a}`], ['redact', secret], ['sys', b]], { indent: 2, sr: `  ${a}[redacted]${b}` });
    }
    blank();
    say('sys', 'The green bars hide details we promised to keep secret.');
    blank();
    if (!quiet) next('casework');
  },

  async team(args, quiet) {
    say('heading', 'THE OPERATORS');
    const team = [
      ['"Vireo"', 'Lead operator. Former national incident-response team. Thinks in attack maps.'],
      ['"Marrow"', 'Hardware and physical access. Owns more lockpicks than keys.'],
      ['"Sable"', 'Social engineering. You have almost certainly held a door open for them.'],
      ['"Tern"', 'Cloud and build systems. Reads permission settings for fun. Genuinely.'],
    ];
    for (const [name, bio] of team) {
      await type([['ok', `▸ ${name}`]]);
      print([['sys', `  ${bio}`]], { indent: 2 });
    }
    blank();
    say('sys', 'Handles only. Their real names are the first thing we protect.');
    blank();
    if (!quiet) next('team');
  },

  async why(args, quiet) {
    say('heading', 'WHY HIRE ATTACKERS?');
    await type([['ok', 'Every lock you buy was designed against yesterday’s burglar.']]);
    await type([['ok', 'The only way to know how today’s attack goes is to run it —']]);
    await type([['ok', 'on your terms, in your scope, with your lawyers smiling.']]);
    blank();
    await type([['info', 'We break things gently, write everything down, and leave you stronger.']]);
    blank();
    if (!quiet) next('why');
  },

  async tour() {
    const steps = [
      ['STEP 1 OF 3', 'who CIPHER is', 'services'],
      ['STEP 2 OF 3', 'a live demo: we scan a pretend server', 'scan'],
      ['STEP 3 OF 3', 'what that finds in the real world', 'casework'],
    ];
    say('tour', '▶ GUIDED TOUR — sit back. Tap or press any key to speed it up.');
    blank();
    for (const [n, what, cmd] of steps) {
      await sleep(500);
      print([['tour', `${n} · `], ['tour', what]], { sr: `${n}: ${what}` });
      await sleep(400);
      await COMMANDS[cmd]([], true);
      fastForward = false;
    }
    say('tour', '■ That’s the tour. Everything else is one tap away:');
    blank();
    menu();
  },

  async uptime() {
    const days = 1337 + Math.floor((Date.now() / 86400000) % 100);
    say('ok', `field station up ${days} days · 0 breaches · 4 operators awake · coffee: ADEQUATE`);
    blank();
  },

  async whoami() {
    await type([['ok', 'visitor — no special access, unverified, but very welcome.']]);
    blank();
  },

  async date() {
    say('ok', new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    say('sys', 'clock set by four independent sources. We trust none of them fully.');
    blank();
  },

  async history() {
    if (!history.length) say('sys', 'nothing yet — the most secure history there is.');
    history.slice(-12).forEach((h, i) => say('sys', `  ${String(history.length - Math.min(12, history.length) + i + 1).padStart(3)}  ${h}`));
    blank();
  },

  async sudo() {
    await type([['err', 'visitor is not in the sudoers file. This incident will be reported.']]);
    say('sys', '(It will not. But it felt right to say.)');
    blank();
  },

  async matrix() {
    say('info', 'rain: unrestricted for six seconds');
    blank();
    rainBoostTarget = 1;
    setTimeout(() => { rainBoostTarget = 0; dirty = true; }, prefersReducedMotion ? 3000 : 6000);
  },

  async theme(args) {
    const next = args[0] === 'amber' || args[0] === 'green' ? args[0] : (theme === THEMES.green ? 'amber' : 'green');
    theme = THEMES[next];
    document.documentElement.dataset.phosphor = next;
    setTint();
    say('ok', next === 'amber' ? 'screen → amber. Easier on the eyes after midnight.' : 'screen → green. Classic.');
    blank();
  },

  async exit() {
    say('sys', 'logout');
    say('sys', 'Connection closed.');
    await sleep(500);
    say('ok', '…kidding. The way out is the link at the bottom right. We’ll keep the lights on.');
    blank();
    backLink.classList.add('is-hinted');
    setTimeout(() => backLink.classList.remove('is-hinted'), 3200);
  },

  async clear() {
    lines.length = 0;
    srLog.textContent = '';
    dirty = true;
  },

  async hire() {
    say('ok', 'CIPHER is a fictional firm — this terminal is a design study.');
    print([['sys', 'The studio that built it is real: see '], ['info', 'The Blueprint Labs'], ['sys', ' (link at the bottom).']]);
    blank();
    next('');
  },
};
COMMANDS.menu = COMMANDS.help;
COMMANDS.ls = COMMANDS.help;
COMMANDS.man = COMMANDS.help;
COMMANDS.logout = COMMANDS.exit;
COMMANDS.quit = COMMANDS.exit;

// plain questions land on the right command
const ALIASES = [
  [/\b(help|menu|commands?|options?|lost|start|home|\?)\b|^\?$/, 'help'],
  [/\b(tour|guide|show me|walk ?through|intro)\b/, 'tour'],
  [/\b(scan|demo|hack|attack|nmap|ports?|test)\b/, 'scan'],
  [/\b(case|cases|casework|work|clients?|projects?|portfolio|examples?|results?|stories)\b/, 'casework'],
  [/\b(team|who|people|operators?|staff|hackers?|crew)\b/, 'team'],
  [/\b(why|how|reason|point)\b/, 'why'],
  [/\b(what|services?|offer|do you do|about|sell)\b/, 'services'],
  [/\b(contact|hire|email|call|price|pricing|cost|quote|book)\b/, 'hire'],
  [/\b(colou?r|amber|green|theme|dark|light)\b/, 'theme'],
  [/\b(matrix|rain)\b/, 'matrix'],
];
const KNOWN = [...PRIMARY.map((c) => c.name), ...EXTRA.map((c) => c.name), 'sudo', 'hire'];

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

function resolve(raw) {
  const t = raw.trim().toLowerCase();
  const [first, ...args] = t.split(/\s+/);
  const byKey = PRIMARY.find((c) => c.key === t);
  if (byKey) return { cmd: byKey.name, args: [] };
  if (COMMANDS[first]) return { cmd: first, args };
  for (const [re, cmd] of ALIASES) if (re.test(t)) return { cmd, args: cmd === 'scan' ? [] : args, understood: true };
  let best = null, bestD = 9;
  for (const k of KNOWN) { const d = lev(first, k); if (d < bestD) { bestD = d; best = k; } }
  if (best && bestD <= Math.max(1, Math.floor(best.length / 3))) return { suggest: best };
  return { unknown: first };
}

let queued = null;
async function run(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return;
  if (busy) {
    // another command while one runs: finish the current animation quickly, then run it
    fastForward = true;
    queued = trimmed;
    return;
  }
  push({ segs: [['ok', M.narrow ? '$ ' : 'visitor@cipher:~$ '], ['echo', trimmed]], reveal: Infinity });
  history.push(trimmed);
  historyIdx = history.length;
  const r = resolve(trimmed);
  busy = true;
  try {
    if (r.cmd) {
      busyLabel = r.cmd === 'tour' ? 'touring' : `running ${r.cmd}`;
      if (r.understood) say('ghost', `→ ${r.cmd}`);
      await COMMANDS[r.cmd](r.args || []);
    } else if (r.suggest) {
      print([['warn', `“${trimmed}” isn’t a command. Did you mean `], link(r.suggest, r.suggest), ['warn', '? Press Enter to run it.']]);
      blank();
      input.value = r.suggest;
    } else {
      print([['err', `I don’t know “${r.unknown}”. `], ['sys', 'Try a number from the '], link('menu', 'help'), ['sys', ', or just ask, e.g. “who are you”.']]);
      blank();
    }
  } finally {
    busy = false;
    busyLabel = '';
    fastForward = false;
    dirty = true;
  }
  if (queued) { const q = queued; queued = null; run(q); }
}

/* ------------------------------------------------------------------
   Input
------------------------------------------------------------------ */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = input.value;
  input.value = '';
  if (busy && !v.trim()) { fastForward = true; return; }
  run(v);
  dirty = true;
});
['input', 'keyup', 'select', 'focus', 'blur'].forEach((ev) => input.addEventListener(ev, () => { dirty = true; caretOn = true; }));
input.addEventListener('keydown', (e) => {
  if (busy && !e.metaKey && !e.ctrlKey && e.key !== 'Tab') fastForward = true;      // any key skips ahead
  const atEnd = (input.selectionStart ?? 0) >= input.value.length;
  if (!input.value && /^[1-6]$/.test(e.key) && !busy) {
    // the menu numbers work without pressing Enter
    e.preventDefault();
    run(e.key);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIdx > 0) input.value = history[--historyIdx] || '';
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIdx < history.length) input.value = history[++historyIdx] || '';
  } else if ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'ArrowRight' && atEnd)) {
    // only take Tab when there is something to complete, so keyboard users can still Tab out
    const s = suggestion(input.value);
    if (s) { e.preventDefault(); input.value = `${s.name} `; }
  } else if (e.key === 'PageUp') {
    e.preventDefault();
    scrollBack += M.rows - 2;
  } else if (e.key === 'PageDown') {
    e.preventDefault();
    scrollBack = Math.max(0, scrollBack - (M.rows - 2));
  } else if (e.key === 'Escape') {
    input.value = '';
  } else if (e.key.toLowerCase() === 'l' && e.ctrlKey) {
    e.preventDefault();
    COMMANDS.clear();
  }
  dirty = true;
});

document.querySelectorAll('.quick button').forEach((btn) => {
  btn.addEventListener('click', () => {
    run(btn.dataset.cmd);
    if (!isCoarse) input.focus({ preventScroll: true });
  });
});

// screen coordinates → canvas pixels, through the same barrel warp the shader uses
function toCanvas(clientX, clientY) {
  const r = screenEl.getBoundingClientRect();
  let u = (clientX - r.left) / r.width, v = (clientY - r.top) / r.height;
  if (renderer) {
    let cx = u * 2 - 1, cy = (1 - v) * 2 - 1;
    const kx = 1 + CURVE.x * cy * cy, ky = 1 + CURVE.y * cx * cx;
    cx *= kx; cy *= ky;
    u = cx * 0.5 + 0.5; v = 1 - (cy * 0.5 + 0.5);
  }
  return { x: u * M.W, y: v * M.H };
}
function hitAt(clientX, clientY) {
  // forgiving targets: nearest link row within about a line, so fingers don't have to be exact
  const p = toCanvas(clientX, clientY);
  const tol = isCoarse ? 0.95 : 0.55;
  let best = null, bestD = Infinity;
  for (const h of hits) {
    if (p.x < h.x - M.cw * 0.6 || p.x > h.x + h.w + M.cw * 0.6) continue;
    const d = Math.abs(p.y - (h.y + h.h / 2));
    if (d < h.h * tol && d < bestD) { bestD = d; best = h; }
  }
  return best;
}
function activate(cmd) {
  if (cmd === '__bottom') { scrollBack = 0; dirty = true; return; }
  run(cmd);
}

// tap a command to run it; tap elsewhere to type (desktop) or skip ahead; drag or wheel scrolls back
let drag = null;
screenEl.addEventListener('pointerdown', (e) => {
  if (e.target === input) return;
  drag = { y: e.clientY, s: scrollBack, moved: false };
});
window.addEventListener('pointermove', (e) => {
  if (drag) {
    const d = (e.clientY - drag.y) * M.dpr / M.lh;
    if (Math.abs(d) > 0.6) drag.moved = true;
    if (drag.moved) { scrollBack = Math.max(0, Math.round(drag.s + d)); dirty = true; }
    return;
  }
  if (e.pointerType !== 'mouse') return;
  const h = hitAt(e.clientX, e.clientY);
  if ((h && h.cmd) !== (hover && hover.cmd) || (h && hover && h.y !== hover.y)) { hover = h; dirty = true; }
  screenEl.style.cursor = h ? 'pointer' : 'text';
});
window.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const wasDrag = drag.moved;
  drag = null;
  if (wasDrag) return;
  const h = hitAt(e.clientX, e.clientY);
  if (h) { activate(h.cmd); return; }
  if (busy) { fastForward = true; return; }
  // on touch, only the prompt row opens the keyboard; on desktop any click focuses it
  const p = toCanvas(e.clientX, e.clientY);
  if (!isCoarse || p.y > M.H - M.bottom - M.lh) input.focus({ preventScroll: true });
});
screenEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  scrollBack = Math.max(0, scrollBack - Math.sign(e.deltaY) * 3);
  dirty = true;
}, { passive: false });

/* ------------------------------------------------------------------
   The tube (WebGL)
------------------------------------------------------------------ */
let renderer = null, composer = null, crtPass = null, glTex = null, power = prefersReducedMotion ? 1 : 0, powerT0 = null;

const CRT_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uDpr: { value: 1 },
    uCurve: { value: new THREE.Vector2(0.045, 0.06) }, uPower: { value: 1 }, uFlicker: { value: 1 }, uRoll: { value: 1 },
    uGlow: { value: 0 }, uTint: { value: new THREE.Color(0.6, 1.0, 0.8) },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime, uDpr, uPower, uFlicker, uRoll, uGlow;
    uniform vec2 uCurve; uniform vec3 uTint;
    varying vec2 vUv;
    float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv * 2.0 - 1.0;
      c *= 1.0 + uCurve * vec2(c.y * c.y, c.x * c.x);          // barrel: the glass bulges
      vec2 uv = c * 0.5 + 0.5;
      float edge = rbox(c, vec2(1.0), 0.07);
      float inside = 1.0 - smoothstep(-0.006, 0.0, edge);
      vec2 dir = uv - 0.5;
      vec2 off = dir * (0.0012 + dot(dir, dir) * 0.005);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      if (uGlow > 0.0) {                                          // cheap glow where there is no bloom pass
        vec3 g = vec3(0.0);
        vec2 px = 2.5 / uRes;
        for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854; g += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * px * 2.0).rgb; }
        col += g / 8.0 * 0.4 * uGlow;
      }
      // scanlines every 3 CSS px, aperture grille across — kept light so text stays easy to read
      float scan = 0.5 + 0.5 * sin(uv.y * uRes.y * 3.14159 / (1.5 * uDpr));
      col *= 0.82 + 0.18 * scan;
      float m = mod(gl_FragCoord.x, 3.0);
      vec3 mask = vec3(m < 1.0 ? 1.0 : 0.84, (m >= 1.0 && m < 2.0) ? 1.0 : 0.84, m >= 2.0 ? 1.0 : 0.84);
      col *= mix(vec3(1.0), mask, 0.25);
      // a slow refresh band rolls down the tube
      float rp = fract(uv.y * 0.5 - uTime * 0.06);
      col *= 1.0 + smoothstep(0.0, 0.05, rp) * (1.0 - smoothstep(0.05, 0.16, rp)) * 0.05 * uRoll;
      col *= uFlicker;
      col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.02 * uRoll;
      col *= 1.0 - smoothstep(0.45, 1.4, length(c * vec2(0.85, 1.0))) * 0.55;
      // power-on: a bright line that opens to the full raster
      float open = smoothstep(0.15, 1.0, uPower);
      float raster = step(abs(c.y), max(open * 1.05, 0.004)) * step(abs(c.x), clamp(uPower * 5.0, 0.0, 1.05));
      vec3 flash = uTint * (1.0 - smoothstep(0.0, 0.5, uPower)) * step(abs(c.y), 0.012 + open) * 1.4;
      col = col * raster + flash;
      // glass: a faint window reflection
      col += vec3(0.05, 0.06, 0.055) * smoothstep(0.9, 0.0, length(c - vec2(-0.6, 0.7))) * 0.5;
      vec3 bezel = vec3(0.028, 0.031, 0.03) + vec3(0.05) * smoothstep(0.03, 0.0, abs(edge - 0.02)) + vec3(0.02) * (1.0 - vUv.y);
      gl_FragColor = vec4(mix(bezel, col, inside), 1.0);
    }
  `,
};

function setTint() {
  dirty = true;
  if (!crtPass) return;
  crtPass.uniforms.uTint.value.set(theme === THEMES.amber ? 0xffc070 : 0x9dffc8);
}

function initGL() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: crtCanvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (err) {
    renderer = null;
  }
  if (!renderer) {
    document.documentElement.classList.add('no-webgl');
    // the 2D canvas stands in for the tube
    term.className = 'term-fallback';
    term.setAttribute('aria-hidden', 'true');
    screenEl.insertBefore(term, form);
    return;
  }
  glTex = new THREE.CanvasTexture(term);
  glTex.colorSpace = THREE.SRGBColorSpace;
  glTex.minFilter = THREE.LinearFilter;
  glTex.generateMipmaps = false;
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: glTex, toneMapped: false })));
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  if (HIGH) {
    composer.addPass(new AfterimagePass(prefersReducedMotion ? 0 : 0.55));     // phosphor persistence
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.35, 0.2));
  }
  composer.addPass(new OutputPass());
  crtPass = new ShaderPass(CRT_SHADER);
  crtPass.uniforms.uGlow.value = HIGH ? 0 : 1;
  crtPass.uniforms.uRoll.value = prefersReducedMotion ? 0 : 1;
  composer.addPass(crtPass);
  setTint();
}

function resizeGL() {
  if (!renderer) return;
  const r = screenEl.getBoundingClientRect();
  renderer.setPixelRatio(M.dpr);
  renderer.setSize(r.width, r.height, false);
  composer.setPixelRatio(M.dpr);
  composer.setSize(r.width, r.height);
  crtPass.uniforms.uRes.value.set(M.W, M.H);
  crtPass.uniforms.uDpr.value = M.dpr;
  crtPass.uniforms.uCurve.value.set(CURVE.x, CURVE.y);
}

/* ------------------------------------------------------------------
   Frame loop
------------------------------------------------------------------ */
function advanceTyping(now) {
  for (const L of lines) {
    if (L.reveal < L.len) {
      if (fastForward) L.reveal = L.len;
      else L.reveal = Math.min(L.len, L.reveal + (L.speed || 190) * Math.max(0, Math.min(0.05, (now - (L.lastT || now)) / 1000)));
      L.lastT = now;
      if (L.reveal >= L.len) { L.cacheCols = -1; L.onDone?.(); }
    } else if (!L.lastT) L.lastT = now;
  }
}

function frame(now) {
  rainBoost += (rainBoostTarget - rainBoost) * 0.06;
  caretOn = Math.floor(now / 530) % 2 === 0;
  spinner = Math.floor(now / 120);
  advanceTyping(now);
  draw(now);
  if (renderer) {
    glTex.needsUpdate = true;
    // power-on runs on the clock, not the frame count, so slow devices still open fully
    if (power < 1) { powerT0 ??= now; power = Math.max(0, Math.min(1, (now - powerT0) / 900)); }
    crtPass.uniforms.uPower.value = power;
    crtPass.uniforms.uTime.value = now / 1000;
    crtPass.uniforms.uFlicker.value = 0.988 + 0.012 * Math.sin(now * 0.06) * Math.sin(now * 0.013);
    composer.render();
  }
  requestAnimationFrame(frame);
}

// Reduced motion keeps a static raster: redraw only when something changes.
function stillLoop() {
  if (dirty || lines.some((L) => L.block && !L.done) || Math.abs(rainBoost - rainBoostTarget) > 0.01) {
    dirty = false;
    rainBoost += (rainBoostTarget - rainBoost) * 0.25;
    draw(performance.now());
    if (renderer) {
      glTex.needsUpdate = true;
      crtPass.uniforms.uPower.value = 1;
      composer.render();
    }
  }
  setTimeout(() => requestAnimationFrame(stillLoop), 100);
}

/* ------------------------------------------------------------------
   Boot: short, skippable, then a plain welcome and the menu
------------------------------------------------------------------ */
async function boot() {
  busy = true;
  busyLabel = 'starting up';
  if (!prefersReducedMotion) {
    await sleep(350);
    say('sys', 'CIPHER field station · secure boot');
    await bar('warming the tube', 420, 'info');
  }
  BANNER.forEach((row, i) => print([['ok', row]], { nowrap: true, sr: i === 0 ? 'CIPHER' : null }));
  blank();
  await type([['info', 'Offensive security, defensively applied.']], { speed: 320 });
  await type([['text', 'We are a red team: companies hire us to break in, so real criminals can’t.']], { speed: 320 });
  say('sys', M.narrow ? 'This site is a terminal. No skills needed — tap a command below.' : 'This whole site is a terminal. You don’t need to know any commands — tap one, or type its number.');
  blank();
  busy = false;
  busyLabel = '';
  fastForward = false;
  menu();
  if (!isCoarse) input.focus({ preventScroll: true });
  if (queued) { const q = queued; queued = null; run(q); }
}

function fitToViewport() {
  const vv = window.visualViewport;
  document.documentElement.style.setProperty('--app-h', `${Math.round(vv ? vv.height : window.innerHeight)}px`);
  layout();
}

(async () => {
  try { await document.fonts.load('500 16px "IBM Plex Mono"', 'Mx█░▸─✓✗'); } catch (e) { /* fall back to the system mono */ }
  initGL();
  fitToViewport();
  window.addEventListener('resize', fitToViewport);
  window.visualViewport?.addEventListener('resize', fitToViewport);
  boot();
  if (prefersReducedMotion) stillLoop();
  else requestAnimationFrame(frame);
})();
