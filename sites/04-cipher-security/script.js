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
------------------------------------------------------------------ */

const THEMES = {
  green: {
    bg: '#020a05', panel: [1, 8, 4], text: '#b8e6c9', ok: '#33f584', sys: '#22a866', warn: '#ffc857', err: '#ff5468',
    info: '#55dcec', heading: '#86ffb8', echo: '#d6f5e2', rain: [41, 242, 125], head: '#e8fff2', dim: '#0f5a33',
    redact: '#1c8f55', inverse: '#33f584', inverseText: '#02140a', port: '#1d7a49', open: '#ffffff',
  },
  amber: {
    bg: '#0b0601', panel: [8, 4, 0], text: '#ffd9a0', ok: '#ffb347', sys: '#c08532', warn: '#fff0a8', err: '#ff7a52',
    info: '#ffe2a8', heading: '#ffcf7a', echo: '#ffe8c4', rain: [255, 168, 60], head: '#fff4dc', dim: '#5e3d12',
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

function layout() {
  const r = screenEl.getBoundingClientRect();
  M.dpr = Math.min(window.devicePixelRatio || 1, 2);
  M.W = Math.max(2, Math.round(r.width * M.dpr));
  M.H = Math.max(2, Math.round(r.height * M.dpr));
  const cssFs = r.width < 480 ? 12.5 : r.width < 900 ? 14 : Math.min(18, Math.max(15, r.width / 92));
  M.fs = Math.round(cssFs * M.dpr);
  term.width = rainCanvas.width = M.W;
  term.height = rainCanvas.height = M.H;
  ctx.font = FONT();
  M.cw = ctx.measureText('M').width;
  M.lh = Math.round(M.fs * 1.55);
  // leave room for the tube's curvature at the edges
  M.padX = Math.max(M.W * (r.width < 480 ? 0.05 : 0.06), M.cw * 2);
  M.cols = Math.floor((M.W - M.padX * 2) / M.cw);
  if (M.cols > 118) { M.cols = 118; M.padX = (M.W - M.cols * M.cw) / 2; }
  M.top = Math.round(M.H * 0.05 + M.lh * 2);
  M.bottom = Math.round(M.H * 0.05 + M.lh * 1.8);
  M.rows = Math.max(4, Math.floor((M.H - M.top - M.bottom) / M.lh));
  M.narrow = M.cols < 66;
  lines.forEach((L) => { L.cacheCols = -1; });
  initRain();
  // the real input sits over the prompt row so taps and IMEs land in the right place
  form.style.top = `${(M.H - M.bottom + M.lh * 0.45) / M.dpr}px`;
  form.style.left = `${M.padX / M.dpr}px`;
  form.style.width = `${(M.cols * M.cw) / M.dpr}px`;
  form.style.height = `${M.lh / M.dpr}px`;
  dirty = true;
  resizeGL();
}

/* ------------------------------------------------------------------
   Lines, wrapping, printing
------------------------------------------------------------------ */
const lines = [];
let scrollBack = 0;
let dirty = true;

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

const sleep = (ms) => new Promise((r) => setTimeout(r, prefersReducedMotion ? 0 : ms));

function type(parts, opts = {}) {
  const L = push({ segs: segsOf(parts), indent: opts.indent || 0, reveal: prefersReducedMotion ? Infinity : 0, speed: opts.speed || 170 });
  if (prefersReducedMotion) return Promise.resolve();
  return new Promise((res) => { L.onDone = res; });
}

// A live block redraws every frame until it resolves.
function live(rows, drawFn) {
  const L = push({ block: { rows, draw: drawFn }, reveal: Infinity }, null);
  return L;
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
  for (const [cls, t] of L.segs) for (const ch of t) chars.push([cls, ch]);
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
  // typed reveal
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
  // join runs
  L.rows = out.map((row) => {
    const runs = [];
    for (const [cls, ch] of row) {
      const last = runs[runs.length - 1];
      if (last && last[0] === cls) last[1] += ch;
      else runs.push([cls, ch]);
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
  const dt = Math.min(0.1, (now - lastRain) / 1000);
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
let spinner = 0;
const color = (cls) => theme[cls] || theme.text;

function fillRun(cls, text, x, y) {
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
  ctx.fillStyle = color(cls);
  ctx.font = FONT(cls === 'heading' ? 600 : 500);
  const ty = y + (M.lh - M.fs) / 2;
  if (/^[\x20-\x7e]*$/.test(text)) ctx.fillText(text, x, ty);
  else {
    // anything outside ASCII goes one cell at a time, so fallback glyphs never shift the grid
    let i = 0;
    for (const ch of text) { ctx.fillText(ch, x + i * M.cw, ty); i++; }
  }
  return n;
}

function drawStatus(now) {
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
  const left = M.narrow ? ' CIPHER//FS' : ' CIPHER // FIELD STATION   cipher@fieldstation:~/engagements';
  const right = M.narrow ? `${clock} ` : `TLS 1.3  ONLINE   ${clock} `;
  ctx.fillText(left, x0, ty);
  ctx.fillText(right, x0 + w - right.length * M.cw, ty);
}

function drawPrompt(now) {
  const y = M.H - M.bottom + M.lh * 0.45;
  let x = M.padX;
  if (busy) {
    const frames = '|/-\\';
    fillRun('sys', `${frames[spinner % 4]} running…`, x, y);
    return;
  }
  const ps1 = 'visitor@cipher:~$ ';
  x += fillRun('ok', ps1, x, y) * M.cw;
  const room = M.cols - ps1.length - 1;
  let v = input.value;
  let caret = input.selectionStart ?? v.length;
  let shift = Math.max(0, caret - room);
  const shown = v.slice(shift, shift + room);
  fillRun('echo', shown, x, y);
  if (caretOn || prefersReducedMotion) {
    ctx.fillStyle = theme.ok;
    ctx.globalAlpha = document.activeElement === input ? 0.9 : 0.4;
    ctx.fillRect(x + (caret - shift) * M.cw, y + M.lh * 0.12, M.cw * 0.92, M.lh * 0.76);
    ctx.globalAlpha = 1;
  }
}

function draw(now) {
  ctx.textBaseline = 'top';
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, M.W, M.H);
  drawRain(now);
  ctx.globalAlpha = 0.9;
  ctx.drawImage(rainCanvas, 0, 0);
  ctx.globalAlpha = 1;
  // the text panel dims the rain behind it (less so while `matrix` runs)
  const [pr, pg, pb] = theme.panel;
  ctx.fillStyle = `rgba(${pr},${pg},${pb},${(0.88 - rainBoost * 0.62).toFixed(3)})`;
  ctx.fillRect(M.padX - M.cw * 1.2, M.top - M.lh * 0.5, (M.cols + 2.4) * M.cw, M.rows * M.lh + M.lh * 1.0);

  drawStatus(now);

  const all = [];
  for (const L of lines) {
    const rows = wrapLine(L, M.cols);
    for (const r of rows) all.push(r);
  }
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
      row.block.draw(M.padX, y - row.part * M.lh, now);
      continue;
    }
    let x = M.padX;
    for (const [cls, t] of row) x += fillRun(cls, t, x, y) * M.cw;
  }
  if (scrollBack > 0) {
    const y = M.top + (M.rows - 1) * M.lh;
    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    ctx.fillRect(M.padX - M.cw, y, (M.cols + 2) * M.cw, M.lh);
    fillRun('info', `── ${scrollBack} more line${scrollBack === 1 ? '' : 's'} below · PgDn or scroll ──`, M.padX, y);
  }
  drawPrompt(now);
}

/* ------------------------------------------------------------------
   Live widgets: progress bars and the port sweep
------------------------------------------------------------------ */
function bar(label, ms, cls = 'ok') {
  if (prefersReducedMotion) {
    const W = Math.max(8, Math.min(26, M.cols - 20));
    print([['info', label.padEnd(M.narrow ? 13 : 16)], ['barfill', '█'.repeat(W)], [cls, ' 100%']], { nowrap: true, sr: `${label} 100%` });
    return Promise.resolve();
  }
  return new Promise((res) => {
    const t0 = performance.now();
    const L = live(1, (x, y, now) => {
      const W = Math.max(8, Math.min(26, M.cols - 20));
      const f = Math.min(1, (now - t0) / ms);
      const n = Math.round(W * f);
      let cx = x;
      cx += fillRun('info', label.padEnd(M.narrow ? 13 : 16), cx, y) * M.cw;
      cx += fillRun('barfill', '█'.repeat(n), cx, y) * M.cw;
      cx += fillRun('barempty', '░'.repeat(W - n), cx, y) * M.cw;
      fillRun(f >= 1 ? cls : 'sys', ` ${String(Math.round(f * 100)).padStart(3)}%`, cx, y);
      if (f >= 1 && !L.done) { L.done = true; mirror(`${label} 100%`); res(); }
    });
  });
}

const OPEN_PORTS = [22, 80, 443, 5432, 8080];
function portSweep(ms) {
  const CELLS = 1024;               // ports 1–8192, eight per cell
  const gridCols = M.narrow ? 32 : 64;
  const gridRows = CELLS / gridCols;
  const blockRows = M.narrow ? 8 : 6;
  const openCells = new Map(OPEN_PORTS.map((p) => [Math.floor((p - 1) / 8), p]));
  return new Promise((res) => {
    const t0 = performance.now();
    const L = live(blockRows + 1, (x, y, now) => {
      const f = prefersReducedMotion ? 1 : Math.min(1, (now - t0) / ms);
      const scanned = Math.floor(f * CELLS);
      const found = [...openCells].filter(([c]) => c < scanned).map(([, p]) => p);
      fillRun('info', 'tcp syn 1-8192', x, y);
      fillRun(found.length ? 'warn' : 'sys', `open: ${found.join(' ') || '—'}`, x + (M.narrow ? 15 : 17) * M.cw, y);
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
            const pulse = prefersReducedMotion ? 1 : 0.75 + 0.25 * Math.sin(now / 180 + i);
            ctx.fillStyle = theme.open;
            ctx.globalAlpha = pulse;
            ctx.fillRect(cx - cw * 0.15, cy - ch * 0.15, cw * 1.1, ch * 1.1);
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
      // the sweep front
      if (f < 1) {
        const i = scanned;
        ctx.fillStyle = theme.head;
        ctx.fillRect(x + (i % gridCols) * cw, top + Math.floor(i / gridCols) * ch, cw * 0.8, ch * 0.8);
      }
      if (f >= 1 && !L.done) { L.done = true; mirror(`tcp syn 1-8192 complete. Open: ${OPEN_PORTS.join(', ')}`); res(); }
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
const history = [];
let historyIdx = 0;

function table(rows, widths, clsFor) {
  rows.forEach((cells, r) => {
    if (M.narrow) {
      print([[clsFor(r, 0), `  ${cells[0]}`], ['sys', `  ${cells[1]}`]], { nowrap: true });
      if (cells[2] || cells[3]) print([[clsFor(r, 3), `    ${[cells[2], cells[3]].filter(Boolean).join(' · ')}`]], { indent: 4 });
    } else {
      print(cells.map((c, i) => [clsFor(r, i), `${i === 0 ? '  ' : ''}${c}`.padEnd(widths[i] + (i === 0 ? 2 : 0))]), { indent: 2 + widths[0] + widths[1] + widths[2] });
    }
  });
}

const COMMANDS = {
  async help() {
    say('heading', 'AVAILABLE COMMANDS');
    const rows = [
      ['help', 'this menu'],
      ['services', "what we break (so others can't)"],
      ['scan <host>', 'run a demonstration recon sweep'],
      ['casework', 'selected engagements, redacted'],
      ['team', 'the operators'],
      ['why', 'why offense-first security works'],
      ['theme [amber|green]', 'swap the phosphor'],
      ['matrix', 'let the rain take over'],
      ['uptime · whoami · date', 'field station status'],
      ['history · clear · exit', 'the usual'],
    ];
    for (const [cmd, desc] of rows) {
      if (M.narrow) {
        print([['info', `  ${cmd}`]]);
        print([['sys', `      ${desc}`]], { indent: 6 });
      } else {
        print([['info', `  ${cmd.padEnd(26)}`], ['sys', desc]], { indent: 28 });
      }
    }
    blank();
    print([['sys', 'Tab completes · ↑ ↓ history · PgUp PgDn scroll · Ctrl+L clears']]);
    blank();
  },

  async services() {
    say('heading', 'SERVICES — OFFENSE, DEFENSIVELY APPLIED');
    const s = [
      'External penetration testing — your perimeter, attacked like it matters.',
      'Red team engagements — months-long, objective-based, quiet.',
      'Social engineering — the firewall between chairs, tested politely.',
      'Cloud posture review — IAM sprawl, public buckets, forgotten keys.',
      'Incident rehearsal — practice the worst day before it happens.',
    ];
    for (const t of s) await type([['ok', `▸ ${t}`]], { indent: 2 });
    blank();
    say('sys', 'All engagements are authorized, scoped in writing, and reported in person.');
    blank();
  },

  async scan(args) {
    const host = (args[0] || 'demo.target').replace(/[^a-z0-9.-]/gi, '').slice(0, 40) || 'demo.target';
    say('heading', `RECON SWEEP → ${host}`);
    say('sys', '(simulated output — no packets were harmed)');
    await sleep(250);
    await bar('resolve', 450);
    await portSweep(2600);
    await bar('service probe', 700);
    await bar('tls audit', 600);
    blank();
    const rows = [
      ['22/tcp', 'open', 'ssh', 'key auth only — good'],
      ['80/tcp', 'open', 'http', 'redirects to 443 — good'],
      ['443/tcp', 'open', 'https', 'TLS 1.3, HSTS present'],
      ['8080/tcp', 'open', 'http-proxy', '! default admin panel exposed'],
      ['5432/tcp', 'open', 'postgresql', 'x reachable from WAN'],
    ];
    if (!M.narrow) print([['info', `  ${'PORT'.padEnd(10)}${'STATE'.padEnd(8)}${'SERVICE'.padEnd(13)}NOTE`]]);
    table(rows, [10, 8, 13, 30], (r) => (r < 3 ? 'ok' : r === 3 ? 'warn' : 'err'));
    blank();
    await type([['warn', 'Two findings in ninety seconds — and this is the polite version.']]);
    say('sys', 'A real engagement goes deeper. Much deeper.');
    blank();
  },

  async casework() {
    say('heading', 'SELECTED CASEWORK — DETAILS REDACTED BY CONTRACT');
    const cases = [
      ['FY25-Q4', 'Regional bank', 'Domain admin in 6 hours via a ', 'printer', '. The printer has been spoken to.'],
      ['FY25-Q2', 'Logistics platform', '', 'API key', ' in a public mobile build. Rotated before breakfast.'],
      ['FY24-Q4', 'Hospital group', 'Badge-cloned into the ', 'server room', '. Physical controls rebuilt.'],
      ['FY24-Q1', 'SaaS unicorn', '', 'CI runner', ' exfil path closed 11 days before a real actor tried it.'],
    ];
    for (const [q, client, a, secret, b] of cases) {
      await type([['info', `▸ ${q} — ${client}`]]);
      print([['sys', `  ${a}`], ['redact', secret], ['sys', b]], { indent: 2, sr: `  ${a}[redacted]${b}` });
    }
    blank();
  },

  async team() {
    say('heading', 'THE OPERATORS');
    const team = [
      ['"Vireo"', 'Lead operator. Ex-CERT. Thinks in attack graphs, dreams in packet captures.'],
      ['"Marrow"', 'Hardware & physical. Owns more lockpicks than keys.'],
      ['"Sable"', 'Social engineering. You have almost certainly held the door for them.'],
      ['"Tern"', 'Cloud & CI. Reads IAM policy documents for fun. Genuinely.'],
    ];
    for (const [name, bio] of team) {
      await type([['ok', `▸ ${name}`]]);
      print([['sys', `  ${bio}`]], { indent: 2 });
    }
    blank();
    say('sys', 'Handles only. Their real names are the first thing we protect.');
    blank();
  },

  async why() {
    say('heading', 'WHY OFFENSE-FIRST');
    await type([['ok', "Every control you deploy was designed against yesterday's attack."]]);
    await type([['ok', "The only way to know what today's attack looks like is to run it —"]]);
    await type([['ok', 'on your terms, in your scope, with your lawyers smiling.']]);
    blank();
    await type([['info', 'We break things gently, document ruthlessly, and leave you stronger.']]);
    blank();
  },

  async uptime() {
    const days = 1337 + Math.floor((Date.now() / 86400000) % 100);
    say('ok', `field station up ${days} days · 0 breaches · 4 operators awake · coffee reserves: ADEQUATE`);
    blank();
  },

  async whoami() {
    await type([['ok', 'visitor (uid 1000) — unprivileged, unverified, but very welcome.']]);
    blank();
  },

  async date() {
    say('ok', new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    say('sys', 'clock disciplined by four stratum-1 sources. We trust none of them fully.');
    blank();
  },

  async history() {
    if (!history.length) say('sys', 'no history yet — that is the most secure history there is.');
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
    say('ok', next === 'amber' ? 'phosphor → P3 amber. Easier on the eyes after midnight.' : 'phosphor → P1 green. Classic.');
    blank();
  },

  async exit() {
    say('sys', 'logout');
    say('sys', 'Connection to fieldstation closed.');
    await sleep(500);
    say('ok', "...kidding. The way out is the link at the bottom. We'll keep the lights on.");
    blank();
    backLink.classList.add('is-hinted');
    setTimeout(() => backLink.classList.remove('is-hinted'), 3200);
  },

  async clear() {
    lines.length = 0;
    srLog.textContent = '';
    dirty = true;
  },
};
COMMANDS.ls = COMMANDS.help;
COMMANDS.man = COMMANDS.help;
COMMANDS.logout = COMMANDS.exit;

async function run(raw) {
  const trimmed = raw.trim();
  if (!trimmed || busy) return;
  push({ segs: [['ok', 'visitor@cipher:~$ '], ['echo', trimmed]], reveal: Infinity });
  history.push(trimmed);
  historyIdx = history.length;
  const [cmd, ...args] = trimmed.toLowerCase().split(/\s+/);
  const fn = COMMANDS[cmd];
  busy = true;
  try {
    if (fn) await fn(args);
    else { print([['err', `command not found: ${cmd} — try `], ['info', 'help']]); blank(); }
  } finally {
    busy = false;
    dirty = true;
  }
}

/* ------------------------------------------------------------------
   Input
------------------------------------------------------------------ */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = input.value;
  input.value = '';
  run(v);
  dirty = true;
});
['input', 'keyup', 'select', 'focus', 'blur'].forEach((ev) => input.addEventListener(ev, () => { dirty = true; caretOn = true; }));
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIdx > 0) input.value = history[--historyIdx] || '';
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIdx < history.length) input.value = history[++historyIdx] || '';
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const stub = input.value.trim().toLowerCase();
    if (!stub) return;
    const matches = Object.keys(COMMANDS).filter((c) => c.startsWith(stub));
    if (matches.length === 1) input.value = `${matches[0]} `;
    else if (matches.length > 1) print([['sys', matches.join('   ')]]);
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

// any tap on the screen focuses the prompt; drag or wheel scrolls back
let drag = null;
screenEl.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, s: scrollBack, moved: false }; });
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const d = (e.clientY - drag.y) * M.dpr / M.lh;
  if (Math.abs(d) > 0.6) drag.moved = true;
  if (drag.moved) { scrollBack = Math.max(0, Math.round(drag.s + d)); dirty = true; }
});
window.addEventListener('pointerup', () => {
  if (drag && !drag.moved) input.focus({ preventScroll: true });
  drag = null;
});
screenEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  scrollBack = Math.max(0, scrollBack - Math.sign(e.deltaY) * 3);
  dirty = true;
}, { passive: false });

/* ------------------------------------------------------------------
   The tube (WebGL)
------------------------------------------------------------------ */
let renderer = null, composer = null, crtPass = null, glTex = null, power = prefersReducedMotion ? 1 : 0;

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
      vec2 off = dir * (0.0018 + dot(dir, dir) * 0.006);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      if (uGlow > 0.0) {                                          // cheap glow where there is no bloom pass
        vec3 g = vec3(0.0);
        vec2 px = 2.5 / uRes;
        for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854; g += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * px * 2.0).rgb; }
        col += g / 8.0 * 0.42 * uGlow;
      }
      // scanlines every 3 CSS px, aperture grille across
      float scan = 0.5 + 0.5 * sin(uv.y * uRes.y * 3.14159 / (1.5 * uDpr));
      col *= 0.74 + 0.26 * scan;
      float m = mod(gl_FragCoord.x, 3.0);
      vec3 mask = vec3(m < 1.0 ? 1.0 : 0.8, (m >= 1.0 && m < 2.0) ? 1.0 : 0.8, m >= 2.0 ? 1.0 : 0.8);
      col *= mix(vec3(1.0), mask, 0.3);
      // a slow refresh band rolls down the tube
      float rp = fract(uv.y * 0.5 - uTime * 0.06);
      col *= 1.0 + smoothstep(0.0, 0.05, rp) * (1.0 - smoothstep(0.05, 0.16, rp)) * 0.06 * uRoll;
      col *= uFlicker;
      col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.025 * uRoll;
      col *= 1.0 - smoothstep(0.4, 1.35, length(c * vec2(0.85, 1.0))) * 0.6;
      // power-on: a bright line that opens to the full raster
      float open = smoothstep(0.15, 1.0, uPower);
      float raster = step(abs(c.y), max(open * 1.05, 0.004)) * step(abs(c.x), clamp(uPower * 5.0, 0.0, 1.05));
      vec3 flash = uTint * (1.0 - smoothstep(0.0, 0.5, uPower)) * step(abs(c.y), 0.012 + open) * 1.4;
      col = col * raster + flash;
      // glass: a faint window reflection
      col += vec3(0.05, 0.06, 0.055) * smoothstep(0.9, 0.0, length(c - vec2(-0.6, 0.7))) * 0.6;
      vec3 bezel = vec3(0.028, 0.031, 0.03) + vec3(0.05) * smoothstep(0.03, 0.0, abs(edge - 0.02)) + vec3(0.02) * (1.0 - vUv.y);
      gl_FragColor = vec4(mix(bezel, col, inside), 1.0);
    }
  `,
};

function setTint() {
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
    composer.addPass(new AfterimagePass(prefersReducedMotion ? 0 : 0.6));     // phosphor persistence
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.35, 0.18));
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
  // portrait tubes bulge less side to side
  crtPass.uniforms.uCurve.value.set(r.width < 600 ? 0.025 : 0.045, r.width < 600 ? 0.035 : 0.06);
}

/* ------------------------------------------------------------------
   Frame loop
------------------------------------------------------------------ */
function frame(now) {
  // eased rain takeover, caret blink, live widgets
  rainBoost += (rainBoostTarget - rainBoost) * 0.06;
  if (!prefersReducedMotion) {
    caretOn = Math.floor(now / 530) % 2 === 0;
    spinner = Math.floor(now / 120);
  }
  // typed lines advance in real time
  for (const L of lines) {
    if (L.reveal < L.len) {
      L.reveal = Math.min(L.len, L.reveal + (L.speed || 170) * Math.min(0.05, (now - (L.lastT || now)) / 1000));
      L.lastT = now;
      if (L.reveal >= L.len) { L.cacheCols = -1; L.onDone?.(); }
    } else if (!L.lastT) L.lastT = now;
  }
  draw(now);
  if (renderer) {
    glTex.needsUpdate = true;
    if (power < 1) power = Math.min(1, power + 0.022);
    crtPass.uniforms.uPower.value = power;
    crtPass.uniforms.uTime.value = now / 1000;
    crtPass.uniforms.uFlicker.value = prefersReducedMotion ? 1 : 0.985 + 0.015 * Math.sin(now * 0.06) * Math.sin(now * 0.013);
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
  setTimeout(() => requestAnimationFrame(stillLoop), 120);
}

/* ------------------------------------------------------------------
   Boot
------------------------------------------------------------------ */
async function boot() {
  if (!prefersReducedMotion) {
    await sleep(700);
    say('sys', 'CIPHER FIELDSTATION BIOS v4.2 · secure boot');
    const L = live(1, (x, y, now) => {
      const k = Math.min(65536, Math.floor((now - L.t0) * 60));
      fillRun('sys', `memory test  ${String(k).padStart(5)}K ${k >= 65536 ? 'OK' : ''}`, x, y);
      if (k >= 65536 && !L.done) { L.done = true; L.res(); }
    });
    L.t0 = performance.now();
    await new Promise((r) => { L.res = r; });
    say('sys', 'secure boot   verified');
    await bar('handshake', 600, 'info');
    await sleep(200);
  }
  BANNER.forEach((row, i) => print([['ok', row]], { nowrap: true, sr: i === 0 ? 'CIPHER' : null }));
  blank();
  await type([['info', 'Offensive security, defensively applied.']]);
  blank();
  say('sys', "We are the people you hire to break in — before someone you didn't hire does.");
  blank();
  print([['ok', 'Type '], ['info', 'help'], ['ok', ' to see what this terminal can do, or use the buttons below.']]);
  blank();
  if (!isCoarse) input.focus({ preventScroll: true });
}

function fitToViewport() {
  const vv = window.visualViewport;
  document.documentElement.style.setProperty('--app-h', `${Math.round(vv ? vv.height : window.innerHeight)}px`);
  layout();
}

(async () => {
  try { await document.fonts.load(`500 16px "IBM Plex Mono"`, 'Mx█░▸─'); } catch (e) { /* fall back to the system mono */ }
  initGL();
  fitToViewport();
  window.addEventListener('resize', fitToViewport);
  window.visualViewport?.addEventListener('resize', fitToViewport);
  boot();
  if (prefersReducedMotion) stillLoop();
  else requestAnimationFrame(frame);
})();
