import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
const canvas = document.getElementById("showroom"),
  stage = canvas.parentElement,
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches,
  low = innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !low,
  alpha: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.4 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
const pmrem = new THREE.PMREMGenerator(renderer),
  room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
room.dispose();
pmrem.dispose();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const paint = new THREE.MeshPhysicalMaterial({
  color: 0xc8f549,
  metalness: 0.6,
  roughness: 0.3,
  clearcoat: 1,
  clearcoatRoughness: 0.15,
});
const frameMat = new THREE.MeshStandardMaterial({
    color: 0x262d30,
    metalness: 0.85,
    roughness: 0.36,
  }),
  black = new THREE.MeshStandardMaterial({
    color: 0x14181b,
    metalness: 0.5,
    roughness: 0.48,
  }),
  silver = new THREE.MeshStandardMaterial({
    color: 0x99a7ad,
    metalness: 1,
    roughness: 0.28,
  }),
  rubber = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.95 }),
  leather = new THREE.MeshStandardMaterial({
    color: 0x292b29,
    roughness: 0.83,
  }),
  gold = new THREE.MeshStandardMaterial({
    color: 0xa18c56,
    metalness: 0.8,
    roughness: 0.32,
  }),
  glow = new THREE.MeshBasicMaterial({ color: 0xc8f549 });
const bike = new THREE.Group();
scene.add(bike);
const wheels = [];
function mesh(geometry, material, x = 0, y = 0, z = 0, parent = bike) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function tube(a, b, r, mat = frameMat, parent = bike) {
  const dir = b.clone().sub(a),
    m = mesh(
      new THREE.CylinderGeometry(r, r, dir.length(), low ? 10 : 16),
      mat,
      0,
      0,
      0,
      parent,
    );
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return m;
}
function box(w, h, d, mat, x, y, z = 0) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}
function disc(r, depth, mat, x, y, z = 0, parent = bike) {
  const m = mesh(
    new THREE.CylinderGeometry(r, r, depth, 48),
    mat,
    x,
    y,
    z,
    parent,
  );
  m.rotation.x = Math.PI / 2;
  return m;
}
function panel(points, depth, mat, z = 0, bevel = 0.035) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 8,
  });
  geo.translate(0, 0, -depth / 2);
  return mesh(geo, mat, 0, 0, z);
}
function wheel(x) {
  const g = new THREE.Group();
  g.position.set(x, 0.48, 0);
  bike.add(g);
  wheels.push(g);
  mesh(
    new THREE.TorusGeometry(0.385, 0.095, low ? 12 : 24, low ? 48 : 80),
    rubber,
    0,
    0,
    0,
    g,
  );
  for (const z of [-0.075, 0.075]) {
    mesh(new THREE.TorusGeometry(0.325, 0.022, 10, 64), silver, 0, 0, z, g);
    mesh(new THREE.TorusGeometry(0.407, 0.0025, 5, 72), frameMat, 0, 0, z, g);
  }
  disc(0.085, 0.2, silver, 0, 0, 0, g);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    for (const z of [-0.05, 0.05]) {
      tube(
        V(Math.cos(a) * 0.075, Math.sin(a) * 0.075, z),
        V(Math.cos(a + 0.18) * 0.315, Math.sin(a + 0.18) * 0.315, z),
        0.014,
        frameMat,
        g,
      );
      tube(
        V(Math.cos(a) * 0.075, Math.sin(a) * 0.075, z),
        V(Math.cos(a - 0.12) * 0.315, Math.sin(a - 0.12) * 0.315, z),
        0.009,
        silver,
        g,
      );
    }
  }
  const brake = mesh(
    new THREE.RingGeometry(0.105, 0.255, 64),
    silver,
    0,
    0,
    0.105,
    g,
  );
  brake.material = brake.material.clone();
  brake.material.side = THREE.DoubleSide;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    disc(
      0.009,
      0.003,
      black,
      Math.cos(a) * 0.218,
      Math.sin(a) * 0.218,
      0.108,
      g,
    );
  }
  // Instanced diagonal tread ribs follow the tyre crown.
  const count = low ? 48 : 80,
    geo = new THREE.BoxGeometry(0.035, 0.009, 0.14),
    im = new THREE.InstancedMesh(geo, rubber, count),
    d = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    d.position.set(Math.cos(a) * 0.477, Math.sin(a) * 0.477, 0);
    d.rotation.set(0, 0, a - Math.PI / 2);
    d.rotateY((i % 2 ? 1 : -1) * 0.4);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
  }
  g.add(im);
  return g;
}
wheel(-1.12);
wheel(1.12);
// A double cradle carries the battery between the wheels.
for (const z of [-0.18, 0.18]) {
  tube(V(-0.86, 1.16, z), V(0.5, 1.26, z), 0.035);
  tube(V(0.5, 1.26, z), V(0.36, 0.48, z), 0.037);
  tube(V(0.36, 0.48, z), V(-0.48, 0.43, z), 0.035);
  tube(V(-0.48, 0.43, z), V(-0.86, 1.16, z), 0.034);
  tube(V(-0.48, 0.43, z), V(-1.12, 0.48, z), 0.032);
  tube(V(-0.45, 0.52, z), V(-1.12, 0.48, z), 0.024);
  tube(V(-0.78, 1.15, z), V(-1.12, 0.55, z), 0.026, silver);
}
// Finned battery, cast end plates, fasteners, high-voltage inspection strip.
panel(
  [
    [-0.5, 0.6],
    [-0.4, 1.13],
    [0.35, 1.17],
    [0.48, 0.62],
    [0.25, 0.5],
    [-0.35, 0.5],
  ],
  0.36,
  black,
);
for (let i = 0; i < 12; i++)
  box(0.76, 0.015, 0.4, silver, -0.03, 0.58 + i * 0.042);
for (const z of [-0.22, 0.22]) {
  panel(
    [
      [-0.39, 0.6],
      [-0.32, 1.07],
      [0.27, 1.1],
      [0.34, 0.63],
    ],
    0.025,
    frameMat,
    z,
    0.012,
  );
  for (const [x, y] of [
    [-0.32, 0.65],
    [-0.27, 1.02],
    [0.22, 1.05],
    [0.27, 0.65],
  ])
    disc(0.012, 0.008, silver, x, y, z > 0 ? z + 0.02 : z - 0.02);
  box(0.26, 0.025, 0.012, glow, -0.02, 0.92, z > 0 ? z + 0.022 : z - 0.022);
}
disc(0.19, 0.36, black, -0.48, 0.57);
disc(0.14, 0.38, silver, -0.48, 0.57);
mesh(new THREE.TorusGeometry(0.15, 0.009, 8, 48), glow, -0.48, 0.57, 0.202);
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  disc(
    0.009,
    0.012,
    black,
    -0.48 + Math.cos(a) * 0.11,
    0.57 + Math.sin(a) * 0.11,
    0.202,
  );
}
// Belt and toothed rear pulley on the visible side.
mesh(new THREE.TorusGeometry(0.22, 0.016, 8, 64), frameMat, -1.12, 0.48, 0.15);
mesh(new THREE.TorusGeometry(0.11, 0.014, 8, 48), frameMat, -0.48, 0.57, 0.15);
for (let i = 0; i < 32; i++) {
  const a = (i / 32) * Math.PI * 2;
  const tooth = box(
    0.023,
    0.014,
    0.025,
    black,
    -1.12 + Math.cos(a) * 0.224,
    0.48 + Math.sin(a) * 0.224,
    0.15,
  );
  tooth.rotation.z = a;
}
tube(V(-1.12, 0.7, 0.15), V(-0.48, 0.68, 0.15), 0.012, rubber);
tube(V(-1.12, 0.26, 0.15), V(-0.48, 0.46, 0.15), 0.012, rubber);
// Rear suspension: two machined coil-over springs.
for (const z of [-0.25, 0.25]) {
  const a = V(-1.01, 0.55, z),
    b = V(-0.73, 1.14, z);
  tube(a, b, 0.023, silver);
  const points = [],
    axis = b.clone().sub(a),
    len = axis.length(),
    q = new THREE.Quaternion().setFromUnitVectors(
      V(0, 1, 0),
      axis.clone().normalize(),
    );
  for (let i = 0; i <= 160; i++) {
    const t = i / 160,
      pt = V(
        Math.cos(t * Math.PI * 22) * 0.046,
        t * len,
        Math.sin(t * Math.PI * 22) * 0.046,
      )
        .applyQuaternion(q)
        .add(a);
    points.push(pt);
  }
  mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      160,
      0.009,
      6,
      false,
    ),
    gold,
  );
}
// Forks, yokes and front brake caliper.
for (const z of [-0.16, 0.16]) {
  tube(V(0.65, 1.43, z), V(1.12, 0.48, z), 0.031, silver);
  tube(V(0.68, 1.37, z), V(0.87, 0.97, z), 0.046, gold);
  tube(V(0.63, 1.43, z), V(0.72, 1.5, z), 0.025, frameMat);
  box(0.1, 0.17, 0.07, black, 1.01, 0.63, z > 0 ? 0.14 : -0.14);
}
tube(V(0.65, 1.43, -0.19), V(0.65, 1.43, 0.19), 0.035, frameMat);
tube(V(0.76, 1.2, -0.19), V(0.76, 1.2, 0.19), 0.026, frameMat);
// A shallow sculpted cover, floating saddle and compact tail.
panel(
  [
    [-0.28, 1.25],
    [-0.22, 1.46],
    [0.04, 1.54],
    [0.39, 1.48],
    [0.56, 1.29],
    [0.18, 1.23],
  ],
  0.35,
  paint,
  0,
  0.055,
);
panel(
  [
    [-1.04, 1.22],
    [-0.95, 1.34],
    [-0.35, 1.33],
    [-0.25, 1.24],
  ],
  0.32,
  leather,
  0,
  0.04,
);
panel(
  [
    [-1.15, 1.19],
    [-1.07, 1.32],
    [-0.92, 1.31],
    [-0.8, 1.17],
  ],
  0.3,
  paint,
  0,
  0.025,
);
for (let i = 0; i < 10; i++) {
  const x = -0.98 + i * 0.065;
  tube(V(x, 1.365, -0.13), V(x, 1.365, 0.13), 0.003, silver);
}
const tail = box(
  0.018,
  0.038,
  0.22,
  new THREE.MeshBasicMaterial({ color: 0xed523e }),
  -1.17,
  1.25,
);
// Curved mudguards hug the wheels rather than filling their silhouette.
function fender(x, start, end, mat) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.548, start, end, false);
  shape.absarc(0, 0, 0.53, end, start, true);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.23,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 48,
  });
  geo.translate(0, 0, -0.115);
  return mesh(geo, mat, x, 0.48);
}

fender(1.12, 0.25, Math.PI - 0.28, paint);
fender(-1.12, 0.6, Math.PI - 0.25, black);
// Bars, grips, levers, display and circular LED with a machined bezel.
tube(V(0.65, 1.48, -0.32), V(0.65, 1.48, 0.32), 0.024, silver);
for (const z of [-1, 1]) {
  tube(V(0.65, 1.48, z * 0.26), V(0.62, 1.47, z * 0.4), 0.033, rubber);
  tube(V(0.7, 1.46, z * 0.27), V(0.73, 1.45, z * 0.41), 0.009, silver);
  tube(V(0.63, 1.47, z * 0.3), V(0.58, 1.63, z * 0.33), 0.009, frameMat);
  const mirror = mesh(
    new THREE.SphereGeometry(0.06, 16, 12),
    black,
    0.57,
    1.64,
    z * 0.34,
  );
  mirror.scale.set(1.2, 0.5, 1);
}
const dash = box(0.1, 0.055, 0.15, black, 0.66, 1.54);
dash.rotation.z = -0.3;
const screen = box(
  0.075,
  0.007,
  0.11,
  new THREE.MeshBasicMaterial({ color: 0x7baba0 }),
  0.662,
  1.567,
);
screen.rotation.z = -0.3;
const housing = disc(0.13, 0.12, black, 0.83, 1.3);
housing.rotation.set(0, 0, Math.PI / 2);
const lamp = disc(
  0.108,
  0.012,
  new THREE.MeshBasicMaterial({ color: 0xe5eedb }),
  0.9,
  1.3,
);
lamp.rotation.set(0, 0, Math.PI / 2);
const bezel = mesh(
  new THREE.TorusGeometry(0.123, 0.012, 10, 48),
  silver,
  0.912,
  1.3,
);
bezel.rotation.y = Math.PI / 2;
for (const z of [-0.055, 0, 0.055])
  box(0.008, 0.15, 0.009, frameMat, 0.919, 1.3, z);
for (const z of [-0.32, 0.32]) {
  tube(V(-0.38, 0.55, z * 0.6), V(-0.43, 0.55, z), 0.019, frameMat);
  tube(
    V(-0.43, 0.55, z),
    V(-0.43, 0.55, z + Math.sign(z) * 0.09),
    0.026,
    rubber,
  );
}
// Small applied marque on the tank is a procedural texture, not an external asset.
function badge() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#1d2910";
  g.font = '28px "Michroma"';
  g.textAlign = "center";
  g.fillText("VOLTAIC", 256, 62);
  g.font = '12px "Inter Tight"';
  g.fillText("S I G M A   /   0 1", 256, 92);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const badgeMat = new THREE.MeshBasicMaterial({
  map: badge(),
  transparent: true,
  depthWrite: false,
});
for (const z of [-0.236, 0.236]) {
  const b = mesh(new THREE.PlaneGeometry(0.46, 0.115), badgeMat, 0.12, 1.37, z);
  if (z < 0) b.rotation.y = Math.PI;
}
document.fonts.ready.then(() => {
  badgeMat.map.dispose();
  badgeMat.map = badge();
});
// Low, dark presentation disc and a baked soft contact shadow.
const plinth = mesh(
  new THREE.CylinderGeometry(1.88, 1.93, 0.07, low ? 64 : 100),
  new THREE.MeshBasicMaterial({ color: 0x151b1e }),
  0,
  -0.05,
  0,
  scene,
);
const rim = mesh(
  new THREE.TorusGeometry(1.91, 0.005, 6, 100),
  new THREE.MeshBasicMaterial({ color: 0x59654b }),
  0,
  -0.015,
  0,
  scene,
);
rim.rotation.x = Math.PI / 2;
const sc = document.createElement("canvas");
sc.width = 256;
sc.height = 256;
const sg = sc.getContext("2d"),
  gr = sg.createRadialGradient(128, 128, 8, 128, 128, 120);
gr.addColorStop(0, "#000c");
gr.addColorStop(1, "#0000");
sg.fillStyle = gr;
sg.fillRect(0, 0, 256, 256);
const shadow = mesh(
  new THREE.PlaneGeometry(3.9, 1.25),
  new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(sc),
    transparent: true,
    depthWrite: false,
  }),
  0,
  -0.009,
  0,
  scene,
);
shadow.rotation.x = -Math.PI / 2;
scene.add(new THREE.HemisphereLight(0xd8e7ed, 0x181e15, 1.3));
const key = new THREE.DirectionalLight(0xf0f1e5, 3.5);
key.position.set(2, 5, 4);
scene.add(key);
const fill = new THREE.DirectionalLight(0x8ba6b5, 2.2);
fill.position.set(-3, 2, -4);
scene.add(fill);
const PAINTS = {
  volt: [
    0xc8f549,
    "Volt",
    "A charged yellow-green. Impossible to pass quietly.",
  ],
  graphite: [
    0x3d4148,
    "Graphite",
    "A satin charcoal. The details do the talking.",
  ],
  glacier: [
    0xd7e4ec,
    "Glacier",
    "A cool porcelain white. Light across every contour.",
  ],
  signal: [0xe04a2f, "Signal", "A warm vermilion. Built to be seen."],
};
document.querySelectorAll("[data-paint]").forEach((b, i) =>
  b.addEventListener("click", () => {
    const [color, name, note] = PAINTS[b.dataset.paint];
    paint.color.set(color);
    document
      .querySelectorAll("[data-paint]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.getElementById("paint-name").textContent = name;
    document.getElementById("paint-note").textContent = note;
    document.querySelector(".config-heading b").textContent = `0${i + 1} / 04`;
  }),
);
const MODES = {
  street: {
    range: 280,
    torque: 140,
    accel: "3.4",
    spin: 0.25,
    note: "The everyday, amplified. Balanced delivery with room to explore.",
    delivery: "BALANCED",
    path: "M0 55C35 52 48 15 95 15H260",
  },
  sport: {
    range: 190,
    torque: 190,
    accel: "2.7",
    spin: 6,
    note: "All the torque, right now. A sharper response for the open road.",
    delivery: "IMMEDIATE",
    path: "M0 55C7 50 12 5 35 5H260",
  },
  rain: {
    range: 310,
    torque: 95,
    accel: "4.8",
    spin: 0.12,
    note: "A softer hand. Progressive delivery when the surface asks for care.",
    delivery: "PROGRESSIVE",
    path: "M0 55C100 55 130 29 210 29H260",
  },
};
let mode = MODES.street;
document.querySelectorAll("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => {
    mode = MODES[b.dataset.mode];
    document
      .querySelectorAll("[data-mode]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.getElementById("s-range").innerHTML =
      `${mode.range} <small>km</small>`;
    document.getElementById("s-torque").innerHTML =
      `${mode.torque} <small>Nm</small>`;
    document.getElementById("s-accel").innerHTML =
      `${mode.accel} <small>s</small>`;
    document.getElementById("s-mode").textContent =
      b.dataset.mode.toUpperCase() + " MODE";
    document.getElementById("mode-note").textContent = mode.note;
    document.getElementById("delivery-name").textContent = mode.delivery;
    document.getElementById("torque-line").setAttribute("d", mode.path);
  }),
);
let yaw = 0.44,
  pitch = 0.19,
  yawGoal = yaw,
  pitchGoal = pitch,
  dist = 5.7,
  distGoal = 5.7,
  target = V(0, 0.78, 0),
  targetGoal = target.clone(),
  rotating = !reduced,
  dragging = false,
  lx = 0,
  ly = 0,
  currentView = "whole";
const views = {
  whole: {
    yaw: 0.44,
    pitch: 0.19,
    dist: 5.7,
    target: V(0, 0.78, 0),
    label: "COMPLETE MACHINE / 01",
    title: "Built around the feeling.",
    copy: "A low battery mass, an exposed frame and a clean belt drive. Every part has a reason to be here.",
  },
  power: {
    yaw: 0.06,
    pitch: 0.07,
    dist: 3.1,
    target: V(-0.2, 0.83, 0),
    label: "POWERTRAIN / 02",
    title: "Quiet by construction.",
    copy: "A finned 9.6 kWh pack sits inside the frame. The compact motor sends instant torque through a low-maintenance belt.",
  },
  front: {
    yaw: 1.22,
    pitch: 0.17,
    dist: 4.8,
    target: V(0.6, 0.94, 0),
    label: "FRONT ASSEMBLY / 03",
    title: "A clear line forward.",
    copy: "Inverted forks, a compact LED lamp and a considered cockpit. The road stays at the centre of the experience.",
  },
};
const rotate = document.getElementById("rotate");
function syncRotate() {
  rotate.textContent = rotating ? "Pause rotation" : "Rotate bike";
  rotate.setAttribute("aria-pressed", String(rotating));
}
syncRotate();
rotate.addEventListener("click", () => {
  rotating = !rotating;
  syncRotate();
});
function selectView(name) {
  currentView = name;
  const v = views[name];
  yawGoal = v.yaw;
  pitchGoal = v.pitch;
  distGoal = v.dist;
  targetGoal.copy(v.target);
  rotating = false;
  syncRotate();
  document.getElementById("view-label").textContent = v.label;
  document.getElementById("detail-no").textContent =
    "ENGINEERING NOTE / " + v.label.slice(-2);
  document.getElementById("detail-title").textContent = v.title;
  document.getElementById("detail-copy").textContent = v.copy;
  document
    .querySelectorAll("[data-view]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.view === name)),
    );
}
document
  .querySelectorAll("[data-view]")
  .forEach((b) =>
    b.addEventListener("click", () => selectView(b.dataset.view)),
  );
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  rotating = false;
  syncRotate();
  lx = e.clientX;
  ly = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  yawGoal -= (e.clientX - lx) * 0.005;
  pitchGoal = THREE.MathUtils.clamp(
    pitchGoal + (e.clientY - ly) * 0.003,
    0.02,
    0.75,
  );
  lx = e.clientX;
  ly = e.clientY;
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("pointercancel", () => (dragging = false));
canvas.addEventListener("keydown", (e) => {
  if (
    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(e.key)
  )
    return;
  e.preventDefault();
  rotating = false;
  syncRotate();
  if (e.key === "Home") {
    selectView("whole");
    return;
  }
  if (e.key === "ArrowLeft") yawGoal -= 0.16;
  if (e.key === "ArrowRight") yawGoal += 0.16;
  if (e.key === "ArrowUp") pitchGoal = Math.min(0.75, pitchGoal + 0.09);
  if (e.key === "ArrowDown") pitchGoal = Math.max(0.02, pitchGoal - 0.09);
});
function resize() {
  const w = stage.clientWidth,
    h = stage.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
addEventListener("resize", resize);
const clock = new THREE.Clock();
let time = 0;
function render() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!document.hidden) {
    time += dt;
    if (rotating && !dragging) yawGoal += dt * 0.055;
    if (!reduced) wheels.forEach((w) => (w.rotation.z -= dt * mode.spin));
    const a = reduced ? 1 : 1 - Math.exp(-dt * 7);
    yaw += (yawGoal - yaw) * a;
    pitch += (pitchGoal - pitch) * a;
    dist += (distGoal - dist) * a;
    target.lerp(targetGoal, a);
    const r = dist / Math.min(1, camera.aspect * 0.9);
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * r,
      target.y + Math.sin(pitch) * r,
      target.z + Math.cos(yaw) * Math.cos(pitch) * r,
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(render);
}
render();
