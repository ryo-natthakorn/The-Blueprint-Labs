# 07-pulse-athletics — PULSE

- **Vertical:** Boutique Fitness
- **Batch:** 2 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting confirm
- **Next step:** Claude confirms every R item in T11 against cc4aa7b.

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
_Reviewer: add findings as `- [x] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

Reviewed 2026-10-21 by Claude at 1440x900, 1024x640, 390x844 and 360x640,
motion on and off. Tested Start/Pause, Reset, dragging the ring into REST
and Tab focus, against `origin/v1-original` (CDN/font mirror). No console
or page errors and no sideways scroll. The timer is honest and usable now,
which is a real gain. Visually, though, the page is still the v1 layout
with two buttons added, so the craft bar in PROTOCOL §5 isn't met.

- [x] R1 (must) At 1024x640 the phase word wraps: "WORK" breaks into
  "WOR" / "K". `.phase-word` is `clamp(3.4rem, 13vw, 12rem)` in a narrow
  grid column. At the same size the footer's back link runs into the
  bottom marquee.
- [x] R2 (must) Dragging the ring selects the SVG text. After a drag to
  REST at 1440x900 the "0:19" readout has a blue text-selection box on it.
  Add `user-select: none` (and `-webkit-user-select`) to the dial SVG and
  its text, and call `preventDefault` on pointerdown.
- [x] R3 (must) The plan in this note promised "visible work/rest timeline,
  tactile phase changes and optional sound toggle". None of those three
  are in the page (no timeline element, no `navigator.vibrate`, no audio).
  Deliver them, and push the visual craft past v1. For example: a 3-2-1
  slam before each phase, a WORK/REST word that fills or drains with the
  remaining time, a round history strip, and a rest phase that changes
  the whole room (colour and tempo), not just the accent colour.
- [x] R4 (nice) Labels are 0.55–0.62rem grey on black ("WORK : REST",
  "DRAG THE RING…"). They're hard to read at 1440 and on phones. Go to at
  least 0.7rem and raise the contrast.
- [x] R5 (nice) On desktop the right third of the screen is empty. The
  stats column could grow, or the timeline from R3 could live there.

## Fix log

- 2026-10-22 · Codex · T8 implementation: added 40/20 timeline, round history, optional Web Audio cues, 3-2-1 cue, phase haptics where supported, draining word and full-room rest palette. Raised small-label contrast, filled the right column and made short layouts scroll safely. Prevented text selection while scrubbing. Timer now advances by actual elapsed time across a hidden-tab interval.

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
- Interaction checks: Start across 40-second boundary enters REST; optional sound activates, Reset returns 0:40 and round 01. Scrubbing pauses without selecting text. Short layouts scroll; marquees no longer cover the footer. Vibration is feature-detected (no physical haptics in headless Chromium).
