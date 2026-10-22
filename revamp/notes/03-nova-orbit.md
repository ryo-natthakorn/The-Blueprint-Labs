# 03-nova-orbit — Nova Orbit

- **Vertical:** Space Tourism
- **Batch:** 1 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** done

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

Rendered at 1440x900 and 390x844 (motion on/off), eight scroll depths
each. Three.js served from npm through `scripts/cdn-mirror.js` (this
environment blocks cdn.jsdelivr.net).

**Keep:**
- Concept: the scrollbar flies a full launch profile (pad → ignition →
  max-Q → Kármán line → orbit). The rocket stays near the origin and the
  world falls away.
- Mission copy and chapter times, the live telemetry (ALT / VEL / PHASE),
  Michroma + Manrope, flame orange #ff7a3c with cyan #57d6ff readouts.

**Weak points (with evidence):**
- The orbit act is broken: the Earth's procedural texture uses
  `atan(z, x)` UVs and the camera looks at the sphere's pole, so the
  final screen is a radial starburst of streaks (s100 desktop and mobile).
- Vehicle is a grey cylinder, cone, orange band and four box fins with
  one engine bell, while the copy says "Nine engines light in staggered
  pairs". No livery, no panel detail, no staging. It stays one piece all
  the way to orbit.
- Exhaust is a single additive cone (pale stick in s25–s55). No shock
  diamonds, no plume growth as the air thins, no bloom.
- Pad and ground: a flat green disc, a grey octagon and a stack of boxes
  for a tower. Launch smoke is a few round sprites.
- Clouds are scattered blurry sprites; at max-Q there's one white blob
  (s55). No sense of speed or of punching through weather, and no vapour
  cone, the iconic max-Q image.
- Shake is `Math.random()` jitter per frame, which reads as a glitch
  rather than a rumble.
- Copy legibility: thin light-grey body text straight on the bright sky
  ("Ignition" and "Max Q" paragraphs in s25/s40). On mobile the copy runs
  across the rocket body.
- Mobile telemetry wraps ("64.1 / km", "KÁRMÁN / LINE") and the velocity
  column is hidden.
- Reduced motion always shows the orbit still, whatever the scroll
  position.

## Revamp plan
- **Vehicle:** a two-stage crewed rocket. Lathe-profiled stage 1 with a
  panel-seam livery texture, grid fins, folded legs and a nine-engine
  octaweb. Interstage, a short stage 2 with a vacuum bell, and a crew
  capsule with real window ports ("the window seat").
- **Exhaust:** a shader plume with core and envelope, noise turbulence
  and shock diamonds near the ground, swelling into a wide, faint vacuum
  plume with altitude. Bloom on desktop.
- **The pad at dawn:** low golden sun, a coastline of land and ocean
  with glint, a concrete pad with flame trench, a lattice tower and
  lightning masts. Water-deluge steam billows sideways out of the trench
  at ignition, lit orange by the flame.
- **Atmosphere:** a sky shader with sun disc and glow that thins to black
  with altitude, keeping a blue band on the horizon. A real cloud deck
  the rocket punches through (white-out flash plus rumble), speed streaks
  in the air, and a vapour cone at max-Q.
- **Staging:** MECO, the first stage drops and tumbles away, the second
  stage lights a wide vacuum plume.
- **Orbit:** an Earth with 3D-noise continents (no UV pole), a moving
  cloud layer, day/night terminator, city lights, ocean glint, a
  fresnel atmosphere rim and an orbital sunrise on the limb.
- **Telemetry and copy:** MET clock, ALT, VEL, PHASE (no wrapping, all
  four on mobile in a compact strip), an event timeline with ticks. A
  sixth chapter for staging. Copy on glass cards for contrast.
- **Motion:** smooth-noise rumble (ignition, punch-through, max-Q,
  staging jolt), all keyed to mission time, which is keyed to chapter
  positions.
- **Fallbacks:** reduced motion keeps scroll in control with still frames
  (no shake or flicker). Phones get no bloom or shadows, fewer sprites and
  lower-octave shaders.

## Pass log
- Pass 1: Rebuilt everything around mission time: scroll maps to MET
  through each chapter's centre (`data-met`), and altitude and velocity
  follow eased MET tables. Vehicle: lathed stage 1 with seam, rivet,
  wordmark, band and soot livery, octaweb with nine bells, stowed legs and
  grid fins; interstage; stage 2 with a vacuum bell; crew capsule with
  four window ports; launch escape tower. Exhaust shader (core, envelope,
  noise turbulence, Mach diamonds in thick air, vacuum swell) for both
  stages; vapour-cone shell at max-Q. World: dawn coast (land, beach,
  ocean glint, pad apron, distance haze), concrete deck with flame trench
  and mount, lattice tower whose crew-access arm swings away before T−0,
  lightning masts, deluge steam, an exhaust trail left in world space,
  cumulus sprites, and a 3 km cloud deck seen from below, punched through
  (white-out + rumble) and seen from above. Sky shader thins to black with
  a blue limb band; stars; sun sprite. Earth: 3D-noise continents,
  clouds, terminator, city lights, ocean glint, thin fresnel atmosphere;
  the sun path goes dawn → high sun over a blue planet → under the limb
  for an orbital sunrise. Staging at T+2m36s (stage 1 drops and tumbles,
  fins deploy), LES jettison, SECO before the orbit chapter. Smooth-noise
  rumble replaces the random jitter. HUD: MET/ALT/VEL/PHASE with fixed
  widths (no wrapping on phones), event timeline with ticks placed by
  MET. Copy on glass cards that stick while their chapter plays, one at a
  time. Desktop bloom; portrait camera (taller lens, pulled back, vehicle
  above the caption). Fixes found by rendering: overexposed pink haze
  (exposure, sky and haze colours), Earth looked like Mars (continent and
  cloud noise rescaled to the visible cap; ocean majority), camera was
  inside the atmosphere shell (thinned to 1.0055 R), hard seam where the
  cloud deck met the sky (shared haze below the horizon), and a harsh
  orange band from the flame light on the deck.
- Pass 2: Event detail and the pad. The nine engines now light as the
  copy says, centre first then four opposed pairs 0.42 s apart (each bell
  glows on its own), with the plume ramping behind them. The ignition
  camera was framing mid-body, so it now sits low on the pad with engines,
  flame and trench in shot. Deluge steam rebuilt with a noise-generated
  puff texture (three variants, lit crowns and darker bellies, random
  rotation) replacing hard-edged discs. More puffs, lower and wider along
  the trench, warmed by the flame near the mount. Concrete deck got a
  stained, jointed and scorched texture. Staging: the first stage now
  separates slowly enough to watch it tumble away with grid fins
  deploying, cold-gas puffs ring the interstage, and a small flame shows
  at the escape-tower jettison. The capsule windows glow warm from the
  cabin, which reads in the night-side orbit shot.
- Pass 3: Tiers, viewports and fallbacks. Checked the mid tier on
  desktop (4 cores: no bloom, no shadows) across the whole profile, plus
  844x390, 768x1024 and 2560x1080 at three depths, and the no-WebGL
  path (deep-space gradient with the cards still readable). Copy cards
  had been stacking (sticky card plus the next one arriving), so only the
  chapter nearest the scroll position shows its card now, in reduced
  motion too. The reduced-motion still at the cloud crossing is capped at
  30% white-out so it stays readable. Puff alpha softened, and the pad
  headline resized so "The window seat" holds on one line.

## Verification
- check-rules: OK (96 files, 26 projects)
- verify-sites: `--only 03 --cdn-mirror` → ok, console 0, page 0, failed
  requests 0. Three.js came from local npm copies (cdn.jsdelivr.net is
  blocked here).
- Visual check, desktop 1440x900: done at every chapter plus targeted
  MET frames (T−1.5, T+1/4/6/8/14, staging T+2m38s/43s, LES T+3m00s,
  orbit). High tier with 8 cores emulated and mid tier. SwiftShader runs
  the high tier at 3–5 fps, so the eased scroll lags in some shots; key
  states were re-shot after long waits.
- Visual check, mobile 390x844: done at five depths, motion and reduced.
- Reduced motion: done. Scroll flies the profile as stills (no rumble,
  flicker, streaks or trail; steam frozen), one card at a time.
- No WebGL: gradient backdrop, telemetry static, copy intact.
- Thumbnail regenerated: yes (mid tier, pad at dawn, 1440x900).

## Review
Codex review (2026-10-21): No findings. Compared the revamp with
`origin/v1-original` and checked the §5 checklist. At 1440×900 and 390×844,
with motion enabled and reduced, the concept, visual craft, layout and
interactions hold up. No horizontal overflow or page errors. `verify-sites`
passed with `--cdn-mirror` (the mirror supplied the original npm CDN packages
and Google font families locally); `check-rules` printed OK. The refreshed
thumbnail matches the opening state.

## Fix log

- 2026-10-22 · Codex · T7 confirmation: no R items or builder fixes exist; site code is unchanged since the completed T2 review (`c539b15`). Stage remains done; no duplicate BUILD_LOG entry.
