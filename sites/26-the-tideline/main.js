/* ============================================================
   THE TIDELINE — shared behavior (all pages)
   nav · drawer · reveal · page transitions · tide clock
   ============================================================ */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- header scroll state -------------------------------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- mobile drawer --------------------------------------- */
  var burger = document.querySelector(".nav-burger");
  var drawer = document.getElementById("drawer");
  if (burger && drawer) {
    var drawerLinks = drawer.querySelectorAll("a.d-link");
    drawerLinks.forEach(function (a, i) {
      a.style.transitionDelay = 0.06 + i * 0.045 + "s";
    });
    function setDrawer(open) {
      burger.setAttribute("aria-expanded", open);
      drawer.classList.toggle("open", open);
      document.body.classList.toggle("drawer-locked", open);
      if (open) {
        var first = drawer.querySelector("a");
        if (first) first.focus({ preventScroll: true });
      }
    }
    burger.addEventListener("click", function () {
      setDrawer(burger.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("open")) {
        setDrawer(false);
        burger.focus();
      }
    });
  }

  /* ---- reveal on scroll ------------------------------------ */
  var revealEls = document.querySelectorAll(".rv");
  if (revealEls.length && "IntersectionObserver" in window && !REDUCED) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("on");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach(function (el) {
      /* anything already in the first viewport reveals right away —
         the rootMargin would otherwise strand elements hugging the fold */
      if (el.getBoundingClientRect().top < window.innerHeight) {
        el.classList.add("on");
      } else {
        io.observe(el);
      }
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add("on"); });
  }

  /* ---- page transition wash --------------------------------
     Internal link clicks play a short exit wash, then navigate.
     The landing page plays the entrance if we flagged one.     */
  var wash = document.createElement("div");
  wash.className = "wash";
  wash.setAttribute("aria-hidden", "true");
  document.body.appendChild(wash);

  if (!REDUCED && sessionStorage.getItem("tl-wash") === "1") {
    sessionStorage.removeItem("tl-wash");
    /* CSS animation, not JS-driven transforms: it runs on the
       compositor and can't be stranded by a throttled rAF */
    wash.classList.add("in");
  }

  function isInternal(a) {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    var href = a.getAttribute("href");
    if (!href || href[0] === "#" || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return false;
    var url = new URL(a.href, location.href);
    return url.origin === location.origin &&
           url.pathname.indexOf("/sites/26-the-tideline") === 0 &&
           !(url.pathname === location.pathname && url.hash);
  }
  document.addEventListener("click", function (e) {
    if (REDUCED || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var a = e.target.closest("a");
    if (!a || !isInternal(a)) return;
    e.preventDefault();
    var dest = a.href;
    sessionStorage.setItem("tl-wash", "1");
    wash.classList.remove("in");
    wash.classList.add("out");
    var gone = false;
    function go() { if (!gone) { gone = true; location.href = dest; } }
    wash.addEventListener("transitionend", go, { once: true });
    setTimeout(go, 500); // belt and braces if the transition never fires
  });
  window.addEventListener("pageshow", function () {
    // never leave a wash covering a restored/reshown page
    wash.classList.remove("out");
  });

  /* ---- tide clock -------------------------------------------
     Procedural semidiurnal tide for Harrow's Point (fictional).
     Period 12h25m; anchored to a fixed epoch high tide, so the
     readout is deterministic and continuous — a real site would
     pull a NOAA/UKHO feed here instead.                          */
  var TIDE_PERIOD_MIN = 745; // 12 h 25 m
  var EPOCH_HIGH = Date.UTC(2026, 0, 1, 3, 17); // fixed anchor high tide

  function tideState(now) {
    var t = now === undefined ? Date.now() : now;
    var elapsed = (t - EPOCH_HIGH) / 60000; // minutes since anchor high
    var phase = ((elapsed % TIDE_PERIOD_MIN) + TIDE_PERIOD_MIN) % TIDE_PERIOD_MIN;
    var frac = phase / TIDE_PERIOD_MIN;              // 0 = high, .5 = low
    var height = 0.5 + 0.5 * Math.cos(frac * Math.PI * 2); // 1 high → 0 low
    var minsToHigh = (TIDE_PERIOD_MIN - phase) % TIDE_PERIOD_MIN;
    var minsToLow = (TIDE_PERIOD_MIN * 0.5 - phase + TIDE_PERIOD_MIN) % TIDE_PERIOD_MIN;
    var rising = minsToHigh < minsToLow;
    return {
      height: height,
      rising: rising,
      nextHigh: new Date(t + minsToHigh * 60000),
      nextLow: new Date(t + minsToLow * 60000)
    };
  }

  function fmtTime(d) {
    var h = d.getHours(), m = d.getMinutes();
    var ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + (m < 10 ? "0" : "") + m + " " + ap;
  }

  function paintTide() {
    var s = tideState();
    document.querySelectorAll("[data-tide]").forEach(function (el) {
      var mode = el.getAttribute("data-tide");
      if (mode === "short") {
        el.textContent = (s.rising ? "Tide rising" : "Tide falling") +
          " · high " + fmtTime(s.nextHigh);
      } else if (mode === "next-high") {
        el.textContent = fmtTime(s.nextHigh);
      } else if (mode === "next-low") {
        el.textContent = fmtTime(s.nextLow);
      } else if (mode === "long") {
        el.textContent = (s.rising ? "The tide is coming in" : "The tide is going out") +
          " — next high water " + fmtTime(s.nextHigh) + ", next low " + fmtTime(s.nextLow) + ".";
      }
    });
  }
  paintTide();
  setInterval(paintTide, 30000);

  /* today's date stamps, e.g. "Saturday, July 12" */
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  document.querySelectorAll("[data-today]").forEach(function (el) {
    var d = new Date();
    el.textContent = DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
  });

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* expose for page scripts */
  window.Tideline = { tideState: tideState, fmtTime: fmtTime, MONTHS: MONTHS, DAYS: DAYS };
})();
