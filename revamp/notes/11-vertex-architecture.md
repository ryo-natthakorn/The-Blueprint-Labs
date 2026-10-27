# 11-vertex-architecture — Vertex

- **Vertical:** Architecture Studio
- **Batch:** 3 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** done

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

Rendered at 1440x900 and 390x844 (motion on/off): opening draw at 3 s and
11 s, then each of the three drawings. Three.js came from npm through
`scripts/cdn-mirror.js` (this environment blocks cdn.jsdelivr.net).

**Keep:**
- Concept: three unbuilt projects draw themselves line by line on one
  blueprint sheet, with a pen glow, a rewind when you change drawings,
  live counters (height, floors, GFA, status) and a handwritten note.
- The drafting furniture: sheet border, title block with the
  "NOT FOR CONSTRUCTION" stamp, DWG-01/02/03 buttons, redlines.
- Archivo + Caveat, cyan ink on cyanotype blue, coral redline.

**Weak points (with evidence):**
- Every line has the same 1px weight and nothing is hidden. Back edges
  show through the front, so each building reads as wire soup (archive
  at d2: six rings and the inner drum all overlap). Real drawings rely on
  line weight and hidden-line removal.
- The camera doesn't fit the building. At 1440x900 the finished tower
  runs off the top of the sheet (t11). On mobile every drawing overflows
  the screen and runs under the VERTEX header (all four mobile shots).
- The sheet names promise drawings that never appear: "A-201 · ROOF
  PLAN" and "A-301 · SECTION" both show the same perspective wireframe.
- The buildings are diagrams: a tapered box with X-bracing, a grid of
  sticks under a slab, and a ringed cylinder. No facade, no structure
  you can read, no context, and dimension lines carry no numbers.
- Drafting feel is thin. Segments pop in whole, there are no
  construction lines, grid bubbles, level markers or north arrow, and
  the redlines are one plain circle and a stray line.
- Mobile drops the title block, annotations and note entirely. The footer
  wraps into the sheet border at bottom-left.
- The only interactions are orbit and picking a drawing.

## Revamp plan
- **Real drawing technique:** fat lines (LineSegments2) in four weights
  plus construction, dimension and redline pens. Hidden-line removal
  comes from invisible-but-shaded solids under the lines, so buildings
  read as masses. On desktop, hidden edges show faint and dashed.
- **Drafting reveal:** each segment grows from its start point (shader
  clip on a per-segment time window), so the pen visibly travels. Order
  follows practice: construction lines and gridlines with bubbles, site,
  structure bottom-up, facade detail, dimensions with numbers and level
  datums, then a redline revision cloud with a handwritten note.
- **Three real sheets per project:** AXO, PLAN and SECTION. The camera
  dolly-zooms from perspective to near-orthographic, and a clipping plane
  sweeps through the building. Cut solids get hatched poché (back-face
  trick on closed solids), and the title block sheet number updates.
- **Better buildings:** a twisting diagrid tower with podium, canopy,
  crown, core and street context; a Miesian pavilion with a plinth,
  colonnade, glass line, courtyard tree and pool; a ribbed drum archive
  with a spiral ramp, stacks, conical roof and oculus light column.
- **Redline pen:** a tool to mark up the model yourself. Strokes stick to
  surfaces as you orbit and get a handwritten note.
- **Fit and layout:** the camera fits each sheet into the free area
  between the panels. Mobile gets a dock with view, pen and drawing
  tabs, a compact stats strip and a sheet tag.
- **Paper:** a shader sheet with cyanotype mottling, grain, fold creases
  and a crisp grid.
- **Fallbacks:** reduced motion shows each sheet finished with no spin and
  instant cuts. Phones and low-end devices skip the hidden-line pass and
  cap DPR. Without WebGL a still drawing shows and the panels still work.

## Pass log
- Pass 1: Rebuilt the renderer around a drafting clock. Every stroke is
  a LineSegments2 segment with a time window, and a patched LineMaterial
  grows it from its start point, so the pen travels. Six pens (guide
  dashed, light, medium, heavy, dimension, redline) are scheduled by
  phase: construction lines and gridlines with bubbles; site; structure
  bottom-up; facade detail; dimensions, datums, north arrow and section
  marks; redlines. Closed solids under the lines do the hidden-line
  removal and get a shaded fill. Their back faces are hatched, so any
  cut shows poché, including the rising "drafting cut" while a building
  draws. A paper-coloured ground block gives earth poché in section.
  Added AXO / PLAN / SECTION per project: the camera dolly-zooms to near
  orthographic and a clipping plane sweeps in, and the title block and
  sheet tag follow (A-101…A-303). New models: a twisting, tapering
  diagrid tower (podium, canopy, slabs with core and column holes, crown
  lantern, street, crossing, trees, neighbours across the street); a
  Miesian pavilion (plinth and steps, 30 square columns, roof with
  courtyard cut, glass line with mullions, service core, branching
  tree, pool); the ribbed archive drum (base wall, ring beams, 24 ribs,
  glazing, stacks, a spiral ramp solid, conical roof, oculus light
  column, reading tables). Added the redline pen (raycast onto the
  model, notes in Caveat), Redraw, keyboard shortcuts, a paper shader
  (mottling, grain, fold creases, grid), the camera fit to the free area
  between panels, and the mobile dock layout. Fixes found by rendering:
  fills too dark (linear colours written without colour-space
  conversion), the site base read as a black slab (now paper-coloured),
  missing core poché (slabs and the podium roof overlapped the core,
  now cut with holes), labels stacking in plan (each label now lists the
  sheets it shows on), and redline notes that never appeared (label time
  equal to the clock end).
- Pass 2: Polish and missed details. Labels are clamped to a readable
  pixel size in every view (they grew huge in the zoomed sections).
  Vertical dimension text is rotated and the dimension strings sit in
  the section plane, so they read in both axo and section. Datum marks
  have their own pen that only shows on section sheets. Shorter
  redline notes, centred over their cloud on phones; clouds are
  horizontal so they read from every heading. Added a graphic scale bar
  per project, a subtle glass sheen up the curtain wall, and a soft ink
  bleed under the heavy pen (desktop). Respaced collisions (chain
  dimensions around the section line, section marks, north arrows,
  pool and scale bars inside each sheet's frame). Per-sheet framing for
  sections, blended during the dolly so it never jumps. Sheet text now
  changes when the new drawing starts, not while the old one erases.
- Pass 3: Tiers, viewports and fallbacks. Checked 1024x640, 768x1024,
  2560x1080, 844x390, 667x375 and 360x640. Landscape phones got a side
  column for the controls (the dock left the drawing ~150 px tall).
  Labels are now depth-tested, with a pull toward the camera of their
  own height so ground labels stay whole, and no longer show through
  the tower. No-WebGL path: WebGL is probed before Three.js starts (no
  console errors), a finished still of each project swaps in with its
  own alt text, the view tools hide, and the panels keep working.
  Checked the high tier (8 cores emulated: hidden-line dashes and ink
  bleed) and the default mid tier.

## Verification
- check-rules: OK (96 files, 26 projects)
- verify-sites: `--only 11 --cdn-mirror` → ok, console 0, page 0,
  failed requests 0. Three.js, Archivo and Caveat came from local npm
  copies (this environment blocks cdn.jsdelivr.net).
- Visual check, desktop 1440x900: done. All three projects in AXO, PLAN
  and SECTION; the drafting sequence at five times per project; mid
  dolly-zoom; erase-and-redraw when switching; redline pen strokes and
  notes; keyboard focus rings. High tier (8 cores emulated) and mid
  tier. SwiftShader runs at a few fps here, so the clock is time-based.
- Visual check, mobile 390x844: done. All nine sheets, motion on and
  off, plus 360x640, 768x1024 and landscape 844x390 / 667x375.
- Reduced motion: done. Each sheet appears finished, with no spin, no
  pen, and instant cuts and view changes. Labels and notes all show.
- No WebGL: done (Chromium with 3D APIs disabled): per-project stills,
  no errors.
- Thumbnail regenerated: yes, with a new `--wait 15000` flag on
  `scripts/screenshot.js` so the shot shows the finished tower rather
  than the first strokes (default stays 1500 ms).

## Review
Codex · 2026-10-22 · diff reviewed against `origin/v1-original`.

- [x] R1 (must) Replace the hand-drawn pen and redraw SVG masks in `style.css` (`.tool-ico`, `.tool-ico-redraw`) with Font Awesome free icons. AGENTS.md's hard constraint says “Icons: Font Awesome free tier.” These are UI icons rather than the architectural drawing. `check-rules` does not detect this violation. Keep the visible focus and accessible text.

**Reviewer verification:** `check-rules` OK (96 files, 26 projects); scoped `verify-sites --cdn-mirror` console 0, page 0, failed requests 0. Visual check DONE at 1440×900 and 390×844, motion on/off; no horizontal overflow or blank canvas. All three projects in axonometric, plan and section (nine views at both sizes); pointer redline/clear, project controls and keyboard view changes. Thumbnail inspected and matches the rebuilt scene. Procedural imagery contains no people/faces. Mobile/low-core quality limits inspected in code. All checklist items pass except the finding above.

## Fix log

- R1: fixed in d1d9a0a. Pen and Redraw now use Font Awesome 6.5.1 free solid `fa-pen-nib` and `fa-rotate-right` (fontawesome + solid CSS from cdnjs). The CSS-mask SVGs are gone. Labels stay as text on desktop and as visually-hidden text on phones; pressed state and focus ring checked at both widths.

### Fix verification — 2026-10-22 · Claude (T12)
- check-rules: OK (96 files, 26 projects).
- verify-sites: `--only 11,12,14,15 --cdn-mirror` → ok, console 0, page 0, failed requests 0. The mirror served the CDN packages because this environment blocks cdn.jsdelivr.net and cdnjs.
- Visual check: done at 1440x900 and 390x844, motion on and reduced; no sideways scroll, no blank canvas.
- Thumbnail: regenerated (`--wait 15000`, as before) so the toolbar shows the new icons; checked against the previous shot.

### Confirm — 2026-10-27 · Codex (T15)

R1 confirmed: Font Awesome free pen-nib and rotate-right glyphs render on both toolbars, with accessible names and focus styles retained.

Verification: `check-rules` OK (99 files, 26 projects); `verify-sites --only 11,12,14,15 --cdn-mirror` reports zero console/page errors and failed requests. Visual checks DONE at 1440×900 and 390×844, motion on/off. CDN/font mirror used with system Chromium. No site code changed during confirmation.
