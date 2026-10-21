import * as THREE from 'three';

/* ============================================================
   SUMINAGA — floating ink
   Every drop is a polygon on still water. A new drop pushes every
   older point outward by the exact suminagashi map
       P' = C + (P − C) · sqrt(1 + r² / |P − C|²)
   and the stylus and comb are tine lines,
       P' = P + z · u · λ / (d + λ)
   with d the distance to the stroke. The geometry is drawn to an
   offscreen canvas; a shader turns it into ink on water — washi
   fibre, pigment granulation, wet edges, ripples — and the same
   shader pulls the print when paper meets the basin.
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
// phones and portrait tablets share the stacked layout (mirrors the CSS query)
const smallMQ = window.matchMedia('(max-width: 760px), (max-width: 1099px) and (max-aspect-ratio: 10/11)');
const isSmall = () => smallMQ.matches;
const LOW = isSmall() || coarse || (navigator.hardwareConcurrency || 8) <= 4;

const PAPER = '#f1eadb';
const MAX_SEG = LOW ? 4.5 : 3.2;     // css px between edge points
const MIN_SEG = 1.0;
const BUDGET = LOW ? 32000 : 90000;  // edge points across every drop
const MAX_DROPS = LOW ? 100 : 170;

const $ = (s) => document.querySelector(s);
const canvas = $('#basin');
const whisper = $('#whisper');
const statusEl = $('#status');
const bench = $('.bench');
const teaButtons = [...document.querySelectorAll('.tea')];
const TEAS = teaButtons.map((b) => ({ name: b.dataset.name, ink: b.dataset.ink, pale: b.dataset.pale, detail: b.dataset.detail }));

let W = window.innerWidth, H = window.innerHeight;
const DPR = Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2);

/* ============================================================
   The water: drops as polygons
   ============================================================ */

const drops = [];   // oldest first, painted in order
let needsResample = false;
let dirty = true;

function circle(cx, cy, r) {
  const n = Math.max(36, Math.min(1200, Math.ceil((Math.PI * 2 * r) / MAX_SEG)));
  const p = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    p[i * 2] = cx + Math.cos(a) * r;
    p[i * 2 + 1] = cy + Math.sin(a) * r;
  }
  return p;
}

function bbox(d) {
  const p = d.p;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    const x = p[i], y = p[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  d.x0 = x0; d.y0 = y0; d.x1 = x1; d.y1 = y1;
}

function addDrop(cx, cy, r, color) {
  const r2 = r * r;
  for (const d of drops) {
    const p = d.p;
    for (let i = 0; i < p.length; i += 2) {
      const dx = p[i] - cx, dy = p[i + 1] - cy;
      const s = Math.sqrt(1 + r2 / (dx * dx + dy * dy || 1e-4));
      p[i] = cx + dx * s;
      p[i + 1] = cy + dy * s;
    }
    // the box only grows outward from the centre
    d.x0 = Math.min(d.x0, cx - Math.sqrt(Math.max(0, (cx - d.x0) ** 2 + r2)));
    d.x1 = Math.max(d.x1, cx + Math.sqrt(Math.max(0, (d.x1 - cx) ** 2 + r2)));
    d.y0 = Math.min(d.y0, cy - Math.sqrt(Math.max(0, (cy - d.y0) ** 2 + r2)));
    d.y1 = Math.max(d.y1, cy + Math.sqrt(Math.max(0, (d.y1 - cy) ** 2 + r2)));
  }
  const d = { p: circle(cx, cy, r), color, a: 1, fade: 0 };
  bbox(d);
  drops.push(d);
  needsResample = dirty = true;
}

/* One stylus step along A→B. With `tines` > 1 it is a comb: parallel
   tines `gap` apart, all evaluated in one pass over the points. */
function stroke(ax, ay, bx, by, tines = 1, gap = 0) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  if (L < 0.01) return;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const lambda = tines > 1 ? 9 : 16;
  const z = L * (tines > 1 ? 0.6 : 0.96);
  const half = ((tines - 1) / 2) * gap;
  const reach = lambda * 16 + half;
  for (const d of drops) {
    // skip drops whose box is out of reach of the whole stroke
    if (d.x1 < Math.min(ax, bx) - reach || d.x0 > Math.max(ax, bx) + reach ||
        d.y1 < Math.min(ay, by) - reach || d.y0 > Math.max(ay, by) + reach) continue;
    const p = d.p;
    for (let i = 0; i < p.length; i += 2) {
      const px = p[i] - ax, py = p[i + 1] - ay;
      let t = px * ux + py * uy;
      const along = t < 0 ? -t : t > L ? t - L : 0;     // distance past the ends
      if (along > reach) continue;
      const across = px * nx + py * ny;                  // signed distance from the centre line
      if (across > reach || across < -reach) continue;
      let m = 0;
      for (let k = 0; k < tines; k++) {
        const off = across - (k * gap - half);
        const dist = Math.sqrt(off * off + along * along);
        if (dist < reach) m += lambda / (dist + lambda) * (1 - dist / reach);
      }
      if (m === 0) continue;
      p[i] += ux * z * m;
      p[i + 1] += uy * z * m;
    }
    const zz = z * 2;
    d.x0 += Math.min(0, ux * zz); d.x1 += Math.max(0, ux * zz);
    d.y0 += Math.min(0, uy * zz); d.y1 += Math.max(0, uy * zz);
  }
  needsResample = dirty = true;
}

/* the basin turns, imperceptibly — a living surface */
function swirl(dt, cx, cy) {
  const R = Math.min(W, H) * 0.6;
  for (const d of drops) {
    const p = d.p;
    for (let i = 0; i < p.length; i += 2) {
      const dx = p[i] - cx, dy = p[i + 1] - cy;
      const a = 0.011 * dt * Math.exp(-Math.sqrt(dx * dx + dy * dy) / R);
      p[i] = cx + dx - dy * a;
      p[i + 1] = cy + dy + dx * a;
    }
  }
  dirty = true;
}

/* keep edges smooth as ink stretches; thin them where it bunches */
let scratch = new Float32Array(1 << 16);
function resample() {
  let total = 0;
  for (const d of drops) total += d.p.length >> 1;
  const maxSeg = total > BUDGET ? MAX_SEG * Math.min(3, total / BUDGET) : MAX_SEG;
  for (const d of drops) {
    const p = d.p, n = p.length >> 1;
    if (scratch.length < n * 8 + 64) scratch = new Float32Array(n * 8 + 64);
    let k = 0;
    let lx = p[0], ly = p[1];
    scratch[k++] = lx; scratch[k++] = ly;
    for (let i = 1; i <= n; i++) {
      const j = (i % n) * 2;
      const x = p[j], y = p[j + 1];
      const dx = x - lx, dy = y - ly;
      const L = Math.sqrt(dx * dx + dy * dy);
      if (i < n && L < MIN_SEG) continue;
      if (L > maxSeg) {
        const m = Math.min(64, Math.ceil(L / maxSeg));
        for (let s = 1; s < m; s++) {
          if (k + 2 > scratch.length - 4) break;
          scratch[k++] = lx + (dx * s) / m;
          scratch[k++] = ly + (dy * s) / m;
        }
      }
      if (i === n) break;   // back at the start: the loop closes itself
      if (k + 2 > scratch.length - 4) break;
      scratch[k++] = x; scratch[k++] = y;
      lx = x; ly = y;
    }
    if (k >= 6) d.p = scratch.slice(0, k);
    bbox(d);
  }
  needsResample = false;
}

function inside(p, x, y) {
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const yi = p[i + 1], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((p[j] - p[i]) * (y - yi)) / (yj - yi) + p[i]) c = !c;
  }
  return c;
}

/* drops leave only when nobody can see them: off the basin, or hidden
   under a newer drop that has grown past every edge of the view */
function cull() {
  const m = 2;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    if (d.x1 < -m || d.x0 > W + m || d.y1 < -m || d.y0 > H + m) { drops.splice(i, 1); dirty = true; continue; }
    if (d.x0 > -m || d.x1 < W + m || d.y0 > -m || d.y1 < H + m) continue;  // box doesn't wrap the view
    const p = d.p;
    let anyIn = false;
    for (let k = 0; k < p.length; k += 2) {
      if (p[k] > -m && p[k] < W + m && p[k + 1] > -m && p[k + 1] < H + m) { anyIn = true; break; }
    }
    if (anyIn) continue;
    if (inside(p, W / 2, H / 2)) {
      if (i > 0) { drops.splice(0, i); dirty = true; }
      break;
    }
    drops.splice(i, 1);
    dirty = true;
  }
  // past the cap, the oldest visible ring dissolves rather than vanishing
  if (drops.length > MAX_DROPS) {
    const d = drops.find((x) => !x.fade);
    if (d) d.fade = 1;
  }
}

/* ============================================================
   Ink canvas → shader
   ============================================================ */

const ink = document.createElement('canvas');
const ictx = ink.getContext('2d');

function sizeInk() {
  ink.width = Math.round(W * DPR);
  ink.height = Math.round(H * DPR);
}

function paintInk() {
  ictx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ictx.globalAlpha = 1;
  ictx.fillStyle = PAPER;
  ictx.fillRect(0, 0, W, H);
  for (const d of drops) {
    if (d.x1 < 0 || d.x0 > W || d.y1 < 0 || d.y0 > H) continue;
    const p = d.p;
    ictx.globalAlpha = d.a;
    ictx.fillStyle = d.color;
    ictx.beginPath();
    ictx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ictx.lineTo(p[i], p[i + 1]);
    ictx.closePath();
    ictx.fill();
  }
  ictx.globalAlpha = 1;
}

let renderer = null;
const hasGL = (() => {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch (err) { return false; }
})();
if (hasGL) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (err) {
    renderer = null;
  }
}

const RIPPLES = 10;
const U = {
  tInk: { value: null },
  uRes: { value: new THREE.Vector2(1, 1) },
  uPx: { value: DPR },
  uTime: { value: 0 },
  uPrint: { value: 0 },
  uRip: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
  uHold: { value: new THREE.Vector4(0, 0, 0, 0) },
  uLight: { value: new THREE.Vector2(0.3, 0.7) },
  uPaper: { value: new THREE.Vector3(241 / 255, 234 / 255, 219 / 255) },
};
let scene, cam, inkTex;

if (renderer) {
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  inkTex = new THREE.CanvasTexture(ink);
  inkTex.generateMipmaps = false;
  inkTex.minFilter = THREE.LinearFilter;
  inkTex.magFilter = THREE.LinearFilter;
  U.tInk.value = inkTex;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    defines: { RIPPLES, TAPS: LOW ? 4 : 8 },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D tInk; uniform vec2 uRes; uniform float uPx; uniform float uTime; uniform float uPrint;
      uniform vec4 uRip[RIPPLES]; uniform vec4 uHold; uniform vec2 uLight; uniform vec3 uPaper;
      varying vec2 vUv;

      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
      // washi: kozo fibres are long, thin and wandering — isolines of a
      // warped noise field, shown only in loose drifts
      float fibres(vec2 q){
        float f = 0.0;
        for (int i = 0; i < 3; i++) {
          float s = 0.011 + float(i) * 0.006;
          vec2 p = q * s + float(i) * 13.7;
          vec2 w = vec2(noise(p * 1.7 + 4.0), noise(p * 1.7 + 9.0)) - 0.5;
          float n = noise(p + w * 0.9);
          float line = smoothstep(0.016, 0.0, abs(n - 0.5));
          float drift = smoothstep(0.42, 0.78, noise(q * 0.006 + float(i) * 5.3));
          f += line * drift;
        }
        return f;
      }

      void main(){
        vec2 px = vUv * uRes;            // device pixels
        vec2 q = vec2(px.x, uRes.y - px.y) / uPx;   // css pixels, top-down like the pointer
        vec2 off = vec2(0.0);
        float crest = 0.0;
        if (uPrint < 0.5) {
          for (int i = 0; i < RIPPLES; i++) {
            vec4 r = uRip[i];
            float age = uTime - r.z;
            if (age < 0.0 || age > 3.2) continue;
            vec2 d = q - r.xy;
            float dist = length(d) + 1e-3;
            float w = dist - age * 150.0;
            float env = exp(-w * w / 900.0) * exp(-age * 1.25) * r.w / (1.0 + dist * 0.006);
            float wave = sin(w * 0.16) * env;
            off += d / dist * wave * 3.2;
            crest += cos(w * 0.16) * env;
          }
        }
        vec2 suv = (px + vec2(off.x, -off.y) * uPx) / uRes;
        vec3 c = texture2D(tInk, suv).rgb;
        // neighbourhood: a near ring softens the polygon edge, a far ring finds the wet edge
        vec3 nearC = vec3(0.0), farC = vec3(0.0);
        for (int i = 0; i < TAPS; i++) {
          float a = float(i) / float(TAPS) * 6.2831853 + 0.4;
          vec2 o = vec2(cos(a), sin(a)) / uRes * uPx;
          nearC += texture2D(tInk, suv + o * 1.1).rgb;
          farC += texture2D(tInk, suv + o * 4.5).rgb;
        }
        nearC /= float(TAPS); farC /= float(TAPS);
        vec3 col = mix(c, nearC, 0.45);
        float dens = clamp(length(uPaper - c) * 1.7, 0.0, 1.0);
        float edge = clamp(length(c - farC) * 2.6, 0.0, 1.0);
        // pigment pools where a ring meets its neighbour
        col = mix(col, col * 0.8, edge * dens * 0.6);
        // granulation: pigment settles unevenly
        float g = fbm(q * 0.55 + 3.0);
        float g2 = noise(q * 2.3);
        col = mix(col, col * (0.9 + 0.16 * g + 0.05 * g2), dens * 0.75);
        // the sheet's formation is cloudy; fibres catch light and resist ink
        float fib = fibres(q);
        col *= 0.982 + 0.036 * fbm(q * 0.012 + 7.0);
        col = mix(col, uPaper, fib * dens * 0.12);
        col += fib * (1.0 - dens) * 0.03;
        float speck = step(0.9985, hash(floor(q * 0.5)));
        col -= speck * 0.1 * (1.0 - dens * 0.5);
        if (uPrint < 0.5) {
          // the water: a slow sheen that leans toward the pointer, and ripple crests
          float sheen = smoothstep(0.55, 0.95, fbm(q * 0.0035 + vec2(uTime * 0.018, -uTime * 0.011)));
          float lean = exp(-dot(vUv - uLight, vUv - uLight) * 2.5);
          col += vec3(1.0, 0.99, 0.96) * sheen * (0.025 + 0.05 * lean);
          col += crest * 0.05;
          // the nib or a growing drop
          if (uHold.w > 0.0) {
            float rr = length(q - uHold.xy);
            col = mix(col, vec3(0.15), uHold.w * smoothstep(1.4, 0.0, abs(rr - uHold.z)) * 0.55);
          }
          // the basin's rim
          vec2 v = vUv - 0.5;
          col *= 1.0 - smoothstep(0.42, 0.85, length(v * vec2(1.0, 0.85))) * 0.1;
        } else {
          // a pulled print: ink sinks into the sheet and lightens a touch
          col = mix(col, uPaper, dens * 0.06);
          col += fib * 0.008;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
} else {
  document.documentElement.classList.add('no-webgl');
  ink.className = 'basin-2d';
  ink.setAttribute('aria-hidden', 'true');
  canvas.before(ink);
  canvas.style.background = 'transparent';
}

function sizeAll() {
  sizeInk();
  if (renderer) {
    renderer.setSize(W, H, false);
    U.uRes.value.set(W * DPR, H * DPR);
    U.uPx.value = DPR;
  }
  dirty = true;
}

/* ripples, in css px and seconds */
let ripIx = 0;
function ripple(x, y, amp) {
  if (reduceMotion || !renderer) return;
  U.uRip.value[ripIx++ % RIPPLES].set(x, y, U.uTime.value, amp);
}

/* ============================================================
   Teas, tools, hints
   ============================================================ */

let teaIx = 0;
let cycle = 0;           // 0 ink, 1 pale, 2 clear water
let tool = 'stylus';

function nextColor() {
  const t = TEAS[teaIx];
  const c = [t.ink, t.pale, PAPER][cycle % 3];
  cycle++;
  teaButtons[teaIx].dataset.next = String(cycle % 3);
  return c;
}

function setTea(i) {
  teaIx = i;
  cycle = 0;
  teaButtons.forEach((b, k) => {
    b.setAttribute('aria-pressed', String(k === i));
    b.dataset.next = '0';
  });
  document.documentElement.style.setProperty('--active', TEAS[i].ink);
  $('#tea-detail').textContent = TEAS[i].detail;
}
teaButtons.forEach((b, i) => b.addEventListener('click', () => { setTea(i); lastAction = performance.now(); }));
setTea(0);

const toolButtons = { stylus: $('#tool-stylus'), comb: $('#tool-comb') };
function setTool(name) {
  tool = name;
  lastAction = performance.now();
  for (const [k, b] of Object.entries(toolButtons)) b.setAttribute('aria-pressed', String(k === name));
}
toolButtons.stylus.addEventListener('click', () => setTool('stylus'));
toolButtons.comb.addEventListener('click', () => setTool('comb'));

const HINTS = [
  isSmall() || coarse ? 'tap the water to float ink · hold for a larger drop' : 'click the water to float ink · hold for a larger drop',
  'now draw through it — with the stylus, or the comb',
  'when it pleases you, take a print',
];
let hintStep = 0;
whisper.textContent = HINTS[0];
function advanceHint(step) {
  if (step !== hintStep) return;
  hintStep++;
  whisper.classList.add('out');
  if (hintStep < HINTS.length) {
    setTimeout(() => { whisper.textContent = HINTS[hintStep]; whisper.classList.remove('out'); }, reduceMotion ? 0 : 700);
  }
}

/* ============================================================
   Input: drops, strokes, the nib
   ============================================================ */

const focusCenter = () => (isSmall() ? [W / 2, H * 0.42] : [Math.max(W * 0.36, (W - 22 * 16) / 2 + 30), H * 0.48]);
const sizeScale = () => THREE.MathUtils.clamp(Math.min(W, H) / 900, 0.72, 1.2);

let lastAction = performance.now();
let busy = false;
const strokeQueue = [];   // [ax, ay, bx, by, tines] steps waiting for the next frame
const press = { on: false, id: -1, x: 0, y: 0, lx: 0, ly: 0, moved: 0, t0: 0, r: 0, travel: 0 };

function queueStroke(ax, ay, bx, by) {
  const L = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(L / 7));
  const comb = tool === 'comb';
  for (let s = 0; s < steps; s++) {
    strokeQueue.push(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps,
      ax + ((bx - ax) * (s + 1)) / steps, ay + ((by - ay) * (s + 1)) / steps, comb ? 7 : 1);
  }
}

function userDrop(x, y, r) {
  addDrop(x, y, r, nextColor());
  ripple(x, y, Math.min(1.6, r / 30));
  lastAction = performance.now();
  advanceHint(0);
}

canvas.addEventListener('pointerdown', (e) => {
  if (busy || stilling || press.on) return;
  canvas.setPointerCapture(e.pointerId);
  Object.assign(press, { on: true, id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, t0: performance.now(), r: 0, travel: 0 });
  nibShown = false;
});
let hoverTravel = 0, hx = 0, hy = 0;
canvas.addEventListener('pointermove', (e) => {
  U.uLight.value.set(e.clientX / W, 1 - e.clientY / H);
  if (!press.on && e.pointerType === 'mouse') {
    // a hand passing over the basin leaves the faintest wake
    hoverTravel += Math.hypot(e.clientX - hx, e.clientY - hy);
    hx = e.clientX; hy = e.clientY;
    if (hoverTravel > 160) { hoverTravel = 0; ripple(e.clientX, e.clientY, 0.12); }
  }
  if (!press.on || e.pointerId !== press.id) return;
  const dx = e.clientX - press.lx, dy = e.clientY - press.ly;
  press.moved += Math.hypot(dx, dy);
  if (press.moved > 7) {
    queueStroke(press.lx, press.ly, e.clientX, e.clientY);
    press.travel += Math.hypot(dx, dy);
    if (press.travel > 90) { press.travel = 0; ripple(e.clientX, e.clientY, 0.35); }
    press.r = 0;
    lastAction = performance.now();
  }
  press.lx = e.clientX; press.ly = e.clientY;
});
function endPress(e) {
  if (!press.on || e.pointerId !== press.id) return;
  press.on = false;
  if (e.type === 'pointercancel') return;
  if (press.moved <= 7) {
    const held = press.r > 0 ? press.r : (24 + Math.random() * 16) * sizeScale();
    userDrop(press.x, press.y, held);
  } else if (hintStep === 1) advanceHint(1);
}
canvas.addEventListener('pointerup', endPress);
canvas.addEventListener('pointercancel', endPress);

/* the keyboard nib */
let nib = null;
let nibShown = false;
canvas.addEventListener('keydown', (e) => {
  if (busy) return;
  if (!nib) nib = focusCenter();
  const step = 26;
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (dirs[e.key]) {
    e.preventDefault();
    const [dx, dy] = dirs[e.key];
    const nx = THREE.MathUtils.clamp(nib[0] + dx * step, 8, W - 8), ny = THREE.MathUtils.clamp(nib[1] + dy * step, 8, H - 8);
    if (!e.shiftKey) { queueStroke(nib[0], nib[1], nx, ny); if (hintStep === 1) advanceHint(1); }
    nib = [nx, ny];
    nibShown = true;
    lastAction = performance.now();
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    userDrop(nib[0], nib[1], (e.shiftKey ? 70 : 34) * sizeScale());
    nibShown = true;
  }
});
canvas.addEventListener('focus', () => { if (!nib) nib = focusCenter(); });
canvas.addEventListener('blur', () => { nibShown = false; });

/* ============================================================
   The house pours: an overture, then patience
   ============================================================ */

const timeline = [];   // { at: ms since start, run() }
let tlStart = 0;

function concentric(ops, at, x, y, radii, colors, gapMs) {
  radii.forEach((r, i) => ops.push({ at: at + i * gapMs, run: () => { addDrop(x, y, r, colors[i % colors.length]); ripple(x, y, r / 40); } }));
  return at + radii.length * gapMs;
}
function strokeOps(ops, at, pts, ms, tines) {
  // pts: polyline; spread its steps over ms
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 7));
    for (let s = 0; s < n; s++) segs.push([ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n, ax + ((bx - ax) * (s + 1)) / n, ay + ((by - ay) * (s + 1)) / n]);
  }
  segs.forEach((g, i) => ops.push({ at: at + (i / segs.length) * ms, run: () => strokeQueue.push(g[0], g[1], g[2], g[3], tines) }));
  return at + ms;
}

function overture() {
  const [cx, cy] = focusCenter();
  const s = sizeScale();
  const fw = isSmall() ? W * 0.9 : Math.min(W * 0.62, 900), fh = isSmall() ? H * 0.5 : H * 0.7;
  const ops = [];
  const tea = (i) => TEAS[i % TEAS.length];
  const set = (t) => [t.ink, t.pale, PAPER];
  const variant = Math.floor(Math.random() * 3);
  const second = 1 + Math.floor(Math.random() * 3);
  let at = 250;
  if (variant === 0) {
    // three ringed stones, then a comb drawn down and back: chevrons
    const spots = [[-0.28, -0.12], [0.26, 0.08], [-0.02, 0.3]];
    spots.forEach(([fx, fy], k) => {
      at = concentric(ops, at, cx + fx * fw, cy + fy * fh, [64, 42, 54, 32, 46, 24, 36, 18].map((r) => r * s), set(tea(k === 1 ? second : 0)), 90);
    });
    at += 300;
    for (let k = -2; k <= 2; k++) {
      const x = cx + k * fw * 0.17, dir = k % 2 ? 1 : -1;
      at = strokeOps(ops, at, [[x, cy - dir * fh * 0.62], [x, cy + dir * fh * 0.62]], 420, 1);
    }
  } else if (variant === 1) {
    // stone: drops packed until they press each other into polygons
    const colors = [tea(0).ink, tea(second).pale, tea(0).pale, tea(second).ink, PAPER];
    const N = isSmall() ? 46 : 64;
    for (let i = 0; i < N; i++) {
      const x = cx + (Math.random() - 0.5) * fw * 0.95, y = cy + (Math.random() - 0.5) * fh * 0.9;
      const r = (32 + Math.random() * 32) * s;
      ops.push({ at: at + i * 38, run: () => { addDrop(x, y, r, colors[i % colors.length]); ripple(x, y, r / 50); } });
    }
    at += N * 38 + 300;
    at = strokeOps(ops, at, [[cx - fw * 0.7, cy - fh * 0.2], [cx - fw * 0.2, cy + fh * 0.05], [cx + fw * 0.25, cy - fh * 0.1], [cx + fw * 0.7, cy + fh * 0.15]], 1300, 1);
  } else {
    // nonpareil: a ringed field combed across, then back
    const spots = [[-0.3, -0.2], [0.05, -0.25], [0.32, -0.05], [-0.18, 0.18], [0.18, 0.26]];
    spots.forEach(([fx, fy], k) => {
      at = concentric(ops, at, cx + fx * fw, cy + fy * fh, [50, 32, 42, 22, 30].map((r) => r * s), set(tea(k % 2 ? second : 0)), 70);
    });
    at += 250;
    at = strokeOps(ops, at, [[cx - fw * 0.75, cy - fh * 0.08], [cx + fw * 0.75, cy - fh * 0.08]], 1100, 7);
    at = strokeOps(ops, at + 120, [[cx + fw * 0.75, cy + fh * 0.12], [cx - fw * 0.75, cy + fh * 0.12]], 1100, 7);
  }
  if (reduceMotion) {
    ops.forEach((o) => o.run());
    flushStrokes();
    resample();
  } else {
    timeline.push(...ops);
    timeline.sort((a, b) => a.at - b.at);
    tlStart = performance.now();
  }
}

function ambient() {
  const [cx, cy] = focusCenter();
  const fw = isSmall() ? W * 0.8 : Math.min(W * 0.55, 820), fh = isSmall() ? H * 0.45 : H * 0.6;
  const s = sizeScale();
  const x = cx + (Math.random() - 0.5) * fw, y = cy + (Math.random() - 0.5) * fh;
  const t = TEAS[teaIx];
  const ops = [];
  if (Math.random() < 0.7) concentric(ops, 0, x, y, [40, 26, 32, 18].map((r) => r * s), [t.ink, t.pale, PAPER], 140);
  else {
    const a = Math.random() * Math.PI * 2, L = Math.min(W, H) * 0.35;
    strokeOps(ops, 0, [[x - Math.cos(a) * L, y - Math.sin(a) * L], [x + Math.cos(a) * L, y + Math.sin(a) * L]], 1500, 1);
  }
  const now = performance.now() - tlStart;
  ops.forEach((o) => { o.at += now; timeline.push(o); });
  timeline.sort((a, b) => a.at - b.at);
}

function flushStrokes() {
  for (let i = 0; i < strokeQueue.length; i += 5) {
    const n = strokeQueue[i + 4];
    stroke(strokeQueue[i], strokeQueue[i + 1], strokeQueue[i + 2], strokeQueue[i + 3], n, n > 1 ? 30 * sizeScale() : 0);
  }
  strokeQueue.length = 0;
}

/* ============================================================
   Still the water, and take a print
   ============================================================ */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let stilling = 0;

$('#still').addEventListener('click', () => {
  if (busy) return;
  timeline.length = 0;
  strokeQueue.length = 0;
  lastAction = performance.now() + 6000;   // let the water rest before the house pours again
  if (reduceMotion) { drops.length = 0; dirty = true; return; }
  stilling = 1;
  const [cx, cy] = focusCenter();
  ripple(cx, cy, 1.2);
});

let printNo = 0;
const prints = [];
const trayList = $('#tray-list');

function pullPrint() {
  const pw = Math.round(Math.min(2000, W * DPR)), ph = Math.round((pw * H) / W);
  const out = document.createElement('canvas');
  out.width = pw; out.height = ph;
  const o = out.getContext('2d');
  paintInk();
  if (renderer) {
    inkTex.needsUpdate = true;
    const rt = new THREE.WebGLRenderTarget(pw, ph, { depthBuffer: false });
    const keepRes = U.uRes.value.clone(), keepPx = U.uPx.value;
    U.uPrint.value = 1; U.uRes.value.set(pw, ph); U.uPx.value = pw / W;
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    const buf = new Uint8Array(pw * ph * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, pw, ph, buf);
    renderer.setRenderTarget(null);
    rt.dispose();
    U.uPrint.value = 0; U.uRes.value.copy(keepRes); U.uPx.value = keepPx;
    const tmp = document.createElement('canvas');
    tmp.width = pw; tmp.height = ph;
    tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf.buffer), pw, ph), 0, 0);
    // GL rows run bottom-up; turning them over and mirroring is one transform
    o.setTransform(-1, 0, 0, -1, pw, ph);
    o.drawImage(tmp, 0, 0);
  } else {
    o.setTransform(-1, 0, 0, 1, pw, 0);
    o.drawImage(ink, 0, 0, pw, ph);
  }
  const tw = 320, th = Math.round((tw * ph) / pw);
  const t = document.createElement('canvas');
  t.width = tw; t.height = th;
  t.getContext('2d').drawImage(out, 0, 0, tw, th);
  return { full: out.toDataURL('image/jpeg', 0.92), thumb: t.toDataURL('image/jpeg', 0.85), w: pw, h: ph };
}

function addToTray(pr) {
  $('#tray').hidden = false;
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'thumb';
  b.style.setProperty('--tilt', `${(Math.random() - 0.5) * 6}deg`);
  const img = new Image();
  img.src = pr.thumb;
  img.alt = '';
  const label = document.createElement('span');
  label.textContent = String(pr.no).padStart(2, '0');
  b.setAttribute('aria-label', `Open print ${pr.no}, ${pr.tea}`);
  b.append(img, label);
  b.addEventListener('click', () => openViewer(pr, b));
  li.append(b);
  trayList.append(li);
}

const viewer = $('#viewer');
let viewerReturn = null;
function openViewer(pr, from) {
  viewerReturn = from;
  $('#viewer-img').src = pr.full;
  $('#viewer-img').alt = `Marbled print ${pr.no} in ${pr.tea} ink, mirrored as it came off the water`;
  $('#viewer-title').textContent = `Print Nº ${String(pr.no).padStart(2, '0')} · ${pr.tea}`;
  $('#viewer-meta').textContent = `pulled at ${pr.time} · mirrored, as every true print is`;
  const save = $('#viewer-save');
  save.href = pr.full;
  save.download = `suminaga-print-${String(pr.no).padStart(2, '0')}.jpg`;
  if (viewer.showModal) viewer.showModal(); else viewer.setAttribute('open', '');
}
$('#viewer-close').addEventListener('click', () => viewer.close());
viewer.addEventListener('close', () => { if (viewerReturn) viewerReturn.focus(); });
viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.close(); });

$('#print').addEventListener('click', async () => {
  if (busy) return;
  if (!drops.length) { statusEl.textContent = 'The water is clear. Float some ink first.'; whisper.textContent = 'the water is clear — float some ink first'; whisper.classList.remove('out'); return; }
  busy = true;
  bench.classList.add('busy');
  timeline.length = 0;
  flushStrokes();
  resample();
  const pr = pullPrint();
  pr.no = ++printNo;
  pr.tea = TEAS[teaIx].name;
  pr.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  prints.push(pr);
  const sheet = $('#sheet');
  if (reduceMotion) {
    drops.length = 0;
    dirty = true;
    addToTray(pr);
  } else {
    $('#sheet-img').src = pr.full;
    sheet.classList.add('on');
    await wait(30);
    sheet.classList.add('lower');
    await wait(1050);
    drops.length = 0;            // the paper lifts the ink off the water
    dirty = true;
    await wait(250);
    sheet.classList.add('turn');
    await wait(1700);
    $('#tray').hidden = false;
    const tr = trayList.lastElementChild ? trayList.lastElementChild.getBoundingClientRect() : $('#tray').getBoundingClientRect();
    const sr = sheet.getBoundingClientRect();
    sheet.style.setProperty('--tx', `${tr.right + 30 - (sr.left + sr.width / 2)}px`);
    sheet.style.setProperty('--ty', `${tr.top + 20 - (sr.top + sr.height * 0.04)}px`);
    sheet.classList.add('away');
    await wait(800);
    addToTray(pr);
    sheet.classList.remove('on', 'lower', 'turn', 'away');
  }
  statusEl.textContent = `Print ${pr.no} added to your prints.`;
  if (!reduceMotion) setTimeout(() => { if (!drops.length && !busy) ambient(); }, 1400);
  if (hintStep === 2) advanceHint(2);
  busy = false;
  bench.classList.remove('busy');
  lastAction = performance.now();
});

/* ============================================================
   Loop
   ============================================================ */

window.addEventListener('resize', () => {
  const nw = window.innerWidth, nh = window.innerHeight;
  const sx = (nw - W) / 2, sy = (nh - H) / 2;
  for (const d of drops) {
    for (let i = 0; i < d.p.length; i += 2) { d.p[i] += sx; d.p[i + 1] += sy; }
    bbox(d);
  }
  if (nib) nib = [nib[0] + sx, nib[1] + sy];
  W = nw; H = nh;
  sizeAll();
});

sizeAll();
overture();

let last = performance.now();
let frameNo = 0;
let idleNext = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frameNo++;
  if (!reduceMotion) U.uTime.value += dt;

  // the overture and the house's own pours
  const tl = now - tlStart;
  while (timeline.length && timeline[0].at <= tl) timeline.shift().run();
  if (strokeQueue.length) flushStrokes();

  if (!reduceMotion && !busy) {
    const [cx, cy] = focusCenter();
    swirl(dt, cx, cy);
    if (!press.on && now - lastAction > 11000 && now > idleNext && !timeline.length && drops.length < MAX_DROPS - 12) {
      ambient();
      idleNext = now + 7000;
    }
  }

  // fades: dissolving old rings, or the whole basin being stilled
  if (stilling) {
    stilling = Math.max(0, stilling - dt / 0.9);
    for (const d of drops) d.a = stilling;
    if (stilling === 0) drops.length = 0;
    dirty = true;
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    if (!d.fade) continue;
    d.a -= dt / 1.4;
    dirty = true;
    if (d.a <= 0) drops.splice(i, 1);
  }

  if (needsResample || frameNo % 15 === 0) resample();
  if (frameNo % 20 === 0) cull();

  // a press that lingers grows into a larger drop
  let holdA = 0;
  if (press.on && press.moved <= 7) {
    const held = (now - press.t0) / 1000;
    if (held > 0.18) {
      press.r = (26 + Math.min(1, (held - 0.18) / 1.3) ** 0.8 * 92) * sizeScale();
      U.uHold.value.set(press.x, press.y, press.r, 1);
      holdA = 1;
    }
  } else if (nibShown && nib && document.activeElement === canvas) {
    U.uHold.value.set(nib[0], nib[1], 9, 0.8);
    holdA = 0.8;
  }
  if (!holdA) U.uHold.value.w = 0;

  const animating = !reduceMotion || holdA > 0;
  if (renderer) {
    if (dirty) { paintInk(); inkTex.needsUpdate = true; }
    if (dirty || animating) renderer.render(scene, cam);
  } else if (dirty) {
    paintInk();
  }
  dirty = false;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
