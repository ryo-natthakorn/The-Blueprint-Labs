# 13-bathyal-institute — BATHYAL

- **Vertical:** Ocean Research
- **Batch:** 3 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** building
- **Next step:** Pass 1 rebuild (plan below).

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

Rendered at 1440x900 and 390x844 (motion on/off) at eight scroll depths.

**Keep:**
- Concept: one continuous dive from the surface to 6,000 m. The
  scrollbar is the winch, sunlight dies on schedule, and animals appear
  at their real depths: a bait ball, jellies, a siphonophore, an
  anglerfish, a giant squid, and the vent field with Station VI.
- The HUD readouts (depth, pressure, temperature, sunlight), the
  bioluminescent pointer trail, and the copy at each station.
- Instrument Serif + IBM Plex Mono, glow green #64f0d2 on abyssal black.

**Weak points (with evidence):**
- Depth and story disagree. Scroll maps linearly to 0–6,000 m while the
  stations are evenly spaced, so the HUD reads 693 m under the
  "−150 m · Epipelagic" heading, with 700 m jellies around it (desktop
  12%).
- Text collides with the art: the −150 m heading sits on a jellyfish
  (desktop), the tube worms are drawn across the Station VI paragraph
  (mobile 100%), and the mobile HUD covers station text (mobile 27%)
  and the scroll cue (mobile 0%).
- Long dead stretches: at 75% and 92% the screen is black apart from the
  text, and the giant squid never reads.
- The animals are flat Canvas shapes: quadratic-curve fish, ellipse
  jellies, a bead-chain siphonophore, a black blob anglerfish, and vent
  plumes drawn as stacked grey circles. The god rays are hard-edged
  triangles.
- Below the light there is nothing to do except leave a glow trail with
  the mouse, and nothing at all on touch.
- The HUD is tiny (0.56–0.68rem) and has no sense of zones or progress.

## Revamp plan
- **Technique:** move from Canvas 2D to Three.js (with bloom on desktop),
  keeping the same dive. The camera descends a column where every
  station has a stage, and scroll maps to a station index so the depth
  shown always matches the station being read.
- **Light as the story:** a background shader for the surface
  (Snell's-window shimmer, soft god rays) and a water colour that dies
  with depth, plus marine snow that rises past you and lights up inside
  the beam. Below the photic zone the pointer aims the submersible's
  floodlight, a real SpotLight with a soft volumetric cone, and a
  "lights off" switch leaves only bioluminescence and your own glow
  trail. On touch, tap to aim.
- **Animals, modelled:** an instanced sardine bait ball with swimming
  tails; pulsing jellyfish with shader bells and verlet tentacles; a
  siphonophore chain with dangling tentacles, plus an iridescent comb
  jelly; an anglerfish with jaw, teeth and a lure that lights its own
  face; a giant squid whose bending arms and eye only show in the beam;
  a seafloor with vent chimneys, lit smoke, swaying tube worms and the
  lit Station VI habitat.
- **HUD:** a depth gauge with zone bands, large readouts, a dive log of
  sightings, and the floodlight switch. Station copy sits on glass
  cards so it never fights the art; on mobile the cards sit at the
  bottom and the animals frame above them.
- **Fallbacks:** reduced motion keeps scroll in control with posed,
  still animals and no sway. Phones skip bloom and get fewer
  particles, fish and strands. Without WebGL the water colour still
  follows depth.

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
