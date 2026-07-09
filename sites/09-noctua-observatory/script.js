(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;

  /* ----------------------------------------------------------------
     An explorable sky: a wrapping virtual star plane you drag with
     inertia. Invented constellations draw themselves in as your
     cursor (or viewport center, on touch) drifts near them.
  ---------------------------------------------------------------- */

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const SKY_W = 4200;           // virtual sky width (wraps)
  const SKY_H = 2400;           // virtual sky height (clamped)

  let W = 0, H = 0;
  function size() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size();

  /* ---------------- star field ------------------------------------ */
  const STAR_COUNT = isSmallScreen ? 700 : 1400;
  const stars = [];
  // deterministic PRNG so the sky is the same sky every visit
  let seed = 20260709;
  function rand() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: rand() * SKY_W,
      y: rand() * SKY_H,
      r: Math.pow(rand(), 2.6) * 1.9 + 0.3,
      warm: rand() < 0.18,
      twinklePhase: rand() * Math.PI * 2,
      twinkleSpeed: 0.4 + rand() * 1.4,
      depth: 0.55 + rand() * 0.45, // parallax layer
    });
  }

  /* ---------------- invented constellations ----------------------- */
  // points are local offsets; pos is the anchor in sky coords
  const CONSTELLATIONS = [
    {
      name: 'Noctua', kind: 'the owl · our namesake',
      text: 'Six stars that blink in rotation, the old catalogues claim — never all awake, never all asleep. The observatory keeps one dome pointed at her out of respect.',
      pos: [600, 700],
      pts: [[0, 0], [90, -60], [180, 0], [90, 70], [30, 160], [150, 160]],
      edges: [[0, 1], [1, 2], [0, 3], [2, 3], [3, 4], [3, 5]],
    },
    {
      name: 'The Cartographer', kind: 'a ruler, mid-measurement',
      text: 'A dead-straight line of five stars with one deserter. Navigators trusted the line; poets preferred the deserter. Both were right.',
      pos: [1450, 400],
      pts: [[0, 0], [80, 20], [160, 40], [240, 60], [320, 80], [220, -70]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]],
    },
    {
      name: 'The Kiln', kind: 'a fire that never went out',
      text: 'Four stars boxing in a fifth, redder one. On clear winter nights the middle star appears to flicker — atmosphere, says the science; embers, says everyone else.',
      pos: [2300, 900],
      pts: [[0, 0], [130, -20], [150, 110], [20, 130], [75, 55]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0]],
    },
    {
      name: 'The Long Wave', kind: 'the sea, transposed',
      text: 'Nine stars in a slow sine. Fishermen read tomorrow\'s swell in how hard it twinkled. Meteorologically useless, morale-wise essential.',
      pos: [3100, 1500],
      pts: [[0, 0], [70, -40], [140, 0], [210, 40], [280, 0], [350, -40], [420, 0], [490, 40], [560, 0]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]],
    },
    {
      name: 'The Key', kind: 'lost, presumably to the door of morning',
      text: 'A ring of four with a long teeth-ward tail. Rises latest of the northern figures — the sky unlocking itself just before dawn.',
      pos: [900, 1700],
      pts: [[0, 0], [60, -50], [120, 0], [60, 50], [180, 0], [240, 0], [240, 50], [300, 0]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 6], [5, 7]],
    },
    {
      name: 'The Quiet Engine', kind: 'seven stars, idling',
      text: 'A compact knot that appears to slowly rotate if watched long enough. It does not. You, however, do — the observatory floor turns with the planet, one revolution per night shift.',
      pos: [1900, 1900],
      pts: [[0, 0], [70, -30], [130, 10], [110, 80], [40, 100], [-20, 60], [55, 40]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 2], [6, 4]],
    },
    {
      name: 'The Gardener', kind: 'stooping, forever sowing',
      text: 'The southern-most figure we can see from this latitude, and only in late summer. What she plants, nobody agrees on. The harvest is presumably other stars.',
      pos: [3600, 600],
      pts: [[0, 0], [-60, 70], [0, 140], [80, 100], [60, 190], [140, 40], [90, -50]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 6], [6, 5], [5, 3]],
    },
  ];

  CONSTELLATIONS.forEach((c) => {
    c.reveal = 0; // 0..1 line-draw progress
    c.centroid = c.pts.reduce((acc, p) => [acc[0] + p[0] / c.pts.length, acc[1] + p[1] / c.pts.length], [0, 0]);
    c.radius = Math.max(...c.pts.map((p) => Math.hypot(p[0] - c.centroid[0], p[1] - c.centroid[1]))) + 130;
  });

  /* ---------------- milky way backdrop (pre-rendered) -------------- */
  const mw = document.createElement('canvas');
  mw.width = 1050; mw.height = 600; // quarter-scale, drawn stretched
  {
    const g = mw.getContext('2d');
    g.fillStyle = '#040711';
    g.fillRect(0, 0, mw.width, mw.height);
    // band of soft blobs along a diagonal
    for (let i = 0; i < 260; i++) {
      const t = rand();
      const bx = t * mw.width;
      const by = mw.height * 0.62 - t * mw.height * 0.34 + (rand() - 0.5) * 90;
      const r = 18 + rand() * 55;
      const a = 0.012 + rand() * 0.03;
      const grad = g.createRadialGradient(bx, by, 0, bx, by, r);
      const warm = rand() < 0.3;
      grad.addColorStop(0, warm ? `rgba(196, 178, 214, ${a})` : `rgba(148, 168, 220, ${a})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(bx, by, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  /* ---------------- pan state -------------------------------------- */
  let panX = 300, panY = 500;
  let velX = 0, velY = 0;
  let dragging = false, lastX = 0, lastY = 0;
  let pointerSkyX = null, pointerSkyY = null;

  const clampY = (y) => Math.max(0, Math.min(SKY_H - H, y));

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    velX = velY = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointerSkyX = ((panX + (e.clientX - rect.left)) % SKY_W + SKY_W) % SKY_W;
    pointerSkyY = panY + (e.clientY - rect.top);
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    panX -= dx; panY = clampY(panY - dy);
    velX = -dx; velY = -dy;
    lastX = e.clientX; lastY = e.clientY;
    if (prefersReducedMotion) paint(performance.now());
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('keydown', (e) => {
    const step = 176;
    if (e.key === 'ArrowLeft') { velX = -step / 8; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { velX = step / 8; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { velY = -step / 8; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { velY = step / 8; e.preventDefault(); }
    if (prefersReducedMotion) {
      panX += velX * 8; panY = clampY(panY + velY * 8);
      velX = velY = 0;
      paint(performance.now());
    }
  });

  /* ---------------- story card ------------------------------------- */
  const card = document.getElementById('story-card');
  const cardName = document.getElementById('story-name');
  const cardKind = document.getElementById('story-kind');
  const cardText = document.getElementById('story-text');
  const finderRa = document.getElementById('finder-ra');
  let activeConstellation = null;

  function setActive(c) {
    if (c === activeConstellation) return;
    activeConstellation = c;
    if (!c) { card.hidden = true; return; }
    cardName.textContent = c.name;
    cardKind.textContent = c.kind;
    cardText.textContent = c.text;
    card.hidden = false;
  }

  /* ---------------- painting ---------------------------------------- */
  // wrapped horizontal delta from sky-x a to b
  function wrapDX(a, b) {
    let d = a - b;
    if (d > SKY_W / 2) d -= SKY_W;
    if (d < -SKY_W / 2) d += SKY_W;
    return d;
  }

  function paint(now) {
    const t = now / 1000;
    ctx.clearRect(0, 0, W, H);

    // milky way, with slight parallax (moves at 40% pan speed)
    const mwScale = Math.max(W / mw.width, H / mw.height) * 1.35;
    const mwX = -((panX * 0.4) % (mw.width * mwScale));
    for (let ox = mwX - mw.width * mwScale; ox < W + mw.width * mwScale; ox += mw.width * mwScale) {
      ctx.drawImage(mw, ox, -panY * 0.25 - 100, mw.width * mwScale, mw.height * mwScale);
    }

    // stars (two parallax depths via star.depth)
    for (const s of stars) {
      const sx = ((s.x - panX * s.depth) % SKY_W + SKY_W) % SKY_W;
      const sy = s.y - panY * s.depth;
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
      const tw = prefersReducedMotion ? 1 : 0.72 + 0.28 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
      ctx.globalAlpha = Math.min(1, tw * (0.45 + s.r * 0.35));
      ctx.fillStyle = s.warm ? '#ffe1b0' : '#e8edff';
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
      // cross-flare on the brightest
      if (s.r > 1.7) {
        ctx.globalAlpha *= 0.35;
        ctx.fillRect(sx - s.r * 3.2, sy - 0.4, s.r * 6.4, 0.8);
        ctx.fillRect(sx - 0.4, sy - s.r * 3.2, 0.8, s.r * 6.4);
      }
    }
    ctx.globalAlpha = 1;

    // constellations
    const probeX = pointerSkyX !== null && !isSmallScreen ? pointerSkyX : ((panX + W / 2) % SKY_W + SKY_W) % SKY_W;
    const probeY = pointerSkyY !== null && !isSmallScreen ? pointerSkyY : panY + H / 2;
    let nearest = null;

    for (const c of CONSTELLATIONS) {
      const cx = c.pos[0] + c.centroid[0];
      const cy = c.pos[1] + c.centroid[1];
      const d = Math.hypot(wrapDX(cx, probeX), cy - probeY);
      const target = d < c.radius ? 1 : 0;
      if (target === 1 && (!nearest || d < nearest.d)) nearest = { c, d };
      const speed = prefersReducedMotion ? 1 : 0.045;
      c.reveal += (target - c.reveal) * speed;

      if (c.reveal < 0.01) continue;

      // screen anchor (wrapped relative to viewport left edge)
      const anchorX = ((c.pos[0] - panX) % SKY_W + SKY_W) % SKY_W;
      const drawX = anchorX > W + 400 ? anchorX - SKY_W : anchorX;
      const drawY = c.pos[1] - panY;

      // edges draw in sequence
      ctx.strokeStyle = `rgba(217, 185, 112, ${0.65 * c.reveal})`;
      ctx.lineWidth = 1;
      const per = 1 / c.edges.length;
      c.edges.forEach(([a, b], i) => {
        const local = Math.min(1, Math.max(0, (c.reveal - i * per * 0.7) / per));
        if (local <= 0) return;
        const [ax, ay] = c.pts[a];
        const [bx, by] = c.pts[b];
        ctx.beginPath();
        ctx.moveTo(drawX + ax, drawY + ay);
        ctx.lineTo(drawX + ax + (bx - ax) * local, drawY + ay + (by - ay) * local);
        ctx.stroke();
      });

      // member stars glow gold
      for (const [px, py] of c.pts) {
        ctx.fillStyle = `rgba(217, 185, 112, ${0.9 * c.reveal})`;
        ctx.beginPath();
        ctx.arc(drawX + px, drawY + py, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(217, 185, 112, ${0.22 * c.reveal})`;
        ctx.beginPath();
        ctx.arc(drawX + px, drawY + py, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // name label
      if (c.reveal > 0.6) {
        ctx.globalAlpha = (c.reveal - 0.6) / 0.4;
        ctx.fillStyle = '#d9b970';
        ctx.font = 'italic 300 17px Spectral, serif';
        ctx.fillText(c.name, drawX + c.centroid[0] - 30, drawY + c.centroid[1] - c.radius + 90);
        ctx.globalAlpha = 1;
      }
    }

    setActive(nearest ? nearest.c : null);

    // horizon silhouette
    ctx.fillStyle = '#02040a';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 30);
    for (let x = 0; x <= W; x += 40) {
      const ridge = Math.sin((x + 200) * 0.006) * 14 + Math.sin(x * 0.017) * 7;
      ctx.lineTo(x, H - 30 - Math.max(0, ridge));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // RA readout from pan position
    const raH = Math.floor((panX % SKY_W + SKY_W) % SKY_W / SKY_W * 24);
    const raM = Math.floor(((panX % SKY_W + SKY_W) % SKY_W / SKY_W * 24 - raH) * 60);
    finderRa.textContent = `RA ${String(raH).padStart(2, '0')}h ${String(raM).padStart(2, '0')}m`;
  }

  /* ---------------- shooting stars ---------------------------------- */
  let meteor = null;
  function maybeMeteor(t) {
    if (meteor === null && Math.random() < 0.003) {
      meteor = { x: Math.random() * W, y: Math.random() * H * 0.5, vx: 6 + Math.random() * 5, vy: 2 + Math.random() * 2, life: 1 };
    }
    if (meteor) {
      ctx.strokeStyle = `rgba(232, 237, 255, ${meteor.life * 0.9})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(meteor.x - meteor.vx * 6, meteor.y - meteor.vy * 6);
      ctx.stroke();
      meteor.x += meteor.vx;
      meteor.y += meteor.vy;
      meteor.life -= 0.02;
      if (meteor.life <= 0 || meteor.x > W + 80) meteor = null;
    }
  }

  /* ---------------- loop -------------------------------------------- */
  function loop(now) {
    if (!dragging) {
      panX += velX;
      panY = clampY(panY + velY);
      velX *= 0.94;
      velY *= 0.94;
      // idle drift: the sky turns like the planet does
      panX += 0.06;
    }
    paint(now);
    maybeMeteor(now);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => {
    size();
    if (prefersReducedMotion) paint(performance.now());
  });

  if (prefersReducedMotion) {
    paint(performance.now());
  } else {
    requestAnimationFrame(loop);
  }
})();
