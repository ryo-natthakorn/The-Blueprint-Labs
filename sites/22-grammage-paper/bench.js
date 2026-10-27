import * as THREE from 'three';

/* ============================================================
   GRAMMAGE — one sheet, six creases, flight
   Exact rigid origami. Before anything renders, the dart's
   crease pattern is built by folding the sheet once in memory:
   every convex facet that a hinge crosses is split along it,
   carrying its flat UVs, so each crease is a real mesh edge.
   At runtime each fold rotates its member facets about a hinge
   re-derived from anchor points on the sheet, so later folds
   follow earlier ones exactly; layers are kept apart by a
   computed stacking order. Scroll drives the folds; the last
   chapter flies the dart down the bench.
   ============================================================ */

const canvas = document.getElementById('bench');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => innerWidth <= 760;
const lowEnd = small() || (navigator.hardwareConcurrency || 8) <= 4;

const PI = Math.PI;
const DEG = PI / 180;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ease = (u) => u * u * (3 - 2 * u);
const easeOut = (u) => 1 - Math.pow(1 - u, 3);

/* ---------- papers ---------- */
const PAPERS = {
  kozo: { name: 'Kozo', gsm: 45, base: '#efe5cf', fibre: [168, 146, 104], fibreLen: 26, fibres: 4200, tooth: 0.05,
    dist: 5.8, time: 2.6, arc: 1.0, drift: 0.9, note: 'Kozo, 45 gsm. Long mulberry fibres you can see against the light.',
    flight: 'Floats for ages, then drifts off line. Lovely to watch, hard to aim.' },
  rag: { name: 'Cotton rag', gsm: 90, base: '#f5f0e5', fibre: [182, 172, 150], fibreLen: 8, fibres: 3400, tooth: 0.08,
    dist: 7.4, time: 2.0, arc: 0.62, drift: 0.35, note: 'Cotton rag, 90 gsm. Soft tooth, honest weight.',
    flight: 'The honest glide: long, level, and straight down the bench.' },
  ash: { name: 'Ash', gsm: 120, base: '#d6d3cb', fibre: [140, 138, 132], fibreLen: 6, fibres: 2600, tooth: 0.1,
    dist: 6.9, time: 1.6, arc: 0.4, drift: 0.15, note: 'Ash, 120 gsm. A cool grey stock with a tight, even surface.',
    flight: 'A flatter, faster line. Holds its creases under a hard throw.' },
  clay: { name: 'Clay', gsm: 160, base: '#c57b58', fibre: [150, 86, 58], fibreLen: 5, fibres: 2200, tooth: 0.12,
    dist: 5.2, time: 1.2, arc: 0.22, drift: 0.05, note: 'Clay, 160 gsm. Earth-dyed, heavy, almost a card.',
    flight: 'A dart, not a glider. Quick, short and very sure of itself.' },
};
let paperKey = 'rag';

/* ---------- renderer, scene, camera ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowEnd ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const BG = 0xddd5c4;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 9, 30);

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 80);

scene.add(new THREE.HemisphereLight(0xfffaf0, 0xd9cfbb, 1.05));
const key = new THREE.DirectionalLight(0xfff3e0, 2.5);
key.position.set(-3.2, 6.5, 3.4);
key.castShadow = true;
key.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
key.shadow.camera.left = -4.5; key.shadow.camera.right = 4.5;
key.shadow.camera.top = 4.5; key.shadow.camera.bottom = -4.5;
key.shadow.camera.near = 1; key.shadow.camera.far = 20;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.015;
key.shadow.radius = 4;
scene.add(key);
scene.add(key.target);
const fill = new THREE.DirectionalLight(0xdfe7ef, 0.55);
fill.position.set(4, 2.5, 4);
scene.add(fill);

/* ---------- textures ---------- */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const TEX_W = 1024, TEX_H = Math.round(1024 * 2.0 / 1.4);
// tooth: one shared grey field used for the bump map and to mottle the colour
const toothCanvas = document.createElement('canvas');
toothCanvas.width = 512; toothCanvas.height = Math.round(512 * 2.0 / 1.4);
{
  const g = toothCanvas.getContext('2d');
  const img = g.createImageData(toothCanvas.width, toothCanvas.height);
  const r = seeded(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.filter = 'blur(0.7px)';
  g.drawImage(toothCanvas, 0, 0);
}
const toothTex = new THREE.CanvasTexture(toothCanvas);
toothTex.wrapS = toothTex.wrapT = THREE.ClampToEdgeWrapping;

// the deckle edge: an irregular border shared by every paper
const deckle = (() => {
  const r = seeded(31);
  const pts = [];
  const m = 7;
  const edge = (x0, y0, x1, y1, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const j = (r() - 0.5) * 5 + Math.sin(t * 40 + r()) * 1.4;
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
      pts.push([x0 + (x1 - x0) * t + (nx / l) * j, y0 + (y1 - y0) * t + (ny / l) * j]);
    }
  };
  edge(m, m, TEX_W - m, m, 160);
  edge(TEX_W - m, m, TEX_W - m, TEX_H - m, 220);
  edge(TEX_W - m, TEX_H - m, m, TEX_H - m, 160);
  edge(m, TEX_H - m, m, m, 220);
  return pts;
})();

function paperTexture(p) {
  const c = document.createElement('canvas');
  c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext('2d');
  g.save();
  g.beginPath();
  deckle.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.clip();
  g.fillStyle = p.base;
  g.fillRect(0, 0, TEX_W, TEX_H);
  // mottling from the tooth field
  g.globalAlpha = p.tooth;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(toothCanvas, 0, 0, TEX_W, TEX_H);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  // fibres
  const r = seeded(p.gsm * 13);
  const [fr, fg, fb] = p.fibre;
  for (let i = 0; i < p.fibres; i++) {
    const x = r() * TEX_W, y = r() * TEX_H, a = r() * PI, L = p.fibreLen * (0.4 + r());
    g.strokeStyle = `rgba(${fr + (r() - 0.5) * 30 | 0}, ${fg + (r() - 0.5) * 30 | 0}, ${fb + (r() - 0.5) * 30 | 0}, ${0.06 + r() * 0.08})`;
    g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.4) * L * 0.5, y + Math.sin(a + 0.4) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L);
    g.stroke();
  }
  // watermark, read through the sheet
  g.save();
  g.translate(TEX_W / 2, TEX_H * 0.6);
  g.globalAlpha = p.gsm > 140 ? 0.12 : 0.08;
  g.fillStyle = p.gsm > 140 ? '#5a2c1a' : '#2b2a26';
  g.textAlign = 'center';
  g.font = '700 54px "Libre Caslon Text", serif';
  g.fillText('G R A M M A G E', 0, 0);
  g.font = '500 24px "Archivo Narrow", sans-serif';
  g.fillText(`${p.name.toUpperCase()} · ${p.gsm} GSM · MADE BY HAND`, 0, 42);
  g.restore();
  g.restore();
  // a soft darkening at the deckle
  g.save();
  g.beginPath();
  deckle.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.strokeStyle = 'rgba(110, 96, 72, 0.18)';
  g.lineWidth = 3;
  g.stroke();
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function linenTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#d2c8b3';
  g.fillRect(0, 0, 512, 512);
  const r = seeded(99);
  for (let i = 0; i < 512; i += 2) {
    g.fillStyle = `rgba(120, 104, 78, ${0.025 + r() * 0.05})`;
    g.fillRect(0, i, 512, 1);
    g.fillStyle = `rgba(255, 252, 240, ${0.03 + r() * 0.05})`;
    g.fillRect(i, 0, 1, 512);
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(110, 96, 70, ${0.03 + r() * 0.05})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 10, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/* ---------- the bench ---------- */
const bench = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ map: linenTexture(), roughness: 0.96, color: 0xffffff }),
);
bench.rotation.x = -PI / 2;
bench.position.set(0.6, 0, -22);
bench.receiveShadow = true;
scene.add(bench);

// a bone folder and a pencil, where you'd leave them
const bone = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.05, 0.95, 6, 16),
  new THREE.MeshStandardMaterial({ color: 0xeee6d4, roughness: 0.42 }),
);
bone.scale.set(1, 1, 0.38);
bone.rotation.set(PI / 2, 0, PI / 2 + 0.42);
bone.position.set(-0.95, 0.022, 1.2);
bone.castShadow = true;
scene.add(bone);

const pencil = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.86, 6), new THREE.MeshStandardMaterial({ color: 0x2f3d35, roughness: 0.5 }));
  const wood = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.11, 6), new THREE.MeshStandardMaterial({ color: 0xd8b98c, roughness: 0.8 }));
  wood.position.y = 0.485;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.4, metalness: 0.2 }));
  lead.position.y = 0.548;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.3, metalness: 0.7 }));
  cap.position.y = -0.455;
  for (const m of [body, wood, lead, cap]) { m.castShadow = true; pencil.add(m); }
}
pencil.rotation.set(PI / 2, 0, -1.15);
pencil.position.set(1.15, 0.033, -1.05);
scene.add(pencil);

/* ============================================================
   The fold engine
   ============================================================ */
const SW = 1.4, SH = 2.0, HW = SW / 2, HH = SH / 2;
const TAPER_Y = HH - HW / Math.tan(PI / 8);      // the taper crease leaves the sheet edge here
const WING_X = 0.22;                              // wing creases, measured from the keel
const SPINE_REST = 8 * DEG;                       // the remembered crease
const LAYER = 0.0007;                             // paper thickness, for stacking

// a: b: anchor points on the crease (flat coords). side: which side of a→b moves.
// half: only facets from this half of the sheet take part. dir: +1 folds over, −1 under.
const FOLDS = [
  { id: 'spine', a: [0, -HH], b: [0, HH], half: -1, dir: 1, flat: 0 },
  { id: 'shoulderL', a: [0, HH], b: [-HW, HH - HW], side: -1, dir: 1, flat: PI },
  { id: 'shoulderR', a: [0, HH], b: [HW, HH - HW], side: 1, dir: 1, flat: PI },
  { id: 'taperL', a: [0, HH], b: [-HW, TAPER_Y], side: -1, dir: 1, flat: PI },
  { id: 'taperR', a: [0, HH], b: [HW, TAPER_Y], side: 1, dir: 1, flat: PI },
  { id: 'keel', a: [0, -HH], b: [0, HH], half: -1, dir: 1, flat: PI },
  { id: 'wingNear', a: [-WING_X, -HH], b: [-WING_X, -0.2], half: -1, side: -1, dir: 1, flat: PI },
  { id: 'wingFar', a: [WING_X, -HH], b: [WING_X, -0.2], half: 1, side: -1, dir: -1, flat: PI },
];

function buildCreasePattern() {
  // facets: flat 2D polygon + current (folded-in-memory) 3D polygon
  const rect = (x0, x1) => {
    const f = [[x0, -HH], [x1, -HH], [x1, HH], [x0, HH]];
    return { f, c: f.map(([x, y]) => [x, y, 0]), m: 0, flips: 0, L: 0, first: -1 };
  };
  let polys = [rect(-HW, 0), rect(0, HW)];
  // anchors travel with the sheet too
  const anchors = [];
  const anchorIndex = (p) => {
    let i = anchors.findIndex((a) => a.f[0] === p[0] && a.f[1] === p[1]);
    if (i < 0) { anchors.push({ f: p.slice(), c: [p[0], p[1], 0], m: 0 }); i = anchors.length - 1; }
    return i;
  };
  for (const F of FOLDS) { F.ia = anchorIndex(F.a); F.ib = anchorIndex(F.b); }

  const rotate = (v, A, u, ang) => {
    const vx = v[0] - A[0], vy = v[1] - A[1], vz = v[2] - A[2];
    const c = Math.cos(ang), s = Math.sin(ang), d = vx * u[0] + vy * u[1] + vz * u[2];
    const cx = u[1] * vz - u[2] * vy, cy = u[2] * vx - u[0] * vz, cz = u[0] * vy - u[1] * vx;
    return [A[0] + vx * c + cx * s + u[0] * d * (1 - c), A[1] + vy * c + cy * s + u[1] * d * (1 - c), A[2] + vz * c + cz * s + u[2] * d * (1 - c)];
  };
  const centroid = (pts) => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + (p[2] || 0) / pts.length], [0, 0, 0]);
  const flatX = (P) => centroid(P.f)[0];

  FOLDS.forEach((F, k) => {
    const A = anchors[F.ia].c, B = anchors[F.ib].c;
    const ux = B[0] - A[0], uy = B[1] - A[1];
    const ul = Math.hypot(ux, uy);
    const u2 = [ux / ul, uy / ul];
    const sd = (p) => u2[0] * (p[1] - A[1]) - u2[1] * (p[0] - A[0]);
    const inHalf = (P) => !F.half || Math.sign(flatX(P)) === F.half;

    if (F.side) {
      // split every facet the hinge crosses
      const next = [];
      for (const P of polys) {
        if (!inHalf(P)) { next.push(P); continue; }
        const s = P.c.map(sd);
        if (s.every((v) => v >= -1e-7) || s.every((v) => v <= 1e-7)) { next.push(P); continue; }
        const a = { f: [], c: [], m: P.m, flips: P.flips, L: P.L, first: P.first };
        const b = { f: [], c: [], m: P.m, flips: P.flips, L: P.L, first: P.first };
        const n = P.c.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const si = s[i], sj = s[j];
          if (si >= -1e-7) { a.f.push(P.f[i]); a.c.push(P.c[i]); }
          if (si <= 1e-7) { b.f.push(P.f[i]); b.c.push(P.c[i]); }
          if ((si > 1e-7 && sj < -1e-7) || (si < -1e-7 && sj > 1e-7)) {
            const t = si / (si - sj);
            const fi = P.f[i], fj = P.f[j], ci = P.c[i], cj = P.c[j];
            const fp = [fi[0] + (fj[0] - fi[0]) * t, fi[1] + (fj[1] - fi[1]) * t];
            const cp = [ci[0] + (cj[0] - ci[0]) * t, ci[1] + (cj[1] - ci[1]) * t, ci[2] + (cj[2] - ci[2]) * t];
            a.f.push(fp); a.c.push(cp); b.f.push(fp); b.c.push(cp);
          }
        }
        if (a.f.length >= 3) next.push(a);
        if (b.f.length >= 3) next.push(b);
      }
      polys = next;
    }

    const isMember = (P) => inHalf(P) && (!F.side || Math.sign(sd(centroid(P.c))) === F.side);
    const members = polys.filter(isMember);
    members.forEach((P) => { P.m |= 1 << k; });
    anchors.forEach((an, i) => {
      if (i === F.ia || i === F.ib) return;
      const inside = (!F.half || Math.sign(an.f[0]) === F.half) && (!F.side || Math.sign(sd(an.c)) === F.side && Math.abs(sd(an.c)) > 1e-6);
      if (F.half && !F.side && Math.abs(an.f[0]) < 1e-9) return;   // on the spine itself
      if (inside) an.m |= 1 << k;
    });

    // which way is "over" for this hinge
    const c0 = centroid(members[0].c);
    const z = u2[0] * (c0[1] - A[1]) - u2[1] * (c0[0] - A[0]);
    F.sign = F.dir * (z > 0 ? 1 : -1);

    if (F.flat) {
      const u3 = [u2[0], u2[1], 0];
      const moving = new Set(members);
      const rest = polys.filter((P) => !moving.has(P));
      const maxMov = Math.max(...members.map((P) => P.L)), minMov = Math.min(...members.map((P) => P.L));
      const maxRest = rest.length ? Math.max(...rest.map((P) => P.L)) : 0;
      const minRest = rest.length ? Math.min(...rest.map((P) => P.L)) : 0;
      for (const P of members) {
        P.c = P.c.map((v) => rotate(v, A, u3, F.sign * F.flat));
        P.L = F.dir > 0 ? maxRest + 1 + (maxMov - P.L) : minRest - 1 - (P.L - minMov);
        P.flips++;
        if (P.first < 0) P.first = k;
      }
      anchors.forEach((an) => { if (an.m & (1 << k)) an.c = rotate(an.c, A, u3, F.sign * F.flat); });
    }
  });
  // compact the stacking order to consecutive ranks (keeps the stack thin)
  const ranks = [...new Set(polys.map((P) => P.L))].sort((a, b) => a - b);
  for (const P of polys) P.L = ranks.indexOf(P.L) - ranks.indexOf(0);
  return { polys, anchors };
}

const pattern = buildCreasePattern();

// one non-indexed mesh: each facet a fan of triangles with its own (flat-shaded) normal
const verts = [];
const uvs = [];
const masks = [];
const firsts = [];
for (const P of pattern.polys) {
  const z = (P.flips % 2 ? -1 : 1) * P.L * LAYER;
  for (let i = 1; i < P.f.length - 1; i++) {
    for (const v of [P.f[0], P.f[i], P.f[i + 1]]) {
      verts.push(v[0], v[1], z);
      uvs.push(v[0] / SW + 0.5, v[1] / SH + 0.5);
      masks.push(P.m);
      firsts.push(P.first);
    }
  }
}
const flat = new Float32Array(verts);
// the deepest flipped facet sits this far below the base layer in the flat sheet
let sink = 0;
for (let i = 2; i < flat.length; i += 3) sink = Math.min(sink, flat[i]);
const NV = flat.length / 3;
const mask = new Uint16Array(masks);
const firstFlip = new Int8Array(firsts);       // the fold that first lays this facet on another
const work = new Float32Array(flat.length);
const anchorFlat = pattern.anchors.map((a) => [a.f[0], a.f[1], 0]);
const anchorMask = pattern.anchors.map((a) => a.m);
const anchorWork = anchorFlat.map((a) => a.slice());

const sheetGeo = new THREE.BufferGeometry();
sheetGeo.setAttribute('position', new THREE.BufferAttribute(work, 3));
sheetGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
const paperMat = new THREE.MeshStandardMaterial({
  map: paperTexture(PAPERS[paperKey]),
  bumpMap: toothTex,
  bumpScale: 0.35,
  roughness: 0.9,
  side: THREE.DoubleSide,
  alphaTest: 0.5,
  emissiveIntensity: 0.16,      // light through the fibres: paper reads brighter than the room
});
const sheet = new THREE.Mesh(sheetGeo, paperMat);
sheet.castShadow = true;
sheet.receiveShadow = false;   // stacked layers sit too close for a shadow map; the bench takes the shadow
sheet.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: paperMat.map, alphaTest: 0.5 });
const rig = new THREE.Group();
rig.add(sheet);
scene.add(rig);

function rotateInPlace(arr, j, A, u, c, s) {
  const vx = arr[j] - A[0], vy = arr[j + 1] - A[1], vz = arr[j + 2] - A[2];
  const d = vx * u[0] + vy * u[1] + vz * u[2];
  const cx = u[1] * vz - u[2] * vy, cy = u[2] * vx - u[0] * vz, cz = u[0] * vy - u[1] * vx;
  arr[j] = A[0] + vx * c + cx * s + u[0] * d * (1 - c);
  arr[j + 1] = A[1] + vy * c + cy * s + u[1] * d * (1 - c);
  arr[j + 2] = A[2] + vz * c + cz * s + u[2] * d * (1 - c);
}

// angles: one value per fold (radians, unsigned; the fold's own sign is applied here)
function applyFolds(angles, prog) {
  work.set(flat);
  // stacking offsets only exist once a facet has actually been laid on another layer,
  // so the open sheet shows no seams
  for (let i = 0; i < NV; i++) {
    const f = firstFlip[i];
    work[i * 3 + 2] = f < 0 ? 0 : flat[i * 3 + 2] * ease(clamp((prog[f] - 0.82) / 0.18, 0, 1));
  }
  anchorFlat.forEach((a, i) => { anchorWork[i][0] = a[0]; anchorWork[i][1] = a[1]; anchorWork[i][2] = a[2]; });
  const A = [0, 0, 0], u = [0, 0, 0], tmp = [0, 0, 0];
  FOLDS.forEach((F, k) => {
    const ang = angles[k] * F.sign;
    if (Math.abs(ang) < 1e-5) return;
    const a = anchorWork[F.ia], b = anchorWork[F.ib];
    A[0] = a[0]; A[1] = a[1]; A[2] = a[2];
    u[0] = b[0] - a[0]; u[1] = b[1] - a[1]; u[2] = b[2] - a[2];
    const l = Math.hypot(u[0], u[1], u[2]);
    u[0] /= l; u[1] /= l; u[2] /= l;
    const c = Math.cos(ang), s = Math.sin(ang), bit = 1 << k;
    for (let i = 0; i < NV; i++) if (mask[i] & bit) rotateInPlace(work, i * 3, A, u, c, s);
    anchorWork.forEach((an, i) => {
      if (!(anchorMask[i] & bit)) return;
      tmp[0] = an[0]; tmp[1] = an[1]; tmp[2] = an[2];
      rotateInPlace(tmp, 0, A, u, c, s);
      an[0] = tmp[0]; an[1] = tmp[1]; an[2] = tmp[2];
    });
  });
  sheetGeo.attributes.position.needsUpdate = true;
  sheetGeo.computeVertexNormals();
  sheetGeo.computeBoundingSphere();
}

/* ---------- flight trail ---------- */
const TRAIL_N = 120;
const trailPts = new Float32Array(TRAIL_N * 3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPts, 3));
const trail = new THREE.Line(trailGeo, new THREE.LineDashedMaterial({ color: 0xb4432f, dashSize: 0.12, gapSize: 0.09, transparent: true, opacity: 0 }));
trail.frustumCulled = false;
scene.add(trail);
const landMark = new THREE.Mesh(
  new THREE.RingGeometry(0.16, 0.19, 48),
  new THREE.MeshBasicMaterial({ color: 0xb4432f, transparent: true, opacity: 0, depthWrite: false }),
);
landMark.rotation.x = -PI / 2;
scene.add(landMark);

const HOLD = new THREE.Vector3(0.05, 1.05, 0.3);
function flightPos(q, p, out) {
  const D = p.dist * 1.05;
  const end = new THREE.Vector3(0.55 + p.drift * 0.8, 0.075, HOLD.z - D);
  const y = lerp(HOLD.y, end.y, Math.pow(q, 1.7)) + p.arc * Math.sin(PI * Math.pow(q, 0.85)) * (1 - q * 0.35);
  return out.set(
    lerp(HOLD.x, end.x, q) + Math.sin(q * PI) * p.drift * 0.7,
    Math.max(end.y, y),
    lerp(HOLD.z, end.z, q),
  );
}

/* ---------- scroll → story ---------- */
const sections = [...document.querySelectorAll('.crease')];
const cards = [...document.querySelectorAll('.card')];
const picker = document.querySelector('.picker');
let centers = [];
function measure() {
  centers = sections.map((s) => s.offsetTop + s.offsetHeight / 2 - innerHeight / 2);
}
function storyStep() {
  const y = scrollY;
  if (y <= centers[0]) return 0;
  for (let k = 0; k < centers.length - 1; k++) {
    if (y < centers[k + 1]) return k + (y - centers[k]) / (centers[k + 1] - centers[k]);
  }
  return centers.length - 1;
}
// the fold for chapter k plays from 0.8 before its centre to 0.12 before it
const win = (s, k, a = 0.8, b = 0.12) => clamp((s - (k - a)) / (a - b), 0, 1);

function poseAt(s, t) {
  const stepped = reduceMotion ? Math.round(s) : s;
  const angles = new Array(FOLDS.length).fill(0);
  const prog = new Array(FOLDS.length).fill(0);
  const u1 = win(stepped, 1);
  angles[0] = u1 < 1 ? Math.sin(PI * ease(u1)) * PI * 0.985 + SPINE_REST * ease(u1) : SPINE_REST;
  // on the opening page the left half breathes, as if a hand were about to take it
  if (!reduceMotion && u1 === 0) angles[0] = (0.5 - 0.5 * Math.cos(t * 1.1)) * 7 * DEG * clamp(1 - s * 1.5, 0, 1);
  const u2 = ease(win(stepped, 2));
  angles[1] = angles[2] = u2 * PI;
  prog[1] = prog[2] = u2;
  const u3 = ease(win(stepped, 3));
  angles[3] = angles[4] = u3 * PI;
  prog[3] = prog[4] = u3;
  const u4 = ease(win(stepped, 4, 0.8, 0.45));             // the keel closes first …
  angles[5] = u4 * (PI - SPINE_REST);
  prog[5] = u4;
  const lift = ease(win(stepped, 4, 0.5, 0.1));            // … then it leaves the bench
  const u5 = ease(win(stepped, 5));
  angles[6] = angles[7] = u5 * PI;
  prog[6] = prog[7] = u5;
  const fly = win(stepped, 6, 0.85, 0.08);
  // ready to fly: the body opens to a V and the wings come level
  const open = ease(clamp(fly * 4, 0, 1));
  angles[5] -= open * 26 * DEG;
  angles[6] -= open * 84 * DEG;
  angles[7] -= open * 84 * DEG;
  return { angles, prog, lift, fly };
}

/* ---------- camera framing (lens shift keeps the subject clear of the copy) ---------- */
const CAM = {
  desk: { pos: new THREE.Vector3(0.05, 4.1, 3.15), look: new THREE.Vector3(0.05, 0, -0.1) },
  air: { pos: new THREE.Vector3(5.7, 1.95, 2.9), look: new THREE.Vector3(0.1, 1.12, -0.65) },
  // portrait: look along the dart's length so it fits a narrow screen
  airTall: { pos: new THREE.Vector3(2.0, 2.4, 4.2), look: new THREE.Vector3(-0.3, 1.1, -0.8) },
  flight: { pos: new THREE.Vector3(3.6, 3.4, 5.2), look: new THREE.Vector3(0.4, 0.3, -4.4) },
};
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function frameCamera() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  let cx, cy;
  if (small()) {
    cx = w / 2;
    cy = h * (h < 700 ? 0.2 : 0.3);
    camera.fov = 44;
  } else {
    const col = document.querySelector('.card')?.getBoundingClientRect();
    const right = col ? Math.min(col.right + 40, w * 0.5) : w * 0.42;
    cx = right + (w - right) * 0.5;
    // keep the subject above the paper picker
    const pickTop = picker?.getBoundingClientRect().top ?? h;
    cy = Math.min(h * 0.47, pickTop * 0.55);
    camera.fov = w / h < 1.3 ? 36 : 30;
  }
  const fw = 2 * Math.max(cx, w - cx), fh = 2 * Math.max(cy, h - cy);
  camera.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, w, h);
  camera.updateProjectionMatrix();
}

/* ---------- UI ---------- */
const ui = {
  note: document.getElementById('picker-note'),
  sheetName: document.getElementById('fl-sheet'),
  dist: document.getElementById('fl-dist'),
  time: document.getElementById('fl-time'),
  flNote: document.getElementById('fl-note'),
  rail: [...document.querySelectorAll('.rail a')],
};
function setPaper(k) {
  paperKey = k;
  const p = PAPERS[k];
  const old = paperMat.map;
  paperMat.map = paperTexture(p);
  sheet.customDepthMaterial.map = paperMat.map;
  paperMat.needsUpdate = true;
  sheet.customDepthMaterial.needsUpdate = true;
  old.dispose();
  document.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.paper === k)));
  paperMat.emissive.set(p.base).convertSRGBToLinear();
  ui.note.textContent = p.note;
  ui.sheetName.textContent = `${p.name} · ${p.gsm} gsm`;
  ui.dist.textContent = p.dist.toFixed(1);
  ui.time.textContent = p.time.toFixed(1);
  ui.flNote.textContent = p.flight;
  dirty = true;
}
document.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => setPaper(b.dataset.paper)));

let lastRail = -1;
function updateRail(s) {
  const k = Math.round(s);
  if (k === lastRail) return;
  lastRail = k;
  ui.rail.forEach((a, i) => {
    if (i === k) a.setAttribute('aria-current', 'step');
    else a.removeAttribute('aria-current');
  });
}

/* ---------- loop ---------- */
let dirty = true;
let sNow = 0;
const clock = new THREE.Clock();
const fp = new THREE.Vector3(), fpNext = new THREE.Vector3(), tmpV = new THREE.Vector3();
const qDesk = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -PI / 2);
const qUp = qDesk.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -PI / 2));
const qFly = new THREE.Quaternion(), mBasis = new THREE.Matrix4();
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  pointer.x = e.clientX / innerWidth - 0.5;
  pointer.y = e.clientY / innerHeight - 0.5;
}, { passive: true });

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const target = storyStep();
  sNow = reduceMotion ? target : sNow + (target - sNow) * Math.min(1, dt * 6);
  updateRail(sNow);
  const { angles, prog, lift, fly } = poseAt(sNow, t);
  applyFolds(angles, prog);

  const p = PAPERS[paperKey];
  if (fly > 0) {
    const q = reduceMotion ? 1 : easeOut(fly);
    flightPos(q, p, fp);
    flightPos(Math.min(1, q + 0.015), p, fpNext);
    // nose (+y) along the path, wings' root (+x) toward the sky, then bank
    const fwd = tmpV.copy(fpNext).sub(fp);
    if (q >= 0.985 || fwd.lengthSq() < 1e-8) fwd.set(0.05, -0.02, -1);
    fwd.normalize();
    const upW = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(upW, fwd).normalize();
    const upL = new THREE.Vector3().crossVectors(fwd, side).normalize();
    mBasis.makeBasis(upL, fwd, new THREE.Vector3().crossVectors(upL, fwd));
    qFly.setFromRotationMatrix(mBasis);
    const bank = (reduceMotion ? 0 : Math.sin(q * PI * 2) * 0.18) * p.drift + (q > 0.97 ? 0.22 : 0);
    qFly.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), bank));
    rig.quaternion.copy(qFly);
    // centre the body on the path: the keel/wing-root stack is ~0.1 off the spine
    rig.position.copy(fp).add(tmpV.set(0, 0, 0).addScaledVector(upL, -0.06));
    for (let i = 0; i < TRAIL_N; i++) {
      flightPos(q * (i / (TRAIL_N - 1)), p, fpNext);
      trailPts[i * 3] = fpNext.x; trailPts[i * 3 + 1] = fpNext.y; trailPts[i * 3 + 2] = fpNext.z;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trail.computeLineDistances();
    trail.material.opacity = Math.min(0.85, fly * 3);
    flightPos(1, p, fpNext);
    landMark.position.set(fpNext.x, 0.003, fpNext.z);
    landMark.material.opacity = clamp((q - 0.9) * 10, 0, 0.7);
  } else {
    rig.quaternion.copy(qDesk).slerp(qUp, lift);
    // on the bench the stack sits on the right half; lifted, the dart is held at HOLD
    const benchPos = tmpV.set(0, 0.002 - sink, 0);
    rig.position.copy(benchPos).lerp(HOLD, lift);
    if (!reduceMotion && lift > 0) rig.position.y += Math.sin(t * 1.3) * 0.015 * lift;
    trail.material.opacity = 0;
    landMark.material.opacity = 0;
  }

  // camera between bench, hand and flight
  const air = lift, far = ease(clamp(fly * 1.4, 0, 1));
  const A = small() ? CAM.airTall : CAM.air;
  camPos.copy(CAM.desk.pos).lerp(A.pos, air).lerp(CAM.flight.pos, far);
  camLook.copy(CAM.desk.look).lerp(A.look, air).lerp(CAM.flight.look, far);
  // portrait screens are narrow: stand further back along the same line of sight
  if (small()) camPos.sub(camLook).multiplyScalar(lerp(1.45, 1.25, far)).add(camLook);
  if (!reduceMotion) {
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    camPos.x += pointer.sx * 0.35 + Math.sin(t * 0.21) * 0.04;
    camPos.y += -pointer.sy * 0.2;
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  key.target.position.copy(camLook).setY(0);
  // light from the bench's left while it lies flat; from the camera's side once it's lifted
  key.position.copy(key.target.position).add(tmpV.set(lerp(-3.2, 3.4, air), lerp(6.5, 5.6, air), lerp(3.4, 2.6, air)));
  key.intensity = lerp(2.5, 3.3, air * (1 - far));
  // chapters fade near the top and bottom so they never pile up under the masthead;
  // on phones a card fades in as it rises clear of the picker, stays solid while it sticks,
  // and fades out as it leaves its resting place so it never lingers over the next fold
  const pickTop = small() ? picker.getBoundingClientRect().top : 0;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    const mid = (r.top + r.bottom) / 2 / innerHeight;
    const low = small()
      ? Math.min((pickTop - r.top) / (r.height * 0.6), (0.36 - (pickTop - r.bottom) / innerHeight) / 0.2)
      : (0.98 - mid) / 0.2;
    c.style.opacity = String(clamp(Math.min((mid - 0.08) / 0.2, low), 0, 1));
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  measure();
  frameCamera();
}
addEventListener('resize', onResize);
document.fonts?.ready.then(() => { setPaper(paperKey); onResize(); });
onResize();
setPaper(paperKey);
frame();
