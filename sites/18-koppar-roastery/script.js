const canvas = document.getElementById("roaster"),
  ctx = canvas.getContext("2d"),
  profile = document.getElementById("profile"),
  pc = profile.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches,
  low = innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4;
let W, H, PW, PH, DPR;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, low ? 1.5 : 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  PW = profile.clientWidth;
  PH = profile.clientHeight;
  for (const [c, w, h] of [
    [canvas, W, H],
    [profile, PW, PH],
  ]) {
    c.width = w * DPR;
    c.height = h * DPR;
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  pc.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
addEventListener("resize", resize);
const roast = {
  heatOn: false,
  airTemp: 21,
  beanTemp: 21,
  time: 0,
  level: 0,
  curve: [],
  events: [],
  firstCrack: false,
  secondCrack: false,
  state: "ready",
};
let batch = 217,
  angle = 0,
  sample = 0,
  crackFlash = 0,
  sound = false,
  audio = null;
const STAGES = [
  {
    until: 0.06,
    name: "GREEN",
    notes: ["grass", "hay", "raw pea"],
    advice: "unroasted. hold the heat.",
  },
  {
    until: 0.2,
    name: "DRYING",
    notes: ["steam", "wet grass", "cereal"],
    advice: "moisture leaving. keep it steady.",
  },
  {
    until: 0.36,
    name: "YELLOWING",
    notes: ["bread", "toast", "barley"],
    advice: "maillard has begun — sugars waking up.",
  },
  {
    until: 0.52,
    name: "CINNAMON",
    notes: ["malt", "lemon", "green apple"],
    advice: "bright and grassy still. most people go further.",
  },
  {
    until: 0.66,
    name: "CITY",
    notes: ["caramel", "hazelnut", "cane sugar"],
    advice: "first crack behind you. this is the honest roast.",
  },
  {
    until: 0.78,
    name: "FULL CITY",
    notes: ["cocoa", "brown butter", "fig"],
    advice: "sweetness peaking. a fine place to stop.",
  },
  {
    until: 0.88,
    name: "VIENNA",
    notes: ["dark chocolate", "molasses", "smoke"],
    advice: "oils surfacing. the bean is losing its origin.",
  },
  {
    until: 0.97,
    name: "FRENCH",
    notes: ["carbon", "burnt sugar", "ash"],
    advice: "this is roast flavor now, not coffee flavor.",
  },
  {
    until: 2,
    name: "CHARCOAL",
    notes: ["regret"],
    advice: "you have made fuel. new batch?",
  },
];

function beanColor(level, shade = 0) {
  // green -> straw -> cinnamon -> chestnut -> espresso -> black
  const stops = [
    [0, [138, 148, 100]],
    [0.2, [176, 165, 110]],
    [0.38, [196, 158, 96]],
    [0.55, [150, 96, 55]],
    [0.72, [96, 58, 34]],
    [0.88, [52, 32, 22]],
    [1, [24, 18, 15]],
  ];
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1][0] < level) i++;
  const [l0, c0] = stops[i],
    [l1, c1] = stops[i + 1];
  const t = Math.min(1, Math.max(0, (level - l0) / (l1 - l0)));
  const r = c0[0] + (c1[0] - c0[0]) * t - shade;
  const g = c0[1] + (c1[1] - c0[1]) * t - shade;
  const b = c0[2] + (c1[2] - c0[2]) * t - shade;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const beans = Array.from({ length: low ? 95 : 180 }, (_, i) => ({
  a: Math.random() * Math.PI * 2,
  r: Math.sqrt(Math.random()),
  s: 0.75 + Math.random() * 0.5,
  rot: Math.random() * Math.PI * 2,
  shade: Math.random() * 18,
}));
const heat = document.getElementById("heat"),
  drop = document.getElementById("drop"),
  result = document.getElementById("result");
function setHeat(on) {
  if (on && ["cooling", "done"].includes(roast.state)) return;
  roast.heatOn = on;
  if (on && roast.state === "ready") {
    roast.state = "roasting";
    roast.curve = [[0, 21]];
    result.textContent = "Watch the beans, then trust the curve.";
  }
  heat.classList.toggle("on", on);
  heat.setAttribute("aria-pressed", String(on));
  document.getElementById("burner-light").classList.toggle("on", on);
  document.getElementById("burner-state").textContent = on
    ? "BURNER ON"
    : "BURNER OFF";
  drop.disabled = roast.state !== "roasting";
}
heat.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  heat.setPointerCapture(e.pointerId);
  setHeat(true);
});
heat.addEventListener("pointerup", () => setHeat(false));
heat.addEventListener("pointercancel", () => setHeat(false));
heat.addEventListener("lostpointercapture", () => setHeat(false));
addEventListener("keydown", (e) => {
  if (
    (e.code === "Space" || e.code === "Enter") &&
    (e.target === heat || (e.target === document.body && e.code === "Space"))
  ) {
    e.preventDefault();
    setHeat(true);
  }
});
addEventListener("keyup", (e) => {
  if (
    (e.code === "Space" || e.code === "Enter") &&
    (e.target === heat || (e.target === document.body && e.code === "Space"))
  ) {
    e.preventDefault();
    setHeat(false);
  }
});
heat.addEventListener("click", (e) => {
  if (e.detail === 0) setHeat(!roast.heatOn);
});
heat.addEventListener("blur", () => setHeat(false));
addEventListener("blur", () => setHeat(false));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setHeat(false);
});
function stage() {
  return STAGES.find((s) => roast.level <= s.until) || STAGES.at(-1);
}
function finish() {
  if (roast.state !== "roasting") return;
  setHeat(false);
  roast.state = "cooling";
  drop.disabled = true;
  heat.disabled = true;
  const s = stage();
  result.textContent = `Batch ${batch}: ${s.name.toLowerCase()} at ${Math.round(roast.beanTemp)}°C. ${roast.level < 0.36 ? "A little early — try a longer roast." : roast.level < 0.88 ? "A batch worth keeping." : "Take the next batch a little lighter."}`;
  roast.events.push({ time: roast.time, temp: roast.beanTemp, label: "DROP" });
  roast.curve.push([roast.time, roast.beanTemp]);
}
drop.addEventListener("click", finish);
document.getElementById("batch").addEventListener("click", () => {
  Object.assign(roast, {
    heatOn: false,
    airTemp: 21,
    beanTemp: 21,
    time: 0,
    level: 0,
    curve: [],
    events: [],
    firstCrack: false,
    secondCrack: false,
    state: "ready",
  });
  sample = 0;
  crackFlash = 0;
  heat.disabled = false;
  batch++;
  document.getElementById("batch-no").textContent = batch;
  result.textContent = "Fresh beans. A clean page.";
  setHeat(false);
});
document.getElementById("sound").addEventListener("click", async (e) => {
  try {
    if (!audio) audio = new AudioContext();
    await audio.resume();
    sound = !sound;
    e.target.textContent = `Crack sound: ${sound ? "on" : "off"}`;
    e.target.setAttribute("aria-pressed", String(sound));
  } catch {
    e.target.textContent = "Sound unavailable";
    sound = false;
  }
});
function crack() {
  if (!sound || !audio || audio.state !== "running") return;
  for (let i = 0; i < 6; i++) {
    const buffer = audio.createBuffer(
        1,
        audio.sampleRate * 0.045,
        audio.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let j = 0; j < data.length; j++)
      data[j] = (Math.random() * 2 - 1) * Math.exp((-j / data.length) * 8);
    const source = audio.createBufferSource(),
      gain = audio.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.16;
    source.connect(gain).connect(audio.destination);
    source.start(audio.currentTime + i * 0.11);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }
}
function update(dt) {
  if (roast.state === "roasting") {
    roast.time += dt;
    roast.airTemp = roast.heatOn
      ? Math.min(260, roast.airTemp + dt * 30)
      : Math.max(21, roast.airTemp - dt * 14);
    roast.beanTemp += (roast.airTemp - roast.beanTemp) * dt * 0.2;
    if (roast.beanTemp > 130)
      roast.level = Math.min(
        1,
        roast.level + dt * (roast.beanTemp - 130) * 0.00034,
      );
    sample += dt;
    if (sample > 0.3) {
      roast.curve.push([roast.time, roast.beanTemp]);
      sample = 0;
      if (roast.curve.length > 1600) roast.curve.splice(1, 1);
    }
    for (const [key, temp, level, label] of [
      ["firstCrack", 196, 0.4, "FIRST CRACK"],
      ["secondCrack", 224, 0.72, "SECOND CRACK"],
    ]) {
      if (!roast[key] && roast.beanTemp >= temp && roast.level > level) {
        roast[key] = true;
        roast.events.push({ time: roast.time, temp: roast.beanTemp, label });
        crackFlash = 1;
        crack();
        result.textContent =
          label === "FIRST CRACK"
            ? "First crack. The sweet window is opening."
            : "Second crack. Time to think about dropping.";
      }
    }
    if (roast.level >= 1) finish();
  } else if (roast.state === "cooling") {
    roast.beanTemp += (21 - roast.beanTemp) * dt * 0.4;
    if (roast.beanTemp < 28) roast.state = "done";
  }
  if (!reduced) angle += dt * (roast.state === "roasting" ? 1.6 : 0.4);
  crackFlash = Math.max(0, crackFlash - dt * 1.8);
}
function rounded(g, x, y, w, h, r, fill, stroke) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.stroke();
  }
}
function circle(x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
function metal(x, y, r) {
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, "#71422e");
  g.addColorStop(0.18, "#c2865d");
  g.addColorStop(0.34, "#e3ba8e");
  g.addColorStop(0.52, "#98502f");
  g.addColorStop(0.78, "#c28254");
  g.addColorStop(1, "#623625");
  return g;
}
function bean(b, x, y, s, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.shadowColor = "#160b0755";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = beanColor(roast.level, b.shade);
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "#f5e3bd88";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-s * 0.75, 0);
  ctx.bezierCurveTo(-s * 0.2, -s * 0.25, s * 0.2, s * 0.25, s * 0.75, 0);
  ctx.stroke();
  ctx.restore();
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  const scale = Math.min(W / 690, (H - 65) / 590);
  ctx.translate(W / 2, H / 2 + 10);
  ctx.scale(scale, scale);
  ctx.translate(-345, -295);
  // Cast shadow and cast-iron pedestal.
  const shadow = ctx.createRadialGradient(350, 545, 5, 350, 545, 260);
  shadow.addColorStop(0, "#4a2a1840");
  shadow.addColorStop(1, "#4a2a1800");
  ctx.save();
  ctx.translate(0, 390);
  ctx.scale(1, 0.28);
  ctx.fillStyle = shadow;
  ctx.fillRect(40, 260, 630, 550);
  ctx.restore();
  rounded(ctx, 192, 478, 320, 52, 9, "#3b3730");
  rounded(ctx, 181, 521, 344, 15, 4, "#292923");
  rounded(ctx, 228, 519, 30, 33, 4, "#302c26");
  rounded(ctx, 450, 519, 30, 33, 4, "#302c26");
  // Exhaust and hopper sit behind the front casting.
  rounded(ctx, 468, 87, 45, 250, 10, "#8f806b", "#584e41");
  rounded(ctx, 467, 78, 74, 22, 6, "#a99c87", "#6f6252");
  for (let x = 474; x < 510; x += 7) {
    ctx.strokeStyle = "#e6dcc333";
    ctx.beginPath();
    ctx.moveTo(x, 106);
    ctx.lineTo(x, 210);
    ctx.stroke();
  }
  const hg = metal(350, 90, 100);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(284, 56);
  ctx.lineTo(416, 56);
  ctx.lineTo(382, 148);
  ctx.lineTo(318, 148);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#7d5037";
  ctx.stroke();
  rounded(ctx, 277, 48, 146, 15, 5, "#c99c72", "#91603f");
  rounded(ctx, 321, 140, 58, 50, 4, "#95623f", "#623a28");
  rounded(ctx, 175, 170, 358, 333, 39, metal(350, 325, 200), "#6e402d");
  rounded(ctx, 180, 176, 348, 320, 35, null, "#e1ba8a");
  // Side motor and sampling spoon.
  rounded(ctx, 505, 292, 65, 110, 15, "#46473e", "#262b25");
  for (let y = 304; y < 390; y += 9) rounded(ctx, 552, y, 23, 4, 1, "#727368");
  rounded(ctx, 115, 314, 77, 14, 5, "#6c533c");
  rounded(ctx, 92, 306, 55, 30, 8, "#3c3027");
  // Machined drum ring and recessed inspection glass.
  circle(350, 328, 170, metal(350, 328, 170), "#75472e");
  ctx.lineWidth = 2;
  circle(350, 328, 158, null, "#e9c399");
  circle(350, 328, 146, "#4d3929", "#603d27");
  circle(350, 328, 138, "#281e17", "#d1a274");
  const glass = ctx.createRadialGradient(305, 279, 5, 350, 328, 139);
  glass.addColorStop(0, "#a28c68");
  glass.addColorStop(0.7, "#685641");
  glass.addColorStop(1, "#32281e");
  circle(350, 328, 134, glass);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2,
      x = 350 + Math.cos(a) * 162,
      y = 328 + Math.sin(a) * 162;
    circle(x, y, 4, "#6d492f", "#e5bd86");
    ctx.strokeStyle = "#cfaa7d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 1);
    ctx.lineTo(x + 2, y - 1);
    ctx.stroke();
  }
  ctx.save();
  circle(350, 328, 132);
  ctx.clip();
  const dropped = ["cooling", "done"].includes(roast.state);
  if (!dropped) {
    ctx.save();
    ctx.translate(350, 328);
    ctx.rotate(angle);
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      rounded(ctx, 10, -5, 115, 10, 3, "#977958", "#453321");
    }
    ctx.restore();
    for (const b of beans) {
      const a = angle * (0.5 + b.s * 0.25) + b.a * 7,
        pa = Math.PI / 2 + Math.sin(a) * (0.5 + b.r * 0.55),
        r = 134 * (0.3 + b.r * 0.63);
      bean(
        b,
        350 + Math.cos(pa) * r,
        328 + Math.sin(pa) * r * 0.9 - Math.abs(Math.sin(a)) * 19,
        7 * b.s,
        b.rot + a,
      );
    }
  }
  ctx.strokeStyle = "#fff3cb30";
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.arc(350, 328, 116, 3.45, 4.9);
  ctx.stroke();
  ctx.restore();
  circle(350, 328, 16, metal(350, 328, 16), "#5f3b25");
  circle(350, 328, 6, "#61452d");
  // Analogue bean-temperature dial.
  circle(507, 198, 42, "#51483b", "#c3a17a");
  circle(507, 198, 36, "#e9dfc9", "#9c8060");
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.strokeStyle = "#63513f";
    ctx.lineWidth = i % 2 ? 1 : 2;
    ctx.beginPath();
    ctx.moveTo(507 + Math.cos(a) * 28, 198 + Math.sin(a) * 28);
    ctx.lineTo(507 + Math.cos(a) * 32, 198 + Math.sin(a) * 32);
    ctx.stroke();
  }
  const needle =
    Math.PI * 0.75 + Math.min(1, roast.beanTemp / 280) * Math.PI * 1.5;
  ctx.strokeStyle = "#b26038";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(507, 198);
  ctx.lineTo(507 + Math.cos(needle) * 27, 198 + Math.sin(needle) * 27);
  ctx.stroke();
  circle(507, 198, 3, "#6e4d34");
  ctx.fillStyle = "#6d5b47";
  ctx.textAlign = "center";
  ctx.font = '8px "DM Sans"';
  ctx.fillText("°C", 507, 215);
  // Brass maker's plate, burner slots and the cooling tray.
  rounded(ctx, 299, 184, 102, 23, 3, "#ceb083", "#6b4a31");
  ctx.fillStyle = "#6b462d";
  ctx.font = '9px "DM Sans"';
  ctx.fillText("K O P P A R · 02", 350, 199);
  for (let i = 0; i < 6; i++)
    rounded(
      ctx,
      296 + i * 19,
      482,
      12,
      7,
      3,
      roast.heatOn ? "#ed9747" : "#24221e",
    );
  rounded(ctx, 273, 487, 154, 18, 4, "#735136", "#35271f");
  ctx.fillStyle = "#8a7a61";
  ctx.beginPath();
  ctx.ellipse(350, 524, 127, 31, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c1aa84";
  ctx.stroke();
  ctx.fillStyle = "#5f5545";
  ctx.beginPath();
  ctx.ellipse(350, 519, 119, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let x = -100; x <= 100; x += 10)
    for (let y = -15; y <= 15; y += 8) {
      if ((x / 108) ** 2 + (y / 19) ** 2 < 1)
        circle(350 + x, 519 + y, 1, "#332b23");
    }
  if (dropped)
    for (let i = 0; i < beans.length; i++) {
      const b = beans[i];
      bean(
        b,
        350 + Math.cos(b.a) * b.r * 103,
        518 + Math.sin(b.a) * b.r * 17,
        5 * b.s,
        b.rot,
      );
    }
  if (crackFlash > 0 && !reduced) {
    ctx.strokeStyle = `rgba(176,101,58,${crackFlash})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(350 + Math.cos(a) * 179, 328 + Math.sin(a) * 179);
      ctx.lineTo(350 + Math.cos(a) * 188, 328 + Math.sin(a) * 188);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawProfile() {
  pc.clearRect(0, 0, PW, PH);
  const left = 26,
    right = PW - 7,
    top = 15,
    bottom = PH - 18,
    w = right - left,
    h = bottom - top,
    tmax = Math.max(40, roast.time);
  pc.font = '8px "DM Sans"';
  pc.textAlign = "left";
  for (const v of [21, 130, 196, 260]) {
    const y = bottom - ((v - 21) / 239) * h;
    pc.strokeStyle = v === 196 ? "#a65d3744" : "#35271f17";
    pc.setLineDash(v === 196 ? [3, 4] : []);
    pc.beginPath();
    pc.moveTo(left, y);
    pc.lineTo(right, y);
    pc.stroke();
    pc.fillStyle = "#82715f";
    pc.fillText(v + "°", 0, y + 3);
  }
  pc.setLineDash([]);
  pc.strokeStyle = "#a65d37";
  pc.lineWidth = 2;
  pc.beginPath();
  roast.curve.forEach(([t, v], i) => {
    const x = left + (t / tmax) * w,
      y = bottom - ((v - 21) / 239) * h;
    i ? pc.lineTo(x, y) : pc.moveTo(x, y);
  });
  pc.stroke();
  pc.lineWidth = 1;
  pc.fillStyle = "#82715f";
  pc.textAlign = "right";
  pc.fillText(`${Math.round(tmax)}s`, right, PH - 2);
  pc.textAlign = "left";
  pc.fillText("0s", left, PH - 2);
  for (const [i, e] of roast.events.entries()) {
    const x = left + (e.time / tmax) * w,
      y = bottom - ((e.temp - 21) / 239) * h;
    pc.beginPath();
    pc.arc(x, y, 3, 0, Math.PI * 2);
    pc.fillStyle = "#35271f";
    pc.fill();
    pc.textAlign = x > PW * 0.7 ? "right" : "left";
    pc.fillText(e.label, x, y - (i % 2 ? 18 : 8));
  }
}
let lastStage = "",
  lastUI = 0;
function ui(now) {
  if (now - lastUI < 100) return;
  lastUI = now;
  const s = stage();
  if (s.name !== lastStage) {
    document.getElementById("cup-roast").textContent = s.name.toLowerCase();
    document.getElementById("cup-notes").replaceChildren(
      ...s.notes.map((n) => {
        const li = document.createElement("li");
        li.textContent = n;
        return li;
      }),
    );
    document.getElementById("cup-advice").textContent = s.advice;
    lastStage = s.name;
  }
  document.getElementById("cup-temp").textContent = Math.round(roast.beanTemp);
  const t = Math.floor(roast.time);
  document.getElementById("roast-time").textContent =
    `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  heat.querySelector("span").textContent =
    roast.state === "roasting"
      ? `${Math.round(roast.beanTemp)}°C · ${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")} · RELEASE TO COAST`
      : "RELEASE TO COAST";
  document.getElementById("phase-label").textContent = {
    ready: "READY TO CHARGE",
    roasting: roast.heatOn ? "HEAT APPLIED" : "COASTING",
    cooling: "COOLING THE BATCH",
    done: "BATCH COMPLETE",
  }[roast.state];
}
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.06);
  last = now;
  if (!document.hidden) update(dt);
  draw();
  drawProfile();
  ui(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
