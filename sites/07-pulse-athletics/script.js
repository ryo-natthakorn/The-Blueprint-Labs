import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------
   PULSE: a 60-second interval round on a draggable dial.
   0–40s = WORK (acid), 40–60s = REST (cool blue). Space runs it.
------------------------------------------------------------------ */

const ROUND = 60;
const WORK_END = 40;

const dial = document.getElementById('dial');
const dialDot = document.getElementById('dial-dot');
const dialTime = document.getElementById('dial-time');
const dialTicks = document.getElementById('dial-ticks');
const workArc = document.getElementById('dial-work');
const restArc = document.getElementById('dial-rest');
const phaseWord = document.getElementById('phase-word');
const statBpm = document.getElementById('stat-bpm');
const statRound = document.getElementById('stat-round');
const statEffort = document.getElementById('stat-effort');
const logoDot = document.getElementById('logo-dot');
const mqTop = document.getElementById('mq-top');
const mqBottom = document.getElementById('mq-bottom');

/* flash layer for phase changes */
const flash = document.createElement('div');
flash.className = 'flash';
flash.setAttribute('aria-hidden', 'true');
document.body.appendChild(flash);

const CX = 100, CY = 100, R = 88;

function polar(angleDeg, r = R) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
}
function arcPath(fromDeg, toDeg, r = R) {
  const [x0, y0] = polar(fromDeg, r);
  const [x1, y1] = polar(toDeg, r);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/* static arcs: WORK 0→240°, REST 240→360° */
workArc.setAttribute('d', arcPath(0, (WORK_END / ROUND) * 360));
restArc.setAttribute('d', arcPath((WORK_END / ROUND) * 360, 359.9));

/* minute ticks */
for (let s = 0; s < ROUND; s += 5) {
  const a = (s / ROUND) * 360;
  const [x0, y0] = polar(a, 74);
  const [x1, y1] = polar(a, s % 10 === 0 ? 66 : 70);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x0); line.setAttribute('y1', y0);
  line.setAttribute('x2', x1); line.setAttribute('y2', y1);
  dialTicks.appendChild(line);
}

/* ------------------------------------------------------------------
   State
------------------------------------------------------------------ */
let seconds = 0;         // position in the round, 0..60
let running = !prefersReducedMotion;
let round = 1;
let lastPhase = 'work';

function phaseAt(s) { return s < WORK_END ? 'work' : 'rest'; }

function setSeconds(s, { announce = true } = {}) {
  seconds = ((s % ROUND) + ROUND) % ROUND;
  const angle = (seconds / ROUND) * 360;
  const [dx, dy] = polar(angle);
  dialDot.setAttribute('cx', dx);
  dialDot.setAttribute('cy', dy);
  const whole = Math.floor(seconds);
  dialTime.textContent = `0:${String(whole).padStart(2, '0')}`;
  dial.setAttribute('aria-valuenow', whole);
  dial.setAttribute('aria-valuetext', `${whole} seconds — ${phaseAt(seconds) === 'work' ? 'work phase' : 'rest phase'}`);

  const phase = phaseAt(seconds);
  if (phase !== lastPhase) {
    lastPhase = phase;
    onPhaseChange(phase, announce);
  }

  /* live numbers */
  if (phase === 'work') {
    const f = seconds / WORK_END;
    statBpm.textContent = String(Math.round(128 + f * 42));
    statEffort.textContent = `${Math.round(72 + f * 26)}%`;
  } else {
    const f = (seconds - WORK_END) / (ROUND - WORK_END);
    statBpm.textContent = String(Math.round(170 - f * 48));
    statEffort.textContent = `${Math.round(98 - f * 30)}%`;
  }
}

function onPhaseChange(phase, announce) {
  document.body.classList.toggle('phase-rest', phase === 'rest');
  phaseWord.textContent = phase === 'work' ? 'WORK' : 'REST';

  if (phase === 'work' && announce) {
    round += 1;
    statRound.textContent = String(round).padStart(2, '0');
  }

  if (prefersReducedMotion || !announce) return;

  gsap.fromTo(flash, { opacity: 0.85 }, { opacity: 0, duration: 0.5, ease: 'power2.out' });
  gsap.fromTo(phaseWord,
    { scale: 1.35, rotate: phase === 'work' ? -3 : 3 },
    { scale: 1, rotate: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
  gsap.fromTo('.line-item',
    { x: (i) => (i % 2 ? 18 : -18) },
    { x: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out' });
}

/* ------------------------------------------------------------------
   Dial interaction — drag anywhere on the SVG ring
------------------------------------------------------------------ */
let scrubbing = false;

function eventToSeconds(e) {
  const rect = dial.getBoundingClientRect();
  const x = e.clientX - (rect.left + rect.width / 2);
  const y = e.clientY - (rect.top + rect.height / 2);
  let deg = Math.atan2(y, x) * 180 / Math.PI + 90;
  if (deg < 0) deg += 360;
  return (deg / 360) * ROUND;
}

dial.addEventListener('pointerdown', (e) => {
  scrubbing = true;
  running = false;
  dial.setPointerCapture(e.pointerId);
  setSeconds(eventToSeconds(e));
});
dial.addEventListener('pointermove', (e) => {
  if (!scrubbing) return;
  setSeconds(eventToSeconds(e));
});
dial.addEventListener('pointerup', () => { scrubbing = false; });
dial.addEventListener('pointercancel', () => { scrubbing = false; });

dial.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault(); running = false; setSeconds(seconds + 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault(); running = false; setSeconds(seconds - 1);
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault(); running = !running;
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && e.target === document.body) {
    e.preventDefault();
    running = !running;
  }
});

/* ------------------------------------------------------------------
   Marquees + heartbeat + clock loop
------------------------------------------------------------------ */
let mqOffset = 0;
let lastT = performance.now();

function loop(now) {
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;

  if (running && !scrubbing) setSeconds(seconds + dt, { announce: true });

  /* marquee speed follows the phase: sprint during WORK, jog during REST */
  const speed = phaseAt(seconds) === 'work' ? 120 : 45;
  mqOffset = (mqOffset + speed * dt) % (mqTop.scrollWidth / 2 || 1000);
  mqTop.style.transform = `translateX(${-mqOffset}px)`;
  mqBottom.style.transform = `translateX(${-mqOffset * 0.8}px)`;

  requestAnimationFrame(loop);
}

if (!prefersReducedMotion) {
  /* heartbeat on the logo dot, tempo tied to displayed BPM */
  (function heartbeat() {
    const bpm = Number(statBpm.textContent) || 120;
    gsap.fromTo(logoDot, { scale: 1.45 }, {
      scale: 1, duration: 0.35, ease: 'power2.out',
      onComplete: () => setTimeout(heartbeat, Math.max(60000 / bpm - 350, 50)),
    });
  })();

  setSeconds(0, { announce: false });
  requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(loop); });

  /* load-in: everything slams into place */
  gsap.from('.logo', { y: -40, opacity: 0, duration: 0.6, ease: 'power3.out' });
  gsap.from('.phase-word', { scale: 2.2, opacity: 0, duration: 0.55, ease: 'power4.out', delay: 0.1 });
  gsap.from('.dial', { scale: 0.7, opacity: 0, duration: 0.7, ease: 'back.out(1.6)', delay: 0.2 });
  gsap.from('.stat', { x: 30, opacity: 0, stagger: 0.08, duration: 0.5, ease: 'power3.out', delay: 0.35 });
  gsap.from('.line-item', { y: 24, opacity: 0, stagger: 0.09, duration: 0.5, ease: 'power3.out', delay: 0.45 });
} else {
  setSeconds(22, { announce: false });
  statRound.textContent = '01';
}
