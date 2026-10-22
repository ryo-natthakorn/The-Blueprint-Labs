# 17-maison-vela — MAISON VELA

- **Vertical:** Haute Couture
- **Batch:** 4 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting review
- **Next step:** Claude: review this site in T13 against `origin/v1-original`, using the verification and interaction notes below.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** The simulated silk, four seasonal dyes, dark atelier and Cormorant/Jost typography. Original opened at 1440×900 and 390×844 before code edits.

**Weak points (with evidence):**
- The cloth reads as a flat rectangular billboard: oversized printed branding and almost no permanent folds after settling.
- Desktop hanging rail is clipped; mobile hides the manifesto and every dye name, leaving four small anonymous chips.
- The reduced-motion loop still integrates gravity and cloth continuously. Lower mobile particle count also changes the physical cloth dimensions.

## Revamp plan
- Compose a material study with an editorial introduction, a contained full-length textile and a readable dye ledger.
- Gather the hanging edge into permanent pleats, add a fine weave, stitched selvedges and a small atelier label; keep physical dimensions at every resolution.
- Add breeze, lift and pause controls with keyboard access. Reduced motion starts as a finished drape and changes fabric instantly; touch controls remain named and usable.

## Pass log
- Pass 1: Rebuilt the atelier around gathered silk, fine woven texture, stitched selvedges, a small label and a brass suspension rail. Preserved a full-size fabric on low-resolution meshes; added readable dye cards, breeze, lift and pause controls. Reduced motion starts from a composed static drape.
- Pass 2: Desktop renders exposed an unintended five-line title that pushed the material facts too far down. Recut the headline and reduced its scale; strengthened the soft pleat-restoring force after inspecting the moving and static cloth. Kept the full rail, hem and hanging shadow in frame.
- Pass 3: Final mobile pass rebuilt the headline line breaks and separated the supporting copy. Exercised all four dyes, maximum breeze, lift/release, pause/play and keyboard lift in both motion preferences. Checked the full-resolution textile as well as the low-core mesh and confirmed that reduced-motion opening pixels remain identical over time.

## Verification
- check-rules: `node scripts/check-rules.js` → **OK** (96 files, 26 projects).
- verify-sites: Scoped run for 16–20 with `--cdn-mirror` → **0 console errors, 0 page errors, 0 failed requests**. Chromium used `/usr/bin/chromium`; external CDNs/fonts are blocked here, so the protocol mirror supplied the same package versions and Google-font fallback.
- Visual check, desktop 1440x900: **DONE**, both normal and reduced motion. Inspected opening, lower controls/footer and interaction states. Also checked 1024×640.
- Visual check, mobile 390x844: **DONE**, both normal and reduced motion; controls remain available in document flow and no sideways overflow. Also checked 360×640.
- Reduced motion: Finished pleats start static; lift/drag/breeze make deliberate static studies. Idle pixels matched at 360×640 and 1024×640. Play explicitly enables the simulation.
- Thumbnail regenerated: `screenshot.js --id 17-maison-vela --force --cdn-mirror --wait 4500` at 1440×900, with an 8-core desktop profile for the full-quality path. `projects.json` description/tech updated; no `builtBy` field.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
