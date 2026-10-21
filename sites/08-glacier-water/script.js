(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;

  /* ----------------------------------------------------------------
     Raw WebGL: a raymarched cluster of water metaballs with fake
     refraction, dispersion, and caustic light — no libraries.
  ---------------------------------------------------------------- */
  const canvas = document.getElementById('water');
  const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false });

  if (!gl) {
    canvas.style.background = 'linear-gradient(165deg, #eaf4f8 0%, #bcd9e6 55%, #8fbdd3 100%)';
    return;
  }
  document.body.classList.add('has-webgl');

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;

    uniform vec2 uRes;
    uniform float uTime;
    uniform vec3 uMouse;   // xy world, z strength
    uniform float uPortrait;

    const int STEPS = ${isSmallScreen ? 44 : 64};
    const float EPS = 0.004;

    float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }

    float map(vec3 p, float t) {
      // A continuous glass spring vessel: rounded base, shoulders, neck and lip.
      float scale = mix(0.88, 0.80, uPortrait);
      vec3 center = vec3(mix(0.78, 0.0, uPortrait), mix(0.06, 0.78, uPortrait), 0.0);
      vec3 q = (p - center) / scale;
      float y = q.y;
      float shoulder = smoothstep(0.24, 0.86, y);
      float radius = mix(0.55, 0.205, shoulder);
      radius -= 0.035 * (1.0 - smoothstep(-1.08, -0.9, y));
      radius += 0.055 * exp(-pow((y - 1.18) * 25.0, 2.0));
      radius += 0.018 * sin((y + 0.7) * 18.0) * smoothstep(-0.96, -0.5, y) * (1.0 - shoulder);
      float d = max(length(q.xz) - radius, max(-1.07 - y, y - 1.28));
      float ripple = sin(length(p.xy - uMouse.xy) * 31.0 - t * 8.0);
      d += ripple * 0.016 * exp(-length(p.xy - uMouse.xy) * 3.0) * uMouse.z;
      return d * scale;
    }

    vec3 normalAt(vec3 p, float t) {
      vec2 e = vec2(EPS, 0.0);
      return normalize(vec3(
        map(p + e.xyy, t) - map(p - e.xyy, t),
        map(p + e.yxy, t) - map(p - e.yxy, t),
        map(p + e.yyx, t) - map(p - e.yyx, t)
      ));
    }

    /* the world behind the water: mist gradient + drifting caustics */
    vec3 background(vec3 rd, float t) {
      float v = clamp(rd.y * 0.7 + 0.55, 0.0, 1.0);
      vec3 top = vec3(0.914, 0.957, 0.973);
      vec3 mid = vec3(0.737, 0.867, 0.914);
      vec3 low = vec3(0.427, 0.708, 0.827);
      vec3 col = mix(low, mix(mid, top, smoothstep(0.5, 1.0, v)), smoothstep(0.0, 0.6, v));

      // caustic shimmer bands in the lower half
      float bands = sin(rd.x * 14.0 + t * 0.5) * sin(rd.x * 23.0 - t * 0.35 + rd.y * 8.0);
      col += vec3(0.10, 0.13, 0.14) * bands * smoothstep(0.4, -0.6, rd.y);

      // soft god-ray from upper left
      float ray = pow(max(0.0, dot(normalize(rd), normalize(vec3(-0.4, 0.75, -0.2)))), 18.0);
      col += vec3(0.25, 0.28, 0.28) * ray;
      return col;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float t = uTime;

      vec3 ro = vec3(0.0, 0.0, 3.1);
      vec3 rd = normalize(vec3(uv, -2.0));

      float dist = 0.0;
      float d = 0.0;
      bool hit = false;
      vec3 p = ro;
      for (int i = 0; i < STEPS; i++) {
        p = ro + rd * dist;
        d = map(p, t);
        if (d < EPS) { hit = true; break; }
        dist += d * 0.72;
        if (dist > 8.0) break;
      }

      vec3 col;
      if (hit) {
        vec3 n = normalAt(p, t);
        float fres = pow(1.0 - max(0.0, dot(-rd, n)), 3.0);

        // refraction with slight dispersion (fall back to reflection on TIR)
        vec3 rdR = refract(rd, n, 0.752);
        vec3 rdB = refract(rd, n, 0.746);
        if (dot(rdR, rdR) < 0.25) rdR = reflect(rd, n);
        if (dot(rdB, rdB) < 0.25) rdB = reflect(rd, n);
        vec3 through;
        through.r = background(rdR, t).r;
        through.g = background(mix(rdR, rdB, 0.5), t).g;
        through.b = background(rdB, t).b;

        // water body tint deepens with thickness (approximate via normal.z)
        float thickness = 1.0 - abs(n.z) * 0.5;
        through *= mix(vec3(1.0), vec3(0.62, 0.86, 0.92), thickness * 0.85);

        vec3 refl = background(reflect(rd, n), t);

        col = mix(through, refl, fres * 0.75);

        // sun sparkle
        vec3 sunDir = normalize(vec3(-0.5, 0.8, 0.4));
        float spec = pow(max(0.0, dot(reflect(-sunDir, n), -rd)), 90.0);
        col += vec3(1.0) * spec * 0.9;

        // inner edge glow where the surface silhouettes
        col += vec3(0.12, 0.2, 0.24) * fres * 0.6;

        // A quiet, printed provenance band anchors the refractive form.
        float scale = mix(0.88, 0.80, uPortrait);
        vec3 center = vec3(mix(0.78, 0.0, uPortrait), mix(0.06, 0.78, uPortrait), 0.0);
        vec3 q = (p - center) / scale;
        float band = 1.0 - smoothstep(0.29, 0.32, abs(q.y + 0.14));
        col = mix(col, vec3(0.89, 0.95, 0.96), band * max(0.0, n.z) * 0.82);
      } else {
        col = background(rd, t);
      }

      // fine grain so the gradients never band
      float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col += (g - 0.5) * 0.012;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const locPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uMouse = gl.getUniformLocation(prog, 'uMouse');
  const uPortrait = gl.getUniformLocation(prog, 'uPortrait');

  /* resolution: raymarching is expensive — render at a friendly scale,
     and degrade further if the device can't hold frame rate */
  let renderScale = isSmallScreen ? 0.85 : Math.min(1.15, window.devicePixelRatio || 1);

  function size() {
    canvas.width = Math.floor(window.innerWidth * renderScale);
    canvas.height = Math.floor(window.innerHeight * renderScale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uPortrait, window.innerHeight > window.innerWidth ? 1 : 0);
  }
  size();

  /* pointer in the vessel's world space */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, tStrength: 0 };
  window.addEventListener('pointermove', (e) => {
    const aspectMin = Math.min(window.innerWidth, window.innerHeight);
    // ray at z=0 plane sits ~1.55x the uv coordinate (ro.z 3.1 / rd.z 2.0)
    mouse.tx = ((e.clientX * 2 - window.innerWidth) / aspectMin) * 1.55;
    mouse.ty = (-(e.clientY * 2 - window.innerHeight) / aspectMin) * 1.55;
    mouse.tStrength = 1;
  });
  window.addEventListener('pointerleave', () => { mouse.tStrength = 0; });

  function render(t) {
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;
    mouse.strength += (mouse.tStrength - mouse.strength) * 0.03;
    gl.uniform1f(uTime, t);
    gl.uniform3f(uMouse, mouse.x, mouse.y, mouse.strength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  window.addEventListener('resize', () => {
    size();
    if (prefersReducedMotion) render(3.6);
  });

  if (prefersReducedMotion) {
    render(3.6);
  } else {
    let lastFrame = 0;
    let slowFrames = 0;
    (function loop(now) {
      const dt = now - lastFrame;
      lastFrame = now;
      // sustained jank → drop resolution once per threshold crossing
      if (dt > 40 && dt < 500) {
        if (++slowFrames > 40 && renderScale > 0.55) {
          renderScale = Math.max(0.55, renderScale - 0.2);
          slowFrames = 0;
          size();
        }
      } else if (slowFrames > 0) {
        slowFrames--;
      }
      render(now / 1000);
      requestAnimationFrame(loop);
    })(0);
  }
})();
