# 15-vector-drift — VECTOR DRIFT

- **Vertical:** Game Studio
- **Batch:** 3 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** awaiting review
- **Next step:** Codex reviews (T9).

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

Rendered at 1440x900 and 390x844: the title screen, 1.5 s into a run,
after a steer, and 10 s in (on mobile, after the crash screen).

**Keep:**
- The idea: the studio's site is the demo cabinet. It is a playable
  neon lane runner with an attract mode, INSERT COIN / SIGNAL LOST /
  RE-SYNC, a best score kept in `localStorage`, and opt-in WebAudio
  bleeps.
- Night Signal Games, Orbitron + Chakra Petch, and the
  void / pink / cyan / yellow palette.

**Weak points (with evidence):**
- It is the stock synthwave picture, flat: a Canvas 2D banded sun, one
  ridge silhouette, a fixed-perspective grid, triangle pylons and a 2D
  wedge ship. Nothing changes over a run; 10 s in looks like 1.5 s in
  (desktop `b-play` vs `d-later`).
- No sense of speed. Speed tops out at 68 units, the camera never moves
  (no FOV, roll or shake while driving), and there are no streaks,
  particles or trail.
- Thin play. Long empty stretches (desktop `b-play`: an empty road),
  one obstacle and one pickup, no near-miss reward, no multiplier, no
  sectors or difficulty you can see. A crash just restarts.
- The cabinet has nothing around the game: no high-score table, no
  attract loop of screens, nothing about the studio or its other games.
- Mobile: the HUD runs into the studio name ("NIGHT SIGNAL" over
  "SCORE", mobile `b-play`/`c-play2`); the attract ship sits small in
  the corner.
- Reduced motion only freezes the title sky. The crash still shakes the
  screen and fires a full-screen white flash. There is no pause, and
  the canvas is `role="img"` although it is the game.

## Revamp plan
- **Rebuild in Three.js as a real 3D run:** a shader grid road that
  scrolls to the horizon, a banded sun shader with heat shimmer,
  procedural wireframe mountains on both sides, a skyline and stars,
  bloom and a CRT pass (barrel curve, chromatic fringe, scanlines,
  vignette) on desktop.
- **A ship you can feel:** a low-poly hull with glowing edges that banks
  as you steer, an engine light and ribbon trail, FOV that widens with
  speed, speed streaks, and a camera that rolls slightly into turns.
- **Real game design:** pylons, laser gates with one gap, sweepers that
  slide across lanes, and shards to collect. Near misses score and
  build a multiplier. Every 2,000 points a new sector changes the
  palette (sun, grid, haze) under a SECTOR banner, while speed and
  density rise. A crash shatters the hull into edge fragments with a
  short slow-mo.
- **The cabinet:** the attract loop cycles title, high scores, how to
  play, and the studio's other cabinets, while an autopilot drives
  behind them. A local top-five table takes three initials, arcade
  style. Pause on P or Esc (and a button on touch). Sound stays opt-in
  (M or the button): a sequenced bass arpeggio, an engine tone that
  follows speed, and effect bleeps.
- **Layout and access:** HUD and brand laid out so they never collide on
  phones; touch steering by drag or by holding either half of the
  screen. The canvas becomes `role="application"` with instructions,
  and every menu is real buttons.
- **Fallbacks:** reduced motion keeps the game playable but drops shake,
  flash, roll, FOV swing and the autopilot (the attract scene holds
  still). Phones skip bloom and the CRT warp and use fewer mountains and
  streaks. Without WebGL, a static poster with a message.

## Pass log
- Pass 1: Rebuilt as a 3D runner in Three.js. A shader grid road with
  lane lines and bright road edges (the sun laid on it), a banded sun
  with shimmer, endless wireframe ranges displaced in the vertex shader,
  a star dome, speed streaks, and bloom plus a CRT pass (barrel curve,
  chromatic fringe, scanlines, vignette) on desktop. A low-poly hull
  with fat neon edges banks and hovers, with an engine glow and short
  wingtip ribbons. Pylons, laser gates with one way through, sweeping
  drones and shards are pooled. Near misses and threaded gates build a
  multiplier that decays, and score thresholds open sectors that repaint
  sun, grid, haze and hazards under a SECTOR banner. A crash breaks the
  hull into its edges with slow-mo and shake, then SIGNAL LOST with
  stats, a local top-five that takes three initials, RE-SYNC or back
  to the cabinet. The attract loop cycles title, high scores, how to
  play and the studio's other cabinets (dots, paused while you read)
  while an autopilot drives. Pause on P/Esc (button on touch, and when
  the tab hides), drag to steer, M for sound. The synth plays a
  sequenced arpeggio, an engine tone that tracks speed, and effects.
- Pass 2: From play renders. Bloom was turning every line into a bar,
  and the wingtip trails ran past the camera as giant beams; both are
  calmer now. Hazards vanished into the haze at distance, so their
  edges ignore fog, they stand on glowing pads, and pylons are taller;
  the mountains and engine glow are dimmer so hazards read first. The
  sun sits higher and is no longer blown out. Patterns were reworked:
  the slalom had a safe centre lane (now a spine with side gates), a
  zigzag of four-pylon rows forces moves from sector 3, spacing between
  patterns is measured in time so it survives top speed, and steering
  quickens with speed. Text cards got a backing panel for legibility
  over the sun.
- Pass 3: Viewports and polish. Checked 1024x640, 768x1024, 844x390,
  390x844 and 360x640: phones put the HUD under the brand, the camera
  rises and widens its FOV on tall screens, and short screens shrink
  the cabinet. The hull's edges flare on a near miss and the lasers
  hum; camera roll is smoothed and smaller (the autopilot's swerves
  tilted the horizon). Reduced motion: no shake, flash, roll, FOV swing,
  slow-mo, autopilot or card cycling, and the attract scene holds a
  composed pose, while the game itself stays playable. Without WebGL the
  page shows a CSS marquee and says why.

## Verification
- check-rules: OK (96 files, 26 projects)
- verify-sites: `--only 15 --cdn-mirror` → ok, console 0, page 0,
  failed requests 0.
- Visual check, desktop 1440x900 / 1280x800: done. Attract cards,
  runs in sectors 1–3 (gates, drones, zigzag, palettes), steering,
  pause, crash, SIGNAL LOST, initials signing, back to the cabinet;
  sound toggled on with no errors. Gameplay renders used a temporary
  larger frame-time cap (removed before commit) because the software
  renderer here runs at ~3 fps.
- Visual check, mobile 390x844: done. Attract cards, drag steering,
  pause button, over screen; plus 360x640, 768x1024, 844x390, 1024x640.
- Reduced motion: done. Static attract pose, no shake/flash/roll,
  instant transitions; play, pause and signing all work.
- Thumbnail regenerated: yes (`--wait 4000`, attract with a gate).

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
