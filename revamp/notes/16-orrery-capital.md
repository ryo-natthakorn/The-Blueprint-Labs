# 16-orrery-capital — ORRERY

- **Vertical:** Quantitative Finance
- **Batch:** 4 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting review
- **Next step:** Claude: review this site in T13 against `origin/v1-original`, using the verification and interaction notes below.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** The five orbital particle shells, gold/teal night palette, volatility control and celestial-market metaphor. Original rendered at 1440×900 and 390×844 with the CDN mirror before edits.

**Weak points (with evidence):**
- Desktop orbits extend beyond the whole viewport and compete directly with the thesis/control text. Mobile shows only the core and slices of the rings.
- The five shells have no names or selection, and “shift regime” offers no explanation of what changed. The only feedback is a percentage.
- Mobile still says 40,000 despite rendering 14,000; shader quality does not consider low-core desktops.
- Drag has no keyboard equivalent and the ticker is detached from the experiment.

## Revamp plan
- Build a research-desk composition: thesis, contained armillary instrument, scenario ledger, allocation/response diagram, and clear control rail.
- Name/select five asset shells; highlight the selected class, introduce an engraved brass core, graduated rails and swept orbital tracers.
- Four named regimes with narrative, metrics and a deterministic illustrative stress curve driven by the dial. Add top/orbit views and motion pause.
- Stack the instrument, live explanation and controls on mobile; keep all states interactive under reduced motion and cap heavy rendering on low-core hardware.

## Pass log
- Pass 1: Rebuilt as a research desk with a contained armillary, five selectable asset shells, four narrated regimes, illustrative response curve, orbit/plan views and motion control. Mobile has a full instrument followed by the controls and ledger. First four renders have no errors or overflow.
- Pass 2: Four-viewport review found the orbit too flat and the unselected shells too faint. Raised the opening viewpoint, widened the brass lines/core and restored more colour to the other shells. View changes now snap under reduced motion.
- Pass 3: Final interaction/design sweep covered all asset classes, all regimes, plan/orbit, keyboard Home/arrows and maximum volatility. Made camera distance respond to stress so expanded shells stay inside the instrument, and synchronized the view buttons after manual orbit. Verified both the 12,000-particle low-core path and 40,000-particle bloom path.

## Verification
- check-rules: `node scripts/check-rules.js` → **OK** (96 files, 26 projects).
- verify-sites: Scoped run for 16–20 with `--cdn-mirror` → **0 console errors, 0 page errors, 0 failed requests**. Chromium used `/usr/bin/chromium`; external CDNs/fonts are blocked here, so the protocol mirror supplied the same package versions and Google-font fallback.
- Visual check, desktop 1440x900: **DONE**, both normal and reduced motion. Inspected opening, lower controls/footer and interaction states. Also checked 1024×640.
- Visual check, mobile 390x844: **DONE**, both normal and reduced motion; controls remain available in document flow and no sideways overflow. Also checked 360×640.
- Reduced motion: A formed orrery starts paused; controls apply immediately. Pixel comparison remained identical while idle at 360×640 and 1024×640. Play motion is an explicit opt-in.
- Thumbnail regenerated: `screenshot.js --id 16-orrery-capital --force --cdn-mirror --wait 4500` at 1440×900, with an 8-core desktop profile for the full-quality path. `projects.json` description/tech updated; no `builtBy` field.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
