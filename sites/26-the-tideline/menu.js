/* ============================================================
   THE TIDELINE — menu page: dietary filter + course scrollspy
   ============================================================ */
(function () {
  "use strict";

  var sheet = document.querySelector(".sheet");
  var chips = document.querySelectorAll(".diet-filter .chip");
  var dishes = document.querySelectorAll(".dish");
  var count = document.getElementById("menu-count");
  var NAMES = { V: "vegetarian", VG: "vegan", GF: "gluten-free" };
  var LABEL = { V: "Vegetarian", VG: "Vegan", GF: "Gluten-free" };

  /* Matching dishes stay whole and get a marker; the rest fold down
     to name and price, so the guest still sees the whole menu but
     only has to read their options.                                */
  function applyFilter(diet) {
    var all = diet === "all", n = 0;
    sheet.classList.toggle("filtering", !all);
    dishes.forEach(function (d) {
      var tags = (d.getAttribute("data-tags") || "").split(/\s+/);
      var hit = !all && tags.indexOf(diet) !== -1;
      if (hit) n++;
      d.classList.toggle("match", hit);
      d.querySelectorAll(".tags li").forEach(function (li) {
        li.classList.toggle("on", hit && li.textContent.trim() === LABEL[diet]);
      });
    });
    document.querySelectorAll(".menu-sect").forEach(function (sec) {
      var note = sec.querySelector(".none-note");
      if (!note) return;
      var any = all || sec.querySelector(".dish.match");
      note.hidden = !!any;
      if (!any) note.textContent = "Nothing " + NAMES[diet] + " in " + sec.querySelector("h2").textContent.toLowerCase() +
        " tonight; ask your server, the kitchen can often adapt a dish.";
    });
    count.innerHTML = all
      ? "All " + dishes.length + " dishes tonight."
      : "<b>" + n + " of " + dishes.length + "</b> dishes tonight are " + NAMES[diet] + "; the rest are folded down to name and price.";
  }

  /* phones: the toolbar scrolls away, so a small pill keeps the active filter in reach */
  var toolbar = document.getElementById("menu-toolbar");
  var pill = document.createElement("button");
  pill.type = "button";
  pill.className = "filter-pill";
  pill.hidden = true;
  document.getElementById("main").appendChild(pill);
  var active = "all";
  function placePill() {
    var away = toolbar.getBoundingClientRect().bottom < 0;
    var sheetEnd = sheet.getBoundingClientRect().bottom < window.innerHeight * 0.6;
    pill.hidden = active === "all" || !away || sheetEnd || window.innerWidth > 720;
  }
  pill.addEventListener("click", function () {
    window.Tideline.scrollToEl(toolbar, "start");
    var on = document.querySelector('.diet-filter .chip[aria-pressed="true"]');
    if (on) on.focus({ preventScroll: true });
  });
  window.addEventListener("scroll", placePill, { passive: true });
  window.addEventListener("resize", placePill);

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
      active = chip.getAttribute("data-diet");
      applyFilter(active);
      pill.innerHTML = '<i class="fa-solid fa-filter" aria-hidden="true"></i>Showing ' + (NAMES[active] || "everything") + '<span>Change</span>';
      placePill();
    });
  });
  applyFilter("all");

  /* ---- scrollspy on the course nav --------------------------- */
  var links = Array.prototype.slice.call(document.querySelectorAll(".m-nav a"));
  var sections = links.map(function (a) { return { a: a, sec: document.querySelector(a.getAttribute("href")) }; })
    .filter(function (s) { return s.sec; });
  var current = null;
  function spy() {
    var line = window.innerHeight * 0.35;
    var cur = sections[0];
    sections.forEach(function (s) { if (s.sec.getBoundingClientRect().top <= line) cur = s; });
    if (cur === current) return;
    current = cur;
    sections.forEach(function (s) {
      if (s === cur) s.a.setAttribute("aria-current", "true"); else s.a.removeAttribute("aria-current");
    });
    /* keep the active course visible in the scrolling nav on phones */
    var nav = cur.a.parentElement;
    if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = cur.a.offsetLeft - 16;
  }
  window.addEventListener("scroll", spy, { passive: true });
  spy();
})();
