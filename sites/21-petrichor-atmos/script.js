/* ============================================================
   PETRICHOR — the sky is a fragment shader
   Raw WebGL, one full-screen triangle. A single-scattering
   atmosphere, a raymarched cumulus deck (3D texture noise,
   Beer–Lambert, sun shadow, powder, silver lining), three
   ridges in aerial perspective and a plain that the rain turns
   into a mirror. The storm lowers the base and builds towers;
   lightning is a branched bolt drawn on a 2D overlay that also
   lights the cloud it came from. The scent index peaks when
   rain first meets dry ground.
   ============================================================ */

const canvas = document.getElementById('sky');
const boltCanvas = document.getElementById('bolts');
const bctx = boltCanvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const cores = navigator.hardwareConcurrency || 4;

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------- quality tiers ---------- */
const small = Math.min(innerWidth, innerHeight) < 600 || coarse;
const TIER = small
  ? { steps: 18, light: 2, detail: 0, scale: 0.5, dprCap: 2 }
  : cores <= 4
    ? { steps: 26, light: 2, detail: 0, scale: 0.55, dprCap: 1.5 }
    : { steps: 40, light: 3, detail: 1, scale: 0.7, dprCap: 1.5 };
let renderScale = TIER.scale;

/* ---------- WebGL ---------- */
const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uMoon;
uniform float uStorm;
uniform float uRain;
uniform float uWet;
uniform float uFlash;
uniform vec3 uBolt;
uniform vec3 uCamF;
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform float uTanH;
uniform float uSteps;
uniform float uLight;
uniform float uDetail;
uniform float uBase;
uniform float uTop;
uniform float uCover;
uniform float uSigma;
uniform vec2 uWind;
uniform float uEvo;
uniform float uFog;
uniform float uSlant;
uniform float uSeed;
uniform sampler2D uNoise;

#define PI 3.14159265
#define MAX_STEPS 48
const vec3 RO = vec3(0.0, 0.002, 0.0);       // camera: 2 m above the plain (units: km)
const vec3 BR = vec3(5.8e-3, 13.5e-3, 33.1e-3);
const float BM = 7.0e-3;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float noise1(float x) {
  float i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), f);
}
float noise2(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
// 3D value noise from one bilinear fetch (the G channel is R shifted by (37,17) per z)
float noise3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec2 uv = (p.xy + vec2(37.0, 17.0) * p.z) + f.xy;
  vec2 rg = texture2D(uNoise, (uv + 0.5) / 256.0).yx;
  return mix(rg.x, rg.y, f.z);
}

/* ---------- atmosphere ---------- */
float airmass(float c) {
  c = clamp(c, 0.0, 1.0);
  return 1.0 / (c + 0.15 * pow(93.885 - degrees(acos(c)), -1.253));
}
const vec3 AER = vec3(0.09, 0.12, 0.16);        // aerosol optical depth (Angstrom-ish)
vec3 transmit(float c) {
  return exp(-(BR * 8.0 + AER) * airmass(c));
}
float phaseR(float mu) { return 0.0597 * (1.0 + mu * mu); }
float phaseHG(float mu, float g) {
  float g2 = g * g;
  return 0.0796 * (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * mu, 1.5);
}
// single scattering from one light, along a view direction
vec3 scatter(vec3 rd, vec3 ld, float E) {
  float mu = dot(rd, ld);
  float mv = airmass(max(rd.y, 0.0) + 0.02);
  // light reaching the scattering air: high air sees the sun through less atmosphere
  float lc = max(ld.y, 0.0) + 0.02 + 0.3 * max(rd.y, 0.0) * (1.0 - max(ld.y, 0.0));
  vec3 Tl = transmit(lc);
  vec3 bR = BR * phaseR(mu);
  float bM = BM * phaseHG(mu, 0.7);
  vec3 ext = BR * 8.0 + BM * 1.2;
  vec3 ins = (bR * 8.0 + bM * 1.2) / ext * (1.0 - exp(-ext * mv)) / (1.0 + mv * 0.045);
  float shadow = smoothstep(-0.16, 0.02, ld.y);   // the earth's shadow at dusk
  return E * ins * Tl * shadow * 4.0 * PI;
}

vec3 sunColor() { return 20.0 * transmit(max(uSun.y, 0.0)) * smoothstep(-0.12, 0.0, uSun.y); }
vec3 moonColor() { return 0.16 * vec3(0.72, 0.8, 1.0) * transmit(max(uMoon.y, 0.0)) * smoothstep(-0.05, 0.05, uMoon.y); }

vec3 skyColor(vec3 rd) {
  // a low sun lights less sky; the clouds keep their direct light
  vec3 c = scatter(rd, uSun, 20.0 * mix(0.3, 1.0, smoothstep(0.0, 0.4, uSun.y)));
  c += scatter(rd, uMoon, 0.03) * vec3(0.8, 0.88, 1.0);
  // ozone keeps the twilight zenith blue
  float tw = smoothstep(-0.2, 0.0, uSun.y) * (1.0 - smoothstep(0.05, 0.35, uSun.y));
  c += vec3(0.02, 0.07, 0.22) * tw * (0.4 + 0.6 * max(rd.y, 0.0)) * 1.4;
  c += vec3(0.012, 0.02, 0.045) * (1.0 - smoothstep(-0.1, 0.1, uSun.y)) * (0.6 + 0.4 * max(rd.y, 0.0)); // night air glow
  // storms grey the sky out
  float g = dot(c, vec3(0.3, 0.5, 0.2));
  c = max(mix(vec3(g), c, 1.18), 0.0);                 // a touch more blue
  c = mix(c, vec3(g) * vec3(0.92, 0.96, 1.04), uStorm * 0.75);
  c *= 1.0 - 0.74 * smoothstep(0.35, 1.0, uStorm);
  return c;
}

/* ---------- clouds ---------- */
float cloudMap(vec3 p, float lod) {
  float hf = (p.y - uBase) / (uTop - uBase);
  if (hf <= 0.0 || hf >= 1.0) return 0.0;
  vec3 q = vec3(p.x + uWind.x, p.y * 1.25 + uEvo, p.z + uWind.y) * 0.62;
  float n = noise3(q) * 0.5 + noise3(q * 2.03 + 3.1) * 0.25 + noise3(q * 4.07 + 7.7) * 0.125;
  if (lod > 0.5) {
    n += noise3(q * 8.13 + 1.3) * 0.0625;
    if (uDetail > 0.5) n += noise3(q * 16.3 + 9.1) * 0.031;
    else n += 0.016;
  } else n += 0.047;
  // flat bases, rounded tops; storms keep their mass higher up
  float prof = smoothstep(0.0, 0.08 + 0.06 * uStorm, hf) * (1.0 - smoothstep(0.3 + 0.45 * uStorm, 1.0, hf));
  // macro structure: cloud streets in fair weather, darker cores in storms
  float macro = noise2(p.xz * 0.07 + uWind * 0.07 + 11.0) - 0.5;
  float d = n - uCover - macro * (0.16 + 0.12 * uStorm) - (1.0 - prof) * 0.35;
  return clamp(d * 3.4, 0.0, 1.0);
}

vec4 marchClouds(vec3 rd, vec3 keyDir, vec3 keyCol, vec3 ambTop, vec3 ambBot, float jitter, out float tFirst) {
  tFirst = 1e5;
  if (rd.y <= 0.004) return vec4(0.0, 0.0, 0.0, 1.0);
  float t0 = (uBase - RO.y) / rd.y;
  float t1 = (uTop - RO.y) / rd.y;
  if (t0 > 110.0) return vec4(0.0, 0.0, 0.0, 1.0);
  t1 = min(t1, t0 + 28.0);
  t1 = min(t1, 120.0);
  float dt = (t1 - t0) / uSteps;
  float t = t0 + dt * jitter;
  float T = 1.0;
  vec3 L = vec3(0.0);
  float mu = dot(rd, keyDir);
  float ph = (phaseHG(mu, 0.62) * 0.72 + phaseHG(mu, -0.22) * 0.28) * 4.0 * PI;
  for (int i = 0; i < MAX_STEPS; i++) {
    if (float(i) >= uSteps) break;
    vec3 p = RO + rd * t;
    float d = cloudMap(p, 1.0);
    if (d > 0.002) {
      tFirst = min(tFirst, t);
      // light march toward the key light
      float ld = 0.0;
      float ls = 0.09;
      for (int j = 0; j < 3; j++) {
        if (float(j) >= uLight) break;
        ld += cloudMap(p + keyDir * ls, 0.0) * ls;
        ls *= 2.4;
      }
      float sh = max(exp(-ld * uSigma), exp(-ld * uSigma * 0.22) * 0.55);
      // the mass above: storm bases sit under kilometres of cloud
      float above = (uTop - p.y) / (uTop - uBase);
      sh *= exp(-above * mix(0.9, 3.6, uStorm));
      float powder = 1.0 - exp(-d * 3.0);
      float hf = clamp((p.y - uBase) / (uTop - uBase), 0.0, 1.0);
      vec3 amb = mix(ambBot, ambTop, hf * 0.8 + 0.2) * mix(0.62, 0.3, uStorm);
      vec3 S = keyCol * sh * ph * mix(0.55, 1.0, powder) + amb;
      // lightning lights the cloud from inside
      float bd = length(p - uBolt);
      S += vec3(0.75, 0.82, 1.0) * uFlash * 12.0 * exp(-bd * 0.75);
      float a = exp(-d * uSigma * dt);
      L += T * S * (1.0 - a);
      T *= a;
      if (T < 0.02) break;
    }
    t += dt;
  }
  return vec4(L, T);
}

// one-sample cloud estimate, for reflections
vec4 cheapClouds(vec3 rd, vec3 keyCol, vec3 amb) {
  if (rd.y <= 0.01) return vec4(0.0, 0.0, 0.0, 1.0);
  float tm = ((uBase + uTop) * 0.5 - RO.y) / rd.y;
  vec3 p = RO + rd * tm;
  float d = cloudMap(vec3(p.x, mix(uBase, uTop, 0.3), p.z), 0.0);
  float a = 1.0 - exp(-d * 6.0);
  vec3 c = keyCol * 0.05 + amb * 1.4;
  return vec4(c * a, 1.0 - a);
}

/* ---------- land ---------- */
float ridge(float x) {
  float n = noise1(x) * 0.55 + noise1(x * 2.3 + 4.0) * 0.3 + noise1(x * 5.1 + 9.0) * 0.15;
  return 1.0 - abs(n * 2.0 - 1.0);
}
// elevation angle of each ridge at an azimuth (radians)
float ridgeA(float az) { return 0.0018 + 0.017 * pow(ridge(az * 5.0 + 1.3), 1.6); }
float ridgeB(float az) { return 0.003 + 0.024 * pow(ridge(az * 2.6 + 7.0), 1.4); }
float ridgeC(float az) { return 0.004 + 0.034 * pow(ridge(az * 1.4 + 3.3), 1.3); }

vec3 fogColor(vec3 rd) {
  vec3 h = skyColor(normalize(vec3(rd.x, 0.02, rd.z)));
  return mix(h, vec3(dot(h, vec3(0.33))) * vec3(0.85, 0.9, 1.0), uStorm * 0.5);
}

vec3 hillColor(float D, vec3 rd, vec3 keyCol, vec3 amb, float shade) {
  vec3 alb = mix(vec3(0.16, 0.15, 0.1), vec3(0.09, 0.1, 0.09), uWet);
  vec3 c = alb * (amb * 0.3 + keyCol * max(uSun.y, 0.0) * 0.5 * shade) * 0.318;
  float fog = 1.0 - exp(-D / uFog);
  return mix(c, fogColor(rd), fog);
}

// rain rings on standing water (meters)
vec2 ripples(vec2 P, float t) {
  vec2 n = vec2(0.0);
  for (int k = 0; k < 2; k++) {
    vec2 g = P * (k == 0 ? 2.2 : 3.7) + float(k) * 17.0;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash12(id);
    vec2 o = vec2(hash12(id + 3.1), hash12(id + 7.7)) - 0.5;
    float ph = fract(t * (0.9 + h * 0.8) + h * 13.0);
    vec2 v = f - o * 0.6;
    float r = length(v);
    float ring = sin((r - ph * 0.55) * 60.0) * smoothstep(0.08, 0.0, abs(r - ph * 0.55)) * (1.0 - ph);
    n += v / max(r, 1e-3) * ring * step(1.0 - uRain * 0.9, h);
  }
  return n * 0.18;
}

/* ---------- rain streaks (screen space, three depths) ---------- */
float rainLayer(vec2 uv, float s, float speed, float len, float amt, float t) {
  vec2 q = vec2(uv.x * s, uv.y * s * 0.16);
  float col = floor(q.x);
  float r = hash11(col * 1.37 + s);
  float y = q.y + t * speed * (0.85 + 0.3 * r) + r * 31.0;
  float cell = floor(y);
  float rc = hash12(vec2(col, cell) + s);
  float on = step(1.0 - amt, rc);
  float x = fract(q.x) - 0.5 - (hash12(vec2(cell, col) + 2.0) - 0.5) * 0.7;
  float fy = fract(y);
  float w = smoothstep(0.11, 0.0, abs(x));
  float seg = smoothstep(0.0, 0.12, fy) * (1.0 - smoothstep(len * 0.55, len, fy));
  return on * w * seg;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 ndc = frag / uRes * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 rd = normalize(uCamF + uCamR * ndc.x * uTanH * aspect + uCamU * ndc.y * uTanH);

  float day = smoothstep(-0.1, 0.08, uSun.y);
  vec3 sunC = sunColor();
  vec3 moonC = moonColor();
  // key light: the sun, handing over to the moon after dusk
  vec3 keyDir = normalize(mix(uMoon, uSun, smoothstep(-0.14, -0.02, uSun.y)));
  vec3 keyCol = sunC + moonC * (1.0 - day);
  keyCol *= 1.0 - 0.6 * smoothstep(0.4, 1.0, uStorm);
  vec3 ambTop = skyColor(vec3(0.0, 1.0, 0.0)) * 1.6 + skyColor(normalize(vec3(0.0, 0.25, 1.0))) * 0.5;
  vec3 ambBot = ambTop * mix(0.24, 0.12, uStorm) + vec3(0.001);
  ambTop += vec3(0.6, 0.7, 1.0) * uFlash * 0.6;
  ambBot += vec3(0.6, 0.7, 1.0) * uFlash * 0.4;

  float az = atan(rd.x, rd.z);
  float jitter = hash12(frag + uSeed * 117.0);   // fresh each frame; the history buffer averages it out
  vec3 col;
  float tSurf = 1e5;
  float skyVis = 0.0;

  float hA = ridgeA(az), hB = ridgeB(az), hC = ridgeC(az);
  if (rd.y < 0.0) {
    /* ---- the plain ---- */
    float t = RO.y / -rd.y;
    vec3 p = RO + rd * t;
    vec2 P = p.xz * 1000.0;              // meters
    float fade = exp(-t * 14.0);         // detail fades with distance
    float n1 = noise2(P * 0.035), n2 = noise2(P * 0.21 + 4.0), n3 = noise2(P * 1.7 + 9.0);
    vec3 dry = mix(vec3(0.33, 0.27, 0.19), vec3(0.44, 0.4, 0.26), smoothstep(0.35, 0.7, n1));
    dry *= 0.82 + 0.3 * mix(0.5, n2, fade) + 0.12 * mix(0.5, n3, fade * fade);
    vec3 alb = dry * mix(1.0, 0.42, uWet);
    // cloud shadows drifting over the plain
    vec3 cs = p + uSun * ((uBase + 0.25 - p.y) / max(uSun.y, 0.12));
    float shade = exp(-cloudMap(vec3(cs.x, uBase + 0.25, cs.z), 0.0) * 3.0);
    shade = mix(1.0, shade, day) * (1.0 - 0.55 * uStorm);
    vec3 diff = alb * (ambTop * 0.28 + keyCol * max(keyDir.y, 0.0) * 0.9 * shade) * 0.318;
    // standing water
    float pud = smoothstep(0.66 - 0.42 * uWet, 0.7 - 0.42 * uWet, n1 * 0.7 + noise2(P * 0.09 + 2.0) * 0.45) * smoothstep(0.08, 0.35, uWet);
    vec3 n = vec3(0.0, 1.0, 0.0);
    if (uRain > 0.01 && t < 0.06) {
      vec2 rp = ripples(P, uTime) * (1.0 - t / 0.06);
      n = normalize(vec3(rp.x, 1.0, rp.y));
    }
    vec3 rr = reflect(rd, n);
    rr.y = max(rr.y, 0.001);
    vec3 refl = skyColor(rr);
    vec4 cc = cheapClouds(rr, keyCol, ambTop * 0.6);
    refl = refl * cc.a + cc.rgb;
    float raz = atan(rr.x, rr.z);
    if (rr.y < ridgeC(raz)) refl = hillColor(14.0, rr, keyCol, ambTop, 0.6);
    if (rr.y < ridgeB(raz)) refl = hillColor(7.0, rr, keyCol, ambTop, 0.6);
    if (rr.y < ridgeA(raz)) refl = hillColor(3.0, rr, keyCol, ambTop, 0.6);
    float cosT = clamp(-rd.y, 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
    float wetGloss = max(pud, uWet * 0.38);
    col = mix(diff, refl, F * wetGloss);
    col = mix(col, fogColor(rd), 1.0 - exp(-t / uFog));
    tSurf = t;
  } else if (rd.y < hA) {
    col = hillColor(3.0, rd, keyCol, ambTop, 0.8);
    tSurf = 3.0;
  } else if (rd.y < hB) {
    col = hillColor(8.0, rd, keyCol, ambTop, 0.8);
    tSurf = 8.0;
  } else if (rd.y < hC) {
    col = hillColor(22.0, rd, keyCol, ambTop, 0.8);
    tSurf = 22.0;
  } else {
    /* ---- sky ---- */
    col = skyColor(rd);
    float night = 1.0 - smoothstep(-0.16, -0.03, uSun.y);
    // stars and the Milky Way
    vec2 sc = vec2(az, asin(clamp(rd.y, -1.0, 1.0))) * 160.0;
    vec2 id = floor(sc);
    float h = hash12(id);
    vec2 so = vec2(hash12(id + 1.3), hash12(id + 5.9)) - 0.5;
    float sd = length(fract(sc) - 0.5 - so * 0.7);
    float star = step(0.985, h) * smoothstep(0.16, 0.0, sd) * (0.4 + 2.4 * pow(hash12(id + 9.1), 6.0));
    star *= 0.75 + 0.25 * sin(uTime * (2.0 + h * 3.0) + h * 60.0) * (1.0 - smoothstep(0.0, 0.3, rd.y) * 0.5);
    vec3 starC = mix(vec3(1.0, 0.82, 0.68), vec3(0.75, 0.85, 1.0), hash12(id + 4.4));
    float mw = exp(-pow(dot(rd, normalize(vec3(0.55, 0.62, -0.56))) * 5.0, 2.0));
    float mwn = noise2(sc * 0.035) * 0.6 + noise2(sc * 0.09) * 0.4;
    vec3 stars = starC * star * 0.9 + vec3(0.06, 0.065, 0.085) * mw * mwn * mwn;
    // sun and moon discs
    float sdot = dot(rd, uSun);
    float sunDisc = smoothstep(0.99993, 0.99996, sdot);
    vec3 disc = sunC * sunDisc * 1.2;
    float mdot = dot(rd, uMoon);
    if (mdot > 0.9997) {
      vec3 mr = normalize(cross(vec3(0.0, 1.0, 0.0), uMoon));
      vec3 mu = cross(uMoon, mr);
      vec2 m = vec2(dot(rd, mr), dot(rd, mu)) / 0.0105;
      float r2 = dot(m, m);
      if (r2 < 1.0) {
        vec3 nrm = vec3(m, sqrt(1.0 - r2));
        float lit = smoothstep(-0.1, 0.25, dot(nrm, normalize(vec3(0.75, 0.15, 0.45))));
        float maria = 0.75 + 0.25 * noise2(m * 3.0 + 2.0);
        disc += vec3(0.95, 0.93, 0.88) * lit * maria * 0.9 * smoothstep(1.0, 0.92, r2) * (1.0 - day * 0.7);
      }
    }
    col += (stars * night + disc) * (1.0 - smoothstep(0.2, 0.6, uStorm));
    // moon halo
    col += vec3(0.5, 0.56, 0.7) * pow(max(mdot, 0.0), 900.0) * 0.12 * night * (1.0 - uStorm);

    /* ---- clouds ---- */
    float tF;
    vec4 cl = marchClouds(rd, keyDir, keyCol, ambTop, ambBot, jitter, tF);
    // distance haze over the cloud layer
    float fog = 1.0 - exp(-max(tF, 0.0) / (uFog * 2.2));
    col = col * cl.a + mix(cl.rgb, fogColor(rd) * (1.0 - cl.a), fog);
    tSurf = tF;
    skyVis = cl.a;
  }

  // glare: a tight warm halo where the sun is clear, a wide soft one through anything
  float gd = max(dot(rd, uSun), 0.0);
  col += sunC * (pow(gd, 2400.0) * 0.45 * skyVis + pow(gd, 80.0) * 0.03 * (0.35 + 0.65 * skyVis)) * (1.0 - 0.8 * uStorm);

  // rain curtains: grey the distance, then streaks in front
  if (uRain > 0.0) {
    vec2 uv = vec2(ndc.x * aspect, ndc.y);
    uv.x += uv.y * uSlant;
    float tr = uTime;
    vec3 rc = (ambTop * 0.9 + vec3(0.6, 0.7, 0.9) * uFlash) * 1.2 + 0.02;
    float r2 = rainLayer(uv + 3.7, 64.0, 2.4, 0.85, 0.2 * uRain, tr);
    float r3 = rainLayer(uv + 9.1, 24.0, 3.6, 0.9, 0.13 * uRain, tr);
    // distant rain as a soft vertical sheen rather than individual drops
    float haze = noise2(vec2(uv.x * 140.0, uv.y * 2.5 + tr * 7.0)) * noise2(vec2(uv.x * 37.0 + 5.0, uv.y * 1.2 + tr * 4.0));
    col = mix(col, rc * 0.7, uRain * 0.16 * smoothstep(0.0, 1.0, 1.0 - abs(rd.y) * 3.0));
    col += rc * (haze * 0.07 + r2 * 0.24 + r3 * 0.38) * uRain;
  }

  // exposure: open up at night, then filmic
  float expo = mix(6.0, 1.0, smoothstep(-0.18, 0.12, uSun.y));
  expo *= mix(1.0, 1.08, smoothstep(0.4, 1.0, uStorm));
  col = aces(col * expo * 0.12);
  col = pow(col, vec3(1.0 / 2.2));
  col = clamp(mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.22), 0.0, 1.0);
  col *= 1.0 - 0.22 * pow(length(ndc * vec2(0.85, 1.0)) * 0.72, 2.6);
  col += (hash12(frag * 1.7 + 0.3) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

let prog = null, copyProg = null;
const U = {};
let history = null;                    // { tex, fb, w, h }: an exponential average of recent frames
const COPY_FRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uRes;
void main() { gl_FragColor = texture2D(uTex, gl_FragCoord.xy / uRes); }
`;
function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function setupGL() {
  prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  copyProg = gl.createProgram();
  gl.attachShader(copyProg, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(copyProg, compile(gl.FRAGMENT_SHADER, COPY_FRAG));
  gl.bindAttribLocation(copyProg, 0, 'aPos');
  gl.linkProgram(copyProg);
  U.copyTex = gl.getUniformLocation(copyProg, 'uTex');
  U.copyRes = gl.getUniformLocation(copyProg, 'uRes');
  gl.useProgram(prog);
  const names = ['uRes', 'uTime', 'uSun', 'uMoon', 'uStorm', 'uRain', 'uWet', 'uFlash', 'uBolt', 'uCamF', 'uCamR', 'uCamU',
    'uTanH', 'uSteps', 'uLight', 'uDetail', 'uBase', 'uTop', 'uCover', 'uSigma', 'uWind', 'uEvo', 'uFog', 'uSlant', 'uSeed', 'uNoise'];
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);

  // noise texture: G random, R = G shifted by (37, 17) so one fetch gives two z-layers
  let seed = 0x9e3779b9;
  const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const N = 256;
  const g = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) g[i] = Math.floor(rand() * 256);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      data[i] = g[((y + 17) & 255) * N + ((x + 37) & 255)];
      data[i + 1] = g[y * N + x];
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.uniform1i(U.uNoise, 0);
}

let hasGL = false;
try {
  if (gl) { setupGL(); hasGL = true; }
} catch (err) {
  console.warn('Petrichor: WebGL unavailable, using the CSS sky.', err);
}
if (!hasGL) document.body.classList.add('no-gl');

/* ---------- camera ---------- */
const cam = { yaw: 0, pitch: 0, basePitch: 0, tanH: Math.tan((50 * Math.PI) / 360), aspect: 1, horizon: -0.38 };
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
function camBasis() {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const f = [sy * cp, sp, cy * cp];
  const r = [cy, 0, -sy];
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  return { f, r, u };
}
function layoutCamera() {
  const w = innerWidth, h = innerHeight;
  cam.aspect = w / h;
  const portrait = cam.aspect < 0.9;
  const vfov = portrait ? 66 : cam.aspect < 1.3 ? 58 : 50;
  cam.tanH = Math.tan((vfov * Math.PI) / 360);
  cam.horizon = portrait ? 0.06 : -0.38;
  cam.basePitch = Math.atan(-cam.horizon * cam.tanH);
}

/* ---------- history buffer ---------- */
function makeHistory(w, h) {
  if (history) { gl.deleteTexture(history.tex); gl.deleteFramebuffer(history.fb); }
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.activeTexture(gl.TEXTURE0);
  history = { tex, fb, w, h };
  blend = 1;                           // first frame after a resize replaces the history
}
let blend = 1;

/* ---------- resize ---------- */
function resize() {
  layoutCamera();
  const dpr = Math.min(window.devicePixelRatio || 1, TIER.dprCap);
  // never drop below ~0.55 render pixels per CSS pixel, whatever the adaptive scaler wants
  const k = Math.max(0.55, dpr * renderScale);
  if (hasGL) {
    canvas.width = Math.max(2, Math.round(innerWidth * k));
    canvas.height = Math.max(2, Math.round(innerHeight * k));
    gl.viewport(0, 0, canvas.width, canvas.height);
    makeHistory(canvas.width, canvas.height);
  }
  boltCanvas.width = Math.round(innerWidth * Math.min(window.devicePixelRatio || 1, 2));
  boltCanvas.height = Math.round(innerHeight * Math.min(window.devicePixelRatio || 1, 2));
  requestDraw();
}

/* ---------- the model ---------- */
const hourIn = $('hour'), stormIn = $('storm');
const S = {
  hour: +hourIn.value, storm: +stormIn.value / 100,
  hourNow: +hourIn.value, stormNow: +stormIn.value / 100,
  wet: 0, scent: 0, dryDays: 3, time: reduceMotion ? 41.7 : 0,
  windX: 0, windZ: 0, evo: 0,
};
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

// The station looks west-south-west: toward the weather and the sunset.
// Azimuths are relative to the view (0 = straight ahead, negative = left).
const DEG = Math.PI / 180;
function sunDir(h) {
  const k = ((h - 6) / 12) * Math.PI;
  const el = Math.asin(Math.sin(k) * Math.sin(57 * DEG));
  const az = (-70 + ((h - 12) / 6) * 78) * DEG;                 // sets a little right of centre
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}
function moonDir(h) {
  const hm = (h + 12) % 24;                                     // up from dusk to dawn
  const k = ((hm - 6) / 12) * Math.PI;
  const el = Math.asin(Math.sin(k) * Math.sin(27 * DEG));
  const az = (-12 + ((hm - 12) / 6) * 30) * DEG;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}
const rainOf = (s) => smooth(0.3, 0.78, s);

function weather(h, s) {
  const sunY = sunDir(h)[1];
  const temp = 13 + 8 * Math.sin(((h - 9) / 24) * Math.PI * 2) - 6.5 * s - 2.5 * rainOf(s);
  const spread = mix(11, 0.8, Math.pow(s, 0.8));
  const dew = temp - spread;
  const es = (t) => Math.exp((17.62 * t) / (243.12 + t));
  const hum = clamp(Math.round((100 * es(dew)) / es(temp)), 5, 100);
  const pres = Math.round(1016 - 19 * Math.pow(s, 1.3));
  const wind = Math.round(6 + 30 * Math.pow(s, 1.4));
  const wdir = (245 + 35 * s) % 360;
  const base = Math.round(mix(1850, 450, Math.pow(s, 0.9)) / 50) * 50;
  const vis = Math.round(mix(40, 3, smooth(0.3, 1, s)));
  return { sunY, temp, hum, pres, wind, wdir, base, vis };
}

function condition(w, rain) {
  const night = w.sunY < -0.06;
  const low = w.sunY < 0.2;
  if (S.scent > 0.42) return ['Petrichor', 'Rain on dry ground. Oils and geosmin lifting from the soil — the scent peaks now.'];
  if (S.stormNow > 0.72) return ['Thunder', 'A storm cell overhead. Count the seconds after each flash: three seconds is a kilometre.'];
  if (rain > 0.15) return ['Rain', night ? 'Steady rain after dark. The plain is turning to mirror.' : 'Steady rain. Puddles joining up across the plain.'];
  if (S.stormNow > 0.32) return ['Building', `Towers building to the west. Pressure ${w.pres} hPa and falling.`];
  if (S.wet > 0.22) return ['After the rain', 'The cell has moved on. Standing water is holding the sky.'];
  if (night && S.stormNow < 0.1) return ['Clear night', w.sunY < -0.25 ? 'Clear and cooling. Moonlight on the Flats.' : 'Last light gone. Stars out over the ridges.'];
  if (night) return ['Broken cloud', 'Moonlit cumulus drifting east. Stars in the gaps.'];
  if (w.sunY < 0.02) return ['Blue hour', 'The sun is below the ridge. The cloud tops still hold the light.'];
  if (low) return ['Golden hour', 'Low sun under the cloud base. Every edge lit from the side.'];
  return ['Fair', `High cumulus, ${w.wind} kt ${COMPASS[Math.round(w.wdir / 22.5) % 16]}. Dry ground for ${S.dryDays} days.`];
}

/* ---------- lightning ---------- */
const bolt = { life: 0, age: 0, paths: [], world: [0, 0.5, 6], next: 3.5, dist: 0, countdown: 0, flash: 0 };
function project(p) {
  const { f, r, u } = camBasis();
  const v = [p[0], p[1] - 0.002, p[2]];
  const z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
  const x = (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (z * cam.tanH * cam.aspect);
  const y = (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (z * cam.tanH);
  return [(x * 0.5 + 0.5) * boltCanvas.width, (0.5 - y * 0.5) * boltCanvas.height];
}
function jag(a, b, depth, spread, out) {
  if (depth === 0) { out.push(b); return; }
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
  const off = (Math.random() - 0.5) * len * spread;
  const m = [mx + nx * off, my + ny * off];
  jag(a, m, depth - 1, spread, out);
  jag(m, b, depth - 1, spread, out);
}
function strike(screenX) {
  const w = weather(S.hourNow, S.stormNow);
  const { f, r, u } = camBasis();
  const nx = screenX != null ? screenX : 0.12 + Math.random() * 0.76;
  const ndcX = nx * 2 - 1;
  const d = [f[0] + r[0] * ndcX * cam.tanH * cam.aspect, 0, f[2] + r[2] * ndcX * cam.tanH * cam.aspect];
  const dl = Math.hypot(d[0], d[2]);
  const D = 1.4 + Math.random() * 4.8;
  const gx = (d[0] / dl) * D, gz = (d[2] / dl) * D;
  const base = w.base / 1000;
  bolt.world = [gx, base * 1.1, gz];
  // the channel starts inside the cloud: drawn dim above the base, full below it
  const top = project([gx + (Math.random() - 0.5) * 0.6, base + 0.9 + Math.random() * 0.8, gz]);
  bolt.baseY = project([gx, base, gz])[1];
  const bottom = project([gx, 0, gz]);
  const main = [top];
  jag(top, bottom, 7, 0.32, main);
  bolt.paths = [{ pts: main, w: 1 }];
  const branches = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < branches; i++) {
    const k = 8 + Math.floor(Math.random() * (main.length * 0.6));
    const a = main[Math.min(k, main.length - 1)];
    const ang = Math.atan2(bottom[1] - top[1], bottom[0] - top[0]) + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.6);
    const L = Math.hypot(bottom[0] - top[0], bottom[1] - top[1]) * (0.12 + Math.random() * 0.22);
    const b = [a[0] + Math.cos(ang) * L, a[1] + Math.sin(ang) * L];
    const pts = [a];
    jag(a, b, 5, 0.36, pts);
    bolt.paths.push({ pts, w: 0.45 });
  }
  bolt.age = 0;
  bolt.life = 0.55;
  bolt.dist = D;
  bolt.countdown = D / 0.343;
  bolt.strikes = (bolt.strikes || 0) + 1;
}
function boltEnvelope(a) {
  // two pulses: the return stroke and one restrike (stays under three flashes a second)
  return Math.exp(-a * 16) + (a > 0.13 ? 0.7 * Math.exp(-(a - 0.13) * 13) : 0);
}
function drawBolt() {
  bctx.clearRect(0, 0, boltCanvas.width, boltCanvas.height);
  if (bolt.life <= 0) return;
  const e = boltEnvelope(bolt.age);
  if (e < 0.02) return;
  const s = boltCanvas.width / innerWidth;
  bctx.lineCap = 'round';
  bctx.lineJoin = 'round';
  const W = boltCanvas.width, H = boltCanvas.height;
  for (const zone of ['cloud', 'air']) {
    bctx.save();
    bctx.beginPath();
    if (zone === 'cloud') bctx.rect(0, 0, W, bolt.baseY);
    else bctx.rect(0, bolt.baseY, W, H - bolt.baseY);
    bctx.clip();
    const k = zone === 'cloud' ? 0.3 : 1;
    for (const pass of [{ lw: 14, a: 0.14, blur: 30 }, { lw: 4.2, a: 0.5, blur: 12 }, { lw: 1.9, a: 1, blur: 0 }]) {
      bctx.shadowBlur = pass.blur * s;
      bctx.shadowColor = 'rgba(170, 190, 255, 0.9)';
      for (const p of bolt.paths) {
        bctx.strokeStyle = `rgba(${pass.a === 1 ? '250, 252, 255' : '185, 200, 255'}, ${Math.min(1, pass.a * e * k * (p.w < 1 ? 0.75 : 1))})`;
        bctx.lineWidth = pass.lw * s * (p.w < 1 ? 0.55 : 1);
        bctx.beginPath();
        bctx.moveTo(p.pts[0][0], p.pts[0][1]);
        for (let i = 1; i < p.pts.length; i++) bctx.lineTo(p.pts[i][0], p.pts[i][1]);
        bctx.stroke();
      }
    }
    bctx.restore();
  }
  bctx.shadowBlur = 0;
}

/* ---------- UI ---------- */
const ui = {
  time: $('now-time'), phase: $('now-phase'), cond: $('cond'), story: $('story'),
  temp: $('rd-temp'), hum: $('rd-hum'), wind: $('rd-wind'), wdir: $('rd-wdir'), arrow: $('wind-arrow'),
  pres: $('rd-pres'), ceil: $('rd-ceil'), vis: $('rd-vis'),
  hourOut: $('hour-out'), stormOut: $('storm-out'), scentVal: $('scent-val'), scentFill: $('scent-fill'),
  strike: $('strike'), strikeText: $('strike-text'), play: $('play'),
};
// the condition word is set big; shrink it until its longest word fits the column
function fitCond() {
  const el = ui.cond;
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth + 1 && size > 26) {
    size -= 2;
    el.style.fontSize = `${size}px`;
  }
}
const fmtHour = (h) => {
  const m = Math.round(h * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const phaseOf = (h) => (h < 5 ? 'small hours' : h < 8 ? 'dawn' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 20.5 ? 'evening' : 'night');
let lastCond = '';
function updateUI() {
  const w = weather(S.hour, S.storm);
  const rain = rainOf(S.stormNow);
  ui.time.textContent = fmtHour(S.hour);
  ui.phase.textContent = phaseOf(S.hour);
  ui.hourOut.textContent = fmtHour(S.hour);
  hourIn.setAttribute('aria-valuetext', `${fmtHour(S.hour)}, ${phaseOf(S.hour)}`);
  const sl = S.storm > 0.8 ? 'severe' : S.storm > 0.58 ? 'thunder' : S.storm > 0.3 ? 'showers' : S.storm > 0.18 ? 'unsettled' : 'calm';
  ui.stormOut.textContent = sl;
  stormIn.setAttribute('aria-valuetext', `${Math.round(S.storm * 100)} percent, ${sl}`);
  ui.temp.textContent = Math.round(w.temp);
  ui.hum.textContent = w.hum;
  ui.wind.textContent = w.wind;
  ui.wdir.textContent = COMPASS[Math.round(w.wdir / 22.5) % 16];
  ui.arrow.style.setProperty('--wind-rot', `${(w.wdir + 180 - 45) % 360}deg`);
  ui.pres.textContent = w.pres;
  ui.ceil.textContent = w.base.toLocaleString('en-US');
  ui.vis.textContent = w.vis;
  const scent = Math.round(S.scent * 100);
  ui.scentVal.textContent = scent;
  ui.scentFill.parentElement.style.setProperty('--scent', `${scent}%`);
  const [c, story] = condition(w, rain);
  if (c !== lastCond) {
    ui.cond.textContent = c;
    lastCond = c;
    fitCond();
  }
  ui.story.textContent = story;
  if (bolt.countdown > 0) {
    ui.strike.classList.add('live');
    ui.strikeText.textContent = `${bolt.dist.toFixed(1)} km · thunder in ${Math.ceil(bolt.countdown)} s`;
  } else if (bolt.strikes) {
    ui.strike.classList.toggle('live', S.stormNow > 0.6);
    ui.strikeText.textContent = `Last strike ${bolt.dist.toFixed(1)} km`;
  } else {
    ui.strike.classList.remove('live');
    ui.strikeText.textContent = S.stormNow > 0.6 ? 'Lightning likely' : 'No lightning';
  }
  if (!hasGL) {
    const sky = cssSky(S.hour, S.storm);
    document.body.style.setProperty('--sky-top', sky[0]);
    document.body.style.setProperty('--sky-bot', sky[1]);
  }
}

/* a cheap sky colour per hour, for the hour track and the no-WebGL fallback */
function cssSky(h, s = 0.1) {
  const y = sunDir(h)[1];
  const day = smooth(-0.08, 0.3, y), gold = smooth(-0.14, 0.02, y) * (1 - smooth(0.05, 0.3, y));
  const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  let top = lerp3([10, 16, 32], [62, 112, 170], day);
  let bot = lerp3([22, 30, 48], [176, 200, 214], day);
  top = lerp3(top, [58, 64, 110], gold * 0.7);
  bot = lerp3(bot, [232, 140, 78], gold);
  const g = (c) => { const m = (c[0] + c[1] + c[2]) / 3; return lerp3(c, [m * 0.7, m * 0.72, m * 0.78], s * 0.8); };
  const hex = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
  return [hex(g(top)), hex(g(bot))];
}
function paintHourTrack() {
  const stops = [];
  for (let h = 0; h <= 24; h += 1) stops.push(`${cssSky(h, 0)[1]} ${((h / 24) * 100).toFixed(2)}%`);
  hourIn.style.setProperty('--track', `linear-gradient(90deg, ${stops.join(',')})`);
}

/* ---------- input ---------- */
let playing = false;
let playStep = 0;
function stopPlay() {
  if (!playing) return;
  playing = false;
  ui.play.setAttribute('aria-pressed', 'false');
  ui.play.querySelector('i').className = 'fa-solid fa-play';
  ui.play.querySelector('span').textContent = 'Play the forecast';
}
hourIn.addEventListener('input', () => { stopPlay(); S.hour = +hourIn.value; onChange(); });
stormIn.addEventListener('input', () => { stopPlay(); S.storm = +stormIn.value / 100; onChange(); });
ui.play.addEventListener('click', () => {
  playing = !playing;
  ui.play.setAttribute('aria-pressed', String(playing));
  ui.play.querySelector('i').className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
  ui.play.querySelector('span').textContent = playing ? 'Pause the forecast' : 'Play the forecast';
  playStep = 0;
  requestDraw();
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  pointer.x = (e.clientX / innerWidth - 0.5) * 2;
  pointer.y = (e.clientY / innerHeight - 0.5) * 2;
});
// a click on the storm calls a strike there
canvas.addEventListener('click', (e) => {
  if (reduceMotion || S.stormNow < 0.6 || bolt.age < 0.9 && bolt.life > 0) return;
  strike(e.clientX / innerWidth);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) last = performance.now(); });

// the scripted day used by "Play the forecast"
function forecastStorm(h) {
  if (h < 11) return 0.08;
  if (h < 14) return mix(0.08, 0.36, smooth(11, 14, h));
  if (h < 16) return mix(0.36, 0.9, smooth(14, 16, h));
  if (h < 18) return mix(0.9, 0.3, smooth(16, 18, h));
  if (h < 20.5) return mix(0.3, 0.06, smooth(18, 20.5, h));
  return 0.06;
}

function onChange() {
  if (reduceMotion) {
    // composed stills: jump straight to the new state
    const rain = rainOf(S.storm);
    const prevRain = rainOf(S.stormNow);
    if (rain > 0.02) {
      S.scent = prevRain < 0.02 && S.wet < 0.15 ? smooth(0, 0.25, rain) * 0.9 : Math.max(0, S.scent * 0.4);
      S.wet = clamp(0.35 + rain * 0.65, 0, 1);
    } else {
      S.scent = 0;
      S.wet = Math.max(0, S.wet - Math.abs(S.hour - S.hourNow) * 0.2);
    }
    S.hourNow = S.hour;
    S.stormNow = S.storm;
  }
  updateUI();
  requestDraw();
}

/* ---------- render ---------- */
let drawQueued = false;
function requestDraw() {
  if (!reduceMotion) return;          // the loop is already running
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; render(6); });
}

function render(passes = 1) {
  if (!hasGL) return;
  const w = weather(S.hourNow, S.stormNow);
  const s = S.stormNow;
  pointer.sx += (pointer.x - pointer.sx) * 0.04;
  pointer.sy += (pointer.y - pointer.sy) * 0.04;
  cam.yaw = pointer.sx * 0.045;
  cam.pitch = cam.basePitch - pointer.sy * 0.014;
  const { f, r, u } = camBasis();
  gl.uniform2f(U.uRes, canvas.width, canvas.height);
  gl.uniform1f(U.uTime, S.time);
  gl.uniform3fv(U.uSun, sunDir(S.hourNow));
  gl.uniform3fv(U.uMoon, moonDir(S.hourNow));
  gl.uniform1f(U.uStorm, s);
  gl.uniform1f(U.uRain, rainOf(s));
  gl.uniform1f(U.uWet, S.wet);
  gl.uniform1f(U.uFlash, bolt.flash);
  gl.uniform3fv(U.uBolt, bolt.world);
  gl.uniform3fv(U.uCamF, f);
  gl.uniform3fv(U.uCamR, r);
  gl.uniform3fv(U.uCamU, u);
  gl.uniform1f(U.uTanH, cam.tanH);
  gl.uniform1f(U.uSteps, TIER.steps);
  gl.uniform1f(U.uLight, TIER.light);
  gl.uniform1f(U.uDetail, TIER.detail);
  const base = w.base / 1000;
  gl.uniform1f(U.uBase, base);
  gl.uniform1f(U.uTop, base + mix(1.3, 6.5, Math.pow(s, 1.15)));
  gl.uniform1f(U.uCover, mix(0.6, 0.31, Math.pow(s, 0.8)));
  gl.uniform1f(U.uSigma, mix(9, 30, s));
  gl.uniform2f(U.uWind, S.windX, S.windZ);
  gl.uniform1f(U.uEvo, S.evo);
  gl.uniform1f(U.uFog, mix(38, 4.5, smooth(0.25, 1, s)));
  gl.uniform1f(U.uSlant, 0.08 + 0.22 * s);

  // draw into the history with a constant blend: history = a·new + (1 − a)·history
  gl.bindFramebuffer(gl.FRAMEBUFFER, history.fb);
  gl.viewport(0, 0, history.w, history.h);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
  for (let i = 0; i < passes; i++) {
    const a = passes > 1 ? 1 / (i + 1) : blend;
    gl.blendColor(0, 0, 0, a);
    gl.uniform1f(U.uSeed, Math.random());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.disable(gl.BLEND);
  blend = 0.34;
  // then copy to the screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(copyProg);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, history.tex);
  gl.uniform1i(U.copyTex, 1);
  gl.uniform2f(U.copyRes, canvas.width, canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.activeTexture(gl.TEXTURE0);
  gl.useProgram(prog);
}

let last = performance.now();
let slow = 0, fast = 0, uiTick = 0, flashWas = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  S.time += dt;

  if (playing) {
    S.hour = (S.hour + dt * 0.75) % 24;
    S.storm = forecastStorm(S.hour);
    hourIn.value = S.hour.toFixed(2);
    stormIn.value = Math.round(S.storm * 100);
  }
  // ease toward the controls (a shortest path around midnight)
  let dh = S.hour - S.hourNow;
  if (dh > 12) dh -= 24;
  if (dh < -12) dh += 24;
  S.hourNow = (S.hourNow + dh * Math.min(1, dt * 4) + 24) % 24;
  S.stormNow += (S.storm - S.stormNow) * Math.min(1, dt * 2.2);

  // ground and scent
  const rain = rainOf(S.stormNow);
  const sunY = sunDir(S.hourNow)[1];
  if (rain > 0.02) {
    const fresh = smooth(0.0, 0.25, rain) * Math.pow(1 - S.wet, 1.6);
    S.scent += (fresh - S.scent) * Math.min(1, dt * 3);
    S.wet = Math.min(1, S.wet + rain * dt * 0.085);
  } else {
    S.scent = Math.max(0, S.scent - dt * 0.25);
    S.wet = Math.max(0, S.wet - dt * (0.014 + 0.03 * Math.max(sunY, 0)));
  }

  // wind carries the deck
  const wd = ((245 + 35 * S.stormNow + 180) * Math.PI) / 180;
  const speed = 0.05 + 0.32 * S.stormNow;
  S.windX -= Math.sin(wd) * speed * dt;
  S.windZ -= Math.cos(wd) * speed * dt;
  S.evo += dt * (0.012 + 0.03 * S.stormNow);

  // lightning: the storm has to earn it
  if (S.stormNow > 0.6) {
    bolt.next -= dt * (0.6 + S.stormNow);
    if (bolt.next <= 0) {
      strike();
      bolt.next = 2.4 + Math.random() * 5.5;
    }
  }
  if (bolt.life > 0) {
    bolt.age += dt;
    if (bolt.age > bolt.life) bolt.life = 0;
  }
  bolt.flash = bolt.life > 0 ? Math.min(1, boltEnvelope(bolt.age)) : 0;
  if (bolt.countdown > 0) bolt.countdown = Math.max(0, bolt.countdown - dt);
  drawBolt();

  // adaptive resolution
  if (dt > 1 / 28) { slow++; fast = 0; } else if (dt < 1 / 55) { fast++; slow = 0; }
  if (slow > 40 && renderScale > 0.3) { renderScale = Math.max(0.3, renderScale * 0.85); slow = 0; resize(); }
  if (fast > 180 && renderScale < TIER.scale) { renderScale = Math.min(TIER.scale, renderScale * 1.08); fast = 0; resize(); }

  // the history smooths the grain; big changes and flashes cut through it
  const moving = Math.abs(S.hour - S.hourNow) > 0.03 || Math.abs(S.storm - S.stormNow) > 0.01;
  blend = Math.max(blend, bolt.flash > 0.02 || flashWas > 0.02 ? 0.8 : moving ? 0.7 : 0.34);
  flashWas = bolt.flash;
  render();
  uiTick += dt;
  if (uiTick > 0.12) { uiTick = 0; updateUI(); }
  requestAnimationFrame(frame);
}

/* reduced motion: still frames only; the forecast steps an hour at a time */
function reducedTick() {
  if (playing) {
    playStep++;
    S.hour = (Math.floor(S.hour) + 1) % 24;
    S.storm = forecastStorm(S.hour);
    hourIn.value = S.hour;
    stormIn.value = Math.round(S.storm * 100);
    onChange();
  }
  setTimeout(reducedTick, 1400);
}

paintHourTrack();
document.fonts?.ready.then(fitCond);
window.addEventListener('resize', () => { resize(); fitCond(); });
resize();
updateUI();
if (reduceMotion) {
  render(6);
  setTimeout(reducedTick, 1400);
} else {
  requestAnimationFrame(frame);
}
