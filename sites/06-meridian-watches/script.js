import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;

/* ------------------------------------------------------------------
   Calibre M-1: a watch built from primitives, stacked along local Z,
   that explodes apart as the page scrolls. The hands keep real time.
------------------------------------------------------------------ */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0c0a);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.2, 11);

const key = new THREE.SpotLight(0xffe8c4, 120, 0, Math.PI / 5, 0.4);
key.position.set(6, 8, 8);
scene.add(key);
const rimLight = new THREE.DirectionalLight(0x8fa3c9, 1.4);
rimLight.position.set(-6, -2, -6);
scene.add(rimLight);

/* materials */
const GOLD = new THREE.MeshStandardMaterial({ color: 0xd8bd8a, metalness: 1.0, roughness: 0.32 });
const GOLD_BRIGHT = new THREE.MeshStandardMaterial({ color: 0xe8cf9c, metalness: 1.0, roughness: 0.18 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x9aa2b0, metalness: 1.0, roughness: 0.28 });
const BLUED = new THREE.MeshStandardMaterial({ color: 0x2b4fd8, metalness: 0.9, roughness: 0.25 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x24211d, metalness: 0.8, roughness: 0.5 });
const DIAL = new THREE.MeshStandardMaterial({ color: 0xe6d3a3, metalness: 0.55, roughness: 0.38 });
const TUNGSTEN = new THREE.MeshStandardMaterial({ color: 0x4c4a46, metalness: 1.0, roughness: 0.4 });

/* the watch: layers stacked along Z (face toward +Z) */
const watch = new THREE.Group();
scene.add(watch);

const layers = []; // { group, assembledZ, explodedZ }
function addLayer(group, assembledZ, explodedZ) {
  group.position.z = assembledZ;
  watch.add(group);
  layers.push({ group, assembledZ, explodedZ });
  return group;
}

/* --- L5 caseback (deepest) --------------------------------------- */
{
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.62, 0.22, 64), STEEL);
  back.rotation.x = Math.PI / 2;
  g.add(back);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.05, 12, 64), DARK);
  g.add(ring);
  // engraving suggestion: shallow radial ticks
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.02), DARK);
    tick.position.set(Math.cos(a) * 2.42, Math.sin(a) * 2.42, 0.11);
    tick.rotation.z = a;
    g.add(tick);
  }
  addLayer(g, -0.55, -4.6);
}

/* --- L4 mainspring barrel + rotor -------------------------------- */
const rotorGroup = new THREE.Group();
{
  const g = new THREE.Group();
  // barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.3, 48), GOLD);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(-0.9, 0.7, 0);
  g.add(barrel);
  // visible mainspring spiral inside the barrel
  const spiralPts = [];
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const a = t * Math.PI * 10;
    const r = 0.12 + t * 0.8;
    spiralPts.push(new THREE.Vector3(-0.9 + Math.cos(a) * r, 0.7 + Math.sin(a) * r, 0.18));
  }
  const spiral = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPts), 220, 0.022, 6, false),
    BLUED
  );
  g.add(spiral);
  // tungsten winding rotor (half disc)
  const rotorShape = new THREE.Shape();
  rotorShape.absarc(0, 0, 1.9, -Math.PI * 0.08, Math.PI * 1.08, false);
  rotorShape.lineTo(0, 0);
  const rotorMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rotorShape, { depth: 0.09, bevelEnabled: false }),
    TUNGSTEN
  );
  const rotorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 24), GOLD_BRIGHT);
  rotorHub.rotation.x = Math.PI / 2;
  rotorGroup.add(rotorMesh, rotorHub);
  rotorGroup.position.z = 0.18;
  g.add(rotorGroup);
  addLayer(g, -0.32, -2.8);
}

/* --- L3 gear train ------------------------------------------------ */
const gears = []; // { mesh, speed }
function makeGear(radius, teeth, thickness, material) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 40), material);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const toothGeo = new THREE.BoxGeometry(radius * 0.16, radius * 0.22, thickness * 1.05);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const tooth = new THREE.Mesh(toothGeo, material);
    tooth.position.set(Math.cos(a) * radius * 1.06, Math.sin(a) * radius * 1.06, 0);
    tooth.rotation.z = a;
    g.add(tooth);
  }
  // spokes
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, thickness * 1.4, 16), material);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.75, radius * 0.09, thickness * 0.6), material);
    spoke.position.set(Math.cos(a) * radius * 0.45, Math.sin(a) * radius * 0.45, 0);
    spoke.rotation.z = a;
    g.add(spoke);
  }
  return g;
}
{
  const g = new THREE.Group();
  const specs = [
    { r: 0.95, teeth: 22, x: -1.0, y: -0.75, mat: GOLD_BRIGHT, speed: 0.25 },
    { r: 0.62, teeth: 16, x: 0.42, y: -1.0, mat: GOLD, speed: -0.62 },
    { r: 0.5, teeth: 14, x: 1.25, y: -0.2, mat: GOLD_BRIGHT, speed: 0.95 },
    { r: 0.36, teeth: 12, x: 1.05, y: 0.85, mat: STEEL, speed: -1.8 },
    { r: 0.28, teeth: 15, x: 0.15, y: 1.15, mat: STEEL, speed: 3.4 },
  ];
  specs.forEach((s) => {
    const gear = makeGear(s.r, s.teeth, 0.09, s.mat);
    gear.position.set(s.x, s.y, 0);
    g.add(gear);
    gears.push({ mesh: gear, speed: s.speed });
  });
  // main plate they sit on
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.08, 64), DARK);
  plate.rotation.x = Math.PI / 2;
  plate.position.z = -0.12;
  g.add(plate);
  addLayer(g, -0.1, -1.1);
}

/* --- L2 dial + hands ---------------------------------------------- */
const handHour = new THREE.Group();
const handMin = new THREE.Group();
const handSec = new THREE.Group();
{
  const g = new THREE.Group();
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.06, 64), DIAL);
  dial.rotation.x = Math.PI / 2;
  g.add(dial);
  // applied hour markers
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = i % 3 === 0 ? 0.34 : 0.22;
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.05), GOLD_BRIGHT);
    marker.position.set(Math.sin(a) * 1.95, Math.cos(a) * 1.95, 0.06);
    marker.rotation.z = -a;
    g.add(marker);
  }
  // minute track dots
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a = (i / 60) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8), DARK);
    dot.rotation.x = Math.PI / 2;
    dot.position.set(Math.sin(a) * 2.1, Math.cos(a) * 2.1, 0.05);
    g.add(dot);
  }
  // flame-blued hands (rotate around z; hand shape offset along +y)
  const hourMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.15, 0.04), BLUED);
  hourMesh.position.y = 0.5;
  handHour.add(hourMesh);
  handHour.position.z = 0.1;
  const minMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.75, 0.035), BLUED);
  minMesh.position.y = 0.78;
  handMin.add(minMesh);
  handMin.position.z = 0.15;
  const secMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.0, 0.02), GOLD_BRIGHT);
  secMesh.position.y = 0.7;
  handSec.add(secMesh);
  const counterweight = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16), GOLD_BRIGHT);
  counterweight.rotation.x = Math.PI / 2;
  counterweight.position.y = -0.35;
  handSec.add(counterweight);
  handSec.position.z = 0.19;
  const pinion = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 16), BLUED);
  pinion.rotation.x = Math.PI / 2;
  pinion.position.z = 0.12;
  g.add(handHour, handMin, handSec, pinion);
  addLayer(g, 0.12, 0.9);
}

/* --- L1 case + bezel ---------------------------------------------- */
{
  const g = new THREE.Group();
  const caseRing = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, 0.85, 64, 1, true), GOLD);
  caseRing.rotation.x = Math.PI / 2;
  g.add(caseRing);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.16, 24, 64), GOLD_BRIGHT);
  g.add(bezel);
  bezel.position.z = 0.38;
  // crown
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 24), GOLD_BRIGHT);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(2.95, 0, 0);
  g.add(crown);
  // lugs
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.5), GOLD);
      lug.position.set(sx * 1.7, sy * 2.75, -0.05);
      lug.rotation.z = sx * sy * -0.25;
      g.add(lug);
    }
  }
  addLayer(g, 0.1, 2.6);
}

/* --- L0 crystal (top) ---------------------------------------------- */
{
  const g = new THREE.Group();
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.02,
    transmission: isSmallScreen ? 0 : 0.96,
    transparent: true,
    opacity: isSmallScreen ? 0.12 : 1,
    thickness: 0.4,
    ior: 1.77,
    clearcoat: 1,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.28), crystalMat);
  dome.scale.set(0.78, 0.32, 0.78);
  dome.rotation.x = Math.PI / 2;
  dome.position.z = -0.5;
  g.add(dome);
  addLayer(g, 0.55, 4.4);
}

/* tilt the whole stack toward the viewer */
watch.rotation.x = -0.32;

/* ------------------------------------------------------------------
   Scroll → explosion; sections highlight; drag orbits
------------------------------------------------------------------ */
let scrollProgress = 0;
let explode = 0;

function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

const plates = document.querySelectorAll('.plate');
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in-view'); });
}, { threshold: 0.3 });
plates.forEach((p) => io.observe(p));

const gaugeFill = document.getElementById('gauge-fill');
const gaugeLabel = document.getElementById('gauge-label');
const GAUGE_WORDS = ['assembled', 'crystal off', 'dial exposed', 'train visible', 'barrel open', 'fully stripped'];
let lastGaugeIdx = -1;

/* drag to orbit */
let dragging = false, lastX = 0, lastY = 0;
let orbitY = 0, orbitX = 0, orbitVel = 0;
window.addEventListener('pointerdown', (e) => {
  if (e.target !== canvas) return;
  dragging = true; lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  orbitVel = (e.clientX - lastX) * 0.005;
  orbitY += orbitVel;
  orbitX = THREE.MathUtils.clamp(orbitX + (e.clientY - lastY) * 0.003, -0.5, 0.5);
  lastX = e.clientX; lastY = e.clientY;
  if (prefersReducedMotion) renderOnce();
});
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointercancel', () => { dragging = false; });

/* real time on the hands */
function setHands(nowDate) {
  const h = nowDate.getHours() % 12;
  const m = nowDate.getMinutes();
  const s = nowDate.getSeconds() + nowDate.getMilliseconds() / 1000;
  handSec.rotation.z = -(s / 60) * Math.PI * 2;
  handMin.rotation.z = -((m + s / 60) / 60) * Math.PI * 2;
  handHour.rotation.z = -((h + m / 60) / 12) * Math.PI * 2;
}

const clock = new THREE.Clock();

function composeFrame(t) {
  explode += (scrollProgress - explode) * 0.07;
  const e = explode * explode * (3 - 2 * explode);

  layers.forEach((l, i) => {
    // top layers lift first: stagger each layer's ease window
    const n = layers.length;
    const start = ((n - 1 - i) / n) * 0.35;
    const local = THREE.MathUtils.clamp((e - start) / (1 - 0.35), 0, 1);
    const le = local * local * (3 - 2 * local);
    l.group.position.z = THREE.MathUtils.lerp(l.assembledZ, l.explodedZ, le);
  });

  /* idle turn + drag orbit */
  if (!dragging) {
    orbitVel *= 0.95;
    orbitY += orbitVel + 0.0012;
  }
  watch.rotation.y = orbitY;
  watch.rotation.x = -0.32 + orbitX + e * 0.35; // pitch flatter when exploded

  /* mechanism life */
  setHands(new Date());
  gears.forEach((g) => { g.mesh.rotation.z = t * g.speed; });
  rotorGroup.rotation.z = Math.sin(t * 0.7) * 1.1;

  /* camera drifts back to fit the exploded stack */
  camera.position.z = 11 + e * 4.5;
  camera.position.y = 2.2 - e * 1.2;
  camera.lookAt(0, 0, 0);

  /* gauge */
  gaugeFill.style.height = `${explode * 100}%`;
  const idx = Math.min(GAUGE_WORDS.length - 1, Math.floor(explode * GAUGE_WORDS.length));
  if (idx !== lastGaugeIdx) { gaugeLabel.textContent = GAUGE_WORDS[idx]; lastGaugeIdx = idx; }

  renderer.render(scene, camera);
}

function tick() {
  composeFrame(clock.getElapsedTime());
  requestAnimationFrame(tick);
}

function renderOnce() {
  explode = 0.55;
  scrollProgress = 0.55;
  const e = explode;
  layers.forEach((l) => {
    l.group.position.z = THREE.MathUtils.lerp(l.assembledZ, l.explodedZ, e);
  });
  watch.rotation.y = orbitY + 0.5;
  watch.rotation.x = -0.32 + orbitX + e * 0.35;
  const tenNine = new Date();
  tenNine.setHours(10, 9, 30, 0);
  setHands(tenNine);
  camera.position.set(0, 2.2 - e * 1.2, 11 + e * 4.5);
  camera.lookAt(0, 0, 0);
  gaugeFill.style.height = '55%';
  gaugeLabel.textContent = 'exploded view';
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (prefersReducedMotion) renderOnce();
});

if (prefersReducedMotion) {
  renderOnce();
} else {
  tick();
}
