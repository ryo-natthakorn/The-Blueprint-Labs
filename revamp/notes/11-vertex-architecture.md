# 11-vertex-architecture — Vertex

- **Vertical:** Architecture Studio
- **Batch:** 3 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** building
- **Next step:** Pass 1 rebuild (plan below).

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
