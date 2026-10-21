(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;

  /* ----------------------------------------------------------------
     A particle fire that actually matters: its intensity lights the
     page (via --glow) and the menu fades toward darkness as the fire
     dies. Hold the bellows button to stoke it back up.
  ---------------------------------------------------------------- */

  const canvas = document.getElementById('fire');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 1.75);

  let W = 0, H = 0;
  function size() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size();
  window.addEventListener('resize', () => {
    size();
    if (prefersReducedMotion) paintStatic();
  });

  /* fire economy: burns down on its own, stoking pumps it up */
  let intensity = 0.62;      // 0..1
  let stoking = false;

  const stokeBtn = document.getElementById('stoke');
  const meterFill = document.getElementById('meter-fill');
  const meterLabel = document.getElementById('meter-label');

  const startStoke = (e) => {
    e.preventDefault(); stoking = true;
    if (prefersReducedMotion) {
      intensity = Math.min(1, intensity + 0.15);
      paintStatic();
    }
  };
  const endStoke = () => { stoking = false; };
  stokeBtn.addEventListener('pointerdown', startStoke);
  window.addEventListener('pointerup', endStoke);
  window.addEventListener('pointercancel', endStoke);
  stokeBtn.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') startStoke(e);
  });
  stokeBtn.addEventListener('keyup', () => { stoking = false; });

  /* a hand waved near the hearth makes the flames lean */
  let wind = 0, windTarget = 0;
  window.addEventListener('pointermove', (e) => {
    const dx = e.clientX - W / 2;
    const dy = e.clientY - hearthY();
    const near = Math.hypot(dx, dy) < Math.min(420, W * 0.4);
    windTarget = near ? -Math.sign(dx) * Math.min(1.6, Math.abs(dx) / 130) : 0;
  });

  /* ---------------- particles -------------------------------------- */
  const MAX_P = isSmallScreen ? 130 : 300;
  const flames = [];
  const embers = [];
  const smoke = [];

  function hearthX() { return isSmallScreen ? W / 2 : W * 0.76; }
  function hearthY() { return isSmallScreen ? Math.min(H * 0.47, 390) : H * 0.82; }
  function hearthWidth() { return isSmallScreen ? Math.min(260, W * 0.68) : Math.min(470, W * 0.32); }

  function spawnFlame() {
    const spread = hearthWidth() / 2;
    // denser toward the middle
    const off = (Math.random() + Math.random() + Math.random()) / 3 * 2 - 1;
    flames.push({
      x: hearthX() + off * spread,
      y: hearthY() + Math.random() * 8,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -(1.4 + Math.random() * 2.4) * (0.5 + intensity),
      r: (5 + Math.random() * 13) * (0.55 + intensity * 0.6),
      life: 1,
      decay: 0.012 + Math.random() * 0.02,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function spawnEmber() {
    embers.push({
      x: hearthX() + (Math.random() - 0.5) * hearthWidth(),
      y: hearthY(),
      vx: (Math.random() - 0.5) * 0.9,
      vy: -(1.2 + Math.random() * 2.2),
      r: 0.8 + Math.random() * 1.7,
      life: 1,
      decay: 0.004 + Math.random() * 0.008,
      flicker: Math.random() * Math.PI * 2,
    });
  }

  function spawnSmoke() {
    smoke.push({
      x: hearthX() + (Math.random() - 0.5) * hearthWidth() * 0.7,
      y: hearthY() - 60 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -(0.4 + Math.random() * 0.7),
      r: 12 + Math.random() * 22,
      life: 1,
      decay: 0.006 + Math.random() * 0.006,
    });
  }

  function flameColor(life, y01) {
    // white-hot core → amber → rust → transparent
    if (life > 0.75) return `rgba(255, 236, 190, ${life * 0.9})`;
    if (life > 0.45) return `rgba(255, 157, 60, ${life * 0.8})`;
    if (life > 0.2) return `rgba(180, 85, 45, ${life * 0.7})`;
    return `rgba(90, 40, 25, ${life * 0.5})`;
  }

  function paint(dtScale) {
    ctx.clearRect(0, 0, W, H);

    /* spawn rates scale with intensity */
    const flameBudget = Math.floor(MAX_P * intensity);
    const spawnCount = Math.max(1, Math.round(6 * intensity * dtScale));
    for (let i = 0; i < spawnCount && flames.length < flameBudget; i++) spawnFlame();
    if (Math.random() < intensity * 0.5) spawnEmber();
    if (Math.random() < 0.2 + (1 - intensity) * 0.4) spawnSmoke();

    /* smoke first (behind) */
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.x += p.vx * dtScale; p.y += p.vy * dtScale;
      p.r += 0.18 * dtScale;
      p.life -= p.decay * dtScale;
      if (p.life <= 0) { smoke.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(40, 30, 26, ${p.life * 0.16})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Charred logs give the flame a source and catch the orange light.
    ctx.lineCap = 'round';
    ctx.shadowColor = `rgba(255,106,22,${intensity * .6})`;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = '#45200e'; ctx.lineWidth = isSmallScreen ? 18 : 29;
    ctx.beginPath();
    ctx.moveTo(hearthX() - hearthWidth() * .37, hearthY() + 4);
    ctx.lineTo(hearthX() + hearthWidth() * .28, hearthY() - 23);
    ctx.moveTo(hearthX() + hearthWidth() * .35, hearthY() + 6);
    ctx.lineTo(hearthX() - hearthWidth() * .23, hearthY() - 28);
    ctx.stroke(); ctx.shadowBlur = 0;

    /* flames (additive) */
    ctx.globalCompositeOperation = 'lighter';
    for (let i = flames.length - 1; i >= 0; i--) {
      const p = flames[i];
      p.wobble += 0.14 * dtScale;
      p.x += (p.vx + Math.sin(p.wobble) * 0.6 + wind * (1 - p.life) * 2.2) * dtScale;
      p.y += p.vy * dtScale;
      p.r *= Math.pow(0.985, dtScale);
      p.life -= p.decay * dtScale;
      if (p.life <= 0 || p.r < 0.6) { flames.splice(i, 1); continue; }
      ctx.fillStyle = flameColor(p.life, p.y / H);
      const breadth = Math.max(1.5, p.r * p.life);
      const height = breadth * (2.9 + intensity);
      ctx.beginPath();
      ctx.moveTo(p.x - breadth, p.y + breadth * .45);
      ctx.bezierCurveTo(p.x - breadth * 1.1, p.y - height * .3,
        p.x - breadth * .1, p.y - height * .6,
        p.x + wind * breadth * .45, p.y - height);
      ctx.bezierCurveTo(p.x + breadth * .35, p.y - height * .72,
        p.x + breadth * 1.15, p.y - height * .15,
        p.x + breadth, p.y + breadth * .45);
      ctx.closePath();
      ctx.fill();
    }

    /* embers */
    for (let i = embers.length - 1; i >= 0; i--) {
      const p = embers[i];
      p.flicker += 0.3 * dtScale;
      p.x += (p.vx + Math.sin(p.flicker * 0.7) * 0.5) * dtScale;
      p.y += p.vy * dtScale;
      p.vy *= Math.pow(0.998, dtScale);
      p.life -= p.decay * dtScale;
      if (p.life <= 0 || p.y < -10) { embers.splice(i, 1); continue; }
      const a = p.life * (0.55 + 0.45 * Math.sin(p.flicker));
      ctx.fillStyle = `rgba(255, 190, 110, ${Math.max(0, a)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    /* glowing coal bed */
    const coalGrad = ctx.createRadialGradient(hearthX(), hearthY() + 10, 4, hearthX(), hearthY() + 10, hearthWidth() * 0.75);
    coalGrad.addColorStop(0, `rgba(255, 120, 30, ${0.5 * intensity + 0.15})`);
    coalGrad.addColorStop(0.5, `rgba(160, 50, 20, ${0.3 * intensity + 0.08})`);
    coalGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coalGrad;
    ctx.fillRect(hearthX() - hearthWidth(), hearthY() - 40, hearthWidth() * 2, 70);
  }

  function paintStatic() {
    // a handful of frozen flames for the poster state
    flames.length = 0;
    for (let i = 0; i < 85; i++) spawnFlame();
    flames.forEach((p) => { p.y -= Math.random() * 115; p.life = 0.28 + Math.random() * 0.55; });
    paint(1);
    document.documentElement.style.setProperty('--glow', intensity.toFixed(2));
    meterFill.style.width = `${Math.round(intensity * 100)}%`;
    meterLabel.textContent = intensity > .9 ? 'fire: roaring' : 'fire: steady';
  }

  /* ---------------- the fire economy + page lighting ---------------- */
  const LABELS = [
    [0.15, 'fire: nearly out'],
    [0.35, 'fire: embers'],
    [0.55, 'fire: steady'],
    [0.78, 'fire: lively'],
    [1.01, 'fire: roaring'],
  ];
  let lastLabel = '';
  let flickerT = 0;

  function updateEconomy(dt) {
    if (stoking) {
      intensity = Math.min(1, intensity + dt * 0.35);
    } else {
      intensity = Math.max(0.25, intensity - dt * 0.008);
    }

    /* page lighting = intensity + organic flicker */
    flickerT += dt * (4 + intensity * 6);
    const flicker = (Math.sin(flickerT) * 0.5 + Math.sin(flickerT * 2.7 + 1.3) * 0.3 + Math.sin(flickerT * 6.1) * 0.2) * 0.035;
    const glow = Math.max(0, Math.min(1, intensity + flicker * intensity));
    document.documentElement.style.setProperty('--glow', glow.toFixed(3));

    meterFill.style.width = `${Math.round(intensity * 100)}%`;
    for (const [limit, label] of LABELS) {
      if (intensity <= limit) {
        if (label !== lastLabel) { meterLabel.textContent = label; lastLabel = label; }
        break;
      }
    }
  }

  /* ---------------- loop -------------------------------------------- */
  if (prefersReducedMotion) {
    intensity = 0.85;
    paintStatic();
  } else {
    let last = performance.now();
    (function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;
      updateEconomy(dt);
      wind += (windTarget - wind) * 0.06;
      windTarget *= 0.97;
      paint(dt * 60);
      requestAnimationFrame(loop);
    })(performance.now());
  }
})();
