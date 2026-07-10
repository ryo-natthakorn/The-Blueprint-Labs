/* ============================================================
   UMBRA — the conching vat
   Molten chocolate as a domain-warped FBM heightfield with a
   specular gold key light, shaded from its own gradient. The
   pointer drags a chain of six swirl centres through the melt.
   Stirring in slow, steady circles grows Form-V crystals: the
   temper meter is a physics-of-motion judge — too fast shears
   the crystals, standing still lets the batch bloom.
   ============================================================ */

const canvas = document.getElementById('vat');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 760px)').matches;
const gl = canvas.getContext('webgl', { antialias: false });

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uTemper;         // 0..1 — sheen and structure
uniform vec3 uSwirl[6];        // xy = pos (uv), z = strength

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.07;
    a *= 0.5;
  }
  return v;
}

/* the melt height at a point, after swirls and slow conching flow */
float melt(vec2 p) {
  // conching: the whole vat turns very slowly
  vec2 c = p - 0.5;
  float ang = 0.05 * uTime;
  p = vec2(c.x * cos(ang) - c.y * sin(ang), c.x * sin(ang) + c.y * cos(ang)) + 0.5;

  // pointer swirls: rotational displacement around each centre
  for (int i = 0; i < 6; i++) {
    vec2 d = p - uSwirl[i].xy;
    float r = length(d);
    float s = uSwirl[i].z * exp(-r * 9.0);
    float a = s * 2.6;
    p = uSwirl[i].xy + vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
  }

  vec2 q = vec2(fbm(p * 3.0 + uTime * 0.03), fbm(p * 3.0 - uTime * 0.02 + 5.2));
  return fbm(p * 3.0 + q * 1.7 + uTime * 0.015);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 p = uv * asp;

  float h = melt(p);
  float e = 0.004;
  vec3 n = normalize(vec3(
    melt(p - vec2(e, 0.0)) - melt(p + vec2(e, 0.0)),
    melt(p - vec2(0.0, e)) - melt(p + vec2(0.0, e)),
    e * 14.0
  ));

  // base cacao ramp by height — folds read as ridges of darker mass
  vec3 deep = vec3(0.075, 0.038, 0.022);
  vec3 mid = vec3(0.24, 0.126, 0.062);
  vec3 high = vec3(0.42, 0.24, 0.13);
  vec3 col = mix(deep, mid, smoothstep(0.25, 0.62, h));
  col = mix(col, high, smoothstep(0.62, 0.92, h));

  // warm key light, gold specular that sharpens with temper
  vec3 L = normalize(vec3(0.5, 0.65, 0.55));
  float diff = max(dot(n, L), 0.0);
  col *= 0.55 + diff * 0.75;
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 Hv = normalize(L + V);
  float shine = mix(24.0, 160.0, uTemper);
  float spec = pow(max(dot(n, Hv), 0.0), shine);
  vec3 specCol = mix(vec3(0.9, 0.75, 0.5), vec3(1.0, 0.85, 0.55), uTemper);
  col += specCol * spec * (0.22 + uTemper * 0.75);

  // in-temper snap: faint crystalline glints
  float glint = step(0.997, hash(floor(p * 240.0) + floor(uTime * 3.0))) * uTemper;
  col += vec3(1.0, 0.9, 0.65) * glint * 0.5;

  // vat vignette
  float d = length(uv - 0.5);
  col *= 1.0 - smoothstep(0.42, 0.78, d) * 0.72;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
gl.linkProgram(prog);
gl.useProgram(prog);

const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, 'aPos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const U = {
  uRes: gl.getUniformLocation(prog, 'uRes'),
  uTime: gl.getUniformLocation(prog, 'uTime'),
  uTemper: gl.getUniformLocation(prog, 'uTemper'),
  uSwirl: gl.getUniformLocation(prog, 'uSwirl[0]') || gl.getUniformLocation(prog, 'uSwirl'),
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.6);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
resize();
window.addEventListener('resize', resize);

/* ---------- stirring: a chain of decaying swirl centres ---------- */

const SWIRLS = 6;
const swirls = Array.from({ length: SWIRLS }, () => ({ x: 0.5, y: 0.5, s: 0 }));
let swirlHead = 0;
let lastDrop = 0;

let px = 0.5, py = 0.5, pvx = 0, pvy = 0;
let lastPX = 0.5, lastPY = 0.5, lastMoveT = 0;

window.addEventListener('pointermove', (e) => {
  const asp = window.innerWidth / window.innerHeight;
  const nx = (e.clientX / window.innerWidth) * asp;
  const ny = 1 - e.clientY / window.innerHeight;
  const now = performance.now();
  const dtm = Math.max(8, now - lastMoveT);
  pvx = (nx - lastPX) / dtm * 1000;
  pvy = (ny - lastPY) / dtm * 1000;
  lastPX = nx; lastPY = ny; lastMoveT = now;
  px = nx; py = ny;

  // drop a swirl every ~70ms of movement, spin sign from curl of motion
  if (now - lastDrop > 70) {
    const speed = Math.hypot(pvx, pvy);
    if (speed > 0.05) {
      const sw = swirls[swirlHead];
      sw.x = nx; sw.y = ny;
      // signed curl relative to vat centre — clockwise stirs negative
      const cx2 = nx - 0.5 * (window.innerWidth / window.innerHeight), cy2 = ny - 0.5;
      const curl = cx2 * pvy - cy2 * pvx;
      sw.s = Math.max(-1, Math.min(1, curl * 2.4)) * Math.min(1, speed * 1.4);
      swirlHead = (swirlHead + 1) % SWIRLS;
      lastDrop = now;
    }
  }
});

/* ---------- temper judge ---------- */

const pctEl = document.getElementById('temper-pct');
const fillEl = document.getElementById('temper-fill');
const stageEl = document.getElementById('temper-stage');
const noteEl = document.getElementById('temper-note');

let temper = 0;
let stirQuality = 0;

const STAGES = [
  { at: 0, stage: 'molten · unstructured', note: '' },
  { at: 0.25, stage: 'seeding · form IV', note: '"patience is an ingredient."' },
  { at: 0.55, stage: 'building · form V', note: '"the gloss arrives before the snap."' },
  { at: 0.85, stage: 'nearly there', note: '"do not rush the last degree."' },
  { at: 0.98, stage: 'IN TEMPER · 31.5°C', note: 'notes: dried fig, tobacco flower, rain on warm stone. pour the bar.' },
];
let shownStage = null;

function judgeStir(dt, now) {
  const speed = Math.hypot(pvx, pvy);
  const idle = now - lastMoveT > 700;
  // the sweet spot: deliberate, continuous motion
  const target = idle ? 0 : speed > 0.1 && speed < 1.1 ? 1 : speed >= 1.1 ? -0.7 : 0;
  stirQuality += (target - stirQuality) * Math.min(1, dt * 3);
  temper += stirQuality * dt * 0.055;
  temper = Math.max(0, Math.min(1, temper));

  pctEl.textContent = `${Math.round(temper * 100)}%`;
  fillEl.style.height = `${temper * 100}%`;
  let stage = STAGES[0];
  for (const s of STAGES) if (temper >= s.at) stage = s;
  if (stage !== shownStage) {
    shownStage = stage;
    stageEl.textContent = stage.stage;
    noteEl.textContent = stage.note;
  }
}

/* ---------- loop ---------- */

let t = reduceMotion ? 90 : 0;
let last = performance.now();
const swirlData = new Float32Array(SWIRLS * 3);

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!reduceMotion) t += dt * (0.7 + temper * 0.25);

  // swirls decay; the melt forgets
  for (const sw of swirls) sw.s *= Math.pow(0.45, dt);
  pvx *= Math.pow(0.02, dt);
  pvy *= Math.pow(0.02, dt);

  judgeStir(dt, now);

  for (let i = 0; i < SWIRLS; i++) {
    swirlData[i * 3] = swirls[i].x;
    swirlData[i * 3 + 1] = swirls[i].y;
    swirlData[i * 3 + 2] = swirls[i].s;
  }

  gl.uniform2f(U.uRes, canvas.width, canvas.height);
  gl.uniform1f(U.uTime, t);
  gl.uniform1f(U.uTemper, temper);
  gl.uniform3fv(U.uSwirl, swirlData);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
