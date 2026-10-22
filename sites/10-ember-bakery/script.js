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
    const rect=canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
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
  stokeBtn.addEventListener('blur',endStoke);
  window.addEventListener('blur',endStoke);

  /* a hand waved near the hearth makes the flames lean */
  let wind = 0, windTarget = 0;
  window.addEventListener('pointermove', (e) => {
    const rect=canvas.getBoundingClientRect();
    const dx = e.clientX-rect.left-W/2;
    const dy = e.clientY-rect.top-hearthY();
    const near = Math.hypot(dx, dy) < Math.min(420, W * 0.4);
    windTarget = near ? -Math.sign(dx) * Math.min(1.6, Math.abs(dx) / 130) : 0;
  });

  /* ---------------- particles -------------------------------------- */
  const MAX_P = isSmallScreen ? 130 : 300;
  const flames = [];
  const embers = [];
  const smoke = [];

  function hearthX() { return W / 2; }
  function hearthY() { return H - 25; }
  function hearthWidth() { return W * .72; }

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
      // Soft, advected lobes accumulate as luminous gas, without polygon tips.
      const breadth=Math.max(2,p.r*1.7),height=breadth*(1.7+intensity*.7);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(wind*.08+Math.sin(p.wobble)*.1);ctx.scale(1,height/breadth);
      const flame=ctx.createRadialGradient(0,-breadth*.3,0,0,0,breadth);
      flame.addColorStop(0,`rgba(255,${Math.round(120+p.life*95)},65,${p.life*.2})`);
      flame.addColorStop(.35,`rgba(240,80,12,${p.life*.16})`);
      flame.addColorStop(1,'rgba(150,24,0,0)');ctx.fillStyle=flame;
      ctx.fillRect(-breadth,-breadth,breadth*2,breadth*2);ctx.restore();

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

    // Logs in front of the gas stay visible: black bark with orange fissures.
    ctx.save();ctx.translate(hearthX(),hearthY());
    for(let n=0;n<3;n++){
      ctx.save();ctx.translate((n-1)*W*.12,n===1?-8:3);ctx.rotate((n-1)*.17);
      const logW=W*.33,logH=W*.045;
      const lg=ctx.createLinearGradient(0,-logH,0,logH);lg.addColorStop(0,'#37180c');lg.addColorStop(.5,'#100b09');lg.addColorStop(1,'#6b250b');
      ctx.fillStyle=lg;ctx.beginPath();ctx.roundRect(-logW/2,-logH/2,logW,logH,8);ctx.fill();
      ctx.strokeStyle=`rgba(255,108,25,${.4+intensity*.55})`;ctx.shadowColor='#ff4d0b';ctx.shadowBlur=5;ctx.lineWidth=1;
      for(let j=0;j<7;j++){const x=-logW*.4+j*logW*.13;ctx.beginPath();ctx.moveTo(x,-logH*.3);ctx.lineTo(x+3,1);ctx.lineTo(x-2,logH*.4);ctx.stroke();}
      ctx.restore();
    }
    ctx.restore();
    // Thin refracted-looking warm ribbons above the fire, restrained on phones.
    if(!prefersReducedMotion){ctx.strokeStyle=`rgba(255,180,100,${intensity*.035})`;ctx.lineWidth=3;for(let j=0;j<4;j++){const x=hearthX()+(j-1.5)*30;ctx.beginPath();ctx.moveTo(x,hearthY()-90);ctx.bezierCurveTo(x+Math.sin(flickerT+j)*20,hearthY()-140,x-18,hearthY()-200,x,hearthY()-230);ctx.stroke();}}

    /* glowing coal bed */
    const coalGrad = ctx.createRadialGradient(hearthX(), hearthY() + 10, 4, hearthX(), hearthY() + 10, hearthWidth() * 0.75);
    coalGrad.addColorStop(0, `rgba(255, 120, 30, ${0.5 * intensity + 0.15})`);
    coalGrad.addColorStop(0.5, `rgba(160, 50, 20, ${0.3 * intensity + 0.08})`);
    coalGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coalGrad;
    ctx.globalAlpha=.4;ctx.fillRect(hearthX()-hearthWidth(),hearthY()-5,hearthWidth()*2,30);ctx.globalAlpha=1;
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
