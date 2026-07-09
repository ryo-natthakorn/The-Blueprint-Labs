import * as THREE from 'three';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;

/* ------------------------------------------------------------------
   A vessel thrown on the wheel as you scroll. One LatheGeometry whose
   profile morphs through six authored stages: lump → centered →
   opened → pulled → shaped → fired. The profile doubles back at the
   rim so the pot has real wall thickness and a visible interior.
------------------------------------------------------------------ */

const STAGE_NAMES = ['raw clay', 'centering', 'opening', 'pulling up', 'shaping', 'fired'];

// 12 control points per stage: bottom-center → outer wall → rim → inner wall → inner floor
const STAGE_PROFILES = [
  // 0 raw lump (reads solid: inner wall hugs the axis)
  [[0.02, 0], [0.95, 0.03], [1.55, 0.4], [1.72, 0.95], [1.38, 1.45], [0.85, 1.78], [0.32, 1.9], [0.16, 1.88], [0.1, 1.6], [0.07, 1.0], [0.05, 0.5], [0.02, 0.3]],
  // 1 centered dome
  [[0.02, 0], [1.0, 0.03], [1.42, 0.42], [1.48, 0.95], [1.22, 1.42], [0.78, 1.72], [0.3, 1.84], [0.15, 1.82], [0.1, 1.55], [0.07, 1.0], [0.05, 0.5], [0.02, 0.3]],
  // 2 opened bowl-blank
  [[0.02, 0], [1.12, 0.03], [1.46, 0.32], [1.52, 0.72], [1.48, 0.98], [1.44, 1.1], [1.28, 1.14], [1.12, 1.1], [1.04, 0.9], [0.98, 0.55], [0.85, 0.32], [0.02, 0.3]],
  // 3 pulled cylinder
  [[0.02, 0], [1.0, 0.03], [1.16, 0.45], [1.17, 1.3], [1.16, 2.1], [1.13, 2.55], [1.02, 2.62], [0.92, 2.58], [0.9, 2.3], [0.9, 1.3], [0.86, 0.42], [0.02, 0.3]],
  // 4 shaped vase (belly, neck, flared lip)
  [[0.02, 0], [0.88, 0.03], [1.32, 0.55], [1.56, 1.15], [1.28, 1.85], [0.78, 2.28], [0.92, 2.62], [0.78, 2.6], [0.62, 2.28], [0.98, 1.55], [0.82, 0.6], [0.02, 0.3]],
  // 5 fired — same form, holds through the glaze transition
  [[0.02, 0], [0.88, 0.03], [1.32, 0.55], [1.56, 1.15], [1.28, 1.85], [0.78, 2.28], [0.92, 2.62], [0.78, 2.6], [0.62, 2.28], [0.98, 1.55], [0.82, 0.6], [0.02, 0.3]],
];

const PROFILE_SAMPLES = 56;
const RADIAL_SEGMENTS = isSmallScreen ? 48 : 96;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !isSmallScreen;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 60);

/* lighting: warm studio window + soft fill */
scene.add(new THREE.HemisphereLight(0xfff6e8, 0xb0a288, 0.85));
const key = new THREE.DirectionalLight(0xffedd6, 1.6);
key.position.set(4, 6, 3);
key.castShadow = !isSmallScreen;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -4; key.shadow.camera.right = 4;
key.shadow.camera.top = 6; key.shadow.camera.bottom = -2;
scene.add(key);
const rim = new THREE.DirectionalLight(0x9db8a4, 0.5);
rim.position.set(-5, 3, -4);
scene.add(rim);

/* the wheel */
const wheelGroup = new THREE.Group();
scene.add(wheelGroup);

const wheelHead = new THREE.Mesh(
  new THREE.CylinderGeometry(2.4, 2.55, 0.22, 64),
  new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.65, metalness: 0.1 })
);
wheelHead.position.y = -0.13;
wheelHead.receiveShadow = true;
wheelGroup.add(wheelHead);

const bat = new THREE.Mesh(
  new THREE.CylinderGeometry(1.95, 1.95, 0.08, 64),
  new THREE.MeshStandardMaterial({ color: 0x8a7a63, roughness: 0.9 })
);
bat.position.y = 0.04;
bat.receiveShadow = true;
wheelGroup.add(bat);

/* soft ground shadow-catcher */
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(9, 48),
  new THREE.ShadowMaterial({ opacity: 0.14 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.24;
ground.receiveShadow = true;
scene.add(ground);

/* the vessel: lathe rebuilt in place each frame */
const CLAY = new THREE.Color('#a9744f');
const CLAY_WET = new THREE.Color('#8d5f42');
const CELADON = new THREE.Color('#9db8a4');

const vesselMaterial = new THREE.MeshStandardMaterial({
  color: CLAY_WET.clone(),
  roughness: 0.95,
  metalness: 0.0,
  side: THREE.DoubleSide,
});

function sampleProfile(controls) {
  const curve = new THREE.CatmullRomCurve3(
    controls.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false, 'catmullrom', 0.5
  );
  return curve.getPoints(PROFILE_SAMPLES - 1).map((p) => new THREE.Vector2(Math.max(p.x, 0.015), p.y));
}

const stageProfiles = STAGE_PROFILES.map(sampleProfile);

const initialProfile = stageProfiles[0];
const vesselGeometry = new THREE.LatheGeometry(initialProfile, RADIAL_SEGMENTS);
const vessel = new THREE.Mesh(vesselGeometry, vesselMaterial);
vessel.castShadow = !isSmallScreen;
vessel.receiveShadow = true;
wheelGroup.add(vessel);

const posAttr = vesselGeometry.getAttribute('position');
const vertsPerRing = PROFILE_SAMPLES; // lathe layout: (segments+1) rings of profile points

const workProfile = initialProfile.map((p) => p.clone());

function updateVessel(stageFloat, time, wobbleAmp) {
  const i = Math.min(Math.floor(stageFloat), STAGE_PROFILES.length - 2);
  const fRaw = stageFloat - i;
  const f = fRaw * fRaw * (3 - 2 * fRaw); // smoothstep
  const a = stageProfiles[i];
  const b = stageProfiles[i + 1];

  for (let p = 0; p < PROFILE_SAMPLES; p++) {
    workProfile[p].x = a[p].x + (b[p].x - a[p].x) * f;
    workProfile[p].y = a[p].y + (b[p].y - a[p].y) * f;
  }

  // rewrite lathe positions ring by ring
  for (let seg = 0; seg <= RADIAL_SEGMENTS; seg++) {
    const theta = (seg / RADIAL_SEGMENTS) * Math.PI * 2;
    // off-center wobble before the clay is centered
    const wob = 1 + wobbleAmp * Math.sin(theta * 2 + time * 9) * 0.5
              + wobbleAmp * Math.sin(theta * 3 - time * 13) * 0.5;
    const sin = Math.sin(theta), cos = Math.cos(theta);
    for (let p = 0; p < PROFILE_SAMPLES; p++) {
      const idx = (seg * vertsPerRing + p) * 3;
      const r = workProfile[p].x * wob;
      posAttr.array[idx] = r * sin;
      posAttr.array[idx + 1] = workProfile[p].y;
      posAttr.array[idx + 2] = r * cos;
    }
  }
  posAttr.needsUpdate = true;
  vesselGeometry.computeVertexNormals();
}

/* ------------------------------------------------------------------
   Scroll choreography
------------------------------------------------------------------ */
const stageName = document.getElementById('stage-name');
const progressFill = document.getElementById('progress-fill');
let scrollProgress = 0;
let displayedProgress = 0;
let lastStageShown = -1;

function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

/* text reveal */
const panels = document.querySelectorAll('.panel');
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in-view'); });
}, { threshold: 0.35 });
panels.forEach((p) => io.observe(p));

/* drag-to-rotate (matters most on the fired vessel, works anywhere) */
let dragging = false;
let dragVelocity = 0;
let lastX = 0;
canvas.style.touchAction = 'pan-y';
window.addEventListener('pointerdown', (e) => {
  if (e.target !== canvas && !e.target.closest('.wheel-stage')) return;
  dragging = true;
  lastX = e.clientX;
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  dragVelocity = dx * 0.006;
  wheelGroup.rotation.y += dragVelocity;
});
window.addEventListener('pointerup', () => { dragging = false; });

/* ------------------------------------------------------------------
   Loop
------------------------------------------------------------------ */
const clock = new THREE.Clock();
const lookTarget = new THREE.Vector3(0, 1, 0);
let elapsed = 0;

function composeFrame(t, dt) {
  displayedProgress += (scrollProgress - displayedProgress) * 0.07;
  const stageFloat = displayedProgress * (STAGE_PROFILES.length - 1); // 0..5

  // wobble: strong at raw clay, gone once centered
  const wobbleAmp = Math.max(0, 1 - stageFloat / 1.2) * 0.16;

  // wheel spin: fast while throwing, coasts to rest when fired
  const throwing = THREE.MathUtils.clamp(1 - (stageFloat - 4) / 0.8, 0, 1);
  if (!dragging) {
    wheelGroup.rotation.y += (2.9 * throwing + 0.06) * dt + dragVelocity;
    dragVelocity *= 0.94;
  }

  updateVessel(stageFloat, t, wobbleAmp);

  // wet slip sheen while throwing → bisque matte → celadon glaze
  const glaze = THREE.MathUtils.clamp(stageFloat - 4, 0, 1);
  vesselMaterial.color.copy(CLAY_WET).lerp(CLAY, Math.min(glaze * 2, 1)).lerp(CELADON, glaze);
  vesselMaterial.roughness = 0.6 + Math.min(glaze * 2, 1) * 0.35 - glaze * 0.55;

  // camera: pull back and rise as the pot grows
  let rimHeight = 0;
  for (let p = 0; p < PROFILE_SAMPLES; p++) if (workProfile[p].y > rimHeight) rimHeight = workProfile[p].y;
  camera.position.set(
    Math.sin(0.4 + displayedProgress * 0.5) * 6.8,
    1.6 + rimHeight * 0.45,
    Math.cos(0.4 + displayedProgress * 0.5) * 6.8
  );
  lookTarget.set(0, rimHeight * 0.45, 0);
  camera.lookAt(lookTarget);

  // HUD
  progressFill.style.height = `${displayedProgress * 100}%`;
  const stageIdx = Math.min(Math.round(stageFloat), 5);
  if (stageIdx !== lastStageShown) {
    stageName.textContent = STAGE_NAMES[stageIdx];
    lastStageShown = stageIdx;
  }

  renderer.render(scene, camera);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  composeFrame(elapsed, dt);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (prefersReducedMotion) renderReduced();
});

/* Reduced motion: the finished, glazed vessel as a still — scroll and
   drag still reposition it, but nothing animates on its own. */
function renderReduced() {
  updateVessel(4.999, 0, 0);
  vesselMaterial.color.copy(CELADON);
  vesselMaterial.roughness = 0.4;
  camera.position.set(4.2, 2.9, 5.4);
  camera.lookAt(0, 1.2, 0);
  renderer.render(scene, camera);
}

if (prefersReducedMotion) {
  renderReduced();
  window.addEventListener('pointermove', () => { if (dragging) renderReduced(); });
} else {
  tick();
}
