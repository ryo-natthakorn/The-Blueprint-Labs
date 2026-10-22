# 22-grammage-paper — GRAMMAGE

- **Vertical:** Paper Goods
- **Batch:** 5 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** awaiting review
- **Next step:** Codex reviews in T17.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** GRAMMAGE and its voice. One cotton-rag sheet folded crease by crease into a dart as you scroll, then flown, with a dashed red flight line. The six chapter copy, Libre Caslon + Archivo Narrow, cream and graphite with the stamp red.

**Weak points (with evidence):** Audited 2026-10-22 at 1440x900 and 390x844 through the whole scroll (CDN/font mirror). Read all three files.
- The folds tear. The engine rotates grid *vertices* by a membership test, and the creases don't run along grid lines. Every fold leaves sawtooth edges: a 1:1 crop of IV (the keel) shows the left edge serrated top to bottom. Folds also stop at 166–172° and later hinges are taken in the flat plane, so flaps can't sit on the layer below.
- On phones the sheet drifts left and is out of frame from fold III to V. The 0.45–0.75 scroll shots at 390x844 show an empty cream page.
- On desktop the sheet sits under the copy. "III. The taper" and "IV. The keel" run over the paper.
- The sheet is a flat grey card floating in cream fog: no surface, no light direction and no crease memory, though the copy says "the first crease is the only one the paper will remember".
- The flight is a crumpled grey shape crossing an empty screen.
- Nothing to choose: a paper atelier where you can't touch the paper. The sub-head is 9.9px and the body copy is grey on cream.

## Revamp plan
- Rewrite the fold engine as exact rigid origami. Precompute the dart's crease pattern by splitting convex facets along each hinge in folded space, carrying flat UVs along. Every crease becomes a real mesh edge. Hinges are re-derived each frame from anchor points on the sheet, so layers land exactly on each other, with stacking offsets from a computed layer order. The spine keeps an 8° valley as its remembered crease.
- Put the sheet on a long linen-covered bench with soft shadows, a bone folder, a pencil and a fanned swatch stack. Fold on the bench, lift the plane upright for the wings, then fly it down the bench to a landing with the dashed trail.
- Make the paper choosable: Kozo 45, Cotton rag 90, Ash 120, Clay 160 gsm. Each changes colour, fibre and tooth, and the flight test reports distance and hang time by weight.
- Lens-shift framing keeps the subject clear of the copy (right of it on desktop, above it on phones). Add a fold rail (I–VI) and a paper picker. Readable type. Reduced motion snaps to each chapter's finished fold and a landed flight.

## Pass log
- Pass 1: Rebuilt the fold engine as exact rigid origami. The dart is folded once in memory, splitting convex facets along each hinge in folded space and carrying flat UVs: 16 facets, area checked equal to the sheet. Each crease is a real mesh edge. At runtime each fold rotates its member facets about a hinge re-derived from anchor points that travel with the sheet, so later folds land exactly on earlier ones, including on the spine's 8° remembered valley. Layers are kept apart by a compacted stacking order, applied only once a facet is laid on another (no seams on the open sheet). New linen bench with soft shadows, a bone folder and a pencil. The sheet folds flat on the bench, lifts upright for the wings, opens its V and flies down the bench to a marked landing, with the dashed trail. Four papers (colour, fibre, tooth, watermark) set distance and hang time. Lens-shift framing, fold rail, paper picker; cards fade near the edges.
- Pass 2: Checked 1024x640, 360x640, 844x390 and no-WebGL. The picker covered the sheet on smaller desktops: the subject now frames above the picker's top edge, and the picker is compact below 1200 wide or 760 tall. Short phones get a tighter card and a higher lens shift, so the sheet keeps the top of the screen. On short landscape the masthead scrolls away instead of sitting on the flight card. A tiny loader now checks for WebGL before importing the bench; without it the chapters stand alone, with no errors.
- Pass 3: Swept every chapter at both widths. The lifted dart was seen from above as a flat grey triangle, so desktop now looks at it side-on and portrait looks along its length (so it fits a narrow screen). Portrait cameras stand further back on the same sightline. Paper read too close to the room, so the background is warmer and darker, the paper has a faint fibre glow (emissive 0.16 of its own colour), and the lift light is brighter. The opening sheet breathes a few degrees on the spine, as if about to be picked up. Props were moved clear of the copy.

## Verification
- check-rules: OK (97 files, 26 projects; the new file is the WebGL loader).
- verify-sites: `--only 22 --cdn-mirror` → ok, console 0, page 0, failed requests 0. The mirror served three@0.166.1 because this environment blocks cdn.jsdelivr.net.
- Visual check, desktop 1440x900: done. Every chapter from flat sheet to landing, all four papers (Clay and Kozo also through the flight), plus 1024x640 and 844x390. No sideways scroll.
- Visual check, mobile 390x844: done, every chapter, plus 360x640.
- Reduced motion: done at both widths. Each chapter shows its finished fold, with no breathing or sway, and the flight chapter shows the landed dart with its full trail.
- No WebGL: the loader skips the bench, and the chapters read on their own with no errors.
- Fold engine check: crease pattern of 16 facets whose flat areas sum to the sheet (2.8000). Every crease is a mesh edge, with no tears or sawtooth at any fold.
- Thumbnail regenerated: yes (`--wait 5000`), opening sheet, checked.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
