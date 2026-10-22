# 19-voltaic-moto — VOLTAIC

- **Vertical:** Electric Motorcycles
- **Batch:** 4 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting review
- **Next step:** Claude: review this site in T13 against `origin/v1-original`, using the verification and interaction notes below.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** The electric café-racer concept, mint accent, four paint finishes and ride modes. Original opened at 1440×900 and 390×844 before edits.

**Weak points (with evidence):**
- Primitive geometry has oversized balloon tyres above the seat and little visible frame, suspension or battery detail.
- The grey floor dominates the image and the headlight is a hard-edged cone.
- At 390px both wheels are cut off. Product inspection has no keyboard equivalent and no named component views.

## Revamp plan
- Rebuild a proportioned electric motorcycle with frame, battery fins, belt drive, fenders, saddle stitching, brakes, fork and rear springs.
- Use a contained studio stage with deliberate lighting, paint finishes and readable performance/mode information.
- Add whole-bike, powertrain and front inspection views with drag/keyboard orbit; fit the complete bike on mobile and keep static reduced-motion composition.

## Pass log
- Pass 1: Rebuilt SIGMA with proportioned wheels and saddle, double cradle frame, finned battery, belt drive, brake discs, paired coil springs, inverted forks, stitched seat and a branded side panel. Added contained studio framing, four named finishes, narrated ride modes/torque curves, three inspection views and keyboard orbit.
- Pass 2: Four renders revealed bulky tube-shaped mudguards, a grey platform competing with the bike, and tight front-wheel clearance on mobile. Replaced the guards with thin extruded metal arcs, darkened/shrank the platform and increased narrow-stage camera clearance. An explicit Rotate command now works under reduced motion while the opening state stays still.
- Pass 3: Final inspection covered every paint/mode and all three component views at narrow width, including close-up camera composition, Home/arrows and explicit rotation. Confirmed the complete bike fits the mobile stage, the front/powertrain close-ups intentionally crop surrounding parts, and high-quality geometry/lighting render correctly on the 8-core desktop path.

## Verification
- check-rules: `node scripts/check-rules.js` → **OK** (96 files, 26 projects).
- verify-sites: Scoped run for 16–20 with `--cdn-mirror` → **0 console errors, 0 page errors, 0 failed requests**. Chromium used `/usr/bin/chromium`; external CDNs/fonts are blocked here, so the protocol mirror supplied the same package versions and Google-font fallback.
- Visual check, desktop 1440x900: **DONE**, both normal and reduced motion. Inspected opening, lower controls/footer and interaction states. Also checked 1024×640.
- Visual check, mobile 390x844: **DONE**, both normal and reduced motion; controls remain available in document flow and no sideways overflow. Also checked 360×640.
- Reduced motion: Complete machine starts still, including wheels; camera preset changes snap. Idle pixels matched at both extra short viewports. Rotate bike is explicit opt-in.
- Thumbnail regenerated: `screenshot.js --id 19-voltaic-moto --force --cdn-mirror --wait 4500` at 1440×900, with an 8-core desktop profile for the full-quality path. `projects.json` description/tech updated; no `builtBy` field.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
