# 24-pendula-works — PENDULA

- **Vertical:** Kinetic Sculpture
- **Batch:** 5 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** building
- **Next step:** Pass 1 rebuild (plan below).

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
