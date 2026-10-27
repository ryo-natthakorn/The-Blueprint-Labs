/* ============================================================
   THE TIDELINE — story page
   The day: a sticky 24-hour dial follows the stop in the middle
   of the screen and reads today's tide at that hour.
   The map: pick a supplier (pin or list) to trace its route.
   ============================================================ */
(function () {
  "use strict";
  var TL = window.Tideline;
  var NS = "http://www.w3.org/2000/svg";

  /* ---- the dial ---------------------------------------------- */
  var dial = document.querySelector(".dial");
  var stops = Array.prototype.slice.call(document.querySelectorAll(".day-stop"));
  if (dial && stops.length) {
    var C = 100, R = 88;
    var pt = function (min, r) {
      var a = (min / 1440) * 2 * Math.PI + Math.PI / 2;   /* noon at the top, like the sun */
      return [C + r * Math.cos(a), C + r * Math.sin(a)];
    };
    /* hour ticks, labels at the quarters of the day */
    var ticks = dial.querySelector(".ticks");
    for (var h = 0; h < 24; h++) {
      var major = h % 6 === 0;
      var a = pt(h * 60, R - (major ? 10 : 6)), b = pt(h * 60, R);
      var ln = document.createElementNS(NS, "line");
      ln.setAttribute("x1", a[0]); ln.setAttribute("y1", a[1]); ln.setAttribute("x2", b[0]); ln.setAttribute("y2", b[1]);
      if (major) ln.setAttribute("class", "major");
      ticks.appendChild(ln);
      if (major) {
        var tp = pt(h * 60, R - 24), tx = document.createElementNS(NS, "text");
        tx.setAttribute("x", tp[0]); tx.setAttribute("y", tp[1] + 4); tx.setAttribute("text-anchor", "middle");
        tx.textContent = ["12A", "6A", "12P", "6P"][h / 6];
        ticks.appendChild(tx);
      }
    }
    /* daylight arc, roughly sunrise to sunset on this coast */
    var s0 = pt(6 * 60 + 40, R), s1 = pt(18 * 60 + 50, R);
    dial.querySelector(".daylight").setAttribute("d", "M" + s0[0] + " " + s0[1] + " A" + R + " " + R + " 0 0 1 " + s1[0] + " " + s1[1]);

    var hand = dial.querySelector(".hand");
    var tEl = document.getElementById("clock-time");
    var wEl = document.getElementById("clock-what");
    var tideEl = document.getElementById("clock-tide");
    var stepsEl = document.querySelector(".clock-steps");
    var steps = stops.map(function (s) {
      var li = document.createElement("li");
      li.innerHTML = "<b>" + s.querySelector(".stop-time").textContent + "</b>" + s.querySelector("h3").textContent;
      stepsEl.appendChild(li);
      return li;
    });

    var show = function (i) {
      var s = stops[i], hm = s.getAttribute("data-time").split(":");
      var min = +hm[0] * 60 + +hm[1];
      hand.style.transform = "rotate(" + (min / 1440 * 360 + 180) + "deg)";
      tEl.textContent = s.querySelector(".stop-time").textContent;
      wEl.textContent = s.querySelector("h3").textContent;
      var d = new Date(); d.setHours(+hm[0], +hm[1], 0, 0);
      var ts = TL.tideState(d.getTime());
      tideEl.textContent = "Today at this hour the tide is " + ts.height.toFixed(1) + " m and " + (ts.rising ? "rising" : "falling") + ".";
      stops.forEach(function (x, j) { x.classList.toggle("on", j === i); });
      steps.forEach(function (x, j) { x.classList.toggle("on", j === i); });
    };
    show(0);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) show(stops.indexOf(en.target)); });
      }, { rootMargin: "-45% 0px -50% 0px" });
      stops.forEach(function (s) { io.observe(s); });
    } else {
      document.documentElement.classList.add("no-io");
    }
  }

  /* ---- the map ------------------------------------------------ */
  var map = document.querySelector(".hp-map");
  var pickers = Array.prototype.slice.call(document.querySelectorAll("[data-sup]:not([data-sup='home'])"));
  var current = null;
  function pick(sup) {
    current = current === sup ? null : sup;
    map.classList.toggle("picking", !!current);
    map.querySelectorAll(".route").forEach(function (r) {
      var on = r.getAttribute("data-route") === current;
      r.classList.remove("on");
      if (on) { void r.getBoundingClientRect(); r.classList.add("on"); }
    });
    pickers.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-sup") === current)); });
  }
  pickers.forEach(function (b) {
    b.addEventListener("click", function () { pick(b.getAttribute("data-sup")); });
  });
})();
