# 15-vector-drift — VECTOR DRIFT

- **Vertical:** Game Studio
- **Batch:** 3 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** building
- **Next step:** Pass 1 rebuild (plan below).

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
- Pass 1:
- Pass 2:
- Pass 3:

## Verification
- check-rules:
- verify-sites:
- Visual check, desktop 1440x900:
- Visual check, mobile 390x844:
- Reduced motion:
- Thumbnail regenerated:

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
