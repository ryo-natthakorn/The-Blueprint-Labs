# The Blueprint Labs

Premium web design portfolio — a showcase of code-driven visual design
capability across a wide range of business verticals and aesthetic styles.

Full context, constraints, and the phased build spec live in
[`CLAUDE.md`](./CLAUDE.md) and [`SPEC.md`](./SPEC.md).

## Status

- [x] Phase 1 — Hub shell + schema
- [ ] Phase 2 — 25 standalone sites
- [ ] Phase 3 — Hub polish + guide

## Structure

```
/sites/01-<slug>/index.html (+ style.css, script.js, /assets)
... through /sites/25-<slug>/
/guide/index.html
/index.html            <- Master Hub
/projects.json         <- single source of truth, drives the Hub
/BUILD_LOG.md          <- one line per completed site, for resumability
/DESIGN_NOTES.md       <- written at end of Phase 2, informs Hub polish
```

## Architecture

Static monorepo, no build step, no bundler. Three.js and GSAP (used by
the 25 sites, Phase 2) load via ES modules over CDN using
`<script type="importmap">`. Deploys to Vercel with zero config.

## `projects.json` schema

Each entry:

| Field        | Type       | Notes                                              |
|--------------|------------|-----------------------------------------------------|
| `id`         | string     | e.g. `"01-slug"` — matches the `/sites/` folder name |
| `title`      | string     | Display title on the Hub card                       |
| `vertical`   | string     | Business vertical, e.g. `"Fitness"`, `"Law Firm"`   |
| `styleTags`  | string[]   | Design style tags, e.g. `["brutalist"]`             |
| `description`| string     | One-line description                                |
| `thumbnail`  | string     | Path to static screenshot, e.g. `/sites/01-slug/assets/thumbnail.jpg` |
| `livePath`   | string     | Path to the live site, e.g. `/sites/01-slug/index.html` |
| `tech`       | string[]   | e.g. `["Three.js", "GSAP"]`                         |
| `status`     | string     | `"planned"` \| `"in-progress"` \| `"done"`          |
| `builtBy`    | string     | Model that built it, e.g. `"Fable 5"`               |

`projects.json` starts as `[]` and is populated one entry per site during
Phase 2.

## Screenshot generation

`scripts/screenshot.js` (Playwright) generates a thumbnail per project once
sites exist and are servable at some base URL:

```
cd scripts
npm install
npm run screenshot -- --base-url http://localhost:3000
```

Re-run against the deployed Vercel URL in Phase 3 to refresh thumbnails
with the finished sites.

## Deploy

Zero-config static deploy on Vercel — see [`vercel.json`](./vercel.json).

## Contact

Placeholder contact info lives in the Hub footer (`index.html`), marked
`TODO:` until real values are supplied.
