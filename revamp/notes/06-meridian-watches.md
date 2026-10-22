# 06-meridian-watches — Meridian

- **Vertical:** Horology
- **Batch:** 2 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** done
- **Next step:** none — done.

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
_Reviewer: add findings as `- [x] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

Reviewed 2026-10-21 by Claude at 1440x900, 1024x640, 390x844 and 360x640,
motion on and off, scrolled through all six chapters, against
`origin/v1-original` (CDN/font mirror, headless SwiftShader). No console
or page errors, no sideways scroll, back link reachable at every size.
Clear gains: the copy is readable at every width, the mobile layout works
now, and reduced motion gives a composed still for each chapter.
The weak part is the watch itself. It is still built from untouched v1
primitives, so the craft bar in PROTOCOL §5 isn't met yet.

- [x] R1 (must) Copy and model disagree. Chapter II says "Champagne,
  brushed in one direction. Solid silver, sunray-brushed…"
  (`index.html:57-58`), but the new dial is charcoal (`script.js` dial
  canvas, `#393b3a → #111715`). Either go back to a champagne or silver
  sunray dial (the dark one can stay as a variant), or rewrite the chapter.
- [x] R2 (must) The model doesn't hold up as a luxury watch. The lugs are
  plain untapered boxes that float off the case: at 1440x900 scroll 100%
  you can see gaps between the lugs and the case ring. The strap is two
  flat brown slabs with stick stitches. Model a case with integrated,
  tapered lugs (lathe or extruded profile, bevelled) and a strap that
  curves away like it is on a wrist.
- [x] R3 (must) The exploded view doesn't show what the copy promises.
  "Four wheels… four gold wheels" (`index.html:65-67`) shows one visible
  gear. "Signed where only you will look… engraved with its assembler's
  initials" (`index.html:81-82`) shows a plain grey caseback with dashes.
  The rotor can't be told apart. At the final frame the dial sits behind
  the case ring, so only "…IAN" of the wordmark shows, and the parts read
  as overlapping discs. Lay the stack out so every part is fully visible
  at its own chapter: a movement plate with bridges, jewels and four
  toothed wheels, a skeleton rotor, and an engraved caseback with initials
  and a serial.
- [x] R4 (nice) Turning the watch is pointer-only. Arrow keys on a
  focusable canvas would match the other sites.
- [x] R5 (nice) Three.js logs "sigmaRadians… too large and will clip" twice
  on load (PMREM blur). It's harmless, but a smaller blur sigma silences it.

## Fix log

- 2026-10-22 · Codex · T8 implementation: replaced box lugs with bevelled tapered shoulders, curved stitched straps, a skeletal rotor, open toothed wheels with bridges/ruby bearings, and a textured signed caseback. Chapter-centred exploded poses bring each named part forward with the others on a small parts rail. Updated dial copy; added arrow/Home orbit; reduced PMREM sigma. Visual pass removed bearings protruding through the dial and tightened mobile framing.

- R1: fixed in cc4aa7b.
- R1: fixed in cc4aa7b.
- R2: fixed in cc4aa7b.
- R3: fixed in cc4aa7b.
- R4: fixed in cc4aa7b.
- R5: fixed in cc4aa7b.

### T8 verification — 2026-10-22
- check-rules: OK (96 files, 26 projects).
- verify-sites: --only 06,07,08,09,10 --cdn-mirror: all ok; zero console errors, page errors and failed requests. Rechecked 06/07/09 after final visual adjustments.
- Visual check: DONE at 1440×900 and 390×844, motion on and reduced; also 1024×640 and 360×640. No horizontal overflow. Real Google font families and matching CDN npm packages served by the mirror; Chromium uses software WebGL here.
- Thumbnail: regenerated with --force --cdn-mirror --wait 4000 and inspected.
- Interaction checks: All six chapters inspected, arrow/Home orbit works. Dial, gear train, skeletal rotor and signed caseback each take the main stage; other components move onto a parts rail.

### Confirm — 2026-10-22 · Claude (T11)
Checked cc4aa7b at 1440x900 and 390x844, motion on and reduced, through all six chapters (CDN/font mirror, headless SwiftShader). verify-sites `--only 06` ok, zero console/page/request failures; no `sigmaRadians` warning any more.
- R1 confirmed: chapter II now reads "Charcoal, brushed from the centre", matching the charcoal sunray dial.
- R2 confirmed: bevelled shoulders join the case with no gap; straps curve away and carry stitching.
- R3 confirmed: each chapter brings its part to the main stage with the rest on a parts rail — bridges, ruby jewels and four toothed wheels; skeleton rotor over the coiled mainspring; caseback signed "A. L." with a serial.
- R4 confirmed: canvas is focusable; arrows turn it, Home resets.
- R5 confirmed: no PMREM warning in the console.
Result: done.
