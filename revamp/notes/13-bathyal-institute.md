# 13-bathyal-institute — BATHYAL

- **Vertical:** Ocean Research
- **Batch:** 3 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** awaiting review
- **Next step:** Codex reviews (T9).

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
- Pass 1: Rebuilt in Three.js. Scroll maps to a station index, so the
  depth on the HUD always matches the card being read, and the descent
  eases like a winch. A background shader draws the surface (Snell's
  window, soft god rays) and the water colour dies with depth. Marine
  snow rises past the camera and lights up inside the floodlight, a real
  SpotLight that follows the pointer (tap on touch) below 220 m and
  otherwise rests on the station's animal. Animals: an instanced bait
  ball, pulsing jellies with verlet tentacles plus a migration layer, a
  siphonophore chain and an iridescent comb jelly, an anglerfish with
  jaw, teeth and a lure that lights its face, a giant squid with bending
  arms and an eye that only reads in the beam, and a vent field with
  crack-glowing chimneys, lit smoke, swaying tube worms and the Station
  VI habitat. HUD: depth gauge with zone bands, readouts, a dive log of
  sightings and a floodlight switch; with the light off, the pointer
  leaves bioluminescent sparks. Fixed in the same pass from the first
  renders: a washed-out surface, the anglerfish facing away and too
  dark, a NaN in the beam shader that bloom spread over the anglerfish,
  snow blowing out next to the lamp, a jelly that popped when it
  wrapped, and the phone brand and hint overlapping the HUD and cards.
- Pass 2: From interaction renders (aiming at the squid, lights off at
  1,600 m, frames between stations). The beam cone was invisible from
  the camera, so it became a per-pixel raymarch through the beam (22
  steps on desktop, 11 on phones), faint and cool, and only in dark
  water. The water between stations went fully black, so a layer of
  bioluminescent flashes (blue, cyan, a rare green, some double
  flashes) now fills the dark column and gives parallax while
  scrolling. The Station VI habitat sat behind the HUD; it now stands in
  the foreground with its lamp on the worms, and phones frame the floor
  lower so the chimneys and habitat both sit above the card.
- Pass 3: Viewports and input. Checked 1024x640, 768x1024, 844x390 and
  360x640. Portrait tablets now get the stacked phone layout (the
  desktop card and HUD covered the animals and the squid fell out of
  frame); windows under 700 px tall drop the dive log, and under 520 px
  also the readout grid, with a smaller card. Tested tap-to-aim, the
  floodlight switch (aria-pressed) and the tap spark burst on a phone,
  and pointer aiming and lights-off sparks on desktop. The haze dither
  now uses interleaved gradient noise, so phones show no grain.

## Verification
- check-rules: OK (96 files, 26 projects)
- verify-sites: `--only 13 --cdn-mirror` → ok, console 0, page 0,
  failed requests 0.
- Visual check, desktop 1440x900: done. All seven stations at the HIGH
  tier with bloom, frames between stations, aiming at the squid, and
  lights off with sparks at 1,600 m; plus 1024x640 and 844x390.
- Visual check, mobile 390x844: done. All stations, tap-to-aim, the
  floodlight switch and tap sparks; plus 360x640 and 768x1024.
- Reduced motion: done. Scroll still drives the dive with no easing or
  sway, and every animal holds a formed pose. Without WebGL the page
  colour follows depth and every card reads.
- Thumbnail regenerated: yes (the surface hero, `--wait 4000`).

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
