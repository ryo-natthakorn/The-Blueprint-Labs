# The Blueprint Labs

Premium web design portfolio — a showcase of code-driven visual design
capability across a wide range of business verticals and aesthetic styles.
Freelance portfolio site.

## Architecture
Static monorepo, no build step, no bundler required. Three.js and GSAP are
loaded via ES modules over CDN using `<script type="importmap">` (jsdelivr
or unpkg module builds) — this unlocks the full modern Three.js addon
ecosystem (EffectComposer, post-processing passes, OrbitControls,
GLTFLoader, node materials, etc.), not just the stripped-down UMD/global
build. Still deploys to Vercel with zero config.

```
/sites/01-<slug>/index.html (+ style.css, script.js, /assets)
... through /sites/25-<slug>/
/guide/index.html
/index.html            <- Master Hub
/projects.json         <- single source of truth, drives the Hub
/BUILD_LOG.md          <- one line per completed site, for resumability
/DESIGN_NOTES.md       <- written at end of Phase 2, informs Hub polish
/README.md
```

See `SPEC.md` for the phased, batch-by-batch task breakdown.

## Model policy — do not deviate

| Phase | Scope | Model |
|---|---|---|
| 1 | Hub shell, projects.json schema, screenshot script, deploy config | Sonnet 5 |
| 2 | The 25 standalone sites, 3 iteration passes each | **Fable 5** — full budget, no cost constraint |
| 2 (tail) | DESIGN_NOTES.md summary | Fable 5 |
| 3 | Hub visual polish, /guide content, deploy verification | Sonnet 5 (escalate to Opus 4.8 only if genuinely stuck on a specific task) |

Fable 5 is used **only** in Phase 2. Don't escalate to Opus by default
elsewhere — per-task, only when Sonnet actually struggles.

Each phase runs in its own fresh session. Don't carry a prior phase's
conversation forward — read CLAUDE.md and SPEC.md fresh each time instead.

## Hard constraints (all phases)
- No paid or external AI image/video generation APIs, ever.
- No live third-party image hotlinking — `source.unsplash.com` is dead,
  the live Unsplash API needs a key and rate-limits. Self-host images per
  site instead (download once into `/sites/NN-slug/assets/`) — no cap on
  count, use as many as the concept needs.
- Fonts: Google Fonts only. Icons: Font Awesome free tier.
- Never use real company names, logos, or trademarks — invent a fictional
  brand for every site.
- Respect `prefers-reduced-motion` everywhere animation is used, with a
  static fallback. This is a fallback state only — it must not dampen the
  default desktop experience.
- Reduce particle counts / disable the heaviest shader effects on mobile
  or lower-end devices rather than assuming full desktop fidelity. Also a
  fallback state, not a cap on the primary build.
- Baseline accessibility: alt text, visible focus states, semantic HTML.
- No mention of Claude, Fable 5, or AI authorship anywhere except `/guide`.
- Contact info (placeholder email + placeholder Fastwork URL, marked
  `TODO:`) lives on the Hub only. The 25 sites are single-scene capability
  showcases with no required section structure and no contact section.
- Never embed more than 2-3 live WebGL `<iframe>`s at once on the Hub —
  browsers cap concurrent WebGL contexts around 16 and the page will
  crash or stutter well before that. This limit applies to the Hub grid
  only, not to how sophisticated any individual site is allowed to be.
- Reference all site-local assets (CSS, JS, images) via root-absolute
  paths scoped to the site's own folder (e.g.
  /sites/01-aurora-audio/style.css), never bare relative filenames —
  these routes are served without a trailing slash, which breaks
  relative-path resolution.

## Performance
- **Hub (Phase 1/3):** Lighthouse 90+, FCP under ~2s — this is the entry
  point and should load fast.
- **The 25 sites (Phase 2):** no performance score gate. Visual ambition
  takes priority. Avoid only catastrophic load times or a frozen/dead
  page — beyond that, push particle counts, shader complexity, and
  animation density as far as the concept calls for.

## Brand
Name: **The Blueprint Labs**

## State files
- `projects.json`: id, title, vertical, style tags, description, thumbnail
  path, live path, tech used, status, built-by (model).
- `BUILD_LOG.md`: append one line per completed site. If a session is
  interrupted, resume from here — don't restart.
