# 12-ligature-foundry — LIGATURE

- **Vertical:** Type Foundry
- **Batch:** 3 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** building
- **Next step:** Pass 1 rebuild (plan below).

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

Rendered at 1440x900 and 390x844 (motion on/off): idle breathing, pointer
at both corners, wheel + W key, and the next word. Fonts came from the
real Google Fonts service (it is reachable here). `scripts/cdn-mirror.js`
used to swap Fraunces for static Fontsource files, which have no opsz,
SOFT or WONK axes, so it now tries the real stylesheet first.

**Keep:**
- Concept: a specimen you conduct. Pointer X bends weight and Y bends
  optical size, live, on one variable serif with four axes (wght, opsz,
  SOFT, WONK). Pure DOM: the medium is the typeface.
- The word list, the idle "breathing" through the weight axis, and the
  glyph strip that answers the pointer.
- Near-black paper, cream ink, acid #d9ff44, Space Grotesk labels.

**Weak points (with evidence):**
- One word floats in an otherwise empty screen. There is nothing a type
  specimen normally shows: no sizes, no glyph set, no text setting, and
  no sense of the design space. A foundry called LIGATURE shows no
  type in use at all.
- The HUD is 0.72rem grey in a corner and is display-only. SOFT is only
  reachable by mouse wheel and WONK only by the W key, so neither exists
  on a phone or for most visitors.
- Mobile 390x844: the word fills about a tenth of the screen, the axis
  readout and hint are hidden, and the only control is an undiscoverable
  drag anywhere. The masthead name and subtitle run into each other.
- The glyph wave is a single grey row of 21 characters with a tiny
  highlight.
- The variable font's italic (it is loaded) is never shown.
- There are no metric guides, rulers or named instances, the language a
  type designer would recognise.

## Revamp plan
- **Hero conductor:** the word set as large as its widest instance
  allows, with live metric guides (ascender, cap height, x-height,
  baseline, descender), a pointer crosshair, and rulers for weight
  (bottom) and optical size (left). A named instance readout ("SemiBold ·
  Poster · Soft") with the raw values. The word is editable (type your
  own), with shuffle, an italic toggle and a WONK toggle. Real sliders
  for all four axes work by touch and keyboard. On touch, a horizontal
  drag conducts weight without blocking page scroll.
- **A full specimen sheet below, set in your instance:**
  02 Optical sizes: a 120→9 px waterfall with true optical sizing, and an
  "opsz off" comparison. 03 Design space: a weight × optical-size matrix
  you can click to jump the instance, with your position marked.
  04 Glyphs: the character set with an inspector (big glyph, metrics,
  advance box, Unicode name). 05 In use: a magazine spread (headline from
  your word, deck, two-column body with drop cap, pull quote) where
  every size takes its own optical size.
- **Screen / Proof** palette switch (dark screen vs cream proof paper).
- **Motion:** idle breathing in the hero; type in each section "sets"
  from hairline to your instance as it enters. Only visible sections are
  updated, and throttled.
- **Fallbacks:** reduced motion keeps everything static and still fully
  interactive. Mobile stacks the sections with sliders in a compact
  strip.

## Pass log
- Pass 1:
- Pass 2:
- Pass 3:

## Verification
- check-rules:
- verify-sites:
- Visual check, desktop 1440x900:
- Visual check, mobile 390x844:
- Reduced motion:
- Thumbnail regenerated:

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log
