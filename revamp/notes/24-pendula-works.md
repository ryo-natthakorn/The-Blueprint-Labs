# 24-pendula-works — PENDULA

- **Vertical:** Kinetic Sculpture
- **Batch:** 5 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** changes requested
- **Next step:** Claude fixes R1 in T20, then Codex confirms in T23.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** PENDULA and the gallery calm. A damped harmonograph drawing live in accumulating ink, strike for a new étude, musical intervals, lifting the pen, Marcellus + Figtree, cream paper and brass.

**Weak points (with evidence):** Audited 2026-10-22 at 1440x900 and 390x844 after 9 s of drawing, motion on and reduced (CDN/font mirror). Read all three files.
- The figure is a scribble, not a harmonograph. Random secondary harmonics (×2–4) break the near-integer ratios that make these drawings beautiful. After 9 s at 1440x900 it's a few lopsided loops, and the reduced-motion "finished" drawing is a tangle around an off-centre knot.
- There is no sculpture. "Kinetic sculpture works" shows two brass dots sliding on hairline rails: no table, pendulums, pen arm or weight, so the mechanism never reads.
- The ink has no character: a uniform 40% grey hairline with no pooling where the pen slows, no paper and no ink choice.
- Every slider move wipes the sheet, and you can't keep a drawing you like.
- Text is 9.3–10.9px (labels, buttons, étude line, footer); the phone hides the y-pendulum.

## Revamp plan
- Build the sculpture in Three.js: a walnut-and-brass rotary harmonograph on a gallery floor. The paper platform rides a gimbaled centre pendulum whose bob swings below the table, and a pen pendulum at the table's edge carries a brass pen arm over the sheet. Every part moves from the same equations that make the drawing.
- Ink on the GPU: each frame's new pen path is drawn as a feathered ribbon into a paper render target that never clears. Width and darkness follow the pen's speed, so ink pools in the slow turns. Three inks.
- A real harmonograph model: two circular/elliptic motions in a musical interval, with a fine detune that makes the figure precess and a gentle decay. Controls for interval, detune, phase, decay and ink, plus Strike, Lift the pen, Look at the drawing (a top-down camera) and Keep the sheet (PNG download).
- Readable type. Reduced motion: the machine rests and the sheet shows a finished étude, redrawn instantly on each change. Lower RT and shadow resolution on phones.

## Pass log
- Pass 1: Rebuilt in Three.js. Walnut table with a well; the centre pendulum carries the sheet platform level on its top while its bob swings below, and the pen arm is hinged on the top of a second pendulum at the far-right corner. Both are tilted exactly so the platform and hinge follow the same equations as the ink. Ink is a feathered ribbon drawn each frame into a 2048² (1024² on phones) sheet target that never clears. It's stored and blended in sRGB so it looks like ink on paper, and the sheet material decodes it. The model is two counter-rotating damped circular motions at the interval ratio with fine detune, which makes rosettes; I checked all six intervals offline before choosing. The camera fits the machine into the free space beside the bench, the fog scales with distance, and the label clears the sculpture. There's a top-down Look view, the PNG Keep works, reduced motion shows a finished étude, and the sheet opens with 14 s already drawn.
- Pass 2: Working gimbals: on each pendulum the outer ring rocks about x and the inner about z, using the same two angles that tilt the rod (Euler XZY). Walnut bridges carry the centre gimbal across the well, the pen pendulum drops through a bored hole, and a brass maker's plaque sits on the near rail. The ink now gathers slightly at the stroke's edge, skips a little on the paper's tooth, and floods into a blot where the nib touches down. Earlier études: every sheet you leave goes into a drawer of four signed prints in the bench, each one still keepable as a PNG.
- Pass 3: Strike now works like a real harmonograph. Both pendulums are drawn back to their start over 0.9 s with the pen raised, then let go, and the pen lowers with a blot, so the machine never jumps. Tablet bench capped at 34rem. Checked at 1280x720, 1024x768 and 768x1024, a keyboard walk shows a visible ring on every control in order, and there's no text under 12px.

## Verification
- check-rules: OK (97 files, 26 projects).
- verify-sites: `--only 24 --cdn-mirror` → console 0, page 0, failed requests 0. CDN mirror used because jsdelivr/cdnjs are blocked here; Google Fonts loaded live.
- Visual check, desktop 1440x900: done (SwiftShader, about 4 fps, so the live drawing advances slowly in captures). The machine sits clear of the label and bench, a rosette is under way on the sheet, and Look, Strike's wind-up, ink switching and the drawer all checked.
- Visual check, mobile 390x844: done. The machine is fitted above the bench, then come the bench, the label and the plaque, with no sideways scroll. Look fits the sheet above the bench.
- Reduced motion: done. The machine rests and the sheet shows a finished étude; each change redraws it at once, and Look jumps without a transition.
- Thumbnail regenerated: yes (`--cdn-mirror --wait 6000`).

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log

### Review in progress — 2026-10-27 · Codex (T17)

Reading the diff against `origin/v1-original` and checking desktop/mobile, normal/reduced motion. The sites are served unchanged; the protocol CDN/font mirror is used for local rendering. Final findings and verification follow below.

### Review result — 2026-10-27 · Codex (T17)

A substantial improvement over the original bare curve: the walnut/brass mechanism follows the pen, the drawing is readable, and Keep downloads an actual signed PNG.

- [ ] R1 (must) Make “Look at the drawing” reveal the sheet on phones. At 390×844 (normal and reduced motion), scroll down to the action buttons and click Look. The button becomes “Back to the room”, but the controls cover the sheet: reproduced at scrollY 611 with the bench spanning y=−107 to 550. The drawing is framed around the upper part of the fixed canvas, behind that panel; only wood/floor remain visible below it. `frameCamera()` uses the bench’s document `offsetTop`, while the mobile bench scrolls, and Look only toggles the camera/body class. Scroll the scene into view on entry, provide an unobstructed drawing view, or adjust the control/scene placement; keep the return control accessible and honour reduced motion. Verify using a real touch/keyboard journey from the controls, not only a top-of-page render.

Checklist verification: diff against `origin/v1-original` read; check-rules OK (99 files, 26 projects); scoped verify-sites `--cdn-mirror` has zero console/page errors and failed requests. Visual check DONE at 1440×900 and 390×844, normal/reduced motion: room, top-down drawing, ink change and lift. Finished reduced-motion étude is composed and static; normal ink advances. Keep downloaded a valid 1024² signed PNG (opened and inspected); source ratio/detune/phase/decay/archive handlers inspected. No horizontal overflow, blank canvas, people/faces or visible DOM text below 11px. Quality tiers, labelled controls and focus styles inspected. Regenerated thumbnail matches the machine. System Chromium/SwiftShader and protocol CDN/font mirror used. The mobile Look obstruction above blocks done.
