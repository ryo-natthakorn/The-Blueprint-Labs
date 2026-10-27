# 18-koppar-roastery — KOPPAR

- **Vertical:** Coffee Roastery
- **Batch:** 4 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting confirm
- **Next step:** Claude confirms the T16 fixes in T19; optional declines are recorded below.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** The copper/cream identity, heat-retention simulation, tumbling beans and live roast curve. Original opened at 1440×900 and 390×844 before edits.

**Weak points (with evidence):**
- The drum is a flat circle with spokes rather than a crafted roasting machine. On mobile it becomes a small disc surrounded by unused space.
- Fixed-position graph, cupping note and controls compete for the same lower viewport; short screens have no normal document flow.
- There is no way to finish a roast and keep its result. The global Space shortcut also steals normal button activation; the copy promises a crack sound that is absent.

## Revamp plan
- Build a copper roasting bench with housing, bolts, inspection window, hopper, temperature gauge and cooling tray.
- Create a readable roast protocol, separate temperature profile and controls in normal flow; make the mobile drum a substantial scene.
- Add charge, hold-to-heat, drop/cool and batch results with a clear state machine and keyboard-safe controls. Keep reduced-motion beans composed while the user-run roast still advances.

## Pass log
- Pass 1: Rebuilt the copper machine, hopper, dial, sampling handle, drum window and cooling tray in Canvas 2D. Added an editorial roast protocol, cupping receipt, separate temperature curve, optional synthesized crack sound and a ready/roasting/cooling/done lifecycle. Drop saves the roast; New batch resets it.
- Pass 2: Inspected desktop/mobile and the complete overheating path. Slowed roast development to give a useful decision window after first crack; added current temperature/time to the held heat control so mobile users can monitor the batch while the machine is above the viewport. Confirmed the automatic stop saves an overheated result and cuts the burner.
- Pass 3: Final pass exercised a 27-second roast through first crack to City, dropped it, inspected the saved receipt and reset with the keyboard. Also covered early drop, automatic charcoal stop, heat release, native Space on New batch and optional crack-sound activation. The roast remains usable at short mobile/desktop heights; the reduced-motion drum stays visually still until user-driven state changes.

## Verification
- check-rules: `node scripts/check-rules.js` → **OK** (96 files, 26 projects).
- verify-sites: Scoped run for 16–20 with `--cdn-mirror` → **0 console errors, 0 page errors, 0 failed requests**. Chromium used `/usr/bin/chromium`; external CDNs/fonts are blocked here, so the protocol mirror supplied the same package versions and Google-font fallback.
- Visual check, desktop 1440x900: **DONE**, both normal and reduced motion. Inspected opening, lower controls/footer and interaction states. Also checked 1024×640.
- Visual check, mobile 390x844: **DONE**, both normal and reduced motion; controls remain available in document flow and no sideways overflow. Also checked 360×640.
- Reduced motion: The beans, vanes and crack animation stay still. A user-started roast can still advance temperature, curve and result. Idle pixels matched at both extra short viewports.
- Thumbnail regenerated: `screenshot.js --id 18-koppar-roastery --force --cdn-mirror --wait 4500` at 1440×900, with an 8-core desktop profile for the full-quality path. `projects.json` description/tech updated; no `builtBy` field.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

Reviewed 2026-10-22 by Claude (T13) at 1440x900 and 390x844, motion on and reduced, against `origin/v1-original` served side by side (CDN/font mirror, headless SwiftShader; 8-core profile for the full-quality path). check-rules OK; verify-sites `--only 16,17,18,19,20 --cdn-mirror` all ok, zero console/page/request failures; no sideways scroll at either width. Thumbnails match the new look. No images of people (all imagery procedural).

The copper roaster is a real piece of craft, far beyond v1's flat disc, and the charge → hold → drop → receipt loop works by mouse, touch and keyboard.

- [x] R1 (must) Text is too small to read. Sizes measured with `getComputedStyle` on every visible text node. At 390x844 "INDEPENDENT MICRO ROASTERY", "INTO THE COOLING TRAY", "COPPER — BEAN TEMPERATURE" and the heat button's "RELEASE TO COAST" line are 6px; "READY TO CHARGE", "SMALL BATCH" and "THE COPPER DRUM" are 7px; the burner state and readout labels are 8px. At 1440x900 the roast protocol steps are 10px, the instruction "Hold Space on the page or heat button" is 9px and several labels are 7–8px. Bring body/notes to at least ~13px and uppercase labels to at least ~11px at both widths.
- [x] R2 (must) The stage readout contradicts the temperature and the page's own curve. Holding heat from charge reaches 224°C and still says "Drying" at 00:13 (1440x900). On a phone, holding for 20s reaches 249–250°C and says "Yellowing"/"Cinnamon", with no first crack, while the roast curve marks 196° as first crack. Cause: bean temperature saturates near the 260°C air within ~15s, while `roast.level` creeps at `(beanTemp − 130) × 0.00034` per second, and cracks need both thresholds (`script.js` ~255–280). Make temperature and development tell one story. For example, slow the heat curve so 196°C arrives around level 0.4, or derive the stage from temperature plus time above threshold. Then the receipt can't say "drying at 229°C".

## Fix log

### Fix work — 2026-10-27 · Codex (T16)

Plan: raise labels to at least 11px and prose/notes to 13px in every breakpoint, then inspect flow layout. Address behavioural R items with reproducible interaction checks and regenerate affected thumbnails.

- R1: fixed in 61fd555. Labels are at least 11px; protocol, cupping advice, keyboard instructions and footer are 13px. Caption rows wrap, and mobile secondary text remains readable.
- R2: fixed in 61fd555. Development now follows irreversible peak-temperature landmarks, shared with the 196°C / 224°C crack thresholds. Browser checks advanced the real update function in 1/60s steps after keyboard charge: first crack 196.16°C, second crack 224.05°C, City 207.05°C, Full City 224.53°C and automatic charcoal drop 252.03°C. Cooling cannot reverse development or erase crack history. Checked desktop/mobile, motion on/off.

### Fix verification — 2026-10-27 · Codex (T16)

- check-rules: OK (99 files, 26 projects).
- verify-sites: `--only 16,17,18,19,20 --cdn-mirror` → zero console errors, page errors and failed requests on every site. System Chromium; protocol CDN/font mirror used.
- Visual check: DONE at 1440×900 and 390×844, normal and reduced motion. Full-page captures inspected, no horizontal overflow. Computed-text scan found no visible DOM text below 11px in any of the four configurations per site.
- Thumbnail regenerated with `--force --cdn-mirror --wait 4500`.
