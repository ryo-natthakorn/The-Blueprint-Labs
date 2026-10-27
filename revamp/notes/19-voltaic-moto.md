# 19-voltaic-moto — VOLTAIC

- **Vertical:** Electric Motorcycles
- **Batch:** 4 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting confirm
- **Next step:** Claude confirms the T16 fixes in T19; optional declines are recorded below.

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
_Reviewer: add findings as `- [x] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

Reviewed 2026-10-22 by Claude (T13) at 1440x900 and 390x844, motion on and reduced, against `origin/v1-original` served side by side (CDN/font mirror, headless SwiftShader; 8-core profile for the full-quality path). check-rules OK; verify-sites `--only 16,17,18,19,20 --cdn-mirror` all ok, zero console/page/request failures; no sideways scroll at either width. Thumbnails match the new look. No images of people (all imagery procedural).

The new SIGMA is properly proportioned and detailed (cradle frame, finned battery, belt, inverted forks, coil springs). Paint, mode and the three inspection views all work, by keyboard too.

- [x] R1 (must) Text is too small to read. Sizes measured with `getComputedStyle` on every visible text node. At 390x844 "ELECTRIC MOTORCYCLES", "COMPLETE MACHINE / 01", "DRAG TO ORBIT · ARROW KEYS" and the stat labels are 6px, and the torque/spec line and footer are 7px. At 1440x900 the torque labels and spec line are 7px, the section labels 8px and the view buttons 9px. Bring body/notes to at least ~13px and uppercase labels to at least ~11px at both widths.
- [x] R2 (nice) At 1440x900 the stats row (range, torque, 0–100) is cut at the fold in the opening view: the numbers are sliced in half, and the thumbnail shows the same. Either bring the row into the first screen or push it clearly below.

## Fix log

### Fix work — 2026-10-27 · Codex (T16)

Plan: raise labels to at least 11px and prose/notes to 13px in every breakpoint, then inspect flow layout. Address behavioural R items with reproducible interaction checks and regenerate affected thumbnails.

- R1: fixed in 61fd555. Labels/buttons have an 11px floor; explanatory text, mode/finish notes and configuration specification are 13px. View controls wrap within the mobile stage.
- R2: fixed in 61fd555. On tall desktop screens the complete stats row begins clearly below the opening fold, with a 60px separation from the studio; the opening thumbnail no longer cuts through the numbers.

### Fix verification — 2026-10-27 · Codex (T16)

- check-rules: OK (99 files, 26 projects).
- verify-sites: `--only 16,17,18,19,20 --cdn-mirror` → zero console errors, page errors and failed requests on every site. System Chromium; protocol CDN/font mirror used.
- Visual check: DONE at 1440×900 and 390×844, normal and reduced motion. Full-page captures inspected, no horizontal overflow. Computed-text scan found no visible DOM text below 11px in any of the four configurations per site.
- Thumbnail regenerated with `--force --cdn-mirror --wait 4500`.
