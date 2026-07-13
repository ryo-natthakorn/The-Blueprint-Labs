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

---

## Phase 4 — Flagship site: The Tideline (Fable 5, full budget, most ambitious site in the project)

**Why this phase exists:** the 25 sites are all single-page scroll
demos — visually strong, but they don't prove "this person builds
working business websites," which is what actually gets a freelance
client to hire Ryo. This site closes that gap. It is the single most
important site in the whole project — the one a real potential client
should look at and think "I want this for my business." Go further here
than anywhere else in the project. Every technique used across the other
25 sites is fair game to pull into this one if it earns its place —
custom shaders, scroll-driven storytelling, physics/particle work, sound
— but everything must also work as a real, usable restaurant website,
not just a showcase reel. Both things, at once, is the whole point.

**Read `CONTENT_BRIEF_SITE26.md` first** — full concept, menu, chef bio,
sample press quotes, hours, and a detailed reservation-flow interaction
spec are already written. Execute it, don't reinvent it. You may expand
on tone/copy, but keep the facts (name "The Tideline," fictional harbor
town "Harrow's Point," $$$ tier, coastal seasonal concept) as specced,
since `projects.json` and the Hub card need to match what's built.

Deliverables — `/sites/26-the-tideline/`:
- [ ] Persistent header nav + footer sitemap shared across every page —
      one coherent visual system, not reinvented per page
- [ ] `/` — home: story-first hero (lead with the tide-to-table point of
      view before the menu, per the design brief), signature visual
      moment (this is the place for your most ambitious piece of
      code — a water/tide/light motif fits the concept directly),
      press quotes, reservation CTA above the fold
- [ ] `/menu/` — full menu from the content brief, inline (never a PDF
      treatment), allergen/dietary tags visible inline per dish, not
      buried — this is a specifically called-out trust builder
- [ ] `/reservations/` — the engineering centerpiece: build the full
      interaction spec from `CONTENT_BRIEF_SITE26.md` exactly (party
      size → calendar date picker → varied/realistic time-slot
      availability grid → contact details → genuine confirmation
      summary screen). This needs to feel like a real product, not a
      toy. Front-end only — mark backend/reservation-platform
      integration clearly as `TODO:` in code comments
- [ ] `/story/` — chef bio and tide-to-table sourcing narrative from the
      brief. No posed chef photo or any real/identifiable people
      anywhere (project-wide rule) — use process, ingredient, and
      interior photography instead
- [ ] `/private-dining/` — events/chef's-table/buyout copy from the
      brief
- [ ] `/gallery/` — photography-led, masonry or lightbox interaction,
      food/interior/process shots only
- [ ] `/contact/` — hours, fictional location, general-inquiry form
      (client-side only, `TODO:` for real backend, consistent with the
      Hub's existing placeholder-contact pattern)
- [ ] Full mobile fidelity, not a reduced fallback — treat mobile as a
      first-class experience throughout, reservations flow included
      (60%+ of real restaurant site traffic is mobile — this site
      should actually earn that data point)
- [ ] Breadcrumbs where nesting makes sense
- [ ] **Five full iteration passes** on the whole site before calling it
      done — more than any other phase in this project, because this is
      the site doing the most work
- [ ] Update `projects.json`: add entry `26-the-tideline`,
      `builtBy: "Fable 5"`, and a `"flagship": true` field (additive,
      doesn't break the Phase 1 schema)
- [ ] Append a line to `BUILD_LOG.md`

The page list above is a floor, not a ceiling. If the concept wants more
— a seasonal menu toggle, a sourcing map for local farms/docks, an
ambient sound toggle, a page-transition system — take it. This is the
one site in the whole project explicitly scoped to use everything Fable
5 has, with no budget held back.

**Kickoff message for this session** (run `/model` → Fable 5 first):
```
Read CLAUDE.md, SPEC.md (Phase 4 section), and CONTENT_BRIEF_SITE26.md
in full before writing anything. Build site 26 — "The Tideline" — the
flagship site of the whole project, exactly as specced in both files.

This is the most important site here: it needs to prove I can build a
real, working business website, not just another striking single-page
demo. Full multi-page site (home, menu, reservations, story, private
dining, gallery, contact) with persistent shared nav — not a scroll
page. The reservations page is the centerpiece: build the full
interaction spec from the content brief exactly, it needs to feel like a
real product. No real or identifiable people in any imagery, anywhere —
food/interior/process photography only, self-hosted from Unsplash/
Pexels/Pixabay.

Go as ambitious as you want on the craft — this is the one site in the
project where nothing is held back, full budget, use every technique
that earns its place. But it still has to work as a real restaurant
website a client could actually picture for their own business, not
just a showcase. Both at once.

Five full iteration passes on the complete site before calling it done.
Update projects.json and BUILD_LOG.md when finished. Work autonomously —
don't stop to ask me anything until it's fully built and iterated.
```

---

## Phase 5 — Hub feature treatment for site 26 (Sonnet 5)

Deliverables:
- [ ] Give the site 26 card a distinct "flagship" treatment on the
      Hub grid (visually larger, or a badge/label — read
      `projects.json`'s `flagship` field to drive this), so it reads as
      the standout entry rather than card #26 of 26
- [ ] Regenerate its thumbnail via `scripts/screenshot.js`
- [ ] Verify all site 26 subpages resolve correctly on the live Vercel
      deployment (not just the homepage)

**Kickoff message for this session:**
```
Read CLAUDE.md, SPEC.md, and projects.json. Execute Phase 5 — give site
26 a flagship visual treatment on the Hub grid, regenerate its
thumbnail, and verify every subpage resolves on the live deployment.
```

---

## Phase 6 — "Work With Me" page (Sonnet 5, separate session, not yet specced)

The actual pitch to a hiring client — what Ryo offers, how the pick-a-
style-and-customize model works, a simple process, honest positioning
(no fabricated experience, testimonials, or client history). Links to
the style gallery (25 sites) and site 26 as proof of range and depth.
Not yet detailed — spec this out in its own session when ready.
