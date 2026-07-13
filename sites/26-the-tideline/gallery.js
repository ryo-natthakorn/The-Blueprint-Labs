/* ============================================================
   THE TIDELINE — gallery lightbox
   keyboard (arrows/Esc), swipe, focus handling, captions
   ============================================================ */
(function () {
  "use strict";

  var items = Array.prototype.slice.call(document.querySelectorAll(".m-item"));
  var lb = document.getElementById("lightbox");
  if (!items.length || !lb) return;

  var lbImg = document.getElementById("lb-img");
  var lbCap = document.getElementById("lb-cap-text");
  var lbCount = document.getElementById("lb-count");
  var btnPrev = document.getElementById("lb-prev");
  var btnNext = document.getElementById("lb-next");
  var btnClose = document.getElementById("lb-close");

  var idx = 0, lastFocus = null;

  function show(i) {
    idx = (i + items.length) % items.length;
    var img = items[idx].querySelector("img");
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = items[idx].getAttribute("data-cap") || "";
    lbCount.textContent = (idx + 1) + " / " + items.length;
  }

  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    lb.classList.add("open");
    document.body.classList.add("drawer-locked");
    btnClose.focus();
  }
  function close() {
    lb.classList.remove("open");
    document.body.classList.remove("drawer-locked");
    if (lastFocus) lastFocus.focus();
  }

  items.forEach(function (item, i) {
    item.addEventListener("click", function () { open(i); });
  });
  btnPrev.addEventListener("click", function () { show(idx - 1); });
  btnNext.addEventListener("click", function () { show(idx + 1); });
  btnClose.addEventListener("click", close);
  lb.addEventListener("click", function (e) { if (e.target === lb) close(); });

  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(idx - 1);
    else if (e.key === "ArrowRight") show(idx + 1);
    else if (e.key === "Tab") {
      /* keep focus inside the dialog */
      var focusables = [btnClose, btnPrev, btnNext];
      var at = focusables.indexOf(document.activeElement);
      e.preventDefault();
      var next = e.shiftKey ? at - 1 : at + 1;
      focusables[(next + focusables.length) % focusables.length].focus();
    }
  });

  /* swipe */
  var touchX = null;
  lb.addEventListener("touchstart", function (e) {
    touchX = e.touches[0].clientX;
  }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 48) { if (dx > 0) show(idx - 1); else show(idx + 1); }
    touchX = null;
  }, { passive: true });
})();
