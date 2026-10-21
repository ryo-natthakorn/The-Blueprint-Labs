# 14-suminaga-teahouse — SUMINAGA

- **Vertical:** Tea House
- **Batch:** 3 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** building
- **Next step:** Pass 1 rebuild (plan below).

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
- Pass 1:
- Pass 2:
- Pass 3:

## Verification
- check-rules:
- verify-sites:
- Visual check, desktop 1440x900:
- Visual check, mobile 390x844:
- Reduced motion:
- Thumbnail regenerated:

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
