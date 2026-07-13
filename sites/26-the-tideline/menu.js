/* ============================================================
   THE TIDELINE — menu page: dietary filter + section scrollspy
   ============================================================ */
(function () {
  "use strict";

  /* ---- dietary filter --------------------------------------
     Non-matching dishes dim rather than disappear: the guest
     still sees the breadth of the menu while their options
     stay readable.                                             */
  var chips = document.querySelectorAll(".diet-filter .chip");
  var dishes = document.querySelectorAll(".dish");

  function applyFilter(diet) {
    dishes.forEach(function (d) {
      var tags = (d.getAttribute("data-tags") || "").split(/\s+/);
      var show = diet === "all" || tags.indexOf(diet) !== -1;
      d.classList.toggle("dim", !show);
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
      applyFilter(chip.getAttribute("data-diet"));
    });
  });

  /* ---- scrollspy on the section nav ------------------------ */
  var links = document.querySelectorAll(".m-nav a");
  var sections = [];
  links.forEach(function (a) {
    var sec = document.querySelector(a.getAttribute("href"));
    if (sec) sections.push({ a: a, sec: sec });
  });

  function spy() {
    var y = window.scrollY + 170;
    var current = sections[0];
    sections.forEach(function (s) {
      if (s.sec.offsetTop <= y) current = s;
    });
    sections.forEach(function (s) {
      s.a.classList.toggle("active", s === current);
    });
  }
  window.addEventListener("scroll", spy, { passive: true });
  spy();
})();
