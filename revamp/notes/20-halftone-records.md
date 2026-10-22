# 20-halftone-records — HALFTONE

- **Vertical:** Record Label
- **Batch:** 4 · **Builder:** Codex · **Reviewer:** Claude
- **Stage:** awaiting review
- **Next step:** Claude: review this site in T13 against `origin/v1-original`, using the verification and interaction notes below.

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

## Fix log
