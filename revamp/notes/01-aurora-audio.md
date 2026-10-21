# 01-aurora-audio — Aurora Audio

- **Vertical:** Consumer Audio
- **Batch:** 1 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** awaiting review
- **Next step:** Codex reviews (T2)

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

Rendered at 1440x900 and 390x844 (motion on/off), intro and listening
states. This environment blocks cdn.jsdelivr.net, so Three.js was served
from the same npm version through `scripts/cdn-mirror.js`.

**Keep:**
- Concept: a headphone brand that makes sound visible. Visitor starts a
  generative synth and the field reacts to it.
- "hear / the / light." headline in Unbounded with the aurora gradient
  on "light.", and the round "Begin listening" CTA with its pulse ring.
- Three moods (Aurora I / Borealis / Zenith) and Mute as chips, the HUD
  idea ("Now generating", "Driver response").
- Palette: near-black navy, aurora green #46f0c0, violet #7a5cff,
  pink #ff5ca8.

**Weak points (with evidence):**
- The field is a fixed torus-knot point cloud wobbled by sine noise
  (`script.js` 35–49, `wobble()`), so in the listening state it reads as a
  dotted donut. Nothing in its shape follows the music: audio only scales
  it (`breathe`) and tints it (`uTreble`). The spectrum is never visible.
- Audio analysis is three averaged bands (`sampleAudio`). The "dB"
  readout is `20·log10(smoothedLevel)` of that average, not a level
  measurement. The 5 HUD bars sample bins 2, 7, 12… of a 256-bin FFT,
  so they mostly show the low end.
- Mobile 390px: no bloom, alpha 0.35, and a portrait frustum spread the
  4,500 points so thin that the intro field is almost invisible
  (screenshot: intro is black text on black). Listening state on mobile
  is a faint scatter.
- Intro: particles run behind the sub-paragraph and the CTA (desktop
  screenshot). Body copy at #8b93ad on moving dots is hard to read.
- Listening state on desktop: the ring drifts off-centre to the last
  cursor position (camera parallax never recentres), leaving the right
  third empty.
- Nothing to *play*. The cursor only pushes points away. No way to back
  out of the listening state, no keyboard shortcuts, and the hint says
  "move your cursor" on touch devices.
- Sound is four detuned oscillators per chord plus a sub, through one
  lowpass and one feedback delay. Pleasant but thin: no reverb, no
  melodic layer, every mood has the same rhythm.
- No product. It's a headphone brand and no headphone ever appears.
- No WebGL: the code sets a gradient, then rethrows and kills the page
  script, so the CTA stops working.
- Film grain is a 200%-size DOM layer animated with `steps()`, which
  repaints the full screen 4 times a second on top of WebGL.

## Revamp plan
- **Product first:** at intro, ~65k particles (16k on mobile) hold the
  shape of a headphone (headband, yokes, cups, cushions sampled with
  `MeshSurfaceSampler`). It turns slowly, the cursor tilts it, and it
  sits right of the headline instead of behind the copy.
- **The aurora is the spectrum:** on "Begin listening" the headphone
  breaks apart and the particles flow into folded aurora curtains. Each
  particle's position along the curtain maps to a log-spaced frequency
  bin (128 bins from a 2048 FFT, uploaded as a texture every frame), so
  ray height and brightness *are* the live spectrum. Rays climb and
  shimmer, low = green, mid = violet, high = pink. A mirrored, dimmer
  copy below gives a dark-glass floor reflection.
- **Playable:** click or tap the field to pluck a bell tone whose pitch
  follows x (pentatonic, in key with the current chord). Each pluck sends
  a ripple through the curtain. A cursor readout shows the frequency
  under the pointer.
- **Richer generative score:** detuned pad + sub + a sparse bell
  arpeggio per mood, through a generated convolution reverb and the
  delay. Each mood gets its own tempo, register and timbre.
- **Honest HUD:** real RMS dBFS level, a 32-band log spectrum strip, a
  chord name, and a mood indicator. Keys 1/2/3 pick a mood, M mutes, Esc
  goes back to the intro.
- **Post:** bloom on desktop, plus one final pass for vignette, faint
  chromatic fringe and grain (replaces the DOM grain layer). Mobile skips
  bloom and gets brighter glow sprites instead.
- **Fallbacks:** reduced motion renders finished still frames of the
  headphone and the curtain (redrawn on mood change, no continuous
  animation). No WebGL keeps a CSS aurora gradient and a working synth
  and HUD.

## Pass log
- Pass 1: Rebuilt scene, audio, HUD and layout. Headphone (band,
  rails, yokes, oval cups, plates, cushions) sampled into 65,536 points
  (20,000 on phones/low-core), lit with Lambert + rim + an aurora sheen,
  assembling from a cloud on load, mirrored on a dark-glass floor. On
  "Begin listening" each point morphs (staggered, with a noise swirl)
  into one of three spectrum-drawn aurora curtains. First try with
  points alone read as dots, so I added real ribbon meshes (3 layers,
  320 segments, soft skirt under the hem, ray striations) whose top edge
  is the 128-band log spectrum. The points now ride the ribbons as
  sparks. Spectrum: 2048 FFT → 128 log bands 40 Hz–12 kHz, contrast
  stretch + high-frequency tilt + neighbour blur, fast attack / slow
  release. Score rebuilt: 4-voice detuned pad, sub, FM bell arpeggio
  (per-mood scale, tempo, decay, FM ratio), generated convolution
  reverb, filtered feedback delay, compressor. Every bell and chord root
  sends a ripple to its own frequency on the curtain. Click/tap plucks a
  quantised bell where you point. HUD: real RMS dBFS, chord name,
  64-bar log spectrum strip with Hz axis, cursor Hz readout, keys
  1/2/3/M/Esc, Back button. Desktop post: bloom, then vignette, radial
  chroma and grain in one pass (the DOM grain is static and only shows
  without post). Layout: headline left with product right on desktop,
  product above the copy on portrait, pill CTA on phones. Reduced
  motion: still frames for intro and listening, re-rendered for each
  chord. No WebGL: CSS aurora, and the synth and HUD still run.
- Pass 2: Transition and interaction polish. Cups rebuilt as one
  lathed shell with a domed back (the cylinder read as a box). During the
  morph the shape now lifts as it dissolves, and the curtains grow up
  from the hem instead of fading in at full height. Cursor-to-band
  mapping now raycasts onto the middle curtain's depth (z = -1); before
  that, a click at 72% of the width rippled at about 55%. Pluck ripple
  made stronger. HUD: smoothed dBFS readout at about 8 Hz (it flickered
  every frame), peak-hold markers on the spectrum strip, and a short
  blur-in when the chord name changes.
- Pass 3: Responsiveness, tiers and accessibility. Checked 844x390,
  768x1024, 1024x768, 1280x720, 1366x768 and 2560x1080. Short landscape
  screens collided with the header and footer, so I added height-driven
  type and spacing rules (≤820px, ≤660px hides specs, ≤500px gets a pill
  CTA and a compact dock). This container reports 4 cores, so every
  desktop shot until then was the mid tier. With 8 cores emulated, the
  high tier was overexposed, with lifted blacks. Cause: under the
  composer the clear colour came out one sRGB-encode too bright
  (#04050c rendered as rgb(34,38,61), measured). Fix: clear to black on
  that path and add the navy base in the final pass. Also added per-point
  alpha and ribbon gain for the high tier, and retuned bloom
  (0.75 / 0.3 / 0.3). Mirrored particle draw is high tier only (the
  ribbons always reflect). Screen-reader status line announces mood,
  mute, enter and leave; the chord name is no longer `aria-live`, since
  it changes every 6–10 s. Removed unused uniforms and fixed a 1px
  vertical overflow from the status line.

## Verification
- check-rules: OK (96 files, 26 projects)
- verify-sites: `--only 01 --cdn-mirror` → ok, console 0, page 0, failed requests 0.
  Three.js came from local npm copies of three@0.166.1 because this
  environment blocks cdn.jsdelivr.net; Google Fonts loaded live.
- Visual check, desktop 1440x900: done. Intro, listening, all three
  moods, pluck, Esc back, Tab focus. Both tiers (4-core mid tier and
  8-core high tier). Headless SwiftShader runs the high tier at about
  4 fps, so timing-based states were captured after long waits. A real
  GPU should be checked by the reviewer.
- Visual check, mobile 390x844: done. Intro, listening, moods, tap
  pluck, back. No horizontal overflow at any tested width.
- Reduced motion: done. Static intro headphone, static listening
  curtain (re-rendered per chord), no CSS motion, meters still read out.
- No WebGL (`--disable-webgl`): CSS aurora fallback, synth and HUD work.
- Thumbnail regenerated: yes (mid tier, intro state, 1440x900).

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
