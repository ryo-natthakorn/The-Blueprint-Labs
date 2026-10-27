/* ============================================================
   THE TIDELINE — gallery viewer
   Arrow keys, swipe, Escape; focus stays inside while open and
   returns to the picture that opened it.
   ============================================================ */
(function () {
  "use strict";

  var items = Array.prototype.slice.call(document.querySelectorAll(".m-open"));
  var lb = document.getElementById("lightbox");
  if (!items.length || !lb) return;

  var img = document.getElementById("lb-img");
  var cap = document.getElementById("lb-cap-text");
  var ch = document.getElementById("lb-ch");
  var count = document.getElementById("lb-count");
  var btnPrev = document.getElementById("lb-prev"), btnNext = document.getElementById("lb-next"), btnClose = document.getElementById("lb-close");
  var outside = [document.querySelector(".skip-link"), document.querySelector(".site-header"), document.querySelector(".site-footer")]
    .concat(Array.prototype.slice.call(document.querySelectorAll("#main > :not(#lightbox)"))).filter(Boolean);
  var idx = 0, opener = null;

  function show(i) {
    idx = (i + items.length) % items.length;
    var it = items[idx], thumb = it.querySelector("img");
    img.src = thumb.currentSrc || thumb.src;          // the thumbnail shows at once…
    img.alt = thumb.alt;
    var full = new Image();                           // …then the full picture replaces it
    full.onload = function () { if (items[idx] === it) img.src = full.src; };
    full.src = it.getAttribute("data-full");
    cap.textContent = it.getAttribute("data-cap");
    ch.textContent = it.getAttribute("data-ch");
    count.textContent = (idx + 1) + " / " + items.length;
    new Image().src = items[(idx + 1) % items.length].getAttribute("data-full");
  }
  function open(i) {
    opener = items[i];
    show(i);
    lb.hidden = false;
    document.body.classList.add("locked");
    outside.forEach(function (el) { el.setAttribute("inert", ""); });
    btnClose.focus();
  }
  function close() {
    lb.hidden = true;
    document.body.classList.remove("locked");
    outside.forEach(function (el) { el.removeAttribute("inert"); });
    /* back to the picture the guest was looking at */
    (items[idx] || opener).focus();
  }

  items.forEach(function (b, i) { b.addEventListener("click", function () { open(i); }); });
  btnPrev.addEventListener("click", function () { show(idx - 1); });
  btnNext.addEventListener("click", function () { show(idx + 1); });
  btnClose.addEventListener("click", close);
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("lb-stage")) close(); });

  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowLeft") show(idx - 1);
    else if (e.key === "ArrowRight") show(idx + 1);
    else if (e.key === "Tab") {
      var f = [btnClose, btnPrev, btnNext];
      var at = f.indexOf(document.activeElement);
      e.preventDefault();
      f[((e.shiftKey ? at - 1 : at + 1) + f.length) % f.length].focus();
    }
  });

  var x0 = null;
  lb.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 48) show(dx > 0 ? idx - 1 : idx + 1);
    x0 = null;
  }, { passive: true });
})();
