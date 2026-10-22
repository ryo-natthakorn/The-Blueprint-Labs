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
