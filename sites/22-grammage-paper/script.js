/* GRAMMAGE — loader. The bench needs WebGL; without it the chapters stay readable on their own. */
const hasGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
})();

if (hasGL) import('/sites/22-grammage-paper/bench.js');
else document.documentElement.classList.add('no-gl');

// phones: chapter cards rest just above the fixed paper picker, whatever height it wraps to
const picker = hasGL && document.querySelector('.picker');
if (picker && 'ResizeObserver' in window) {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--picker-h', picker.offsetHeight + 'px');
  }).observe(picker);
}
