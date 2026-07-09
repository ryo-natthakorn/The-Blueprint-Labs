(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;

  const canvas = document.getElementById('garden');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  let W = 0, H = 0;
  function size() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size();

  /* ----------------------------------------------------------------
     Species definitions — structure + bloom painters
  ---------------------------------------------------------------- */
  const SPECIES = {
    rose: {
      label: 'Damask Rose', role: 'heart',
      stem: '#5d6b4a', height: [180, 260], branchiness: 0.55, lean: 0.25,
      leaf: '#6d7d55',
      bloom(g, s) {
        // layered cupped petals
        const layers = 4;
        for (let l = layers; l >= 1; l--) {
          const r = 9 * s * (l / layers) * g;
          const petals = 5 + l;
          for (let i = 0; i < petals; i++) {
            const a = (i / petals) * Math.PI * 2 + l * 0.35;
            ctx.fillStyle = l % 2 ? '#c96f8e' : '#b95a7c';
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.62, r * 0.42, a, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.fillStyle = '#8e3f5c';
        ctx.beginPath();
        ctx.arc(0, 0, 2.2 * s * g, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    iris: {
      label: 'Orris Iris', role: 'heart',
      stem: '#5a6d52', height: [220, 320], branchiness: 0.15, lean: 0.1,
      leaf: '#63755a',
      bloom(g, s) {
        // three upright standards, three drooping falls
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
          ctx.fillStyle = '#8d7fc7';
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 5 * s * g, Math.sin(a) * 5 * s * g + 4 * s * g, 4.5 * s * g, 9 * s * g, a + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 6;
          ctx.fillStyle = '#6f5fb0';
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 4 * s * g, Math.sin(a) * 4 * s * g - 3 * s * g, 3.4 * s * g, 7 * s * g, a + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#e8c766';
        ctx.beginPath();
        ctx.arc(0, 0, 1.8 * s * g, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    jasmine: {
      label: 'Night Jasmine', role: 'top',
      stem: '#4f6249', height: [150, 230], branchiness: 0.8, lean: 0.45,
      leaf: '#5b6e52',
      bloom(g, s) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.fillStyle = '#f0ead3';
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 4.5 * s * g, Math.sin(a) * 4.5 * s * g, 2.6 * s * g, 5.5 * s * g, a + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#d9c987';
        ctx.beginPath();
        ctx.arc(0, 0, 1.6 * s * g, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    marigold: {
      label: 'Wild Marigold', role: 'top',
      stem: '#5e6b3f', height: [130, 200], branchiness: 0.6, lean: 0.3,
      leaf: '#6a763f',
      bloom(g, s) {
        for (let ring = 3; ring >= 1; ring--) {
          const petals = 8 + ring * 3;
          const r = 3.2 * s * ring * g;
          for (let i = 0; i < petals; i++) {
            const a = (i / petals) * Math.PI * 2 + ring;
            ctx.fillStyle = ring % 2 ? '#e0913c' : '#c9702a';
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, 2.4 * s * g, 1.3 * s * g, a, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.fillStyle = '#8a4d1d';
        ctx.beginPath();
        ctx.arc(0, 0, 2 * s * g, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    vetiver: {
      label: 'Vetiver Grass', role: 'base',
      stem: '#7d8f62', height: [200, 300], branchiness: 0, lean: 0, grass: true,
      leaf: '#7d8f62',
      bloom(g, s) {
        // airy seed head
        ctx.strokeStyle = 'rgba(185, 151, 91, 0.85)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (i - 4) * 0.16;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * 14 * s * g, Math.sin(a) * 14 * s * g);
          ctx.stroke();
          ctx.fillStyle = 'rgba(185, 151, 91, 0.9)';
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 14 * s * g, Math.sin(a) * 14 * s * g, 1.1 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },
  };

  /* ----------------------------------------------------------------
     Plant structure generation (local coords, origin at base)
  ---------------------------------------------------------------- */
  function buildPlant(species, scale) {
    const def = SPECIES[species];
    const branches = [];
    const flowers = [];

    if (def.grass) {
      const blades = 7 + Math.floor(Math.random() * 5);
      for (let i = 0; i < blades; i++) {
        const lean = (i / (blades - 1) - 0.5) * 1.6 + (Math.random() - 0.5) * 0.2;
        const len = (def.height[0] + Math.random() * (def.height[1] - def.height[0])) * scale * (0.6 + Math.random() * 0.4);
        branches.push({
          x0: 0, y0: 0,
          angle: -Math.PI / 2 + lean * 0.35,
          curve: lean * 0.9,
          len, width: 2.2 * scale, depth: 0,
          t0: Math.random() * 0.25, t1: 0.75 + Math.random() * 0.25,
        });
        if (i % 3 === 0) {
          flowers.push({ branch: branches.length - 1, at: 1, size: scale });
        }
      }
      return { branches, flowers };
    }

    const height = (def.height[0] + Math.random() * (def.height[1] - def.height[0])) * scale;

    function grow(x0, y0, angle, len, width, depth, t0) {
      const t1 = Math.min(1, t0 + 0.32);
      const curve = (Math.random() - 0.5) * 0.8;
      const idx = branches.length;
      branches.push({ x0, y0, angle, curve, len, width, depth, t0, t1 });

      const x1 = x0 + Math.cos(angle + curve * 0.5) * len;
      const y1 = y0 + Math.sin(angle + curve * 0.5) * len;

      const canBranch = depth < 3 && len > 26;
      if (canBranch && Math.random() < def.branchiness) {
        const side = Math.random() < 0.5 ? 1 : -1;
        grow(x1, y1, angle + side * (0.5 + Math.random() * 0.5) * def.lean * 2.2, len * 0.62, width * 0.7, depth + 1, t0 + 0.22);
      }
      if (depth < 3 && len > 30) {
        grow(x1, y1, angle + (Math.random() - 0.5) * 0.35, len * 0.72, width * 0.8, depth + 1, t0 + 0.28);
      } else {
        flowers.push({ branch: idx, at: 1, size: scale * (0.8 + Math.random() * 0.5) });
      }
    }

    grow(0, 0, -Math.PI / 2 + (Math.random() - 0.5) * 0.14, height * 0.42, 3.4 * scale, 0, 0);
    return { branches, flowers };
  }

  /* ----------------------------------------------------------------
     Garden state
  ---------------------------------------------------------------- */
  const plants = [];
  const MAX_PLANTS = isSmallScreen ? 22 : 45;
  let pollen = [];

  function initPollen() {
    const n = prefersReducedMotion ? 0 : (isSmallScreen ? 16 : 36);
    pollen = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.8 + Math.random() * 1.6,
      vx: 0.12 + Math.random() * 0.3, vy: -0.05 - Math.random() * 0.12,
      phase: Math.random() * Math.PI * 2,
    }));
  }
  initPollen();

  let selectedSpecies = 'rose';

  function groundY() { return H * 0.42; } // plantable region starts here

  function plantAt(x, y) {
    const gy = Math.max(y, groundY());
    const depthFactor = (gy - groundY()) / (H - groundY()); // 0 far, 1 near
    const scale = 0.5 + depthFactor * 0.75;
    if (plants.length >= MAX_PLANTS) plants.shift();
    plants.push({
      species: selectedSpecies,
      x, y: gy,
      born: performance.now(),
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.5 + Math.random() * 0.5,
      scale,
      ...buildPlant(selectedSpecies, scale),
    });
    plants.sort((a, b) => a.y - b.y);
    updateAccord();
  }

  /* ----------------------------------------------------------------
     Painting
  ---------------------------------------------------------------- */
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

  function drawBackground() {
    ctx.fillStyle = '#f7f4ec';
    ctx.fillRect(0, 0, W, H);
    // soil wash
    const soil = ctx.createLinearGradient(0, groundY() - 40, 0, H);
    soil.addColorStop(0, 'rgba(125, 143, 98, 0)');
    soil.addColorStop(0.35, 'rgba(125, 143, 98, 0.08)');
    soil.addColorStop(1, 'rgba(93, 107, 74, 0.22)');
    ctx.fillStyle = soil;
    ctx.fillRect(0, groundY() - 40, W, H - groundY() + 40);
    // faint horizon rule
    ctx.strokeStyle = 'rgba(51, 57, 46, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY());
    ctx.lineTo(W, groundY());
    ctx.stroke();
  }

  function drawPlant(plant, now, windT) {
    const def = SPECIES[plant.species];
    const age = Math.max(0, (now - plant.born) / 1000);
    const growth = prefersReducedMotion ? 1 : Math.min(1, age / 4.2);
    const g = easeOut(growth);

    const sway = prefersReducedMotion ? 0
      : Math.sin(windT * plant.swaySpeed + plant.swayPhase) * 0.02
      + Math.sin(windT * 0.31 + plant.x * 0.01) * 0.015;

    ctx.save();
    ctx.translate(plant.x, plant.y);
    ctx.rotate(sway);

    // faint contact shadow
    ctx.fillStyle = 'rgba(51, 57, 46, 0.08)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 16 * plant.scale * g, 3.5 * plant.scale * g, 0, 0, Math.PI * 2);
    ctx.fill();

    const tips = [];
    plant.branches.forEach((b, i) => {
      const local = Math.min(1, Math.max(0, (g - b.t0) / (b.t1 - b.t0)));
      if (local <= 0) { tips[i] = null; return; }
      const lg = easeOut(local);
      const len = b.len * lg;
      const bendSway = sway * (b.depth + 1) * 6;
      const midA = b.angle + b.curve * 0.5 * lg;
      const cx = b.x0 + Math.cos(b.angle) * len * 0.5;
      const cy = b.y0 + Math.sin(b.angle) * len * 0.5;
      const x1 = b.x0 + Math.cos(midA) * len + bendSway;
      const y1 = b.y0 + Math.sin(midA) * len;
      ctx.strokeStyle = def.stem;
      ctx.lineWidth = Math.max(0.8, b.width * (1 - b.depth * 0.18));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x0, b.y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
      tips[i] = { x: x1, y: y1, done: local >= 1, local };

      // leaves at 40% and 75% along mature branches
      if (!def.grass && lg > 0.5 && b.depth < 3) {
        for (const f of [0.42, 0.78]) {
          const lx = b.x0 + Math.cos(midA) * len * f;
          const ly = b.y0 + Math.sin(midA) * len * f;
          const la = midA + (f > 0.5 ? 0.9 : -0.9);
          ctx.fillStyle = def.leaf;
          ctx.beginPath();
          ctx.ellipse(lx + Math.cos(la) * 6, ly + Math.sin(la) * 6, 7 * plant.scale * lg, 2.8 * plant.scale * lg, la, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // blooms at branch tips
    plant.flowers.forEach((f) => {
      const tip = tips[f.branch];
      if (!tip || !tip.done) return;
      const bloomAge = prefersReducedMotion ? 1 : Math.min(1, Math.max(0, (age - 3) / 1.6));
      if (bloomAge <= 0) return;
      const bg = easeOutBack(Math.min(1, bloomAge));
      ctx.save();
      ctx.translate(tip.x, tip.y);
      def.bloom(bg, f.size * 1.6);
      ctx.restore();
    });

    ctx.restore();
  }

  function drawPollen(windT) {
    ctx.fillStyle = 'rgba(185, 151, 91, 0.4)';
    pollen.forEach((p) => {
      p.x += p.vx + Math.sin(windT + p.phase) * 0.15;
      p.y += p.vy;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function paint(now) {
    const windT = now / 1000;
    drawBackground();
    for (const plant of plants) drawPlant(plant, now, windT);
    drawPollen(windT);
  }

  /* ----------------------------------------------------------------
     Accord panel
  ---------------------------------------------------------------- */
  const accordList = document.getElementById('accord-list');
  const bloomCount = document.getElementById('bloom-count');

  function updateAccord() {
    const counts = {};
    let totalFlowers = 0;
    plants.forEach((p) => {
      counts[p.species] = (counts[p.species] || 0) + p.flowers.length;
      totalFlowers += p.flowers.length;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      accordList.innerHTML = '<li class="accord-empty">The plot is bare. Plant something.</li>';
      bloomCount.textContent = '0 blooms';
      return;
    }
    accordList.innerHTML = entries.map(([sp, n]) => {
      const def = SPECIES[sp];
      const pct = Math.round((n / totalFlowers) * 100);
      return `<li><span class="sp-name">${def.label} <em style="color:rgba(51,57,46,0.45);font-size:0.68rem">(${def.role})</em></span><span class="sp-pct">${pct}%</span></li>`;
    }).join('');
    bloomCount.textContent = `${totalFlowers} bloom${totalFlowers === 1 ? '' : 's'}`;
  }

  /* ----------------------------------------------------------------
     Interaction
  ---------------------------------------------------------------- */
  canvas.addEventListener('pointerdown', (e) => {
    plantAt(e.clientX, e.clientY);
    if (prefersReducedMotion) paint(performance.now());
  });

  canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    plantAt(
      W * (0.1 + Math.random() * 0.8),
      groundY() + (H - groundY()) * (0.15 + Math.random() * 0.65)
    );
    if (prefersReducedMotion) paint(performance.now());
  });

  document.querySelectorAll('.seed').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seed').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      selectedSpecies = btn.dataset.species;
    });
  });

  document.getElementById('clear-garden').addEventListener('click', () => {
    plants.length = 0;
    updateAccord();
    if (prefersReducedMotion) paint(performance.now());
  });

  window.addEventListener('resize', () => {
    size();
    initPollen();
    if (prefersReducedMotion) paint(performance.now());
  });

  /* ----------------------------------------------------------------
     Boot: pre-plant a small starter garden so the page opens alive
  ---------------------------------------------------------------- */
  function starterGarden() {
    const picks = ['vetiver', 'rose', 'jasmine', 'marigold', 'iris', 'rose'];
    picks.forEach((sp, i) => {
      selectedSpecies = sp;
      const x = W * (0.14 + i * 0.14) + (Math.random() - 0.5) * 40;
      const y = groundY() + (H - groundY()) * (0.25 + Math.random() * 0.55);
      plantAt(x, y);
      // stagger the births so the opening feels alive
      plants[plants.length - 1].born = performance.now() + i * 450;
    });
    selectedSpecies = 'rose';
  }
  starterGarden();

  if (prefersReducedMotion) {
    plants.forEach((p) => { p.born = performance.now() - 10000; });
    paint(performance.now());
  } else {
    (function loop(now) {
      paint(now || performance.now());
      requestAnimationFrame(loop);
    })(performance.now());
  }
})();
