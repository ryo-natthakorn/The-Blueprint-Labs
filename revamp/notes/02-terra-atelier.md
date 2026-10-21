# 02-terra-atelier — Terra Atelier

- **Vertical:** Ceramics Studio
- **Batch:** 1 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** done

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

Rendered at 1440x900 and 390x844 (motion on/off), six scroll
positions each. Three.js served from npm through `scripts/cdn-mirror.js`
(this environment blocks cdn.jsdelivr.net).

**Keep:**
- Concept: scroll throws one pot through six real stages (raw clay →
  centering → opening → pulling up → shaping → fired). The LatheGeometry
  profile morph between authored stage profiles is sound.
- Japanese stage marks (土から, 中心, 開く, 引き上げ, 形, 窯), Cormorant
  Garamond + Zen Kaku Gothic New, warm paper palette, clay → celadon.
- Off-centre wobble before centering; wheel coasting to rest when fired;
  drag to turn the finished vessel; vertical progress rail.

**Weak points (with evidence):**
- The pot sits dead centre and is very large, so it covers the copy. On
  desktop the "Centering" paragraph runs under the pot and "Fired &
  finished" is printed on top of it (s20, s100 shots). On mobile every
  panel's text sits on the pot and is unreadable (all six mobile shots).
- Material reads as CG plastic: one flat `MeshStandardMaterial` colour,
  no texture, no throwing rings, no wet slip sheen, no grog speckle, no
  environment reflections. The "fired celadon" is a flat grey-green with
  roughness 0.4, with no gloss, pooling or crazing.
- Wheel is two plain cylinders and is cropped by the bottom edge on
  desktop and mobile. No splash pan, no slip on the bat, nothing tells
  you it's a working wheel apart from rotation (which a smooth untextured
  lathe can't show).
- Firing is just a colour lerp between "shaping" and "fired". The kiln,
  the most dramatic step, never happens.
- Reduced motion always renders the finished glazed vessel from a fixed
  camera, whatever the scroll position, so five of the six stages can't
  be seen. The comment says scroll still repositions it; the code
  doesn't.
- Mobile has no shadows (`shadowMap` off) and nothing replaces them, so
  the pot floats.
- No hint that the final vessel can be dragged, apart from one sentence.

## Revamp plan
- **Composition:** the pot moves into the right half on desktop (camera
  view offset) with all copy in a left column, and into the upper half on
  phones with the copy on a paper card below. The whole wheel stays in
  frame.
- **Clay you can believe:** `MeshPhysicalMaterial` with a studio
  `RoomEnvironment`, plus canvas-generated maps: grog speckle colour,
  spiral throwing-ring bump, and a celadon map with glaze pooling in the
  rings and fine crazing. A shader patch crossfades clay → glaze. Per
  stage: wet slip clearcoat while throwing, leather-hard satin, matte
  bisque, then a deep glossy glaze. Ring depth grows with each pull.
- **A working wheel:** a machined wheel head with concentric rings, a
  splash pan, a slip puddle on the bat while throwing, and droplets flung
  off the rim at speed.
- **The kiln:** between shaping and fired, the pot heats from inside
  (emissive orange to white-yellow), the paper background warms and a
  temperature readout climbs to 1280°C, then it cools into celadon.
- **Finish:** a drag-to-turn affordance with inertia and a slight tilt.
  The final panel gets a small spec line (edition, glaze, firing, height).
- **Progress rail:** six ticks with stage names; a temperature readout
  while firing.
- **Fallbacks:** reduced motion keeps scroll in control (each stage is
  a still), with no idle spin, wobble or droplets. Soft baked contact
  shadow on every tier; real shadow maps on desktop only.

## Pass log
- Pass 1: Rebuilt scene and layout. Seven stages (a firing stage was
  added between shaping and finished; the fired profile is the shaped
  one shrunk 10%). `MeshPhysicalMaterial` with a `RoomEnvironment`
  PMREM, ACES tone mapping, and three canvas-generated maps (spiral
  throwing-ring bump, grog speckle, celadon with ring pooling and
  crazing) crossfaded in an `onBeforeCompile` map patch. Per stage:
  wet slip clearcoat → leather-hard → matte bisque → emissive kiln heat
  (dull red → orange → amber, speckle-modulated) → glossy celadon.
  Ring bump grows with the pulls, and a travelling pinch climbs the wall
  during "pulling up". Set pieces: machined wheel head (concentric-ring
  texture), speckled bat, lathed splash pan, glossy slip puddle, flung
  slip droplets. The wheel sinks away for the kiln shelf (slab + three
  posts), and a paper-white plinth rises for the finished piece, which
  turns slowly for display. Camera fits wheel + pot into the right half
  on desktop (view offset) or the upper half on phones, and tilts down
  to look into the opening. Page: kiln wash (glow first, then dark) and
  light-on-dark copy at peak heat; rail with seven ticks plus a
  temperature readout climbing to 1280°C; copy fades in and out with an
  IntersectionObserver so cards never sit over the pot on phones; paper
  fade under the masthead; drag-to-turn pill on the final stage. Tuning
  round after first render: rings were too strong and present from raw
  clay (bumpScale 0.6–3 → 0.04–0.94, frequency 74 → 52), clay too orange
  under ACES (darker wet and leather tones), white-hot kiln pot lost
  its form (emissive 2.6 → 1.45 with a speckle emissive map), the
  half-faded wheel looked ghostly (it sinks and fades faster now), and
  the half-way kiln wash looked grey (split into glow and dark layers).
- Pass 2: Narrative details and transitions. A wooden kidney rib
  (extruded bezier shape) slides in and presses the belly through the
  shaping stage; its convex edge is kept on the wall as the belly grows.
  Embers rise round the pot at peak heat. Bigger, darker slip droplets.
  The wheel now drops away opaque like a stage lift and only fades once
  it's nearly out of frame (the transparent fade showed ghosted
  surfaces). Kiln wash split into warm glow first and darkness later,
  with more saturated browns, because half-way states looked grey. The
  masthead's paper fade follows the darkness. Light-on-dark copy now
  switches only once the page is dark (it was unreadable on the half-lit
  orange). Reduced motion: stills snap set pieces fully in or out, so no
  frame shows a half-faded shelf or a half-sunk wheel. Checked drag
  turns the finished piece (mouse and RM), and the focus ring on the back
  link.
- Pass 3: Responsiveness and fallbacks. Checked 844x390, 768x1024,
  1280x720 and 2560x1080 at four scroll depths. Phones on their side had
  copy overflowing the 100vh panels and the rail over the pot, so I added
  a short-height layout (≤520px: no rail, tighter type and spacing). The
  framing was widened (fitW 6.0 → 6.7) so the splash pan clears the rail
  at 1440px. No WebGL used to show a flat gradient blob. It now shows a
  real still of the finished piece on its plinth (`assets/vessel-still.webp`,
  46 KB, rendered from this scene with a transparent background and
  feathered edges). Tiers: HIGH = 2048 PCF soft shadows, 128 radial
  segments, more droplets/embers. Phones/low-core = baked contact shadow
  only, 64 segments.

## Verification
- check-rules: OK (96 files, 26 projects)
- verify-sites: `--only 02 --cdn-mirror` → ok, console 0, page 0, failed
  requests 0. Three.js came from local npm copies (cdn.jsdelivr.net is
  blocked here); Google Fonts loaded live.
- Visual check, desktop 1440x900: done at nine scroll depths across all
  seven stages, high tier (8 cores emulated) and mid tier (thumbnail
  run). SwiftShader runs it at about 3 fps, so the eased scroll lags
  behind in some shots; final states were checked after long waits.
- Visual check, mobile 390x844: done at nine scroll depths.
- Reduced motion: done. Each scroll depth is a finished still (no spin,
  wobble, droplets or embers), set pieces snap in or out, and drag still
  turns the finished piece.
- No WebGL (`--disable-webgl`): still image of the finished piece, copy
  intact.
- Thumbnail regenerated: yes (mid tier, opening stage, 1440x900).

## Review
Codex review (2026-10-21): No findings. Compared the revamp with
`origin/v1-original` and checked the §5 checklist. At 1440×900 and 390×844,
with motion enabled and reduced, the concept, visual craft, layout and
interactions hold up. No horizontal overflow or page errors. `verify-sites`
passed with `--cdn-mirror` (the mirror supplied the original npm CDN packages
and Google font families locally); `check-rules` printed OK. The refreshed
thumbnail matches the opening state.

## Fix log
