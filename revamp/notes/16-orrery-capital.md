# 16-orrery-capital — ORRERY

- **Vertical:** Quantitative Finance
- **Batch:** 4 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** changes requested
- **Next step:** Codex fixes the R items in T16, then Claude confirms in T19.

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

Reviewed 2026-10-22 by Claude (T13) at 1440x900 and 390x844, motion on and reduced, against `origin/v1-original` served side by side (CDN/font mirror, headless SwiftShader; 8-core profile for the full-quality path). check-rules OK; verify-sites `--only 16,17,18,19,20 --cdn-mirror` all ok, zero console/page/request failures; no sideways scroll at either width. Thumbnails match the new look. No images of people (all imagery procedural).

A clear step up in structure: the research-desk layout, named shells, four regimes and the response curve answer v1's "what changed?" problem, and the 12,000-particle low path and keyboard orbit are in place.

- [ ] R1 (must) Text is too small to read. Sizes measured with `getComputedStyle` on every visible text node. At 1440x900 the explanatory copy (intro paragraph, regime note, orbit note) is 10px grey `#89928e` on near-black, and labels ("FIG. 01", "Model volatility", "12,000 instruments", "Drag to orbit…") are 8–9px. At 390x844 it drops to 7px ("Research note 016", "FIG. 01", instrument count) and 8–9px on the asset and regime buttons. Bring body/notes to at least ~13px and uppercase labels to at least ~11px at both widths, and keep the grey at a readable contrast.
- [ ] R2 (must) The slider and the regime readout disagree. Drag "Disturb the system" to 100 while "01 Quiet" is selected: the panel still says "Equilibrium — Low dispersion. Independent paths around a common centre." and "01 Quiet" stays pressed, while model volatility reads 70.0%, coupling 0.92 and the shells have dissolved into a cloud. `vol`'s input handler (`script.js` ~line 317) only sets `volGoal`. Make the slider move the readout too (nearest regime, or a "Custom stress" state with its own note and no regime pressed). Also, the buttons and headings use different names ("01 Quiet" vs "Equilibrium", "04 Reversion" vs "Mean reversion"). Pick one name for each.
- [ ] R3 (nice) On desktop the instrument is small next to v1's full-bleed galaxy: about 460px wide in a 1440 frame, and the brass core reads as a dot. Let the outer shells grow or bleed behind the columns, and give the core more presence (scale, bloom).

## Fix log
