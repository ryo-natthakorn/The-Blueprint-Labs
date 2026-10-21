import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
const isCoarse = window.matchMedia('(pointer: coarse)').matches;
const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
const HIGH = !(isSmallScreen || isCoarse || lowPower);

/* ------------------------------------------------------------------
   One vessel, thrown as you scroll. A LatheGeometry whose profile
   morphs through authored stages: lump → centered → opened → pulled
   → shaped → fired (shrunk by a tenth) → finished. The profile
   doubles back at the rim so the pot has real wall thickness and a
   visible interior.
------------------------------------------------------------------ */

const STAGE_NAMES = ['raw clay', 'centering', 'opening', 'pulling up', 'shaping', 'firing', 'finished'];

// 12 control points per stage: bottom-centre → outer wall → rim → inner wall → inner floor
const SHAPED = [[0.02, 0], [0.88, 0.03], [1.32, 0.55], [1.56, 1.15], [1.28, 1.85], [0.78, 2.28], [0.92, 2.62], [0.78, 2.6], [0.62, 2.28], [0.98, 1.55], [0.82, 0.6], [0.02, 0.3]];
const FIRED = SHAPED.map(([x, y]) => [x * 0.9, y * 0.9]);   // stoneware shrinks ~10% in the kiln
const STAGE_PROFILES = [
  [[0.02, 0], [0.95, 0.03], [1.55, 0.4], [1.72, 0.95], [1.38, 1.45], [0.85, 1.78], [0.32, 1.9], [0.16, 1.88], [0.1, 1.6], [0.07, 1.0], [0.05, 0.5], [0.02, 0.3]],
  [[0.02, 0], [1.0, 0.03], [1.42, 0.42], [1.48, 0.95], [1.22, 1.42], [0.78, 1.72], [0.3, 1.84], [0.15, 1.82], [0.1, 1.55], [0.07, 1.0], [0.05, 0.5], [0.02, 0.3]],
  [[0.02, 0], [1.12, 0.03], [1.46, 0.32], [1.52, 0.72], [1.48, 0.98], [1.44, 1.1], [1.28, 1.14], [1.12, 1.1], [1.04, 0.9], [0.98, 0.55], [0.85, 0.32], [0.02, 0.3]],
  [[0.02, 0], [1.0, 0.03], [1.16, 0.45], [1.17, 1.3], [1.16, 2.1], [1.13, 2.55], [1.02, 2.62], [0.92, 2.58], [0.9, 2.3], [0.9, 1.3], [0.86, 0.42], [0.02, 0.3]],
  SHAPED,
  FIRED,
  FIRED,
];
const LAST = STAGE_PROFILES.length - 1;

const PROFILE_SAMPLES = 72;
const RADIAL_SEGMENTS = HIGH ? 128 : 64;

const canvas = document.getElementById('scene');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  renderer = null;
}

/* ------------------------------------------------------------------
   Procedural textures, drawn once on canvases
------------------------------------------------------------------ */
const RING_FREQ = 52;        // throwing rings along the lathe profile (v)

function ringValue(u, v) {
  // a shallow spiral: one turn of the wheel per ring, like a real pull
  const a = Math.sin((v * RING_FREQ + u) * Math.PI * 2);
  const b = Math.sin((v * RING_FREQ * 0.43 + u) * Math.PI * 2 + 1.7);
  const c = Math.sin((v * RING_FREQ * 2.1 + u * 2) * Math.PI * 2 + 0.4);
  return 0.5 + 0.26 * a + 0.14 * b + 0.06 * c;
}

function makeRingTexture() {
  const W = 256, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = ringValue(x / W, 1 - y / H) + (Math.random() - 0.5) * 0.08;
      const g = Math.max(0, Math.min(255, v * 255));
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function makeSpeckleTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  // soft mottling
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() < 0.5;
    g.addColorStop(0, dark ? 'rgba(120,90,70,0.10)' : 'rgba(255,245,230,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // iron speckle and light grog
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = Math.random() < 0.9 ? 0.6 + Math.random() * 1.2 : 1.6 + Math.random() * 1.8;
    ctx.fillStyle = Math.random() < 0.7 ? `rgba(60,36,22,${0.35 + Math.random() * 0.4})` : `rgba(255,240,220,${0.4 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  t.anisotropy = 4;
  return t;
}

function makeGlazeTexture() {
  const W = 512, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const light = [158, 190, 172], deep = [92, 138, 121];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // glaze runs thin on ridges and pools deep in the grooves
      const r = ringValue(x / W, 1 - y / H);
      const k = Math.pow(1 - r, 1.5) * 0.7 + (Math.random() - 0.5) * 0.04;
      const i = (y * W + x) * 4;
      img.data[i] = light[0] + (deep[0] - light[0]) * k;
      img.data[i + 1] = light[1] + (deep[1] - light[1]) * k;
      img.data[i + 2] = light[2] + (deep[2] - light[2]) * k;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // crazing: fine fractured lines in the glass
  ctx.strokeStyle = 'rgba(48,74,64,0.13)';
  ctx.lineWidth = 0.55;
  for (let n = 0; n < 420; n++) {
    let x = Math.random() * W, y = Math.random() * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let ang = Math.random() * Math.PI * 2;
    const steps = 3 + Math.floor(Math.random() * 6);
    for (let s = 0; s < steps; s++) {
      ang += (Math.random() - 0.5) * 1.6;
      const len = 4 + Math.random() * 12;
      x += Math.cos(ang) * len;
      y += Math.sin(ang) * len * 2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function makeRadialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWheelTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8b8078';
  ctx.fillRect(0, 0, S, S);
  // machined concentric rings
  for (let r = 4; r < S / 2; r += 2) {
    ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,250,245' : '40,32,26'},${0.04 + Math.random() * 0.07})`;
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // dried slip smears
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, rr = 60 + Math.random() * 180;
    ctx.strokeStyle = `rgba(150,105,78,${0.08 + Math.random() * 0.12})`;
    ctx.lineWidth = 2 + Math.random() * 6;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, rr, a, a + 0.3 + Math.random() * 1.2);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------------
   Scene
------------------------------------------------------------------ */
let scene, camera, spinGroup, vessel, vesselGeometry, vesselMaterial, glazeUniforms;
let wheelParts = [], shelfParts = [], plinthParts = [], slip, contact, catcher, droplets, embers, rib, key;
let posAttr, workProfile, stageProfiles;
const lookTarget = new THREE.Vector3();

const CLAY_WET = new THREE.Color('#5f3b2a');
const CLAY = new THREE.Color('#87573a');
const LEATHER = new THREE.Color('#a2765a');
const BISQUE = new THREE.Color('#d9bca1');
const HEAT_DULL = new THREE.Color('#7a1804');
const HEAT_ORANGE = new THREE.Color('#ff5a12');
const HEAT_WHITE = new THREE.Color('#ffb35c');

function sampleProfile(controls) {
  const curve = new THREE.CatmullRomCurve3(controls.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'catmullrom', 0.5);
  return curve.getPoints(PROFILE_SAMPLES - 1).map((p) => new THREE.Vector2(Math.max(p.x, 0.015), p.y));
}

function fadeable(mesh) {
  mesh.material.transparent = true;
  mesh.userData.baseOpacity = mesh.material.opacity;
  return mesh;
}

function initScene() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, HIGH ? 2 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = HIGH;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 80);

  // warm window key + cool fill
  key = new THREE.DirectionalLight(0xffe7cc, 2.1);
  key.position.set(4.5, 7, 3.5);
  key.castShadow = HIGH;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -4; key.shadow.camera.right = 4;
  key.shadow.camera.top = 5; key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc7d6e0, 0.45);
  fill.position.set(-5, 2.5, -2);
  scene.add(fill);

  spinGroup = new THREE.Group();
  scene.add(spinGroup);

  /* -- wheel: head, bat, splash pan, base -- */
  const wheelTex = makeWheelTexture();
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.06, 0.18, 96),
    [new THREE.MeshStandardMaterial({ color: 0x5e554e, roughness: 0.55, metalness: 0.55 }),
      new THREE.MeshStandardMaterial({ map: wheelTex, roughness: 0.45, metalness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0x3e3832, roughness: 0.6, metalness: 0.5 })]
  );
  head.position.y = -0.12;
  head.receiveShadow = true;
  head.castShadow = HIGH;
  spinGroup.add(head);

  const batTex = makeSpeckleTexture();
  const bat = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.7, 0.06, 96),
    new THREE.MeshStandardMaterial({ color: 0x9a8064, map: batTex, roughness: 0.92 })
  );
  bat.position.y = 0.0;
  bat.receiveShadow = true;
  spinGroup.add(bat);

  // splash pan: a lathed basin around the head (static)
  const panProfile = [[2.12, -0.5], [2.6, -0.5], [2.72, -0.42], [2.78, 0.05], [2.86, 0.12], [2.9, 0.08], [2.84, -0.48], [2.7, -0.62], [2.1, -0.62]]
    .map(([r, h]) => new THREE.Vector2(r, h));
  const pan = new THREE.Mesh(
    new THREE.LatheGeometry(panProfile, 96),
    new THREE.MeshPhysicalMaterial({ color: 0x77706a, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.4, side: THREE.DoubleSide })
  );
  pan.receiveShadow = true;
  pan.castShadow = HIGH;
  scene.add(pan);
  const panFloor = new THREE.Mesh(
    new THREE.RingGeometry(2.06, 2.75, 96),
    new THREE.MeshStandardMaterial({ color: 0x6b5446, roughness: 0.85, map: batTex })
  );
  panFloor.rotation.x = -Math.PI / 2;
  panFloor.position.y = -0.49;
  panFloor.receiveShadow = true;
  scene.add(panFloor);
  wheelParts = [head, bat, pan, panFloor].map((m) => {
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => { mat.transparent = true; });
    m.userData.y0 = m.position.y;
    return m;
  });

  // slip puddle on the bat while throwing
  slip = new THREE.Mesh(
    new THREE.CircleGeometry(1.68, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0x5d3a28, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true,
      alphaMap: makeRadialTexture([[0, '#000'], [0.48, '#000'], [0.55, '#fff'], [0.86, '#bbb'], [1, '#000']]),
    })
  );
  slip.rotation.x = -Math.PI / 2;
  slip.position.y = 0.032;
  spinGroup.add(slip);

  /* -- kiln shelf: refractory slab on three posts -- */
  const refractory = new THREE.MeshStandardMaterial({ color: 0x6d5a4d, roughness: 0.95, map: batTex, transparent: true, opacity: 0 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 3.2), refractory);
  slab.position.y = -0.08;
  slab.receiveShadow = true;
  scene.add(slab);
  shelfParts.push(slab);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 16), refractory);
    post.position.set(Math.cos(a) * 1.7, -0.76, Math.sin(a) * 1.25);
    scene.add(post);
    shelfParts.push(post);
  }

  /* -- gallery plinth for the finished piece -- */
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 2.6, 96),
    new THREE.MeshStandardMaterial({ color: 0xf1ebe1, roughness: 0.9, transparent: true, opacity: 0 })
  );
  plinth.position.y = -1.32;
  plinth.receiveShadow = true;
  plinth.userData.y0 = plinth.position.y;
  scene.add(plinth);
  plinthParts.push(plinth);

  /* -- soft contact shadow under everything (all tiers) -- */
  contact = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({
      map: makeRadialTexture([[0, 'rgba(58,42,30,0.55)'], [0.35, 'rgba(58,42,30,0.28)'], [0.7, 'rgba(58,42,30,0.06)'], [1, 'rgba(58,42,30,0)']]),
      transparent: true, depthWrite: false,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -0.64;
  scene.add(contact);
  if (HIGH) {
    catcher = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.12 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = -0.63;
    catcher.receiveShadow = true;
    scene.add(catcher);
  }

  /* -- the vessel -- */
  stageProfiles = STAGE_PROFILES.map(sampleProfile);
  workProfile = stageProfiles[0].map((p) => p.clone());
  vesselGeometry = new THREE.LatheGeometry(workProfile, RADIAL_SEGMENTS);
  posAttr = vesselGeometry.getAttribute('position');

  const ringTex = makeRingTexture();
  const glazeTex = makeGlazeTexture();
  glazeUniforms = { uGlazeMap: { value: glazeTex }, uGlaze: { value: 0 }, uWet: { value: 1 } };
  const speckle = makeSpeckleTexture();
  vesselMaterial = new THREE.MeshPhysicalMaterial({
    color: CLAY_WET.clone(),
    map: speckle,
    emissiveMap: speckle,
    bumpMap: ringTex,
    bumpScale: 0,
    roughness: 0.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    sheen: 0.25,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color('#ffe2c8'),
    side: THREE.DoubleSide,
  });
  // clay → glaze crossfade, done in the map stage so lighting stays physical
  vesselMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, glazeUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D uGlazeMap;\nuniform float uGlaze;\nuniform float uWet;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 clayTex = texture2D( map, vMapUv );
          vec4 glazeTex = texture2D( uGlazeMap, vBumpMapUv );
          vec3 clay = diffuseColor.rgb * mix(vec3(1.0), clayTex.rgb, 1.0 - uWet * 0.6);
          diffuseColor.rgb = mix( clay, glazeTex.rgb, uGlaze );
        #endif
      `);
  };
  vessel = new THREE.Mesh(vesselGeometry, vesselMaterial);
  vessel.castShadow = HIGH;
  vessel.receiveShadow = HIGH;
  spinGroup.add(vessel);

  /* -- a wooden kidney rib, pressed to the belly while shaping -- */
  const kidney = new THREE.Shape();
  kidney.moveTo(0, -0.42);
  kidney.bezierCurveTo(0.34, -0.42, 0.52, -0.18, 0.5, 0.02);
  kidney.bezierCurveTo(0.48, 0.24, 0.3, 0.44, 0.02, 0.44);
  kidney.bezierCurveTo(-0.16, 0.44, -0.12, 0.16, -0.04, 0.0);
  kidney.bezierCurveTo(0.03, -0.16, -0.2, -0.42, 0, -0.42);
  const ribGeo = new THREE.ExtrudeGeometry(kidney, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 24 });
  ribGeo.translate(0, 0, -0.0175);
  rib = new THREE.Mesh(ribGeo, new THREE.MeshPhysicalMaterial({ color: 0xb48654, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5, map: makeSpeckleTexture(), transparent: true, opacity: 0 }));
  rib.castShadow = HIGH;
  rib.visible = false;
  scene.add(rib);

  /* -- embers in the kiln -- */
  const EMBERS = HIGH ? 160 : 70;
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMBERS * 3).fill(-99), 3));
  embers = new THREE.Points(eg, new THREE.PointsMaterial({
    color: 0xffa04a, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false,
    map: makeRadialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,230,180,0.8)'], [1, 'rgba(255,200,120,0)']], 64),
  }));
  embers.userData.seed = Float32Array.from({ length: EMBERS * 4 }, () => Math.random());
  embers.frustumCulled = false;
  scene.add(embers);

  /* -- slip droplets flung off the rim -- */
  const DROPS = HIGH ? 220 : 90;
  const dg = new THREE.BufferGeometry();
  const dp = new Float32Array(DROPS * 3).fill(-99);
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  droplets = new THREE.Points(dg, new THREE.PointsMaterial({
    color: 0x5a3626, size: 0.075, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false,
    map: makeRadialTexture([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']], 64),
  }));
  droplets.userData.vel = new Float32Array(DROPS * 3);
  droplets.userData.life = new Float32Array(DROPS);
  droplets.frustumCulled = false;
  scene.add(droplets);

  applyLayout();
}

/* ------------------------------------------------------------------
   Vessel rebuild per frame
------------------------------------------------------------------ */
const smooth = (x) => x * x * (3 - 2 * x);
const smoothstep = (a, b, x) => smooth(THREE.MathUtils.clamp((x - a) / (b - a), 0, 1));

function updateVessel(stageFloat, time, wobbleAmp, pull) {
  const i = Math.min(Math.floor(stageFloat), LAST - 1);
  const f = smooth(THREE.MathUtils.clamp(stageFloat - i, 0, 1));
  const a = stageProfiles[i];
  const b = stageProfiles[i + 1];
  let rimY = 0;
  for (let p = 0; p < PROFILE_SAMPLES; p++) {
    workProfile[p].x = a[p].x + (b[p].x - a[p].x) * f;
    workProfile[p].y = a[p].y + (b[p].y - a[p].y) * f;
    if (workProfile[p].y > rimY) rimY = workProfile[p].y;
  }
  // the pull: a travelling pinch climbs the outer wall while pulling up
  if (pull.amount > 0) {
    const yPinch = pull.phase * rimY;
    for (let p = 0; p < PROFILE_SAMPLES * 0.55; p++) {
      const d = (workProfile[p].y - yPinch) / 0.22;
      workProfile[p].x -= Math.exp(-d * d) * 0.06 * pull.amount;
    }
  }

  for (let seg = 0; seg <= RADIAL_SEGMENTS; seg++) {
    const theta = (seg / RADIAL_SEGMENTS) * Math.PI * 2;
    const wob = 1 + wobbleAmp * (Math.sin(theta * 2 + time * 9) * 0.5 + Math.sin(theta * 3 - time * 13) * 0.5);
    const sin = Math.sin(theta), cos = Math.cos(theta);
    for (let p = 0; p < PROFILE_SAMPLES; p++) {
      const idx = (seg * PROFILE_SAMPLES + p) * 3;
      const r = workProfile[p].x * wob;
      posAttr.array[idx] = r * sin;
      posAttr.array[idx + 1] = workProfile[p].y;
      posAttr.array[idx + 2] = r * cos;
    }
  }
  posAttr.needsUpdate = true;
  vesselGeometry.computeVertexNormals();
  return rimY;
}

/* ------------------------------------------------------------------
   Layout: the pot lives beside the copy, never under it
------------------------------------------------------------------ */
const view = { portrait: false, shiftX: 0, shiftY: 0, fitW: 6.2, fitH: 4.6 };

function applyLayout() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  view.portrait = w / h < 0.9 || w <= 720;
  if (view.portrait) {
    view.shiftX = 0;
    view.shiftY = h * 0.2;     // pot in the upper part, copy card below
    view.fracW = 0.94;
    view.fracH = 0.5;
  } else {
    view.shiftX = w * 0.155;   // pot in the right half, clear of the progress rail
    view.shiftY = h * 0.02;
    view.fracW = 0.52;
    view.fracH = 0.78;
  }
  camera.setViewOffset(w, h, -view.shiftX, view.shiftY, w, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

/* ------------------------------------------------------------------
   Scroll, drag, HUD
------------------------------------------------------------------ */
const steps = [...document.querySelectorAll('#progress-steps li')];
const tempEl = document.getElementById('temp');
const dragHint = document.getElementById('drag-hint');
const rootStyle = document.documentElement.style;
let scrollProgress = 0;
let shown = prefersReducedMotion ? -1 : 0;
let lastStage = -1;

function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = max > 0 ? THREE.MathUtils.clamp(window.scrollY / max, 0, 1) : 0;
  if (prefersReducedMotion) requestStill();
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

// Copy fades in as it arrives and out as it leaves, so a departing card
// never sits over the pot (phones keep it to the lower part of the screen).
const panels = document.querySelectorAll('.panel');
const portraitQuery = window.matchMedia('(max-width: 720px), (max-aspect-ratio: 9/10)');
let io = null;
function observePanels() {
  io?.disconnect();
  io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.closest('.panel').classList.toggle('in-view', e.isIntersecting));
  }, { rootMargin: portraitQuery.matches ? '-42% 0px 0px 0px' : '-12% 0px -12% 0px', threshold: 0.15 });
  panels.forEach((p) => io.observe(p.querySelector('.panel-card')));
}
observePanels();
portraitQuery.addEventListener('change', observePanels);

let dragging = false;
let dragVel = 0;
let dragged = false;
let lastX = 0;
let spin = 0;
canvas.style.touchAction = 'pan-y';
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  canvas.setPointerCapture?.(e.pointerId);
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  dragVel = dx * 0.0065;
  spin += dragVel;
  if (Math.abs(dx) > 2 && !dragged) {
    dragged = true;
    document.body.classList.add('has-dragged');
  }
  if (prefersReducedMotion) requestStill();
});
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointercancel', () => { dragging = false; });

function formatTemp(c) {
  return `${Math.round(c / 10) * 10}°C`;
}

/* ------------------------------------------------------------------
   Frame
------------------------------------------------------------------ */
const clock = new THREE.Clock();
let elapsed = 0;
const tmpColor = new THREE.Color();

let stillFrame = false;
function setOpacity(meshes, k) {
  if (stillFrame) k = k > 0.5 ? 1 : 0;   // stills never show a half-faded set piece
  meshes.forEach((m) => {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => { mat.opacity = k; mat.depthWrite = k > 0.98; });
    m.visible = k > 0.01;
  });
}

function spawnDroplets(dt, speed, rimY, rimR) {
  const pos = droplets.geometry.attributes.position.array;
  const vel = droplets.userData.vel;
  const life = droplets.userData.life;
  const n = life.length;
  const rate = speed * (HIGH ? 60 : 26);
  let toSpawn = rate * dt + (Math.random() < (rate * dt) % 1 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    if (life[i] > 0) {
      life[i] -= dt;
      vel[i * 3 + 1] -= 9.8 * dt * 0.6;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < -0.45) life[i] = 0;
      if (life[i] <= 0) pos[i * 3 + 1] = -99;
    } else if (toSpawn >= 1) {
      toSpawn--;
      const a = Math.random() * Math.PI * 2;
      const y = 0.15 + Math.random() * rimY * 0.85;
      const r = rimR * (0.85 + Math.random() * 0.2);
      pos[i * 3] = Math.sin(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.cos(a) * r;
      // tangential fling (the wheel turns counter-clockwise seen from above)
      const sp = 1.6 + Math.random() * 1.8;
      vel[i * 3] = Math.cos(a) * sp + Math.sin(a) * 0.6;
      vel[i * 3 + 1] = 0.6 + Math.random() * 1.2;
      vel[i * 3 + 2] = -Math.sin(a) * sp + Math.cos(a) * 0.6;
      life[i] = 0.5 + Math.random() * 0.6;
    }
  }
  droplets.geometry.attributes.position.needsUpdate = true;
}

function composeFrame(t, dt, still) {
  stillFrame = still;
  if (still) shown = scrollProgress;
  else shown += (scrollProgress - shown) * (1 - Math.exp(-dt * 4.2));
  const stage = shown * LAST;                                 // 0..6

  const throwing = 1 - smoothstep(3.9, 4.45, stage);          // wheel under power
  const wobbleAmp = still ? 0 : Math.max(0, 1 - stage / 1.2) * 0.15;
  const pullAmt = still ? 0 : Math.max(0, 1 - Math.abs(stage - 2.85) / 0.6);
  const pullPhase = ((stage - 2.25) * 2.4) % 1;               // three pulls across the stage

  // wheel speed; coasts to rest, then the plinth turns slowly for display
  const display = smoothstep(5.4, 5.9, stage);
  if (!dragging && !still) {
    spin += (3.2 * throwing + 0.18 * display) * dt + dragVel;
    dragVel *= Math.exp(-dt * 3.5);
  }
  spinGroup.rotation.y = spin;

  const rimY = updateVessel(stage, t, wobbleAmp, { amount: pullAmt, phase: pullPhase < 0 ? pullPhase + 1 : pullPhase });
  let rimR = 0;
  for (let p = 0; p < PROFILE_SAMPLES * 0.6; p++) rimR = Math.max(rimR, workProfile[p].x);

  /* surface: wet slip → leather-hard → bisque → (kiln heat) → celadon */
  const dry = smoothstep(4.0, 4.5, stage);
  const bisque = smoothstep(4.45, 4.85, stage);
  const heat = Math.max(0, 1 - Math.abs(stage - 5.0) / 0.48);
  const heatK = smooth(heat);
  const glaze = smoothstep(5.2, 5.75, stage);
  const rings = smoothstep(2.2, 3.4, stage);

  tmpColor.copy(CLAY_WET).lerp(CLAY, smoothstep(0.2, 1.5, stage) * 0.5).lerp(LEATHER, dry).lerp(BISQUE, bisque);
  vesselMaterial.color.copy(tmpColor);
  glazeUniforms.uGlaze.value = glaze;
  glazeUniforms.uWet.value = 1 - dry;
  vesselMaterial.bumpScale = (0.04 + rings * 0.9) * (1 - glaze * 0.5);
  vesselMaterial.roughness = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.42, 0.9, dry), 0.16, glaze);
  vesselMaterial.clearcoat = THREE.MathUtils.lerp(0.75 * (1 - dry), 1.0, glaze);
  vesselMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.32, 0.06, glaze);
  vesselMaterial.sheen = 0.25 * (1 - glaze);
  // kiln glow from within: dull red → orange → white-yellow
  if (heatK > 0.001) {
    tmpColor.copy(HEAT_DULL).lerp(HEAT_ORANGE, smoothstep(0.15, 0.6, heatK)).lerp(HEAT_WHITE, smoothstep(0.65, 1, heatK));
    vesselMaterial.emissive.copy(tmpColor);
    vesselMaterial.emissiveIntensity = heatK * 1.45;
  } else {
    vesselMaterial.emissiveIntensity = 0;
  }

  /* set pieces */
  // the wheel sinks away, the kiln shelf fades in, the plinth rises for the finished piece
  const wheelOut = smoothstep(4.25, 4.6, stage);
  // slides down opaque like a stage lift, and only fades once it is nearly out of frame
  setOpacity(wheelParts, 1 - smoothstep(0.6, 0.95, wheelOut));
  const wheelDrop = still ? (wheelOut > 0.5 ? 1 : 0) : wheelOut;
  wheelParts.forEach((m) => { m.position.y = m.userData.y0 - Math.pow(wheelDrop, 1.4) * 4.2; });
  setOpacity(shelfParts, smoothstep(4.5, 4.8, stage) * (1 - smoothstep(5.3, 5.55, stage)));
  const plinthIn = smoothstep(5.4, 5.85, stage);
  setOpacity(plinthParts, Math.min(1, plinthIn * 1.6));
  const plinthRise = still ? (plinthIn > 0.5 ? 1 : 0) : plinthIn;
  plinthParts.forEach((m) => { m.position.y = m.userData.y0 - (1 - plinthRise) * 1.4; });
  slip.material.opacity = smoothstep(0.4, 1.0, stage) * (1 - smoothstep(3.6, 4.2, stage)) * 0.9;
  slip.visible = slip.material.opacity > 0.01;
  contact.position.y = THREE.MathUtils.lerp(-0.64, -2.62, display);
  if (catcher) catcher.position.y = contact.position.y + 0.01;
  contact.material.opacity = 1 - heatK * 0.8;

  key.color.setHex(0xffe7cc).lerp(tmpColor.setHex(0xff9a50), heatK * 0.8);
  key.intensity = 2.1 - heatK * 1.3;
  scene.environmentIntensity = 0.55 - heatK * 0.35;

  // the rib presses the belly outward through the shaping stage
  const ribK = smoothstep(3.55, 3.85, stage) * (1 - smoothstep(4.15, 4.4, stage));
  rib.visible = ribK > 0.01;
  if (rib.visible) {
    const azCam = 0.5 + shown * 0.7;
    const a = azCam - 1.35;                                  // just inside the left silhouette
    let bellyR = 0, bellyY = 1;
    for (let p = 0; p < PROFILE_SAMPLES * 0.5; p++) if (workProfile[p].x > bellyR) { bellyR = workProfile[p].x; bellyY = workProfile[p].y; }
    // local +x points into the pot, so the rib's convex edge (x≈0.5) meets the wall
    const out = bellyR + 0.5 + (1 - ribK) * 0.9;
    rib.position.set(Math.sin(a) * out, bellyY + 0.05, Math.cos(a) * out);
    rib.rotation.set(0, a + Math.PI / 2, -0.08);
    rib.material.opacity = ribK;
  }

  // embers rise round the pot at peak heat
  embers.material.opacity = smoothstep(0.35, 0.8, heatK);
  embers.visible = embers.material.opacity > 0.01 && !still;
  if (embers.visible) {
    const ep = embers.geometry.attributes.position.array;
    const sd = embers.userData.seed;
    for (let i = 0; i < ep.length / 3; i++) {
      const life = (t * (0.18 + sd[i * 4] * 0.22) + sd[i * 4 + 1]) % 1;
      const a = sd[i * 4 + 2] * Math.PI * 2 + t * 0.2;
      const r = rimR * (0.7 + sd[i * 4 + 3] * 0.9) + life * 0.4;
      ep[i * 3] = Math.sin(a + life * 2.0) * r;
      ep[i * 3 + 1] = life * (rimY + 2.2) + Math.sin(t * 3 + i) * 0.05;
      ep[i * 3 + 2] = Math.cos(a + life * 2.0) * r;
    }
    embers.geometry.attributes.position.needsUpdate = true;
  }

  // slip flung off the rim while the wheel is fast and wet
  if (!still) spawnDroplets(dt, smoothstep(0.6, 1.2, stage) * throwing * (1 - smoothstep(3.3, 3.9, stage)), rimY, rimR);
  else droplets.visible = false;

  /* camera: orbit a little, look down into the opening, frame wheel + pot */
  const opening = Math.max(0, 1 - Math.abs(stage - 2.1) / 0.9);
  const el = 0.3 + opening * 0.28 - display * 0.06 + heatK * 0.04;
  const az = 0.5 + shown * 0.7;
  const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fitW = 6.7 - display * 2.1;   // the splash pan goes, so the finished piece can come closer
  const fitH = Math.max(3.4, rimY + 1.4);
  const dW = fitW / view.fracW / (2 * halfTan * camera.aspect);
  const dH = fitH / view.fracH / (2 * halfTan);
  const dist = Math.max(dW, dH);
  lookTarget.set(0, THREE.MathUtils.lerp(0.55, rimY * 0.48, 0.7), 0);
  camera.position.set(
    lookTarget.x + Math.sin(az) * Math.cos(el) * dist,
    lookTarget.y + Math.sin(el) * dist,
    lookTarget.z + Math.cos(az) * Math.cos(el) * dist
  );
  camera.lookAt(lookTarget);

  /* DOM: progress, temperature, kiln wash, drag hint */
  const idx = Math.min(LAST, Math.round(stage));
  if (idx !== lastStage) {
    steps.forEach((li, i) => li.classList.toggle('is-current', i === idx));
    steps.forEach((li, i) => li.classList.toggle('is-past', i < idx));
    lastStage = idx;
  }
  const temp = 20 + 1260 * smoothstep(4.45, 5.0, stage) * (1 - smoothstep(5.0, 5.7, stage) * 0.985);
  tempEl.textContent = formatTemp(temp);
  document.body.classList.toggle('is-firing', stage > 4.4 && stage < 5.65);
  // warm glow arrives first, then the dark: half-way states read as heat, not grey
  rootStyle.setProperty('--glow', smoothstep(0.0, 0.4, heat).toFixed(3));
  rootStyle.setProperty('--dark', smoothstep(0.45, 0.85, heat).toFixed(3));
  document.body.classList.toggle('is-kiln', heat > 0.68);   // light copy only once the page is dark
  document.body.classList.toggle('is-final', stage > 5.7);

  renderer.render(scene, camera);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  composeFrame(elapsed, dt, false);
  requestAnimationFrame(tick);
}

// Reduced motion: scroll and drag still drive the piece; nothing moves on its own.
let stillQueued = false;
function requestStill() {
  if (!renderer || !scene || stillQueued) return;
  stillQueued = true;
  requestAnimationFrame(() => {
    stillQueued = false;
    composeFrame(0, 0, true);
  });
}

if (renderer) {
  initScene();
  window.addEventListener('resize', () => {
    applyLayout();
    if (prefersReducedMotion) requestStill();
  });
  if (prefersReducedMotion) requestStill();
  else tick();
} else {
  document.documentElement.classList.add('no-webgl');
}
