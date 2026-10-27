/* ============================================================
   THE TIDELINE — shared behaviour (every page)
   header · drawer · reveals · page wash · tide model · open status
   ============================================================ */
(function () {
  "use strict";

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced() { return motionQuery.matches; }
  /* one motion switch for every scripted scroll on the site */
  function scrollToEl(el, block) {
    if (!el) return;
    el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: block || "start" });
  }

  /* ---- header scroll state -------------------------------- */
  var header = document.querySelector(".site-header");
  function onScroll() { if (header) header.classList.toggle("scrolled", window.scrollY > 24); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- mobile drawer ----------------------------------------
     While open, everything outside the header and drawer is
     inert, Tab cycles inside them, Escape closes and focus goes
     back to the menu button.                                   */
  var burger = document.querySelector(".nav-burger");
  var drawer = document.getElementById("drawer");
  if (burger && drawer && header) {
    var outside = [document.querySelector(".skip-link"), document.getElementById("main"),
      document.querySelector(".site-footer")].filter(Boolean);
    var icon = burger.querySelector(".fa-solid");
    var label = burger.querySelector(".visually-hidden");
    drawer.querySelectorAll(".drawer-nav a").forEach(function (a, i) {
      a.style.transitionDelay = 0.04 + i * 0.04 + "s";
    });
    var isOpen = false;
    var setDrawer = function (open, returnFocus) {
      isOpen = open;
      burger.setAttribute("aria-expanded", String(open));
      if (label) label.textContent = open ? "Close menu" : "Menu";
      if (icon) { icon.classList.toggle("fa-bars", !open); icon.classList.toggle("fa-xmark", open); }
      drawer.classList.toggle("open", open);
      drawer.setAttribute("aria-hidden", String(!open));
      document.body.classList.toggle("locked", open);
      document.body.classList.toggle("menu-open", open);
      outside.forEach(function (el) {
        if (open) el.setAttribute("inert", ""); else el.removeAttribute("inert");
      });
      if (open) {
        var first = drawer.querySelector("a");
        if (first) first.focus({ preventScroll: true });
      } else if (returnFocus) {
        burger.focus();
      }
    };
    drawer.setAttribute("aria-hidden", "true");
    burger.addEventListener("click", function () { setDrawer(!isOpen, true); });
    document.addEventListener("keydown", function (e) {
      if (!isOpen) return;
      if (e.key === "Escape") { e.preventDefault(); setDrawer(false, true); return; }
      if (e.key !== "Tab") return;
      var f = Array.prototype.slice.call(header.querySelectorAll("a, button"))
        .concat(Array.prototype.slice.call(drawer.querySelectorAll("a, button")))
        .filter(function (el) { return el.offsetParent !== null; });
      var at = f.indexOf(document.activeElement);
      if (e.shiftKey && (at <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && at === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    window.addEventListener("resize", function () {
      if (isOpen && window.innerWidth > 1040) setDrawer(false, false);
    });
  }

  /* ---- reveal on scroll ------------------------------------ */
  var revealEls = document.querySelectorAll(".rv");
  if (revealEls.length && "IntersectionObserver" in window && !reduced()) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("on"); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) {
      /* anything in the first screen shows at once */
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("on");
      else io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add("on"); });
  }

  /* ---- page transition wash --------------------------------
     Internal links play a short exit wash, then navigate; the
     next page plays the entrance. Skipped under reduced motion. */
  var wash = document.createElement("div");
  wash.className = "wash";
  wash.setAttribute("aria-hidden", "true");
  document.body.appendChild(wash);
  try {
    if (!reduced() && sessionStorage.getItem("tl-wash") === "1") wash.classList.add("in");
    sessionStorage.removeItem("tl-wash");
  } catch (e) { /* storage blocked: no entrance wash */ }

  function isInternal(a) {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    var href = a.getAttribute("href");
    if (!href || href[0] === "#" || /^(mailto|tel):/.test(href)) return false;
    var url = new URL(a.href, location.href);
    return url.origin === location.origin &&
      url.pathname.indexOf("/sites/26-the-tideline") === 0 &&
      !(url.pathname === location.pathname && url.search === location.search);
  }
  document.addEventListener("click", function (e) {
    if (reduced() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var a = e.target.closest("a");
    if (!a || !isInternal(a)) return;
    e.preventDefault();
    var dest = a.href;
    try { sessionStorage.setItem("tl-wash", "1"); } catch (err) { /* fine */ }
    wash.classList.remove("in");
    wash.classList.add("out");
    var gone = false;
    function go() { if (!gone) { gone = true; location.href = dest; } }
    wash.addEventListener("transitionend", go, { once: true });
    setTimeout(go, 480);
  });
  window.addEventListener("pageshow", function () { wash.classList.remove("out"); });

  /* ---- tide model -------------------------------------------
     A procedural semidiurnal tide for Harrow's Point (fictional):
     12 h 25 min between highs, a spring–neap swing every 14.8
     days, anchored to a fixed high water so every page agrees.
     A real site would read a harbour tide-table feed here.      */
  var PERIOD = 745 * 60000;
  var EPOCH_HIGH = Date.UTC(2026, 0, 1, 3, 17);
  var SPRING = 14.77 * 86400000;
  var MEAN = 2.1;
  function amplitude(t) { return 1.45 + 0.4 * Math.cos(2 * Math.PI * (t - EPOCH_HIGH) / SPRING); }
  function tideHeight(t) {
    var phase = ((t - EPOCH_HIGH) % PERIOD + PERIOD) % PERIOD / PERIOD;
    return MEAN + amplitude(t) * Math.cos(phase * 2 * Math.PI);
  }
  function tideState(now) {
    var t = now === undefined ? Date.now() : now;
    var phase = ((t - EPOCH_HIGH) % PERIOD + PERIOD) % PERIOD;
    var toHigh = (PERIOD - phase) % PERIOD;
    var toLow = (PERIOD / 2 - phase + PERIOD) % PERIOD;
    var amp = amplitude(t);
    var h = tideHeight(t);
    return {
      height: h,
      level: (h - (MEAN - amp)) / (2 * amp),   /* 0 low water … 1 high water */
      rising: toHigh < toLow,
      nextHigh: new Date(t + toHigh),
      nextLow: new Date(t + toLow),
      range: [MEAN - 1.85, MEAN + 1.85]
    };
  }

  function fmtTime(d) {
    var h = d.getHours(), m = d.getMinutes();
    return (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m + " " + (h >= 12 ? "PM" : "AM");
  }

  function paintTide() {
    var s = tideState();
    document.querySelectorAll("[data-tide]").forEach(function (el) {
      var mode = el.getAttribute("data-tide");
      if (mode === "short") el.textContent = (s.rising ? "Tide rising" : "Tide falling") + " · high " + fmtTime(s.nextHigh);
      else if (mode === "height") el.textContent = s.height.toFixed(1) + " m";
      else if (mode === "dir") el.textContent = s.rising ? "rising" : "falling";
      else if (mode === "next-high") el.textContent = fmtTime(s.nextHigh);
      else if (mode === "next-low") el.textContent = fmtTime(s.nextLow);
      else if (mode === "long") el.textContent = (s.rising ? "The tide is coming in" : "The tide is going out") +
        " — high water " + fmtTime(s.nextHigh) + ", low water " + fmtTime(s.nextLow) + ".";
    });
  }

  /* ---- open / closed status ---------------------------------
     Tue–Sun, kitchen 5–10 PM, bar from 4:30; closed Mondays.   */
  function openStatus(now) {
    var d = now || new Date();
    var day = d.getDay(), mins = d.getHours() * 60 + d.getMinutes();
    if (day === 1) return { open: false, text: "Closed Mondays · back Tuesday 5 PM" };
    if (mins < 990) return { open: false, soon: true, text: "Open tonight · 5 – 10 PM" };
    if (mins < 1020) return { open: true, text: "Bar open · kitchen from 5 PM" };
    if (mins < 1320) return { open: true, text: "Open now · until 10 PM" };
    return { open: false, text: day === 0 ? "Closed · back Tuesday 5 PM" : "Closed · back tomorrow 5 PM" };
  }
  function paintOpen() {
    var s = openStatus();
    document.querySelectorAll("[data-open]").forEach(function (el) { el.textContent = s.text; });
    document.querySelectorAll("[data-open-dot]").forEach(function (el) {
      el.classList.toggle("live", s.open);
      el.classList.toggle("shut", !s.open && !s.soon);
    });
    var monday = new Date().getDay() === 1;
    document.querySelectorAll(".hours [data-row]").forEach(function (row) {
      var r = row.getAttribute("data-row");
      row.classList.toggle("today", monday ? r === "monday" : r === "service");
    });
  }

  function tick() { paintTide(); paintOpen(); }
  tick();
  setInterval(tick, 30000);

  /* date stamps, e.g. "Tuesday, October 27" */
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  document.querySelectorAll("[data-today]").forEach(function (el) {
    var d = new Date();
    el.textContent = DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
  });
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* shared helpers for the page scripts */
  window.Tideline = {
    tideState: tideState, tideHeight: tideHeight, fmtTime: fmtTime, openStatus: openStatus,
    MONTHS: MONTHS, DAYS: DAYS, reduced: reduced, scrollToEl: scrollToEl
  };
})();
