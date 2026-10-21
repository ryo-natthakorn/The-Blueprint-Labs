# 04-cipher-security — CIPHER

- **Vertical:** Cybersecurity
- **Batch:** 1 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** building
- **Next step:** Pass 1 (rebuild)

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
