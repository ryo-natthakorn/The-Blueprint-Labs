# 08-glacier-water — Glacier

- **Vertical:** Premium Water
- **Batch:** 2 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting confirm
- **Next step:** Claude confirms every R item in T11 against cc4aa7b.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** Keep the quiet glacial palette, raymarched refractive water, mineral analysis and the promise that pointer movement leaves a brief memory.

**Weak points (with evidence):** At 1440×900 the central content is several disconnected glossy blobs, not a recognizable water product; on 390×844 two merged spheres cover the headline and the text fights the blue caustics. There is no touch affordance or visible response cue. The code exits on no WebGL after setting only a background gradient. Audited the live local page at 1440×900 and 390×844 with the CDN/font mirror and read its HTML, CSS and JS.

## Revamp plan
- Shape the raymarched water into a single sculptural bottle/spring form with rim and mineral detail, keep it away from copy on both widths, and show an interaction trace. Add a still fallback with the same silhouette, make touch interaction explicit, and refine mobile text contrast and safe spacing.

## Pass log
- Pass 1: Rebuilt the raymarched SDF from drifting metaballs into a continuous spring-water vessel with shoulder, neck, rim, refraction and pointer ripples. Rebalanced mobile copy and added a CSS no-WebGL fallback.
- Pass 2: Increased the mobile bottle scale after the first render, added provenance lettering over the band, and tightened text contrast in a frosted mobile card.
- Pass 3: Checked the vessel at both widths and in reduced motion. Increased mobile product scale, placed the source mark on its pale band, and kept the copy on a readable frosted field away from the raymarched bottle.

## Verification
- check-rules: OK (96 files, 26 projects).
- verify-sites: `--only 08 --cdn-mirror` → ok, console 0, page 0, failed requests 0. The mirror served the matching npm CDN packages and local Google font families because the cloud network blocks those CDNs.
- Visual check, desktop 1440x900: done — full vessel and text in live and reduced motion; pointer ripple; CSS fallback with WebGL disabled; no side scroll.
- Visual check, mobile 390x844: done — full vessel and text in live and reduced motion; pointer ripple; CSS fallback with WebGL disabled; no side scroll.
- Reduced motion: done at both widths; static scene remains composed and controls still work.
- Thumbnail regenerated: yes, forced with `--cdn-mirror`; inspected against the opening scene.

## Review
_Reviewer: add findings as `- [x] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

Reviewed 2026-10-21 by Claude at 1440x900, 1024x640, 390x844 and 360x640,
motion on and off. Stirred with the pointer across the vessel and compared
against `origin/v1-original` (CDN/font mirror). No console or page errors
and no sideways scroll. Turning the blobs into one bottle makes the
product readable, which is a real gain. The material and the interaction
are now weaker than v1, though.

- [x] R1 (must) The bottle reads as matte blue resin, not glass holding
  water. There is no water line or meniscus inside, no wall thickness, and
  no refraction of the light shafts behind it. The sides carry a sine
  ripple (`script.js:51`, `0.018 * sin((y + 0.7) * 18.0)`) that looks like
  a dented or melting bottle. The flat base has an aliased corner and no
  contact shadow, so the bottle floats. Model glass walls around an inner
  water body with its own surface, refract the backdrop through it, and
  ground it (shadow or reflection on a surface).
- [x] R2 (must) The signature interaction is nearly gone. In v1 the cursor
  became a body of water that merged into the form. Now the response is a
  0.016-amplitude ripple (`script.js:54`) that is hard to see even while
  you stir. The copy still says "Move a cursor or finger across the
  spring. It remembers, briefly." Make the response obvious. For example,
  the water inside tilts and sloshes toward the pointer, and a fading wake
  shows in the backdrop caustics.
- [x] R3 (nice) At 360x640 the copy card covers everything but the bottle's
  neck. Shrink the card or move the bottle on short phones.
- [x] R4 (nice) The "GLACIER 64° N · SOURCE 04" label is a DOM span laid
  over the shader band. That's fine while the bottle is static, but it
  will drift if R2 makes the vessel move. Draw it in the shader or a
  texture instead.

## Fix log

- 2026-10-22 · Codex · T8 implementation: removed dented sine sides, rounded the base, added refracted light shafts, colourless glass-edge highlights, an inner water-level/meniscus treatment, gesture-driven slosh and fading caustic wake. Label is a canvas texture sampled in the shader; mobile product has its own stage before the copy and can scroll on short phones. Arrow-key and reduced-motion gestures redraw stills.

- R1: fixed in cc4aa7b.
- R1: fixed in cc4aa7b.
- R2: fixed in cc4aa7b.
- R3: fixed in cc4aa7b.
- R4: fixed in cc4aa7b.

### T8 verification — 2026-10-22
- check-rules: OK (96 files, 26 projects).
- verify-sites: --only 06,07,08,09,10 --cdn-mirror: all ok; zero console errors, page errors and failed requests. Rechecked 06/07/09 after final visual adjustments.
- Visual check: DONE at 1440×900 and 390×844, motion on and reduced; also 1024×640 and 360×640. No horizontal overflow. Real Google font families and matching CDN npm packages served by the mirror; Chromium uses software WebGL here.
- Thumbnail: regenerated with --force --cdn-mirror --wait 4000 and inspected.
- Interaction checks: Mouse and arrow gestures tilt the water line and produce a visible wake; reduced motion redraws a still on input. The glass/water optics remain a raymarched surface with analytic interior shading, not a full physical fluid simulation. Mobile content and footer remain below the bottle.
