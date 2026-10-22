/* ============================================================
   UMBRA — the tempering vat
   A GPU stable-fluids simulation (advect, splat, divergence,
   Jacobi pressure, projection) inside a round copper vat on a
   marble slab. A dye field carries two scales of surface
   pattern; stirring stretches it into ribbons that relax back.
   The melt is lit by two softboxes whose reflections sharpen
   as the batch comes into temper. A small crystal model runs
   the real curve — melt, cool and seed, rewarm — and the bar
   you pour shows the temper you actually reached.
   ============================================================ */

const $ = (id) => document.getElementById(id);
const canvas = $('vat');
const curveCanvas = $('curve');
const cctx = curveCanvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const small = Math.min(innerWidth, innerHeight) < 600 || coarse;
const lowEnd = small || (navigator.hardwareConcurrency || 8) <= 4;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------- GL context and float targets ---------- */
let gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
const isGL2 = !!gl;
if (!gl) gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });

function floatFormat() {
  if (!gl) return null;
  if (isGL2) {
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;
    return { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, filter: gl.LINEAR };
  }
  const hf = gl.getExtension('OES_texture_half_float');
  if (!hf) return null;
  gl.getExtension('EXT_color_buffer_half_float');
  const lin = gl.getExtension('OES_texture_half_float_linear');
  return { internal: gl.RGBA, format: gl.RGBA, type: hf.HALF_FLOAT_OES, filter: lin ? gl.LINEAR : gl.NEAREST };
}
let FMT = floatFormat();

/* ---------- shaders ---------- */
const VS = `
attribute vec2 aPos;
uniform vec2 uTexel;
varying vec2 vUv, vL, vR, vT, vB;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0); vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y); vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
const HEAD = `precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
float inVat(vec2 uv) { return 1.0 - smoothstep(0.468, 0.482, length(uv - 0.5)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 x) { vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.03; a *= 0.5; } return v; }
`;

const FS = {
  advectVel: HEAD + `
uniform sampler2D uVel; uniform vec2 uTexel; uniform float uDt, uVisc, uSpin, uOmega;
void main() {
  vec2 v = texture2D(uVel, vUv).xy;
  vec2 nv = texture2D(uVel, vUv - uDt * v * uTexel).xy * exp(-uVisc * uDt);
  // the vat turns slowly, as a melanger does
  vec2 r = vUv - 0.5;
  vec2 rot = vec2(-r.y, r.x) * uOmega;
  nv += (rot - nv) * (1.0 - exp(-uSpin * uDt));
  gl_FragColor = vec4(nv * inVat(vUv), 0.0, 1.0);
}`,
  splat: HEAD + `
uniform sampler2D uTarget; uniform vec2 uPoint; uniform vec3 uColor; uniform float uRadius;
void main() {
  vec2 p = vUv - uPoint;
  vec3 s = exp(-dot(p, p) / uRadius) * uColor;
  gl_FragColor = vec4((texture2D(uTarget, vUv).xyz + s) * inVat(vUv), 1.0);
}`,
  divergence: HEAD + `
uniform sampler2D uVel;
void main() {
  float L = texture2D(uVel, vL).x, R = texture2D(uVel, vR).x, T = texture2D(uVel, vT).y, B = texture2D(uVel, vB).y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
  pressure: HEAD + `
uniform sampler2D uP, uDiv;
void main() {
  float L = texture2D(uP, vL).x, R = texture2D(uP, vR).x, T = texture2D(uP, vT).x, B = texture2D(uP, vB).x;
  gl_FragColor = vec4((L + R + T + B - texture2D(uDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`,
  gradient: HEAD + `
uniform sampler2D uP, uVel;
void main() {
  float L = texture2D(uP, vL).x, R = texture2D(uP, vR).x, T = texture2D(uP, vT).x, B = texture2D(uP, vB).x;
  vec2 v = texture2D(uVel, vUv).xy - 0.5 * vec2(R - L, T - B);
  gl_FragColor = vec4(v * inVat(vUv), 0.0, 1.0);
}`,
  advectDye: HEAD + `
uniform sampler2D uVel, uDye, uRest; uniform vec2 uVelTexel; uniform float uDt, uRelax;
void main() {
  vec2 v = texture2D(uVel, vUv).xy;
  vec4 d = texture2D(uDye, vUv - uDt * v * uVelTexel);
  vec4 rest = texture2D(uRest, vUv);
  gl_FragColor = mix(d, rest, 1.0 - exp(-uRelax * uDt));
}`,
  rest: HEAD + `
void main() {
  vec2 p = vUv * 7.0;
  float fine = fbm(p * 2.2 + 3.0);
  float coarse = fbm(p * 0.7 + 11.0);
  float streak = 1.0 - abs(fbm(p * vec2(1.4, 0.5) + 5.0) * 2.0 - 1.0);
  gl_FragColor = vec4(fine, coarse, streak, 1.0);
}`,
  copy: HEAD + `
uniform sampler2D uSrc;
void main() { gl_FragColor = texture2D(uSrc, vUv); }`,
};

// the picture: slab, copper rim, melt — or the bar
const RENDER = HEAD + `
uniform vec2 uRes, uVatC; uniform float uVatR;
uniform sampler2D uDye, uVel, uBar;
uniform vec2 uDyeTexel;
uniform float uTime, uGloss, uThick, uHeat, uSim;
uniform float uPour, uFill, uSet, uQ, uBloom;
uniform vec2 uBarSize;
uniform vec3 uSwirl[6];

// the camera hangs a little above the vat, so the view (and every reflection) changes across it
vec3 viewAt(vec2 pr) { return normalize(vec3(-pr, 2.4)); }

// a softbox, a strip light and a dim ceiling, seen in a reflection direction
vec3 env(vec3 r, float soft) {
  vec2 s = r.xy / max(r.z, 0.05);
  vec2 a = abs(s - vec2(0.17, -0.19)) - vec2(0.12, 0.07);
  float box = 1.0 - smoothstep(-soft, soft, max(a.x, a.y));
  vec2 b = abs(s - vec2(-0.29, 0.03)) - vec2(0.016, 0.16);
  float strip = 1.0 - smoothstep(-soft * 0.6, soft * 0.6, max(b.x, b.y));
  vec3 c = vec3(1.0, 0.9, 0.76) * box * 2.2 + vec3(0.85, 0.88, 1.0) * strip * 1.1;
  c += vec3(0.03, 0.025, 0.02) * smoothstep(0.6, 0.0, length(s)) + vec3(0.004);
  return c;
}

vec3 dyeAt(vec2 suv) {
  if (uSim > 0.5) return texture2D(uDye, suv).rgb;
  // fallback: swirl the plain pattern around the last stir points
  vec2 p = suv;
  for (int i = 0; i < 6; i++) {
    vec2 d = p - uSwirl[i].xy; float a = uSwirl[i].z * exp(-length(d) * 11.0) * 2.4;
    p = uSwirl[i].xy + vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
  }
  vec2 q = p * 7.0;
  return vec3(fbm(q * 2.2 + 3.0 + uTime * 0.02), fbm(q * 0.7 + 11.0), 1.0 - abs(fbm(q * vec2(1.4, 0.5) + 5.0) * 2.0 - 1.0));
}
// a liquid surface is smooth: the broad field makes the relief, the fine one only colours it
float meltH(vec2 suv) { vec3 d = dyeAt(suv); return d.g * 0.82 + d.r * 0.18; }

vec3 marble(vec2 px) {
  vec2 p = px / uRes.y * 3.0;
  float v = fbm(p * vec2(1.0, 1.7) + fbm(p * 2.0) * 1.3);
  float vein = smoothstep(0.035, 0.0, abs(v - 0.52)) * 0.7 + smoothstep(0.012, 0.0, abs(fbm(p * 3.1 + 7.0) - 0.5)) * 0.35;
  vec3 c = mix(vec3(0.03, 0.028, 0.026), vec3(0.06, 0.055, 0.05), fbm(p * 5.0));
  c += vec3(0.32, 0.28, 0.22) * vein * 0.2;
  // polished: a soft reflection of the key softbox, falling off across the slab
  vec2 uv = px / uRes;
  c += vec3(0.9, 0.82, 0.7) * 0.05 * smoothstep(1.2, 0.0, length((uv - vec2(0.25, 0.85)) * vec2(1.0, 1.6)));
  return c;
}

vec3 chocolate(vec3 n, vec3 V, float h, float gloss, float thick, float bloom, float bloomPat) {
  vec3 deep = vec3(0.011, 0.0052, 0.0032), warm = vec3(0.05, 0.022, 0.0115);
  vec3 alb = mix(deep, warm, smoothstep(0.25, 0.8, h));
  alb *= mix(1.15, 0.85, thick);
  float diff = max(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0);
  vec3 col = alb * (0.3 + 0.7 * diff);
  vec3 r = reflect(-V, n);
  float soft = mix(0.3, 0.008, gloss * gloss);
  float F = 0.045 + 0.955 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  col += env(r, soft) * vec3(1.0, 0.93, 0.84) * (F * 5.0 + 0.12) * mix(0.1, 1.0, gloss);
  // bloom: grey sugar and fat haze on a badly set bar
  vec3 bl = vec3(0.42, 0.36, 0.31);
  col = mix(col, bl * (0.5 + 0.5 * diff), bloom * smoothstep(0.35, 0.85, bloomPat) * 0.75 + bloom * 0.18);
  return col;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 d = px - uVatC;
  float r = length(d) / uVatR;
  vec3 col = marble(px);

  /* ---------- the vat ---------- */
  float vatVis = 1.0 - uPour;
  if (vatVis > 0.001) {
    vec3 vc = col;
    // cast shadow of the vat on the slab (light from top-left)
    float sh = smoothstep(1.16, 1.0, length(d - vec2(0.05, -0.07) * uVatR) / uVatR);
    vc *= 1.0 - 0.75 * sh;
    if (r < 1.085) {
      if (r > 0.985) {
        // copper rim: a rounded lip
        float t = (r - 0.985) / 0.1;
        vec2 dir = d / max(length(d), 1.0);
        float slope = cos(t * 3.14159) * 1.4;
        vec3 n = normalize(vec3(dir * slope, 1.0));
        vec3 cu = vec3(0.74, 0.36, 0.18);
        float diff = max(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0);
        vc = cu * (0.03 + 0.2 * diff) + env(reflect(-viewAt(d / uVatR), n), 0.02) * cu * 1.3;
        vc *= 0.85 + 0.15 * fbm(vec2(atan(d.y, d.x) * 30.0, t * 4.0));   // brushed
      } else {
        vec2 suv = d / (2.0 * uVatR / 0.96) + 0.5;
        float e = uDyeTexel.x * 3.0;
        float h = meltH(suv);
        float hx = meltH(suv + vec2(e, 0.0)) - meltH(suv - vec2(e, 0.0));
        float hy = meltH(suv + vec2(0.0, e)) - meltH(suv - vec2(0.0, e));
        // the melt climbs the wall a little
        float men = smoothstep(0.86, 0.985, r);
        vec2 dir = d / max(length(d), 1.0);
        float relief = mix(0.7, 1.5, uThick);
        vec3 n = normalize(vec3(-hx * relief - dir.x * men * 0.5, -hy * relief - dir.y * men * 0.5, 1.0));
        vc = chocolate(n, viewAt(d / uVatR), h, uGloss, uThick, 0.0, 0.0);
        // a warm sheen on a hot batch
        vc += vec3(0.05, 0.02, 0.008) * uHeat * (1.0 - h);
        // the rim shades the edge
        vc *= mix(1.0, 0.45, smoothstep(0.9, 0.99, r) * (0.6 + 0.4 * max(dot(dir, vec2(-0.6, 0.8)), 0.0)));
      }
    }
    col = mix(col, vc, vatVis);
  }

  /* ---------- the bar ---------- */
  if (uPour > 0.001) {
    vec2 bp = d / uBarSize + 0.5;                      // bar texture space
    if (bp.x > -0.05 && bp.x < 1.05 && bp.y > -0.08 && bp.y < 1.08) {
      vec4 bm = texture2D(uBar, clamp(bp, 0.0, 1.0));
      float inside = step(0.0, bp.x) * step(bp.x, 1.0) * step(0.0, bp.y) * step(bp.y, 1.0);
      // shadow of the bar on the slab
      vec4 bms = texture2D(uBar, clamp(bp - vec2(-0.012, 0.03), 0.0, 1.0));
      col *= 1.0 - 0.6 * bms.g * uPour * (1.0 - bm.g);
      if (bm.g * inside > 0.02) {
        // filled from left to right, with a soft glossy front
        float front = uFill * 1.15 - 0.08 + (fbm(vec2(bp.y * 6.0, uTime * 0.6)) - 0.5) * 0.08;
        float filled = smoothstep(front + 0.02, front - 0.02, bp.x);
        float tx = 2.5 / 512.0;
        float hC = bm.r;
        float hx = texture2D(uBar, bp + vec2(tx, 0.0)).r - texture2D(uBar, bp - vec2(tx, 0.0)).r;
        float hy = texture2D(uBar, bp + vec2(0.0, tx)).r - texture2D(uBar, bp - vec2(0.0, tx)).r;
        // still liquid while it fills: flat and glossy; set: the mould's relief
        float setK = uSet;
        vec3 n = normalize(vec3(-hx * 3.2 * setK, -hy * 3.2 * setK, 1.0));
        float gloss = mix(0.95, uQ, setK);
        vec3 Vb = viewAt(d / uVatR);
        vec3 bc = chocolate(n, Vb, 0.3 + hC * 0.2, gloss, 0.4, uBloom * setK, dyeAt(bp * 0.6 + 0.2).b);
        // the empty mould: dark, with a faint reflection
        vec3 mould = vec3(0.02) + env(reflect(-Vb, normalize(vec3(-hx * 6.0, -hy * 6.0, 1.0))), 0.02) * 0.08;
        vec3 c = mix(mould, bc, filled);
        col = mix(col, c, bm.g * uPour);
      }
    }
  }

  // vignette and grain
  vec2 uv = px / uRes;
  col *= 1.0 - 0.45 * smoothstep(0.45, 1.1, length((uv - 0.55) * vec2(1.25, 1.0)));
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash12(px + fract(uTime) * 61.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

/* ---------- GL plumbing ---------- */
let progs = {};
let quad;
function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}
function target(w, h, fmt, filter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, w, h, 0, fmt.format, fmt.type, null);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fb, w, h, texel: [1 / w, 1 / h], ok };
}
function pair(w, h, fmt, filter) {
  const o = { a: target(w, h, fmt, filter), b: target(w, h, fmt, filter) };
  o.read = o.a; o.write = o.b;
  o.swap = () => { const t = o.read; o.read = o.write; o.write = t; };
  return o;
}
function bindTex(unit, t) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t.tex || t);
  return unit;
}
function blit(dst) {
  if (dst) { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h); }
  else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

const SIM = small ? 112 : lowEnd ? 144 : 192;
const DYE = small ? 192 : lowEnd ? 256 : 384;
let vel, div, prs, dye, rest, barTex;
let useSim = false;

function setupGL() {
  quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  progs.render = program(RENDER);
  if (FMT) {
    try {
      for (const k of Object.keys(FS)) progs[k] = program(FS[k]);
      vel = pair(SIM, SIM, FMT, FMT.filter);
      div = target(SIM, SIM, FMT, gl.NEAREST);
      prs = pair(SIM, SIM, FMT, gl.NEAREST);
      dye = pair(DYE, DYE, FMT, FMT.filter);
      rest = target(DYE, DYE, FMT, FMT.filter);
      useSim = vel.a.ok && dye.a.ok && prs.a.ok && rest.ok;
    } catch (err) {
      useSim = false;
    }
  }
  if (useSim) {
    const P = progs.rest;
    gl.useProgram(P.p);
    gl.uniform2f(P.u.uTexel, 1 / DYE, 1 / DYE);
    blit(rest);
    const C = progs.copy;
    gl.useProgram(C.p);
    gl.uniform1i(C.u.uSrc, bindTex(0, rest));
    blit(dye.read);
    blit(dye.write);
  }
  barTex = makeBarTexture();
}

/* the bar mould: R = relief (segments, bevels, the stamp), G = footprint */
function makeBarTexture() {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(0,0,0)';
  g.fillRect(0, 0, W, H);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  // footprint in green, relief in red, built up with blurred bevels
  const pad = 10;
  g.fillStyle = 'rgb(90,255,0)';
  rr(pad, pad, W - pad * 2, H - pad * 2, 18);
  g.fill();
  const cols = 6, rows = 3;
  const gx = (W - pad * 2 - 24) / cols, gy = (H - pad * 2 - 24) / rows;
  g.filter = 'blur(5px)';
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      g.fillStyle = 'rgb(190,255,0)';
      rr(pad + 12 + i * gx + 4, pad + 12 + j * gy + 4, gx - 8, gy - 8, 7);
      g.fill();
      g.fillStyle = 'rgb(235,255,0)';
      rr(pad + 12 + i * gx + 12, pad + 12 + j * gy + 12, gx - 24, gy - 24, 5);
      g.fill();
    }
  }
  // the stamp on the middle pieces
  g.filter = 'blur(1.8px)';
  g.fillStyle = 'rgb(160,255,0)';
  g.font = '600 30px Prata, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('U M B R A', W / 2, H / 2);
  g.filter = 'none';
  // keep relief only inside the footprint
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = '#fff';
  rr(pad, pad, W - pad * 2, H - pad * 2, 18);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

let hasGL = false;
try { if (gl) { setupGL(); hasGL = true; } } catch (err) { console.warn('Umbra: falling back to a still vat.', err); }
if (!hasGL) document.documentElement.classList.add('no-gl');

/* ---------- layout: the vat sits where .vat-spot is ---------- */
const spot = document.querySelector('.vat-spot');
const vat = { cx: 0, cy: 0, r: 100 };
function placeVat() {
  const b = spot.getBoundingClientRect();
  vat.r = (Math.min(b.width, b.height) / 2) * 0.94;
  vat.cx = b.left + b.width / 2;
  vat.cy = b.top + b.height / 2;
}
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, small ? 1.6 : 1.5);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  vat.dpr = dpr;
  placeVat();
  drawCurve();
}
addEventListener('scroll', () => { placeVat(); requestDraw(); }, { passive: true });

/* ---------- the batch ---------- */
const S = {
  T: 48, C5: 0, CU: 0, A: 0, step: 0, hold: false, time: 0, warm: false, auto: false, autoAng: 0,
  phase: 'vat', pour: 0, fill: 0, set: 0, Q: 0, bloom: 0, hist: [],
};
const pointer = { x: 0, y: 0, ang: null, lastT: 0, omega: 0, inVat: false };
const swirls = Array.from({ length: 6 }, () => [0.5, 0.5, 0]);
let swirlHead = 0;
const splats = [];

function toSim(x, y) {
  // CSS px → sim uv (0..1 across the vat's square)
  const k = 2 * vat.r / 0.96;
  return [(x - vat.cx) / k + 0.5, (vat.cy - y) / k + 0.5];
}
function stirAt(x, y, dx, dy, dt) {
  const [u, v] = toSim(x, y);
  const k = 2 * vat.r / 0.96;
  // velocity in sim texels per second
  const vx = (dx / k) * SIM / Math.max(dt, 1 / 120), vy = (-dy / k) * SIM / Math.max(dt, 1 / 120);
  const lim = SIM * 1.6;
  const sp = Math.hypot(vx, vy);
  const f = sp > lim ? lim / sp : 1;
  splats.push([u, v, vx * f * 0.14, vy * f * 0.14]);
  // fallback swirls
  const cx = u - 0.5, cy = v - 0.5;
  const curl = cx * vy - cy * vx;
  swirls[swirlHead] = [u, v, clamp(curl / SIM * 3.0, -1, 1)];
  swirlHead = (swirlHead + 1) % 6;
}

addEventListener('pointermove', (e) => {
  if (S.phase !== 'vat') return;
  const now = performance.now() / 1000;
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  const dt = now - pointer.lastT;
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.lastT = now;
  const rx = e.clientX - vat.cx, ry = e.clientY - vat.cy;
  const inside = Math.hypot(rx, ry) < vat.r * 0.97;
  if (e.pointerType !== 'mouse' && e.buttons === 0 && e.pressure === 0) { pointer.ang = null; return; }
  if (!inside || dt > 0.6) { pointer.ang = null; pointer.inVat = inside; return; }
  pointer.inVat = true;
  const ang = Math.atan2(ry, rx);
  if (pointer.ang != null && dt > 0) {
    let da = ang - pointer.ang;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    // stirring is angular motion around the vat, weighted toward the outer ring
    const w = smooth(0.12, 0.45, Math.hypot(rx, ry) / vat.r);
    pointer.omega = mix(pointer.omega, (da / dt) * w, 0.35);
  }
  pointer.ang = ang;
  if (dt > 0 && Math.hypot(dx, dy) > 0.5) stirAt(e.clientX, e.clientY, dx, dy, dt);
  if (reduceMotion) requestDraw();
}, { passive: true });
canvas.style.touchAction = 'none';

/* ---------- controls ---------- */
const ui = {
  temp: $('temp'), trend: $('trend'), c5: $('c5'), cu: $('cu'), c5v: $('c5-val'), cuv: $('cu-val'),
  cue: $('cue'), steps: [...document.querySelectorAll('.steps li')],
  stir: $('stir'), warm: $('warm'), pour: $('pour'), again: $('again'),
  result: $('result'), rTitle: $('result-title'), rBody: $('result-body'), rGloss: $('r-gloss'), rSnap: $('r-snap'), rBloom: $('r-bloom'), rNotes: $('result-notes'),
};
ui.stir.addEventListener('click', () => {
  S.auto = !S.auto;
  ui.stir.setAttribute('aria-pressed', String(S.auto));
  ui.stir.querySelector('span').textContent = S.auto ? 'Stop stirring' : 'Stir for me';
  requestDraw();
});
const warmOn = (e) => { if (e) e.preventDefault(); S.warm = true; ui.warm.classList.add('held'); requestDraw(); };
const warmOff = () => { S.warm = false; ui.warm.classList.remove('held'); };
ui.warm.addEventListener('pointerdown', (e) => { ui.warm.setPointerCapture?.(e.pointerId); warmOn(e); });
ui.warm.addEventListener('pointerup', warmOff);
ui.warm.addEventListener('pointercancel', warmOff);
ui.warm.addEventListener('lostpointercapture', warmOff);
ui.warm.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) warmOn(e); });
ui.warm.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') warmOff(); });
ui.warm.addEventListener('blur', warmOff);
ui.warm.addEventListener('contextmenu', (e) => e.preventDefault());
ui.pour.addEventListener('click', pour);
ui.again.addEventListener('click', newBatch);
addEventListener('blur', warmOff);

function pour() {
  if (S.phase !== 'vat') return;
  S.phase = 'pour';
  S.auto = false;
  warmOff();
  ui.stir.setAttribute('aria-pressed', 'false');
  ui.stir.querySelector('span').textContent = 'Stir for me';
  const q = quality();
  S.Q = q;
  S.bloom = clamp(1 - q * 1.15, 0, 1);
  const tempered = q > 0.72, close = q > 0.42;
  const hot = S.T > 32.4, unseeded = S.C5 < 0.2;
  ui.rTitle.textContent = tempered ? 'A clean snap.' : close ? 'Nearly there.' : 'It will bloom.';
  ui.rBody.textContent = tempered
    ? `Poured at ${S.T.toFixed(1)}°C with the crystals in order. It released from the mould on its own and breaks with a sound you can hear across the room.`
    : close
      ? `Poured at ${S.T.toFixed(1)}°C. Some Form V took, not enough. The surface is satin rather than mirror, and the snap is soft.`
      : hot
        ? `Poured at ${S.T.toFixed(1)}°C. Too warm: the good crystals had melted, and the fat will rise to the surface as grey streaks.`
        : unseeded
          ? `Poured at ${S.T.toFixed(1)}°C without seeding. With no Form V to follow, it sets soft and streaky.`
          : `Poured at ${S.T.toFixed(1)}°C with unstable crystals still in the melt. They will turn the surface grey within days.`;
  ui.rGloss.textContent = tempered ? 'Mirror' : close ? 'Satin' : 'Dull';
  ui.rSnap.textContent = tempered ? 'Clean, loud' : close ? 'Soft' : 'Bends';
  ui.rBloom.textContent = tempered ? 'None' : close ? 'A little' : hot ? 'Fat bloom' : 'Streaky';
  ui.rNotes.textContent = tempered
    ? 'Tasting: red berries and dried fig, a little tobacco flower, a long clean finish. Pour the next one the same way.'
    : 'Tasting: the cacao is still good. Melt it down and try the curve again: cool to 27, rewarm to 31.5, pour.';
  ui.result.hidden = false;
  document.documentElement.classList.add('poured');
  if (reduceMotion) { S.pour = 1; S.fill = 1; S.set = 1; S.phase = 'bar'; requestDraw(); }
  setTimeout(() => ui.again.focus({ preventScroll: true }), reduceMotion ? 0 : 2600);
}
function newBatch() {
  Object.assign(S, { T: 48, C5: 0, CU: 0, A: 0, step: 0, hold: false, phase: 'vat', pour: 0, fill: 0, set: 0, hist: [] });
  ui.result.hidden = true;
  document.documentElement.classList.remove('poured');
  lastStep = -1;
  updateUI(true);
  requestDraw();
  ui.pour.focus({ preventScroll: true });
}

/* ---------- the crystal model ---------- */
function quality() {
  const band = smooth(29.8, 30.6, S.T) * (1 - smooth(32.1, 32.7, S.T));
  return clamp(S.C5 * (1 - S.CU * 1.3) * band * 1.12, 0, 1);
}
function tick(dt) {
  // agitation: your stirring (angular speed around the vat) or the machine's
  const ideal = (2 * Math.PI) / 1.6;
  let a = clamp(Math.abs(pointer.omega) / ideal, 0, 1.6);
  if (performance.now() / 1000 - pointer.lastT > 0.7) a = 0;
  if (S.auto) a = Math.max(a, 0.95);
  S.A += (a - S.A) * Math.min(1, dt * 2.5);
  pointer.omega *= Math.pow(0.15, dt);
  const A = Math.min(S.A, 1.1);

  const T0 = S.T;
  // once seeded and warmed to working temperature, the vat's thermostat holds 31.5°C
  if (S.C5 >= 0.25 && S.T >= 30.8) S.hold = true;
  if (S.C5 < 0.12) S.hold = false;
  const cool = S.hold ? 0.25 : 1.05;
  const keep = S.hold ? 0.7 * (31.5 - S.T) : 0.015 * (30 - S.T);
  S.T += (-cool * A + keep + (S.warm ? 1.7 : 0)) * dt;
  S.T = clamp(S.T, 20, 52);
  // unstable forms III/IV: quick to form when cold, quick to melt above 29.5
  if (S.T < 29) S.CU += 0.06 * (29 - S.T) * (0.3 + A) * (1 - S.CU) * dt;
  if (S.T > 29.5) S.CU -= 0.35 * (S.T - 29.5) * dt;
  // Form V: seeded by stirring below 28.5, grows with agitation up to 32, melts above 32.2
  if (S.T < 28.5) S.C5 += 0.1 * (28.5 - S.T) * A * dt;
  if (S.T > 26 && S.T < 32.2 && S.C5 > 0.015) S.C5 += 0.065 * A * Math.sqrt(S.C5) * (1 - S.C5) * dt;
  if (S.T > 32.2) S.C5 -= 0.45 * (S.T - 32.2) * dt;
  S.CU = clamp(S.CU, 0, 1);
  S.C5 = clamp(S.C5, 0, 1);
  S.dT = (S.T - T0) / Math.max(dt, 1e-3);

  // which step of the ritual we are on
  const q = quality();
  if (q > 0.72) S.step = 2;
  else if (S.C5 >= 0.25) S.step = 1;
  else S.step = 0;
  S.time += dt;
}

/* ---------- readouts ---------- */
let lastStep = -1, lastCue = '';
// advice changes rarely, so the live region only speaks when it does (the temperature has its own readout)
function cueText() {
  const q = quality();
  if (q > 0.72) return 'In temper. Pour the bar while the gloss holds.';
  if (S.T > 32.2 && S.C5 > 0.05) return 'Too warm: Form V is melting. Let it cool, and seed again if it drops away.';
  if (S.C5 >= 0.25) {
    if (S.T < 29.8) return S.CU > 0.1 ? 'Seeded. Now press and hold “Hold to warm” to bring it up to 31–32°C and melt out the unstable crystals.' : 'Seeded. Warm it to 31–32°C.';
    if (S.CU > 0.05) return 'Warming — the unstable crystals are melting out. Keep stirring.';
    return S.hold ? 'Working temperature — the vat holds 31.5°C now. Keep stirring until Form V passes 80%.' : 'Working temperature. Keep stirring gently until Form V passes 80%.';
  }
  if (S.T > 40) return 'Melted. Stir in slow, steady circles to cool it toward 27°C.';
  if (S.T > 28.5) return 'Cooling. Keep the circles steady.';
  return 'Seeding at 27–28°C. Keep stirring while the crystals take.';
}
function updateUI(force) {
  ui.temp.textContent = S.T.toFixed(1);
  ui.trend.textContent = S.dT < -0.12 ? 'cooling' : S.dT > 0.12 ? 'warming' : 'holding';
  const c5 = Math.round(S.C5 * 100), cu = Math.round(S.CU * 100);
  ui.c5.style.width = `${c5}%`; ui.cu.style.width = `${cu}%`;
  ui.c5v.textContent = `${c5}%`; ui.cuv.textContent = `${cu}%`;
  if (S.step !== lastStep || force) {
    ui.steps.forEach((li, i) => {
      li.classList.toggle('now', i === S.step);
      li.classList.toggle('done', i < S.step);
      if (i === S.step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    lastStep = S.step;
  }
  const cue = cueText();
  if (cue !== lastCue || force) { ui.cue.textContent = cue; lastCue = cue; }
  ui.pour.classList.toggle('ready', S.step === 2);
}

function drawCurve() {
  const w = curveCanvas.clientWidth || 280, h = curveCanvas.clientHeight || 100;
  const d = Math.min(devicePixelRatio || 1, 2);
  if (curveCanvas.width !== Math.round(w * d)) { curveCanvas.width = Math.round(w * d); curveCanvas.height = Math.round(h * d); }
  const g = cctx;
  g.setTransform(d, 0, 0, d, 0, 0);
  g.clearRect(0, 0, w, h);
  const y = (T) => h - ((T - 20) / 32) * h;
  const band = (a, b, col, label) => {
    g.fillStyle = col;
    g.fillRect(0, y(b), w, y(a) - y(b));
    g.fillStyle = 'rgba(241, 230, 212, 0.62)';
    g.font = '500 11px Outfit, sans-serif';
    g.fillText(label, 6, y(b) + 12);
  };
  band(45, 50, 'rgba(201, 150, 63, 0.1)', 'melt 45–50');
  band(31, 32, 'rgba(201, 150, 63, 0.2)', 'work 31–32');
  g.fillStyle = 'rgba(160, 190, 220, 0.14)';
  g.fillRect(0, y(28), w, y(27) - y(28));
  g.fillStyle = 'rgba(241, 230, 212, 0.62)';
  g.fillText('seed 27–28', 6, y(27) + 12);
  const H = S.hist;
  if (H.length > 1) {
    const t1 = H[H.length - 1][0], t0 = t1 - 90;
    g.beginPath();
    H.forEach(([t, T], i) => {
      const x = ((t - t0) / 90) * w;
      i ? g.lineTo(x, y(T)) : g.moveTo(x, y(T));
    });
    g.strokeStyle = '#e8c27a';
    g.lineWidth = 1.6;
    g.stroke();
    const [, Tl] = H[H.length - 1];
    g.fillStyle = '#f1e6d4';
    g.beginPath();
    g.arc(w - 2, y(Tl), 3, 0, Math.PI * 2);
    g.fill();
  }
}

/* ---------- render ---------- */
let drawQueued = false;
function requestDraw() {
  if (!reduceMotion || drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; step(1 / 30, true); });
}

function simulate(dt) {
  const thick = clamp(S.C5 * 0.55 + S.CU * 0.5 + (31 - S.T) / 30, 0, 1);
  // velocity
  let P = progs.advectVel;
  gl.useProgram(P.p);
  gl.uniform2f(P.u.uTexel, vel.read.texel[0], vel.read.texel[1]);
  gl.uniform1i(P.u.uVel, bindTex(0, vel.read));
  gl.uniform1f(P.u.uDt, dt);
  gl.uniform1f(P.u.uVisc, mix(0.9, 2.6, thick));
  gl.uniform1f(P.u.uSpin, reduceMotion ? 0 : 0.35);
  gl.uniform1f(P.u.uOmega, (2 * Math.PI / 40) * SIM);
  blit(vel.write); vel.swap();
  // stirring splats
  P = progs.splat;
  gl.useProgram(P.p);
  gl.uniform2f(P.u.uTexel, vel.read.texel[0], vel.read.texel[1]);
  gl.uniform1f(P.u.uRadius, 0.0028);
  for (const [u, v, fx, fy] of splats.splice(0, 12)) {
    gl.uniform1i(P.u.uTarget, bindTex(0, vel.read));
    gl.uniform2f(P.u.uPoint, u, v);
    gl.uniform3f(P.u.uColor, fx, fy, 0);
    blit(vel.write); vel.swap();
  }
  splats.length = 0;
  // projection
  P = progs.divergence;
  gl.useProgram(P.p);
  gl.uniform2f(P.u.uTexel, vel.read.texel[0], vel.read.texel[1]);
  gl.uniform1i(P.u.uVel, bindTex(0, vel.read));
  blit(div);
  P = progs.pressure;
  gl.useProgram(P.p);
  gl.uniform2f(P.u.uTexel, prs.read.texel[0], prs.read.texel[1]);
  gl.uniform1i(P.u.uDiv, bindTex(1, div));
  for (let i = 0; i < (lowEnd ? 14 : 22); i++) {
    gl.uniform1i(P.u.uP, bindTex(0, prs.read));
    blit(prs.write); prs.swap();
  }
  P = progs.gradient;
  gl.useProgram(P.p);
  gl.uniform2f(P.u.uTexel, vel.read.texel[0], vel.read.texel[1]);
  gl.uniform1i(P.u.uP, bindTex(0, prs.read));
  gl.uniform1i(P.u.uVel, bindTex(1, vel.read));
  blit(vel.write); vel.swap();
  // the pattern rides the flow, then relaxes
  P = progs.advectDye;
  gl.useProgram(P.p);
  gl.uniform2f(P.u.uTexel, dye.read.texel[0], dye.read.texel[1]);
  gl.uniform2f(P.u.uVelTexel, 1 / SIM, 1 / SIM);
  gl.uniform1i(P.u.uVel, bindTex(0, vel.read));
  gl.uniform1i(P.u.uDye, bindTex(1, dye.read));
  gl.uniform1i(P.u.uRest, bindTex(2, rest));
  gl.uniform1f(P.u.uDt, dt);
  gl.uniform1f(P.u.uRelax, mix(0.05, 0.012, thick));
  blit(dye.write); dye.swap();
  return thick;
}

function render(thick) {
  const R = progs.render;
  gl.useProgram(R.p);
  const k = vat.dpr;
  gl.uniform2f(R.u.uTexel, 1 / canvas.width, 1 / canvas.height);
  gl.uniform2f(R.u.uRes, canvas.width, canvas.height);
  gl.uniform2f(R.u.uVatC, vat.cx * k, (innerHeight - vat.cy) * k);
  gl.uniform1f(R.u.uVatR, vat.r * k);
  gl.uniform1i(R.u.uDye, bindTex(0, useSim ? dye.read : barTex));
  gl.uniform1i(R.u.uVel, bindTex(1, useSim ? vel.read : barTex));
  gl.uniform1i(R.u.uBar, bindTex(2, barTex));
  gl.uniform2f(R.u.uDyeTexel, 1 / DYE, 1 / DYE);
  gl.uniform1f(R.u.uTime, S.time);
  gl.uniform1f(R.u.uGloss, 0.55 + 0.45 * quality());
  gl.uniform1f(R.u.uThick, thick);
  gl.uniform1f(R.u.uHeat, smooth(36, 48, S.T));
  gl.uniform1f(R.u.uSim, useSim ? 1 : 0);
  gl.uniform1f(R.u.uPour, S.pour);
  gl.uniform1f(R.u.uFill, S.fill);
  gl.uniform1f(R.u.uSet, S.set);
  gl.uniform1f(R.u.uQ, S.Q);
  gl.uniform1f(R.u.uBloom, S.bloom);
  const bw = Math.min(vat.r * 2.05, innerWidth * 0.92) * k;
  gl.uniform2f(R.u.uBarSize, bw, bw * 0.5);
  gl.uniform3fv(R.u.uSwirl, swirls.flat());
  blit(null);
}

let last = performance.now(), uiT = 0, histT = 0;
function step(dt, still) {
  if (small) placeVat();   // the page scrolls on phones; the canvas does not
  // the machine stirs in perfect circles, at three-fifths of the radius
  if (S.auto && S.phase === 'vat') {
    S.autoAng += dt * (2 * Math.PI / 1.6);
    const r = vat.r * 0.58;
    const x = vat.cx + Math.cos(S.autoAng) * r, y = vat.cy + Math.sin(S.autoAng) * r;
    const x0 = vat.cx + Math.cos(S.autoAng - dt * (2 * Math.PI / 1.6)) * r, y0 = vat.cy + Math.sin(S.autoAng - dt * (2 * Math.PI / 1.6)) * r;
    stirAt(x, y, x - x0, y - y0, dt);
  }
  if (S.phase === 'vat') tick(dt);
  else {
    // pour: the vat gives way, the mould fills, the bar sets
    const k = reduceMotion ? 1 : dt;
    S.pour = Math.min(1, S.pour + k * 1.6);
    if (S.pour >= 1) S.fill = Math.min(1, S.fill + k * 0.55);
    if (S.fill >= 1) S.set = Math.min(1, S.set + k * 0.6);
    if (S.set >= 1) S.phase = 'bar';
    S.time += dt;
  }
  histT += dt;
  if (histT > 0.25 && S.phase === 'vat') {
    histT = 0;
    S.hist.push([S.time, S.T]);
    while (S.hist.length && S.hist[0][0] < S.time - 92) S.hist.shift();
  }
  if (hasGL) {
    const thick = useSim && S.pour < 1 ? simulate(dt) : 0.3;
    render(thick);
  }
  uiT += dt;
  if (uiT > 0.12 || still) { uiT = 0; updateUI(); drawCurve(); }
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  step(dt, false);
  requestAnimationFrame(frame);
}

// reduced motion: the vat only moves while you (or the machine) stir it, or the batch is warming
function reducedLoop(now) {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  const busy = S.auto || S.warm || performance.now() / 1000 - pointer.lastT < 1.2 || S.phase === 'pour';
  if (busy) step(dt, false);
  else if (S.phase === 'vat') { tick(dt); uiT += dt; if (uiT > 0.25) { uiT = 0; updateUI(); drawCurve(); } }
  requestAnimationFrame(reducedLoop);
}

addEventListener('resize', () => { resize(); requestDraw(); });
document.fonts?.ready.then(() => { if (hasGL) barTex = makeBarTexture(); resize(); requestDraw(); });
resize();
updateUI(true);
if (reduceMotion) {
  // a settled, glossy first frame
  for (let i = 0; i < 4; i++) step(1 / 30, true);
  requestAnimationFrame(reducedLoop);
} else {
  requestAnimationFrame(frame);
}
