/* ============================================================
   THE TIDELINE — contact page form
   Client-side only. TODO: wire the submit handler to a real
   backend or form service (see the comment in the HTML).
   ============================================================ */
(function () {
  "use strict";

  /* preselect subject from ?subject= (private-dining page links here) */
  var params = new URLSearchParams(location.search);
  var subject = params.get("subject");
  var select = document.getElementById("c-subject");
  if (subject && select) {
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === subject) { select.selectedIndex = i; break; }
    }
  }

  var form = document.getElementById("c-form");
  if (!form) return;
  var fName = document.getElementById("c-name");
  var fEmail = document.getElementById("c-email");
  var fMsg = document.getElementById("c-msg");

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
    /* TODO: POST to a real endpoint here. */
    form.style.display = "none";
    var ok = document.getElementById("form-ok");
    ok.classList.add("show");
    ok.scrollIntoView({ behavior: "smooth", block: "center" });
  });
})();
