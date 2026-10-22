# 21-petrichor-atmos — PETRICHOR

- **Vertical:** Weather Intelligence
- **Batch:** 5 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** building
- **Next step:** Pass 1 rebuild (plan below).

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
