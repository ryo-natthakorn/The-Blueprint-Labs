# 17-maison-vela — MAISON VELA

- **Vertical:** Haute Couture
- **Batch:** 4 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** done
- **Next step:** none — done.

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

Reviewed 2026-10-22 by Claude (T13) at 1440x900 and 390x844, motion on and reduced, against `origin/v1-original` served side by side (CDN/font mirror, headless SwiftShader; 8-core profile for the full-quality path). check-rules OK; verify-sites `--only 16,17,18,19,20 --cdn-mirror` all ok, zero console/page/request failures; no sideways scroll at either width. Thumbnails match the new look. No images of people (all imagery procedural).

Big gain over v1's printed billboard: the gathered pleats, rail and dye ledger read as a real material study, and the static reduced-motion drape is composed.

- [x] R1 (must) Text is too small to read. Sizes measured with `getComputedStyle` on every visible text node. At 390x844 the dye sub-labels ("01 / WARM WHITE"…) and "1 : 1 MATERIAL STUDY" are 6px, and "COUTURE · ATELIER Nº 7", "SILK CHARMEUSE", "Drag softly across the silk" and "Hand-finished selvedge" are 7px. At 1440x900 the same labels are 7–8px, and the dye note and controls ("Air in the atelier", "Pause", "Lift silk") are 10–11px. Bring body/notes to at least ~13px and uppercase labels to at least ~11px at both widths.
- [x] R2 (nice) The drape crosses through itself near the left selvedge, about halfway down. A 1:1 crop at 1440x900 shows a light/dark tear where one fold passes through another, in the same place for Ivoire and for Sang-de-bœuf at full breeze. Worth a look at the pleat-restoring force or self-collision there.

## Fix log

### Fix work — 2026-10-27 · Codex (T16)

Plan: raise labels to at least 11px and prose/notes to 13px in every breakpoint, then inspect flow layout. Address behavioural R items with reproducible interaction checks and regenerate affected thumbnails.

- R1: fixed in 61fd555. All label declarations, including phone overrides, are at least 11px; dye/prose/handling instructions/footer use 13px. The captions, dye ledger and controls stay in document flow.
- R2: not fixed, because robust cloth self-collision needs a solver change and extra contact constraints; simply strengthening the pleat force suppresses the cloth’s touch/breeze response without guaranteeing separation. This optional issue remains a known visual limitation at full breeze. The finished reduced-motion drape remains intact.

### Fix verification — 2026-10-27 · Codex (T16)

- check-rules: OK (99 files, 26 projects).
- verify-sites: `--only 16,17,18,19,20 --cdn-mirror` → zero console errors, page errors and failed requests on every site. System Chromium; protocol CDN/font mirror used.
- Visual check: DONE at 1440×900 and 390×844, normal and reduced motion. Full-page captures inspected, no horizontal overflow. Computed-text scan found no visible DOM text below 11px in any of the four configurations per site.
- Thumbnail regenerated with `--force --cdn-mirror --wait 4500`.

### Confirm — 2026-10-27 · Claude (T19)
Checked 61fd555 (on revamp at 7f5c745) at 1440x900 and 390x844 (CDN/font mirror, headless SwiftShader). check-rules OK; verify-sites `--only 16,17,18,19,20 --cdn-mirror` all ok, zero console/page/request failures; no sideways scroll at either width. A computed-style scan of every visible text node found nothing below 11px at either width on any of the five sites.
- R1 confirmed: dye sub-labels, "1 : 1 MATERIAL STUDY", masthead and handling labels are 11px; dye notes and controls 13px, at both widths.
- R2 (nice) declined with a sound reason (needs a self-collision solver; stiffer pleats would kill the touch response). Accepted.
