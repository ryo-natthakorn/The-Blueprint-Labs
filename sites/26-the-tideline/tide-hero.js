/* ============================================================
   THE TIDELINE — home hero: the shoreline at Harrow's Point
   Overhead swash zone at dusk, raw WebGL, one fragment shader.
   Three wave sets run up the beach and draw back; the bore,
   the foam lace it leaves, the swash mark and the wet sand that
   dries behind it are all derived from each wave's phase, so
   nothing is simulated or stored. The tide gauge sets the mean
   waterline: scrub through tonight's service and the water moves.
   Pauses offscreen; one composed frame under reduced motion;
   lighter shader and resolution on phones and low-end devices.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("tide-canvas");
  var TL = window.Tideline;
  if (!canvas || !TL) return;

  var REDUCED = TL.reduced();
  var SMALL = window.matchMedia("(max-width: 720px)").matches;
  var LOW = SMALL || (navigator.hardwareConcurrency || 8) <= 4;

  /* ---------------- tide gauge (works without WebGL too) ---------------- */
  var range = document.getElementById("gauge-range");
  var outAt = document.getElementById("gauge-at");
  var outH = document.getElementById("gauge-h");
  var outDir = document.getElementById("gauge-dir");
  var curve = document.getElementById("gauge-curve");
  var gaugeTitle = document.getElementById("gauge-title");

  /* the next evening service still to come: today unless it's Monday or after 10 PM */
  function serviceEvening() {
    var d = new Date();
    if (d.getDay() === 1 || d.getHours() >= 22) {
      do { d.setDate(d.getDate() + 1); } while (d.getDay() === 1);
      d.setHours(17, 0, 0, 0);
      return { start: d.getTime(), tonight: false };
    }
    d.setHours(17, 0, 0, 0);
    return { start: d.getTime(), tonight: true };
  }
  var evening = serviceEvening();
  var scrubbed = false;
  var levelGoal = TL.tideState().level;

  function atMinutes(v) { return evening.start + v * 60000; }
  function minutesNow() { return (Date.now() - evening.start) / 60000; }

  function drawCurve() {
    if (!curve) return;
    var lo = 0.2, hi = 4.0, pts = [];
    for (var m = 0; m <= 300; m += 10) {
      var h = TL.tideHeight(atMinutes(m));
      pts.push([m, 64 - (h - lo) / (hi - lo) * 60]);
    }
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + p[0] + " " + p[1].toFixed(1); }).join(" ");
    var v = +range.value;
    var hv = TL.tideHeight(atMinutes(v));
    var y = 64 - (hv - lo) / (hi - lo) * 60;
    var nowM = minutesNow();
    var svg = '<path class="area" d="' + line + ' L300 64 L0 64 Z"/>' +
      '<path class="ln" d="' + line + '"/>';
    if (evening.tonight && nowM > 0 && nowM < 300) {
      svg += '<line class="ln" x1="' + nowM + '" x2="' + nowM + '" y1="0" y2="64" stroke-dasharray="2 3" opacity=".6"/>';
    }
    if (scrubbed) svg += '<line class="mark" x1="' + v + '" x2="' + v + '" y1="0" y2="64"/><circle class="dot" cx="' + v + '" cy="' + y.toFixed(1) + '" r="3.5"/>';
    curve.innerHTML = svg;
  }

  function paintGauge() {
    var t = scrubbed ? atMinutes(+range.value) : Date.now();
    var s = TL.tideState(t);
    levelGoal = s.level;
    if (outH) outH.textContent = s.height.toFixed(1) + " m";
    if (outDir) outDir.textContent = s.rising ? "and rising" : "and falling";
    if (outAt) outAt.textContent = scrubbed ? TL.fmtTime(new Date(t)) : "now";
    if (range) range.setAttribute("aria-valuetext", (scrubbed ? TL.fmtTime(new Date(t)) : "now") +
      ", water " + s.height.toFixed(1) + " metres, " + (s.rising ? "rising" : "falling"));
    drawCurve();
  }
  /* the high and low water either side of service, e.g. "High water 4:32 PM, low 10:41 PM" */
  var tidesEl = document.getElementById("gauge-tides");
  if (tidesEl) {
    var s0 = TL.tideState(evening.start - 3 * 3600000);
    var hiFirst = s0.nextHigh < s0.nextLow;
    var hi = "high water <span>" + TL.fmtTime(s0.nextHigh) + "</span>", lo = "low <span>" + TL.fmtTime(s0.nextLow) + "</span>";
    var txt = hiFirst ? hi + ", " + lo : lo.replace("low", "low water") + ", " + hi.replace("high water", "high");
    tidesEl.innerHTML = txt.charAt(0).toUpperCase() + txt.slice(1);
  }
  if (range) {
    if (!evening.tonight && gaugeTitle) {
      var dn = TL.DAYS[new Date(evening.start).getDay()];
      gaugeTitle.textContent = (new Date(evening.start).getDate() === new Date(Date.now() + 86400000).getDate() ? "Tomorrow" : dn) + " evening";
    }
    /* start the thumb at the current time when service is under way */
    var nm = minutesNow();
    range.value = evening.tonight && nm > 0 && nm < 300 ? Math.round(nm / 5) * 5 : 150;
    range.addEventListener("input", function () { scrubbed = true; paintGauge(); requestDraw(); });
    paintGauge();
    setInterval(function () { if (!scrubbed) { paintGauge(); requestDraw(); } }, 60000);
  }

  /* ---------------- WebGL shoreline ---------------- */
  var gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) { canvas.remove(); return; }   // the CSS shoreline stays behind

  var VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

  var FRAG = [
    "precision highp float;",
    "uniform vec2 u_res; uniform float u_time; uniform vec2 u_ptr; uniform float u_level; uniform float u_hq; uniform float u_tilt;",
    "float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }",
    "vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }",
    "float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y); }",
    "float fbm(vec2 p){ float v = 0.0, a = 0.5;",
    "  for (int i = 0; i < 4; i++){ if (float(i) >= 3.0 + u_hq) break; v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; }",
    "  return v; }",
    /* distance to the nearest and second-nearest moving cell: F2 - F1 draws a lace network */
    "vec2 cells(vec2 p, float t){ vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;",
    "  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){",
    "    vec2 g = vec2(float(x), float(y)); vec2 o = hash22(i + g); o = 0.5 + 0.42 * sin(t + 6.2831 * o);",
    "    vec2 r = g + o - f; float d = dot(r, r);",
    "    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2){ d2 = d; } }",
    "  return sqrt(vec2(d1, d2)); }",
    /* curved caustic network for the shallows */
    "float caustic(vec2 uv, float time){",
    "  vec2 p = mod(uv * 6.2831, 6.2831) - 250.0; vec2 i = p; float c = 1.0;",
    "  for (int n = 0; n < 4; n++){",
    "    float tt = time * (1.0 - 3.5 / float(n + 1));",
    "    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));",
    "    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));",
    "  }",
    "  c = 1.17 - pow(c / 4.0, 1.4);",
    "  return clamp(pow(abs(c), 7.0), 0.0, 1.0); }",
    /* one swash cycle: a fast uprush, then a slower backwash */
    "const float UP = 0.3;",
    "float runup(float p){ if (p < UP){ float u = p / UP; return 1.0 - (1.0 - u) * (1.0 - u); } return pow(1.0 - (p - UP) / (1.0 - UP), 1.7); }",
    "",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / u_res;",
    "  float asp = u_res.x / u_res.y;",
    "  float t = u_time;",
    /* a frame turned so the beach runs diagonally: sand lower-left, sea upper-right */
    "  vec2 c0 = vec2((uv.x - 0.5) * asp, uv.y - 0.5);",
    "  float ca0 = cos(u_tilt), sa0 = sin(u_tilt);",
    "  vec2 q = vec2(ca0 * c0.x - sa0 * c0.y, ca0 * c0.y + sa0 * c0.x) + vec2(4.0, 0.5);",
    /* mean waterline: tide level, beach cusps, a slow meander */
    "  float shore = 0.5 + mix(0.13, -0.13, u_level) + (fbm(vec2(q.x * 0.8, 3.7)) - 0.5) * 0.07 + 0.007 * sin(q.x * 10.5);",
    "  float d = shore - q.y;",
    "  float film = -1.0, wet = 0.0, foam = 0.0, lace = 0.0, mark = 0.0;",
    "  for (int i = 0; i < 3; i++){",
    "    float fi = float(i);",
    "    float T = 8.6 + fi * 2.3 + fi * fi * 0.4;",
    "    float ph = t / T + fi * 0.37;",
    "    float cyc = floor(ph); float p = fract(ph);",
    "    float A = (0.065 + 0.035 * fi) * (0.6 + 0.8 * noise(vec2(q.x * 1.5 + fi * 5.3, cyc * 1.7 + fi)));",
    "    A += 0.005 * sin(q.x * 29.0 + cyc * 2.1) + 0.004 * (noise(vec2(q.x * 12.0, cyc + fi)) - 0.5);",
    "    float R = runup(p) * A;",
    "    float s = R - d;",
    "    film = max(film, s);",
    /* time since this wave last left the point → wet sand that dries; the swash mark at the top of the run */
    "    float r = d / max(A, 0.001);",
    "    if (r > 0.0 && r < 1.0){",
    "      float pin = UP * (1.0 - sqrt(1.0 - r));",
    "      float pout = UP + (1.0 - UP) * (1.0 - pow(r, 1.0 / 1.7));",
    "      float since = p > pout ? (p - pout) * T : (p < pin ? (p + 1.0 - pout) * T : 0.0);",
    "      wet = max(wet, exp(-since / 6.5));",
    "    } else if (r <= 0.0){ wet = 1.0; }",
    "    float sinceTop = (p > UP ? p - UP : p + 1.0 - UP) * T;",
    "    float mk = exp(-pow((d - A) / 0.0032, 2.0)) * exp(-sinceTop / 10.0) * step(R, d);",
    "    mark = max(mark, mk * (0.5 + 0.5 * noise(vec2(q.x * 90.0, fi))));",
    /* the bore: bright and thick on the way up, a thin line on the way back */
    "    float up = step(p, UP);",
    "    float edgeW = mix(0.005, 0.012 + 0.018 * (p / UP), up);",
    "    float bore = smoothstep(edgeW, 0.0, abs(s)) * step(-0.0015, s);",
    "    float fresh = mix(exp(-(p - UP) * T / 3.0), 1.0, up);",
    "    foam = max(foam, bore * mix(0.3, 1.0, fresh) * (0.75 + 0.5 * noise(vec2(q.x * 40.0, t))));",
    /* foam lace behind the bore, carried with the water as it runs up and drains back */
    "    if (s > 0.0 && d > -0.16){",
    "      vec2 lp = vec2(q.x, q.y + R) * vec2(34.0, 40.0) + fi * 13.0;",
    "      vec2 c = cells(lp + (vec2(noise(lp * 0.6), noise(lp * 0.6 + 5.0)) - 0.5) * 1.1, t * 0.1 + fi);",
    "      float drift = exp(-max(0.0, p - UP) * T / 6.0);",
    /* a foam sheet with round holes that open up as the foam ages, leaving threads */
    "      float holeR = mix(0.62, 0.3, drift) + 0.12 * (noise(lp * 0.5 + 9.0) - 0.5);",
    "      float sheet = smoothstep(holeR - 0.06, holeR + 0.1, c.x);",
    "      float c2 = cells(lp * 2.3 + 7.0, t * 0.13).x;",
    "      sheet *= smoothstep(0.12, 0.34, c2);",
    "      float thin = smoothstep(0.06, 0.0, s);",
    "      float patchy = smoothstep(0.3, 0.65, noise(lp * 0.1 + cyc * 3.1) * 0.75 + noise(lp * 0.33) * 0.25);",
    "      lace = max(lace, sheet * patchy * (0.3 + 0.7 * thin) * mix(0.3, 1.0, drift) * smoothstep(0.0, 0.004, s) * smoothstep(0.09, 0.0, -d));",
    "    }",
    /* offshore: the broken wave travelling in before its uprush */
    "    float f = (p - 0.6) / 0.4;",
    "    if (f > 0.0){",
    "      float yb = shore + 0.34 * (1.0 - f) + (noise(vec2(q.x * 2.2, cyc + fi)) - 0.5) * 0.035;",
    "      float dy = q.y - yb;",
    "      float crest = exp(-dy * dy / 0.00009) * (0.35 + 0.65 * f);",
    "      float trail = dy > 0.0 ? exp(-dy / 0.04) * f : 0.0;",
    "      float turb = fbm(vec2(q.x * 8.0, q.y * 13.0 - t * 0.35) + fi * 3.1);",
    "      foam = max(foam, clamp(crest * (0.55 + 0.6 * turb) + trail * smoothstep(0.5, 0.8, turb) * 0.8, 0.0, 1.0) * smoothstep(-0.01, 0.05, q.y - shore));",
    "    }",
    "  }",
    "",
    "  float depth = d < 0.0 ? -d : max(film, 0.0);",
    "  float sunX = 0.74 + (u_ptr.x - 0.5) * 0.14;",
    "  float sunBand = exp(-pow((uv.x - sunX) * 2.6, 2.0));",
    /* ---- sand: dry grain and ripple marks, glazed where the water has just been ---- */
    "  float grain = noise(q * vec2(420.0, 330.0));",
    "  float ripple = 0.5 + 0.5 * sin(q.y * 150.0 + fbm(q * vec2(3.0, 9.0)) * 7.0);",
    "  vec3 sandDry = vec3(0.315, 0.285, 0.24) * (0.9 + 0.14 * grain) * (0.95 + 0.08 * ripple);",
    "  float damp = clamp(max(wet, exp(-max(d, 0.0) / 0.045) * 0.8), 0.0, 1.0);",
    "  vec3 sandWet = vec3(0.125, 0.125, 0.115) * (0.94 + 0.1 * grain);",
    "  vec3 sand = mix(sandDry, sandWet, damp);",
    "  vec3 sky = mix(vec3(0.15, 0.23, 0.25), vec3(0.66, 0.44, 0.25), sunBand);",
    "  sand = mix(sand, sky, damp * 0.42 * (0.5 + 0.5 * fbm(q * vec2(4.0, 18.0))));",
    "  float gl = smoothstep(0.86, 0.98, noise(q * vec2(160.0, 95.0) + t * 0.04)) * damp * sunBand;",
    "  sand += vec3(1.0, 0.82, 0.58) * gl * 0.4;",
    "  sand = mix(sand, vec3(0.78, 0.80, 0.76), mark * 0.6);",
    /* ---- water: sand shows through the thin swash film, then teal, then slate ---- */
    "  float deep = clamp(depth / 0.45, 0.0, 1.0);",
    "  vec3 wShallow = vec3(0.20, 0.34, 0.315);",
    "  vec3 wMid = vec3(0.07, 0.185, 0.195);",
    "  vec3 wDeep = vec3(0.028, 0.07, 0.085);",
    "  vec3 water = mix(wShallow, wMid, smoothstep(0.0, 0.14, deep));",
    "  water = mix(water, wDeep, smoothstep(0.18, 1.0, deep));",
    "  float thinFilm = 1.0 - smoothstep(0.0, 0.05, depth);",
    "  water = mix(water, mix(sandWet, wShallow, 0.6) * 1.2, thinFilm * 0.7);",
    "  float swell = sin((q.y - shore) * 46.0 - t * 0.7 + fbm(q * vec2(2.0, 3.0) + t * 0.03) * 4.0);",
    "  water += vec3(0.014, 0.034, 0.036) * swell * smoothstep(0.03, 0.4, deep);",
    "  float shallowMask = 1.0 - smoothstep(0.0, 0.16, depth);",
    "  float ca = caustic(q * vec2(2.6, 3.2), t * 0.32);",
    "  water += vec3(0.30, 0.40, 0.33) * ca * shallowMask * (0.25 + 0.2 * u_hq);",
    "  float spark = smoothstep(0.9, 0.99, noise(c0 * vec2(260.0, 300.0) + vec2(t * 0.5, -t * 1.3))) * smoothstep(0.4, 0.7, noise(c0 * 9.0 - t * 0.2));",
    "  float path = sunBand * smoothstep(0.05, 0.5, deep);",
    "  water += vec3(0.95, 0.66, 0.36) * (path * 0.08 + spark * path * 0.9);",
    "",
    "  float inWater = smoothstep(-0.0016, 0.0016, max(film, -d));",
    "  vec3 col = mix(sand, water, inWater);",
    "  col = mix(col, vec3(0.88, 0.905, 0.87), clamp(foam + lace * 0.7, 0.0, 1.0) * 0.92);",
    /* dusk grade, vignette, film grain */
    "  float vig = smoothstep(1.35, 0.25, length((uv - vec2(0.6, 0.55)) * vec2(1.0, 1.2)));",
    "  col *= 0.7 + 0.3 * vig;",
    "  col += (hash12(gl_FragCoord.xy + fract(t) * 91.0) - 0.5) * 0.018;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ["u_res", "u_time", "u_ptr", "u_level", "u_hq", "u_tilt"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1f(U.u_hq, LOW ? 0 : 1);

  /* soft gradients and noise survive downsampling, so render below
     device resolution and let the browser scale up; drop further if
     the first frames come in slow */
  var scale = Math.min(window.devicePixelRatio || 1, SMALL ? 1 : 1.25);
  var MAX_W = SMALL ? 720 : LOW ? 960 : 1400;
  function resize() {
    var s = Math.min(scale, MAX_W / Math.max(1, canvas.clientWidth));
    var w = Math.max(1, Math.round(canvas.clientWidth * s)), h = Math.max(1, Math.round(canvas.clientHeight * s));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }

  var ptr = { x: 0.5, gx: 0.5 };
  window.addEventListener("pointermove", function (e) { ptr.gx = e.clientX / window.innerWidth; }, { passive: true });

  var level = levelGoal;
  var STILL_T = 31.5;    /* a composed moment: one wave draining back through its lace */
  function draw(t) {
    resize();
    gl.uniform2f(U.u_res, canvas.width, canvas.height);
    gl.uniform1f(U.u_time, t);
    gl.uniform2f(U.u_ptr, ptr.x, 0.5);
    gl.uniform1f(U.u_level, level);
    /* landscape: a steep diagonal beach; portrait: a gentler one, so the copy sits on sand */
    gl.uniform1f(U.u_tilt, canvas.width > canvas.height ? 0.42 : 0.2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  var pending = false;
  function requestDraw() {
    if (!REDUCED || pending || !gl) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; level = levelGoal; draw(STILL_T); });
  }

  resize();
  draw(STILL_T);
  canvas.classList.add("ready");
  window.addEventListener("resize", function () { if (REDUCED) requestDraw(); });
  if (REDUCED) return;

  var running = !document.hidden, raf = 0, last = 0, start = performance.now() - STILL_T * 1000;
  /* adaptive cost: watch the real frame interval; a dozen slow frames in a row
     render smaller, and a very slow (software) renderer settles for ~15 fps,
     so the page itself stays responsive */
  var minGap = 30, slowRun = 0, steps = 0;
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (now - last < minGap) return;      /* ~30 fps is plenty for a tide */
    var gap = last ? now - last : minGap;
    var dt = Math.min(0.1, gap / 1000);
    last = now;
    ptr.x += (ptr.gx - ptr.x) * 0.05;
    level += (levelGoal - level) * (1 - Math.exp(-dt * 2.2));
    draw((now - start) / 1000);
    if (steps < 4) {
      slowRun = gap > minGap * 2.2 ? slowRun + 1 : 0;
      if (slowRun >= 12) {
        slowRun = 0; steps++;
        if (scale > 0.5) scale *= 0.7; else minGap = 66;
      }
    }
  }
  function setRunning(on) {
    if (on === running) return;
    running = on;
    if (on) { last = 0; raf = requestAnimationFrame(loop); } else cancelAnimationFrame(raf);
  }
  if (running) raf = requestAnimationFrame(loop);
  var onScreen = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; setRunning(onScreen && !document.hidden); }, { threshold: 0.02 }).observe(canvas);
  }
  document.addEventListener("visibilitychange", function () { setRunning(onScreen && !document.hidden); });
  /* leaving for another page: stop drawing so the exit is instant */
  document.addEventListener("tideline:leave", function () { setRunning(false); });
  window.addEventListener("pageshow", function () { setRunning(onScreen && !document.hidden); });
})();
