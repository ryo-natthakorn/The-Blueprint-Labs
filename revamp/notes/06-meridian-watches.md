# 06-meridian-watches — Meridian

- **Vertical:** Horology
- **Batch:** 2 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting review
- **Next step:** Claude reviews this site in T5.

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

## Fix log
