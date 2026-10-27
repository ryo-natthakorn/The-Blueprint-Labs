/* ============================================================
   THE TIDELINE — private dining: the room, drawn to order
   The plan redraws for the chosen format and headcount; the
   same form then carries both into the contact page.
   ============================================================ */
(function () {
  "use strict";

  var svg = document.getElementById("plan-svg");
  var tags = document.getElementById("plan-tags");
  var form = document.getElementById("planner");
  if (!svg || !form) return;

  var guestsIn = document.getElementById("guests");
  var note = document.getElementById("guests-note");
  var line = document.getElementById("plan-line");
  var price = document.getElementById("plan-price");
  var caption = document.getElementById("plan-caption");
  var RANGE = { room: [6, 14], tasting: [6, 14], buyout: [16, 40] };

  function el(name, attrs, parent) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(n);
    return n;
  }
  function tag(text, x, y, cls) {
    var s = document.createElement("span");
    s.className = "ptag" + (cls ? " " + cls : "");
    s.style.left = (x / 6) + "%";
    s.style.top = (y / 4) + "%";
    s.textContent = text;
    tags.appendChild(s);
  }
  function grid() {
    var defs = el("defs", {});
    var p = el("pattern", { id: "pgrid", width: 20, height: 20, patternUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M20 0H0V20", fill: "none", stroke: "rgba(147,188,174,0.09)", "stroke-width": 1 }, p);
    var h = el("pattern", { id: "phatch", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: "rgba(236,229,214,0.22)", "stroke-width": 1.5 }, h);
    el("rect", { x: 0, y: 0, width: 600, height: 400, fill: "url(#pgrid)" });
  }
  function chair(x, y, w, h, i) {
    var r = el("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 4, class: "seat" });
    r.style.animationDelay = (i * 0.025) + "s";
    return r;
  }

  /* the private room: one long table, the pass on the top wall, windows on the channel */
  function drawRoom(n, tasting) {
    var g = el("g", { class: "walls" });
    el("path", { d: "M40 40 H220 M380 40 H560 M40 40 V360 H80 M140 360 H560 V330 M560 70 V40" }, g);
    el("path", { class: "glass", d: "M560 70 V330 M566 70 V330" });
    el("path", { class: "thin", d: "M566 70 H560 M566 330 H560 M566 140 H560 M566 200 H560 M566 260 H560" });
    el("rect", { x: 220, y: 30, width: 160, height: 16, fill: "url(#phatch)", class: "counter" });
    el("path", { class: "thin", d: "M80 360 A60 60 0 0 1 140 300 M80 360 V300" });   /* door swing */
    el("rect", { x: 48, y: 150, width: 18, height: 100, class: "furn" });           /* sideboard */

    var ends = n >= 10 ? 2 : 0, sides = n - ends;
    var top = Math.ceil(sides / 2), bottom = Math.floor(sides / 2);
    var cols = Math.max(top, 3), pitch = 46;
    var tw = cols * pitch + 20, th = 70, cx = 300, cy = 214;
    el("rect", { x: cx - tw / 2, y: cy - th / 2, width: tw, height: th, rx: 6, class: "table" });
    var i = 0, x0 = cx - (cols - 1) * pitch / 2;
    for (var a = 0; a < top; a++) chair(x0 + a * pitch, cy - th / 2 - 16, 30, 18, i++);
    var xb = cx - (bottom - 1) * pitch / 2;
    for (var b = 0; b < bottom; b++) chair(xb + b * pitch, cy + th / 2 + 16, 30, 18, i++);
    if (ends) { chair(cx - tw / 2 - 16, cy, 18, 30, i++); chair(cx + tw / 2 + 16, cy, 18, 30, i++); }

    if (tasting) {
      el("path", { class: "route", d: "M300 52 C 300 90, " + (cx + 40) + " 120, " + (cx + 10) + " " + (cy - th / 2 - 30) });
      el("circle", { cx: 300, cy: 52, r: 7, class: "chef" });
      tag("Chef plates at the pass", 300, 82, "amber");
    }
    tag("The pass · kitchen", 300, 16);
    tag("Channel windows", 584, 200, "vert");
    tag("From the dining room", 110, 384);
    tag("Sideboard", 22, 200, "vert dim");
  }

  /* the whole restaurant: kitchen, private room, bar, forty seats in the dining room */
  function drawBuyout(n) {
    var g = el("g", { class: "walls" });
    el("path", { d: "M20 30 H580 V60 M580 340 V370 H330 M250 370 H20 V30 M250 30 V140 M20 140 H200 M240 140 H250 M250 140 H300 M350 140 H420 V30" }, g);
    el("path", { class: "glass", d: "M580 60 V340 M586 60 V340 M330 370 H250 M330 376 H250" });
    el("rect", { x: 24, y: 34, width: 222, height: 102, fill: "url(#phatch)", class: "counter" });
    /* private room table */
    el("rect", { x: 280, y: 66, width: 110, height: 36, rx: 5, class: "table" });
    /* bar along the left wall */
    el("rect", { x: 24, y: 170, width: 34, height: 180, class: "furn" });
    var seats = [], k;
    for (k = 0; k < 6; k++) seats.push([76, 186 + k * 30, 16, 16]);
    /* dining room: six four-tops and eight two-tops, forty seats with the bar */
    var fours = [[200, 205], [300, 205], [400, 205], [200, 300], [300, 300], [400, 300]];
    fours.forEach(function (p) {
      el("rect", { x: p[0] - 24, y: p[1] - 18, width: 48, height: 36, rx: 4, class: "table" });
      seats.push([p[0] - 12, p[1] - 30, 18, 12], [p[0] + 12, p[1] - 30, 18, 12], [p[0] - 12, p[1] + 30, 18, 12], [p[0] + 12, p[1] + 30, 18, 12]);
    });
    var twos = [[500, 90], [500, 160], [500, 230], [500, 300], [130, 205], [130, 300]];
    twos.forEach(function (p) {
      el("rect", { x: p[0] - 16, y: p[1] - 14, width: 32, height: 28, rx: 4, class: "table" });
      seats.push([p[0], p[1] - 26, 18, 12], [p[0], p[1] + 26, 18, 12]);
    });
    seats.slice(0, 40).forEach(function (s, i) {
      var r = chair(s[0], s[1], s[2], s[3], i);
      if (i >= n) r.setAttribute("class", "seat free");
    });
    tag("Kitchen", 135, 85, "dim");
    tag("Private room", 335, 120);
    tag("Bar", 41, 160);
    tag("Dining room", 300, 156, "dim");
    tag("Channel windows", 540, 360, "right");
  }

  function format() { return form.querySelector('input[name="format"]:checked').value; }
  function render() {
    var f = format(), r = RANGE[f];
    var n = Math.round(+guestsIn.value || r[0]);
    n = Math.min(r[1], Math.max(r[0], n));
    guestsIn.value = n; guestsIn.min = r[0]; guestsIn.max = r[1];
    svg.innerHTML = ""; tags.innerHTML = "";
    grid();
    if (f === "buyout") drawBuyout(n); else drawRoom(n, f === "tasting");
    note.textContent = f === "buyout" ? "A full buyout seats 16 to 40." : "The private room seats 6 to 14.";
    line.textContent = f === "buyout" ? n + " guests, the whole restaurant"
      : f === "tasting" ? n + " guests, chef's tasting at the pass" : n + " guests in the private room";
    price.textContent = f === "buyout" ? "Whole-evening hire · we'll send a proposal within a day"
      : f === "tasting" ? "Seven courses · wine or zero-proof pairing, course by course"
      : "No room fee Tuesday to Thursday · a per-head figure with your menu sketch";
    caption.textContent = f === "buyout"
      ? "The whole restaurant for " + n + ": kitchen, private room, bar and dining room, with the seats your party would fill highlighted."
      : "The private room set for " + n + ": one long table, the kitchen pass along the top wall and windows onto the channel" +
        (f === "tasting" ? ", with the chef plating at the pass." : ".");
  }

  form.addEventListener("change", function (e) {
    if (e.target.name === "format") {
      var f = format();
      if (f === "buyout" && +guestsIn.value < 16) guestsIn.value = 24;
      if (f !== "buyout" && +guestsIn.value > 14) guestsIn.value = 14;
    }
    render();
  });
  guestsIn.addEventListener("input", function () { if (guestsIn.value !== "") render(); });
  form.querySelectorAll(".step-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      guestsIn.value = (+guestsIn.value || 0) + +b.getAttribute("data-step");
      render();
    });
  });
  render();
})();
