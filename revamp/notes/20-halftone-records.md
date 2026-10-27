# 20-halftone-records — HALFTONE

- **Vertical:** Record Label
- **Batch:** 4 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** done
- **Next step:** none — done.

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** The fictional label, four original synthesized records, analogue playback controls and warm halftone palette. Original opened at 1440×900 and 390×844 before edits.

**Weak points (with evidence):**
- A floating record and line tonearm lack the physical deck, counterweight and controls that sell the listening-room concept.
- Record sleeves have no artwork or artist names. The horizontal mobile crate clips the fourth record.
- Audio schedules from requestAnimationFrame, allowing stale beat times after a hidden tab; pitch changes do not retune existing voices and changing RPM changes tempo alone.

## Revamp plan
- Build an illustrated physical deck with a wood plinth, grooved platter, cartridge, counterweight and meter.
- Give all four records procedural geometric sleeve art and visible artist/tempo information in a responsive crate.
- Separate audio scheduling from drawing, add volume/tone controls and complete pitch/RPM handling; pause on visibility loss and support keyboard pitch and readable audio states.

## Pass log
- Pass 1: Rebuilt the listening room with an alloy/walnut deck, grooves, strobe rings, counterweight, cartridge, cue lever and backlit VU meter. Drew four original geometric sleeves with readable artists/catalogue IDs. Replaced frame-based scheduling with a bounded audio-clock scheduler, tracked voices for pitch/RPM changes, added volume/tone, keyboard pitch, tab-away pause and a complete needle transport.
- Pass 2: Inspected all four opening renders; corrected the mobile tagline spacing, moved the playing tonearm onto the groove and corrected pitched noise voices so RPM is not applied twice. The crate now keeps all four covers/artist labels available on mobile. Refined the deck’s physical controls and transport feedback.
- Pass 3: Final pass covered playback/pause, all four records, RPM, pitch/keyboard reset, volume mute, tone and visibility-change pause/resume. Measured nonzero synthesized output and silence at volume zero. Cancelled pending voice-detune automation before retuning so already-scheduled voices follow the new pitch. Verified a still opening and still playing composition under reduced motion, with the tonearm placed on the groove.

## Verification
- check-rules: `node scripts/check-rules.js` → **OK** (96 files, 26 projects).
- verify-sites: Scoped run for 16–20 with `--cdn-mirror` → **0 console errors, 0 page errors, 0 failed requests**. Chromium used `/usr/bin/chromium`; external CDNs/fonts are blocked here, so the protocol mirror supplied the same package versions and Google-font fallback.
- Visual check, desktop 1440x900: **DONE**, both normal and reduced motion. Inspected opening, lower controls/footer and interaction states. Also checked 1024×640.
- Visual check, mobile 390x844: **DONE**, both normal and reduced motion; controls remain available in document flow and no sideways overflow. Also checked 360×640.
- Reduced motion: Record, arm and meter have finished static idle/playing states. Audio and controls remain usable. Idle pixels matched at both extra short viewports.
- Thumbnail regenerated: `screenshot.js --id 20-halftone-records --force --cdn-mirror --wait 4500` at 1440×900, with an 8-core desktop profile for the full-quality path. `projects.json` description/tech updated; no `builtBy` field.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

Reviewed 2026-10-22 by Claude (T13) at 1440x900 and 390x844, motion on and reduced, against `origin/v1-original` served side by side (CDN/font mirror, headless SwiftShader; 8-core profile for the full-quality path). check-rules OK; verify-sites `--only 16,17,18,19,20 --cdn-mirror` all ok, zero console/page/request failures; no sideways scroll at either width. Thumbnails match the new look. No images of people (all imagery procedural).

A strong upgrade: the deck, sleeves with original art, crate, and audio-clock scheduling with pitch/RPM/volume/tone all work. Playing Paper Moon moves the arm onto the groove and swaps the label.

- [x] R1 (must) Text is too small to read. Sizes measured with `getComputedStyle` on every visible text node. At 390x844 "STEREO · MADE TO BE PLAYED" and "ON THE DECK" are 5px; the masthead, "DIRECT DRIVE 01" and "Reset to centre" are 6px; the primary button's "START LISTENING", PITCH / VOLUME / TONE and their values are 7px. At 1440x900 most labels are 7–8px, including "START LISTENING" on the main button and every control label. Bring body/notes to at least ~13px and uppercase labels to at least ~11px at both widths.

## Fix log

### Fix work — 2026-10-27 · Codex (T16)

Plan: raise labels to at least 11px and prose/notes to 13px in every breakpoint, then inspect flow layout. Address behavioural R items with reproducible interaction checks and regenerate affected thumbnails.

- R1: fixed in 61fd555. Masthead, transport/control labels and sleeve labels now have an 11px floor. Supporting copy, artist names and reset instruction use 13px. Mobile transport, header and mix rows wrap so the four-record crate remains accessible.

### Fix verification — 2026-10-27 · Codex (T16)

- check-rules: OK (99 files, 26 projects).
- verify-sites: `--only 16,17,18,19,20 --cdn-mirror` → zero console errors, page errors and failed requests on every site. System Chromium; protocol CDN/font mirror used.
- Visual check: DONE at 1440×900 and 390×844, normal and reduced motion. Full-page captures inspected, no horizontal overflow. Computed-text scan found no visible DOM text below 11px in any of the four configurations per site.
- Thumbnail regenerated with `--force --cdn-mirror --wait 4500`.

### Confirm — 2026-10-27 · Claude (T19)
Checked 61fd555 (on revamp at 7f5c745) at 1440x900 and 390x844 (CDN/font mirror, headless SwiftShader). check-rules OK; verify-sites `--only 16,17,18,19,20 --cdn-mirror` all ok, zero console/page/request failures; no sideways scroll at either width. A computed-style scan of every visible text node found nothing below 11px at either width on any of the five sites.
- R1 confirmed: masthead, "START LISTENING", PITCH / VOLUME / TONE and their values are 11px or larger; artist names and the reset line 13px. The mobile transport and mix rows wrap without overflow.
