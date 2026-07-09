import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ============================================================
   VOLTAIC — a motorcycle from raw geometry
   No models are loaded. The SIGMA is assembled from ~60
   primitives: torus wheels with instanced spokes, a lofted
   frame of capsules, clearcoat body panels. It idles on a
   turntable; Sport mode spins the wheels up, floods the
   headlight, and streaks the air with light.
   ============================================================ */

const canvas = document.getElementById('showroom');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 780px)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d10);
scene.fog = new THREE.Fog(0x0b0d10, 14, 34);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 100);

/* ---------- materials ---------- */

const paint = new THREE.MeshPhysicalMaterial({
  color: 0xc8f549, metalness: 0.65, roughness: 0.32,
  clearcoat: 1, clearcoatRoughness: 0.12,
});
const dark = new THREE.MeshStandardMaterial({ color: 0x17191d, metalness: 0.4, roughness: 0.55 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, metalness: 1, roughness: 0.18 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x101114, metalness: 0, roughness: 0.92 });
const glow = new THREE.MeshBasicMaterial({ color: 0xc8f549 });
const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });

/* ---------- the bike ---------- */

const bike = new THREE.Group();
scene.add(bike);

function capsuleBetween(a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  bike.add(mesh);
  return mesh;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const WHEEL_R = 0.62;
const wheels = [];
function wheel(x) {
  const g = new THREE.Group();
  g.position.set(x, WHEEL_R, 0);
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.09, 0.11, 18, 44), rubber);
  g.add(tire);
  const rimOuter = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.19, 0.025, 10, 44), chrome);
  g.add(rimOuter);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 20), chrome);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  // five paired spokes
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    for (const off of [-0.02, 0.02]) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.035, WHEEL_R - 0.2, 0.02), dark);
      spoke.position.set(Math.cos(a) * (WHEEL_R - 0.2) / 2, Math.sin(a) * (WHEEL_R - 0.2) / 2, off);
      spoke.rotation.z = a - Math.PI / 2;
      g.add(spoke);
    }
  }
  // brake disc
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 32), chrome);
  disc.rotation.x = Math.PI / 2;
  disc.position.z = 0.08;
  g.add(disc);
  bike.add(g);
  wheels.push(g);
  return g;
}
wheel(-0.95);          // rear
wheel(0.98);           // front

/* frame spine */
capsuleBetween(V(-0.95, WHEEL_R, 0), V(-0.35, 0.98, 0), 0.05, dark);        // rear riser
capsuleBetween(V(-0.35, 0.98, 0), V(0.62, 0.88, 0), 0.055, dark);           // top tube
capsuleBetween(V(0.62, 0.88, 0), V(0.98, WHEEL_R, 0), 0.045, chrome);       // fork crown to axle
capsuleBetween(V(0.72, 0.96, 0), V(0.99, WHEEL_R + 0.02, 0.09), 0.028, chrome); // fork leg r
capsuleBetween(V(0.72, 0.96, 0), V(0.99, WHEEL_R + 0.02, -0.09), 0.028, chrome); // fork leg l
capsuleBetween(V(-0.95, WHEEL_R, 0.07), V(-0.15, 0.52, 0.07), 0.035, dark); // swingarm r
capsuleBetween(V(-0.95, WHEEL_R, -0.07), V(-0.15, 0.52, -0.07), 0.035, dark); // swingarm l

/* battery + motor mass — the visual heart */
const battery = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.5, 0.3), paint);
battery.position.set(0.08, 0.66, 0);
battery.rotation.z = -0.08;
bike.add(battery);
const batteryFin = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.06, 0.34), dark);
batteryFin.position.set(0.08, 0.47, 0);
batteryFin.rotation.z = -0.08;
bike.add(batteryFin);
const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 24), chrome);
motor.rotation.x = Math.PI / 2;
motor.position.set(-0.3, 0.48, 0);
bike.add(motor);
const motorGlowRing = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.012, 8, 32), glow);
motorGlowRing.position.copy(motor.position);
bike.add(motorGlowRing);

/* tank + seat + tail as one gesture */
const tank = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), paint);
tank.scale.set(1.25, 0.62, 0.62);
tank.position.set(0.32, 1.0, 0);
bike.add(tank);
const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.09, 0.26), rubber);
seat.position.set(-0.42, 0.99, 0);
seat.rotation.z = 0.04;
bike.add(seat);
const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 4), paint);
tail.rotation.z = Math.PI / 2 + 0.35;
tail.rotation.y = Math.PI / 4;
tail.position.set(-0.88, 1.04, 0);
bike.add(tail);
const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.14), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
tailLight.position.set(-1.05, 1.06, 0);
bike.add(tailLight);

/* bars + headlight */
capsuleBetween(V(0.66, 1.06, -0.3), V(0.66, 1.06, 0.3), 0.03, chrome);
capsuleBetween(V(0.62, 0.9, 0), V(0.66, 1.06, 0), 0.035, dark);
const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), lampMat);
lamp.scale.z = 0.5;
lamp.position.set(0.83, 0.98, 0);
bike.add(lamp);
const beam = new THREE.Mesh(
  new THREE.ConeGeometry(1.5, 6, 24, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }),
);
beam.rotation.z = Math.PI / 2;
beam.position.set(3.9, 0.85, 0);
bike.add(beam);

/* ---------- stage ---------- */

const plinth = new THREE.Mesh(
  new THREE.CylinderGeometry(2.1, 2.3, 0.14, 64),
  new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.6, roughness: 0.3 }),
);
plinth.position.y = -0.07;
scene.add(plinth);
const plinthRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.015, 8, 96), glow);
plinthRing.rotation.x = Math.PI / 2;
plinthRing.position.y = 0.005;
scene.add(plinthRing);

// floor: big dark disc catching reflections
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(16, 48),
  new THREE.MeshStandardMaterial({ color: 0x0c0e11, metalness: 0.85, roughness: 0.42 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.14;
scene.add(floor);

/* lights */
scene.add(new THREE.AmbientLight(0x30343c, 0.8));
const keyLight = new THREE.SpotLight(0xffffff, 320, 40, 0.55, 0.4, 2);
keyLight.position.set(6, 9, 4);
keyLight.target = bike;
scene.add(keyLight);
const voltLight = new THREE.PointLight(0xc8f549, 26, 12, 2);
voltLight.position.set(-3, 1.4, -3);
scene.add(voltLight);

/* speed streaks for sport mode */
const STREAKS = isMobile ? 40 : 90;
const streakGeo = new THREE.BufferGeometry();
{
  const p = new Float32Array(STREAKS * 6);
  for (let i = 0; i < STREAKS; i++) {
    const y = 0.2 + Math.random() * 2.2;
    const z = (Math.random() - 0.5) * 9;
    const x = (Math.random() - 0.5) * 22;
    p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z;
    p[i * 6 + 3] = x - 0.9; p[i * 6 + 4] = y; p[i * 6 + 5] = z;
  }
  streakGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const streakMat = new THREE.LineBasicMaterial({ color: 0xc8f549, transparent: true, opacity: 0 });
scene.add(new THREE.LineSegments(streakGeo, streakMat));

/* ---------- configuration ---------- */

const PAINTS = {
  volt: 0xc8f549, graphite: 0x3d4148, glacier: 0xd7e4ec, signal: 0xe04a2f,
};
document.querySelectorAll('.paint').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.paint').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    paint.color.set(PAINTS[b.dataset.paint]);
    glow.color.set(b.dataset.paint === 'graphite' || b.dataset.paint === 'glacier' ? 0xc8f549 : PAINTS[b.dataset.paint]);
    streakMat.color.copy(glow.color);
    voltLight.color.copy(glow.color);
  });
});

const MODES = {
  street: { range: '280 km', torque: '140 Nm', accel: '3.4 s', wheelSpin: 2.4, beam: 0.05, streak: 0, exposure: 1.05 },
  sport: { range: '190 km', torque: '190 Nm', accel: '2.7 s', wheelSpin: 14, beam: 0.14, streak: 0.5, exposure: 1.18 },
  rain: { range: '310 km', torque: '95 Nm', accel: '4.8 s', wheelSpin: 1.1, beam: 0.1, streak: 0.12, exposure: 0.92 },
};
let mode = MODES.street;
const sRange = document.getElementById('s-range');
const sTorque = document.getElementById('s-torque');
const sAccel = document.getElementById('s-accel');
const sMode = document.getElementById('s-mode');
document.querySelectorAll('.mode').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.mode').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    mode = MODES[b.dataset.mode];
    sRange.textContent = mode.range;
    sTorque.textContent = mode.torque;
    sAccel.textContent = mode.accel;
    sMode.textContent = b.dataset.mode.toUpperCase();
  });
});

/* ---------- orbit ---------- */

let yaw = 0.7, pitch = 0.28, dist = 5.6;
let yawGoal = yaw, pitchGoal = pitch, distGoal = dist;
let dragging = false, lx = 0, ly = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true; lx = e.clientX; ly = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yawGoal -= (e.clientX - lx) * 0.005;
  pitchGoal = THREE.MathUtils.clamp(pitchGoal + (e.clientY - ly) * 0.003, 0.06, 0.9);
  lx = e.clientX; ly = e.clientY;
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  distGoal = THREE.MathUtils.clamp(distGoal + e.deltaY * 0.004, 3.4, 10);
}, { passive: false });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- loop ---------- */

let wheelAngle = 0;
let beamOpacity = 0.05, streakOpacity = 0;
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (!reduceMotion) {
    if (!dragging) yawGoal += dt * 0.12;
    wheelAngle -= dt * mode.wheelSpin;
    for (const w of wheels) w.rotation.z = wheelAngle;
    // the machine breathes at idle
    bike.position.y = Math.sin(t * 1.4) * 0.008;
    motorGlowRing.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
  }

  beamOpacity += (mode.beam - beamOpacity) * 0.05;
  beam.material.opacity = beamOpacity;
  streakOpacity += (mode.streak - streakOpacity) * 0.04;
  streakMat.opacity = streakOpacity * (0.5 + Math.sin(t * 9) * 0.2);
  renderer.toneMappingExposure += (mode.exposure - renderer.toneMappingExposure) * 0.04;

  if (streakOpacity > 0.01 && !reduceMotion) {
    const p = streakGeo.attributes.position;
    for (let i = 0; i < STREAKS; i++) {
      let x = p.getX(i * 2) - dt * (14 + mode.wheelSpin);
      if (x < -11) x = 11;
      p.setX(i * 2, x);
      p.setX(i * 2 + 1, x - 0.9);
    }
    p.needsUpdate = true;
  }

  yaw += (yawGoal - yaw) * 0.07;
  pitch += (pitchGoal - pitch) * 0.07;
  dist += (distGoal - dist) * 0.07;
  camera.position.set(
    Math.sin(yaw) * Math.cos(pitch) * dist,
    0.9 + Math.sin(pitch) * dist,
    Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(0, 0.72, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
