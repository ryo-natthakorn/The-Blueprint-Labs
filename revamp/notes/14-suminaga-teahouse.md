# 14-suminaga-teahouse — SUMINAGA

- **Vertical:** Tea House
- **Batch:** 3 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** awaiting confirm
- **Next step:** Codex confirms R1 in T15.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

Rendered at 1440x900 and 390x844: on load, idle for 6 s, after three
taps and a drag, and after switching tea.

**Keep:**
- The concept: suminagashi, ink floated on water, using the exact
  drop formula (every older point pushed out by
  `sqrt(1 + r²/|P−C|²)`), so the ink is pure geometry and stays sharp.
- Choosing a tea sets the ink colour. The ink / pale / clear ring cycle
  gives the classic concentric rings.
- Shippori Mincho + Zen Kaku Gothic New, the 墨流 crest, and the
  warm paper palette with four tea inks (sumi, matcha, beni, indigo).

**Weak points (with evidence):**
- It looks like clip-art, not ink: flat polygon fills on a flat
  background with one vignette. No paper fibre, no pigment
  granulation, no wet edge, and no sense of water (desktop, every
  frame).
- The comb is a blob pusher. `tine()` falls off with distance to the
  pointer, not to the stroke, so a drag smears the centre into one
  heart-shaped lump instead of drawing fine lines (desktop
  `c-combed`). There is no multi-tine comb, which is how marbling gets
  its patterns.
- Edges facet. Each drop keeps a fixed 170 points however far it is
  stretched, so long combed edges become straight segments.
- Ink pops. Past 64 drops, `drops.shift()` deletes the oldest (outermost)
  ring, so a whole band of ink vanishes at once while you watch.
- The composition is one centred bullseye on a mostly empty sheet, the
  same on every visit (desktop `a-load`, `b-idle`).
- It is a tea house with no menu. The teas are colour buttons with
  three-word notes: no steeping, no price, no story.
- Nothing to take away. Marbling exists to make prints, but the page
  has no way to lay paper on the water. "Still the water" just blanks
  the canvas.
- Mobile: the hint is drawn over the ink and can't be read; the tea row
  scrolls sideways with "Aka Kōcha" cut to "A" and "Yoru Gyokuro"
  off-screen; the footer wraps into a cramped two-column block
  (mobile `a-load` to `d-tea`).
- The water can't be reached by keyboard at all. The only controls are
  the tea buttons and "still the water".

## Revamp plan
- **Render it as ink on water:** keep the exact geometry, drawn to an
  offscreen canvas, and composite it in a Three.js shader. The shader
  adds washi fibre and inclusions, pigment granulation, darker wet edges
  where pigment pools, slight edge softening, a slow sheen on the water,
  and ripple rings that refract the ink wherever a drop lands or the
  stylus passes.
- **Real marbling tools:** a stylus that uses the tine formula against
  distance to the stroke, and a comb tool (seven parallel tines) for
  chevron and nonpareil patterns. Hold to grow a larger drop, shown as a
  ring under your finger. Edges are adaptively resampled so stretched
  ink stays smooth, under a point budget.
- **No pops:** drops are culled only when they are off-screen, or when a
  newer drop that encloses the whole view hides them.
- **Take a print:** a sheet of washi lowers onto the basin, lifts the
  ink off the water, and turns over to show the print, mirrored as real
  prints are. Prints collect in a tray, each labelled with its number and
  tea, and open in a dialog where you can save them as PNG. "Still the
  water" fades the ink away.
- **A real menu:** four teas with kanji, tasting notes, steeping and
  price, plus a short note on what suminagashi is. Each tea's three inks
  show as rings, with the next drop marked.
- **Composition:** a different composed overture each visit
  (concentric sets, then a comb pass). The house pours on its own only
  while you are idle.
- **Layout and access:** desktop menu on the right, tools and actions at
  the bottom, tray at the bottom left. On phones every tea fits on one
  row, the hint moves clear of the ink, and the footer is a single line.
  The basin is focusable: Enter drops ink and the arrow keys draw the
  stylus. Reduced motion stops the swirl and ripples and makes the print
  instant. Without WebGL the ink is drawn directly in 2D and prints
  still work.

## Pass log
- Pass 1: Rebuilt on the same exact maths, now rendered as ink. Drops
  and strokes are polygons drawn to an offscreen canvas, and a Three.js
  shader composites them with pigment granulation, darker wet edges
  where rings meet, slight edge softening, a slow water sheen that leans
  toward the pointer, and ripple rings that refract the ink wherever a
  drop lands or the stylus passes. The stylus is a true tine line
  (falloff by distance to the stroke, not to the pointer), and the comb
  runs seven tines in one fused pass. Holding grows a larger drop, shown
  as a ring. Edges are adaptively resampled under a point budget, and
  drops are culled only when off-screen or hidden under a newer drop
  that wraps the whole view (no more pops). "Take a print" lowers a
  washi sheet, lifts the ink off the water, turns over to show the
  mirrored pull, and files it in a tray; each print opens in a dialog
  with Save. A real menu (four teas with kanji, notes, steeping and
  price, with the next ring marked), a short note on suminagashi, hints
  that walk you from drop to stroke to print, and three composed
  overtures (ringed bouquets, stone, combed nonpareil). The basin takes
  the keyboard: Enter drops, arrows draw.
- Pass 2: From renders. The paper fibres were three fixed angles of
  straight streaks that read as scratched linen; they are now wandering
  isolines of warped noise in loose drifts, plus a cloudy formation,
  so the sheet reads as kozo. The granulation was halved (flat ink
  looked like felt), the stone overture packs its drops, phone drops are
  larger, and the crest gets a paper halo where ink passes under it.
  "Still the water" and tea or tool changes now count as activity, so
  the house no longer pours into water you just stilled. Mouse wakes on
  the water. Layouts: portrait tablets use the stacked phone layout,
  landscape phones get a slim menu column, the tray moves up beside the
  menu on small desktops, print thumbnails have a fixed crop (a portrait
  print made a tall thumb that hit the hint), and kanji no longer split
  across lines.
- Pass 3: Fallbacks and access. Without WebGL the ink canvas is shown
  directly, and drops, strokes, prints and the viewer all work, with no
  console errors (WebGL2 is probed before Three.js tries). Reduced
  motion: the overture appears composed and still, there is no swirl,
  no ripples and no house pours, and a print goes straight to the tray.
  The viewer closes on Esc and returns focus to its thumbnail; the
  status line announces each print. Checked 1440x900, 1024x640,
  768x1024, 844x390, 390x844 and 360x640.

## Verification
- check-rules: OK (96 files, 26 projects)
- verify-sites: `--only 14 --cdn-mirror` → ok, console 0, page 0,
  failed requests 0.
- Visual check, desktop 1440x900: done. All three overtures, drops,
  hold, stylus, comb over a stone field, keyboard drop and draw, Still,
  the print sequence (lower, turn, tray) and the viewer; plus 1024x640
  and 844x390.
- Visual check, mobile 390x844: done. Overture, taps, hold, stylus,
  comb, print, tray and viewer; plus 360x640 and 768x1024.
- Reduced motion: done. Static composed overture, no swirl or ripples,
  instant print. No-WebGL fallback checked at desktop and phone sizes.
- Thumbnail regenerated: yes (`--wait 6500`, after the overture).

## Review
Codex · 2026-10-22 · diff reviewed against `origin/v1-original`.

- [x] R1 (must) Replace the custom inline SVG Stylus and Comb button icons in `index.html` with Font Awesome free icons (or text-only controls). AGENTS.md requires “Icons: Font Awesome free tier.” This concerns the tool pictograms, not the procedural ink or paper texture. Preserve the existing accessible button labels.

**Reviewer verification:** `check-rules` OK (96 files, 26 projects); scoped `verify-sites --cdn-mirror` console 0, page 0, failed requests 0. Visual check DONE at 1440×900 and 390×844, motion on/off; no horizontal overflow or blank canvas. Tea selection, stylus/comb, keyboard nib, print capture, tray/viewer, Escape return and real JPEG download on desktop/mobile. Thumbnail inspected and matches the rebuilt scene. Procedural imagery contains no people/faces. Mobile/low-core quality limits inspected in code. All checklist items pass except the finding above.

## Fix log

- R1: fixed in 1539b97. Stylus and Comb now use Font Awesome 6.5.1 free solid icons: `fa-wand-magic` (a thin stick, the closest free glyph to a stylus) and `fa-ruler-horizontal` flipped so the teeth hang down like a comb. The inline SVGs are gone, and the text labels "Stylus" / "Comb" stay. Pressed state and focus ring checked at both widths.

### Fix verification — 2026-10-22 · Claude (T12)
- check-rules: OK (96 files, 26 projects).
- verify-sites: `--only 11,12,14,15 --cdn-mirror` → ok, console 0, page 0, failed requests 0. The mirror served the CDN packages because this environment blocks cdn.jsdelivr.net and cdnjs.
- Visual check: done at 1440x900 and 390x844, motion on and reduced; no sideways scroll, no blank canvas.
- Thumbnail: regenerated so the bench shows the new icons.
