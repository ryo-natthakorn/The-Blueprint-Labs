# Build Spec — The Blueprint Labs

Full context and constraints live in `CLAUDE.md`. This file is the
batch-by-batch execution plan. Each phase runs in its own fresh Claude
Code session — switch models with `/model` before starting each phase's
kickoff message below, and don't carry a prior phase's conversation
forward.

---

## Phase 1 — Hub shell + schema (Sonnet 5)

Deliverables:
- [ ] `/index.html` — responsive grid, renders cards dynamically from
      `projects.json` (empty/placeholder data is fine for now)
- [ ] Filter/sort controls by vertical and style tag
- [ ] Card = static thumbnail image + title + tags; live `<iframe>`
      preview loads only on hover (desktop) / tap (mobile)
- [ ] Concurrent live iframes capped at 2-3, offscreen ones
      paused/unloaded via IntersectionObserver
- [ ] `/projects.json` schema defined and committed (empty array,
      correct shape)
- [ ] Screenshot-generation script (Playwright) that produces a
      thumbnail per site once sites exist
- [ ] `vercel.json` / deploy config, README skeleton
- [ ] Git repo initialized, pushed to GitHub
- [ ] Footer/contact link on the Hub — placeholder email + placeholder
      Fastwork URL, both marked `TODO:` per CLAUDE.md (contact now lives
      here, not on individual sites)

**Kickoff message for this session:**
```
Read CLAUDE.md. Build Phase 1 exactly as specced in SPEC.md — Hub shell
and projects.json schema only, no site content yet. Work autonomously
through the Phase 1 checklist and tell me when it's ready to review.
```

---

## Phase 2 — 25 sites (Fable 5, full budget, go nuts)

- Build in batches of 4-5. Choose all 25 concepts autonomously — mix
  business verticals and design styles, no repeated vertical+style
  combination, no topic restrictions.
- Each site is a single page, a single visual/interactive scene or
  moment — no required section structure (no mandatory
  hero/about/work/contact breakdown). These 25 exist to show what Fable 5
  can do, not to double as full landing pages: pour the effort into one
  cohesive experience per concept rather than a series of standard
  content blocks. Structural approach is wide open — a scroll-driven
  scene, a single unbroken 3D moment, a generative interactive canvas,
  whatever best demonstrates the technique — and should vary from site to
  site, not just the visual skin. Contact info lives on the Hub, not on
  individual sites (see Phase 1).
- Three full iteration passes per site before marking it done (design
  problems, opportunities to improve/complexify, animation polish,
  responsiveness).
- No performance score gate on these sites — visual ambition takes
  priority, per CLAUDE.md. Avoid only a catastrophically slow load or a
  frozen/dead page.
- After each site: update `projects.json` (including which model built
  it) and append a line to `BUILD_LOG.md`.
- Work through all 25 completely autonomously — do not stop to ask
  anything until every site is built, iterated three times, and logged.
- Last step of this phase: write `DESIGN_NOTES.md` — a short summary of
  the color palettes, motion patterns, and typography choices used
  across the 25 sites, for Phase 3 to reference. Keep it brief — a
  summary, not a rebuild.

**Kickoff message for this session** (run `/model` → Fable 5 first):
```
Read CLAUDE.md and SPEC.md. Execute Phase 2 exactly as specced — build
all 25 sites autonomously in batches of 4-5, three iteration passes
each, per the constraints in CLAUDE.md. Visual ambition takes priority
over performance score for these sites — push it. Vary structure and
navigation across sites, not just visual skin. Do not ask me anything
until fully done. Finish with DESIGN_NOTES.md.
```

---

## Phase 3 — Hub polish + guide (Sonnet 5, escalate to Opus only if stuck)

Deliverables:
- [ ] Hub visual polish pass — read `DESIGN_NOTES.md` and
      `projects.json`, refine the Hub's look to feel coherent with the
      25 sites it showcases (a refinement of Phase 1's shell, not a
      rebuild)
- [ ] `/guide/index.html` — document the tools/techniques used
      (Three.js, GSAP, Vercel, monorepo structure, batching workflow)
      and that the 25 sites were built by Claude Fable 5. This is the
      only page where AI authorship is mentioned.
- [ ] Run the Phase 1 screenshot script against the finished 25 sites
      to generate real thumbnails
- [ ] Verify Vercel deployment, confirm the live link and all 25 site
      routes resolve correctly

**Kickoff message for this session:**
```
Read CLAUDE.md, SPEC.md, DESIGN_NOTES.md, and projects.json. Execute
Phase 3 — Hub polish and /guide content. Give me the live Vercel link
and repo URL when done.
```
