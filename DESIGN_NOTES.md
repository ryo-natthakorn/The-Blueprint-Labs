# Design Notes — Phase 2 summary for Phase 3

A brief of what the 25 sites actually look and feel like, so the Hub can
be polished to sit comfortably in front of them. Summary only — nothing
here needs rebuilding.

## Color

- The collection is roughly **70% dark, 30% light**. Dark sites are never
  pure black — each uses a *tinted* near-black: navy blueprint (`#0a1b30`,
  11), void purple (`#0d0116`, 15), walnut (`#171310`, 20), cacao
  (`#170e09`, 23), midnight blue (`#0a0d18`, 25), showroom graphite
  (`#0b0d10`, 19).
- Light sites use warm paper tones, never white: `#f2ecdf` (14 tea house),
  `#f6f0e4` (18 roastery), `#f3f0e7` (22 paper), `#f4f1ea` (24 gallery).
- Every site runs **one saturated accent against a neutral field**: acid
  `#d9ff44` (12), bio-teal `#64f0d2` (13), volt green `#c8f549` (19),
  tangerine `#f2762e` (20), gold `#d4a94e`/`#c9963f` (16, 23), lamp amber
  `#e8b45a` (25), signal red-orange used *only* for warnings/stamps
  (`#ff8f7a`, `#b4432f`).
- Recommended Hub takeaway: tinted near-black field + warm paper text +
  one accent, with per-card accent pulled from each project.

## Typography

- Consistent two-font formula: **a display/serif voice + a workhorse
  UI/mono**, at extreme contrast in size and letterspacing.
- Serif/display voices used: Fraunces (variable, 12), Instrument Serif
  (13), Shippori Mincho (14), Orbitron/Anton/Michroma (tech/retro: 15,
  19, 20), Newsreader (16), Cormorant Garamond (17), DM Serif Display
  (18), Prata (23), Libre Caslon (22), Marcellus (24), Playfair (25),
  Syne (21).
- UI voices: IBM Plex Mono, Space Mono, Space Grotesk, Archivo, Jost,
  Karla, Manrope, Outfit, DM Sans, Chakra Petch, Figtree, Inter Tight.
- Recurring treatments: brand marks tracked very wide (0.3–0.55em
  letterspacing, uppercase); tiny uppercase key labels (~0.55–0.62rem,
  0.2–0.34em tracking) paired with tabular-numeral values — the
  "instrument panel" pattern appears on 11, 13, 16, 18, 19, 21, 25.

## Motion patterns

- **Scroll as narrative device** (13 descent, 22 folding, 25 timetable):
  scroll position maps to a physical quantity (depth, crease angle,
  kilometres), with stations of copy revealed by IntersectionObserver
  (`.lit` / `.set` / `.aboard` classes, ~1s ease, small translateY).
- **Pointer as instrument** (12 type axes, 14 marbling comb, 17 cloth
  hand, 23 stirring): pointer velocity, not just position, drives force.
- **Drag-orbit rigs** (11, 16, 19) all use the same eased spherical
  camera: goal/now pairs lerped at 0.04–0.08 per frame, gentle auto-spin
  that pauses on user drag.
- **Hold-to-act** (18 roast) and **playable loops** (15 game, 20
  turntable, 24 harmonograph) round out the interaction range.
- Universal conventions: goal/current easing everywhere (no tweening
  library needed), `prefers-reduced-motion` freezes ambient time at a
  *formed* moment (t=40–130, never t=0) while keeping user-driven input
  live, DPR capped at 1.25–2, particle/grid counts roughly halved on
  mobile.

## Tech spread (for the /guide page)

- Three.js scenes: 11 (line drawing), 16 (GPU particle shader +
  UnrealBloom), 17 (Verlet cloth), 19 (primitive-built product), 22
  (fold engine).
- Raw WebGL fragment shaders: 08 (raymarch), 21 (FBM sky), 23 (viscous
  melt).
- Canvas 2D systems: 13, 14 (conformal-map marbling), 15 (pseudo-3D
  game), 18, 20, 24, 25.
- DOM/variable-font only: 12. WebAudio: 01, 15 (bleeps), 20 (full
  generative engine).

## Hub guidance

- Cards should carry each site's own accent color and one-line premise —
  the premises are written as hooks in `projects.json` descriptions.
- Keep the Hub itself quiet: the 25 thumbnails are loud and varied, so
  the frame should be the tinted-near-black + paper + tracked-caps system
  above, not another showpiece.
- Honor the 2–3 live iframe cap from CLAUDE.md; every site runs a
  continuous rAF loop and several hold a WebGL context.
