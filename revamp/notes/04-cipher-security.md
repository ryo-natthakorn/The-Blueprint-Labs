# 04-cipher-security — CIPHER

- **Vertical:** Cybersecurity
- **Batch:** 1 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** done

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

Rendered at 1440x900 and 390x844 (motion on/off) through boot,
`help`, `scan demo.target` and `casework`.

**Keep:**
- Concept: the whole site is a working terminal. Every command and all
  the copy (services, scan, casework with redactions, team handles, why,
  uptime, whoami, sudo joke, matrix, clear, ls/man aliases), the history
  and tab completion that already exist, the ASCII banner, and the
  shortcut buttons.
- P1 green phosphor palette with amber / red / cyan accents, IBM Plex
  Mono.

**Weak points (with evidence):**
- On a 1440px screen the terminal is a 62rem column of ~14px text in the
  middle, and two-thirds of the screen is black (boot shot). The "CRT"
  is a scanline gradient and an opacity flicker on top of flat DOM text:
  no tube curvature, phosphor glow, persistence or mask.
- Digital rain is one random glyph per column per frame at 50% opacity
  behind the panel, read as faint dashes.
- Phones (390px): the scan table wraps mid-row ("redirects / to 443 —
  good"), progress-bar percentages drop to the next line, `tcp syn
  1-1024` breaks, and help descriptions wrap without alignment (mobile
  scan and help shots).
- Input font-size is 0.78rem (12.5px), so iOS Safari zooms the page on
  focus.
- Output isn't exposed to assistive tech: no `role="log"` /
  `aria-live`, so typed results are silent.
- `scan` prints a static table after four progress bars. The most
  "show, don't tell" command shows nothing.
- When the phone keyboard opens, nothing re-lays the terminal to the
  visual viewport.

## Revamp plan
- **A real CRT:** draw the terminal (status bar, scrollback, prompt,
  rain) onto a canvas at device resolution, and show it through a WebGL
  tube: barrel curvature, rounded glass with bezel, scanlines,
  aperture-grille mask, chromatic fringe, phosphor glow (bloom),
  persistence (afterimage), vignette, a faint rolling refresh band, and a
  power-on sequence. Phones keep curvature, scanlines and a cheap glow
  but skip bloom and persistence.
- **Text engine:** monospace grid layout with word wrap and hanging
  indents, typed reveals, live blocks (progress bars, scans), scrollback
  (wheel, drag, PgUp/PgDn), auto-follow. All copy is authored to two
  widths (wide and narrow) so tables never break on phones.
- **Scan becomes visual:** a 1,024-port grid sweeps, open ports flare,
  then a service table (cards on narrow screens).
- **More terminal:** `theme amber|green` swaps the phosphor (P3 amber /
  P1 green), plus `history`, `date` and `exit`. `matrix` lets the rain
  take over the screen for a few seconds.
- **Accessibility:** a real input (16px, transparent) sits over the
  prompt and receives focus from any tap; every printed line is mirrored
  into a visually hidden `role="log"`. Shortcut buttons and the back link
  stay real DOM on a hardware strip under the screen. The visual
  viewport drives layout when the keyboard opens.
- **Fallbacks:** reduced motion has no power-on, flicker, roll or
  typing, and static rain; no WebGL shows the 2D canvas directly.

## Pass log
- Pass 1: Rebuilt as a canvas terminal shown through a three.js CRT
  tube: barrel curvature, rounded glass and bezel, light scanlines,
  aperture-grille mask, chromatic fringe, bloom and afterimage
  persistence on desktop (cheap 8-tap glow on phones), vignette, noise,
  rolling refresh band and power-on. Text engine: monospace grid, word
  wrap with hanging indents, typed reveals, live blocks, scrollback
  (wheel, drag, PgUp/PgDn) with a "back to latest" link. Rain is drawn on
  its own canvas at ~30 Hz behind a dimming panel. The scan is now
  visual: a 1,024-cell grid of 8,192 ports sweeps, open ports flare
  (risky ones in red), with a legend. The real input (16px, invisible)
  sits over the prompt row, and every line is mirrored into a hidden
  `role="log"`. The visual viewport sets the height so the prompt clears
  the phone keyboard. `theme amber|green`, `history`, `date` and `exit`
  added. Fixed on first render: widget progress went negative (rAF
  timestamps can precede `performance.now()`), which made `repeat()`
  throw.
- Pass 2: Made it easy to understand and play, at the user's request.
  The welcome says in one plain sentence what CIPHER is and that no
  commands are needed, then shows a numbered menu (1–6). Number keys run
  items without Enter. Commands in the output are tappable links,
  hit-tested through the same barrel warp as the shader, with forgiving
  row tolerance on touch. Dim ghost suggestions appear while typing
  (Tab or → accepts) with a short description. Plain questions are routed
  ("who are you" → team, "show me a demo" → scan, "how much" → a note
  that CIPHER is fictional). Typos get "Did you mean …?" with the fix
  prefilled for Enter. Every main command ends with "next →" picks plus
  menu. A guided `tour` (services → scan → casework, narrated) is the
  first button. Any tap or key fast-forwards a running animation, and a
  command chosen mid-run is queued. Copy rewritten for non-specialists
  (ports = "doors", findings explained in plain words, case files
  without jargon). The button strip uses plain labels ("What we do",
  "Live scan", "Case files"…) with the command beneath. Scanlines and the
  mask were lightened for legibility, power-on is clock-based (at low
  frame rates the raster never fully opened), and Tab only completes
  when there is a suggestion, so keyboard users can still Tab out.
- Pass 3: Viewports and fallbacks. Checked 844x390, 768x1024, 2560x1080
  and the no-WebGL path (the 2D canvas is shown directly, without
  curvature, and is fully usable). Very wide screens got larger type (up
  to 22px). Phones on their side get a one-row button strip without
  sub-labels and the disclaimer text hidden (the back link stays). Verified
  that mouse hover highlights a tappable command and a click runs it. The
  placeholder says "tap" on touch devices. Boot shortened to about 1.5 s.

## Verification
- check-rules: OK (96 files, 26 projects)
- verify-sites: `--only 04 --cdn-mirror` → ok, console 0, page 0, failed
  requests 0. Three.js came from local npm copies (cdn.jsdelivr.net is
  blocked here); IBM Plex Mono loaded from Google Fonts.
- Visual check, desktop 1440x900: done (welcome, ghost suggestion,
  number key → scan mid-sweep and finished, typo → "did you mean",
  plain question, full guided tour, link hover and click). High tier
  (8 cores emulated); SwiftShader runs it at about 5 fps.
- Visual check, mobile 390x844: done (same flows, plus the tour).
- Reduced motion: done. No power-on, flicker, roll or typing, static
  rain, instant widgets; the tour completes as a finished transcript.
- No WebGL: 2D canvas fallback, all interactions work.
- Keyboard: number keys, Tab/→ completion, ↑↓ history, PgUp/PgDn, and Tab
  out to the buttons and back link (no trap). Screen readers: output
  mirrored to a polite `role="log"`.
- Thumbnail regenerated: yes (welcome menu, 1440x900).

## Review
Codex review (2026-10-21): No findings. Compared the revamp with
`origin/v1-original` and checked the §5 checklist. At 1440×900 and 390×844,
with motion enabled and reduced, the concept, visual craft, layout and
interactions hold up. No horizontal overflow or page errors. `verify-sites`
passed with `--cdn-mirror` (the mirror supplied the original npm CDN packages
and Google font families locally); `check-rules` printed OK. The refreshed
thumbnail matches the opening state.

## Fix log

- 2026-10-22 · Codex · T7 confirmation: no R items or builder fixes exist; site code is unchanged since the completed T2 review (`c539b15`). Stage remains done; no duplicate BUILD_LOG entry.
