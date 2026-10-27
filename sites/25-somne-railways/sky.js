/* ============================================================
   SOMNE — the view beyond the near scenery, in one shader.
   For every pixel the view ray is traced against: the sky
   (night → dawn, stars, moon, cloud deck), four vertical
   ridge planes at increasing depth (true parallax, aerial
   perspective, moonlit crests), and the ground plane (fields
   and farm lights, the city, a lake or the sea that reflects
   all of the above). World units are metres; the train runs
   along +x and the window looks toward −z.
   ============================================================ */

export const SKY_VERT = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

export const SKY_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vNdc;
  uniform mat4 uProjInv;
  uniform mat4 uCamWorld;
  uniform vec3 uCam;
  uniform float uPix;          // angular size of one pixel, radians
  uniform float uTime;
  uniform float uDawn;         // 0 night … 1 first light
  uniform float uRain;         // overcast and rain at Veldt
  uniform float uCityGlow;     // orange sky glow near the city
  uniform float uCityEnd;      // world x where the city's lights give out
  uniform float uLake;         // Mirensee: water to the far shore
  uniform float uCoast;        // Iskar: the sea to the horizon
  uniform float uBlur;         // motion blur length at the track, metres
  uniform float uQ;            // 1 desktop, 0 phone
  uniform vec3 uMoonDir;
  uniform vec3 uSunDir;

  float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  vec2 h22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
  float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
  float n2(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm1(float x) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * n1(x); x = x * 2.07 + 1.3; a *= 0.5; } return s; }
  float fbm2(vec2 x) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n2(x); x = x * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }

  /* ---------- sky ---------- */
  vec3 skyCol(vec3 d) {
    float y = max(d.y, 0.0);
    vec3 c = mix(vec3(0.016, 0.021, 0.042), vec3(0.0032, 0.0048, 0.013), pow(y, 0.42));
    float md = max(dot(d, uMoonDir), 0.0);
    c += vec3(0.02, 0.026, 0.045) * pow(md, 4.0) + vec3(0.05, 0.058, 0.08) * pow(md, 40.0);
    c += vec3(0.11, 0.05, 0.016) * uCityGlow * exp(-y * 8.0);
    // first light, toward the sun below the eastern (+x) horizon
    vec2 hd = normalize(d.xz + 1e-5), hs = normalize(uSunDir.xz);
    float sd = max(dot(hd, hs), 0.0);
    vec3 dHor = mix(vec3(0.42, 0.17, 0.13), vec3(1.25, 0.56, 0.24), pow(sd, 3.0));
    vec3 dZen = vec3(0.045, 0.075, 0.19);
    vec3 dawn = mix(dHor, dZen, pow(y, 0.36));
    dawn += vec3(0.2, 0.07, 0.11) * exp(-y * 6.0) * (1.0 - sd);
    c = mix(c, dawn, uDawn);
    // rain: a low, lit overcast
    vec3 over = vec3(0.016, 0.015, 0.018) + vec3(0.05, 0.024, 0.009) * uCityGlow * exp(-y * 2.5);
    return mix(c, over, uRain * 0.9);
  }

  vec3 stars(vec3 d) {
    if (d.y < -0.01) return vec3(0.0);
    vec3 p = d * 260.0;
    vec3 i = floor(p), f = fract(p);
    float h = h31(i);
    if (h < 0.955) return vec3(0.0);
    vec3 o = vec3(h31(i + 7.1), h31(i + 3.3), h31(i + 1.9)) * 0.6 + 0.2;
    float r = length(f - o) / (260.0 * uPix);
    float mag = pow((h - 0.955) / 0.045, 3.0);
    float tw = 0.7 + 0.3 * sin(uTime * (1.5 + h * 6.0) + h * 91.0);
    vec3 col = mix(vec3(1.0, 0.82, 0.66), vec3(0.72, 0.83, 1.0), h31(i + 5.0));
    // the Milky Way: a faint band of fine dust across the sky
    float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.55, 0.76))) * 3.2, 2.0));
    float dust = band * fbm2(vec2(atan(d.x, -d.z) * 6.0, d.y * 9.0));
    return col * exp(-r * r * 1.6) * (mag * 1.3 + 0.03) * tw * (1.0 + dust * 2.0);
  }

  vec3 milky(vec3 d) {
    float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.55, 0.76))) * 3.2, 2.0));
    float dust = fbm2(vec2(atan(d.x, -d.z) * 5.0, d.y * 7.0));
    return vec3(0.012, 0.013, 0.018) * band * smoothstep(0.35, 0.8, dust) * smoothstep(0.0, 0.25, d.y);
  }

  vec3 moon(vec3 d) {
    float ang = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
    const float R = 0.019;
    vec3 col = vec3(0.6, 0.68, 0.88) * (exp(-ang * 30.0) * 0.05 + exp(-ang * 6.0) * 0.012);
    if (ang < R + uPix * 2.0) {
      vec3 rt = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
      vec3 up = cross(rt, uMoonDir);
      vec2 q = vec2(dot(d, rt), dot(d, up)) / R;
      float z = sqrt(max(1.0 - dot(q, q), 0.0));
      vec3 n = vec3(q, z);
      float lit = smoothstep(-0.08, 0.2, dot(n, normalize(vec3(-0.8, 0.3, 0.5))));
      float maria = 0.62 + 0.38 * smoothstep(0.35, 0.7, n2(q * 2.6 + 4.0) * 0.65 + n2(q * 6.0) * 0.35);
      float disc = smoothstep(R + uPix * 1.2, R - uPix * 1.2, ang);
      col += vec3(1.0, 0.96, 0.88) * maria * (0.03 + lit * 1.25) * disc;
    }
    return col;
  }

  vec4 clouds(vec3 d) {
    if (d.y <= 0.004) return vec4(0.0);
    float H = mix(1400.0, 650.0, uRain);
    float t = (H - uCam.y) / d.y;
    vec2 p = (uCam.xz + d.xz * t) * mix(0.00032, 0.0006, uRain) + vec2(uTime * 0.006, uTime * 0.002);
    float n = fbm2(p);
    float cov = mix(0.38, 0.95, uRain);
    float dens = smoothstep(1.0 - cov, 1.25 - cov, n) * smoothstep(0.004, 0.12, d.y);
    float md = max(dot(d, uMoonDir), 0.0);
    vec3 lit = vec3(0.007, 0.008, 0.013) + vec3(0.06, 0.066, 0.085) * pow(md, 5.0) * (1.0 - dens * 0.6);
    lit += vec3(0.11, 0.05, 0.016) * uCityGlow * (0.5 + 0.5 * uRain);
    vec2 hd = normalize(d.xz + 1e-5), hs = normalize(uSunDir.xz);
    vec3 dawnLit = mix(vec3(0.16, 0.09, 0.14), vec3(1.1, 0.48, 0.3), pow(max(dot(hd, hs), 0.0), 2.0)) * (0.55 + 0.45 * (1.0 - n));
    lit = mix(lit, dawnLit, uDawn);
    return vec4(lit, dens * mix(0.85, 1.0, uRain));
  }

  vec3 skyFull(vec3 d, bool cheap) {
    vec3 c = skyCol(d);
    float clear = 1.0 - uRain * 0.95;
    c += (stars(d) + milky(d)) * clear * (1.0 - uDawn * 0.92) * (1.0 - uCityGlow * 0.6);
    c += moon(d) * clear * (1.0 - uDawn * 0.55);
    if (!cheap) { vec4 cl = clouds(d); c = mix(c, cl.rgb, cl.a); }
    return c;
  }

  /* ---------- ridges: four vertical planes at increasing depth ---------- */
  float ridgeH(int i, float x) {
    if (i == 0) return -6.0 + 62.0 * (fbm1(x / 230.0 + 3.1) - 0.3) + 4.0 * n1(x / 9.0);   // a near treeline
    if (i == 1) return 10.0 + 170.0 * (fbm1(x / 560.0 + 11.7) - 0.32);
    if (i == 2) return 40.0 + 420.0 * (fbm1(x / 1250.0 + 27.3) - 0.3);
    return 120.0 + 1100.0 * (fbm1(x / 2900.0 + 51.9) - 0.28);
  }
  float ridgeD(int i) { return i == 0 ? 650.0 : i == 1 ? 1500.0 : i == 2 ? 3300.0 : 7200.0; }
  bool ridgeOn(int i) {
    if (uCoast > 0.5) return false;
    if (uLake > 0.5 && i == 0) return false;
    return true;
  }
  vec3 ridgeCol(int i, vec3 d, float top, float y, float t) {
    float D = ridgeD(i);
    vec3 base = vec3(0.0035, 0.0045, 0.008) + vec3(0.012, 0.009, 0.01) * uDawn;
    float rim = exp(-(top - y) / (6.0 + D * 0.006)) * (0.35 + 0.65 * max(dot(normalize(vec3(uMoonDir.x, 0.0, uMoonDir.z)), vec3(0.0, 0.0, 1.0)) * 0.5 + 0.5, 0.0));
    base += vec3(0.01, 0.012, 0.018) * rim * (1.0 - uDawn) * (1.0 - uRain);
    base += vec3(0.08, 0.04, 0.03) * rim * uDawn;
    float haze = 1.0 - exp(-t / mix(9000.0, 2500.0, uRain));
    return mix(base, skyCol(vec3(d.x, 0.02, d.z)), haze);
  }
  // nearest ridge hit along a ray from o; returns distance (or 1e9) and the colour
  float ridges(vec3 o, vec3 d, float tMax, out vec3 col) {
    col = vec3(0.0);
    if (d.z >= -1e-4) return 1e9;
    for (int i = 0; i < 4; i++) {
      if (!ridgeOn(i)) continue;
      float t = (-ridgeD(i) - o.z) / d.z;
      if (t <= 0.0 || t > tMax) continue;
      vec3 p = o + d * t;
      float top = ridgeH(i, p.x);
      if (p.y < top) { col = ridgeCol(i, d, top, p.y, t); return t; }
    }
    return 1e9;
  }

  /* ---------- the ground ---------- */
  float fields(vec2 q) {
    vec2 c = floor(q / vec2(140.0, 90.0));
    float tone = h21(c);
    vec2 f = fract(q / vec2(140.0, 90.0));
    float hedge = smoothstep(0.03, 0.0, min(min(f.x, 1.0 - f.x) * 1.4, min(f.y, 1.0 - f.y)));
    float grain = n2(q * 0.08) * 0.5 + n2(q * 0.6) * 0.3;
    return (0.55 + 0.45 * tone) * (0.75 + 0.25 * grain) * (1.0 - hedge * 0.7);
  }
  vec3 lightsAt(vec2 q, float t, float city) {
    vec3 L = vec3(0.0);
    float r = max(t * uPix * 1.6, 0.18);
    // farms: one lamp or window in some fields
    vec2 id = floor(q / 120.0);
    float h = h21(id + 3.7);
    if (h > 0.72 && q.y < -40.0) {
      vec2 at = (id + 0.15 + 0.7 * h22(id)) * 120.0;
      float k = length(q - at) / r;
      L += vec3(1.0, 0.62, 0.28) * exp(-k * k) * (0.6 + 0.8 * h22(id + 9.0).x) * 3.5;
    }
    // the city: streets of sodium and a few white windows
    if (city > 0.0) {
      vec2 cid = floor(q / 28.0);
      float hc = h21(cid + 1.3);
      if (hc > 0.42 && q.y < -18.0) {
        vec2 at = (cid + 0.2 + 0.6 * h22(cid + 2.0)) * 28.0;
        float k = length(q - at) / r;
        vec3 tint = hc > 0.85 ? vec3(0.8, 0.85, 1.0) : vec3(1.0, 0.5, 0.17);
        L += tint * exp(-k * k) * 3.0 * city;
      }
    }
    return L;
  }
  vec3 waterCol(vec3 p, vec3 d, float t) {
    vec2 q = p.xz;
    vec2 w = vec2(n2(q * 0.12 + vec2(uTime * 0.21, 0.0)), n2(q * 0.12 + vec2(5.2, uTime * 0.17))) - 0.5;
    w += (vec2(n2(q * 0.5 + vec2(uTime * 0.5, 1.0)), n2(q * 0.5 + vec2(3.0, -uTime * 0.45))) - 0.5) * 0.6;
    // waves tilt mostly toward and away from you, which stretches reflections into vertical streaks
    float calm = smoothstep(120.0, 2600.0, t);
    vec3 n = normalize(vec3(w.x * 0.07 * (1.0 - calm), 1.0, w.y * 0.34 * (1.0 - calm)));
    vec3 r = reflect(d, n);
    r.y = max(r.y, 0.002);
    vec3 rc;
    float th = ridges(p + vec3(0.0, 0.01, 0.0), r, 1e8, rc);
    vec3 c = th < 1e8 ? rc : skyFull(r, true);
    // the moon (or the dawn) laid on the water as a broken path
    float md = dot(r, uMoonDir);
    c += vec3(1.0, 0.95, 0.85) * smoothstep(0.9986, 0.99985, md) * 2.6 * (1.0 - uDawn * 0.6) * (1.0 - uRain);
    float fres = 0.025 + 0.975 * pow(1.0 - max(dot(-d, n), 0.0), 5.0);
    vec3 body = vec3(0.0015, 0.003, 0.006) + vec3(0.02, 0.015, 0.02) * uDawn;
    return mix(body, c, clamp(fres, 0.0, 1.0));
  }

  void main() {
    vec4 v = uProjInv * vec4(vNdc, 1.0, 1.0);
    vec3 d = normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
    vec3 o = uCam;
    vec3 col;
    float tg = d.y < 0.0 ? o.y / -d.y : 1e9;
    vec3 rc;
    float tr = ridges(o, d, tg, rc);
    if (tr < 1e9) {
      col = rc;
    } else if (tg < 1e9) {
      vec3 p = o + d * tg;
      float z = -p.z;
      float water = max(uLake * step(12.5, z), uCoast * step(17.0, z));
      if (water > 0.5) {
        col = waterCol(p, d, tg);
      } else {
        // fields under the moon, smeared along the track near the train
        float blur = uBlur * smoothstep(90.0, 6.0, z);
        float f = 0.0;
        for (int k = 0; k < 5; k++) f += fields(p.xz + vec2(blur * float(k) * 0.25, 0.0));
        f *= 0.2;
        vec3 alb = mix(vec3(0.018, 0.021, 0.017), vec3(0.03, 0.026, 0.02), uDawn);
        if (uCoast > 0.5) alb = mix(alb, vec3(0.06, 0.05, 0.04), smoothstep(8.0, 15.0, z));    // the beach
        if (uLake > 0.5) alb *= 1.0 - 0.6 * smoothstep(7.0, 12.0, z);                           // reeds at the shore
        vec3 light = vec3(0.35, 0.4, 0.55) * (1.0 - uRain * 0.7) * (1.0 - uDawn) + vec3(1.2, 0.8, 0.7) * uDawn;
        col = alb * f * light;
        float city = 1.0 - smoothstep(uCityEnd - 300.0, uCityEnd, p.x);
        col += lightsAt(p.xz, tg, city) * (1.0 - uDawn * 0.7);
        col += vec3(0.05, 0.025, 0.008) * uCityGlow * city * 0.3;
        float haze = 1.0 - exp(-tg / mix(6000.0, 1400.0, uRain));
        col = mix(col, skyCol(vec3(d.x, 0.015, d.z)), haze);
      }
    } else {
      col = skyFull(d, uQ < 0.5 && false);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;
