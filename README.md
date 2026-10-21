# The Blueprint Labs

Premium web design portfolio — a showcase of code-driven visual design
capability across a wide range of business verticals and aesthetic styles.

Full context, constraints, and the phased build spec live in
[`CLAUDE.md`](./CLAUDE.md) (mirrored in [`AGENTS.md`](./AGENTS.md) for
Codex) and [`SPEC.md`](./SPEC.md).

## Status

- [x] Phase 1 — Hub shell + schema
- [x] Phase 2 — 25 standalone sites
- [x] Phase 3 — Hub polish + guide
- [x] Phase 4 — Flagship site 26: The Tideline (multi-page restaurant site)
- [x] Phase 5 — Hub flagship treatment for site 26
- [ ] Phase 6 — "Work With Me" page (not yet specced)
- [ ] Phase 7 — Revamp all 26 sites (see `revamp/BOARD.md`)

Live: https://the-blueprint-labs.vercel.app

## Structure

```
/sites/01-<slug>/index.html (+ style.css, script.js, /assets)
... through /sites/25-<slug>/
/sites/26-the-tideline/index.html (+ /menu/, /reservations/, /story/,
  /private-dining/, /gallery/, /contact/ — flagship multi-page site)
/guide/index.html
/index.html            <- Master Hub
/projects.json         <- single source of truth, drives the Hub
/BUILD_LOG.md          <- one line per completed site, for resumability
/DESIGN_NOTES.md       <- written at end of Phase 2, informs Hub polish
/PRODUCT.md            <- positioning + belief-ladder copy (site 26, Hub)
/CONTENT_BRIEF_SITE26.md <- content brief for The Tideline
/scripts/              <- screenshot.js, verify-sites.js (Playwright), check-rules.js
/revamp/               <- Phase 7 board, protocol and per-site notes (not deployed)
```

## Architecture

Static monorepo, no build step, no bundler. Three.js and GSAP (used by
the sites under `/sites/`) load via ES modules over CDN using
`<script type="importmap">`. Deploys to Vercel with zero config.

## `projects.json` schema

Each entry:

| Field        | Type       | Notes                                              |
|--------------|------------|-----------------------------------------------------|
| `id`         | string     | e.g. `"01-slug"` — matches the `/sites/` folder name |
| `title`      | string     | Display title on the Hub card                       |
| `vertical`   | string     | Business vertical, e.g. `"Fitness"`, `"Law Firm"`   |
| `styleTags`  | string[]   | Design style tags, e.g. `["brutalist"]`             |
| `accent`     | string     | Hex accent colour for the Hub card, e.g. `"#8f7cff"` |
| `description`| string     | One-line description                                |
| `thumbnail`  | string     | Path to static screenshot, e.g. `/sites/01-slug/assets/thumb.jpg` |
| `livePath`   | string     | Path to the live site, e.g. `/sites/01-slug/index.html` |
| `tech`       | string[]   | e.g. `["Three.js", "GSAP"]`                         |
| `status`     | string     | `"planned"` \| `"in-progress"` \| `"complete"`      |
| `flagship`   | boolean    | Optional. `true` on site 26 only — rendered as the Hub hero feature and excluded from the grid |

Currently 26 entries, all `"complete"`.

## Screenshot generation

`scripts/screenshot.js` (Playwright) generates a thumbnail per project once
sites exist and are servable at some base URL:

```
cd scripts
npm install
npm run screenshot -- --base-url http://localhost:3000
```

Re-run against the deployed Vercel URL to refresh thumbnails after a
site changes.

## Deploy

Zero-config static deploy on Vercel — see [`vercel.json`](./vercel.json).
[`.vercelignore`](./.vercelignore) keeps the internal `.md` notes,
`scripts/`, and `.claude/` out of the deployed site.

## Contact

The Hub's "Start a project" section (`index.html`) holds the contact form
and the direct channels (email, LINE Official Account, Facebook,
Instagram), repeated in the footer. All are marked `TODO` until real
values are supplied. The form posts to Formspree: set `data-endpoint` on
`#contact-form` to the real form URL; until then it tells visitors to use
the direct channels.
