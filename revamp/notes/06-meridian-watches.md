# 06-meridian-watches — Meridian

- **Vertical:** Horology
- **Batch:** 2 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** changes requested
- **Next step:** Codex works through every R item in T8 (Fix batch 2).

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** Keep the mechanical watch, six disassembly chapters, live hands, dragged orbit, and black/champagne horology palette.

**Weak points (with evidence):** Desktop 1440×900: the ~700px bright dial covers the first heading and most copy. Mobile 390×844: the watch extends beyond both edges and every chapter overlays pale text on the pale dial, making it unreadable. Scroll-end still shows a largely assembled face because separation is mostly along view depth. The crystal is nearly white and the dial lacks a brand or subdial. Reduced motion locks at 55% explosion whatever chapter is visible. Audited the live local page at 1440×900 and 390×844 with the CDN/font mirror and read its HTML, CSS and JS.

## Revamp plan
- Recompose the product to the right on desktop and above a dark text panel on mobile. Darken and engrave the dial, tame crystal glare, and make exploded layers separate visibly sideways as well as in depth. Key each static reduced-motion frame to scroll. Add a chapter progress indicator and a drag affordance.

## Pass log
- Pass 1: Recomposed the Three.js watch to the right on desktop and above the copy on mobile; darkened the dial, added sunray engraving and leather straps, cut crystal glare, and tied reduced-motion stills to scroll.
- Pass 2: Opened the assembled and final chapters at both widths. Added lateral offsets and a turn to the exploded stack; brought the mobile copy into a dark lower field and kept text within the viewport.
- Pass 3: Checked the first and last chapter at 1440×900 and 390×844 with motion on/off. Rotated dial lettering upright, stitched a leather strap, increased exploded-stack turn, and reduced the mobile end-state scale so all layers remain in frame.

## Verification
- check-rules: OK (96 files, 26 projects).
- verify-sites: `--only 06 --cdn-mirror` → ok, console 0, page 0, failed requests 0. The mirror served the matching npm CDN packages and local Google font families because the cloud network blocks those CDNs.
- Visual check, desktop 1440x900: done — first and final chapter, live and reduced motion; dragged orbit and no side scroll.
- Visual check, mobile 390x844: done — first and final chapter, live and reduced motion; dragged orbit and no side scroll.
- Reduced motion: done at both widths; static scene remains composed and controls still work.
- Thumbnail regenerated: yes, forced with `--cdn-mirror`; inspected against the opening scene.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

Reviewed 2026-10-21 by Claude at 1440x900, 1024x640, 390x844 and 360x640,
motion on and off, scrolled through all six chapters, against
`origin/v1-original` (CDN/font mirror, headless SwiftShader). No console
or page errors, no sideways scroll, back link reachable at every size.
Clear gains: the copy is readable at every width, the mobile layout works
now, and reduced motion gives a composed still for each chapter.
The weak part is the watch itself. It is still built from untouched v1
primitives, so the craft bar in PROTOCOL §5 isn't met yet.

- [ ] R1 (must) Copy and model disagree. Chapter II says "Champagne,
  brushed in one direction. Solid silver, sunray-brushed…"
  (`index.html:57-58`), but the new dial is charcoal (`script.js` dial
  canvas, `#393b3a → #111715`). Either go back to a champagne or silver
  sunray dial (the dark one can stay as a variant), or rewrite the chapter.
- [ ] R2 (must) The model doesn't hold up as a luxury watch. The lugs are
  plain untapered boxes that float off the case: at 1440x900 scroll 100%
  you can see gaps between the lugs and the case ring. The strap is two
  flat brown slabs with stick stitches. Model a case with integrated,
  tapered lugs (lathe or extruded profile, bevelled) and a strap that
  curves away like it is on a wrist.
- [ ] R3 (must) The exploded view doesn't show what the copy promises.
  "Four wheels… four gold wheels" (`index.html:65-67`) shows one visible
  gear. "Signed where only you will look… engraved with its assembler's
  initials" (`index.html:81-82`) shows a plain grey caseback with dashes.
  The rotor can't be told apart. At the final frame the dial sits behind
  the case ring, so only "…IAN" of the wordmark shows, and the parts read
  as overlapping discs. Lay the stack out so every part is fully visible
  at its own chapter: a movement plate with bridges, jewels and four
  toothed wheels, a skeleton rotor, and an engraved caseback with initials
  and a serial.
- [ ] R4 (nice) Turning the watch is pointer-only. Arrow keys on a
  focusable canvas would match the other sites.
- [ ] R5 (nice) Three.js logs "sigmaRadians… too large and will clip" twice
  on load (PMREM blur). It's harmless, but a smaller blur sigma silences it.

## Fix log
