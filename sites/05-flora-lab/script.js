(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
  // phones (and short landscape phones) keep the perfume card folded so the soil stays free
  const compactCard = isSmallScreen || window.innerHeight <= 520;

  const canvas = document.getElementById('garden');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, isSmallScreen || lowPower ? 1.5 : 2);
  const SPRITE_RES = 2;     // sprites are drawn at 2x so they stay crisp when scaled up

  /* ----------------------------------------------------------------
     The five botanicals
  ---------------------------------------------------------------- */
  const SPECIES = {
    rose: { label: 'Damask Rose', role: 'heart', color: '#c4577d', stem: '#4c6140', leaf: '#5f7b45', adj: 'Velvet', noun: 'Garden', note: 'velvet rose' },
    iris: { label: 'Orris Iris', role: 'heart', color: '#7d6cc6', stem: '#57714e', leaf: '#6f8c66', adj: 'Powder', noun: 'Hour', note: 'cool orris powder' },
    jasmine: { label: 'Night Jasmine', role: 'top', color: '#efe6c6', stem: '#4d6542', leaf: '#476a3b', adj: 'Midnight', noun: 'Letter', note: 'night jasmine' },
    marigold: { label: 'Wild Marigold', role: 'top', color: '#e6892e', stem: '#5b6b3c', leaf: '#5e7a3e', adj: 'Ember', noun: 'Field', note: 'bright green fire' },
    vetiver: { label: 'Vetiver', role: 'base', color: '#8a9a5c', stem: '#7f9158', leaf: '#8a9c5e', adj: 'Smoke', noun: 'Root', note: 'smoke and earth' },
  };
  const ORDER = ['rose', 'iris', 'jasmine', 'marigold', 'vetiver'];

  /* ----------------------------------------------------------------
     Layout
  ---------------------------------------------------------------- */
  let W = 0, H = 0, horizon = 0, soilBottom = 0;
  const bg = document.createElement('canvas');
  const bgx = bg.getContext('2d');

  function size() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const portrait = W <= 768;
    horizon = H * (portrait ? 0.4 : 0.5);
    // the soil ends just above the seed tray, so every plantable spot is visible
    const trayTop = document.querySelector('.seed-tray').getBoundingClientRect().top;
    soilBottom = Math.max(horizon + 60, Math.min(H - 20, trayTop - 10));
    viewScale = Math.max(0.7, Math.min(1.3, H / 900)) * (portrait ? 0.86 : 1);
    scatterTufts();
    paintBackground();
    measureBottle();
  }

  const depthOf = (y) => Math.max(0, Math.min(1, (y - horizon) / (soilBottom - horizon)));
  let viewScale = 1;
  const scaleOf = (y) => (0.42 + depthOf(y) * 1.18) * viewScale;

  /* ----------------------------------------------------------------
     Small helpers
  ---------------------------------------------------------------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ----------------------------------------------------------------
     Background: paper sky, sage hills, textured soil (static)
  ---------------------------------------------------------------- */
  function paintBackground() {
    bg.width = Math.round(W * DPR);
    bg.height = Math.round(H * DPR);
    const g = bgx;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = '#f6f2e8';
    g.fillRect(0, 0, W, H);
    // warm light from the upper right
    const sun = g.createRadialGradient(W * 0.74, H * 0.2, 0, W * 0.74, H * 0.2, Math.max(W, H) * 0.7);
    sun.addColorStop(0, 'rgba(255, 236, 196, 0.75)');
    sun.addColorStop(0.4, 'rgba(250, 232, 200, 0.25)');
    sun.addColorStop(1, 'rgba(246, 242, 232, 0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, W, H);
    // three layers of hills, paler with distance
    const hills = [
      { y: horizon - H * 0.1, amp: H * 0.05, col: 'rgba(160, 176, 140, 0.18)', f: 0.0032, ph: 1.3 },
      { y: horizon - H * 0.05, amp: H * 0.035, col: 'rgba(140, 158, 118, 0.24)', f: 0.0051, ph: 4.1 },
      { y: horizon - H * 0.012, amp: H * 0.018, col: 'rgba(125, 143, 98, 0.3)', f: 0.008, ph: 2.2 },
    ];
    for (const h of hills) {
      g.fillStyle = h.col;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W + 10; x += 10) {
        const y = h.y - (Math.sin(x * h.f + h.ph) * 0.6 + Math.sin(x * h.f * 2.3 + h.ph * 1.7) * 0.3 + Math.sin(x * h.f * 5.1) * 0.1) * h.amp;
        g.lineTo(x, y);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    }
    // soil: a soft bed from the horizon down
    const soil = g.createLinearGradient(0, horizon, 0, H);
    soil.addColorStop(0, 'rgba(192, 202, 160, 0.6)');
    soil.addColorStop(0.3, 'rgba(184, 186, 142, 0.78)');
    soil.addColorStop(0.75, 'rgba(160, 150, 112, 0.9)');
    soil.addColorStop(1, 'rgba(138, 122, 90, 0.95)');
    g.fillStyle = soil;
    g.beginPath();
    g.moveTo(0, horizon + 6);
    for (let x = 0; x <= W + 10; x += 12) g.lineTo(x, horizon + Math.sin(x * 0.01) * 3 + Math.sin(x * 0.031) * 1.5);
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.closePath();
    g.fill();
    // furrows curving toward the viewer
    g.strokeStyle = 'rgba(110, 96, 66, 0.12)';
    for (let k = 1; k < 9; k++) {
      const d = k / 9;
      const y = horizon + (soilBottom - horizon) * d * d;
      g.lineWidth = 0.6 + d * 1.6;
      g.beginPath();
      for (let x = -20; x <= W + 20; x += 16) g.lineTo(x, y + Math.sin(x * 0.006 + k) * (2 + d * 6));
      g.stroke();
    }
    // mulch and grit, denser and larger toward the front
    const n = Math.round((W * (H - horizon)) / 140);
    for (let i = 0; i < n; i++) {
      const y = horizon + Math.pow(Math.random(), 0.7) * (H - horizon);
      const d = depthOf(y);
      const x = Math.random() * W;
      const r = (0.3 + Math.random() * 1.1) * (0.5 + d);
      const tone = Math.random();
      g.fillStyle = tone < 0.6 ? `rgba(98, 80, 52, ${0.12 + d * 0.22})` : tone < 0.85 ? `rgba(240, 232, 210, ${0.25 + d * 0.2})` : `rgba(120, 140, 90, ${0.15 + d * 0.2})`;
      g.beginPath();
      g.ellipse(x, y, r * 1.4, r, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // a soft vignette pulls the eye to the bed
    const vig = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.hypot(W, H) * 0.62);
    vig.addColorStop(0, 'rgba(60, 50, 30, 0)');
    vig.addColorStop(1, 'rgba(60, 50, 30, 0.16)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);
    // paper grain over everything
    const grain = makeCanvas(160, 160);
    const gg = grain.getContext('2d');
    const img = gg.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.random() * 60;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 10;
    }
    gg.putImageData(img, 0, 0);
    g.fillStyle = g.createPattern(grain, 'repeat');
    g.fillRect(0, 0, W, H);
  }

  /* ----------------------------------------------------------------
     Sprites: blooms at several stages of opening, and leaves
  ---------------------------------------------------------------- */
  const STAGES = 8;
  const BS = 160 * SPRITE_RES;       // bloom sprite size
  const SPRITES = {};

  function petal(g, x, y, w, h, rot, c1, c2, edge = 0.22) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const grd = g.createLinearGradient(0, h * 0.5, 0, -h * 0.5);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, h * 0.5);
    g.bezierCurveTo(w * 0.62, h * 0.35, w * 0.58, -h * 0.5, 0, -h * 0.5);
    g.bezierCurveTo(-w * 0.58, -h * 0.5, -w * 0.62, h * 0.35, 0, h * 0.5);
    g.fill();
    g.strokeStyle = `rgba(80, 30, 45, ${edge})`;
    g.lineWidth = Math.max(1, w * 0.025);
    g.stroke();
    g.restore();
  }

  function sepals(g, cx, cy, R, spread, col = '#4a6a37') {
    g.fillStyle = col;
    for (const k of [-1.15, -0.45, 0.45, 1.15]) {
      const a = -Math.PI / 2 + k * spread;
      g.save();
      g.translate(cx, cy);
      g.rotate(a + Math.PI / 2);
      g.beginPath();
      g.moveTo(-R * 0.06, 0);
      g.quadraticCurveTo(-R * 0.08, -R * 0.35, 0, -R * 0.6);
      g.quadraticCurveTo(R * 0.08, -R * 0.35, R * 0.06, 0);
      g.fill();
      g.restore();
    }
  }

  // a broad cupped petal seen from the side: base at (0,0), lip at (0,-h)
  function rosePetal(g, x, y, w, h, tilt, c1, c2) {
    g.save();
    g.translate(x, y);
    g.rotate(tilt);
    const grd = g.createLinearGradient(0, 0, 0, -h);
    grd.addColorStop(0, c1);
    grd.addColorStop(0.75, c2);
    grd.addColorStop(1, '#f6c3d3');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-w * 0.16, 0);
    g.bezierCurveTo(-w * 0.56, -h * 0.22, -w * 0.62, -h * 0.84, -w * 0.34, -h);
    g.quadraticCurveTo(0, -h * 1.1, w * 0.34, -h);
    g.bezierCurveTo(w * 0.62, -h * 0.84, w * 0.56, -h * 0.22, w * 0.16, 0);
    g.closePath();
    g.fill();
    // the rolled lip catches the light; a soft shadow sits under it
    g.strokeStyle = 'rgba(255, 226, 234, 0.55)';
    g.lineWidth = Math.max(1, h * 0.05);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-w * 0.36, -h * 0.97);
    g.quadraticCurveTo(0, -h * 1.07, w * 0.36, -h * 0.97);
    g.stroke();
    g.strokeStyle = 'rgba(110, 20, 50, 0.22)';
    g.lineWidth = Math.max(1, h * 0.04);
    g.beginPath();
    g.moveTo(-w * 0.3, -h * 0.86);
    g.quadraticCurveTo(0, -h * 0.94, w * 0.3, -h * 0.86);
    g.stroke();
    g.restore();
  }

  function drawRose(g, o) {
    const cx = BS / 2, cy = BS * 0.78, R = BS * 0.3;
    sepals(g, cx, cy, R, 0.5 + o * 0.7);
    g.fillStyle = '#56743d';
    g.beginPath(); g.ellipse(cx, cy - R * 0.04, R * 0.15, R * 0.12, 0, 0, Math.PI * 2); g.fill();
    if (o < 0.3) {
      const k = o / 0.3;
      rosePetal(g, cx, cy - R * 0.05, R * (0.42 + k * 0.2), R * (0.8 + k * 0.2), 0, '#6e1838', '#c45a80');
      rosePetal(g, cx + R * 0.05, cy - R * 0.05, R * (0.3 + k * 0.16), R * (0.62 + k * 0.14), 0.12, '#8a2248', '#d77196');
      return;
    }
    const p = (o - 0.3) / 0.7;
    const base = cy - R * 0.08;
    // seen a little from the side, a rose is about as tall as it is wide
    g.save();
    g.translate(cx, base);
    g.scale(1, 1.28);
    g.translate(-cx, -base);
    // back petals, fanning open
    for (const [dx, t] of [[-0.42, -0.42], [0.42, 0.42], [0, 0]]) {
      rosePetal(g, cx + dx * R * (0.5 + p * 0.5), base, R * (0.7 + p * 0.25), R * (0.95 + p * 0.12), t * (0.4 + p * 0.6), '#7a1c3d', '#c75b82');
    }
    // the cupped heart, wound tight
    const hy = base - R * 0.72;
    const cg = g.createRadialGradient(cx, hy + R * 0.1, R * 0.02, cx, hy, R * 0.34);
    cg.addColorStop(0, '#4f0c22');
    cg.addColorStop(0.55, '#8d2448');
    cg.addColorStop(1, '#cf6f92');
    g.fillStyle = cg;
    g.beginPath(); g.ellipse(cx, hy, R * 0.34, R * 0.2, 0, 0, Math.PI * 2); g.fill();
    // the innermost petals, curled over the centre
    g.strokeStyle = 'rgba(250, 190, 210, 0.5)';
    g.lineWidth = R * 0.028;
    g.lineCap = 'round';
    g.beginPath(); g.arc(cx - R * 0.06, hy + R * 0.02, R * 0.14, Math.PI * 1.1, Math.PI * 1.85); g.stroke();
    g.beginPath(); g.arc(cx + R * 0.07, hy + R * 0.05, R * 0.12, Math.PI * 1.25, Math.PI * 2.0); g.stroke();
    // side petals reflex outward as the bloom opens
    for (const s of [-1, 1]) {
      rosePetal(g, cx + s * R * (0.28 + p * 0.22), base + R * 0.02, R * (0.62 + p * 0.2), R * (0.62 + p * 0.06), s * (0.3 + p * 0.42), '#93294f', '#e08aa8');
    }
    // two wrapping petals and a front petal hold the cup
    for (const s of [-1, 1]) {
      rosePetal(g, cx + s * R * 0.17, base, R * 0.62, R * (0.6 - p * 0.04), s * 0.18 * p, '#a3335b', '#ea9db7');
    }
    rosePetal(g, cx, base + R * 0.02, R * (0.78 + p * 0.12), R * (0.5 - p * 0.06), 0, '#b0406a', '#f2b0c5');
    g.restore();
  }

  function drawIris(g, o) {
    const cx = BS / 2, cy = BS * 0.75, R = BS * 0.3;
    // green spathe
    g.fillStyle = '#5f7f52';
    g.beginPath();
    g.moveTo(cx - R * 0.12, cy);
    g.quadraticCurveTo(cx - R * 0.2, cy - R * 0.3, cx - R * 0.04, cy - R * 0.5);
    g.lineTo(cx + R * 0.1, cy - R * 0.2);
    g.quadraticCurveTo(cx + R * 0.14, cy - R * 0.05, cx + R * 0.1, cy);
    g.fill();
    if (o < 0.35) {
      const k = o / 0.35;
      petal(g, cx, cy - R * (0.6 + k * 0.15), R * (0.2 + k * 0.14), R * (0.85 + k * 0.25), 0.04, '#3f2f8d', '#9283dc', 0.25);
      return;
    }
    const p = easeOut((o - 0.35) / 0.65);
    const base = cy - R * 0.55;
    // standards: upright, paler
    [[0, 1], [-0.55, 0.82], [0.55, 0.82]].forEach(([a, len]) => {
      g.save();
      g.translate(cx, base);
      g.rotate(a * p);
      petal(g, 0, -R * 0.42 * len * (0.7 + p * 0.3), R * 0.36, R * 0.8 * len, 0, '#7563c9', '#c9c0f4', 0.18);
      g.restore();
    });
    // falls: drooping, deep violet with a golden beard
    [[0, 1], [-1.05, 0.9], [1.05, 0.9]].forEach(([a, len]) => {
      g.save();
      g.translate(cx, base + R * 0.05);
      g.rotate(Math.PI + a * (0.4 + p * 0.6));
      const h = R * 0.95 * len * (0.45 + p * 0.55);
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#3a2a86');
      grd.addColorStop(0.55, '#6b59c0');
      grd.addColorStop(1, '#a396e6');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(R * 0.36, h * 0.2, R * 0.34, h * 0.95, 0, h);
      g.bezierCurveTo(-R * 0.34, h * 0.95, -R * 0.36, h * 0.2, 0, 0);
      g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      g.lineWidth = R * 0.015;
      for (const v of [-0.12, 0, 0.12]) { g.beginPath(); g.moveTo(0, h * 0.1); g.quadraticCurveTo(R * v, h * 0.5, R * v * 1.6, h * 0.85); g.stroke(); }
      g.strokeStyle = '#f3c74e';
      g.lineWidth = R * 0.07;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, h * 0.08); g.lineTo(0, h * 0.42); g.stroke();
      g.restore();
    });
  }

  function drawJasmine(g, o) {
    const cx = BS / 2, cy = BS / 2, R = BS * 0.3;
    if (o < 0.4) {
      const k = o / 0.4;
      g.save();
      g.translate(cx, cy + R * 0.3);
      petal(g, 0, -R * 0.45, R * (0.16 + k * 0.1), R * (0.7 + k * 0.2), 0, '#e9c9cf', '#fffaf0', 0.15);
      g.restore();
      return;
    }
    const p = easeOut((o - 0.4) / 0.6);
    // tube shadow
    g.fillStyle = 'rgba(120, 100, 70, 0.1)';
    g.beginPath(); g.ellipse(cx + R * 0.04, cy + R * 0.06, R * 0.3 * p, R * 0.24 * p, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2 + 0.2;
      const len = R * (0.32 + p * 0.38);
      const x = cx + Math.cos(a) * len * 0.55, y = cy + Math.sin(a) * len * 0.55 * 0.85;
      g.save();
      g.translate(x, y);
      g.rotate(a + Math.PI / 2);
      g.scale(1, 0.92);
      const grd = g.createLinearGradient(0, len * 0.5, 0, -len * 0.5);
      grd.addColorStop(0, '#f4dfe2');
      grd.addColorStop(0.35, '#fffdf6');
      grd.addColorStop(1, '#fffef9');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, len * 0.5);
      g.bezierCurveTo(len * 0.36, len * 0.2, len * 0.3, -len * 0.5, 0, -len * 0.5);
      g.bezierCurveTo(-len * 0.3, -len * 0.5, -len * 0.36, len * 0.2, 0, len * 0.5);
      g.fill();
      g.strokeStyle = 'rgba(150, 130, 100, 0.25)';
      g.lineWidth = Math.max(1, R * 0.012);
      g.stroke();
      g.restore();
    }
    g.fillStyle = '#d9cf7a';
    g.beginPath(); g.arc(cx, cy, R * 0.08, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a7a04e';
    g.beginPath(); g.arc(cx, cy, R * 0.035, 0, Math.PI * 2); g.fill();
  }

  function drawMarigold(g, o) {
    const cx = BS / 2, cy = BS * 0.75, R = BS * 0.3;
    sepals(g, cx, cy, R * 0.7, 0.7, '#557035');
    if (o < 0.3) {
      const k = o / 0.3;
      g.fillStyle = '#5a7a39';
      g.beginPath(); g.ellipse(cx, cy - R * 0.28, R * (0.24 + k * 0.08), R * (0.28 + k * 0.06), 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ef9a35';
      g.beginPath(); g.ellipse(cx, cy - R * (0.5 + k * 0.04), R * (0.1 + k * 0.12), R * 0.08, 0, 0, Math.PI * 2); g.fill();
      return;
    }
    const p = easeOut((o - 0.3) / 0.7);
    const top = cy - R * 0.55;
    const cols = ['#c9561a', '#e0741f', '#f08f2a', '#f6a43a', '#fbbb4f'];
    for (let k = 0; k < 6; k++) {
      const rk = R * (0.9 - k * 0.13) * (0.45 + p * 0.55);
      const n = 18 - k * 2;
      const yOff = top + k * R * 0.045;
      for (let side = 0; side < 2; side++) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + k * 0.37;
          if ((Math.sin(a) > 0) !== (side === 1)) continue;   // back half first
          const x = cx + Math.cos(a) * rk, y = yOff + Math.sin(a) * rk * 0.48;
          g.fillStyle = cols[(i + k) % 2 === 0 ? Math.min(4, k) : Math.max(0, k - 1)];
          g.beginPath();
          g.ellipse(x, y, R * (0.17 - k * 0.012), R * (0.11 - k * 0.006), a, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(120, 40, 10, 0.18)';
          g.lineWidth = Math.max(1, R * 0.01);
          g.stroke();
        }
      }
    }
    g.fillStyle = '#8c3c12';
    g.beginPath(); g.ellipse(cx, top + R * 0.25, R * 0.1, R * 0.06, 0, 0, Math.PI * 2); g.fill();
  }

  const LS = 120 * SPRITE_RES;   // leaf sprite width (tip to the right)
  function leafSprite(kind) {
    const c = makeCanvas(LS, LS / 2);
    const g = c.getContext('2d');
    const h = LS / 2, mid = h / 2;
    if (kind === 'feather') {
      g.strokeStyle = '#557035';
      g.lineWidth = LS * 0.02;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, mid); g.quadraticCurveTo(LS * 0.5, mid - h * 0.06, LS * 0.96, mid - h * 0.1); g.stroke();
      g.fillStyle = '#617f40';
      for (let i = 1; i < 9; i++) {
        const t = i / 9;
        const x = LS * 0.96 * t, y = mid - h * 0.1 * t * t;
        const len = LS * 0.13 * (1 - t * 0.6);
        for (const s of [-1, 1]) {
          g.save(); g.translate(x, y); g.rotate(s * 0.9 - 0.2);
          g.beginPath(); g.ellipse(len * 0.5, 0, len * 0.55, len * 0.16, 0, 0, Math.PI * 2); g.fill();
          g.restore();
        }
      }
      return c;
    }
    const [c1, c2] = kind === 'gloss' ? ['#2f4d29', '#5c8348'] : ['#4b6a33', '#7a9654'];
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, c2);
    grd.addColorStop(1, c1);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, mid);
    const steps = 18;
    for (let i = 0; i <= steps; i++) {       // upper edge, serrated for rose
      const t = i / steps;
      const w = Math.sin(Math.PI * Math.pow(t, 0.85)) * h * 0.4;
      const tooth = kind === 'serrate' && i % 2 ? h * 0.05 : 0;
      g.lineTo(LS * t, mid - w - tooth);
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const w = Math.sin(Math.PI * Math.pow(t, 0.85)) * h * 0.4;
      const tooth = kind === 'serrate' && i % 2 ? h * 0.05 : 0;
      g.lineTo(LS * t, mid + w + tooth);
    }
    g.fill();
    g.strokeStyle = 'rgba(230, 240, 200, 0.45)';
    g.lineWidth = LS * 0.012;
    g.beginPath(); g.moveTo(LS * 0.02, mid); g.lineTo(LS * 0.95, mid); g.stroke();
    g.lineWidth = LS * 0.006;
    for (let i = 1; i < 6; i++) {
      const x = LS * i / 6.5;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, mid); g.lineTo(x + LS * 0.08, mid + s * h * 0.26); g.stroke(); }
    }
    if (kind === 'gloss') {
      g.fillStyle = 'rgba(255, 255, 255, 0.18)';
      g.beginPath(); g.ellipse(LS * 0.45, mid - h * 0.14, LS * 0.22, h * 0.06, -0.05, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  function buildSprites() {
    const painters = { rose: drawRose, iris: drawIris, jasmine: drawJasmine, marigold: drawMarigold };
    for (const sp of Object.keys(painters)) {
      SPRITES[sp] = Array.from({ length: STAGES }, (_, i) => {
        const c = makeCanvas(BS, BS);
        painters[sp](c.getContext('2d'), i / (STAGES - 1));
        return c;
      });
    }
    SPRITES.leaf = { serrate: leafSprite('serrate'), gloss: leafSprite('gloss'), feather: leafSprite('feather') };
  }

  /* ----------------------------------------------------------------
     Growth habits: each plant is a set of branches made of segments
  ---------------------------------------------------------------- */
  function branch(opts) {
    return Object.assign({ parent: -1, at: 0, rel: 0, segs: [], w0: 2, w1: 0.8, start: 0, dur: 3, flex: 1, leaves: [], bloom: null, blade: false, plume: false }, opts);
  }
  function segs(n, total, bend, jitter = 0.08) {
    return Array.from({ length: n }, (_, i) => ({ len: total / n, bend: (i === 0 ? 0 : bend) + (Math.random() - 0.5) * jitter }));
  }

  const HABITS = {
    rose(s) {
      const B = [];
      const H0 = rand(150, 210) * s;
      B.push(branch({ segs: segs(7, H0, rand(-0.04, 0.04)), rel: -Math.PI / 2 + rand(-0.12, 0.12), w0: 3.6 * s, w1: 1.6 * s, dur: 3.6, flex: 0.8,
        bloom: { size: rand(0.95, 1.15) * s },
        leaves: [1, 2, 3, 4, 5].map((k, i) => ({ seg: k, side: i % 2 ? 1 : -1, size: (0.5 - k * 0.04) * s, kind: 'rose' })) }));
      const nb = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < nb; i++) {
        const side = i % 2 ? 1 : -1;
        B.push(branch({ parent: 0, at: 3 + i, rel: side * rand(0.45, 0.8), segs: segs(4, H0 * rand(0.3, 0.42), -side * 0.08), w0: 2.2 * s, w1: 1.2 * s,
          start: 1.4 + i * 0.5, dur: 2.4, flex: 1, bloom: { size: rand(0.7, 0.9) * s },
          leaves: [{ seg: 1, side: -side, size: 0.36 * s, kind: 'rose' }] }));
      }
      return B;
    },
    iris(s) {
      const B = [];
      const H0 = rand(220, 290) * s;
      B.push(branch({ segs: segs(9, H0, rand(-0.02, 0.02), 0.03), rel: -Math.PI / 2 + rand(-0.06, 0.06), w0: 3 * s, w1: 2 * s, dur: 4.2, flex: 0.6,
        bloom: { size: rand(1.05, 1.25) * s } }));
      // basal sword leaves
      const nl = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < nl; i++) {
        const lean = (i / (nl - 1) - 0.5) * 0.9 + rand(-0.06, 0.06);
        B.push(branch({ segs: segs(6, H0 * rand(0.5, 0.78), lean * 0.06, 0.02), rel: -Math.PI / 2 + lean * 0.5, w0: 9 * s, w1: 0.5 * s,
          start: rand(0, 0.6), dur: 3.2, flex: 1.1, blade: true }));
      }
      // a second, later bud on a short side stalk
      if (Math.random() < 0.6) B.push(branch({ parent: 0, at: 5, rel: rand(0.3, 0.5) * (Math.random() < 0.5 ? -1 : 1), segs: segs(2, H0 * 0.16, 0), w0: 2 * s, w1: 1.5 * s, start: 3.4, dur: 1.4, bloom: { size: 0.8 * s } }));
      return B;
    },
    jasmine(s) {
      const B = [];
      const H0 = rand(170, 230) * s;
      const lean = Math.random() < 0.5 ? -1 : 1;
      B.push(branch({ segs: segs(9, H0, lean * 0.1, 0.05), rel: -Math.PI / 2 + lean * 0.12, w0: 2.6 * s, w1: 1 * s, dur: 4, flex: 1.3,
        bloom: { size: 0.55 * s, cluster: 3 },
        leaves: [1, 2, 3, 4, 5, 6, 7].flatMap((k) => [{ seg: k, side: -1, size: 0.22 * s, kind: 'jasmine' }, { seg: k, side: 1, size: 0.22 * s, kind: 'jasmine' }]) }));
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 1 : -1;
        B.push(branch({ parent: 0, at: 3 + i, rel: side * rand(0.6, 1.0), segs: segs(3, H0 * rand(0.2, 0.3), lean * 0.1), w0: 1.5 * s, w1: 0.8 * s,
          start: 1.6 + i * 0.4, dur: 1.8, flex: 1.4, bloom: { size: 0.5 * s, cluster: 2 + (i % 2) },
          leaves: [{ seg: 1, side: -1, size: 0.18 * s, kind: 'jasmine' }, { seg: 1, side: 1, size: 0.18 * s, kind: 'jasmine' }] }));
      }
      return B;
    },
    marigold(s) {
      const B = [];
      const n = 4 + Math.floor(Math.random() * 3);
      const H0 = rand(110, 160) * s;
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0 : i / (n - 1) - 0.5;
        B.push(branch({ segs: segs(4, H0 * rand(0.75, 1.05), f * 0.08), rel: -Math.PI / 2 + f * 0.9, w0: 2.6 * s, w1: 1.4 * s,
          start: rand(0, 0.8), dur: 3, flex: 0.9, bloom: { size: rand(0.75, 1) * s },
          leaves: [{ seg: 1, side: -1, size: 0.34 * s, kind: 'marigold' }, { seg: 2, side: 1, size: 0.3 * s, kind: 'marigold' }] }));
      }
      return B;
    },
    vetiver(s) {
      const B = [];
      const n = 11 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1) - 0.5;
        const H0 = rand(170, 270) * s * (1 - Math.abs(f) * 0.5);
        const plume = i % 4 === 1;
        B.push(branch({ segs: segs(8, H0, f * 0.11, 0.03), rel: -Math.PI / 2 + f * 0.75, w0: (plume ? 2 : 4.2) * s, w1: 0.4 * s,
          start: rand(0, 1), dur: rand(3, 4.2), flex: 1.6, blade: !plume, plume }));
      }
      return B;
    },
  };

  /* ----------------------------------------------------------------
     Garden state
  ---------------------------------------------------------------- */
  const plants = [];
  const MAX_PLANTS = isSmallScreen ? 16 : 34;
  let selected = 'rose';
  let clock = 0;               // seconds; frozen in reduced motion

  function plantAt(x, y, species = selected, delay = 0) {
    const gy = Math.max(horizon + 4, Math.min(soilBottom, y));
    const s = scaleOf(gy);
    const p = {
      sp: species, x, y: gy, scale: s, depth: depthOf(gy),
      born: clock + (prefersReducedMotion ? -60 : delay), wiltAt: null,
      branches: HABITS[species](s),
      heads: 0,
      seed: Math.random() * 100,
    };
    p.heads = p.branches.filter((b) => b.bloom || b.plume).length || 1;
    plants.push(p);
    plants.sort((a, b) => a.y - b.y);
    // a garden that's full lets its oldest plant go, gently
    const alive = plants.filter((q) => q.wiltAt === null);
    if (alive.length > MAX_PLANTS) {
      const oldest = alive.reduce((a, b) => (a.born < b.born ? a : b));
      oldest.wiltAt = clock;
    }
    if (delay === 0) burst(x, gy, species);
    schedulePerfume();
    if (prefersReducedMotion) requestStill();
    return p;
  }

  /* ----------------------------------------------------------------
     Wind: a noise field plus gusts from the cursor
  ---------------------------------------------------------------- */
  const gusts = [];
  function wind(x, t) {
    if (prefersReducedMotion) return 0;
    let w = 0.07 * Math.sin(t * 0.8 + x * 0.0042) + 0.045 * Math.sin(t * 1.9 + x * 0.013 + 1.3) + 0.02 * Math.sin(t * 3.7 + x * 0.03);
    for (const g of gusts) {
      const age = t - g.t;
      w += g.s * Math.exp(-age * 1.6) * Math.exp(-(((x - g.x) / 140) ** 2));
    }
    return w;
  }

  /* ----------------------------------------------------------------
     Drawing plants
  ---------------------------------------------------------------- */
  function ribbon(pts, w0, w1, fill, highlight) {
    if (pts.length < 2) return;
    // one pass of Chaikin smoothing keeps stems curved, not jointed
    const sm = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      sm.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    sm.push(pts[pts.length - 1]);
    const left = [], right = [];
    for (let i = 0; i < sm.length; i++) {
      const p = sm[i], q = sm[Math.min(sm.length - 1, i + 1)], r = sm[Math.max(0, i - 1)];
      let dx = q[0] - r[0], dy = q[1] - r[1];
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      const w = (w0 + (w1 - w0) * (i / (sm.length - 1))) / 2;
      left.push([p[0] - dy * w, p[1] + dx * w]);
      right.push([p[0] + dy * w, p[1] - dx * w]);
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
    if (highlight) {
      ctx.strokeStyle = highlight;
      ctx.lineWidth = Math.max(0.6, w0 * 0.18);
      ctx.beginPath();
      ctx.moveTo(sm[0][0], sm[0][1]);
      for (const p of sm) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
  }

  function drawLeaf(x, y, angle, size, kind, u) {
    if (u <= 0.01) return;
    const spr = kind === 'jasmine' ? SPRITES.leaf.gloss : kind === 'marigold' ? SPRITES.leaf.feather : SPRITES.leaf.serrate;
    const w = 46 * size * u, h = w / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (kind === 'rose') {
      // compound leaf: a short petiole with a terminal leaflet and one pair
      ctx.strokeStyle = '#4c6140';
      ctx.lineWidth = Math.max(0.6, size * 2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.9, 0); ctx.stroke();
      ctx.drawImage(spr, w * 0.75, -h * 0.5, w * 0.7, h * 0.7);
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(w * 0.45, 0); ctx.rotate(s * 0.75);
        ctx.drawImage(spr, 0, -h * 0.3, w * 0.55, h * 0.55);
        ctx.restore();
      }
    } else {
      ctx.drawImage(spr, 0, -h / 2, w, h);
    }
    ctx.restore();
  }

  function drawBloom(sp, x, y, angle, size, open, nod) {
    const stage = Math.round(clamp01(open) * (STAGES - 1));
    const spr = SPRITES[sp][stage];
    const r = (sp === 'jasmine' ? 17 : sp === 'iris' ? 29 : sp === 'rose' ? 24 : 23) * size;
    const w = r * 2.6, h = w;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2 + nod);
    if (sp === 'jasmine') ctx.drawImage(spr, -w / 2, -h / 2, w, h);
    else ctx.drawImage(spr, -w / 2, -h * 0.75, w, h);
    ctx.restore();
  }

  function drawPlume(pts, size, u) {
    if (pts.length < 3 || u <= 0) return;
    const n = Math.min(pts.length - 1, 4);
    for (let k = 0; k < n * 4; k++) {
      const t = k / (n * 4);
      const i = Math.floor(pts.length - 1 - t * n);
      const a = pts[Math.max(0, i)], b = pts[Math.min(pts.length - 1, i + 1)];
      const f = (t * n) % 1;
      const x = b[0] + (a[0] - b[0]) * f, y = b[1] + (a[1] - b[1]) * f;
      const spread = (4 + t * 6) * size * u;
      for (const s of [-1, 1]) {
        ctx.fillStyle = `rgba(192, 160, 96, ${0.85 - t * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(x + s * spread * 0.6, y + spread * 0.3, 1.6 * size + 0.4, 3.2 * size + 0.6, s * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const tufts = [];
  function scatterTufts() {
    tufts.length = 0;
    const n = Math.round((W * (soilBottom - horizon)) / (isSmallScreen ? 5200 : 6500));
    for (let i = 0; i < n; i++) {
      const y = horizon + 4 + Math.pow(Math.random(), 0.8) * (soilBottom - horizon + 30);
      const s = scaleOf(Math.min(y, soilBottom));
      const clover = Math.random() < 0.28;
      tufts.push({
        x: Math.random() * W, y, s, clover,
        blades: Array.from({ length: clover ? 3 + (Math.random() * 3 | 0) : 4 + (Math.random() * 5 | 0) }, () => ({
          a: rand(-0.6, 0.6), h: rand(10, 28) * s, c: Math.random() < 0.5 ? '#7d9358' : '#93a66c',
        })),
      });
    }
    tufts.sort((a, b) => a.y - b.y);
  }
  function drawTuft(tf, t) {
    const sway = wind(tf.x, t) * 1.6;
    ctx.globalAlpha = 0.5 + 0.5 * depthOf(tf.y);
    if (tf.clover) {
      for (const b of tf.blades) {
        const x = tf.x + Math.sin(b.a * 3) * 7 * tf.s, y = tf.y - b.h * 0.25;
        ctx.strokeStyle = '#6f8550';
        ctx.lineWidth = Math.max(0.5, 0.7 * tf.s);
        ctx.beginPath(); ctx.moveTo(tf.x, tf.y); ctx.quadraticCurveTo(x, tf.y, x + sway * 3, y); ctx.stroke();
        ctx.fillStyle = b.c;
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + b.a;
          ctx.beginPath();
          ctx.ellipse(x + sway * 3 + Math.cos(a) * 2.2 * tf.s, y + Math.sin(a) * 1.4 * tf.s, 2.3 * tf.s, 1.6 * tf.s, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      for (const b of tf.blades) {
        const tipX = tf.x + Math.sin(b.a) * b.h + sway * b.h * 0.8, tipY = tf.y - Math.cos(b.a) * b.h;
        ctx.fillStyle = b.c;
        ctx.beginPath();
        ctx.moveTo(tf.x - 1.2 * tf.s, tf.y);
        ctx.quadraticCurveTo(tf.x + Math.sin(b.a) * b.h * 0.3, tf.y - b.h * 0.6, tipX, tipY);
        ctx.quadraticCurveTo(tf.x + Math.sin(b.a) * b.h * 0.3 + 1.2 * tf.s, tf.y - b.h * 0.5, tf.x + 1.2 * tf.s, tf.y);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  const blooms = [];         // open blooms this frame, for bees and scent
  function drawPlant(p, t) {
    const age = t - p.born;
    if (age < 0) return;
    let fade = 1;
    if (p.wiltAt !== null) fade = 1 - clamp01((t - p.wiltAt) / 1.1);
    if (fade <= 0) return;
    const def = SPECIES[p.sp];
    const wx = wind(p.x, t);
    ctx.globalAlpha = (0.58 + 0.42 * p.depth) * fade;
    // contact shadow
    ctx.fillStyle = 'rgba(70, 60, 40, 0.16)';
    ctx.beginPath();
    ctx.ellipse(p.x + 3 * p.scale, p.y + 1.5, 20 * p.scale * smooth(age / 2), 4 * p.scale * smooth(age / 2), 0, 0, Math.PI * 2);
    ctx.fill();

    const droop = p.wiltAt !== null ? (1 - fade) * 0.9 : 0;
    for (const b of p.branches) {
      const g = easeOut((age - b.start) / b.dur);
      b.pts = null;
      if (g <= 0) continue;
      let x, y, a;
      if (b.parent < 0) { x = p.x; y = p.y; a = b.rel; }
      else {
        const par = p.branches[b.parent];
        if (!par.pts || par.pts.length <= b.at) continue;
        [x, y] = par.pts[b.at];
        a = par.angs[b.at] + b.rel;
      }
      const n = b.segs.length;
      const vis = g * n;
      const pts = [[x, y]];
      const angs = [a];
      for (let i = 0; i < n && i < vis; i++) {
        const frac = Math.min(1, vis - i);
        const reach = Math.pow((i + 1) / n, 1.6);
        a += b.segs[i].bend + wx * b.flex * reach + droop * reach * (a < -Math.PI / 2 ? -1 : 1);
        x += Math.cos(a) * b.segs[i].len * frac;
        y += Math.sin(a) * b.segs[i].len * frac;
        pts.push([x, y]);
        angs.push(a);
      }
      b.pts = pts;
      b.angs = angs;
      const wEnd = b.w0 + (b.w1 - b.w0) * Math.min(1, vis / n);
      if (b.blade) {
        ribbon(pts, b.w0, Math.max(0.3, wEnd * 0.2), def.leaf, 'rgba(230, 240, 200, 0.35)');
      } else {
        ribbon(pts, b.w0, wEnd, def.stem, 'rgba(210, 225, 180, 0.35)');
      }
      // leaves unfurl as their node is reached
      for (const L of b.leaves) {
        if (L.seg >= pts.length) continue;
        const reached = b.start + b.dur * ((L.seg + 0.5) / n);
        const u = easeOut((age - reached) / 1.1);
        const [lx, ly] = pts[L.seg];
        const la = angs[L.seg] + L.side * (1.0 - u * 0.25) + wx * 1.4;
        drawLeaf(lx, ly, la, L.size, L.kind, u);
      }
      if (b.plume && g >= 1) drawPlume(pts, p.scale, easeOut((age - b.start - b.dur) / 1.5));
      // the bud swells and opens once the stem is done
      if (b.bloom && g >= 0.999) {
        const open = clamp01((age - b.start - b.dur) / 2.8);
        const tip = pts[pts.length - 1];
        const tipA = angs[angs.length - 1];
        const nod = Math.sin(t * 1.3 + p.seed) * 0.04 + wx * 0.8;
        if (b.bloom.cluster) {
          for (let k = 0; k < b.bloom.cluster; k++) {
            const off = (k - (b.bloom.cluster - 1) / 2) * 9 * b.bloom.size;
            const ka = tipA + (k - (b.bloom.cluster - 1) / 2) * 0.7;
            const bx = tip[0] + Math.cos(ka) * 7 * b.bloom.size + off * 0.2;
            const by = tip[1] + Math.sin(ka) * 7 * b.bloom.size;
            ctx.strokeStyle = def.stem;
            ctx.lineWidth = Math.max(0.6, b.bloom.size);
            ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(bx, by); ctx.stroke();
            const o = clamp01(open * 1.2 - k * 0.12);
            drawBloom(p.sp, bx, by, ka, b.bloom.size, o, nod);
            if (o >= 0.98 && fade > 0.9) blooms.push({ p, b, x: bx, y: by, sp: p.sp, k });
          }
        } else {
          drawBloom(p.sp, tip[0], tip[1], tipA, b.bloom.size, open, nod);
          if (open >= 0.98 && fade > 0.9) blooms.push({ p, b, x: tip[0], y: tip[1] - 14 * b.bloom.size, sp: p.sp, k: 0 });
        }
      }
      if (b.plume && g >= 1 && fade > 0.9) blooms.push({ p, b, x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], sp: 'vetiver', k: 0 });
    }
    ctx.globalAlpha = 1;
  }

  /* ----------------------------------------------------------------
     Life in the garden: planting bursts, bees, scent wisps
  ---------------------------------------------------------------- */
  const dirt = [];
  function burst(x, y, sp) {
    if (prefersReducedMotion) return;
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = rand(40, 120) * scaleOf(y);
      dirt.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: clock, life: rand(0.4, 0.8), r: rand(0.8, 2) * scaleOf(y) });
    }
    dirt.push({ ring: true, x, y, t: clock, life: 0.7, r: 26 * scaleOf(y), color: SPECIES[sp].color });
  }
  function drawDirt(t, dt) {
    for (let i = dirt.length - 1; i >= 0; i--) {
      const d = dirt[i];
      const age = t - d.t;
      if (age > d.life) { dirt.splice(i, 1); continue; }
      const k = age / d.life;
      if (d.ring) {
        ctx.strokeStyle = d.color;
        ctx.globalAlpha = (1 - k) * 0.7;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * easeOut(k), d.r * 0.32 * easeOut(k), 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      d.vy += 380 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      ctx.fillStyle = `rgba(100, 78, 50, ${1 - k})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  const motes = [];
  function initMotes() {
    motes.length = 0;
    if (prefersReducedMotion) return;
    const n = isSmallScreen ? 22 : 46;
    for (let i = 0; i < n; i++) motes.push({ x: Math.random() * W, y: Math.random() * H * 0.85, r: rand(0.6, 1.8), sp: rand(4, 12), ph: Math.random() * 10 });
  }
  function drawMotes(t, dt) {
    for (const m of motes) {
      m.x += (wind(m.x, t) * 90 + Math.sin(t * 0.4 + m.ph) * 6) * dt;
      m.y += (-m.sp * 0.4 + Math.cos(t * 0.5 + m.ph) * 4) * dt;
      if (m.y < -10) { m.y = H * 0.9; m.x = Math.random() * W; }
      if (m.x < -10) m.x = W + 10; else if (m.x > W + 10) m.x = -10;
      const glint = 0.35 + 0.35 * Math.sin(t * 1.7 + m.ph * 3);
      ctx.fillStyle = `rgba(232, 196, 110, ${glint.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  const bees = [];
  function initBees() {
    bees.length = 0;
    if (prefersReducedMotion) return;
    const n = isSmallScreen ? 2 : 3;
    for (let i = 0; i < n; i++) bees.push({ x: rand(0, W), y: rand(horizon - 80, horizon + 60), vx: 0, vy: 0, target: null, hover: 0, phase: Math.random() * 10 });
  }
  function drawBees(t, dt) {
    for (const bee of bees) {
      if (!bee.target || bee.hover < 0 || !blooms.includes(bee.target)) {
        if (!bee.target || bee.hover < 0) {
          bee.target = blooms.length ? blooms[(Math.random() * blooms.length) | 0] : null;
          bee.hover = rand(1.4, 3.2);
        } else {
          const same = blooms.find((b) => b.b === bee.target.b && b.k === bee.target.k);
          bee.target = same || null;
        }
      }
      let tx = W * 0.5 + Math.sin(t * 0.3 + bee.phase) * W * 0.3, ty = horizon - 40;
      if (bee.target) { tx = bee.target.x; ty = bee.target.y - 6; }
      const dx = tx - bee.x, dy = ty - bee.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 10 && bee.target) bee.hover -= dt;
      bee.vx += (dx * 2.2 - bee.vx * 1.8) * dt;
      bee.vy += (dy * 2.2 - bee.vy * 1.8) * dt;
      bee.x += bee.vx * dt + Math.sin(t * 9 + bee.phase) * 0.4;
      bee.y += bee.vy * dt + Math.cos(t * 11 + bee.phase) * 0.5;
      const s = 0.7 + depthOf(bee.y) * 0.6;
      ctx.save();
      ctx.translate(bee.x, bee.y);
      ctx.rotate(Math.atan2(bee.vy, bee.vx) * 0.25);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const flap = 0.55 + 0.45 * Math.sin(t * 60 + bee.phase);
      ctx.beginPath(); ctx.ellipse(-1 * s, -3.5 * s, 3.2 * s, 2 * s * flap, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1.5 * s, -3.4 * s, 3 * s, 1.8 * s * flap, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e1ad35';
      ctx.beginPath(); ctx.ellipse(0, 0, 4.4 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b2f22';
      ctx.fillRect(-1.6 * s, -2.8 * s, 1.2 * s, 5.6 * s);
      ctx.fillRect(1.0 * s, -2.6 * s, 1.0 * s, 5.2 * s);
      ctx.beginPath(); ctx.arc(4.4 * s, -0.3 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // scent: open flowers breathe out wisps that drift into the bottle
  const wisps = [];
  let bottle = { x: 0, y: 0 };
  const bottleEl = document.querySelector('.bottle');
  function measureBottle() {
    const r = bottleEl.getBoundingClientRect();
    bottle = { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
  }
  let sipTimer = 0;
  function emitScent(t) {
    if (prefersReducedMotion || wisps.length >= (isSmallScreen ? 8 : 16)) return;
    for (const bl of blooms) {
      const key = `${bl.k}`;
      bl.b.nextScent ??= {};
      const due = bl.b.nextScent[key] ?? (t + rand(0.5, 12));
      if (due > t) { bl.b.nextScent[key] = due; continue; }
      bl.b.nextScent[key] = t + rand(12, 24);
      wisps.push({ x: bl.x, y: bl.y, color: SPECIES[bl.sp].color, rgb: hexRgb(bl.sp === 'jasmine' ? '#cdb878' : SPECIES[bl.sp].color), t, seed: Math.random() * 10, trail: [] });
    }
  }
  function drawWisps(t, dt) {
    for (let i = wisps.length - 1; i >= 0; i--) {
      const w = wisps[i];
      const age = t - w.t;
      const dx = bottle.x - w.x, dy = bottle.y - w.y;
      const d = Math.hypot(dx, dy) || 1;
      // rise and curl first, then lean toward the bottle and speed up
      const lean = smooth((age - 1.2) / 3);
      const curl = Math.sin(age * 1.4 + w.seed) * (1.3 - lean * 0.9);
      const dirX = (dx / d) * lean, dirY = (dy / d) * lean - (1 - lean);
      const ang = Math.atan2(dirY, dirX) + curl;
      const speed = 26 + lean * 150;
      w.x += Math.cos(ang) * speed * dt;
      w.y += Math.sin(ang) * speed * dt;
      w.trail.push([w.x, w.y]);
      if (w.trail.length > 16) w.trail.shift();
      if (d < 16 || age > 16) {
        wisps.splice(i, 1);
        if (d < 16 && t - sipTimer > 0.25) { sipTimer = t; sip(w.color); }
        continue;
      }
      const life = Math.min(1, age * 1.5) * (1 - smooth((age - 13) / 3));
      const [r, g, b] = w.rgb;
      const n = w.trail.length;
      for (let k = 0; k < n; k += 2) {
        const f = (k + 1) / n;
        ctx.fillStyle = `rgba(${r},${g},${b},${(f * 0.32 * life).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(w.trail[k][0], w.trail[k][1], 0.8 + f * 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgba(${r},${g},${b},${(0.22 * life).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(w.x, w.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,252,240,${(0.85 * life).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(w.x, w.y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  function sip(color) {
    bottleEl.style.setProperty('--sip', color);
    bottleEl.classList.remove('is-sip');
    void bottleEl.offsetWidth;
    bottleEl.classList.add('is-sip');
  }

  /* ----------------------------------------------------------------
     Planting cursor (mouse ghost, keyboard marker)
  ---------------------------------------------------------------- */
  const ghost = { x: 0, y: 0, on: false };
  const marker = { x: 0, y: 0, on: false };
  function drawCursor(x, y, keyboard) {
    const s = scaleOf(y);
    const col = SPECIES[selected].color;
    ctx.save();
    ctx.translate(x, Math.max(horizon + 4, y));
    ctx.strokeStyle = col === '#efe6c6' ? '#b8a56a' : col;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.ellipse(0, 0, 18 * s, 6 * s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(51, 57, 46, 0.4)';
    ctx.beginPath(); ctx.ellipse(0, -2 * s, 3.2 * s, 4.2 * s, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (keyboard) {
      ctx.fillStyle = 'rgba(51, 57, 46, 0.7)';
      ctx.font = '500 11px Karla, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Enter to plant', 0, 18 * s + 10);
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------------
     The perfume
  ---------------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);
  const ui = {
    kicker: document.querySelector('.perfume-kicker'), name: $('perfume-name'), short: $('perfume-short'), desc: $('perfume-desc'), count: $('bloom-count'),
    tier: { top: $('tier-top'), heart: $('tier-heart'), base: $('tier-base') },
    bar: { top: $('bar-top'), heart: $('bar-heart'), base: $('bar-base') },
    liquid: $('liquid'), wave: $('liquid-wave'),
  };
  // only touch the live region when the words really change, so screen readers aren't flooded
  const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  let perfumeQueued = false;
  let fill = 0, fillTarget = 0;
  let liquidColor = '#d9a0b4';
  function schedulePerfume() {
    if (perfumeQueued) return;
    perfumeQueued = true;
    setTimeout(() => { perfumeQueued = false; composePerfume(); }, 300);
  }
  let lastOpen = '';
  function composePerfume() {
    const counts = Object.fromEntries(ORDER.map((k) => [k, 0]));
    // each plant in full flower adds one share of its note; growing plants add theirs as they open
    const open = new Map();
    for (const bl of blooms) {
      let set = open.get(bl.p);
      if (!set) open.set(bl.p, (set = new Set()));
      set.add(bl.b);
    }
    let total = 0;           // flower heads open (a jasmine cluster or a vetiver clump counts once)
    for (const [p, set] of open) {
      counts[p.sp] += set.size / p.heads;
      total += p.sp === 'vetiver' ? 1 : set.size;
    }
    const weight = Object.values(counts).reduce((a, b) => a + b, 0);
    const alive = plants.filter((p) => p.wiltAt === null).length;
    const key = `${total}|${alive}|${ORDER.map((k) => counts[k].toFixed(2)).join()}`;
    if (key === lastOpen) return;
    lastOpen = key;
    const ranked = ORDER.filter((k) => counts[k] > 0).sort((a, b) => counts[b] - counts[a]);
    const tiers = { top: ['jasmine', 'marigold'], heart: ['rose', 'iris'], base: ['vetiver'] };
    const tierShare = {};
    for (const [tier, members] of Object.entries(tiers)) {
      const n = members.reduce((s, k) => s + counts[k], 0);
      tierShare[tier] = weight ? n / weight : 0;
      const names = members.filter((k) => counts[k] > 0).sort((a, b) => counts[b] - counts[a]).map((k) => SPECIES[k].label);
      ui.tier[tier].textContent = names.length ? names.join(', ') : '—';
      ui.bar[tier].style.transform = `scaleX(${tierShare[tier].toFixed(3)})`;
    }
    if (!total) {
      ui.name.textContent = alive ? 'Coming into bud' : 'Still a seed';
      setText(ui.desc, alive ? 'Your garden is growing. Each flower that opens adds its note.' : 'Plant something. Every flower that opens adds its note.');
    } else {
      const a = ranked[0], b = ranked[1] || ranked[0];
      ui.name.textContent = `${SPECIES[a].adj} ${SPECIES[b].noun}`;
      const part = (tier) => {
        const m = tiers[tier].filter((k) => counts[k] > 0).sort((x, y) => counts[y] - counts[x]);
        return m.map((k) => SPECIES[k].note).join(' and ');
      };
      // the wording follows how much of each tier is in the bottle
      const amount = (share, lots, some, trace) => (share > 0.42 ? lots : share > 0.14 ? some : trace);
      const bits = [];
      if (tierShare.top) bits.push(`${amount(tierShare.top, 'Bursts open with', 'Opens with', 'A first breath of')} ${part('top')}`);
      if (tierShare.heart) bits.push(`${amount(tierShare.heart, 'a deep heart of', 'a heart of', 'a hint of')} ${part('heart')}`);
      if (tierShare.base) bits.push(`${amount(tierShare.base, 'a long, dry trail of', 'drying down to', 'a whisper of')} ${part('base')}`);
      let text = bits.join(', ');
      text = text.charAt(0).toUpperCase() + text.slice(1) + '.';
      // one nudge toward a balanced perfume
      if (!tierShare.base) text += ' Plant vetiver so it lasts.';
      else if (!tierShare.top) text += ' Jasmine or marigold would brighten the opening.';
      else if (!tierShare.heart) text += ' A rose or an iris would give it a heart.';
      setText(ui.desc, text);
    }
    ui.kicker.textContent = total ? `Your perfume · No. ${total}` : 'Your perfume';
    ui.short.textContent = total ? `${total} bloom${total === 1 ? '' : 's'} · ${SPECIES[ranked[0]].label.toLowerCase()}-led` : alive ? `${alive} planted · in bud` : 'nothing planted yet';
    ui.count.textContent = `${total} bloom${total === 1 ? '' : 's'} open`;
    // the liquid is the bloom colours, mixed (the leading notes weigh most), softened like a real juice
    let r = 0, g = 0, bl = 0, wsum = 0;
    for (const k of ORDER) {
      const w = counts[k] * counts[k];
      const [cr, cg, cb] = hexRgb(k === 'jasmine' ? '#e8d48e' : SPECIES[k].color);
      r += cr * w; g += cg * w; bl += cb * w; wsum += w;
    }
    if (wsum) liquidColor = `rgb(${Math.round(r / wsum * 0.7 + 245 * 0.3)},${Math.round(g / wsum * 0.7 + 222 * 0.3)},${Math.round(bl / wsum * 0.7 + 180 * 0.3)})`;
    ui.liquid.setAttribute('fill', liquidColor);
    ui.wave.setAttribute('fill', liquidColor);
    fillTarget = 1 - Math.exp(-total / 45);
    if (prefersReducedMotion) { fill = fillTarget; drawLiquid(0); }
  }
  function drawLiquid(t) {
    const y = 86 - fill * 58;
    ui.liquid.setAttribute('y', y.toFixed(2));
    if (fill < 0.01) { ui.wave.setAttribute('d', 'M0 0'); return; }
    let d = `M10 ${y + 2}`;
    for (let x = 10; x <= 50; x += 4) d += ` L${x} ${(y + Math.sin(x * 0.35 + t * 2.2) * 1.2).toFixed(2)}`;
    d += ` L50 ${y + 3} L10 ${y + 3} Z`;
    ui.wave.setAttribute('d', d);
  }

  /* ----------------------------------------------------------------
     Frame
  ---------------------------------------------------------------- */
  let last = 0;
  function paint(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!prefersReducedMotion) clock += dt;
    const t = clock;
    for (let i = gusts.length - 1; i >= 0; i--) if (t - gusts[i].t > 3) gusts.splice(i, 1);
    ctx.drawImage(bg, 0, 0, W, H);
    blooms.length = 0;
    let ti = 0;
    for (const p of plants) {
      while (ti < tufts.length && tufts[ti].y <= p.y) drawTuft(tufts[ti++], t);
      drawPlant(p, t);
    }
    while (ti < tufts.length) drawTuft(tufts[ti++], t);
    // fully wilted plants leave
    for (let i = plants.length - 1; i >= 0; i--) if (plants[i].wiltAt !== null && t - plants[i].wiltAt > 1.2) plants.splice(i, 1);
    drawDirt(t, dt);
    drawMotes(t, dt);
    drawBees(t, dt);
    emitScent(t);
    drawWisps(t, dt);
    if (ghost.on && !isCoarse) drawCursor(ghost.x, ghost.y, false);
    if (marker.on) drawCursor(marker.x, marker.y, true);
    if (!prefersReducedMotion) {
      fill += (fillTarget - fill) * Math.min(1, dt * 1.5);
      drawLiquid(t);
      if (Math.floor(t * 3) !== Math.floor((t - dt) * 3)) composePerfume();
    }
  }
  function loop(now) {
    paint(now);
    requestAnimationFrame(loop);
  }
  let stillQueued = false;
  function requestStill() {
    if (stillQueued) return;
    stillQueued = true;
    requestAnimationFrame(() => {
      stillQueued = false;
      paint(performance.now());
      composePerfume();
      paint(performance.now());
    });
  }

  /* ----------------------------------------------------------------
     Interaction
  ---------------------------------------------------------------- */
  function selectSeed(sp) {
    selected = sp;
    document.querySelectorAll('.seed').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.species === sp)));
    if (prefersReducedMotion) requestStill();
  }
  document.querySelectorAll('.seed').forEach((btn) => btn.addEventListener('click', () => selectSeed(btn.dataset.species)));

  canvas.addEventListener('pointerdown', (e) => {
    if (compactCard && toggle.getAttribute('aria-expanded') === 'true') { setPerfumeOpen(false); return; }
    if (e.clientY < horizon - 10) return;
    plantAt(e.clientX, e.clientY);
  });
  let lastMove = null;
  canvas.addEventListener('pointermove', (e) => {
    ghost.x = e.clientX; ghost.y = e.clientY; ghost.on = e.clientY > horizon - 10;
    if (lastMove && !prefersReducedMotion) {
      const vx = e.clientX - lastMove.x;
      if (Math.abs(vx) > 6) gusts.push({ x: e.clientX, s: Math.max(-0.35, Math.min(0.35, vx * 0.006)), t: clock });
      if (gusts.length > 24) gusts.shift();
    }
    lastMove = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerleave', () => { ghost.on = false; lastMove = null; });

  canvas.addEventListener('focus', () => {
    if (!canvas.matches(':focus-visible')) return;
    if (!marker.on) { marker.x = W * 0.42; marker.y = horizon + (soilBottom - horizon) * 0.55; }
    marker.on = true;
    if (prefersReducedMotion) requestStill();
  });
  canvas.addEventListener('blur', () => { marker.on = false; if (prefersReducedMotion) requestStill(); });
  canvas.addEventListener('keydown', (e) => {
    const stepX = W * 0.04, stepY = (soilBottom - horizon) * 0.08;
    if (!marker.on && e.key.startsWith('Arrow')) { marker.x = W * 0.42; marker.y = horizon + (soilBottom - horizon) * 0.55; marker.on = true; }
    let used = true;
    if (e.key === 'ArrowLeft') marker.x = Math.max(20, marker.x - stepX);
    else if (e.key === 'ArrowRight') marker.x = Math.min(W - 20, marker.x + stepX);
    else if (e.key === 'ArrowUp') marker.y = Math.max(horizon + 4, marker.y - stepY);
    else if (e.key === 'ArrowDown') marker.y = Math.min(soilBottom, marker.y + stepY);
    else if (e.key === 'Enter' || e.key === ' ') plantAt(marker.x, marker.y);
    else used = false;
    if (used) { e.preventDefault(); if (prefersReducedMotion) requestStill(); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const i = Number(e.key) - 1;
    if (i >= 0 && i < ORDER.length) selectSeed(ORDER[i]);
  });

  $('clear-garden').addEventListener('click', () => {
    plants.forEach((p) => { if (p.wiltAt === null) p.wiltAt = clock; });
    if (prefersReducedMotion) { plants.length = 0; lastOpen = ''; requestStill(); }
    setTimeout(() => { lastOpen = ''; schedulePerfume(); }, 1300);
  });

  const toggle = $('perfume-toggle');
  function setPerfumeOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    setTimeout(measureBottle, 50);
  }
  toggle.addEventListener('click', () => setPerfumeOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  if (!compactCard) toggle.setAttribute('aria-expanded', 'true');
  $('tray-label').textContent = isCoarse ? 'choose a seed · then tap the soil' : 'choose a seed · then click the soil';

  window.addEventListener('resize', () => {
    const oldH = horizon, oldB = soilBottom, oldW = W;
    size();
    // keep plants on the soil when the window changes shape
    plants.forEach((p) => {
      const d = (p.y - oldH) / (oldB - oldH);
      p.x = (p.x / oldW) * W;
      p.y = horizon + d * (soilBottom - horizon);
    });
    if (prefersReducedMotion) requestStill();
  });
  window.addEventListener('scroll', measureBottle, { passive: true });

  /* ----------------------------------------------------------------
     Boot: a starter garden, composed across the depth of the bed
  ---------------------------------------------------------------- */
  buildSprites();
  size();
  initBees();
  initMotes();
  // [species, x across the bed, depth into the bed, grows in live?]
  const starter = [
    ['vetiver', 0.05, 0.13], ['iris', 0.21, 0.08], ['jasmine', 0.39, 0.16], ['rose', 0.57, 0.1], ['vetiver', 0.71, 0.17], ['iris', 0.92, 0.09],
    ['marigold', 0.13, 0.47], ['rose', 0.33, 0.4], ['jasmine', 0.63, 0.5], ['marigold', 0.83, 0.43],
    ['iris', 0.07, 0.86, true], ['rose', 0.25, 0.93, true], ['marigold', 0.73, 0.95, true], ['vetiver', 0.91, 0.85, true],
  ];
  const mobileStarter = [
    ['vetiver', 0.12, 0.1], ['jasmine', 0.5, 0.15], ['iris', 0.86, 0.07],
    ['rose', 0.27, 0.46], ['marigold', 0.73, 0.52],
    ['iris', 0.1, 0.9, true], ['vetiver', 0.88, 0.92, true],
  ];
  // very wide screens get a second sowing in the gaps
  if (!isSmallScreen && W / H > 1.9) {
    starter.push(['iris', 0.48, 0.28], ['jasmine', 0.15, 0.3], ['rose', 0.86, 0.27], ['vetiver', 0.45, 0.64], ['marigold', 0.53, 0.88, true]);
  }
  let live = 0;
  (isSmallScreen ? mobileStarter : starter).forEach(([sp, fx, fd, grows]) => {
    // the front row is caught mid-growth, so the page opens with something visibly growing
    const delay = prefersReducedMotion ? -60 : grows ? -3.2 + live++ * 0.7 : -rand(8, 11);
    plantAt(W * fx + rand(-16, 16), horizon + (soilBottom - horizon) * fd, sp, delay);
  });
  dirt.length = 0;
  if (prefersReducedMotion) {
    clock = 100;
    requestStill();
  } else {
    requestAnimationFrame(loop);
  }
})();
