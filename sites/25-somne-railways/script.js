/* SOMNE — loader: the compartment needs WebGL2 (half-float, multisampled targets) */
const probe = document.createElement('canvas');
const ok = !!probe.getContext('webgl2');
if (ok) {
  import('/sites/25-somne-railways/journey.js').catch((e) => {
    console.error(e);
    document.documentElement.classList.add('no-gl');
  });
} else {
  document.documentElement.classList.add('no-gl');
}
// captions follow the chapter even without the 3D view
if (!ok) {
  const sections = [...document.querySelectorAll('.berth')];
  const io = new IntersectionObserver((es) => { for (const e of es) e.target.classList.toggle('aboard', e.isIntersecting); }, { threshold: 0.35 });
  sections.forEach((s) => io.observe(s));
}
