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
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;

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
const dialCanvas = document.createElement('canvas');
dialCanvas.width = dialCanvas.height = 1024;
const dc = dialCanvas.getContext('2d');
const dg = dc.createRadialGradient(512, 512, 90, 512, 512, 520);
dg.addColorStop(0, '#393b3a'); dg.addColorStop(0.55, '#262927'); dg.addColorStop(1, '#111715');
dc.fillStyle = dg; dc.fillRect(0, 0, 1024, 1024);
dc.translate(512, 512);
for (let i = 0; i < 720; i++) {
  const a = i * Math.PI / 360;
  dc.strokeStyle = `rgba(231,215,179,${i % 6 === 0 ? 0.042 : 0.015})`;
  dc.beginPath(); dc.moveTo(0, 0); dc.lineTo(Math.cos(a) * 500, Math.sin(a) * 500); dc.stroke();
}
dc.rotate(-Math.PI / 2);
dc.textAlign = 'center'; dc.fillStyle = '#cdb98e';
dc.font = '38px serif'; dc.fillText('MERIDIAN', 0, -240);
dc.font = '16px sans-serif'; dc.letterSpacing = '7px'; dc.fillText('CALIBRE M–1', 0, 285);
const dialTexture = new THREE.CanvasTexture(dialCanvas);
dialTexture.colorSpace = THREE.SRGBColorSpace;
const DIAL = new THREE.MeshStandardMaterial({ map: dialTexture, metalness: 0.15, roughness: 0.64, envMapIntensity:.25 });
const LEATHER = new THREE.MeshStandardMaterial({ color: 0x38291e, roughness: 0.82 });
const STITCH = new THREE.MeshStandardMaterial({ color: 0xb99d70, roughness: 0.85 });
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
  const engraving = document.createElement('canvas');
  engraving.width = engraving.height = 1024;
  const ec = engraving.getContext('2d');
  ec.fillStyle = '#b9b3a4'; ec.fillRect(0, 0, 1024, 1024);
  ec.translate(512, 512); ec.strokeStyle = '#757365';
  for (let r = 30; r < 495; r += 4) { ec.beginPath(); ec.arc(0, 0, r, 0, Math.PI*2); ec.stroke(); }
  ec.fillStyle = '#35362e'; ec.textAlign = 'center';
  ec.font = '48px serif'; ec.fillText('MERIDIAN', 0, -145);
  ec.font = 'italic 108px serif'; ec.fillText('A. L.', 0, 20);
  ec.font = '23px sans-serif'; ec.fillText('REGULATED IN SIX POSITIONS', 0, 102);
  ec.fillText('M–1   /   No. 0042', 0, 157); ec.fillText('90 HOURS · HAND ASSEMBLED', 0, 220);
  const et = new THREE.CanvasTexture(engraving); et.colorSpace = THREE.SRGBColorSpace;
  const signature = new THREE.Mesh(new THREE.CircleGeometry(2.42, 96), new THREE.MeshStandardMaterial({map:et, metalness:.25, roughness:.65, envMapIntensity:.3}));
  signature.position.z = .13; g.add(signature);
  for(let i=0;i<6;i++){ const a=i*Math.PI/3; const screw=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.04,20),BLUED);screw.rotation.x=Math.PI/2;screw.position.set(Math.cos(a)*2.48,Math.sin(a)*2.48,.14);g.add(screw); }
  addLayer(g, -0.82, -4.6);
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
  // Skeleton winding rotor: weighted rim, open spokes, visible spring.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.9,.24,12,64,Math.PI*1.15),TUNGSTEN);
  rotorGroup.add(rim);
  for(const a of [0,Math.PI*.57,Math.PI*1.15]){
    const spoke=new THREE.Mesh(new THREE.BoxGeometry(1.8,.13,.12),STEEL);
    spoke.position.set(Math.cos(a)*.9,Math.sin(a)*.9,0);spoke.rotation.z=a;rotorGroup.add(spoke);
  }
  const rotorHub = new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.18,32),GOLD_BRIGHT);
  rotorHub.rotation.x=Math.PI/2;rotorGroup.add(rotorHub);
  rotorGroup.position.z = 0.18;
  g.add(rotorGroup);
  addLayer(g, -0.58, -2.8);
}

/* --- L3 gear train ------------------------------------------------ */
const gears = []; // { mesh, speed }
function makeGear(radius, teeth, thickness, material) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.TorusGeometry(radius*.86,radius*.13,8,48),material);
  disc.scale.z=.35;g.add(disc);
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
    { r: 0.36, teeth: 12, x: 1.05, y: 0.85, mat: GOLD_BRIGHT, speed: -1.8 },
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
  // Two polished bridges and ruby bearings sit above the open train.
  const RUBY = new THREE.MeshPhysicalMaterial({color:0x971c4b,metalness:.25,roughness:.16,clearcoat:1});
  for(const [x,y,angle] of [[-.6,.35,.25],[.6,.8,-.6]]){
    const bridge=new THREE.Mesh(new THREE.BoxGeometry(1.3,.24,.13),STEEL);
    bridge.position.set(x,y,.12);bridge.rotation.z=angle;g.add(bridge);
    for(const sign of [-1,1]){
      const jewel=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.08,24),RUBY);
      jewel.rotation.x=Math.PI/2;jewel.position.set(x+sign*.48*Math.cos(angle),y+sign*.48*Math.sin(angle),.22);g.add(jewel);
    }
  }
  addLayer(g, -0.32, -1.1);
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
  const profile = [[2.43,-.42],[2.62,-.42],[2.73,-.29],[2.78,-.08],[2.73,.25],[2.64,.4],[2.48,.4],[2.43,.25],[2.43,-.42]].map(([r,z])=>new THREE.Vector2(r,z));
  const caseRing=new THREE.Mesh(new THREE.LatheGeometry(profile,isSmallScreen?64:128),GOLD);
  caseRing.rotation.x=Math.PI/2;g.add(caseRing);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(2.56,.085,16,96),GOLD_BRIGHT);
  bezel.position.z=.4;g.add(bezel);
  // crown
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 24), GOLD_BRIGHT);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(2.95, 0, 0);
  g.add(crown);
  // Bevelled lugs grow out of the case shoulder and narrow at the spring bar.
  for (const sx of [-1,1]) for(const sy of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(1.35,2.12);shape.quadraticCurveTo(1.92,2.04,1.83,2.6);shape.lineTo(1.49,3.15);shape.lineTo(1.17,3.15);shape.quadraticCurveTo(1.52,2.53,1.35,2.12);
    const lug=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.27,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.09,bevelThickness:.08}),GOLD);
    lug.scale.set(sx,sy,1);lug.position.z=-.24;g.add(lug);
  }
  // Curved, tapered leather, with edge welts and individual stitches.
  for(const side of [-1,1]){
    const verts=[],uvs=[],indices=[];const steps=28;
    for(let j=0;j<=steps;j++){
      const t=j/steps,w=1.18-t*.15,y=side*(2.8+t*2.5),z=-.2-t*t*1.45;
      verts.push(-w,y,z,w,y,z);uvs.push(0,t,1,t);
      if(j<steps){const n=j*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
    const leather=LEATHER.clone();leather.side=THREE.DoubleSide;g.add(new THREE.Mesh(geo,leather));
    for(const sx of [-1,1]){
      const edge=[];
      for(let j=0;j<=steps;j++){const t=j/steps;edge.push(new THREE.Vector3(sx*(1.18-t*.15),side*(2.8+t*2.5),-.2-t*t*1.45));}
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge),28,.045,6,false),LEATHER));
      for(let j=1;j<22;j++){const t=j/22;const stitch=new THREE.Mesh(new THREE.BoxGeometry(.018,.055,.013),STITCH);stitch.position.set(sx*(1.08-t*.15),side*(2.8+t*2.5),-.15-t*t*1.45);stitch.rotation.x=side*-Math.atan(1.16*t);g.add(stitch);}
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
    transmission: 0,
    transparent: true,
    opacity: 0.035,
    depthWrite: false,
    thickness: 0.4,
    ior: 1.77,
    clearcoat: 1,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.28), crystalMat);
  dome.scale.set(0.78, 0.32, 0.78);
  dome.rotation.x = Math.PI / 2;
  dome.position.z = -0.5;
  g.add(dome);
  const edgeMat=new THREE.MeshBasicMaterial({color:0xcbdcf2,transparent:true,opacity:.35});
  g.add(new THREE.Mesh(new THREE.TorusGeometry(2.62,.018,8,96),edgeMat));
  for(const [r,a] of [[2.43,1.1],[2.25,.55]]){
    const arc=new THREE.Mesh(new THREE.TorusGeometry(r,.028,8,64,a),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.24}));arc.rotation.z=.5;arc.position.z=.15;g.add(arc);
  }
  addLayer(g, 0.55, 4.4);
}

/* tilt the whole stack toward the viewer */
watch.rotation.x = -0.32;
watch.scale.setScalar(isSmallScreen ? 0.56 : 0.82);
watch.position.set(isSmallScreen ? 0 : 2.3, isSmallScreen ? 1.65 : 0, 0);

/* ------------------------------------------------------------------
   Scroll → explosion; sections highlight; drag orbits
------------------------------------------------------------------ */
let scrollProgress = 0;
let explode = 0;

function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener('scroll', () => { readScroll(); if (prefersReducedMotion) renderOnce(); }, { passive: true });
readScroll();

const plates = document.querySelectorAll('.plate');
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in-view'); });
}, { threshold: 0.3 });
plates.forEach((p) => io.observe(p));

const gaugeFill = document.getElementById('gauge-fill');
const gaugeLabel = document.getElementById('gauge-label');
const GAUGE_WORDS = ['assembled', 'sapphire crystal', 'dial & hands', 'gear train', 'mainspring & rotor', 'signed caseback'];
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

canvas.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
  e.preventDefault();
  if(e.key==='Home'){orbitX=orbitY=orbitVel=0;}
  else {orbitY+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;orbitX=THREE.MathUtils.clamp(orbitX+(e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0),-.5,.5);}
  if(prefersReducedMotion)renderOnce();
});

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
  explode += (scrollProgress - explode) * (prefersReducedMotion ? 1 : 0.07);
  const mobile = window.innerWidth <= 720;
  // Chapter centres, rather than percentage of total document height, keep
  // each named component unobstructed while its description is in view.
  const chapters=[...plates].map(p=>p.offsetTop+p.offsetHeight/2-window.innerHeight/2);
  let chapter=0;
  for(let i=0;i<chapters.length-1;i++){
    if(window.scrollY>=chapters[i])chapter=i+THREE.MathUtils.clamp((window.scrollY-chapters[i])/(chapters[i+1]-chapters[i]),0,1);
  }
  const selected=[-1,5,3,2,1,0];
  const from=Math.floor(chapter),to=Math.min(5,from+1),blend=THREE.MathUtils.smoothstep(chapter-from,0,1);
  function pose(i,k){
    if(k===0)return {x:0,y:0,z:layers[i].assembledZ,scale:1};
    if(i===selected[k])return {x:0,y:0,z:.6,scale:1};
    const slot=i-(i>selected[k]?1:0);
    return {x:(slot-2)*1.4,y:mobile?-3.1:-3.8,z:0,scale:.19};
  }
  layers.forEach((l,i)=>{
    const a=pose(i,from),b=pose(i,to);
    l.group.position.set(THREE.MathUtils.lerp(a.x,b.x,blend),THREE.MathUtils.lerp(a.y,b.y,blend),THREE.MathUtils.lerp(a.z,b.z,blend));
    l.group.scale.setScalar(THREE.MathUtils.lerp(a.scale,b.scale,blend));
  });
  if (!dragging && !prefersReducedMotion) {orbitVel*=.93;orbitY+=orbitVel;}
  watch.rotation.y=orbitY+(prefersReducedMotion?0:Math.sin(t*.2)*.08);
  watch.rotation.x=-.15+orbitX;
  watch.scale.setScalar(mobile?.46:.78);
  watch.position.set(mobile?0:2.7,mobile?1.8:.3,0);
  /* mechanism life */
  if (prefersReducedMotion) {
    const stillTime = new Date(); stillTime.setHours(10, 9, 30, 0); setHands(stillTime);
  } else setHands(new Date());
  gears.forEach((g) => { g.mesh.rotation.z = t * g.speed; });
  rotorGroup.rotation.z = Math.sin(t * 0.7) * 1.1;

  /* camera drifts back to fit the exploded stack */
  camera.position.z = mobile ? 12 : 11.8;
  camera.position.y = 0;
  camera.lookAt(0, 0, 0);

  /* gauge */
  gaugeFill.style.height = `${explode * 100}%`;
  const idx = Math.min(GAUGE_WORDS.length - 1, Math.round(chapter));
  if (idx !== lastGaugeIdx) { gaugeLabel.textContent = GAUGE_WORDS[idx]; lastGaugeIdx = idx; }

  renderer.render(scene, camera);
}

function tick() {
  composeFrame(clock.getElapsedTime());
  requestAnimationFrame(tick);
}

function renderOnce() {
  composeFrame(0);
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
