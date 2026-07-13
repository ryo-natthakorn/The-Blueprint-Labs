/* ============================================================
   THE TIDELINE — reservations flow
   Front-end only, by design: availability is generated from a
   deterministic seeded PRNG so the same date always shows the
   same (realistically uneven) availability. TODO: replace this
   module's availability + submit handlers with a real
   reservation-platform integration (Resy/OpenTable/Tock-style
   API) — search for "TODO:" below for the exact seams.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- deterministic PRNG ---------------------------- */
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
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
  var HORIZON_DAYS = 60;             // tables released 60 days out
  var SLOT_TIMES = [                  // service 5:00–10:00 PM
    "17:00", "17:30", "18:00", "18:30", "19:00",
    "19:30", "20:00", "20:30", "21:00", "21:30"
  ];
  var PEAK = { "19:00": 0.5, "19:30": 0.45, "20:00": 0.55, "18:30": 0.72, "20:30": 0.78 };
  var DAY_BASE = [0.62, 0, 0.72, 0.7, 0.66, 0.48, 0.36]; // Sun..Sat (Mon closed)

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + HORIZON_DAYS);

  function dateKey(d) {
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function isClosed(d) { return d.getDay() === 1; } // Mondays

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
    if (party >= 5) base *= 0.78;                 // fewer large tables
    var out = [];
    SLOT_TIMES.forEach(function (t) {
      var p = base * (PEAK[t] || 1);
      out.push({ time: t, open: rand() < p });
    });
    /* never strand the guest: if the generator closed everything,
       reopen the two shoulder slots — quiet nights exist          */
    if (!out.some(function (s) { return s.open; })) {
      out[0].open = true; out[out.length - 1].open = true;
    }
    /* same-day: can't book a slot less than 90 min from now */
    var now = new Date();
    if (dateKey(d) === dateKey(now)) {
      out.forEach(function (s) {
        var hm = s.time.split(":");
        var slotAt = new Date(d); slotAt.setHours(+hm[0], +hm[1], 0, 0);
        if (slotAt - now < 90 * 60000) s.open = false;
      });
    }
    return out;
  }

  /* ---------- formatting ------------------------------------- */
  var MONTHS = window.Tideline.MONTHS, DAYS = window.Tideline.DAYS;
  function fmtSlot(t) {
    var hm = t.split(":"), h = +hm[0];
    return (h % 12 || 12) + ":" + hm[1] + " PM";
  }
  function fmtDateLong(d) {
    return DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate();
  }
  function fmtDateShort(d) {
    return DAYS[d.getDay()].slice(0, 3) + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate();
  }

  /* ---------- state ------------------------------------------ */
  var state = { step: 1, party: null, date: null, time: null, name: "", email: "", phone: "", note: "" };

  /* ---------- step navigation -------------------------------- */
  var panes = {
    1: document.getElementById("pane-1"),
    2: document.getElementById("pane-2"),
    3: document.getElementById("pane-3"),
    4: document.getElementById("pane-4")
  };
  var progBtns = document.querySelectorAll(".res-progress button");

  function maxReachable() {
    if (state.party === null || state.party >= 8) return 1;
    if (!state.date) return 2;
    if (!state.time) return 3;
    return 4;
  }
  function goto(step) {
    state.step = step;
    Object.keys(panes).forEach(function (k) { panes[k].hidden = (+k !== step); });
    var reach = maxReachable();
    progBtns.forEach(function (b) {
      var s = +b.getAttribute("data-step");
      b.disabled = s > reach;
      b.classList.toggle("done", s < step);
      if (s === step) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    if (step === 2) renderCal();
    if (step === 3) renderSlots();
    var stepsEl = document.getElementById("res-steps");
    var top = stepsEl.getBoundingClientRect().top;
    if (top < 60) stepsEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  progBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      if (!b.disabled) goto(+b.getAttribute("data-step"));
    });
  });
  document.querySelectorAll("[data-back]").forEach(function (b) {
    b.addEventListener("click", function () { goto(+b.getAttribute("data-back")); });
  });

  /* ---------- summary ---------------------------------------- */
  function paintSummary() {
    var sp = document.getElementById("sum-party");
    var sd = document.getElementById("sum-date");
    var st = document.getElementById("sum-time");
    if (state.party && state.party < 8) {
      sp.textContent = state.party + (state.party === 1 ? " guest" : " guests");
      sp.className = "";
    } else { sp.textContent = "—"; sp.className = "unset"; }
    if (state.date) { sd.textContent = fmtDateShort(state.date); sd.className = ""; }
    else { sd.textContent = "—"; sd.className = "unset"; }
    if (state.time) { st.textContent = fmtSlot(state.time); st.className = ""; }
    else { st.textContent = "—"; st.className = "unset"; }
  }

  /* ---------- step 1: party ----------------------------------- */
  var partyBtns = document.querySelectorAll(".party-btn");
  var privateRoute = document.getElementById("private-route");
  var next1 = document.getElementById("next-1");
  partyBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var n = +b.getAttribute("data-party");
      state.party = n;
      state.date = null; state.time = null; // downstream reset
      partyBtns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var isPrivate = n >= 8;
      privateRoute.classList.toggle("show", isPrivate);
      next1.disabled = isPrivate;
      paintSummary();
      goto(1); // refresh progress states
      if (!isPrivate) next1.focus();
    });
  });
  next1.addEventListener("click", function () { goto(2); });

  /* ---------- step 2: calendar -------------------------------- */
  var calCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  var calGrid = document.getElementById("cal-grid");
  var calMonth = document.getElementById("cal-month");
  var calPrev = document.getElementById("cal-prev");
  var calNext = document.getElementById("cal-next");
  var next2 = document.getElementById("next-2");
  var DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function sameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }

  function renderCal() {
    calMonth.textContent = MONTHS[calCursor.getMonth()] + " " + calCursor.getFullYear();
    calPrev.disabled = sameMonth(calCursor, today);
    calNext.disabled = sameMonth(calCursor, maxDate);
    calGrid.innerHTML = "";
    DOW.forEach(function (d) {
      var el = document.createElement("span");
      el.className = "cal-dow"; el.textContent = d;
      el.setAttribute("role", "columnheader");
      calGrid.appendChild(el);
    });
    var first = new Date(calCursor);
    var startPad = first.getDay();
    var dim = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 0).getDate();
    for (var i = 0; i < startPad; i++) {
      var blank = document.createElement("span");
      blank.className = "cal-day blank";
      calGrid.appendChild(blank);
    }
    for (var day = 1; day <= dim; day++) {
      (function (day) {
        var d = new Date(calCursor.getFullYear(), calCursor.getMonth(), day);
        var b = document.createElement("button");
        b.type = "button";
        b.className = "cal-day";
        b.textContent = day;
        var past = d < today, far = d > maxDate;
        var closed = isClosed(d), full = isFullDay(d) && !past && !far;
        if (dateKey(d) === dateKey(today)) b.classList.add("today");
        if (closed && !past && !far) b.classList.add("closed");
        if (full) b.classList.add("full");
        b.disabled = past || far || closed || full;
        var lbl = fmtDateLong(d);
        if (closed) lbl += " — closed";
        if (full) lbl += " — fully booked";
        if (far) lbl += " — not yet released";
        b.setAttribute("aria-label", lbl);
        b.setAttribute("aria-pressed", state.date && dateKey(state.date) === dateKey(d) ? "true" : "false");
        b.addEventListener("click", function () {
          state.date = d; state.time = null;
          renderCal(); paintSummary();
          next2.disabled = false;
          goto(2);
        });
        calGrid.appendChild(b);
      })(day);
    }
    next2.disabled = !state.date;
  }
  calPrev.addEventListener("click", function () {
    calCursor.setMonth(calCursor.getMonth() - 1); renderCal();
  });
  calNext.addEventListener("click", function () {
    calCursor.setMonth(calCursor.getMonth() + 1); renderCal();
  });
  next2.addEventListener("click", function () { goto(3); });

  /* ---------- step 3: time slots ------------------------------ */
  var slotGrid = document.getElementById("slot-grid");
  var next3 = document.getElementById("next-3");
  var timeHint = document.getElementById("time-hint");

  function renderSlots() {
    if (!state.date) return;
    timeHint.textContent = fmtDateLong(state.date) + ", table for " + state.party + ".";
    /* evening tide flavor for the chosen date */
    var evening = new Date(state.date); evening.setHours(17, 0, 0, 0);
    var ts = window.Tideline.tideState(evening.getTime());
    var highDinner = ts.nextHigh.getHours() >= 16 && ts.nextHigh.getHours() <= 23;
    document.getElementById("slot-tide-text").textContent = highDinner
      ? "High water around " + window.Tideline.fmtTime(ts.nextHigh) + " that evening — window tables watch the boats come home."
      : "The tide runs low that evening — the whole channel turns to glass at dusk.";

    slotGrid.innerHTML = "";
    var slots = slotsFor(state.date, state.party);
    var anyOpen = slots.some(function (s) { return s.open; });
    if (!anyOpen) {
      var p = document.createElement("p");
      p.className = "slot-empty";
      p.innerHTML = "Nothing left on this evening — try a nearby date, or the bar holds twelve seats for walk-ins.";
      slotGrid.appendChild(p);
    } else {
      slots.forEach(function (s) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "slot";
        b.textContent = fmtSlot(s.time);
        b.disabled = !s.open;
        if (!s.open) b.setAttribute("aria-label", fmtSlot(s.time) + " — booked");
        b.setAttribute("aria-pressed", state.time === s.time ? "true" : "false");
        b.addEventListener("click", function () {
          state.time = s.time;
          slotGrid.querySelectorAll(".slot").forEach(function (x) {
            x.setAttribute("aria-pressed", x === b ? "true" : "false");
          });
          next3.disabled = false;
          paintSummary();
          goto(3);
        });
        slotGrid.appendChild(b);
      });
    }
    next3.disabled = !state.time;
  }
  next3.addEventListener("click", function () { goto(4); });

  /* ---------- step 4: details + confirm ----------------------- */
  var form = document.getElementById("res-form");
  var fName = document.getElementById("f-name");
  var fEmail = document.getElementById("f-email");
  var fPhone = document.getElementById("f-phone");
  var fNote = document.getElementById("f-note");

  function setErr(input, errId, bad) {
    input.setAttribute("aria-invalid", bad ? "true" : "false");
    document.getElementById(errId).classList.toggle("show", bad);
  }
  function validate() {
    var okName = fName.value.trim().length >= 2;
    var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fEmail.value.trim());
    var okPhone = (fPhone.value.replace(/\D/g, "").length >= 7);
    setErr(fName, "err-name", !okName);
    setErr(fEmail, "err-email", !okEmail);
    setErr(fPhone, "err-phone", !okPhone);
    return okName && okEmail && okPhone;
  }
  [fName, fEmail, fPhone].forEach(function (f) {
    f.addEventListener("input", function () {
      if (f.getAttribute("aria-invalid") === "true") validate();
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) {
      var firstBad = form.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }
    state.name = fName.value.trim();
    state.email = fEmail.value.trim();
    state.phone = fPhone.value.trim();
    state.note = fNote.value.trim();

    /* TODO: real integration point — POST the reservation to a
       booking backend here and use its returned confirmation id.  */
    var code = "TL-" + ("" + hashStr(state.name + dateKey(state.date) + state.time))
      .replace(/\D/g, "").slice(0, 4) + "" +
      "ABCDEFGHJKMNPQRSTUVWXYZ"[hashStr(state.email) % 23];

    document.getElementById("confirm-line").textContent =
      "Table for " + state.party + " — " + fmtDateLong(state.date) + " at " + fmtSlot(state.time);
    document.getElementById("cf-name").textContent = state.name;
    document.getElementById("cf-party").textContent = state.party + (state.party === 1 ? " guest" : " guests");
    document.getElementById("cf-date").textContent = fmtDateLong(state.date);
    document.getElementById("cf-time").textContent = fmtSlot(state.time);
    document.getElementById("cf-code").textContent = code;
    var noteRow = document.getElementById("cf-note-row");
    noteRow.hidden = !state.note;
    if (state.note) document.getElementById("cf-note").textContent = state.note;

    document.getElementById("res-steps").parentElement.classList.add("confirmed");
    document.getElementById("res-steps").style.display = "none";
    document.getElementById("res-side").style.display = "none";
    var confirm = document.getElementById("res-confirm");
    confirm.classList.add("show");
    confirm.scrollIntoView({ behavior: "smooth", block: "start" });
    var h = confirm.querySelector("h2");
    h.setAttribute("tabindex", "-1");
    h.focus({ preventScroll: true });
  });

  /* add-to-calendar (.ics) */
  document.getElementById("ics-btn").addEventListener("click", function () {
    var hm = state.time.split(":");
    var startD = new Date(state.date); startD.setHours(+hm[0], +hm[1], 0, 0);
    var endD = new Date(startD.getTime() + 2 * 3600000);
    function icsStamp(d) {
      function p(n) { return (n < 10 ? "0" : "") + n; }
      return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
        "T" + p(d.getHours()) + p(d.getMinutes()) + "00";
    }
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Tideline//Reservations//EN",
      "BEGIN:VEVENT",
      "UID:" + Date.now() + "@thetideline.example",
      "DTSTART:" + icsStamp(startD),
      "DTEND:" + icsStamp(endD),
      "SUMMARY:Dinner at The Tideline (table for " + state.party + ")",
      "LOCATION:The Tideline\\, 6 Quay Lane\\, Harrow's Point",
      "DESCRIPTION:Reservation " + document.getElementById("cf-code").textContent +
        ". Tables are held for fifteen minutes past the hour.",
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
    state = { step: 1, party: null, date: null, time: null, name: "", email: "", phone: "", note: "" };
    partyBtns.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
    privateRoute.classList.remove("show");
    next1.disabled = true; next2.disabled = true; next3.disabled = true;
    form.reset();
    document.getElementById("res-confirm").classList.remove("show");
    document.getElementById("res-steps").style.display = "";
    document.getElementById("res-side").style.display = "";
    paintSummary();
    goto(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  paintSummary();
  goto(1);
})();
