import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ============================================================
   VERTEX — a sheet set that drafts itself
   Every line is a fat segment with its own time window, so the
   pen visibly travels along it. Closed solids underneath do the
   hidden-line removal, give the buildings mass, and get hatched
   where a plan or section plane cuts them.
   ============================================================ */

const canvas = document.getElementById('drawing');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const isSmall = () => window.innerWidth <= 880;
const HIGH = !(isSmall() || coarse || (navigator.hardwareConcurrency || 8) <= 4);

/* ---------- DOM ---------- */

const $ = (s) => document.querySelector(s);
const annoEls = {
  height: $('#anno-height .anno-val'),
  floors: $('#anno-floors .anno-val'),
  area: $('#anno-area .anno-val'),
  status: $('#anno-status .anno-val'),
};
const tbProject = $('#tb-project');
const tbSheet = $('#tb-sheet');
const tbScale = $('#tb-scale');
const tbRev = $('#tb-rev');
const sheetTag = $('#sheet-tag');
const siteNote = $('#site-note');
const live = $('#live');
const hint = $('#hint');
const designButtons = [...document.querySelectorAll('.dwg')];
const viewButtons = [...document.querySelectorAll('.view')];
const penButton = $('#pen');
const replayButton = $('#replay');
const clearButton = $('#clear');

/* ============================================================
   Project data
   ============================================================ */

const VIEW_NAMES = { axo: 'AXONOMETRIC', plan: 'PLAN', section: 'SECTION' };
const VIEW_SHORT = { axo: 'AXO', plan: 'PLAN', section: 'SECT' };

const DESIGNS = [
  {
    name: 'MERIDIAN TOWER', no: 'A-10', scale: '1 : 1000 @ A1', rev: 'REV P2',
    height: 182, heightLabel: (v) => `${Math.round(v)} m`, floors: 38, gfa: 42600, status: 'CONCEPT',
    note: '“the client asked for a landmark.<br>we asked the site first.”',
    planName: 'PLAN · L12', sectionName: 'SECTION A–A',
    build: buildTower, text: 4.4, dash: [2.2, 1.6], cutY: 66, cutZ: 0.05,
  },
  {
    name: 'COURTYARD PAVILION', no: 'A-20', scale: '1 : 200 @ A1', rev: 'REV C1',
    height: 6.3, heightLabel: (v) => `${v.toFixed(1)} m`, floors: 1, gfa: 1240, status: 'DESIGN DEV',
    note: '“one roof, thirty columns,<br>and a tree that was here first.”',
    planName: 'PLAN · +1.6', sectionName: 'SECTION B–B',
    build: buildPavilion, text: 1.15, dash: [0.6, 0.42], cutY: 1.9, cutZ: 0.3,
  },
  {
    name: 'THE CIRCLE ARCHIVE', no: 'A-30', scale: '1 : 250 @ A1', rev: 'REV K3',
    height: 34, heightLabel: (v) => `${Math.round(v)} m`, floors: 6, gfa: 5800, status: 'COMPETITION',
    note: '“every shelf faces the void.<br>you read by walking downhill.”',
    planName: 'PLAN · +12.0', sectionName: 'SECTION C–C',
    build: buildArchive, text: 1.7, dash: [0.9, 0.62], cutY: 12, cutZ: 0.05,
  },
];

/* ============================================================
   Sheet builder: collects pen strokes, solids and labels
   ============================================================ */

const PHASES = {
  guide:  { w: [0.00, 0.15], by: 'seq' },
  site:   { w: [0.05, 0.30], by: 'seq' },
  struct: { w: [0.20, 0.80], by: 'key' },
  detail: { w: [0.34, 0.90], by: 'key' },
  dims:   { w: [0.80, 0.95], by: 'seq' },
  red:    { w: [0.93, 1.00], by: 'seq' },
};
const WEIGHTS = ['guide', 'light', 'medium', 'heavy', 'dim', 'datum', 'red'];
const ALL_VIEWS = ['axo', 'plan', 'section'];
const UP = ['axo', 'section'];

// deterministic noise for the hand-drawn redlines
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

class Sheet {
  constructor(design) {
    this.design = design;
    this.lines = Object.fromEntries(WEIGHTS.map((w) => [w, []]));
    this.solids = [];
    this.skins = [];
    this.ground = [];
    this.context = [];
    this.labels = [];
    this.n = 0;
  }

  seg(w, phase, a, b, key) {
    const s = { a, b, phase, key: key ?? Math.min(a[1], b[1]), i: this.n++, t0: 0, t1: 0 };
    this.lines[w].push(s);
    return s;
  }

  poly(w, phase, pts, closed = false, key) {
    let last;
    for (let i = 0; i < pts.length - 1; i++) last = this.seg(w, phase, pts[i], pts[i + 1], key);
    if (closed) last = this.seg(w, phase, pts[pts.length - 1], pts[0], key);
    return last;
  }

  rect(w, phase, cx, cz, sx, sz, y, rot = 0, key) {
    const hx = sx / 2, hz = sz / 2;
    const pts = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => {
      const [rx, rz] = rot2(x, z, rot);
      return [cx + rx, y, cz + rz];
    });
    return this.poly(w, phase, pts, true, key);
  }

  tree(cx, cz, r, phase = 'site') {
    const pts = [];
    const lobes = 9 + Math.round(r);
    for (let i = 0; i <= lobes * 4; i++) {
      const a = (i / (lobes * 4)) * Math.PI * 2;
      const k = 1 + 0.09 * Math.abs(Math.sin((a * lobes) / 2)) + (rand() - 0.5) * 0.03;
      pts.push([cx + Math.cos(a) * r * k, 0.02, cz + Math.sin(a) * r * k]);
    }
    this.poly('light', phase, pts);
    this.circle('light', phase, cx, cz, r * 0.12, 0.02, 8);
  }

  circle(w, phase, cx, cz, r, y, n = 48, a0 = 0, a1 = Math.PI * 2, key) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = a0 + (a1 - a0) * (i / n);
      pts.push([cx + Math.cos(t) * r, y, cz + Math.sin(t) * r]);
    }
    return this.poly(w, phase, pts, false, key);
  }

  /* a dimension string between a and b, offset along `off`, with
     architectural 45° ticks, extension lines and its number */
  dim(a, b, off, text, { ext = true, labelOffset = 1.3, rotate = 0, views = ALL_VIEWS } = {}) {
    const A = add(a, off), B = add(b, off);
    const d = norm(sub(B, A));
    const o = norm(off);
    const k = this.design.text * 0.55;
    if (ext) {
      this.seg('light', 'dims', add(a, scale(o, k * 0.6)), add(A, scale(o, k * 0.8)));
      this.seg('light', 'dims', add(b, scale(o, k * 0.6)), add(B, scale(o, k * 0.8)));
    }
    const line = this.seg('dim', 'dims', add(A, scale(d, -k * 0.7)), add(B, scale(d, k * 0.7)));
    const tick = scale(norm(add(d, o)), k * 0.75);
    this.seg('heavy', 'dims', sub(A, tick), add(A, tick));
    const last = this.seg('heavy', 'dims', sub(B, tick), add(B, tick));
    const vertical = Math.abs(d[1]) > 0.9;
    const mid = add(scale(add(A, B), 0.5), scale(o, this.design.text * labelOffset * (vertical ? 0.42 : 0.55)));
    this.label(text, mid, { after: last, rotate: vertical ? Math.PI / 2 : rotate, views });
    return line;
  }

  /* an elevation datum: open triangle on a leader, with its level */
  level(x, y, z, dir, text) {
    const k = this.design.text * 0.55;
    const p = [x, y, z];
    const lead = add(p, scale(dir, k * 7));
    this.seg('datum', 'dims', p, lead);
    const tip = add(lead, scale(dir, k * 0.6));
    const left = add(add(tip, [0, k * 0.95, 0]), scale(dir, -k * 0.6));
    const right = add(add(tip, [0, k * 0.95, 0]), scale(dir, k * 0.6));
    this.seg('datum', 'dims', tip, left);
    this.seg('datum', 'dims', left, right);
    const last = this.seg('datum', 'dims', right, tip);
    this.label(text, add(add(tip, scale(dir, k * 1.4)), [0, k * 0.5, 0]), { after: last, align: 'left', views: ['section'] });
  }

  /* gridline with a lettered bubble at one end (both on the ground) */
  gridline(a, b, letter) {
    const r = this.design.text * 0.62;
    this.seg('guide', 'guide', a, b);
    const d = norm(sub(b, a));
    const c = add(b, scale(d, r));
    const last = this.circle('light', 'guide', c[0], c[2], r, 0.02, 24);
    this.label(letter, [c[0], 0.05, c[2]], { after: last, size: 1.05, weight: 600, views: ['axo', 'plan'] });
  }

  northArrow(x, z) {
    const r = this.design.text * 1.1;
    this.circle('light', 'dims', x, z, r, 0.02, 32);
    this.seg('medium', 'dims', [x, 0.02, z + r * 0.8], [x, 0.02, z - r * 1.35]);
    this.seg('medium', 'dims', [x - r * 0.42, 0.02, z - r * 0.65], [x, 0.02, z - r * 1.35]);
    const last = this.seg('medium', 'dims', [x + r * 0.42, 0.02, z - r * 0.65], [x, 0.02, z - r * 1.35]);
    this.label('N', [x, 0.05, z - r * 1.95], { after: last, weight: 600, views: ['axo', 'plan'] });
  }

  /* graphic scale: alternating blocks along x on the ground */
  scaleBar(x, z, unit, count, label) {
    const k = this.design.text * 0.32;
    for (let i = 0; i < count; i++) {
      const x0 = x + i * unit, x1 = x0 + unit;
      this.seg('dim', 'dims', [x0, 0.03, z], [x1, 0.03, z]);
      this.seg('dim', 'dims', [x0, 0.03, z + k], [x1, 0.03, z + k]);
      if (i % 2 === 0) for (let j = 1; j < 4; j++) this.seg('light', 'dims', [x0, 0.03, z + (k * j) / 4], [x1, 0.03, z + (k * j) / 4]);
      this.seg('dim', 'dims', [x0, 0.03, z - k * 0.4], [x0, 0.03, z + k]);
    }
    const last = this.seg('dim', 'dims', [x + unit * count, 0.03, z - k * 0.4], [x + unit * count, 0.03, z + k]);
    this.label('0', [x, 0.05, z - k * 2.6], { after: last, views: ['axo', 'plan'] });
    this.label(label, [x + unit * count, 0.05, z - k * 2.6], { after: last, views: ['axo', 'plan'] });
  }

  /* section marker: heavy cut stub, arrow pointing in the view direction, bubble */
  sectionMark(x, z, letter, look) {
    const k = this.design.text;
    this.seg('heavy', 'dims', [x - k * 0.9, 0.03, z], [x + k * 0.9, 0.03, z]);
    const tip = [x, 0.03, z + look * k * 1.2];
    this.seg('heavy', 'dims', [x - k * 0.45, 0.03, z + look * k * 0.55], tip);
    this.seg('heavy', 'dims', [x + k * 0.45, 0.03, z + look * k * 0.55], tip);
    const r = k * 0.62;
    const cx = x + (x > 0 ? 1 : -1) * k * 1.7;
    const last = this.circle('medium', 'dims', cx, z, r, 0.03, 24);
    this.label(letter, [cx, 0.06, z], { after: last, weight: 600, views: ['axo', 'plan'] });
  }

  /* a revision cloud: scalloped loop in the plane spanned by u and v */
  cloud(center, u, v, rx, ry, scallops = 16) {
    const pts = [];
    for (let i = 0; i < scallops; i++) {
      const a0 = (i / scallops) * Math.PI * 2, a1 = ((i + 1) / scallops) * Math.PI * 2;
      for (let j = 0; j < 7; j++) {
        const t = j / 7;
        const a = a0 + (a1 - a0) * t;
        const bulge = 1 + Math.sin(t * Math.PI) * 0.16 + (rand() - 0.5) * 0.02;
        pts.push(add(center, add(scale(u, Math.cos(a) * rx * bulge), scale(v, Math.sin(a) * ry * bulge))));
      }
    }
    // overshoot the close like a real pen
    pts.push(add(center, add(scale(u, rx * 1.03), scale(v, ry * 0.12))));
    return this.poly('red', 'red', pts);
  }

  /* hand-wobbled straight stroke */
  scrawl(a, b, n = 8) {
    const pts = [];
    const L = len(sub(b, a));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = add(a, scale(sub(b, a), t));
      pts.push(add(p, [(rand() - 0.5) * L * 0.012, (rand() - 0.5) * L * 0.012, (rand() - 0.5) * L * 0.012]));
    }
    return this.poly('red', 'red', pts);
  }

  label(text, pos, opts = {}) {
    this.labels.push({ text, pos, views: opts.kind === 'note' ? ['axo'] : ALL_VIEWS, ...opts });
  }

  /* assign each stroke its time window inside its phase */
  schedule() {
    const byPhase = {};
    for (const w of WEIGHTS) for (const s of this.lines[w]) (byPhase[s.phase] ||= []).push(s);
    for (const [name, list] of Object.entries(byPhase)) {
      const { w: [w0, w1], by } = PHASES[name];
      const span = w1 - w0;
      if (by === 'seq') {
        // one pen, constant speed: windows follow cumulative length
        list.sort((p, q) => p.i - q.i);
        const lens = list.map((s) => len(sub(s.b, s.a)) + this.design.text * 0.25);
        const total = lens.reduce((p, q) => p + q, 0);
        let acc = 0;
        list.forEach((s, k) => {
          s.t0 = w0 + span * (acc / total);
          acc += lens[k];
          s.t1 = w0 + span * (acc / total);
        });
      } else {
        // many pens rising together, ordered by key (height)
        list.sort((p, q) => p.key - q.key || p.i - q.i);
        const N = list.length;
        const mean = list.reduce((p, s) => p + len(sub(s.b, s.a)), 0) / N;
        list.forEach((s, k) => {
          s.t0 = w0 + span * 0.84 * (N > 1 ? k / (N - 1) : 0);
          const dur = span * 0.16 * THREE.MathUtils.clamp(Math.sqrt(len(sub(s.b, s.a)) / mean), 0.35, 1.6);
          s.t1 = Math.min(w1, s.t0 + dur);
        });
      }
    }
    for (const l of this.labels) l.t = Math.min(l.after ? l.after.t1 : 0.97, 0.97);
  }
}

/* ---------- tiny vector helpers (arrays) ---------- */
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rot2(x, z, a) { const c = Math.cos(a), s = Math.sin(a); return [x * c - z * s, x * s + z * c]; }

/* ---------- solid helpers: closed, outward-facing, non-indexed ---------- */

function clean(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  // flip winding if the signed volume says the normals point inward
  const p = g.attributes.position.array;
  let vol = 0;
  for (let i = 0; i < p.length; i += 9) {
    vol += p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7])
         - p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6])
         + p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6]);
  }
  if (vol < 0) {
    for (let i = 0; i < p.length; i += 9) {
      for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    }
  }
  g.computeVertexNormals();
  return g;
}

function box(cx, cy, cz, sx, sy, sz, rotY = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (rotY) g.rotateY(-rotY);
  g.translate(cx, cy, cz);
  return clean(g);
}

function cylinder(cx, cy, cz, r, h, n = 16) {
  const g = new THREE.CylinderGeometry(r, r, h, n);
  g.translate(cx, cy, cz);
  return clean(g);
}

/* sweep a closed cross-section (array of [x,y,z]) through a list of
   sections; caps the ends unless the sweep loops */
function sweep(sections, loop = false) {
  const pos = [];
  const m = sections[0].length;
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const count = loop ? sections.length : sections.length - 1;
  for (let i = 0; i < count; i++) {
    const A = sections[i], B = sections[(i + 1) % sections.length];
    for (let k = 0; k < m; k++) {
      const k2 = (k + 1) % m;
      quad(A[k], A[k2], B[k2], B[k]);
    }
  }
  if (!loop) {
    const A = sections[0], B = sections[sections.length - 1];
    for (let k = 1; k < m - 1; k++) {
      tri(A[0], A[k + 1], A[k]);
      tri(B[0], B[k], B[k + 1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return clean(g);
}

/* an extruded plan shape (x, z) with one hole, from y0 to y1 */
function plate(outer, hole, y0, y1) {
  const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, z)));
  if (hole) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, z))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.translate(0, y1, 0);
  return clean(g);
}

/* revolve a closed (r, y) profile around the Y axis */
function revolve(profile, n = 64, a0 = 0, a1 = Math.PI * 2) {
  const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
  const sections = [];
  const steps = full ? n : n + 1;
  for (let i = 0; i < steps; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    sections.push(profile.map(([r, y]) => [Math.cos(a) * r, y, Math.sin(a) * r]));
  }
  return sweep(sections, full);
}

/* ============================================================
   DWG-01 — Meridian Tower
   A twisting, tapering diagrid tower on a podium, with core,
   corner columns, crown, canopy and its street.
   ============================================================ */

function buildTower(S) {
  const SW = 96, SD = 84;          // plot
  const PODIUM = 16, TOP = 168, CROWN = 182;
  const FLOORS = 38;
  const lvl = (i) => PODIUM + (i / FLOORS) * (TOP - PODIUM);
  const half = (y) => 17 * (1 - 0.3 * THREE.MathUtils.clamp((y - PODIUM) / (TOP - PODIUM), 0, 1.2));
  const twist = (y) => 0.42 * THREE.MathUtils.clamp((y - PODIUM) / (TOP - PODIUM), 0, 1.2);
  const corner = (k, y) => {
    const h = half(y);
    const [x, z] = rot2([-h, h, h, -h][k], [-h, -h, h, h][k], twist(y));
    return [x, y, z];
  };
  const ring = (y) => [0, 1, 2, 3].map((k) => corner(k, y));
  // corner columns sit just inside the curtain wall
  const colAt = (k, y) => { const c = corner(k, y); const n = norm([-c[0], 0, -c[2]]); return add(c, scale(n, 1.5)); };
  // a floor plate: twisted square with holes for the core and the columns
  const slab = (h, rot, y, col) => {
    const sq = (cx, cz, s, a) => [[-s, -s], [s, -s], [s, s], [-s, s]].map(([x, z]) => { const [rx, rz] = rot2(x, z, a); return new THREE.Vector2(cx + rx, cz + rz); });
    const shape = new THREE.Shape(sq(0, 0, h, rot));
    shape.holes.push(new THREE.Path(sq(0, 0, 6, 0).reverse()));
    for (let k = 0; k < 4; k++) { const c = col(k); shape.holes.push(new THREE.Path(sq(c[0], c[2], 0.8, rot).reverse())); }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    g.translate(0, y, 0);
    return clean(g);
  };
  const onFace = (f, u, y, out = 0) => {
    const a = corner(f, y), b = corner((f + 1) % 4, y);
    const p = lerp3(a, b, u);
    if (!out) return p;
    const n = norm([(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2]);
    return add(p, scale(n, out));
  };

  /* --- construction lines and grid --- */
  for (const k of [0, 1, 2, 3]) {
    const c = corner(k, PODIUM);
    S.seg('guide', 'guide', [c[0], -2, c[2]], [c[0], TOP + 14, c[2]]);
  }
  S.seg('guide', 'guide', [-SW / 2 - 6, PODIUM, 0], [SW / 2 + 6, PODIUM, 0]);
  ['A', 'B', 'C'].forEach((L, i) => S.gridline([-17 + i * 17, 0.02, -SD / 2 + 4], [-17 + i * 17, 0.02, SD / 2 + 4], L));
  ['1', '2', '3'].forEach((L, i) => S.gridline([-SW / 2 + 2, 0.02, -17 + i * 17], [SW / 2 + 4, 0.02, -17 + i * 17], L));

  /* --- site: plot, street, crossing, trees, neighbours --- */
  S.rect('medium', 'site', 0, 0, SW, SD, 0.02);
  S.seg('light', 'site', [-104, 0.02, -SD / 2 - 4], [104, 0.02, -SD / 2 - 4]);
  S.seg('light', 'site', [-104, 0.02, -SD / 2 - 24], [104, 0.02, -SD / 2 - 24]);
  for (let x = -100; x < 100; x += 9) S.seg('guide', 'site', [x, 0.02, -SD / 2 - 14], [x + 4.5, 0.02, -SD / 2 - 14]);
  for (let i = 0; i < 7; i++) S.rect('light', 'site', -34 + i * 2.2, -SD / 2 - 14, 1.1, 14, 0.02);
  for (let x = -60; x <= 60; x += 15) {
    if (Math.abs(x + 27) < 9) continue;
    S.tree(x, -SD / 2 + 3, 3.4);
  }
  const neighbour = (cx, cz, sx, sz, h) => {
    const hx = sx / 2, hz = sz / 2;
    const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 4];
      S.seg('light', 'site', [cx + x0, 0, cz + z0], [cx + x1, 0, cz + z1]);
      S.seg('light', 'site', [cx + x0, h, cz + z0], [cx + x1, h, cz + z1]);
      S.seg('light', 'site', [cx + x0, 0, cz + z0], [cx + x0, h, cz + z0]);
    }
    for (let y = 4; y < h; y += 4) S.rect('guide', 'site', cx, cz, sx, sz, y);
    S.context.push(box(cx, h / 2, cz, sx, h, sz));
  };
  neighbour(-34, -SD / 2 - 48, 44, 30, 42);
  neighbour(34, -SD / 2 - 46, 34, 26, 58);
  S.ground.push(box(0, -3, 0, SW + 90, 6, SD + 90));

  /* --- podium --- */
  const PW = 52, PD = 40;
  S.rect('heavy', 'struct', 0, 0, PW, PD, 0.02, 0, 0);
  for (const y of [5.5, 11]) S.rect('medium', 'struct', 0, 0, PW, PD, y, 0, y);
  S.rect('heavy', 'struct', 0, 0, PW, PD, PODIUM, 0, PODIUM);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    S.seg('heavy', 'struct', [x * PW / 2, 0, z * PD / 2], [x * PW / 2, PODIUM, z * PD / 2], 0);
  }
  S.skins.push(plate([[-PW / 2, -PD / 2], [PW / 2, -PD / 2], [PW / 2, PD / 2], [-PW / 2, PD / 2]], [[-6, -6], [6, -6], [6, 6], [-6, 6]], 0, PODIUM));
  const pIn = [[-PW / 2 + 0.3, -PD / 2 + 0.3], [PW / 2 - 0.3, -PD / 2 + 0.3], [PW / 2 - 0.3, PD / 2 - 0.3], [-PW / 2 + 0.3, PD / 2 - 0.3]];
  for (const y of [5.5, 11, PODIUM]) S.solids.push(plate(pIn, [[-6, -6], [6, -6], [6, 6], [-6, 6]], y - 0.6, y));
  // ground-floor glazing rhythm
  for (let x = -PW / 2 + 3.25; x < PW / 2; x += 3.25) {
    S.seg('light', 'detail', [x, 0, -PD / 2], [x, 5.5, -PD / 2]);
    S.seg('light', 'detail', [x, 0, PD / 2], [x, 5.5, PD / 2]);
  }
  for (let z = -PD / 2 + 3.33; z < PD / 2; z += 3.33) {
    S.seg('light', 'detail', [-PW / 2, 0, z], [-PW / 2, 5.5, z]);
    S.seg('light', 'detail', [PW / 2, 0, z], [PW / 2, 5.5, z]);
  }
  // entrance canopy on the street side
  S.rect('medium', 'detail', -6, -PD / 2 - 4, 22, 8, 6.2, 0, 6.2);
  S.seg('medium', 'detail', [-15, 0, -PD / 2 - 7], [-15, 6.2, -PD / 2 - 7], 0);
  S.seg('medium', 'detail', [3, 0, -PD / 2 - 7], [3, 6.2, -PD / 2 - 7], 0);
  S.solids.push(box(-6, 6.0, -PD / 2 - 4, 22, 0.45, 8));

  /* --- shaft: slabs, corners, diagrid, mullions --- */
  for (let i = 0; i <= FLOORS; i++) {
    const y = lvl(i);
    S.poly(i === 0 || i === FLOORS ? 'heavy' : 'medium', 'struct', ring(y), true, y);
    S.solids.push(slab(half(y) - 0.25, twist(y), y, (k) => colAt(k, y)));
    if (i < FLOORS) {
      const y1 = lvl(i + 1);
      for (let k = 0; k < 4; k++) {
        S.seg('heavy', 'struct', corner(k, y), corner(k, y1), y);
        const c0 = colAt(k, y), c1 = colAt(k, y1);
        S.solids.push(box((c0[0] + c1[0]) / 2, (y + y1) / 2, (c0[2] + c1[2]) / 2, 1.6, y1 - y, 1.6, twist((y + y1) / 2)));
        for (let m = 1; m < 7; m++) S.seg('light', 'detail', onFace(k, m / 7, y, 0.12), onFace(k, m / 7, y1, 0.12), y);
      }
    }
  }
  // skin: the curtain wall as one closed twisted prism
  const rings = [];
  for (let i = 0; i <= FLOORS; i++) rings.push(ring(lvl(i)));
  S.skins.push(sweep(rings));
  // diagrid: diamonds spanning eight floors and half a face
  for (let k = 0; k < FLOORS / 4; k++) {
    const y0 = lvl(k * 4), y1 = lvl(Math.min(FLOORS, k * 4 + 4));
    const us0 = k % 2 === 0 ? [0, 0.5, 1] : [0.25, 0.75];
    for (let f = 0; f < 4; f++) {
      for (const u of us0) {
        for (const du of [-0.25, 0.25]) {
          const u1 = u + du;
          if (u1 < -1e-6 || u1 > 1 + 1e-6) continue;
          S.seg('medium', 'struct', onFace(f, u, y0, 0.4), onFace(f, u1, y1, 0.4), y0 + 0.5);
        }
      }
    }
  }
  // core rises through the crown
  S.solids.push(box(0, (TOP + 6) / 2, 0, 12, TOP + 6, 12));
  S.rect('medium', 'struct', 0, 0, 12, 12, TOP + 6, 0, TOP + 6);
  // crown: corners lean in to an open lantern
  const crownRing = (y, s) => [0, 1, 2, 3].map((k) => {
    const h = half(TOP) * s;
    const [x, z] = rot2([-h, h, h, -h][k], [-h, -h, h, h][k], twist(TOP) + (y - TOP) * 0.012);
    return [x, y, z];
  });
  const r175 = crownRing(175, 0.82), r182 = crownRing(CROWN, 0.56);
  for (let k = 0; k < 4; k++) {
    S.seg('heavy', 'struct', corner(k, TOP), r175[k], TOP);
    S.seg('heavy', 'struct', r175[k], r182[k], 175);
    S.seg('light', 'detail', onFace(k, 0.5, TOP), r182[k], TOP);
  }
  S.poly('medium', 'struct', r175, true, 175);
  S.poly('heavy', 'struct', r182, true, CROWN);
  S.rect('light', 'detail', 0, 0, 5, 5, 174, 0.3, 174);
  S.rect('light', 'detail', 0, 0, 5, 5, 178, 0.3, 178);

  /* --- dimensions and datums --- */
  const dx = -32;
  S.dim([dx, 0, 0], [dx, PODIUM, 0], [-4, 0, 0], '16.0', { ext: false, views: UP });
  S.dim([dx, PODIUM, 0], [dx, TOP, 0], [-4, 0, 0], '152.0', { ext: false, views: UP });
  S.dim([dx, TOP, 0], [dx, CROWN, 0], [-4, 0, 0], '14.0', { ext: false, views: UP });
  S.dim([dx, 0, 0], [dx, CROWN, 0], [-12, 0, 0], '182.0', { ext: false, views: UP });
  S.dim([-SW / 2, 0.02, SD / 2], [SW / 2, 0.02, SD / 2], [0, 0, 9], '96.0', { views: ['axo', 'plan'] });
  S.dim([-SW / 2, 0.02, -SD / 2], [-SW / 2, 0.02, 0], [-9, 0, 0], '42.0', { views: ['axo', 'plan'] });
  S.dim([-SW / 2, 0.02, 0], [-SW / 2, 0.02, SD / 2], [-9, 0, 0], '42.0', { views: ['axo', 'plan'] });
  for (const [y, t] of [[0, '±0.0 GL'], [PODIUM, '+16.0 L03'], [lvl(12), '+64.0 L12'], [lvl(28), '+128.0 L28'], [TOP, '+168.0 RF'], [CROWN, '+182.0']]) {
    S.level(half(y) + 3, y, 0, [1, 0, 0], t);
  }
  S.northArrow(38, -27);
  S.scaleBar(-SW / 2, SD / 2 + 16, 10, 3, '30 m');
  S.sectionMark(-SW / 2 - 21, 0, 'A', -1);
  S.sectionMark(SW / 2 + 18, 0, 'A', -1);

  /* --- redlines --- */
  S.cloud([0, 179, 0], [1, 0, 0], [0, 0, 1], 19, 19, 18);
  S.scrawl([16, 182, 10], [34, 196, 18]);
  S.label('lantern +6 m? check wind', [35, 198, 18], { kind: 'note', after: S.lines.red[S.lines.red.length - 1], align: 'left', anchor: [0, 204, 0] });
  S.poly('red', 'red', [[-27, 186, 0], [-22, 194, 0], [-17, 186, 0]], true);
  S.label('1', [-22, 188.8, 0], { kind: 'note', after: S.lines.red[S.lines.red.length - 1], size: 0.8 });

  return {
    bounds: new THREE.Box3(new THREE.Vector3(-SW / 2 - 30, -6, -SD / 2 - 70), new THREE.Vector3(SW / 2 + 30, CROWN + 16, SD / 2 + 20)),
    frame: new THREE.Box3(new THREE.Vector3(-SW / 2 - 12, 0, -SD / 2 - 6), new THREE.Vector3(SW / 2 + 8, CROWN + 10, SD / 2 + 19)),
    sectionFrame: new THREE.Box3(new THREE.Vector3(-50, -4, -10), new THREE.Vector3(66, CROWN + 12, 10)),
  };
}

/* ============================================================
   DWG-02 — Courtyard Pavilion
   One roof on a colonnade, a glass line set back behind it, a
   courtyard cut through the roof for the tree that was there.
   ============================================================ */

function buildPavilion(S) {
  const PL = 0.6, CEIL = 5.4, ROOF = 6.3;
  const RX = 23, RZ = 16;            // roof half extents
  const CX = 8, CZ = 6;              // courtyard half extents
  const GX = 19.6, GZ = 12.4;        // glass line
  const xs = [-21, -14, -7, 0, 7, 14, 21], zs = [-14, -7, 0, 7, 14];

  /* --- grid --- */
  'ABCDEFG'.split('').forEach((L, i) => S.gridline([xs[i], 0.02, -RZ - 6], [xs[i], 0.02, RZ + 7], L));
  zs.forEach((z, i) => S.gridline([-RX - 7, 0.02, z], [RX + 8, 0.02, z], String(i + 1)));
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) S.seg('guide', 'guide', [x * RX, -0.5, z * RZ], [x * RX, ROOF + 2.5, z * RZ]);

  /* --- site: boundary, plinth, steps, path, pool, trees, contours --- */
  S.rect('medium', 'site', 0, 0, 100, 72, 0.02);
  S.ground.push(box(0, -1.5, 0, 140, 3, 110));
  // plinth
  S.rect('heavy', 'site', 0, 0, 52, 38, PL);
  S.rect('medium', 'site', 0, 0, 52, 38, 0.02);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) S.seg('medium', 'site', [x * 26, 0, z * 19], [x * 26, PL, z * 19]);
  S.solids.push(box(0, PL / 2, 0, 52, PL, 38));
  // steps on the approach
  for (let s = 0; s < 2; s++) {
    const top = PL - (s + 1) * 0.2, z1 = 19 + (s + 1) * 0.45;
    S.seg('medium', 'site', [-5, top, z1], [5, top, z1]);
    S.seg('light', 'site', [-5, top, z1 - 0.45], [-5, top, z1]);
    S.seg('light', 'site', [5, top, z1 - 0.45], [5, top, z1]);
    S.solids.push(box(0, top / 2, z1 - 0.225, 10, top, 0.45));
  }
  S.seg('light', 'site', [-2.4, 0.02, 20.6], [-2.4, 0.02, 36]);
  S.seg('light', 'site', [2.4, 0.02, 20.6], [2.4, 0.02, 36]);
  // reflecting pool
  S.rect('medium', 'site', -37, 4, 12, 22, 0.02);
  S.rect('light', 'site', -37, 4, 10.6, 20.6, 0.02);
  for (let i = 0; i < 5; i++) S.seg('guide', 'site', [-40.5 + i * 0.8, 0.02, -2 + i * 3], [-34 + i * 0.8, 0.02, -1.6 + i * 3]);
  // trees and a gentle contour
  for (const [x, z, r] of [[36, -24, 4.2], [42, -12, 3.4], [-34, -26, 4.6], [38, 22, 3.8], [-30, 28, 3.6]]) S.tree(x, z, r);
  for (const k of [0, 1]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const x = -49 + i * 4;
      pts.push([x, 0.02, -31 + k * 3 + Math.sin(i * 0.5 + k) * 1.6]);
    }
    S.poly('guide', 'site', pts);
  }

  /* --- colonnade (square steel columns) --- */
  for (const x of xs) {
    for (const z of zs) {
      if (Math.abs(x) < CX && Math.abs(z) < CZ) continue;
      const h = 0.22;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        S.seg('medium', 'struct', [x + sx * h, PL, z + sz * h], [x + sx * h, CEIL, z + sz * h], PL);
      }
      S.rect('light', 'detail', x, z, 0.9, 0.9, PL + 0.01, 0, PL);
      S.solids.push(box(x, (PL + CEIL) / 2, z, h * 2, CEIL - PL, h * 2));
    }
  }

  /* --- roof slab with its courtyard cut --- */
  const shape = new THREE.Shape([[-RX, -RZ], [RX, -RZ], [RX, RZ], [-RX, RZ]].map(([x, z]) => new THREE.Vector2(x, z)));
  shape.holes.push(new THREE.Path([[-CX, -CZ], [-CX, CZ], [CX, CZ], [CX, -CZ]].map(([x, z]) => new THREE.Vector2(x, z))));
  const roof = new THREE.ExtrudeGeometry(shape, { depth: ROOF - CEIL, bevelEnabled: false });
  roof.rotateX(Math.PI / 2);
  roof.translate(0, ROOF, 0);
  S.solids.push(clean(roof));
  for (const y of [CEIL, ROOF]) {
    S.rect('heavy', 'struct', 0, 0, RX * 2, RZ * 2, y, 0, y);
    S.rect('medium', 'struct', 0, 0, CX * 2, CZ * 2, y, 0, y);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    S.seg('heavy', 'struct', [x * RX, CEIL, z * RZ], [x * RX, ROOF, z * RZ], CEIL);
    S.seg('medium', 'struct', [x * CX, CEIL, z * CZ], [x * CX, ROOF, z * CZ], CEIL);
  }
  // fascia reveal
  S.rect('light', 'detail', 0, 0, RX * 2, RZ * 2, CEIL + 0.3, 0, CEIL);

  /* --- glass line: perimeter and courtyard, with mullions --- */
  for (const [hx, hz] of [[GX, GZ], [CX - 0.6, CZ - 0.6]]) {
    S.rect('medium', 'detail', 0, 0, hx * 2, hz * 2, PL + 0.02, 0, PL);
    S.rect('light', 'detail', 0, 0, hx * 2, hz * 2, CEIL - 0.02, 0, CEIL);
    const step = 2.8;
    for (let x = -hx; x <= hx + 1e-6; x += (hx * 2) / Math.round((hx * 2) / step)) {
      S.seg('light', 'detail', [x, PL, -hz], [x, CEIL, -hz], PL + 0.1);
      S.seg('light', 'detail', [x, PL, hz], [x, CEIL, hz], PL + 0.1);
    }
    for (let z = -hz; z <= hz + 1e-6; z += (hz * 2) / Math.round((hz * 2) / step)) {
      S.seg('light', 'detail', [-hx, PL, z], [-hx, CEIL, z], PL + 0.1);
      S.seg('light', 'detail', [hx, PL, z], [hx, CEIL, z], PL + 0.1);
    }
  }
  // a service core inside the glass
  S.rect('medium', 'detail', -13, -7.5, 6, 3.4, PL + 0.02, 0, PL);
  S.solids.push(box(-13, (PL + CEIL) / 2, -7.5, 6, CEIL - PL, 3.4));
  for (const [x, z] of [[-16, -9.2], [-10, -9.2], [-10, -5.8], [-16, -5.8]]) S.seg('light', 'detail', [x, PL, z], [x, CEIL, z], PL + 0.2);
  S.rect('light', 'detail', -13, -7.5, 6, 3.4, CEIL - 0.02, 0, CEIL);

  /* --- courtyard: paving and the tree --- */
  for (let x = -CX + 1.2; x < CX; x += 1.6) S.seg('guide', 'detail', [x, PL + 0.02, -CZ + 0.6], [x, PL + 0.02, CZ - 0.6], PL);
  S.circle('light', 'detail', 0, 0, 1.3, PL + 0.02, 20, 0, Math.PI * 2, PL);
  seed = 11;
  (function branch(p, dir, l, depth) {
    const q = add(p, scale(dir, l));
    S.seg(depth > 3 ? 'heavy' : 'medium', 'struct', p, q, p[1] + 0.5);
    if (depth === 0) return;
    const spread = 0.55 + rand() * 0.25;
    for (const side of [-1, 1]) {
      const a = side * spread + (rand() - 0.5) * 0.4;
      const b = rand() * Math.PI * 2;
      const nd = norm(add(dir, [Math.cos(b) * Math.sin(a), 0, Math.sin(b) * Math.sin(a)]));
      branch(q, nd, l * (0.68 + rand() * 0.1), depth - 1);
    }
    if (depth === 4) branch(q, norm(add(dir, [0.2, 0.3, -0.3])), l * 0.6, depth - 2);
  })([0, PL, 0], [0, 1, 0], 2.6, 5);
  S.circle('guide', 'detail', 0, 0, 5.4, 7.2, 36, 0, Math.PI * 2, 7);

  /* --- dimensions and datums --- */
  S.dim([-RX, 0.02, RZ + 2], [RX, 0.02, RZ + 2], [0, 0, 6], '46.0', { views: ['axo', 'plan'] });
  S.dim([RX + 2, 0.02, -RZ], [RX + 2, 0.02, RZ], [12, 0, 0], '32.0', { views: ['axo', 'plan'] });
  S.dim([14, 0.02, RZ + 2], [21, 0.02, RZ + 2], [0, 0, 3], '7.0', { ext: false, views: ['axo', 'plan'] });
  S.dim([-RX - 2, 0, 0.3], [-RX - 2, ROOF, 0.3], [-3, 0, 0], '6.3', { ext: false, views: UP });
  S.level(RX, ROOF, 0, [1, 0, 0], '+6.3 ROOF');
  S.level(26, PL, 0, [1, 0, 0], '+0.6 FFL');
  S.northArrow(RX - 6, -RZ - 5);
  S.scaleBar(-RX - 4, -RZ - 8, 2, 5, '10 m');
  S.sectionMark(-RX - 15, 0.3, 'B', -1);
  S.sectionMark(RX + 22, 0.3, 'B', -1);

  /* --- redlines --- */
  seed = 5;
  S.cloud([0, 6.6, 0], [1, 0, 0], [0, 0, 1], 10.5, 8.2, 14);
  S.scrawl([8, 6.6, -8], [15, 6.6, -14]);
  S.label('the tree stays — move the core', [15.5, 6.8, -15], { kind: 'note', after: S.lines.red[S.lines.red.length - 1], align: 'left', anchor: [0, 7.4, -10] });

  return {
    bounds: new THREE.Box3(new THREE.Vector3(-RX - 12, -3, -RZ - 12), new THREE.Vector3(RX + 18, ROOF + 6, RZ + 18)),
    frame: new THREE.Box3(new THREE.Vector3(-RX - 21, 0, -RZ - 10), new THREE.Vector3(RX + 16, ROOF + 4, RZ + 9)),
    sectionFrame: new THREE.Box3(new THREE.Vector3(-RX - 8, -2, -4), new THREE.Vector3(RX + 14, ROOF + 3, 4)),
  };
}

/* ============================================================
   DWG-03 — The Circle Archive
   A ribbed drum around a spiral ramp; the stacks face the void,
   and the oculus drops a column of light to the reading floor.
   ============================================================ */

function buildArchive(S) {
  const R = 18, H = 30, RIBS = 24;
  const RAMP_IN = 10, RAMP_OUT = 15, TURNS = 3.2, RAMP_TOP = 26;
  const OC = 5, ROOF_TOP = 33.4;

  /* --- radial grid --- */
  'ABCDEF'.split('').forEach((L, i) => {
    const a = (i / 6) * Math.PI + Math.PI / 12;
    const c = Math.cos(a), s = Math.sin(a);
    S.gridline([-c * (R + 8), 0.02, -s * (R + 8)], [c * (R + 8), 0.02, s * (R + 8)], L);
  });
  S.circle('guide', 'guide', 0, 0, R, 0.02, 64);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    S.seg('guide', 'guide', [Math.cos(a) * R, -0.5, Math.sin(a) * R], [Math.cos(a) * R, ROOF_TOP + 3, Math.sin(a) * R]);
  }

  /* --- site: plaza, paving, approach, trees --- */
  S.ground.push(box(0, -1.5, 0, 120, 3, 120));
  S.circle('medium', 'site', 0, 0, 27, 0.02, 72);
  S.circle('light', 'site', 0, 0, 22.5, 0.02, 72);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    S.seg('light', 'site', [Math.cos(a) * 22.5, 0.02, Math.sin(a) * 22.5], [Math.cos(a) * 27, 0.02, Math.sin(a) * 27]);
  }
  S.seg('light', 'site', [-3, 0.02, 27], [-3, 0.02, 44]);
  S.seg('light', 'site', [3, 0.02, 27], [3, 0.02, 44]);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.62 + (i / 8) * Math.PI * 1.76;
    const x = Math.cos(a) * 33, z = Math.sin(a) * 33;
    S.tree(x, z, 2.9);
  }

  /* --- drum: solid base, ring beams, ribs, glazing --- */
  S.solids.push(revolve([[R - 0.6, 0], [R, 0], [R, 4], [R - 0.6, 4]], 72));
  S.circle('heavy', 'struct', 0, 0, R, 0.02, 72, 0, Math.PI * 2, 0);
  S.circle('heavy', 'struct', 0, 0, R, 4, 72, 0, Math.PI * 2, 4);
  for (let l = 1; l <= 6; l++) {
    const y = l * 5;
    S.solids.push(revolve([[R - 1, y - 0.55], [R, y - 0.55], [R, y], [R - 1, y]], 72));
    S.circle(l === 6 ? 'heavy' : 'medium', 'struct', 0, 0, R + 0.01, y, 72, 0, Math.PI * 2, y);
    S.circle('light', 'detail', 0, 0, R + 0.01, y - 0.55, 72, 0, Math.PI * 2, y);
  }
  for (let i = 0; i < RIBS; i++) {
    const a = (i / RIBS) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const t = [-s, 0, c];
    const o = [c * (R + 1.6), 0, s * (R + 1.6)];
    S.seg('medium', 'struct', add(o, scale(t, 0.25)), add(add(o, scale(t, 0.25)), [0, H, 0]), 0);
    S.seg('medium', 'struct', add(o, scale(t, -0.25)), add(add(o, scale(t, -0.25)), [0, H, 0]), 0);
    S.seg('light', 'struct', add(o, [0, H, 0]), [c * R, H, s * R], H);
    S.solids.push(box(c * (R + 0.8), H / 2, s * (R + 0.8), 1.6, H, 0.5, a));
    // glazing mullion between ribs
    const am = a + Math.PI / RIBS;
    S.seg('light', 'detail', [Math.cos(am) * R, 4, Math.sin(am) * R], [Math.cos(am) * R, H, Math.sin(am) * R], 4);
  }

  /* --- stacks: inner drum facing the void --- */
  S.solids.push(revolve([[8.6, 0], [9, 0], [9, 22], [8.6, 22]], 56));
  S.circle('medium', 'struct', 0, 0, 9, 0.02, 56, 0, Math.PI * 2, 0);
  S.circle('heavy', 'struct', 0, 0, 9, 22, 56, 0, Math.PI * 2, 22);
  for (let y = 2.2; y < 22; y += 2.2) {
    S.circle('light', 'detail', 0, 0, 9.02, y, 56, 0, Math.PI * 2, y);
    S.circle('light', 'detail', 0, 0, 8.58, y, 56, 0, Math.PI * 2, y);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + Math.PI / 24;
    S.seg('light', 'detail', [Math.cos(a) * 8.58, 0, Math.sin(a) * 8.58], [Math.cos(a) * 8.58, 22, Math.sin(a) * 8.58], 0);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    S.seg('light', 'detail', [Math.cos(a) * 9.02, 0, Math.sin(a) * 9.02], [Math.cos(a) * 9.02, 22, Math.sin(a) * 9.02], 0);
  }

  /* --- the spiral ramp --- */
  const N = Math.round(TURNS * 56);
  const rampY = (t) => 0.9 + t * (RAMP_TOP - 0.9);
  const sections = [];
  const inner = [], outer = [], rail = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * TURNS * Math.PI * 2 + 0.4;
    const c = Math.cos(a), s = Math.sin(a), y = rampY(t);
    sections.push([[c * RAMP_IN, y, s * RAMP_IN], [c * RAMP_OUT, y, s * RAMP_OUT], [c * RAMP_OUT, y - 0.45, s * RAMP_OUT], [c * RAMP_IN, y - 0.45, s * RAMP_IN]]);
    inner.push([c * RAMP_IN, y, s * RAMP_IN]);
    outer.push([c * RAMP_OUT, y, s * RAMP_OUT]);
    rail.push([c * RAMP_IN, y + 1.05, s * RAMP_IN]);
    if (i % 7 === 0) S.seg('light', 'detail', [c * RAMP_IN, y, s * RAMP_IN], [c * RAMP_IN, y + 1.05, s * RAMP_IN], y);
  }
  S.solids.push(sweep(sections));
  for (let i = 0; i < N; i++) {
    S.seg('heavy', 'struct', inner[i], inner[i + 1], inner[i][1]);
    S.seg('medium', 'struct', outer[i], outer[i + 1], outer[i][1]);
    S.seg('light', 'detail', rail[i], rail[i + 1], rail[i][1]);
  }

  /* --- roof shell, oculus, light column --- */
  S.solids.push(revolve([[R + 0.4, H], [OC, ROOF_TOP], [OC, ROOF_TOP + 0.5], [R + 0.4, H + 0.5]], 72));
  S.circle('heavy', 'struct', 0, 0, R + 0.4, H + 0.5, 72, 0, Math.PI * 2, H + 0.5);
  S.circle('heavy', 'struct', 0, 0, OC, ROOF_TOP + 0.5, 40, 0, Math.PI * 2, ROOF_TOP);
  S.circle('medium', 'struct', 0, 0, OC, ROOF_TOP, 40, 0, Math.PI * 2, ROOF_TOP);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + Math.PI / 24;
    S.seg('medium', 'struct', [Math.cos(a) * (R + 0.4), H + 0.5, Math.sin(a) * (R + 0.4)], [Math.cos(a) * OC, ROOF_TOP + 0.5, Math.sin(a) * OC], H + 0.5);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    S.seg('guide', 'detail', [Math.cos(a) * OC, ROOF_TOP, Math.sin(a) * OC], [Math.cos(a) * OC * 0.9, 0.05, Math.sin(a) * OC * 0.9], 0.2);
  }
  S.circle('light', 'detail', 0, 0, OC * 0.9, 0.05, 32, 0, Math.PI * 2, 0.2);
  // reading tables in the pool of light
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    S.rect('light', 'detail', Math.cos(a) * 2.6, Math.sin(a) * 2.6, 2.4, 1, 0.8, a, 0.8);
  }

  /* --- dimensions and datums --- */
  S.dim([-R - 1.6, 0.02, R + 6], [R + 1.6, 0.02, R + 6], [0, 0, 4], 'Ø 39.2', { ext: false, views: ['axo', 'plan'] });
  S.dim([-R - 4, 0, 0], [-R - 4, H, 0], [-3, 0, 0], '30.0', { ext: false, views: UP });
  S.dim([-R - 4, H, 0], [-R - 4, ROOF_TOP + 0.5, 0], [-3, 0, 0], '3.9', { ext: false, views: UP });
  for (const [y, t] of [[0, '±0.0'], [15, '+15.0'], [H, '+30.0'], [ROOF_TOP + 0.5, '+33.9 OCULUS']]) S.level(R + 2.4, y, 0, [1, 0, 0], t);
  S.northArrow(R + 13, -R - 2);
  S.scaleBar(-R - 8, R + 8, 2, 5, '10 m');
  S.sectionMark(-R - 9, 0.05, 'C', -1);
  S.sectionMark(R + 9, 0.05, 'C', -1);

  /* --- redlines --- */
  seed = 3;
  S.cloud([0, ROOF_TOP + 1.2, 0], [1, 0, 0], [0, 0, 1], 8.2, 8.2, 14);
  S.scrawl([7, ROOF_TOP + 2, 5], [16, ROOF_TOP + 8, 10]);
  S.label('oculus +1.5 m? more light', [16.6, ROOF_TOP + 8.8, 10.4], { kind: 'note', after: S.lines.red[S.lines.red.length - 1], align: 'left', anchor: [0, ROOF_TOP + 9, 0] });

  return {
    bounds: new THREE.Box3(new THREE.Vector3(-R - 12, -3, -R - 10), new THREE.Vector3(R + 22, ROOF_TOP + 5, R + 16)),
    frame: new THREE.Box3(new THREE.Vector3(-R - 8, 0, -R - 4), new THREE.Vector3(R + 10, ROOF_TOP + 4, R + 10)),
    sectionFrame: new THREE.Box3(new THREE.Vector3(-R - 9, -2, -4), new THREE.Vector3(R + 16, ROOF_TOP + 3, 4)),
  };
}

/* ============================================================
   Renderer, paper and materials
   ============================================================ */

let renderer = null;
const fallbackImg = document.querySelector('.fallback');
const FALLBACK_ALT = [
  'Blueprint axonometric of Meridian Tower: a twisting diagrid tower on its podium and street, with dimensions and a redline cloud around the crown.',
  'Blueprint axonometric of the Courtyard Pavilion: one roof on a colonnade around a courtyard tree, with grid bubbles and a redline note.',
  'Blueprint axonometric of the Circle Archive: a ribbed drum with a spiral ramp inside and an oculus, with a redline cloud.',
];
const showFallback = (i) => {
  fallbackImg.src = `/sites/11-vertex-architecture/assets/fallback-${i}.webp`;
  fallbackImg.alt = FALLBACK_ALT[i];
};
const probe = document.createElement('canvas');
if (probe.getContext('webgl2') || probe.getContext('webgl')) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    renderer = null;
  }
}
if (!renderer) {
  // no WebGL: a finished still of each sheet, panels still work
  document.documentElement.classList.add('no-webgl');
  showFallback(0);
  fallbackImg.hidden = false;
}

const DPR_CAP = isSmall() || !HIGH ? 1.5 : 2;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
const drawU = { value: 0 };     // global draft clock, 0..1
const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
const lineMaterials = [];

/* paper: one full-screen quad behind everything */
const paperScene = new THREE.Scene();
const paperCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const paperU = { uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 } };
const PAPER_GLSL = /* glsl */`
    uniform vec2 uRes; uniform float uDpr;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float grid(vec2 px, float size){
      vec2 d = abs(fract(px / size + 0.5) - 0.5) * size;
      float m = min(d.x, d.y);
      return 1.0 - smoothstep(0.0, uDpr * 0.9, m);
    }
    vec3 paper(){
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 css = gl_FragCoord.xy / uDpr;
      float aspect = uRes.x / uRes.y;
      float r = length((uv - vec2(0.5, 0.58)) * vec2(aspect, 1.0));
      vec3 col = mix(vec3(0.058, 0.152, 0.266), vec3(0.036, 0.098, 0.180), smoothstep(0.05, 0.95, r));
      float m = noise(css / 260.0) * 0.6 + noise(css / 70.0 + 3.1) * 0.4;
      col *= 0.92 + 0.13 * m;
      col += (hash(gl_FragCoord.xy) - 0.5) * 0.016;
      float fine = grid(gl_FragCoord.xy, 20.0 * uDpr);
      float major = grid(gl_FragCoord.xy, 100.0 * uDpr);
      col = mix(col, vec3(0.50, 0.83, 1.0), fine * 0.05 + major * 0.085);
      // two soft fold creases from the plan chest
      float f1 = abs(uv.x - 0.333) * uRes.x / uDpr, f2 = abs(uv.y - 0.5) * uRes.y / uDpr;
      col += vec3(0.02, 0.035, 0.05) * (exp(-f1 * f1 / 6.0) + exp(-f2 * f2 / 6.0) * 0.8);
      col -= vec3(0.012, 0.02, 0.03) * (exp(-pow(f1 - 3.0, 2.0) / 10.0) + exp(-pow(f2 - 3.0, 2.0) / 10.0) * 0.8);
      col *= 1.0 - smoothstep(0.55, 1.15, r) * 0.35;
      return col;
    }`;
const paperMat = new THREE.ShaderMaterial({
  uniforms: paperU,
  vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: PAPER_GLSL + 'void main(){ gl_FragColor = vec4(paper(), 1.0); }',
  depthTest: false,
  depthWrite: false,
});
paperScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), paperMat));

const INK = { heavy: '#d2efff', medium: '#8fd6ff', light: '#5c9fcc', guide: '#4a82ad', dim: '#a9dcff', datum: '#bfe6ff', red: '#ff8f7a' };
const WIDTH = { heavy: 2.2, medium: 1.35, light: 0.9, guide: 0.85, dim: 1.0, datum: 1.3, red: 1.9 };
const ALPHA = { heavy: 1, medium: 0.95, light: 0.78, guide: 0.55, dim: 0.9, datum: 0.95, red: 0.95 };

/* LineMaterial, patched so each segment grows over its own window */
function draftMaterial(opts) {
  const m = new LineMaterial({ transparent: true, depthWrite: false, ...opts });
  m.clippingPlanes = [cutPlane];
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDraw = drawU;
    sh.vertexShader = sh.vertexShader
      .replace('attribute vec3 instanceEnd;', 'attribute vec3 instanceEnd;\nattribute vec2 instanceT;\nuniform float uDraw;\nvarying float vShow;')
      .replace('vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );',
        `float drawF = clamp( ( uDraw - instanceT.x ) / max( 1e-5, instanceT.y - instanceT.x ), 0.0, 1.0 );
        vShow = step( 1e-4, drawF );
        vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );`)
      .replace('vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
        'vec4 end = modelViewMatrix * vec4( mix( instanceStart, instanceEnd, drawF ), 1.0 );');
    sh.fragmentShader = sh.fragmentShader
      .replace('uniform float linewidth;', 'uniform float linewidth;\nvarying float vShow;')
      .replace('void main() {', 'void main() {\n\tif ( vShow < 0.5 ) discard;');
  };
  lineMaterials.push(m);
  return m;
}

/* shaded fill for solids and skins; hatched poché for cut back faces */
const fillVert = /* glsl */`
  #include <common>
  #include <clipping_planes_pars_vertex>
  varying vec3 vN; varying vec3 vW;
  void main() {
    vec4 wp = modelMatrix * vec4( position, 1.0 );
    vW = wp.xyz;
    vN = normalize( mat3( modelMatrix ) * normal );
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <clipping_planes_vertex>
  }`;
const revealU = { value: 1e4 };
const hatchU = { value: 6 };
const spanU = { value: new THREE.Vector2(0, 100) };
function fillMaterial(top, side, shade, sheen = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { uRevealY: revealU, uSpan: spanU, uSheen: { value: sheen }, uTop: { value: new THREE.Color(top) }, uSide: { value: new THREE.Color(side) }, uShade: { value: new THREE.Color(shade) } },
    vertexShader: fillVert,
    fragmentShader: /* glsl */`
      #include <clipping_planes_pars_fragment>
      uniform float uRevealY; uniform vec2 uSpan; uniform float uSheen; uniform vec3 uTop; uniform vec3 uSide; uniform vec3 uShade;
      varying vec3 vN; varying vec3 vW;
      void main() {
        #include <clipping_planes_fragment>
        if ( vW.y > uRevealY ) discard;
        vec3 n = normalize( vN );
        float lit = clamp( dot( normalize( n.xz + 1e-4 ), normalize( vec2( 0.55, 0.84 ) ) ) * 0.5 + 0.5, 0.0, 1.0 );
        vec3 col = mix( uShade, uSide, lit );
        col = mix( col, uTop, smoothstep( 0.55, 0.95, n.y ) );
        col = mix( col, uShade * 0.9, smoothstep( -0.55, -0.95, n.y ) );
        float h = clamp( ( vW.y - uSpan.x ) / max( 1.0, uSpan.y - uSpan.x ), 0.0, 1.0 );
        col += uSheen * ( 1.0 - abs( n.y ) ) * vec3( 0.010, 0.022, 0.034 ) * ( 0.4 + 1.6 * h * h );
        gl_FragColor = vec4( col, 1.0 );
        #include <colorspace_fragment>
      }`,
    clipping: true,
    polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2,
  });
}
const hatchMaterial = new THREE.ShaderMaterial({
  uniforms: { uRevealY: revealU, uSpacing: hatchU, uFill: { value: new THREE.Color('#123557') }, uInk: { value: new THREE.Color('#7fd4ff') } },
  vertexShader: fillVert,
  fragmentShader: /* glsl */`
    #include <clipping_planes_pars_fragment>
    uniform float uRevealY; uniform float uSpacing; uniform vec3 uFill; uniform vec3 uInk;
    varying vec3 vN; varying vec3 vW;
    void main() {
      #include <clipping_planes_fragment>
      if ( vW.y > uRevealY ) discard;
      float d = ( gl_FragCoord.x - gl_FragCoord.y ) / uSpacing;
      float px = abs( fract( d ) - 0.5 ) * uSpacing;
      float a = 1.0 - smoothstep( 0.4, 1.3, px );
      gl_FragColor = vec4( mix( uFill, uInk, a * 0.8 ), 1.0 );
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide,
  clipping: true,
  polygonOffset: true, polygonOffsetFactor: 1.2, polygonOffsetUnits: 1,
});
const solidFill = fillMaterial('#1b4670', '#143a5e', '#0f2e4c');
const skinFill = fillMaterial('#18426a', '#123657', '#0e2a47', 1);
const contextFill = fillMaterial('#13314f', '#102b46', '#0d243d');
// the ground block is paper on top (invisible) and only shows as poché when cut
const groundFill = new THREE.ShaderMaterial({
  uniforms: paperU,
  vertexShader: fillVert,
  fragmentShader: '#include <clipping_planes_pars_fragment>\n' + PAPER_GLSL + `
    varying vec3 vN; varying vec3 vW;
    void main(){
      #include <clipping_planes_fragment>
      gl_FragColor = vec4(paper(), 1.0);
    }`,
  clipping: true,
  polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2,
});
const SHARED_MATS = [solidFill, skinFill, contextFill, hatchMaterial, groundFill];
for (const m of SHARED_MATS) m.clippingPlanes = [cutPlane];

/* the pen: soft glow plus a CAD crosshair */
const tip = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(225,246,255,1)');
  grad.addColorStop(0.18, 'rgba(160,226,255,0.75)');
  grad.addColorStop(1, 'rgba(127,212,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(225,246,255,0.9)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(64, 30); g.lineTo(64, 52); g.moveTo(64, 76); g.lineTo(64, 98);
  g.moveTo(30, 64); g.lineTo(52, 64); g.moveTo(76, 64); g.lineTo(98, 64);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
  s.renderOrder = 20;
  s.visible = false;
  scene.add(s);
  return s;
})();

/* text labels drawn once into canvas sprites */
function makeLabel(text, size, { kind = 'dim', align = 'center', weight = 500, rotate = 0 } = {}) {
  const hand = kind === 'note';
  const px = 72;
  const font = hand ? `600 ${px}px Caveat, cursive` : `${weight} ${px}px Archivo, sans-serif`;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const style = () => {
    g.font = font;
    if (!hand) g.letterSpacing = '4px';
  };
  style();
  c.width = Math.ceil(g.measureText(text).width) + 24;
  c.height = Math.round(px * 1.35);
  style();
  g.textBaseline = 'middle';
  g.fillStyle = hand ? '#ff9d88' : '#c4e8ff';
  g.shadowColor = 'rgba(6,18,34,0.95)';
  g.shadowBlur = hand ? 14 : 10;
  if (hand) { g.lineWidth = 10; g.strokeStyle = 'rgba(8,22,40,0.75)'; g.lineJoin = 'round'; g.strokeText(text, 12, c.height / 2 + 2); }
  g.fillText(text, 12, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, rotation: rotate });
  // depth-tested so buildings hide labels behind them, but pulled toward the
  // camera by about its own height so a label standing on the ground stays whole
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('mvPosition.xy += rotatedPosition;',
      'mvPosition.xy += rotatedPosition;\n\tmvPosition.xyz += normalize( - mvPosition.xyz ) * scale.y * 0.9;');
  };
  const sprite = new THREE.Sprite(mat);
  const h = size * (hand ? 3.1 : 1.85);
  sprite.scale.set((h * c.width) / c.height, h, 1);
  if (align === 'left') sprite.center.set(0.02, 0.5);
  if (align === 'top') sprite.center.set(0.5, 0);
  sprite.renderOrder = 15;
  return sprite;
}

/* ============================================================
   Mounting a design
   ============================================================ */

const world = new THREE.Group();
scene.add(world);
let current = null;

function mount(index) {
  if (current) unmount();
  const design = DESIGNS[index];
  seed = 7 + index;
  const S = new Sheet(design);
  const { bounds, frame, sectionFrame } = design.build(S);
  S.schedule();

  const group = new THREE.Group();
  const objs = [];

  // solids and skins
  if (S.solids.length) {
    const geo = mergeGeometries(S.solids);
    const fill = new THREE.Mesh(geo, solidFill);
    const hatch = new THREE.Mesh(geo, hatchMaterial);
    fill.renderOrder = 1; hatch.renderOrder = 2;
    group.add(fill, hatch);
    objs.push(fill);
  }
  if (S.ground.length) {
    const geo = mergeGeometries(S.ground);
    const g = new THREE.Mesh(geo, groundFill);
    const h = new THREE.Mesh(geo, hatchMaterial);
    g.renderOrder = 1; h.renderOrder = 2;
    group.add(g, h);
    objs.push(g);
  }
  if (S.context.length) {
    const ctx = new THREE.Mesh(mergeGeometries(S.context), contextFill);
    ctx.renderOrder = 1;
    group.add(ctx);
    objs.push(ctx);
  }
  if (S.skins.length) {
    const geo = mergeGeometries(S.skins);
    const skin = new THREE.Mesh(geo, skinFill);
    skin.renderOrder = 1;
    group.add(skin);
    objs.push(skin);
  }

  // pen strokes, one batch per weight
  const tipTrack = [];
  const dashMats = [];
  let datumMat = null;
  for (const w of WEIGHTS) {
    const list = S.lines[w];
    if (!list.length) continue;
    const pos = new Float32Array(list.length * 6);
    const times = new Float32Array(list.length * 2);
    list.forEach((s, k) => {
      pos.set(s.a, k * 6); pos.set(s.b, k * 6 + 3);
      times[k * 2] = s.t0; times[k * 2 + 1] = s.t1;
      if (w !== 'guide' && w !== 'datum') tipTrack.push(s);
    });
    const geo = new LineSegmentsGeometry();
    geo.setPositions(pos);
    geo.setAttribute('instanceT', new THREE.InstancedBufferAttribute(times, 2));
    const dashed = w === 'guide';
    const mat = draftMaterial({
      color: INK[w], linewidth: WIDTH[w], opacity: ALPHA[w],
      dashed, dashSize: design.dash[0] * 2.4, gapSize: design.dash[1] * 1.6,
      depthTest: w !== 'red',
    });
    const lines = new LineSegments2(geo, mat);
    if (dashed) { lines.computeLineDistances(); dashMats.push(mat); }
    lines.renderOrder = w === 'red' ? 12 : 4;
    group.add(lines);
    if (w === 'datum') datumMat = mat;

    if (HIGH && w === 'heavy') {
      const glow = new LineSegments2(geo, draftMaterial({ color: '#7fd4ff', linewidth: 6, opacity: 0.07 }));
      glow.renderOrder = 3;
      group.add(glow);
    }
    // hidden edges, faint and dashed (desktop only)
    if (HIGH && (w === 'heavy' || w === 'medium')) {
      const hm = draftMaterial({
        color: '#7fd4ff', linewidth: 0.9, opacity: 0.2,
        dashed: true, dashSize: design.dash[0], gapSize: design.dash[1],
        depthFunc: THREE.GreaterDepth,
      });
      const hidden = new LineSegments2(geo, hm);
      if (!dashed) hidden.computeLineDistances();
      hidden.renderOrder = 5;
      group.add(hidden);
    }
  }
  tipTrack.sort((a, b) => a.t0 - b.t0);

  // labels
  const compact = isSmall();
  const labels = S.labels.map((l) => {
    // on phones a note sits centred above its cloud instead of trailing off the edge
    const opts = compact && l.anchor ? { ...l, align: 'top' } : l;
    const s = makeLabel(l.text, design.text * (l.size || 1), opts);
    s.position.set(...(compact && l.anchor ? l.anchor : l.pos));
    s.userData.t = l.t;
    s.userData.views = l.views;
    s.userData.h0 = s.scale.y;
    s.userData.aspect = s.scale.x / s.scale.y;
    s.userData.px = l.kind === 'note' ? (compact ? [20, 26] : [26, 40]) : (compact ? [14, 20] : [17, 27]);
    s.userData.vo = l.views.includes('axo') ? 1 : 0;
    group.add(s);
    return s;
  });

  // reveal height follows the structure as it is drawn
  const struct = [...S.lines.heavy, ...S.lines.medium].filter((s) => s.phase === 'struct').sort((a, b) => a.t1 - b.t1);
  const revealT = struct.map((s) => s.t1);
  const revealY = [];
  let maxY = bounds.min.y;
  for (const s of struct) { maxY = Math.max(maxY, s.a[1], s.b[1]); revealY.push(maxY); }

  world.add(group);
  siteNote.innerHTML = design.note;
  sheetIndex = index;
  updateSheetText();
  spanU.value.set(bounds.min.y, frame.max.y);
  current = { index, design, group, objs, labels, tipTrack, revealT, revealY, bounds, frame, sectionFrame, datumMat };
  updateResolution();
}

function unmount() {
  current.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !SHARED_MATS.includes(o.material)) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
      const i = lineMaterials.indexOf(o.material);
      if (i >= 0) lineMaterials.splice(i, 1);
    }
  });
  world.remove(current.group);
  current = null;
}

/* ============================================================
   Views, camera fit, cut plane
   ============================================================ */

const VIEWS = {
  axo: { fov: 30, phi: 1.02 },
  plan: { fov: 2.6, phi: 0.0015 },
  section: { fov: 2.6, phi: Math.PI / 2 },
};
let viewName = 'axo';
const cam = { theta: 0.68, phi: 1.02, fov: 30, zoom: 1, ty: 0 };
const camFrom = { ...cam };
let camGoal = { ...cam };
let viewT = 1;
let autoSpin = !reduceMotion;
let spinVel = 0;

const avail = { x0: 0, y0: 0, x1: 1, y1: 1, W: 1, H: 1 };
function measureAvail() {
  const W = window.innerWidth, H = window.innerHeight;
  const r = (sel) => document.querySelector(sel)?.getBoundingClientRect();
  if (isSmall()) {
    const top = r('.annotations');
    const dock = r('.panel');
    const head = r('.studio');
    if (dock && dock.left > W / 2) {
      // landscape phone: dock is a side column
      avail.x0 = 16; avail.x1 = dock.left - 12;
      avail.y0 = (head ? head.bottom : 40) + 6;
      avail.y1 = H - 30;
    } else {
      avail.x0 = 16; avail.x1 = W - 16;
      avail.y0 = (top && top.height ? top.bottom : 90) + 8;
      avail.y1 = (dock ? dock.top : H - 200) - 8;
    }
  } else {
    const nav = r('.panel'), anno = r('.annotations'), tb = r('.titleblock');
    avail.x0 = (nav ? nav.right : 260) + 24;
    avail.x1 = (anno ? Math.min(anno.left, tb ? tb.left + 40 : W) : W - 240) - 24;
    avail.y0 = 76;
    avail.y1 = H - 74;
  }
  avail.W = W; avail.H = H;
}

/* closed-form fit: distance so every bbox corner lands inside avail */
const tmpM = new THREE.Matrix4();
const frameFor = (name) => (name === 'section' && current.sectionFrame ? current.sectionFrame : current.frame);
function fitDistance(theta, phi, fov, b = frameFor(viewName)) {
  const center = b.getCenter(new THREE.Vector3());
  const offX = (avail.x0 + avail.x1) / 2 - avail.W / 2;
  const offY = (avail.y0 + avail.y1) / 2 - avail.H / 2;
  const fullW = avail.W + 2 * Math.abs(offX), fullH = avail.H + 2 * Math.abs(offY);
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const tanH = tanV * (fullW / fullH);
  const halfAW = Math.max(60, (avail.x1 - avail.x0) / 2) * 0.94;
  const halfAH = Math.max(60, (avail.y1 - avail.y0) / 2) * 0.94;
  const dir = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(phi), Math.cos(theta) * Math.sin(phi));
  const m = tmpM.lookAt(dir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
  const right = new THREE.Vector3().setFromMatrixColumn(m, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(m, 1);
  let d = 1;
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).sub(center);
    const x = p.dot(right), y = p.dot(up), z = p.dot(dir); // z toward the camera
    d = Math.max(d, z + Math.abs(x) * (fullW / 2) / (tanH * halfAW), z + Math.abs(y) * (fullH / 2) / (tanV * halfAH));
  }
  return { d, center, offX, offY, fullW, fullH };
}

// orbit-invariant axo framing: worst case over a ring of headings
function axoFit(phi, fov) {
  let d = 0;
  for (let i = 0; i < 12; i++) d = Math.max(d, fitDistance((i / 12) * Math.PI * 2, phi, fov, current.frame).d);
  return d;
}
let boostFrom = 1, boostTo = 1, distNow = 0, fromView = 'axo';
const boost = (name, s) => (name === 'axo' ? axoFit(s.phi, s.fov) / fitDistance(s.theta, s.phi, s.fov, current.frame).d : 1);

function setView(name, instant = false) {
  if (!VIEWS[name]) return;
  const prevView = viewName;
  viewName = name;
  viewButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  Object.assign(camFrom, cam);
  const v = VIEWS[name];
  let theta = cam.theta;
  if (name !== 'axo') theta = Math.round(cam.theta / (Math.PI * 2)) * Math.PI * 2;
  camGoal = { theta, phi: v.phi, fov: v.fov, zoom: 1, ty: 0 };
  viewT = instant || reduceMotion ? 1 : 0;
  if (viewT === 1) Object.assign(cam, camGoal);
  else if (current) { fromView = prevView; boostFrom = boost(prevView, camFrom); boostTo = boost(name, camGoal); }
  cutGoal = name === 'axo' ? 'none' : name;
  if (instant || reduceMotion) { cutMode = cutGoal; cutAmt = cutGoal === 'none' ? 0 : 1; }
  autoSpin = name === 'axo' && !reduceMotion && !userTouched;
  updateSheetText();
}

/* cut plane: 'none' | 'plan' | 'section', swept in and out */
let cutMode = 'none', cutGoal = 'none', cutAmt = 0;
function applyCut() {
  if (!current) return;
  const b = current.bounds;
  const d = current.design;
  if (cutMode === 'plan') {
    cutPlane.normal.set(0, -1, 0);
    cutPlane.constant = THREE.MathUtils.lerp(b.max.y + 4, d.cutY, ease(cutAmt));
  } else if (cutMode === 'section') {
    cutPlane.normal.set(0, 0, -1);
    cutPlane.constant = THREE.MathUtils.lerp(b.max.z + 4, d.cutZ, ease(cutAmt));
  } else {
    cutPlane.normal.set(0, -1, 0);
    cutPlane.constant = 1e5;
  }
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ============================================================
   Text that follows the sheet
   ============================================================ */

let sheetIndex = 0;
function sheetNumber() {
  const d = DESIGNS[sheetIndex];
  const n = { axo: 1, plan: 2, section: 3 }[viewName];
  return `${d.no}${n}`;
}
function updateSheetText() {
  const d = DESIGNS[sheetIndex];
  const vname = viewName === 'plan' ? d.planName : viewName === 'section' ? d.sectionName : VIEW_NAMES.axo;
  tbProject.textContent = d.name;
  tbSheet.textContent = `${sheetNumber()} · ${vname}`;
  tbScale.textContent = d.scale;
  tbRev.textContent = d.rev;
  sheetTag.textContent = `${sheetNumber()} · ${VIEW_SHORT[viewName]}`;
  live.textContent = `${d.name}, sheet ${sheetNumber()}, ${vname.toLowerCase()}.`;
}

function updateAnnotations(t) {
  const d = DESIGNS[current ? current.index : activeIndex];
  const p = THREE.MathUtils.clamp((t - 0.2) / 0.62, 0, 1);
  const e = 1 - Math.pow(1 - p, 3);
  annoEls.height.textContent = d.heightLabel(d.height * e);
  annoEls.floors.textContent = `${Math.max(1, Math.round(d.floors * e))}`;
  annoEls.area.textContent = `${Math.round(d.gfa * e).toLocaleString('en-US')} m²`;
  annoEls.status.textContent = t > 0.92 ? d.status : '· · ·';
  siteNote.classList.toggle('is-written', t > 0.95);
}

/* ============================================================
   State: drawing, erasing, switching
   ============================================================ */

let activeIndex = 0;
let drawT = 0;
let erasing = false;
let pendingIndex = -1;
const DRAW_SECONDS = 12;
const ERASE_SECONDS = 1.3;

function selectDesign(index) {
  if (index === activeIndex && current && !erasing) return;
  designButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
  const prev = activeIndex;
  activeIndex = index;
  clearMarks();
  if (!renderer) { sheetIndex = index; siteNote.innerHTML = DESIGNS[index].note; updateSheetText(); updateAnnotations(1); showFallback(index); return; }
  if (reduceMotion || !current) {
    mount(index);
    drawT = reduceMotion ? 1 : 0;
    erasing = false;
    return;
  }
  if (prev !== index || !erasing) {
    erasing = true;
    pendingIndex = index;
  }
}

/* ============================================================
   Input: orbit, zoom, keys, redline pen
   ============================================================ */

let dragging = false, lastX = 0, lastY = 0;
let userTouched = false;
let penOn = false;

function setPen(on) {
  penOn = on;
  penButton.setAttribute('aria-pressed', String(on));
  canvas.classList.toggle('pen-on', on);
  hint.textContent = on ? 'Draw on the model · strokes stick to it' : 'Drag to orbit · scroll to zoom';
  hint.classList.toggle('is-pen', on);
}

/* the user's own redlines: projected onto the model, held as fat lines */
const marks = { pts: [], strokes: [], labels: [], obj: null, mat: null, stroke: null };
const NOTES = ['check this', 'why here?', 'love it', 'move 2 m?', 'client!', 'ok with structure?', 'simplify', 'nice.'];
let noteIx = 0;
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function pick(e) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(current.objs, false)
    .filter((h) => cutPlane.distanceToPoint(h.point) >= 0 && h.point.y <= revealU.value + 0.01);
  let p = hits[0]?.point;
  if (!p) {
    p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, p)) return null;
  }
  // lift toward the camera so the ink sits on the surface
  return p.add(raycaster.ray.direction.clone().multiplyScalar(-current.design.text * 0.15));
}

function rebuildMarks() {
  if (marks.obj) { world.remove(marks.obj); marks.obj.geometry.dispose(); }
  const segs = [];
  for (const st of [...marks.strokes, ...(marks.stroke ? [marks.stroke] : [])]) {
    for (let i = 0; i < st.length - 1; i++) segs.push(...st[i].toArray(), ...st[i + 1].toArray());
  }
  if (!segs.length) { marks.obj = null; return; }
  const geo = new LineSegmentsGeometry();
  geo.setPositions(segs);
  if (!marks.mat) {
    marks.mat = new LineMaterial({ color: '#ff8f7a', linewidth: 2.4, transparent: true, opacity: 0.95, depthTest: false });
    lineMaterials.push(marks.mat);
    updateResolution();
  }
  marks.obj = new LineSegments2(geo, marks.mat);
  marks.obj.renderOrder = 14;
  world.add(marks.obj);
}

function clearMarks() {
  marks.strokes = [];
  marks.stroke = null;
  for (const l of marks.labels) { world.remove(l); l.material.map.dispose(); l.material.dispose(); }
  marks.labels = [];
  if (marks.obj) { world.remove(marks.obj); marks.obj.geometry.dispose(); marks.obj = null; }
  clearButton.hidden = true;
}

canvas.addEventListener('pointerdown', (e) => {
  if (!current) return;
  canvas.setPointerCapture(e.pointerId);
  userTouched = true;
  autoSpin = false;
  if (penOn) {
    const p = pick(e);
    if (p) { marks.stroke = [p]; lastX = e.clientX; lastY = e.clientY; }
    return;
  }
  dragging = true;
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('pointermove', (e) => {
  if (penOn && marks.stroke) {
    if (Math.hypot(e.clientX - lastX, e.clientY - lastY) < 4) return;
    lastX = e.clientX; lastY = e.clientY;
    const p = pick(e);
    if (p) { marks.stroke.push(p); rebuildMarks(); }
    return;
  }
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  if (viewName === 'axo') {
    camGoal.theta -= dx * 0.005;
    camGoal.phi = THREE.MathUtils.clamp(camGoal.phi - dy * 0.004, 0.42, 1.42);
    spinVel = -dx * 0.005;
  } else if (viewName === 'plan') {
    camGoal.theta -= dx * 0.004;
  }
});
const endPointer = () => {
  dragging = false;
  if (marks.stroke) {
    const st = marks.stroke;
    marks.stroke = null;
    if (st.length > 2) {
      marks.strokes.push(st);
      const end = st[st.length - 1];
      const l = makeLabel(NOTES[noteIx++ % NOTES.length], current.design.text * 0.95, { kind: 'note', align: 'left' });
      l.position.copy(end).add(new THREE.Vector3(current.design.text * 0.6, current.design.text * 0.5, 0));
      l.material.opacity = 1;
      world.add(l);
      marks.labels.push(l);
      clearButton.hidden = false;
    }
    rebuildMarks();
  }
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camGoal.zoom = THREE.MathUtils.clamp(camGoal.zoom * Math.exp(e.deltaY * 0.0012), 0.45, 1.8);
}, { passive: false });
canvas.addEventListener('dblclick', () => { camGoal.zoom = 1; });

canvas.addEventListener('keydown', (e) => {
  const k = e.key;
  if (viewName === 'axo' && (k === 'ArrowLeft' || k === 'ArrowRight')) { camGoal.theta += k === 'ArrowLeft' ? 0.12 : -0.12; autoSpin = false; e.preventDefault(); }
  if (viewName === 'axo' && (k === 'ArrowUp' || k === 'ArrowDown')) { camGoal.phi = THREE.MathUtils.clamp(camGoal.phi + (k === 'ArrowUp' ? -0.08 : 0.08), 0.42, 1.42); e.preventDefault(); }
  if (k === '+' || k === '=') camGoal.zoom = Math.max(0.45, camGoal.zoom / 1.15);
  if (k === '-' || k === '_') camGoal.zoom = Math.min(1.8, camGoal.zoom * 1.15);
});
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (['1', '2', '3'].includes(e.key)) selectDesign(+e.key - 1);
  else if (e.key === 'a' || e.key === 'A') setView('axo');
  else if (e.key === 'p' || e.key === 'P') setView('plan');
  else if (e.key === 's' || e.key === 'S') setView('section');
  else if (e.key === 'm' || e.key === 'M') setPen(!penOn);
  else if (e.key === 'Escape' && penOn) setPen(false);
});

designButtons.forEach((b) => b.addEventListener('click', () => selectDesign(+b.dataset.design)));
viewButtons.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
penButton.addEventListener('click', () => setPen(!penOn));
clearButton.addEventListener('click', clearMarks);
replayButton.addEventListener('click', () => {
  if (reduceMotion || !current) return;
  drawT = 0;
  siteNote.classList.remove('is-written');
});

/* ============================================================
   Resize and loop
   ============================================================ */

function updateResolution() {
  const w = window.innerWidth, h = window.innerHeight;
  for (const m of lineMaterials) m.resolution.set(w, h);
}

function resize() {
  if (!renderer) return;
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  paperU.uRes.value.set(window.innerWidth * dpr, window.innerHeight * dpr);
  paperU.uDpr.value = dpr;
  hatchU.value = 6.5 * dpr;
  measureAvail();
  updateResolution();
}

const clock = new THREE.Clock();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.25);

  /* draft clock */
  if (!reduceMotion) {
    if (erasing) {
      drawT = Math.max(0, drawT - dt / ERASE_SECONDS);
      if (drawT === 0) {
        erasing = false;
        mount(pendingIndex);
      }
    } else if (drawT < 1) {
      drawT = Math.min(1, drawT + dt / DRAW_SECONDS);
    }
  }
  drawU.value = drawT;
  updateAnnotations(drawT);

  /* reveal height for the shaded solids */
  const { revealT, revealY, bounds } = current;
  let lo = 0, hi = revealT.length - 1, idx = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (revealT[mid] <= drawT) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
  revealU.value = drawT >= 0.999 ? 1e4 : (idx < 0 ? bounds.min.y - 1 : revealY[idx]);
  if (drawT < 0.19) revealU.value = bounds.min.y - 10;

  /* labels fade in after their stroke, at a readable pixel size */
  const upp = (2 * camera.position.distanceTo(current.frame.getCenter(tmpV2)) * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / Math.max(1, camera.view ? camera.view.fullHeight : avail.H);
  if (current.datumMat) {
    const want = viewName === 'section' ? ALPHA.datum : 0;
    current.datumMat.opacity += (want - current.datumMat.opacity) * (reduceMotion ? 1 : Math.min(1, dt * 5));
    current.datumMat.visible = current.datumMat.opacity > 0.01;
  }
  for (const l of current.labels) {
    const [lo, hi] = l.userData.px;
    const hpx = THREE.MathUtils.clamp(l.userData.h0 / upp, lo, hi);
    l.scale.set(hpx * upp * l.userData.aspect, hpx * upp, 1);
    const a = THREE.MathUtils.clamp((drawT - l.userData.t) / 0.03, 0, 1);
    const want = l.userData.views.includes(viewName) ? 1 : 0;
    l.userData.vo += (want - l.userData.vo) * (reduceMotion ? 1 : Math.min(1, dt * 5));
    l.material.opacity = a * l.userData.vo;
    l.visible = l.material.opacity > 0.002;
  }

  /* pen tip: the most recent stroke still being drawn */
  const track = current.tipTrack;
  lo = 0; hi = track.length - 1; idx = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (track[mid].t0 <= drawT) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
  tip.visible = false;
  if (!reduceMotion && drawT < 1 && !erasing && idx >= 0) {
    for (let k = idx; k >= Math.max(0, idx - 40); k--) {
      const s = track[k];
      if (drawT < s.t1) {
        const f = (drawT - s.t0) / Math.max(1e-5, s.t1 - s.t0);
        tip.position.set(...lerp3(s.a, s.b, f));
        if (cutPlane.distanceToPoint(tip.position) >= 0) tip.visible = true;
        break;
      }
    }
  }

  /* camera: view transitions are a dolly zoom */
  if (viewT < 1) {
    viewT = Math.min(1, viewT + dt / 1.5);
    const e = ease(viewT);
    cam.theta = THREE.MathUtils.lerp(camFrom.theta, camGoal.theta, e);
    cam.phi = THREE.MathUtils.lerp(camFrom.phi, camGoal.phi, e);
    // fov in log space keeps the zoom feeling linear
    cam.fov = Math.exp(THREE.MathUtils.lerp(Math.log(camFrom.fov), Math.log(camGoal.fov), e));
    cam.zoom = THREE.MathUtils.lerp(camFrom.zoom, camGoal.zoom, e);
  } else {
    if (viewName === 'axo' && autoSpin && !reduceMotion) camGoal.theta += dt * 0.06;
    else if (!dragging && Math.abs(spinVel) > 1e-5) { camGoal.theta += spinVel; spinVel *= 0.92; }
    const k = 1 - Math.pow(0.0008, dt);
    cam.theta += (camGoal.theta - cam.theta) * k;
    cam.phi += (camGoal.phi - cam.phi) * k;
    cam.fov += (camGoal.fov - cam.fov) * k;
    cam.zoom += (camGoal.zoom - cam.zoom) * (1 - Math.pow(0.02, dt));
  }

  /* cut plane sweeps */
  if (cutMode !== cutGoal) {
    cutAmt = Math.max(0, cutAmt - dt / 0.6);
    if (cutAmt === 0) cutMode = cutGoal;
  } else if (cutMode !== 'none' && cutAmt < 1) {
    if (viewT > 0.55) cutAmt = Math.min(1, cutAmt + dt / 1.3);
  }
  applyCut();

  const fit = fitDistance(cam.theta, cam.phi, cam.fov);
  if (viewT < 1) {
    // blend the two sheets' framings so the dolly never jumps
    const e = ease(viewT);
    const a = fitDistance(cam.theta, cam.phi, cam.fov, frameFor(fromView));
    distNow = THREE.MathUtils.lerp(a.d * boostFrom, fit.d * boostTo, e);
    fit.center.lerpVectors(a.center, fit.center, e);
  } else {
    const want = viewName === 'axo' ? axoFit(cam.phi, cam.fov) : fit.d;
    distNow = distNow ? distNow + (want - distNow) * (1 - Math.pow(0.004, dt)) : want;
  }
  const dist = distNow * cam.zoom;
  const dir = tmpV.set(Math.sin(cam.theta) * Math.sin(cam.phi), Math.cos(cam.phi), Math.cos(cam.theta) * Math.sin(cam.phi));
  camera.position.copy(fit.center).addScaledVector(dir, dist);
  camera.up.set(0, 1, 0);
  if (cam.phi < 0.01) camera.up.set(-Math.sin(cam.theta), 0, -Math.cos(cam.theta));
  camera.lookAt(fit.center);
  camera.fov = cam.fov;
  camera.aspect = fit.fullW / fit.fullH;
  const R = current.bounds.getSize(tmpV).length() * 0.75;
  camera.near = Math.max(0.5, dist - R * 1.4);
  camera.far = dist + R * 1.6;
  camera.setViewOffset(fit.fullW, fit.fullH, Math.abs(fit.offX) - fit.offX, Math.abs(fit.offY) - fit.offY, avail.W, avail.H);
  camera.updateProjectionMatrix();
  tip.scale.setScalar(dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * 0.055);

  renderer.autoClear = false;
  renderer.clear();
  renderer.render(paperScene, paperCam);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ============================================================
   Boot
   ============================================================ */

siteNote.innerHTML = DESIGNS[0].note;
updateSheetText();

if (renderer) {
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x0a1b30, 1);
  const fontsReady = Promise.race([
    Promise.all([document.fonts.load('500 72px Archivo'), document.fonts.load('600 72px Archivo'), document.fonts.load('600 72px Caveat')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
  fontsReady.then(() => {
    resize();
    mount(0);
    if (reduceMotion) drawT = 1;
    setView('axo', true);
    window.addEventListener('resize', resize);
    frame();
  });
} else {
  updateAnnotations(1);
}
