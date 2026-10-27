# 21-petrichor-atmos — PETRICHOR

- **Vertical:** Weather Intelligence
- **Batch:** 5 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** done

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** PETRICHOR name, "atmospheric intelligence" voice, the one-shader sky, the hour scrub and storm slider, lightning that the storm has to earn, Syne/Manrope, slate + amber.

**Weak points (with evidence):** Audited 2026-10-22 at 1440x900 and 390x844, motion on and reduced, at 14:00/12%, 19:00/30%, 23:00/40% and 14:00/85% (CDN/font mirror). Read all three files.
- The clouds are flat 2D FBM smears with no volume, light direction or perspective. A 1:1 crop at 14:00 shows soft grey smudges you can't tell from haze. Nothing reads as a cloud deck receding to a horizon.
- There is no horizon or ground, so the sky has no scale or place, and "petrichor" (rain on dry earth) has nothing to land on.
- Night is close to black: at 19:00 and 23:00 the clouds are dull grey blobs, the moon is a few pixels and the stars barely register. At 19:00 the set sun is an orange blob in the bottom-left corner.
- Rain at 85% is evenly spaced screen-space lanes (a barcode look). Lightning is a whole-screen additive flash with no bolt and no place in the sky.
- The readings are thin (time, temp, wind, ceiling) and the model is odd: 14:00 is 18°, and 23:00 at 40% storm is −6°. No pressure, humidity, visibility or forecast, and nothing about petrichor itself.
- Text is 8.8–9.9px (labels, slider names, footer) at both widths.
- The `sin`-based hash and lack of dithering leave the shader open to precision artefacts on some GPUs; there's no WebGL-less fallback.

## Revamp plan
- Keep one raw-WebGL fragment shader, but make it a real sky: a raymarched volumetric cloud deck (3D texture noise, Beer–Lambert, sun shadow, powder, forward-scatter silver lining) over an analytic single-scattering atmosphere (blue day, red-orange low sun, twilight, moonlit night, stars and a faint Milky Way).
- Add a place: layered ridges with aerial perspective over a plain. Rain soaks the plain into puddles that mirror the sky, with ripples. The storm lowers the cloud base, thickens the deck into towers and pulls visibility in.
- Lightning becomes a branched bolt at a point in the sky. It lights the cloud around it from inside, and its distance gives a thunder countdown. The flash budget stays under three pulses per second, with no full-screen white.
- Signature metric: a **scent index** that peaks when rain first hits dry ground and fades as the ground soaks ("PETRICHOR" appears as a condition). Add a coherent model behind the readings (diurnal temp, dew point → humidity, falling pressure, wind veer, ceiling, visibility) and a "Play the forecast" day: clear morning, afternoon storm, clearing evening.
- The hour slider becomes a 24-hour sky strip. Readable type (labels ≥ 11px). Flow layout that scrolls on short screens. Quality tiers (steps, octaves, render scale) plus an adaptive resolution drop. Reduced motion renders composed stills on input, with no flashes. CSS sky fallback without WebGL.

## Pass log
- Pass 1: Rebuilt the shader. Single-scattering sky with aerosol reddening and twilight ozone blue, a raymarched cumulus deck (one-fetch 3D texture noise, Beer–Lambert, sun-shadow march, mass-above occlusion, powder, two-lobe phase), three ridges in aerial perspective, and a plain that soaks into sky-mirroring puddles with rain rings. Moon disc with phase, temperature-coloured stars and a faint Milky Way. Grain is removed with a constant-alpha history buffer (stills accumulate six passes). The station faces WSW, so the sun sets just right of centre and storms build in view. Lightning is a branched 2D-overlay bolt (dim inside the cloud, two pulses at most) that lights the cloud around its channel, with a distance → thunder countdown. New desk UI: condition word fitted to its column, a story line, six coherent readings, the scent index, a 24-hour sky-gradient hour track, a storm track and Play the forecast. Labels are ≥ 11.5px.
- Pass 2: Checked 1024x640, 360x640, landscape 844x390, no-WebGL, keyboard and reduced motion. Amber kicker text sat on bright cloud at 1024x640 and on phones, so the desk now carries its own shade sized to its content (it isn't a fixed scrim any more). Sky clicks never reached the canvas under the UI layer; strikes now listen on the document and ignore the controls. Thunder now 'arrives' when the countdown ends. Reduced motion: storm 0 → 80 → 90 → 10 gives Fair → Petrichor (scent 90) → Thunder → After the rain, and Play steps an hour at a time.
- Pass 3: Swept dawn, noon, golden hour, blue hour, night and thunder at both widths. Fixed a regression where the desk shade covered the whole viewport (the grid row was taller than the content), which made every scene dull. Front-lit dawn clouds got a phase floor so they read pink, not brown. Added the belt of Venus and earth shadow opposite a low sun, a 1.35× low-sun exposure lift, and a proper blue-hour band between sunset and night. Ridge silhouettes now composite far to near with a one-pixel soft edge (no more stair-steps). Bolts show through thin cloud above the base. The page opens at 17:30 golden hour, the strongest first frame.

## Verification
- check-rules: OK (96 files, 26 projects).
- verify-sites: `--only 21 --cdn-mirror` → ok, console 0, page 0, failed requests 0. The mirror served Google Fonts and the Font Awesome CSS because this environment blocks cdnjs and jsdelivr.
- Visual check, desktop 1440x900: done. 06:30, 08:00, 11:30/40%, 13:00, 14:00, 17:30–17:45, 18:30, 21:30, 00:30, 16:00–16:30 at 60–96% (with a forced strike), and after-the-rain puddles. Also 1024x640. No sideways scroll.
- Visual check, mobile 390x844: done, same states plus 360x640 and 844x390 (the page scrolls rather than overlaps).
- Reduced motion: done at both widths. Composed stills (six accumulated passes) on every input. Rain streaks hold still, no lightning flashes, and Play steps hour by hour.
- No WebGL: CSS sky gradient that follows the hour, and all readings still work.
- Headless Chromium uses SwiftShader, so the adaptive scaler sits at its 0.55 px/CSS-px floor in these shots. Real GPUs run the tier scale (0.7 desktop, 0.5×dpr phones) with 40/26/18 cloud steps.
- Thumbnail regenerated: yes (`--wait 6000`), golden-hour opening frame, checked.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log

### Review in progress — 2026-10-27 · Codex (T17)

Reading the diff against `origin/v1-original` and checking desktop/mobile, normal/reduced motion. The sites are served unchanged; the protocol CDN/font mirror is used for local rendering. Final findings and verification follow below.

### Review result — 2026-10-27 · Codex (T17)

No findings. The volumetric cloud deck, layered ground, wet surface and coherent weather controls are a clear improvement over the original flat FBM sky. Brand and core hour/storm interaction remain recognisable.

Checklist: diff against `origin/v1-original` read; check-rules OK (99 files, 26 projects); scoped verify-sites with `--cdn-mirror` has zero console/page errors and failed requests. Visual check DONE at 1440×900 and 390×844, normal/reduced motion, opening golden hour plus midnight, dawn, severe rain and blue hour/after-rain states. Sliders and forecast control exercised; static input-driven reduced-motion skies render without flashes. Quality tiers/adaptive resolution and focus/label semantics inspected. No horizontal overflow, missing/blank canvas or visible DOM text under 11px. All imagery is procedural, with no people/faces. Existing regenerated thumbnail inspected and matches the golden-hour opening. System Chromium/SwiftShader and the protocol CDN/font mirror were used.
