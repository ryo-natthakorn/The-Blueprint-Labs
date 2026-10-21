# 07-pulse-athletics — PULSE

- **Vertical:** Boutique Fitness
- **Batch:** 2 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting review
- **Next step:** Claude reviews this site in T5.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** Keep the acid lime/black identity, WORK/REST interval, 40/20 dial, kinetic typography and scrub interaction.

**Weak points (with evidence):** The timer runs on arrival without an obvious start/pause control, while the hint says Space; touch users get no button. The three “BPM/EFFORT” numbers are invented from elapsed time and imply live physiology. Mobile screenshot shows useful content but the bottom marquee and footer are squeezed below the fold, and the dial has no clear progress meaning beyond one dot. Reduced motion freezes at 22 seconds. Audited the live local page at 1440×900 and 390×844 with the CDN/font mirror and read its HTML, CSS and JS.

## Revamp plan
- Turn the dial into a clear 40/20 training instrument with explicit Start/Pause and Reset controls, remaining time, round count and an honest pace cue. Add visible work/rest timeline, tactile phase changes and optional sound toggle. Keep the vivid type, improve mobile control spacing, and make reduced motion a usable paused workout.

## Pass log
- Pass 1: Changed the auto-running demo into a usable 40/20 interval clock with Start/Pause and Reset buttons, remaining time, round count, accessible dial values and honest workout status.
- Pass 2: Restored moving marquee and heartbeat in the default presentation while the session is paused; tightened mobile dial and controls, kept reduced motion static until the visitor starts the timer.
- Pass 3: Checked desktop/mobile, static fallback and the Start/keyboard flow. The timer stays paused on entry, marquee and heartbeat still move in the default view, and the label shows time until the next phase rather than synthetic biometric values.

## Verification
- check-rules: OK (96 files, 26 projects).
- verify-sites: `--only 07 --cdn-mirror` → ok, console 0, page 0, failed requests 0. The mirror served the matching npm CDN packages and local Google font families because the cloud network blocks those CDNs.
- Visual check, desktop 1440x900: done — paused opening, Start/Pause/Reset and dial keyboard preview in live and reduced motion; no side scroll.
- Visual check, mobile 390x844: done — paused opening, Start/Pause/Reset and dial keyboard preview in live and reduced motion; no side scroll.
- Reduced motion: done at both widths; static scene remains composed and controls still work.
- Thumbnail regenerated: yes, forced with `--cdn-mirror`; inspected against the opening scene.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
