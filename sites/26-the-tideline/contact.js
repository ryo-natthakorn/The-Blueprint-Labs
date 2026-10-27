/* ============================================================
   THE TIDELINE — contact page form
   Client-side only. TODO: wire the submit handler to a real
   backend or form service (see the comment in the HTML).
   ============================================================ */
(function () {
  "use strict";
  var TL = window.Tideline;
  var form = document.getElementById("c-form");
  if (!form) return;

  var pd = document.getElementById("pd-fields");
  var fFormat = document.getElementById("c-format"), fGuests = document.getElementById("c-guests"), fDate = document.getElementById("c-date");
  var fName = document.getElementById("c-name"), fEmail = document.getElementById("c-email"), fMsg = document.getElementById("c-msg");
  var FORMATS = { room: "Private room", tasting: "Chef's tasting", buyout: "Full buyout" };
  var SUBJECTS = { general: "A general question", "private-dining": "Private dining & events", press: "Press", suppliers: "Selling us something" };

  function subject() { return form.querySelector('input[name="subject"]:checked').value; }
  function syncIntent() { pd.hidden = subject() !== "private-dining"; }
  form.querySelectorAll('input[name="subject"]').forEach(function (r) { r.addEventListener("change", syncIntent); });

  /* arriving from Private Dining or Reservations: ?subject=private-dining&format=…&guests=… */
  var q = new URLSearchParams(location.search);
  var s = q.get("subject");
  if (s) {
    var r = form.querySelector('input[name="subject"][value="' + s + '"]');
    if (r) r.checked = true;
  }
  if (q.get("format") && FORMATS[q.get("format")]) fFormat.value = q.get("format");
  if (q.get("guests") && +q.get("guests") > 0) fGuests.value = Math.min(40, Math.max(1, +q.get("guests")));
  if (s === "private-dining" && (q.get("format") || q.get("guests"))) {
    var from = document.getElementById("pd-from");
    from.hidden = false;
    from.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>Carried over from the planner: ' +
      FORMATS[fFormat.value] + ", " + fGuests.value + " guests. Change anything below.";
  }
  syncIntent();
  /* no dates in the past for an event */
  var t = new Date();
  fDate.min = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");

  function setErr(input, errId, bad) {
    input.setAttribute("aria-invalid", bad ? "true" : "false");
    document.getElementById(errId).classList.toggle("show", bad);
  }
  function validate() {
    var okName = fName.value.trim().length >= 2;
    var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fEmail.value.trim());
    var okMsg = fMsg.value.trim().length >= 5;
    setErr(fName, "c-err-name", !okName);
    setErr(fEmail, "c-err-email", !okEmail);
    setErr(fMsg, "c-err-msg", !okMsg);
    return okName && okEmail && okMsg;
  }
  [fName, fEmail, fMsg].forEach(function (f) {
    f.addEventListener("input", function () { if (f.getAttribute("aria-invalid") === "true") validate(); });
  });

  function row(dt, dd) {
    var d = document.createElement("div");
    d.className = "row";
    var a = document.createElement("dt"); a.textContent = dt;
    var b = document.createElement("dd"); b.textContent = dd;
    d.appendChild(a); d.appendChild(b);
    return d;
  }

  var ok = document.getElementById("form-ok");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) {
      var firstBad = form.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return;
    }
    /* TODO: POST to a real endpoint here and use its reference. */
    var sub = subject();
    var ref = "ENQ-" + String(Math.abs(fEmail.value.length * 7919 + Date.now() % 100000)).slice(-5);
    var recap = document.getElementById("ok-recap");
    recap.innerHTML = "";
    recap.appendChild(row("About", SUBJECTS[sub]));
    recap.appendChild(row("From", fName.value.trim() + " · " + fEmail.value.trim()));
    if (sub === "private-dining") {
      recap.appendChild(row("Format", FORMATS[fFormat.value] + ", " + fGuests.value + " guests"));
      if (fDate.value) {
        var p = fDate.value.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
        recap.appendChild(row("Date", TL.DAYS[d.getDay()] + ", " + TL.MONTHS[d.getMonth()] + " " + d.getDate() + (d.getDay() === 1 ? " (we're closed Mondays; we'll suggest the nearest night)" : "")));
      }
    }
    recap.appendChild(row("Reference", ref));
    var steps = sub === "private-dining"
      ? ["We check the room for your date today.", "Within a day: a menu sketch for the season and a per-head figure.", "One deposit holds the night; the menu is written that morning."]
      : sub === "press"
        ? ["Your note goes straight to the front of house manager.", "We answer within a day, usually sooner."]
        : sub === "suppliers"
          ? ["The kitchen reads these on Tuesday mornings.", "If it fits the menu, we'll ask for a sample box."]
          : ["Someone from the floor team reads every message.", "We answer within a day."];
    var next = document.getElementById("ok-next");
    next.innerHTML = "";
    steps.forEach(function (sTxt) { var li = document.createElement("li"); li.textContent = sTxt; next.appendChild(li); });
    document.getElementById("ok-lede").textContent = "Thanks, " + fName.value.trim().split(" ")[0] + ". Here's what happens next.";

    form.hidden = true;
    ok.hidden = false;
    TL.scrollToEl(ok, "start");
    document.getElementById("ok-title").focus({ preventScroll: true });
  });

  document.getElementById("ok-again").addEventListener("click", function () {
    form.reset();
    [fName, fEmail, fMsg].forEach(function (f) { f.removeAttribute("aria-invalid"); });
    form.querySelectorAll(".f-err").forEach(function (x) { x.classList.remove("show"); });
    syncIntent();
    ok.hidden = true;
    form.hidden = false;
    fName.focus();
  });
})();
