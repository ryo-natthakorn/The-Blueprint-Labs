# 09-noctua-observatory — Noctua Observatory

- **Vertical:** Public Observatory
- **Batch:** 2 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting review
- **Next step:** Claude reviews this site in T5.

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

## Fix log
