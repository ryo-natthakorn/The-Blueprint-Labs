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
    uniform sampler2D uLabel;

    const int STEPS = ${isSmallScreen ? 44 : 64};
    const float EPS = 0.004;

    float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }

    float map(vec3 p, float t) {
      // A continuous glass spring vessel: rounded base, shoulders, neck and lip.
      float scale = mix(0.88, 0.85, uPortrait);
      vec3 center = vec3(mix(0.78, 0.0, uPortrait), mix(0.06, 0.0, uPortrait), 0.0);
      vec3 q = (p - center) / scale;
      float y = q.y;
      float shoulder = smoothstep(0.24, 0.86, y);
      float radius = mix(0.55, 0.205, shoulder);
      radius -= 0.035 * (1.0 - smoothstep(-1.08, -0.9, y));
      radius += 0.055 * exp(-pow((y - 1.18) * 25.0, 2.0));

      // Rounded cylinder intersection: the base has a real bevel.
      vec2 v=vec2(length(q.xz)-radius+.025,abs(y-.105)-1.15+.025);
      float d=min(max(v.x,v.y),0.0)+length(max(v,0.0))-.025;
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
      // A fading wake in the light shafts remembers each gesture.
      float wake=sin(length(rd.xy-uMouse.xy*.25)*35.0-t*3.0);
      col+=vec3(.07,.1,.11)*wake*uMouse.z*exp(-length(rd.xy-uMouse.xy*.25)*2.0);
      float shaft=pow(.5+.5*sin(rd.x*17.0+rd.y*3.0),8.0);
      col+=vec3(.10,.12,.12)*shaft;
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

        float scale = mix(0.88, 0.85, uPortrait);
        vec3 center = vec3(mix(0.78,0.0,uPortrait), mix(0.06,0.0,uPortrait),0.0);
        vec3 q=(p-center)/scale;
        // Two surfaces: a thin colourless glass wall and water inside it.
        float tilt=clamp(uMouse.x-center.x,-1.0,1.0)*uMouse.z*.28;
        float level=.57+q.x*tilt+sin(q.x*9.0-t*3.4)*.035*uMouse.z;
        float liquid=1.0-smoothstep(level-.015,level+.015,q.y);
        float wall=pow(1.0-abs(n.z),2.0);
        through*=mix(vec3(1.0),vec3(.83,.96,.985),liquid*.65);
        vec3 refl=background(reflect(rd,n),t);
        col=mix(through,refl,fres*.68);
        col=mix(col,vec3(.18,.43,.53),wall*.47);
        // The water-air meniscus bows up against the inside glass wall.
        float meniscus=exp(-abs(q.y-level-.028*pow(abs(q.x)/.55,6.0))*130.0);
        col=mix(col,vec3(.16,.49,.62),meniscus*.65);
        col+=vec3(.4,.5,.5)*exp(-abs(q.y-level+.018)*130.0);
        // Broad reflected softboxes define thickness without frosting the glass.
        float strip=pow(max(0.0,dot(n,normalize(vec3(-.7,.1,1.0)))),45.0);
        float thin=pow(max(0.0,dot(n,normalize(vec3(.85,.1,.4)))),65.0);
        col+=strip*.55+thin*.7;
        float foot=1.0-smoothstep(-1.02,-.9,q.y);
        col=mix(col,vec3(.28,.53,.61),foot*.28);
        col+=pow(max(0.0,n.y),8.0)*.3;
        float band=1.0-smoothstep(.28,.30,abs(q.y+.2));
        vec2 labelUV=vec2(q.x/1.02+.5,1.0-(q.y+.5)/.6);
        vec3 label=texture2D(uLabel,clamp(labelUV,0.0,1.0)).rgb;
        col=mix(col,label,band*smoothstep(.15,.8,n.z)*.95);
      } else {
        col = background(rd, t);
        vec2 center=vec2(mix(.78,0.0,uPortrait),mix(.06,0.0,uPortrait));
        vec2 ground=uv*1.55-center-vec2(0.0,-mix(.88,.85,uPortrait)*1.08);
        float shadow=exp(-pow(ground.x/.52,2.0)-pow(ground.y/.075,2.0));
        col*=1.0-shadow*.28;
        col+=vec3(.12,.16,.17)*exp(-pow(ground.x/.65,2.0)-pow((ground.y+.07)/.13,2.0))*(.5+.5*sin(ground.x*26.0+t));
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

  const label=document.createElement('canvas');label.width=512;label.height=256;
  const lc=label.getContext('2d');lc.fillStyle='#eaf4f5';lc.fillRect(0,0,512,256);
  lc.fillStyle='#184d60';lc.textAlign='center';lc.font='44px serif';lc.fillText('G L A C I E R',256,112);
  lc.font='18px sans-serif';lc.fillText('64° N  /  SOURCE 04',256,156);
  lc.strokeStyle='#7eabb8';lc.beginPath();lc.moveTo(170,184);lc.lineTo(342,184);lc.stroke();
  const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,label);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(prog,'uLabel'),0);

  /* resolution: raymarching is expensive — render at a friendly scale,
     and degrade further if the device can't hold frame rate */
  let renderScale = isSmallScreen ? 0.85 : Math.min(1.15, window.devicePixelRatio || 1);

  function size() {
    const rect=canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * renderScale);
    canvas.height = Math.floor(rect.height * renderScale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uPortrait, window.innerWidth <= 720 ? 1 : 0);
  }
  size();

  /* pointer in the vessel's world space */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, tStrength: 0 };
  function stir(e) {
    const rect=canvas.getBoundingClientRect();
    const aspectMin = Math.min(rect.width, rect.height);
    // ray at z=0 plane sits ~1.55x the uv coordinate (ro.z 3.1 / rd.z 2.0)
    mouse.tx = (((e.clientX-rect.left) * 2 - rect.width) / aspectMin) * 1.55;
    mouse.ty = (-((e.clientY-rect.top) * 2 - rect.height) / aspectMin) * 1.55;
    mouse.tStrength = 1;
    if(prefersReducedMotion){mouse.x=mouse.tx;mouse.y=mouse.ty;mouse.strength=1;render(3.6);}
  }
  canvas.addEventListener('pointermove',stir);
  canvas.addEventListener('pointerdown',stir);
  canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();mouse.tx=e.key==='ArrowLeft'?-1:1;mouse.tStrength=1;if(prefersReducedMotion){mouse.x=mouse.tx;mouse.strength=1;render(3.6);}}});
  window.addEventListener('pointerleave', () => { mouse.tStrength = 0; });

  function render(t) {
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;
    mouse.strength += (mouse.tStrength - mouse.strength) * 0.03;
    gl.uniform1f(uTime, t);
    gl.uniform3f(uMouse, mouse.x, mouse.y, mouse.strength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if(!prefersReducedMotion)mouse.tStrength*=.985;
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
