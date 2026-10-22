# 12-ligature-foundry — LIGATURE

- **Vertical:** Type Foundry
- **Batch:** 3 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** changes requested
- **Next step:** Claude fixes the R item in T12, then Codex confirms in T15.

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
- Pass 1: Rebuilt as a scrolling specimen sheet. Hero: the word fitted to
  its widest instance, metric guides measured from the face (ascender,
  cap height, x-height, baseline, descender), weight and optical-size
  rulers with live marks, a pointer crosshair, a named-instance readout,
  sliders for wght/opsz/SOFT, Wonk and Italic chips, Next word, and an
  editable word (one line, 16 characters, paste as plain text). The
  instance eases toward its goal and breathes when idle. Sections: 02
  optical-size waterfall (120→9 px, each at its own opsz) with an
  Auto/Off comparison; 03 a 7 × 5 weight × optical-size matrix of
  buttons with an acid "you" crosshair; 04 the Latin glyph set with a
  sticky inspector (big glyph, guides, advance box, Unicode code and
  name); 05 an "In use" magazine spread whose headline is your word,
  with deck, two-column body, drop cap and pull quote, each at its own
  optical size; then a colophon. Sections receive the instance only
  while visible (throttled), and their type "sets" from hairline to
  your weight as it arrives. Screen/Proof palette switch, stored per
  viewer.
- Pass 2: Polish from renders. Guide labels collided (ascender vs cap
  height), so cap height now sits under its line and any colliding
  label is dropped. Rulers are inset so their end values stay inside,
  with the axis names in the corners and pointer mapping matched to the
  inset. The waterfall scaled non-monotonically on phones (38, 27, 19,
  13, then 30 px), so it now scales every size smoothly. Ragged body
  text on narrow columns (justified rivers), a wrapping hint, a larger
  word fit (widest weight at opsz 30–144), registration marks on the
  stage corners, and a full-width supersoft colophon wordmark (it
  overlapped the text).
- Pass 3: Viewports, input and tooling. Checked 1024x640, 768x1024,
  844x390 and 360x640: the nav hides under 900 px (it wrapped on
  tablets), and on portrait screens the stage sizes to the word instead
  of filling the window. Tested typing your own word (it flows into the
  magazine headline), design-space clicks, the inspector by hover and
  Tab, Italic/Wonk/Soft, Proof mode, and opsz Off. Added accessible
  names to the sliders. `scripts/cdn-mirror.js` now prefers the real
  Google Fonts stylesheet, falling back to Fontsource statics only when
  it is blocked, because the statics have no opsz, SOFT or WONK axes and
  every check of this site would otherwise be wrong.

## Verification
- check-rules: OK (96 files, 26 projects)
- verify-sites: `--only 12 --cdn-mirror` → ok, console 0, page 0,
  failed requests 0. Fonts came from the real Google Fonts service.
- Visual check, desktop 1440x900: done. Hero idle and conducted (both
  corners), italic + wonk + soft 100, Proof mode, every section, opsz
  Off, typing, design-space click, inspector hover and focus.
- Visual check, mobile 390x844: done. Hero, every section, Proof mode,
  plus 360x640, 768x1024 and landscape 844x390.
- Reduced motion: done. No breathing or set-in animation, the word swap
  is instant, and every control still works directly.
- Thumbnail regenerated: yes (`--wait 5000`, so the idle breathing has
  started).

## Review
Codex · 2026-10-22 · diff reviewed against `origin/v1-original`.

- [ ] R1 (must) Refresh the hero when it re-enters the viewport after a design-space selection. Reproduced at 1440×900 and 390×844 with reduced motion: scroll to the last matrix cell, wait until the hero is fully offscreen, choose weight 900 / opsz 9, then scroll back. The matrix marker says “you · 900 / 9”, but the hero, sliders and readout remain at weight 400 / opsz 72 indefinitely. `frame()` updates `shownKey` while `heroVisible` is false and the hero observer never invalidates that key on return. Publish the latest instance on re-entry (and verify normal motion before idle breathing masks the problem).

**Reviewer verification:** `check-rules` OK (96 files, 26 projects); scoped `verify-sites --cdn-mirror` console 0, page 0, failed requests 0. Visual check DONE at 1440×900 and 390×844, motion on/off; no horizontal overflow or blank canvas. Matrix selection, glyph inspector by keyboard, Screen/Proof and real four-axis Fraunces. The blocked Google Fonts endpoint was replaced locally by @fontsource-variable/fraunces 5.3.0 full-axis WOFF2, not a static font. Thumbnail inspected and matches the rebuilt scene. Procedural imagery contains no people/faces. Mobile/low-core quality limits inspected in code. All checklist items pass except the finding above.

## Fix log
