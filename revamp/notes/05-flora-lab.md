# 05-flora-lab — Flora Lab

- **Vertical:** Botanical Perfumery
- **Batch:** 1 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** done

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

Rendered at 1440x900 and 390x844 (motion on/off), at the starter
garden and after planting three irises.

**Keep:**
- Concept: plant seeds in a living garden; five perfume botanicals
  (Damask Rose, Orris Iris, Night Jasmine, Wild Marigold, Vetiver Grass)
  with their perfumery roles (top / heart / base); the accord builds
  itself from what you grow; a starter garden so the page opens alive.
- Fraunces + Karla, warm paper palette, moss accent, seed tray with
  swatches and notes, "perfume, grown not made".

**Weak points (with evidence):**
- The garden is thin and flat: single hairline stems with a few ellipse
  petals, in one band across the middle (start shots). The top half of
  the screen is empty paper, and there is no depth, light or ground
  texture, only a hard horizon rule across the page.
- Growth is a length ease, then flowers pop in at 3 s. No buds opening,
  no leaves unfurling. Wind is a tiny rotation of the whole plant.
- The accord panel is a percentage list. Nothing reads as a perfume
  being made: no top/heart/base structure, no name, no colour, no bottle.
- Phones: the accord panel and the two-row seed tray cover the lower
  half of the screen, which is exactly the soil you have to tap (mobile
  shots). Planting there hits the panel instead.
- The keyboard can only plant at random positions (Enter on the
  canvas), and there's no visible planting cursor.
- At the cap (45 desktop / 22 mobile) the oldest plant silently
  disappears.
- There's no feedback for where a tap will plant and no response in the
  soil when it does.

## Revamp plan
- **Botanical-plate plants:** each species gets its own growth habit.
  Branching rose with compound leaves; iris with basal sword leaves and
  a tall flower stalk; an arching jasmine vine with clustered stars; a
  bushy marigold with feathery leaves; a vetiver clump with golden seed
  plumes. Stems are tapered ribbons that grow from the tip, leaves
  unfurl as nodes form, and buds swell and open. Blooms are pre-rendered
  as detailed sprites (gradients, sepals, beards, ruffles) at several
  stages of opening.
- **Depth and light:** a sky glow with layered sage hills, textured soil,
  depth scaling with atmospheric fade toward the back, and contact
  shadows.
- **A living garden:** a noise wind field that bends stems more at the
  tips, a cursor breeze, bees that visit open blooms, and scent wisps
  that rise from open flowers and drift into the perfume.
- **The perfume:** a bottle whose liquid mixes the bloom colours and
  fills as the garden flowers; a fragrance pyramid (top / heart / base)
  with the notes in each tier; a generated name and a one-line
  description of how it opens and dries down. Updated as flowers open,
  announced politely.
- **Planting:** a ghost seed under the cursor, a soil burst when you
  plant, arrow keys moving a visible planting cursor (Enter plants, 1–5
  pick seeds). At the cap the oldest plant wilts away instead of
  vanishing, and "Harvest & replant" clears the garden with a fade.
- **Phones:** a compact perfume bar at the top (expandable) and a
  one-row seed strip, so the soil stays tappable.
- **Fallbacks:** reduced motion shows plants fully grown and still, with
  no bees or wisps.

## Pass log
- Pass 1: Rebuilt the garden. Each botanical has its own growth habit:
  a branching rose with compound serrated leaves, an iris with basal
  sword leaves and a tall stalk (sometimes a second bud), an arching
  jasmine vine with star clusters, a bushy marigold with feathery
  leaves, and a vetiver clump with golden seed plumes. Stems are tapered,
  Chaikin-smoothed ribbons that grow from the tip. Leaves unfurl as each
  node is reached, and buds swell and open through 8 pre-rendered sprite
  stages (gradients, sepals, beards, ruffled heads). A static background
  holds the paper sky, warm light, three layers of sage hills, the soil
  bed with furrows, grit and grain. Depth scale and atmospheric fade run
  toward the back, with contact shadows. Wind is a noise field that bends
  tips more than bases, plus gusts from cursor movement. Bees visit open
  blooms. The perfume card has a bottle whose liquid mixes the bloom
  colours and fills as the garden flowers, a generated name, a top /
  heart / base pyramid with share bars, and a one-line description. A
  ghost seed follows the cursor, planting makes a soil burst, and the
  soil ends just above the seed tray so every spot is plantable.
- Pass 2: Scale and liveliness. Plants are much larger and sized to the
  viewport, with a fuller three-row starter garden. The back rows open
  already in flower and the front row is caught mid-growth. Added grass
  and clover tufts that sway, drawn back to front together with the
  plants, and drifting pollen in the light. Scent was redone: the long
  straight streaks became slow, curling motes that lean toward the
  bottle, and the bottle pulses in that colour when one arrives. The rose
  was redrawn as cupped, layered petals with rolled lips (it read as a
  ring of beads). The perfume weights notes per plant, so a marigold with
  six heads no longer outweighs an iris with one. Clusters and plumes
  count once. The wording follows the mix ("bursts open with", "a hint
  of", "a long, dry trail of") and nudges toward balance ("Plant vetiver
  so it lasts."). The liquid is weighted toward the leading notes and
  softened like a real juice, and the number moved into the kicker
  ("Your perfume · No. 31") so the name never wraps. Fixed: in reduced
  motion new plants weren't drawn, and after "Harvest & replant" the card
  said "Still a seed" while plants were growing. The keyboard marker
  shows only for keyboard focus (arrow keys also bring it up).
- Pass 3: Viewports and fallbacks. All five seeds fit in one row on
  phones (swatch over name). On phones and short landscape screens the
  perfume card starts folded and tapping the soil folds it again. Very
  wide screens get a second sowing in the gaps. The kicker never wraps on
  narrow cards. Breakpoints are aligned at 768px in CSS and JS, and the
  live region only changes when the words do. Stress-tested with 44
  plantings in a row: the oldest plants wilt away at the cap (34 desktop,
  16 phone) and the page stays responsive.

## Verification
- check-rules: OK (96 files, 26 projects)
- verify-sites: `--only 05 --cdn-mirror` → ok, console 0, page 0, failed
  requests 0. The site uses no CDN script (Canvas 2D only), and fonts
  come from Google Fonts.
- Visual check, desktop 1440x900: done (starter garden, planting three
  irises, keyboard planting with Tab → arrows → 4 → Enter, Harvest &
  replant, regrowth after six plantings, and 44 plantings to hit the
  cap). Headless Chromium runs it at 60 fps, or about 43 fps with a full
  garden.
- Visual check, mobile 390x844: done (same flows, plus the card
  expanding and folding).
- Edge viewports: 844x390, 768x1024, 1024x768, 1280x720, 2560x1080 and
  320x568 all checked, with no horizontal overflow.
- Reduced motion: done. The garden is fully grown and still, with no
  bees, motes, scent, soil bursts or bottle pulse. New plants appear
  fully grown, and the canvas redraws only on change.
- No WebGL: not applicable (Canvas 2D).
- Keyboard: Tab to the garden, arrows move a visible planting marker,
  Enter or Space plants, 1–5 pick seeds, the seed buttons and card toggle
  are reachable, focus rings are visible. Screen readers: the canvas has
  an instructive label, and the perfume description is a polite live
  region.
- Thumbnail regenerated: yes (starter garden, 1440x900).

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
