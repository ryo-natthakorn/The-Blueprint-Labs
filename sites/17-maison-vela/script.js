import * as THREE from "three";

const canvas = document.getElementById("atelier"),
  stage = canvas.parentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const low = innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
let paused = reduced,
  breeze = 0.35,
  liftPhase = 0;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low });
renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.35 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#121112");
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
function resize() {
  const w = stage.clientWidth,
    h = stage.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.position.set(0.45, 0.25, 12.4 / Math.min(1, camera.aspect * 1.5));
  camera.lookAt(0, -0.05, 0);
  camera.updateProjectionMatrix();
}
resize();
addEventListener("resize", resize);
scene.add(new THREE.HemisphereLight(0xe9e2d6, 0x17151b, 1.3));
const key = new THREE.DirectionalLight(0xffead1, 3.5);
key.position.set(-5, 5, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xc4cedc, 2.3);
rim.position.set(5, 2, -2);
scene.add(rim);
const front = new THREE.DirectionalLight(0xffe9dc, 0.6);
front.position.set(1, -2, 5);
scene.add(front);

const W = 5.4,
  H = 6.25,
  CW = low ? 33 : 55,
  CH = low ? 47 : 77,
  N = CW * CH,
  DX = W / (CW - 1),
  DY = H / (CH - 1),
  TOP = 3.15;
const pos = new Float32Array(N * 3),
  old = new Float32Array(N * 3),
  rest = new Float32Array(N * 3),
  pins = new Uint8Array(N);
const index = (x, y) => y * CW + x;
for (let y = 0; y < CH; y++)
  for (let x = 0; x < CW; x++) {
    const u = x / (CW - 1),
      v = y / (CH - 1),
      i = index(x, y) * 3;
    rest[i] = (u - 0.5) * W * (0.73 + v * 0.06) + 0.08 * Math.sin(v * 3);
    rest[i + 1] =
      TOP - v * H + 0.06 * Math.cos(u * Math.PI * 8) * v + 0.09 * (u - 0.5);
    rest[i + 2] =
      Math.sin(u * Math.PI * 8) * (0.31 + v * 0.06) +
      0.1 * Math.sin(v * 4 + u * 7) * v;
    if (y === 0) pins[index(x, y)] = 1;
  }
pos.set(rest);
old.set(rest);
const constraints = [];
for (let y = 0; y < CH; y++)
  for (let x = 0; x < CW; x++) {
    if (x < CW - 1) constraints.push([index(x, y), index(x + 1, y), DX]);
    if (y < CH - 1) constraints.push([index(x, y), index(x, y + 1), DY]);
    if (x < CW - 1 && y < CH - 1) {
      const d = Math.hypot(DX, DY);
      constraints.push(
        [index(x, y), index(x + 1, y + 1), d],
        [index(x + 1, y), index(x, y + 1), d],
      );
    }
  }
const DYES = {
  ivory: {
    color: "#e8e2d5",
    name: "Ivoire",
    note: "The warmth of unbleached silk. Light held in the weave.",
  },
  oxblood: {
    color: "#681f29",
    name: "Sang-de-bœuf",
    note: "A deep garnet, drawn into light along each folded edge.",
  },
  ink: {
    color: "#293748",
    name: "Encre",
    note: "Midnight blue. A cool lustre that reveals itself in movement.",
  },
  sage: {
    color: "#8a9781",
    name: "Sauge",
    note: "A silver green, softened like a leaf held against the light.",
  },
};
let dye = "ivory";
function textile() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1536;
  const g = c.getContext("2d");
  g.fillStyle = "#eeeae1";
  g.fillRect(0, 0, 1024, 1536);
  for (let x = 0; x < 1024; x += 3) {
    g.fillStyle = x % 6 ? "#ffffff12" : "#28201810";
    g.fillRect(x, 0, 1, 1536);
  }
  for (let y = 0; y < 1536; y += 3) {
    g.fillStyle = y % 6 ? "#ffffff10" : "#28201808";
    g.fillRect(0, y, 1024, 1);
  }
  g.strokeStyle = "#786e5f";
  g.globalAlpha = 0.4;
  g.lineWidth = 1;
  g.setLineDash([3, 4]);
  for (const x of [13, 20, 1004, 1011]) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 1536);
    g.stroke();
  }
  for (const y of [1511, 1518]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1024, y);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = "#d4cdbf";
  g.fillRect(690, 1390, 210, 65);
  g.strokeStyle = "#aaa191";
  g.strokeRect(694, 1394, 202, 57);
  g.fillStyle = "#474037";
  g.textAlign = "center";
  g.font = '24px "Cormorant Garamond"';
  g.fillText("MAISON VELA", 795, 1422);
  g.font = '8px "Jost"';
  g.fillText("ATELIER Nº 7 · PURE SILK", 795, 1440);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const clothGeo = new THREE.PlaneGeometry(W, H, CW - 1, CH - 1);
const clothMat = new THREE.MeshPhysicalMaterial({
  map: textile(),
  color: DYES.ivory.color,
  side: THREE.DoubleSide,
  roughness: 0.36,
  metalness: 0.04,
  sheen: 1,
  sheenRoughness: 0.28,
  sheenColor: new THREE.Color("#fff1d9"),
});
const cloth = new THREE.Mesh(clothGeo, clothMat);
cloth.frustumCulled = false;
scene.add(cloth);
document.fonts.ready.then(() => {
  clothMat.map.dispose();
  clothMat.map = textile();
});
const brass = new THREE.MeshStandardMaterial({
  color: 0x9a8160,
  metalness: 0.8,
  roughness: 0.4,
});
const rail = new THREE.Mesh(
  new THREE.CylinderGeometry(0.028, 0.028, 4.6, 16),
  brass,
);
rail.rotation.z = Math.PI / 2;
rail.position.y = TOP + 0.1;
scene.add(rail);
for (const x of [-2.3, 2.3]) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), brass);
  cap.position.set(x, TOP + 0.1, 0);
  scene.add(cap);
  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 1.2, 6),
    brass,
  );
  wire.position.set(x, TOP + 0.7, 0);
  scene.add(wire);
}
// A soft floor shadow keeps the textile grounded without a heavy shadow map.
const shadowCanvas = document.createElement("canvas");
shadowCanvas.width = 256;
shadowCanvas.height = 256;
const sg = shadowCanvas.getContext("2d"),
  grad = sg.createRadialGradient(128, 128, 10, 128, 128, 125);
grad.addColorStop(0, "#000000b0");
grad.addColorStop(1, "#00000000");
sg.fillStyle = grad;
sg.fillRect(0, 0, 256, 256);
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 2.1),
  new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas),
    transparent: true,
    depthWrite: false,
  }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(0, -3.38, 0);
scene.add(shadow);
const hand = { x: 0, y: 0, vx: 0, vy: 0, active: false };
function simulate(dt, t) {
  const wind =
    (0.4 + Math.sin(t * 0.7) * 0.22 + Math.sin(t * 1.4) * 0.12) * breeze;
  for (let n = 0; n < N; n++) {
    if (pins[n]) continue;
    const j = n * 3,
      x = pos[j],
      y = pos[j + 1],
      z = pos[j + 2],
      v = (TOP - y) / H;
    let ax = Math.sin(t * 0.85 + y) * wind * 0.6,
      ay = -2.4,
      az = wind * (0.4 + v) * Math.cos(x * 0.8 + t * 0.4);
    // A very soft restoring force preserves the pressed pleats without flattening the cloth.
    az += (rest[j + 2] - z) * 1.5;
    if (hand.active) {
      const f = Math.exp(-((x - hand.x) ** 2 + (y - hand.y) ** 2) * 1.3) * 15;
      ax += hand.vx * f;
      ay += hand.vy * f * 0.45;
      az += Math.min(3, Math.hypot(hand.vx, hand.vy)) * f * 0.5;
    }
    if (liftPhase > 0) {
      const f = Math.sin(liftPhase * Math.PI) * Math.exp(-x * x * 0.7) * v;
      ay += f * 14;
      az += f * 12;
    }
    pos[j] = x + (x - old[j]) * 0.975 + ax * dt * dt;
    pos[j + 1] = y + (y - old[j + 1]) * 0.975 + ay * dt * dt;
    pos[j + 2] = z + (z - old[j + 2]) * 0.975 + az * dt * dt;
    old[j] = x;
    old[j + 1] = y;
    old[j + 2] = z;
  }
  for (let k = 0; k < 5; k++)
    for (const [a, b, length] of constraints) {
      const ia = a * 3,
        ib = b * 3,
        dx = pos[ib] - pos[ia],
        dy = pos[ib + 1] - pos[ia + 1],
        dz = pos[ib + 2] - pos[ia + 2],
        d = Math.hypot(dx, dy, dz) || 1;
      const f = (d - length) / d / (pins[a] || pins[b] ? 1 : 2);
      if (!pins[a]) {
        pos[ia] += dx * f;
        pos[ia + 1] += dy * f;
        pos[ia + 2] += dz * f;
      }
      if (!pins[b]) {
        pos[ib] -= dx * f;
        pos[ib + 1] -= dy * f;
        pos[ib + 2] -= dz * f;
      }
    }
}
function updateMesh() {
  clothGeo.attributes.position.array.set(pos);
  clothGeo.attributes.position.needsUpdate = true;
  clothGeo.computeVertexNormals();
}
const ray = new THREE.Raycaster(),
  plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
  hit = new THREE.Vector3(),
  ndc = new THREE.Vector2();
let last = 0,
  lastX = 0,
  lastY = 0,
  dragging = false,
  staticLift = false;
function move(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    (-(e.clientY - r.top) / r.height) * 2 + 1,
  );
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(plane, hit)) return;
  const now = performance.now(),
    dt = Math.max(16, now - last);
  hand.vx = THREE.MathUtils.clamp(((hit.x - lastX) / dt) * 1000, -3, 3);
  hand.vy = THREE.MathUtils.clamp(((hit.y - lastY) / dt) * 1000, -3, 3);
  hand.x = hit.x;
  hand.y = hit.y;
  hand.active = dragging;
  lastX = hit.x;
  lastY = hit.y;
  last = now;
  if (paused && dragging) {
    pos.set(rest);
    for (let n = 0; n < N; n++) {
      if (pins[n]) continue;
      const j = n * 3,
        f = Math.exp(
          -((pos[j] - hit.x) ** 2 + (pos[j + 1] - hit.y) ** 2) * 0.9,
        );
      pos[j + 2] += f * 0.85;
      pos[j + 1] += f * 0.2;
    }
    old.set(pos);
    updateMesh();
  }
}
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  move(e);
  hand.vx = hand.vy = 0;
});
canvas.addEventListener("pointermove", move);
function release() {
  dragging = false;
  hand.active = false;
  hand.vx = hand.vy = 0;
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
addEventListener("blur", release);
const note = document.getElementById("motion-note"),
  motion = document.getElementById("motion");
function syncMotion() {
  motion.textContent = paused ? "Play" : "Pause";
  motion.setAttribute("aria-pressed", String(paused));
  note.textContent = paused
    ? "A still drape. Lift or drag to study its folds."
    : "A quiet breeze, a living surface.";
}
syncMotion();
motion.addEventListener("click", () => {
  paused = !paused;
  old.set(pos);
  syncMotion();
});
document.getElementById("breeze").addEventListener("input", (e) => {
  breeze = +e.target.value / 100;
  document.getElementById("breeze-out").textContent =
    breeze === 0
      ? "Still"
      : breeze < 0.4
        ? "Gentle"
        : breeze < 0.75
          ? "Open window"
          : "A passing gust";
  if (paused) {
    pos.set(rest);
    for (let n = 0; n < N; n++) {
      const j = n * 3,
        v = (TOP - pos[j + 1]) / H;
      pos[j + 2] += Math.sin(v * Math.PI) * breeze * 0.7;
    }
    old.set(pos);
    updateMesh();
  }
});
function lift() {
  if (paused) {
    staticLift = !staticLift;
    pos.set(rest);
    if (staticLift)
      for (let n = 0; n < N; n++) {
        const j = n * 3,
          v = (TOP - pos[j + 1]) / H,
          f = Math.sin((v * Math.PI) / 2) * Math.exp(-pos[j] * pos[j] * 0.5);
        pos[j + 1] += f * 0.55;
        pos[j + 2] += f * 0.95;
      }
    old.set(pos);
    updateMesh();
    note.textContent = staticLift
      ? "The lifted fold — touch the button again to release."
      : "A still drape. Lift or drag to study its folds.";
  } else liftPhase = 0.001;
}
document.getElementById("lift").addEventListener("click", lift);
canvas.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    lift();
  }
});
document.querySelectorAll("[data-dye]").forEach((b) =>
  b.addEventListener("click", () => {
    dye = b.dataset.dye;
    clothMat.color.set(DYES[dye].color);
    clothMat.sheenColor.set(
      dye === "ink" ? "#a4c3e2" : dye === "oxblood" ? "#d19d96" : "#fff1d9",
    );
    document
      .querySelectorAll("[data-dye]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.getElementById("dye-title").textContent = DYES[dye].name;
    document.getElementById("dye-note").textContent = DYES[dye].note;
  }),
);
const clock = new THREE.Clock();
let acc = 0,
  time = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused && !document.hidden) {
    time += dt;
    acc += dt;
    let n = 0;
    while (acc >= 1 / 90 && n < 5) {
      simulate(1 / 90, time);
      acc -= 1 / 90;
      n++;
    }
    if (liftPhase > 0) {
      liftPhase += dt * 0.7;
      if (liftPhase >= 1) liftPhase = 0;
    }
    hand.vx *= 0.8;
    hand.vy *= 0.8;
    updateMesh();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
if (!reduced) {
  for (let i = 0; i < 60; i++) simulate(1 / 90, 0);
  old.set(pos);
}
updateMesh();
frame();
