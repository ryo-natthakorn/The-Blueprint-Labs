# 09-noctua-observatory — Noctua Observatory

- **Vertical:** Public Observatory
- **Batch:** 2 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** changes requested
- **Next step:** Codex works through every R item in T8 (Fix batch 2).

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** Keep the explorable star chart, authored constellation stories, RA readout, warm star accents and observatory night palette.

**Weak points (with evidence):** The initial 1440×900 sky is mostly empty dark space with isolated stars; on 390×844 the “Tonight” list is absent and finder text overlaps the brand. Constellations only reveal near an invisible probe, so the first screen gives no target or invitation; mobile may never discover a story. The canvas is focused for keyboard panning but there is no visible focus or direct constellation selector. Audited the live local page at 1440×900 and 390×844 with the CDN/font mirror and read its HTML, CSS and JS.

## Revamp plan
- Seed the first view with a clearly drawn constellation and add a small observatory guide: named targets that jump the sky to each story. Increase star density on mobile, show a reticle and navigation hint, restore Tonight information in compact form, and keep keyboard/reduced-motion usable.

## Pass log
- Pass 1: Centered the opening view on Noctua, increased seeded star density, added a visible finder reticle and seven direct constellation targets. Replaced the hidden mobile Tonight list with a collapsible schedule.
- Pass 2: Placed mobile brand, RA, schedule, finder targets and story card in separate zones; ensured target buttons can drive the same story as pointer and keyboard exploration.
- Pass 3: Checked all viewport/motion combinations and a direct jump to The Kiln. The opening namesake is visible, the mobile target strip is scrollable, and the chosen target now has a persistent active state.

## Verification
- check-rules: OK (96 files, 26 projects).
- verify-sites: `--only 09 --cdn-mirror` → ok, console 0, page 0, failed requests 0. The mirror served the matching npm CDN packages and local Google font families because the cloud network blocks those CDNs.
- Visual check, desktop 1440x900: done — opening Noctua and a direct jump to The Kiln, in live and reduced motion; no side scroll.
- Visual check, mobile 390x844: done — opening Noctua and a direct jump to The Kiln, in live and reduced motion; no side scroll.
- Reduced motion: done at both widths; static scene remains composed and controls still work.
- Thumbnail regenerated: yes, forced with `--cdn-mirror`; inspected against the opening scene.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

Reviewed 2026-10-21 by Claude at 1440x900, 1024x640, 390x844 and 360x640,
motion on and off. Tested the target buttons (jump to The Kiln) and
dragging the sky, against `origin/v1-original` (CDN/font mirror). No
console or page errors and no sideways scroll. The finder targets and the
seeded opening view fix v1's "empty sky" problem. The sky rendering itself
is unchanged from v1.

- [ ] R1 (must) The story card covers the constellation it describes. On
  the opening view at 1440x900 and 1024x640 the card hides Noctua's lower
  stars and legs. At 360x640 it covers the bottom star. Place the card
  beside the figure (desktop) or offset the sky so the figure sits fully
  above the card (mobile).
- [ ] R2 (must) The Milky Way band shows a regular dot-grid (screen-door)
  pattern at every size (crop at 1440x900, centre of screen). It's a v1
  artifact that is still there, and it's the largest surface on the page.
  Render the band as smooth noise, or dither at sub-pixel level.
- [ ] R3 (nice) Beyond the finder, the sky is the same 2D canvas as v1.
  Room to raise craft: star colour by temperature, real twinkle and
  scintillation near the horizon, a dome/ridge silhouette with a slit of
  warm light, and constellation art that fades in under the line figure
  (the owl reads as a kite with legs right now).

## Fix log
