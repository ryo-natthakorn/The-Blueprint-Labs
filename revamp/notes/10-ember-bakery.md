# 10-ember-bakery — Ember

- **Vertical:** Artisan Bakery
- **Batch:** 2 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** changes requested
- **Next step:** Codex works through every R item in T8 (Fix batch 2).

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** Keep the four bread names and copy, hearth/hold-to-stoke concept, editorial serif lettering and firelight palette.

**Weak points (with evidence):** At 1440×900 the oven and flames sit below the viewport edge; the menu occupies a dark empty room with low-contrast copy. At 390×844 the four text blocks fill the entire screen and the fire itself is still below the fold, leaving the flagship interaction visually disconnected. The meter is hidden below the screen. In reduced motion the button cannot change the fire. Audited the live local page at 1440×900 and 390×844 with the CDN/font mirror and read its HTML, CSS and JS.

## Revamp plan
- Move the hearth into the primary composition and give the bread a tangible still-life treatment without people. Make warmth illuminate the menu while preserving readable contrast, put the bellows and gauge in view on mobile, and let both pointer and keyboard presses visibly stoke it. Provide a composed static fire for reduced motion.

## Pass log
- Pass 1: Changed the page to a bread menu beside an in-viewport oven on desktop and a hearth-first composition on mobile; moved the canvas flame source to the oven, added procedural loaf still lifes, and made copy remain legible as fire dims.
- Pass 2: Replaced circular flame particles with tapered tongues, added charred logs and a brighter ember bed, enabled stoking in reduced motion, and moved the mobile footer below the menu.
- Pass 3: Checked the fire and copy in both sizes and motion modes. Curved flame tongues, restrained the reduced-motion flame height, scored the little bread illustrations, and verified the footer no longer overlays mobile prices.

## Verification
- check-rules: OK (96 files, 26 projects).
- verify-sites: `--only 10 --cdn-mirror` → ok, console 0, page 0, failed requests 0. The mirror served the matching npm CDN packages and local Google font families because the cloud network blocks those CDNs.
- Visual check, desktop 1440x900: done — oven, menu, stoking and static fire in live and reduced motion; no side scroll.
- Visual check, mobile 390x844: done — oven, menu, stoking and static fire in live and reduced motion; no side scroll.
- Reduced motion: done at both widths; static scene remains composed and controls still work.
- Thumbnail regenerated: yes, forced with `--cdn-mirror`; inspected against the opening scene.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

Reviewed 2026-10-21 by Claude at 1440x900, 1024x640, 390x844 and 360x640,
motion on and off. Held "stoke" for 3 seconds and watched it settle,
against `origin/v1-original` (CDN/font mirror). No console or page errors
and no sideways scroll, and the body scroll reaches the back link on
phones. Bringing the hearth into view is a real gain. The fire itself is
the weak point.

- [ ] R1 (must) The flames are drawn as separate sharp triangles. Close up
  at 1440x900 and on mobile they read as paper cones or a crystal cluster,
  not fire, and the charred logs (`script.js:146-155`) aren't visible
  under them. Use soft, additive, noise-displaced flame (a shader, or
  layered blurred gradients on the 2D canvas), glowing logs, and heat
  shimmer.
- [ ] R2 (must) The stoke button and meter sit on top of the flames. At
  390x844 the "FIRE: ROARING / LIVELY" label is unreadable over the
  brightest part of the fire, and the button hides the fire's core. Move
  the controls under the oven mouth, or give them a solid field.
- [ ] R3 (must) At 1024x640 the third card's price "— eight" overlaps the
  footer line ("Ember is a fictional bakery…"), and the oven is cut off at
  the bottom.
- [ ] R4 (nice) The loaf illustrations are small identical ovals with two
  stripes. Distinct silhouettes (round miche, rye tin loaf, scored batard,
  a misshapen "mistake") would carry the still-life idea further.

## Fix log
