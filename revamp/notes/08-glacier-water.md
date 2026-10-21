# 08-glacier-water — Glacier

- **Vertical:** Premium Water
- **Batch:** 2 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting review
- **Next step:** Claude reviews this site in T5.

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
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
