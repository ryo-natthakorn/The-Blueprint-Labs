/* ============================================================
   PETRICHOR — the sky is a fragment shader
   Raw WebGL, one quad. Five-octave FBM clouds lit by a sun
   whose elevation follows the hour dial; the storm slider
   drives coverage, darkness, wind and screen-space rain, and
   past 60% the shader is allowed to throw lightning. Stars
   come out on schedule. No textures, no libraries.
   ============================================================ */

const canvas = document.getElementById('sky');
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
uniform float uHour;    // 0..24
uniform float uStorm;   // 0..1
uniform float uFlash;   // lightning 0..1
uniform vec2 uPar;      // pointer parallax

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v;
}

vec3 skyGradient(float elev, float y, float storm) {
  // day
  vec3 dayTop = vec3(0.25, 0.48, 0.75);
  vec3 dayHor = vec3(0.72, 0.82, 0.88);
  // golden
  vec3 goldTop = vec3(0.24, 0.26, 0.45);
  vec3 goldHor = vec3(0.95, 0.58, 0.32);
  // night
  vec3 nightTop = vec3(0.015, 0.03, 0.07);
  vec3 nightHor = vec3(0.06, 0.09, 0.16);

  float day = smoothstep(0.08, 0.42, elev);
  float gold = smoothstep(-0.12, 0.1, elev) * (1.0 - day);
  vec3 top = nightTop * (1.0 - day - gold) + goldTop * gold + dayTop * day;
  vec3 hor = nightHor * (1.0 - day - gold) + goldHor * gold + dayHor * day;
  vec3 col = mix(hor, top, pow(clamp(y, 0.0, 1.0), 0.8));
  // storms eat color
  return mix(col, vec3(dot(col, vec3(0.333))) * 0.55, storm * 0.72);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv + uPar * 0.02 * (1.0 - uv.y);
  float aspect = uRes.x / uRes.y;

  float elev = sin((uHour - 6.0) / 12.0 * 3.14159); // -1..1
  float night = smoothstep(0.02, -0.18, elev);
  float storm = uStorm;

  vec3 col = skyGradient(elev, uv.y, storm);

  // sun / moon
  vec2 sunPos = vec2(0.5 + cos((uHour - 6.0) / 12.0 * 3.14159) * 0.42, 0.12 + elev * 0.75);
  float sunD = length((p - sunPos) * vec2(aspect, 1.0));
  vec3 sunCol = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.95, 0.85), smoothstep(0.0, 0.4, elev));
  col += sunCol * exp(-sunD * 22.0) * (1.0 - night) * (1.0 - storm * 0.8) * 1.6;
  col += sunCol * exp(-sunD * 4.5) * (1.0 - night) * (1.0 - storm * 0.9) * 0.35;
  // moon: small, cool, opposite schedule
  vec2 moonPos = vec2(0.5 - cos((uHour - 6.0) / 12.0 * 3.14159) * 0.4, 0.15 - elev * 0.65);
  float moonD = length((p - moonPos) * vec2(aspect, 1.0));
  col += vec3(0.8, 0.85, 0.95) * exp(-moonD * 60.0) * night * (1.0 - storm) * 0.9;

  // stars
  float starField = step(0.9975, hash(floor(p * vec2(aspect, 1.0) * 220.0)));
  float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + hash(floor(p * 220.0)) * 40.0);
  col += vec3(0.9) * starField * twinkle * night * (1.0 - storm) * smoothstep(0.35, 1.0, uv.y);

  // wind speed scales with storm
  vec2 wind = vec2(uTime * (0.012 + storm * 0.06), uTime * 0.004);

  // two cloud decks
  float coverage = mix(0.52, 0.18, storm);   // lower threshold = more cloud
  float deckA = fbm(p * vec2(aspect, 1.0) * 3.2 + wind * 3.0);
  float deckB = fbm(p * vec2(aspect, 1.0) * 6.5 + wind * 6.2 + 40.0);
  float cloud = smoothstep(coverage, coverage + 0.42, deckA * 0.72 + deckB * 0.38);
  cloud = clamp(cloud * (0.65 + storm * 0.6), 0.0, 1.0);

  // cloud shading: lit by the sun side, dark bellies in storm
  float lit = fbm(p * vec2(aspect, 1.0) * 3.2 + wind * 3.0 + vec2(0.06, 0.09));
  vec3 cloudBright = mix(vec3(0.98), sunCol * 0.9 + 0.25, 0.35) * (0.4 + 0.6 * max(elev, 0.0));
  cloudBright = mix(cloudBright, vec3(0.65, 0.68, 0.72), storm * 0.5);
  vec3 cloudDark = mix(vec3(0.55, 0.58, 0.64), vec3(0.13, 0.14, 0.17), storm);
  cloudDark *= (0.3 + 0.7 * max(elev * 0.7 + 0.3, 0.12));
  vec3 cloudCol = mix(cloudDark, cloudBright, clamp((lit - deckA) * 4.0 + 0.55, 0.0, 1.0));
  cloudCol = mix(cloudCol, cloudCol * vec3(0.5, 0.55, 0.75), night * 0.85);

  col = mix(col, cloudCol, cloud * (0.85 + storm * 0.15));

  // rain: slanted screen-space streaks
  if (storm > 0.25) {
    vec2 rp = vec2(p.x * 60.0 * aspect + p.y * 14.0, p.y * 3.0 + uTime * (1.4 + storm * 2.2));
    float lane = hash(vec2(floor(rp.x), 7.0));
    float streak = step(1.0 - storm * 0.32, fract(lane + floor(rp.y) * 0.13)) *
                   smoothstep(0.45, 0.0, abs(fract(rp.x) - 0.5)) *
                   smoothstep(0.9, 0.4, fract(rp.y * 0.5));
    col += vec3(0.7, 0.78, 0.88) * streak * 0.35 * smoothstep(0.25, 0.6, storm);
  }

  // lightning: flash from inside the cloud deck
  col += vec3(0.9, 0.92, 1.0) * uFlash * (0.35 + cloud * 0.9);

  // gentle vignette
  col *= 1.0 - 0.32 * pow(length(uv - 0.5) * 1.35, 2.2);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s));
  }
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

const U = {};
for (const name of ['uRes', 'uTime', 'uHour', 'uStorm', 'uFlash', 'uPar']) {
  U[name] = gl.getUniformLocation(prog, name);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
resize();
window.addEventListener('resize', resize);

/* ---------- controls + readings ---------- */

const hourInput = document.getElementById('hour');
const stormInput = document.getElementById('storm');
const hourOut = document.getElementById('hour-out');
const stormOut = document.getElementById('storm-out');
const condEl = document.getElementById('cond');
const rdTime = document.getElementById('rd-time');
const rdTemp = document.getElementById('rd-temp');
const rdWind = document.getElementById('rd-wind');
const rdCeil = document.getElementById('rd-ceil');

let hour = 14, storm = 0.12;
let hourNow = 14, stormNow = 0.12;

function fmtHour(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function updateReadings() {
  hourOut.textContent = fmtHour(hour);
  rdTime.textContent = fmtHour(hour);
  const elev = Math.sin((hour - 6) / 12 * Math.PI);
  const temp = Math.round(8 + elev * 12 - storm * 6);
  rdTemp.textContent = `${temp}°`;
  rdWind.textContent = `${Math.round(4 + storm * 34)} kt`;
  rdCeil.textContent = storm > 0.65 ? 'on the deck' : storm > 0.3 ? 'lowering' : 'high';
  stormOut.textContent = storm > 0.8 ? 'severe' : storm > 0.55 ? 'squall' : storm > 0.28 ? 'unsettled' : 'calm';
  const night = elev < -0.05;
  condEl.textContent =
    storm > 0.8 ? 'SQUALL' :
    storm > 0.55 ? 'STORM INBOUND' :
    storm > 0.28 ? (night ? 'RAIN AFTER DARK' : 'UNSETTLED') :
    night ? 'CLEAR NIGHT' : elev < 0.25 ? 'GOLDEN HOUR' : 'FAIR';
}
hourInput.addEventListener('input', () => { hour = +hourInput.value; updateReadings(); });
stormInput.addEventListener('input', () => { storm = stormInput.value / 100; updateReadings(); });
updateReadings();

/* pointer parallax */
let parX = 0, parY = 0;
window.addEventListener('pointermove', (e) => {
  parX = (e.clientX / window.innerWidth - 0.5) * 2;
  parY = (e.clientY / window.innerHeight - 0.5) * 2;
});

/* ---------- lightning ---------- */

let flash = 0;
let nextBolt = 4;

/* ---------- loop ---------- */

let t = reduceMotion ? 120 : 0;
let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!reduceMotion) t += dt;

  hourNow += (hour - hourNow) * 0.06;
  stormNow += (storm - stormNow) * 0.04;

  if (!reduceMotion && stormNow > 0.6) {
    nextBolt -= dt * (stormNow * 2);
    if (nextBolt <= 0) {
      flash = 0.9 + Math.random() * 0.4;
      nextBolt = 1.5 + Math.random() * 6;
    }
  }
  flash = Math.max(0, flash - dt * (flash > 0.5 ? 6 : 2.4)); // sharp attack, soft tail

  gl.uniform2f(U.uRes, canvas.width, canvas.height);
  gl.uniform1f(U.uTime, t);
  gl.uniform1f(U.uHour, hourNow);
  gl.uniform1f(U.uStorm, stormNow);
  gl.uniform1f(U.uFlash, Math.min(1, flash));
  gl.uniform2f(U.uPar, parX, -parY);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
