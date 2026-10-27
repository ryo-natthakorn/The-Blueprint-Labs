# 25-somne-railways — SOMNE

- **Vertical:** Sleeper Rail Travel
- **Batch:** 5 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** awaiting review
- **Next step:** Codex reviews in T17.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** SOMNE, car 7, berth 14, and the idea that the scroll is the timetable: 22:04 from Veldt Central, Larkspur Halt, the long dark, the moon over Mirensee, then dawn at Iskar Coast. Keep the copy, the LOCAL/SPEED/NEXT manifest, Playfair Display + Karla, and the midnight-and-lamp palette.

**Weak points (with evidence):** Audited 2026-10-27 at 1440x900 and 390x844, scroll 0 → 1, motion on and reduced. Read all three files.
- Story and view disagree. Sections are 125vh but the timetable anchors are fixed scroll fractions. At scroll 0.22 the text says "Veldt Central, 22:04" while the window shows Larkspur Halt at 23:39. At 0.4 it says "Larkspur Halt" with the clock at 01:53 and NEXT on Mirensee. On the phone at 0.85, the Mirensee heading runs into the SOMNE crest.
- It doesn't feel like a train. Flat Canvas 2D silhouettes only move when you scroll, and the speed readout shows 0–3 km/h. The "window" is a CSS vignette and the bottom ~40% of the screen is black ground.
- Set pieces are placeholder-grade. Mirensee is a flat blue rectangle with a hard vertical edge and a triangle for the moon's path. Stations are flat strips with five glow blobs, and there's no rain at Veldt or signal at Larkspur, though the copy names both.
- Text is 9.0–11.5px (crest line, manifest keys, values, ticket note) and body copy is 50% linen on near-black.

## Revamp plan
- Build a real compartment in Three.js. A lacquered wall with a rounded window, brass trim, velvet curtains, a sill with a ticket and a cup of tea, and a reading lamp that lights the cabin and reflects in the glass. A toggle turns the lamp off for the stars.
- The outside is its own world, rendered to a target and seen through the glass:
  - One backdrop shader ray-marches sky, stars, the moon, clouds, four layers of parallax ridges, the ground (fields, farm lights, city lights) and water (Mirensee, the sea). Water reflects the moon and dawn.
  - Near 3D scenery comes in procedural chunks: telegraph poles with sagging wires, trees, farmhouses with lit windows, and the rail yard. It is motion-smeared in world space, so nothing strobes at speed.
- The train moves in real time. Scroll picks the chapter and the clock, and sticky captions keep the text in step with the view. The train brakes onto each platform (Veldt Central with a clock and wet reflections, Larkspur Halt with a signal that turns green, Iskar Coast at dawn), then pulls away when you scroll on. Tunnels hide the changes of landscape.
- Rain on the glass at Veldt, which streaks with speed. The manifest gets a true km/h readout and a route line. Type ≥ 12px.
- Reduced motion: still frames per chapter, with no movement, sway or tunnels. Phones get a lower-resolution outside target and fewer trees and stars.

## Pass log
- Pass 1: Rebuilt as a compartment in Three.js: lacquered wall, rounded window with brass trim, velvet curtains, a sill with a ticket and tea, and a reading lamp. The outside renders to a half-float target seen through a glass shader (refractive raindrops that streak with speed, a faint cabin reflection, exposure and ACES). The backdrop shader (sky.js) traces sky, stars, the moon, clouds, four parallax ridge planes, fields with farm and city lights, and water that reflects the ridges and the moon. Near scenery comes in 100 m procedural chunks (poles and sagging wires, woods, farmhouses, the city, reeds), smeared in world space by speed. The train runs in real time: scroll sets the chapter and clock, it brakes onto platforms spawned at braking distance (Veldt with its hall, clock and wet lamp pools; Larkspur with a signal that turns green 2.4 s after stopping; Iskar at dawn), and passes through tunnels (hill, portal, lamps, our own windows on the wall) where the country changes. There are sticky captions, a true km/h readout, NEXT and a route line. For checking on slow machines, `?warp=4` speeds the train's clock (it does nothing unless asked).
- Pass 2: Rain falls through the lamplight at Veldt as GPU streaks that wrap around the window, lean back with speed, and only show where there's light to see them by. Tea steam rises from the cup. There's a post-and-wire fence close beside the line, moonlit field patchwork with more farm lights, and a warm fill light so the porcelain, curtains and brass read. Brass and wood reflections dim with the reading lamp, and the drops are fewer, refract, and glint. Fixes: a station that is the train's target survives the tunnel switch (Iskar vanished after the tunnel), a platform forces its own country however fast you scroll, the tunnel shows our windows faintly, and reeds are clumps of thin blades. If you jump two or more chapters, you 'doze': the view fades to black for 0.7 s and you wake where the chapter is (at cruise speed, or standing at the platform). Arriving on a later chapter skips the doze.
- Pass 3: The name board sits right of centre, clear of the captions (centred on phones), with the clock between. NEXT names the platform you're running in to. On phones the crest shortens and the lamp is out of sight, and short screens get a compact manifest. Checked 1280x720, 1024x768, 768x1024 and 390x844; no text under 12px; the keyboard walk (lamp switch → hub link) shows visible rings.

## Verification
- check-rules: OK (99 files, 26 projects).
- verify-sites: `--only 25 --cdn-mirror` → console 0, page 0, failed requests 0 (CDN mirror used; jsdelivr/cdnjs are blocked here).
- Visual check, desktop 1440x900: done in SwiftShader (2–6 fps, so motion was checked with `?warp=3–6`). I walked the whole line: Veldt in the rain, the departure, braking onto Larkspur with the signal turning green, the long dark at 130 km/h, the tunnel hill and wall, Mirensee with the moon path, the second tunnel, Iskar at dawn. Lamp on and off, plus a doze both ways.
- Visual check, mobile 390x844: done. Tall window, captions pinned on the sill, the name board centred, no sideways scroll.
- Reduced motion: done. Each chapter is a still place on the line (the platform at the stops, open country between), with no movement, sway, tunnels, twinkle or doze. Steam and rain are frozen, and it redraws only on scroll, resize or the lamp switch.
- Thumbnail regenerated: yes (`--cdn-mirror --wait 7000`, Veldt Central in the rain).

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
