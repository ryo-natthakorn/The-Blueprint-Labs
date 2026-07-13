/* ============================================================
   THE TIDELINE — hero shoreline shader (home page only)
   A stylized overhead tideline: slate water, breathing foam
   edge, dark wet sand. Raw WebGL, one quad, one fragment
   shader. Pauses offscreen; renders a single formed frame
   under prefers-reduced-motion; falls back to CSS gradient
   when WebGL is unavailable.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("tide-canvas");
  if (!canvas) return;

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MOBILE = window.matchMedia("(max-width: 720px)").matches ||
               /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

  var gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    powerPreference: "low-power"
  });
  if (!gl) { canvas.remove(); return; } // .hero-fallback stays visible behind

  /* paint deep ink immediately — an opaque context defaults to white */
  gl.clearColor(0.059, 0.09, 0.102, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  var VERT = [
    "attribute vec2 p;",
    "void main(){ gl_Position = vec4(p, 0.0, 1.0); }"
  ].join("\n");

  var FRAG = [
    "precision highp float;",
    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform vec2  u_ptr;", // pointer, 0..1
    "uniform float u_oct;", // fbm octaves (3 mobile / 4 desktop)
    "",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
    "float noise(vec2 p){",
    "  vec2 i = floor(p), f = fract(p);",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
    "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
    "}",
    "float fbm(vec2 p){",
    "  float v = 0.0, a = 0.5;",
    "  for (int i = 0; i < 4; i++){",
    "    if (float(i) >= u_oct) break;",
    "    v += a * noise(p);",
    "    p = p * 2.03 + vec2(11.7, 5.3);",
    "    a *= 0.5;",
    "  }",
    "  return v;",
    "}",
    "",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / u_res;",
    "  float aspect = u_res.x / u_res.y;",
    "  vec2 q = vec2(uv.x * aspect, uv.y);",
    "  float t = u_time;",
    "",
    "  /* --- tide + wave pulses drive the foam line ---------- */",
    "  float tide  = sin(t * 0.055) * 0.045;               /* slow breath */",
    "  float waveA = sin(t * 0.42) * 0.5 + 0.5;            /* arriving sets */",
    "  float waveB = sin(t * 0.27 + 2.1) * 0.5 + 0.5;",
    "  float push  = pow(waveA, 3.0) * 0.05 + pow(waveB, 2.0) * 0.03;",
    "  float edgeWiggle = fbm(vec2(q.x * 2.6, t * 0.11)) * 0.10",
    "                   + fbm(vec2(q.x * 7.0 + 31.0, t * 0.2)) * 0.035;",
    "  float ptrBulge = 0.02 * exp(-pow((uv.x - u_ptr.x) * 5.5, 2.0));",
    "  float shore = 0.335 + tide + push + edgeWiggle - 0.06 + ptrBulge;",
    "",
    "  /* --- palette ----------------------------------------- */",
    "  vec3 sandDeep = vec3(0.055, 0.075, 0.082);",
    "  vec3 sandWet  = vec3(0.115, 0.135, 0.130);",
    "  vec3 waterLo  = vec3(0.055, 0.105, 0.120);",
    "  vec3 waterHi  = vec3(0.165, 0.305, 0.320);",
    "  vec3 foamCol  = vec3(0.840, 0.880, 0.845);",
    "  vec3 warm     = vec3(0.850, 0.630, 0.360);",
    "",
    "  vec3 col;",
    "  float dEdge = uv.y - shore;   /* >0 water side, <0 sand side */",
    "",
    "  if (dEdge < 0.0){",
    "    /* ---- sand ------------------------------------------ */",
    "    float depth = clamp(-dEdge / 0.4, 0.0, 1.0);",
    "    col = mix(sandWet, sandDeep, pow(depth, 0.8));",
    "    float gr = noise(q * vec2(160.0, 90.0));",
    "    col += (gr - 0.5) * 0.016;",
    "    /* wet sheen just below the foam line, catching warm light */",
    "    float sheen = exp(-pow(-dEdge * 14.0, 1.4));",
    "    float glint = fbm(vec2(q.x * 5.0, q.y * 26.0 + t * 0.05));",
    "    col += warm * sheen * 0.10 * (0.45 + glint * 0.55);",
    "    col += foamCol * sheen * 0.05;",
    "    /* the wet crest continues onto the sand side of the line */",
    "    float laceS = fbm(vec2(q.x * 10.0, q.y * 8.0) + vec2(0.0, t * 0.05));",
    "    float crestS = exp(dEdge * 120.0) * (0.4 + laceS * 0.7);",
    "    crestS *= 0.4 + 0.6 * smoothstep(0.12, 0.62, uv.x);",
    "    col = mix(col, foamCol, clamp(crestS, 0.0, 1.0) * 0.75);",
    "    /* residue arcs left by the last few waves */",
    "    float arc = smoothstep(0.965, 1.0, noise(vec2(q.x * 3.2, (uv.y + tide) * 46.0)));",
    "    col += foamCol * arc * 0.05 * (1.0 - depth);",
    "  } else {",
    "    /* ---- water ----------------------------------------- */",
    "    float depth = clamp(dEdge / (1.0 - shore), 0.0, 1.0);",
    "    col = mix(waterLo, waterHi, pow(depth, 1.25));",
    "    /* rolling swell bands moving shoreward */",
    "    float bands = sin((uv.y * 26.0) - t * 0.9 + fbm(q * 3.0 + t * 0.06) * 4.5);",
    "    col += vec3(0.012, 0.026, 0.028) * bands * (0.25 + depth);",
    "    /* fine ripple */",
    "    float rip = fbm(q * vec2(9.0, 14.0) + vec2(t * 0.14, -t * 0.30));",
    "    col += (rip - 0.5) * 0.05 * (0.3 + depth * 0.7);",
    "    /* warm low-sun streak, follows pointer a little */",
    "    float sx = 0.72 + (u_ptr.x - 0.5) * 0.12;",
    "    float streak = exp(-pow((q.x / aspect - sx) * 4.2, 2.0)) * pow(depth, 1.6);",
    "    col += warm * streak * 0.11 * (0.6 + 0.4 * rip);",
    "    /* foam: a tight bright crest, a lacy band, and residue */",
    "    float lace = fbm(q * vec2(10.0, 8.0) + vec2(0.0, -t * 0.12));",
    "    float crest = exp(-dEdge * 105.0);",
    "    float band  = exp(-dEdge * 20.0) * smoothstep(0.34, 0.72, lace);",
    "    float residue = exp(-dEdge * 6.0) * smoothstep(0.62, 0.95, lace) * 0.45;",
    "    float foam = clamp(crest * (0.5 + lace * 0.8) + band * 0.75 + residue, 0.0, 1.0);",
    "    /* keep the brightest foam right of the headline column */",
    "    foam *= 0.4 + 0.6 * smoothstep(0.12, 0.62, uv.x);",
    "    col = mix(col, foamCol, foam * 0.92);",
    "  }",
    "",
    "  /* vignette + grain ------------------------------------- */",
    "  float vig = smoothstep(1.25, 0.35, length(uv - vec2(0.5, 0.42)));",
    "  col *= 0.72 + 0.28 * vig;",
    "  col += (hash(uv * u_res * 0.5 + t) - 0.5) * 0.012;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "u_res");
  var uTime = gl.getUniformLocation(prog, "u_time");
  var uPtr = gl.getUniformLocation(prog, "u_ptr");
  var uOct = gl.getUniformLocation(prog, "u_oct");

  /* The scene is soft gradients + noise — it survives heavy
     downsampling invisibly, so render internally at a reduced
     resolution and let the browser upscale. Keeps the loop
     cheap even on software-rendered WebGL.                    */
  var DPR = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.0 : 1.25);
  var MAX_W = MOBILE ? 900 : 1300;
  function resize() {
    var scale = Math.min(DPR, MAX_W / Math.max(1, canvas.clientWidth));
    var w = Math.round(canvas.clientWidth * scale);
    var h = Math.round(canvas.clientHeight * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener("resize", function () { resize(); if (REDUCED) drawOnce(); });

  /* pointer with easing */
  var ptr = { x: 0.5, y: 0.5 }, ptrGoal = { x: 0.5, y: 0.5 };
  window.addEventListener("pointermove", function (e) {
    ptrGoal.x = e.clientX / window.innerWidth;
    ptrGoal.y = e.clientY / window.innerHeight;
  }, { passive: true });

  gl.uniform1f(uOct, MOBILE ? 3.0 : 4.0);

  var start = performance.now();
  function draw(t) {
    resize();
    ptr.x += (ptrGoal.x - ptr.x) * 0.04;
    ptr.y += (ptrGoal.y - ptr.y) * 0.04;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uPtr, ptr.x, ptr.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function drawOnce() { draw(80.0); } // a formed mid-cycle moment, not t=0

  /* always render one formed frame immediately, so the hero is
     never blank even if rAF is throttled or the tab starts hidden */
  resize();
  drawOnce();

  if (REDUCED) return;

  var running = !document.hidden, raf = null, last = 0;
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (now - last < 31) return; // ~30 fps is plenty for a tide
    last = now;
    draw((now - start) / 1000 + 40.0);
  }
  if (running) raf = requestAnimationFrame(loop);

  function setRunning(on) {
    if (on === running) return;
    running = on;
    if (on) { raf = requestAnimationFrame(loop); }
    else if (raf) { cancelAnimationFrame(raf); raf = null; }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      setRunning(entries[0].isIntersecting && !document.hidden);
    }, { threshold: 0.02 }).observe(canvas);
  }
  document.addEventListener("visibilitychange", function () {
    setRunning(!document.hidden);
  });
})();
