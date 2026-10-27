/* ============================================================
   THE TIDELINE — reservations flow
   Front-end only, by design: availability comes from a seeded
   PRNG, so the same date always shows the same (realistically
   uneven) availability. TODO: replace this module's availability
   and submit handlers with a real reservation-platform
   integration (Resy / OpenTable / Tock-style API); search for
   "TODO:" below for the exact seams.
   ============================================================ */
(function () {
  "use strict";
  var TL = window.Tideline;

  /* ---------- deterministic PRNG ---------------------------- */
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- config ----------------------------------------- */
  var HORIZON_DAYS = 60;              // tables released 60 days out
  var SLOT_TIMES = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];
  var PEAK = { "19:00": 0.5, "19:30": 0.45, "20:00": 0.55, "18:30": 0.72, "20:30": 0.78 };
  var DAY_BASE = [0.62, 0, 0.72, 0.7, 0.66, 0.48, 0.36]; // Sun..Sat (Mon closed)
  var GROUPS = [
    { name: "Early", note: "5:00 – 6:30", times: ["17:00", "17:30", "18:00", "18:30"] },
    { name: "Peak", note: "7:00 – 8:30", times: ["19:00", "19:30", "20:00", "20:30"] },
    { name: "Late", note: "9:00 – 9:30", times: ["21:00", "21:30"] }
  ];

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + HORIZON_DAYS);

  function dateKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function isClosed(d) { return d.getDay() === 1; }
  /* A rare fully-booked evening reads as real. Deterministic per date. */
  function isFullDay(d) {
    if (isClosed(d)) return false;
    var r = mulberry32(hashStr("full:" + dateKey(d)))();
    var weekend = d.getDay() === 5 || d.getDay() === 6;
    return r < (weekend ? 0.11 : 0.035);
  }

  /* TODO: real integration point — replace with an availability
     API call returning open slots for (date, party).            */
  function slotsFor(d, party) {
    if (isClosed(d) || isFullDay(d)) return [];
    var rand = mulberry32(hashStr("slots:" + dateKey(d) + ":p" + Math.min(party, 5)));
    var base = DAY_BASE[d.getDay()];
    if (party >= 5) base *= 0.78;     // fewer large tables
    var out = SLOT_TIMES.map(function (t) { return { time: t, open: rand() < base * (PEAK[t] || 1) }; });
    /* never strand the guest: quiet nights exist */
    if (!out.some(function (s) { return s.open; })) { out[0].open = true; out[out.length - 1].open = true; }
    /* same day: nothing less than 90 minutes from now */
    var now = new Date();
    if (dateKey(d) === dateKey(now)) {
      out.forEach(function (s) {
        var hm = s.time.split(":"), at = new Date(d);
        at.setHours(+hm[0], +hm[1], 0, 0);
        if (at - now < 90 * 60000) s.open = false;
      });
    }
    return out;
  }
  function openCount(d, party) { return slotsFor(d, party).filter(function (s) { return s.open; }).length; }

  /* ---------- formatting ------------------------------------- */
  var MONTHS = TL.MONTHS, DAYS = TL.DAYS;
  function fmtSlot(t) { var hm = t.split(":"); return (+hm[0] % 12 || 12) + ":" + hm[1] + " PM"; }
  function fmtDateLong(d) { return DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate(); }
  function fmtDateShort(d) { return DAYS[d.getDay()].slice(0, 3) + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate(); }
  function guests(n) { return n + (n === 1 ? " guest" : " guests"); }
  function slotDate(d, t) { var hm = t.split(":"), x = new Date(d); x.setHours(+hm[0], +hm[1], 0, 0); return x; }

  /* ---------- state + steps ---------------------------------- */
  var state = { step: 1, party: null, date: null, time: null };
  var panes = [null, 1, 2, 3, 4].map(function (k) { return k && document.getElementById("pane-" + k); });
  var progBtns = document.querySelectorAll(".res-progress button");
  var nexts = [null, document.getElementById("next-1"), document.getElementById("next-2"), document.getElementById("next-3"), document.getElementById("confirm-btn")];

  function maxReachable() {
    if (state.party === null || state.party >= 8) return 1;
    if (!state.date) return 2;
    if (!state.time) return 3;
    return 4;
  }
  /* go to a step; move focus to its heading unless the caller keeps it */
  function goto(step, keepFocus) {
    var changed = step !== state.step;
    state.step = step;
    panes.forEach(function (p, k) { if (p) p.hidden = k !== step; });
    var reach = maxReachable();
    progBtns.forEach(function (b) {
      var s = +b.getAttribute("data-step");
      b.disabled = s > reach;
      b.classList.toggle("done", s < step);
      if (s === step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    if (step === 2) renderCal();
    if (step === 3) renderSlots();
    paintBar();
    if (changed && !keepFocus) {
      var steps = document.getElementById("res-steps");
      if (steps.getBoundingClientRect().top < 70) TL.scrollToEl(steps, "start");
      panes[step].querySelector("h2").focus({ preventScroll: true });
    }
  }
  progBtns.forEach(function (b) {
    b.addEventListener("click", function () { if (!b.disabled) goto(+b.getAttribute("data-step")); });
  });
  document.querySelectorAll("[data-back]").forEach(function (b) {
    b.addEventListener("click", function () { goto(+b.getAttribute("data-back")); });
  });

  /* ---------- summary (sidebar + phone bar) ------------------- */
  var sumParty = document.getElementById("sum-party"), sumDate = document.getElementById("sum-date"), sumTime = document.getElementById("sum-time");
  function setSum(el, text) { el.textContent = text || "Not chosen"; el.className = text ? "" : "unset"; }
  function paintSummary() {
    setSum(sumParty, state.party && state.party < 8 ? guests(state.party) : "");
    setSum(sumDate, state.date ? fmtDateShort(state.date) : "");
    setSum(sumTime, state.time ? fmtSlot(state.time) : "");
    paintBar();
  }
  var bar = document.getElementById("res-bar"), barSum = document.getElementById("res-bar-sum"), barNext = document.getElementById("res-bar-next");
  var BAR_LABEL = [null, "Choose a date", "Choose a time", "Your details", "Confirm"];
  function paintBar() {
    var bits = [];
    if (state.party && state.party < 8) bits.push(guests(state.party));
    if (state.date) bits.push(MONTHS[state.date.getMonth()].slice(0, 3) + " " + state.date.getDate());
    if (state.time) bits.push(fmtSlot(state.time));
    barSum.textContent = bits.length ? bits.join(" · ") : "Choose a party size";
    var n = nexts[state.step];
    barNext.textContent = BAR_LABEL[state.step];
    barNext.disabled = !n || n.disabled;
  }
  barNext.addEventListener("click", function () {
    var n = nexts[state.step];
    if (state.step === 4) document.getElementById("res-form").requestSubmit();
    else if (n && !n.disabled) n.click();
  });
  /* the bar shows once the flow is on screen, and hides at the confirmation */
  var layout = document.getElementById("res-layout");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { bar.hidden = !en[0].isIntersecting || confirmed; }, { threshold: 0 }).observe(layout);
  }
  var confirmed = false;

  /* ---------- step 1: party ----------------------------------- */
  var partyBtns = document.querySelectorAll(".party-btn");
  var privateRoute = document.getElementById("private-route");
  partyBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var n = +b.getAttribute("data-party");
      state.party = n; state.date = null; state.time = null;   // downstream reset
      partyBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      var isPrivate = n >= 8;
      privateRoute.hidden = !isPrivate;
      nexts[1].disabled = isPrivate;
      paintSummary();
      goto(1, true);
      /* move on deliberately: the next action, or the private-room route for 8+ */
      if (!isPrivate) nexts[1].focus();
      else privateRoute.querySelector("a").focus();
    });
  });
  nexts[1].addEventListener("click", function () { goto(2); });

  /* ---------- step 2: calendar --------------------------------
     A roving tabindex: one day is in the tab order; the arrow keys
     move between open days, Page Up/Down change month.            */
  var calCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  var calGrid = document.getElementById("cal-grid");
  var calMonth = document.getElementById("cal-month");
  var calPrev = document.getElementById("cal-prev"), calNext = document.getElementById("cal-next");
  var focusKey = null;

  function sameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
  function renderCal() {
    calMonth.textContent = MONTHS[calCursor.getMonth()] + " " + calCursor.getFullYear();
    calPrev.disabled = sameMonth(calCursor, today);
    calNext.disabled = sameMonth(calCursor, maxDate);
    calGrid.innerHTML = "";
    var pad = calCursor.getDay();
    var dim = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 0).getDate();
    for (var i = 0; i < pad; i++) {
      var blank = document.createElement("span");
      blank.className = "cal-day blank";
      blank.setAttribute("aria-hidden", "true");
      calGrid.appendChild(blank);
    }
    var tabbable = null, firstOpen = null;
    for (var day = 1; day <= dim; day++) {
      var d = new Date(calCursor.getFullYear(), calCursor.getMonth(), day);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cal-day";
      b.setAttribute("data-key", dateKey(d));
      b.dataset.day = day;
      var past = d < today, far = d > maxDate, closed = isClosed(d);
      var full = !past && !far && isFullDay(d);
      var lbl = fmtDateLong(d), state2 = "";
      if (!past && !far && !closed && !full) {
        var open = state.party ? openCount(d, state.party) : 5;
        if (open <= 3) { b.classList.add("few"); state2 = open + (open === 1 ? " table time" : " table times") + " left"; }
      }
      b.innerHTML = '<span class="dn">' + day + "</span>" + (closed && !past && !far ? '<span class="dt">closed</span>' : full ? '<span class="dt">full</span>' : state2 ? '<span class="dt">few left</span>' : "");
      if (dateKey(d) === dateKey(today)) { b.classList.add("today"); lbl += ", today"; }
      if (closed && !past && !far) b.classList.add("closed");
      if (full) b.classList.add("full");
      b.disabled = past || far || closed || full;
      if (closed) lbl += ", closed"; else if (full) lbl += ", fully booked"; else if (far) lbl += ", not yet released"; else if (past) lbl += ", past";
      else if (state2) lbl += ", " + state2;
      b.setAttribute("aria-label", lbl);
      var sel = state.date && dateKey(state.date) === dateKey(d);
      b.setAttribute("aria-pressed", String(!!sel));
      b.tabIndex = -1;
      if (!b.disabled) {
        if (!firstOpen) firstOpen = b;
        if (sel || (focusKey && focusKey === dateKey(d))) tabbable = b;
      }
      calGrid.appendChild(b);
    }
    (tabbable || firstOpen || calNext).tabIndex = 0;
    nexts[2].disabled = !state.date;
  }
  function openDays() { return Array.prototype.slice.call(calGrid.querySelectorAll(".cal-day:not(.blank):not(:disabled)")); }

  calGrid.addEventListener("click", function (e) {
    var b = e.target.closest(".cal-day");
    if (!b || b.disabled) return;
    var p = b.getAttribute("data-key").split("-");
    state.date = new Date(+p[0], +p[1] - 1, +p[2]);
    state.time = null;
    focusKey = dateKey(state.date);
    paintSummary();
    goto(2, true);
    /* the grid was rebuilt: put focus back on the chosen day */
    var again = calGrid.querySelector('[data-key="' + focusKey + '"]');
    if (again) again.focus();
  });
  calGrid.addEventListener("keydown", function (e) {
    var b = e.target.closest(".cal-day");
    if (!b) return;
    var move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      var btn = e.key === "PageUp" ? calPrev : calNext;
      if (!btn.disabled) { btn.click(); var f = openDays()[0]; if (f) f.focus(); }
      return;
    }
    if (!move && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    var days = openDays();
    if (!days.length) return;
    var target;
    if (e.key === "Home") target = days[0];
    else if (e.key === "End") target = days[days.length - 1];
    else {
      /* the next open day that way: same weekday for up/down, else the nearest open day */
      var cur = +b.dataset.day, byDay = {};
      days.forEach(function (x) { byDay[x.dataset.day] = x; });
      var walk = function (step) {
        for (var dd = cur + step; dd >= 1 && dd <= 31; dd += step) if (byDay[dd]) return byDay[dd];
        return null;
      };
      target = walk(move) || (Math.abs(move) === 7 ? walk(move > 0 ? 1 : -1) : null);
    }
    if (target) {
      days.forEach(function (x) { x.tabIndex = -1; });
      target.tabIndex = 0; target.focus();
    }
  });
  calPrev.addEventListener("click", function () { calCursor.setMonth(calCursor.getMonth() - 1); renderCal(); });
  calNext.addEventListener("click", function () { calCursor.setMonth(calCursor.getMonth() + 1); renderCal(); });
  nexts[2].addEventListener("click", function () { goto(3); });

  /* ---------- step 3: time slots ------------------------------ */
  var groupsEl = document.getElementById("slot-groups");
  var timeHint = document.getElementById("time-hint");
  var tideText = document.getElementById("slot-tide-text");

  /* high water near a slot puts the boats at window height */
  function highNear(d) {
    var s = TL.tideState(slotDate(d, "15:00").getTime());
    var hw = s.nextHigh;
    return hw.getHours() >= 16 && hw.getHours() <= 22 ? hw : null;
  }
  function renderSlots() {
    if (!state.date) return;
    timeHint.textContent = fmtDateLong(state.date) + ", table for " + state.party + ".";
    var hw = highNear(state.date);
    tideText.textContent = hw
      ? "High water around " + TL.fmtTime(hw) + " that evening: times marked with a boat put the boats at window height."
      : "The tide runs low that evening, and the whole channel turns to glass at dusk.";
    groupsEl.innerHTML = "";
    var slots = slotsFor(state.date, state.party);
    if (!slots.some(function (s) { return s.open; })) {
      groupsEl.innerHTML = '<p class="slot-empty">Nothing left that evening. Try a nearby date, or the bar holds twelve seats for walk-ins.</p>';
    } else {
      GROUPS.forEach(function (g) {
        var wrap = document.createElement("div");
        wrap.className = "slot-group";
        var id = "sg-" + g.name.toLowerCase();
        wrap.innerHTML = '<p class="slot-group-name" id="' + id + '">' + g.name + " <span>" + g.note + "</span></p>";
        var grid = document.createElement("div");
        grid.className = "slot-grid";
        grid.setAttribute("role", "group");
        grid.setAttribute("aria-labelledby", id);
        g.times.forEach(function (t) {
          var s = slots.filter(function (x) { return x.time === t; })[0];
          var b = document.createElement("button");
          b.type = "button";
          b.className = "slot";
          b.setAttribute("data-time", t);
          var win = hw && Math.abs(slotDate(state.date, t) - hw) <= 45 * 60000;
          b.innerHTML = fmtSlot(t) + (win && s.open ? '<i class="fa-solid fa-sailboat" aria-hidden="true"></i>' : "");
          b.disabled = !s.open;
          b.setAttribute("aria-label", fmtSlot(t) + (s.open ? (win ? ", near high water" : "") : ", booked"));
          b.setAttribute("aria-pressed", String(state.time === t));
          grid.appendChild(b);
        });
        wrap.appendChild(grid);
        groupsEl.appendChild(wrap);
      });
    }
    nexts[3].disabled = !state.time;
  }
  groupsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".slot");
    if (!b || b.disabled) return;
    state.time = b.getAttribute("data-time");
    groupsEl.querySelectorAll(".slot").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    nexts[3].disabled = false;
    paintSummary();
    goto(3, true);
    /* keep focus where the guest is: on the chosen time */
    var again = groupsEl.querySelector('[data-time="' + state.time + '"]');
    if (again) again.focus();
  });
  nexts[3].addEventListener("click", function () { goto(4); });

  /* ---------- step 4: details + confirm ----------------------- */
  var form = document.getElementById("res-form");
  var fName = document.getElementById("f-name"), fEmail = document.getElementById("f-email");
  var fPhone = document.getElementById("f-phone"), fNote = document.getElementById("f-note");
  function setErr(input, errId, bad) {
    input.setAttribute("aria-invalid", bad ? "true" : "false");
    document.getElementById(errId).classList.toggle("show", bad);
  }
  function validate() {
    var okName = fName.value.trim().length >= 2;
    var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fEmail.value.trim());
    var okPhone = fPhone.value.replace(/\D/g, "").length >= 7;
    setErr(fName, "err-name", !okName);
    setErr(fEmail, "err-email", !okEmail);
    setErr(fPhone, "err-phone", !okPhone);
    return okName && okEmail && okPhone;
  }
  [fName, fEmail, fPhone].forEach(function (f) {
    f.addEventListener("input", function () { if (f.getAttribute("aria-invalid") === "true") validate(); });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) {
      var firstBad = form.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }
    var name = fName.value.trim(), note = fNote.value.trim();
    /* TODO: real integration point — POST the reservation to the
       booking backend here and show its returned confirmation id. */
    var code = "TL-" + String(hashStr(name + dateKey(state.date) + state.time)).slice(0, 4) +
      "ABCDEFGHJKMNPQRSTUVWXYZ"[hashStr(fEmail.value.trim()) % 23];
    var at = slotDate(state.date, state.time), ts = TL.tideState(at.getTime());
    document.getElementById("confirm-line").textContent = "Table for " + state.party + ", " + fmtDateLong(state.date) + " at " + fmtSlot(state.time);
    document.getElementById("cf-name").textContent = name;
    document.getElementById("cf-party").textContent = guests(state.party);
    document.getElementById("cf-date").textContent = fmtDateLong(state.date);
    document.getElementById("cf-time").textContent = fmtSlot(state.time);
    document.getElementById("cf-tide").textContent = ts.height.toFixed(1) + " m and " + (ts.rising ? "rising" : "falling") + " when you sit down";
    document.getElementById("cf-code").textContent = code;
    document.getElementById("cf-note-row").hidden = !note;
    document.getElementById("cf-note").textContent = note;

    confirmed = true;
    bar.hidden = true;
    layout.hidden = true;
    var confirm = document.getElementById("res-confirm");
    confirm.hidden = false;
    TL.scrollToEl(confirm, "start");
    document.getElementById("confirm-title").focus({ preventScroll: true });
  });

  /* add to calendar (.ics) */
  document.getElementById("ics-btn").addEventListener("click", function () {
    var startD = slotDate(state.date, state.time), endD = new Date(startD.getTime() + 2 * 3600000);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    function stamp(d) { return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "T" + p(d.getHours()) + p(d.getMinutes()) + "00"; }
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Tideline//Reservations//EN",
      "BEGIN:VEVENT",
      "UID:" + Date.now() + "@thetideline.example",
      "DTSTAMP:" + stamp(new Date()),
      "DTSTART:" + stamp(startD), "DTEND:" + stamp(endD),
      "SUMMARY:Dinner at The Tideline (table for " + state.party + ")",
      "LOCATION:The Tideline\\, 6 Quay Lane\\, Harrow's Point",
      "DESCRIPTION:Reservation " + document.getElementById("cf-code").textContent + ". Tables are held for fifteen minutes past the hour.",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "the-tideline-reservation.ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  });

  /* start over */
  document.getElementById("again-btn").addEventListener("click", function () {
    state = { step: 0, party: null, date: null, time: null };
    focusKey = null; confirmed = false;
    partyBtns.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
    privateRoute.hidden = true;
    nexts[1].disabled = true; nexts[2].disabled = true; nexts[3].disabled = true;
    form.reset();
    [fName, fEmail, fPhone].forEach(function (f) { f.removeAttribute("aria-invalid"); });
    form.querySelectorAll(".f-err").forEach(function (x) { x.classList.remove("show"); });
    document.getElementById("res-confirm").hidden = true;
    layout.hidden = false;
    paintSummary();
    goto(1);
  });

  paintSummary();
  goto(1, true);
})();
