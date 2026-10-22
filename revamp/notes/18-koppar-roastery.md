# 18-koppar-roastery — KOPPAR

- **Vertical:** Coffee Roastery
- **Batch:** 4 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting review
- **Next step:** Claude: review this site in T13 against `origin/v1-original`, using the verification and interaction notes below.

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

## Fix log
