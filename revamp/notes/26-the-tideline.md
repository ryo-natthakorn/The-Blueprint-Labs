# 26-the-tideline — The Tideline

- **Vertical:** Restaurant — Modern Coastal Kitchen
- **Batch:** 26 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** building
- **Next step:** Claude continues T21 from the Pass log below.

## Original audit

Codex · 2026-10-27 · T18. Read the content brief, every page, shared CSS/JS,
shoreline shader, menu filters, reservation flow, gallery and contact scripts.
Explored `/`, `/menu/`, `/reservations/`, `/story/`, `/private-dining/`,
`/gallery/` and `/contact/` at 1440×900 and 390×844, normal and reduced motion.
Also walked every viewport of each page for full-page captures at both widths.

**Keep:**
- The fictional kitchen, Harrow's Point, $$$ positioning, tide-to-table voice,
  slate / bone / sea-glass / amber palette and Fraunces / Karla pairing.
- The first-screen home reservation/menu choices, persistent desktop nav,
  shared footer, useful hours and coherent seven-page routing.
- The full inline menu, visible dietary tags, course navigation and working
  filters. Preserve the menu facts/prices and the 14 / 6+ / 40 event capacities.
- The sourcing-day timeline and illustrated supplier map: they tell a specific
  story without a chef headshot or a real location/map-service dependency.
- The reservation product: 1–7 parties and 8+ private-room route, calendar,
  closed Mondays, 60-day release window, varied seeded slots, downstream reset,
  invalid-field handling, real confirmation summary, restart and .ics download.
  Keep it a front-end demonstration and retain the integration TODO seams.
- The 18-image keyboard/swipe lightbox, correct caption/alt updates, Escape,
  focus return, and working contact validation/private-dining subject route.
- Existing motion fallbacks, offscreen hero pause, limited mobile shader
  resolution/octaves, self-hosted images and semantic navigation.

**Weak points and prioritized improvement list:**

### P1 — fix while establishing the shared system

1. **Restore the subpage gutters.** All six subpage intros use
   `class="wrap page-head"`. In `style.css`, `.page-head`'s later
   `padding: calc(...) 0 0` overwrites `.wrap`'s side padding. At 390px the
   breadcrumb, headline and lede start at x=0, while the sections below start
   at x=20. At 1440px the intro is likewise 48px left of the content below.
   Preserve the shared horizontal inset when setting the top spacing, and
   check long headings on every subpage. A zero overflow measurement does
   not catch this visual defect.

2. **Keep a reservation action in the mobile header.** At widths ≤920px,
   `.nav-cta` is hidden alongside the desktop links. On Menu, Story, Gallery,
   Private Dining and Contact a visitor must open the drawer or find a later
   CTA to book. The brief explicitly calls for a header reservation CTA on
   every page. Fit a compact, readable Reserve action beside the brand/menu
   control, with sufficient touch/focus space; keep the home hero actions.

3. **Finish the keyboard paths in the drawer and booking flow.** On a
   390px home page, open the drawer and Tab from its first link. After its
   Reserve link, focus goes to the covered home Reserve button, Tonight's
   Menu and the page below; body scroll locking is not a focus trap. Keep
   background content inert while open, contain focus, and restore it on
   Escape/close (Escape already returns to the burger). On both widths and
   motion preferences, choosing a calendar day or an available slot leaves
   `document.activeElement` as `BODY`: `renderCal()` / `renderSlots()` and
   `goto()` replace the focused button. Preserve the selected control's
   focus or move it deliberately to the next action/step heading. Associate
   validation text with its inputs, and focus the contact success heading
   after hiding its form. The gallery's existing focus-return behaviour is
   a useful pattern to keep.

4. **Raise the small interface type.** Measured sizes at both widths:
   brand town 8.96px, reservation progress labels 9.92px, party-unit labels
   9.6px, photo captions 10.24px and several tide/footer labels 10.88px.
   Keep the quiet hierarchy, but give explanatory copy a readable size and
   contrast, labels a floor around 12px, and primary booking controls around
   14–16px. Reflow the mobile menu filter/step controls as needed instead of
   shrinking them. Don't brighten deliberately disabled calendar days as
   though they were available.

5. **Replace custom UI pictograms and cover the remaining reduced-motion
   paths.** Calendar arrows, lightbox arrows/close, the menu toggle and
   confirmation check use hand-made SVG/CSS UI icons; the hard constraint
   requires Font Awesome free icons or text controls. The fictional wave
   logo, supplier-map drawing and shoreline artwork can stay artwork.
   Reduced-motion CSS handles reveals, tide pulse and page wash, but leaves
   drawer link transforms/fades in place; `reserve.js` and `contact.js`
   explicitly request smooth scrolling even with the preference enabled.
   Use a consistent motion preference for those paths and show a complete
   static shoreline. Recheck focus visibility through page changes.

6. **Remove third-party branding from the interior photography.**
   `assets/bar-warm-wide.jpg` visibly contains another venue's neon wordmark
   at the right and branded bottle labels; the related tall bar crop should
   be checked too. These are self-hosted photographs, but the brand rule
   still applies. Choose unbranded framing/replacement imagery and inspect
   the full-resolution result, including the lightbox. No identifiable
   faces were found in the current photo set; preserve the allowed process
   crops of hands while keeping faces out.

### P2 — give the flagship its own visual and product depth

7. **Make the shoreline a convincing signature moment.** The current hero
   is one soft FBM band with a bright blurry edge, little foam structure and
   no clear water/sand material distinction. Keep the calm, story-first
   first screen and readable CTA, but add legible arriving/retreating sets,
   carried foam/residue, wet-sand sheen and light/refraction detail. Let the
   tide instrument have a visible relationship to the water. Keep mobile
   quality tiers and the static fallback; do not make visitors wait through
   a reveal before they can reserve.

8. **Use a coherent editorial system across the content pages.** Most
   subpages open with the same text-only header and then long stretches of
   equally weighted dark blocks. Give Menu, Story and Private Dining
   distinct compositions within the shared system: a readable menu sheet,
   a dock-to-table day, and a room/occasion presentation. In particular,
   Private Dining's first photograph is a food platter captioned as the
   long table; it never establishes the room a guest is enquiring about.
   Show the space/materials with unbranded, face-free imagery and put the
   capacities beside the enquiry choice. Keep the subject-preselected
   contact route.

9. **Make menu discovery easier.** The V / VG / GF / SH / R legend sits
   near the end of a long menu. Bring the explanation close to the filters
   or expose readable tag names where guests need them. Vegan correctly
   highlights three dishes, but the dim-the-rest treatment leaves a long
   scan; give clear matching-state feedback while preserving the menu and
   inline prices. Keep active course/selected diet understandable on phones
   after increasing label sizes.

10. **Edit Gallery and Contact as the end of the same visit.** The gallery
    mixes bright studio food, warm bar, raw ingredients and sunset stock
    with little narrative order; on phones it is roughly 9,445px long.
    Sequence it around landing → preparation → room → table, improve crop
    and colour consistency, and keep the already-working 18-image viewer
    controls/focus/swipe. Contact has useful hours/parking and working
    validation; make the enquiry intent and private-dining preselection
    clear, keep the fictional practical details consistent, and make its
    success state as considered as the reservation summary. Keep backend
    integration TODOs and the existing demo context accurate.

## Revamp plan

Suggested allocation for Claude's five passes (not build work performed here):
- Pass 1: shared responsive grid, gutters, type, navigation, mobile Reserve,
  focus/motion system and compliant UI icons.
- Pass 2: home shoreline, material/light detail and first-screen composition;
  unbranded image selection/crops and finished static/no-WebGL fallback.
- Pass 3: Menu, sourcing Story and Private Dining editorial treatment,
  preserving facts, prices, dietary tags and enquiry routing.
- Pass 4: reservation/calendar/slot keyboard continuity, validation and
  confirmation; Gallery sequencing/viewer and Contact success flow.
- Pass 5: hunt for missed design/interaction issues across all seven pages,
  at desktop/mobile/short widths, normal/reduced motion; run verification
  and regenerate thumbnails as required by the protocol.


### Builder plan — Claude · 2026-10-27 · T21

Reviewed the audit, every page and script, and captured all seven pages at
1440×900 and 390×844 before changing code. I agree with all ten points. Two
environment facts shape the plan: this container cannot reach any stock-photo
host (Unsplash, Pexels, Pixabay, Wikimedia all refused), so new photography is
not possible here; and the two bar photos carry a neon wordmark ("BASTA HERO",
a script "B") and a "Pizza" neon plus readable bottle labels.

- **Imagery:** replace the two bar photos with unbranded crops (the lit
  counter and stools; the bulb canopy) and delete the originals so the
  branded files no longer ship. Show the private room as a drawn floor plan
  rather than a misleading platter photo. Add 800px variants and `srcset`
  so phones stop downloading 1600px files.
- **Shared system:** per-page CSS on top of one shared `style.css`; gutters
  that can't be overwritten by a page header; a 12px label floor and 15–17px
  controls; a compact Reserve button in the mobile header; drawer with focus
  trap, `inert` background and focus return; Font Awesome free icons for every
  UI control (calendar, viewer, burger, confirmation); one motion preference
  read everywhere (no forced smooth scrolling).
- **Home:** a new shoreline shader: depth-graded water, wave sets that run up
  the beach and draw back, foam lace carried by the backwash, a wet-sand
  sheen that dries behind it, caustics in the shallows, low-sun glints. The
  tide gauge drives the water line: scrub through tonight's service and the
  water moves to that hour's height. Static, composed frame for reduced
  motion and no-WebGL.
- **Menu:** a printed daily sheet: legend beside the filters, readable tag
  names, matching dishes highlighted with a live count, prices inline.
- **Story:** the dock-to-table day as a scroll sequence with a sticky clock
  and tide, then an interactive sourcing map (pick a supplier, see its route).
- **Private dining:** a floor-plan drawing of the room with a format chooser
  (chef's tasting 6+, private room up to 14, full buyout 40) beside the
  enquiry, routed to Contact with subject and format preselected.
- **Reservations:** keep the engine; keep focus on the chosen day or slot,
  move focus to each new step's heading, link errors with
  `aria-describedby`, a sticky summary bar with Continue on phones, a
  ticket-style confirmation.
- **Gallery:** four chapters (landing, preparation, room, table), a 2-column
  phone grid, consistent grading, the viewer kept with icon controls.
- **Contact:** intent cards instead of a select, private-dining fields when
  that intent is chosen, a success recap with reference and next steps.

## Pass log

No build passes performed by Codex in T18. Claude owns the five T21 passes.

### Pass 1 — shared system (Claude, T21)
- New `style.css` (shared only) plus one stylesheet per page in `css/`. Gutters
  sit on an inner `.wrap` inside `.page-head`, so a page header can no longer
  overwrite them (audit P1.1). Labels have a 12px+ floor (12.5–13px), body 17px,
  buttons 14px; muted text raised to 62–78% bone for contrast (P1.4).
- Header: compact **Reserve** button stays beside the menu button at every
  width (P1.2). Drawer: focus goes to its first link, Tab cycles through header
  and drawer only, `inert` on skip link/main/footer, Escape and the button
  close it and return focus (P1.3, checked by keyboard at 390px).
- Font Awesome 6.5.1 free for every UI icon (burger/close, arrows,
  breadcrumbs, contact icons); the wave logo stays artwork (P1.5). One motion
  switch in `main.js` (`Tideline.scrollToEl`) and one reduced-motion block in
  CSS covering reveals, wash, drawer and pulses.
- `scripts/tideline-partials.js` now owns the head, header, drawer and footer
  of all seven pages (run it after editing a partial). Footer gains live
  open/closed status and today's hours row; tide model gains spring/neap range
  and heights in metres.
- Photography (P1.6): `bar-warm-wide.jpg` and `bar-warm-tall.jpg` deleted;
  replaced by unbranded crops `bar-counter.jpg` (lit counter and stools) and
  `bar-canopy.jpg` (bulb canopy), checked at full resolution. Every photo got
  the same mild grade (mid-tone curve, slate shadows, warm highlights) and an
  800px variant for `srcset`.

### Pass 2 — home shoreline and first screen (Claude, T21)
- New shoreline shader (`tide-hero.js`): an overhead swash zone at dusk on a
  diagonal beach, so the copy sits on calm sand and the waves work through the
  middle and right. Three wave sets run up and drain back; the bore, a foam
  sheet whose holes open as it ages and drains with the water, swash marks at
  the top of each run, wet sand that dries behind it, curved caustics in the
  shallows, offshore breakers and low-sun glitter are all derived from each
  wave's phase (nothing stored). Checked as a sped-up frame sequence.
- The tide gauge drives the water (P2.7): the live height sets the waterline;
  the slider scrubs tonight's service (5–10 PM) and the water moves to that
  hour's level (eased; instant under reduced motion). The panel shows the
  evening's curve, the high and low water around service, and an
  `aria-valuetext` reading. Monday or after 10 PM it shows the next service
  evening.
- Fallbacks: one composed frame under reduced motion (re-rendered when the
  gauge moves), a diagonal CSS shoreline without WebGL, lower resolution and
  cheaper shader on phones and ≤4-core devices, adaptive resolution if the
  first frames are slow, paused offscreen.
- Home below the fold: a three-photo "day on the tideline" strip (landing,
  prep, first plates), dietary tags on tonight's dishes, practical cards with
  live hours, and a calmer CTA band.

### Pass 3 — menu, story, private dining (Claude, T21)
- **Menu** (P2.8, P2.9): the menu is now a printed daily sheet (paper, dated
  masthead, inline prices) under a "this morning's landing" card. Dietary
  legend sits beside the filters; tags are written out (Vegetarian, Vegan,
  Gluten-free, Shellfish, Served raw). Choosing a diet marks matching dishes,
  fills their matching tag, folds the rest down to name and price, says how
  many match ("3 of 14 dishes tonight are vegan") and explains empty courses.
  Phones: the toolbar scrolls away, so a floating "Showing vegan · Change" pill
  returns to it and focuses the active chip. Scrollspy keeps the active course
  visible in the phone's scrolling course nav.
- **Story** (P2.8): opening with the brief's bio beside the landing photo; the
  dock-to-table day is a scroll sequence with a sticky 24-hour dial (noon at
  the top, daylight arc) that follows the stop in view and reads today's tide
  at that hour; a chalk-wall card for 7 AM; a compact sticky bar on phones.
  The sourcing map was redrawn: Ledgerow Orchard was in the sea and Bright
  Hollow's 19 miles didn't match the scale bar, so the farms now sit on land
  at plausible distances. Pins and list entries are buttons that trace their
  route; labels are HTML so they stay readable on phones (only the chosen one
  is labelled there).
- **Private dining** (P2.8): the room is shown as a drawn floor plan that
  redraws for the chosen format (private room 6–14, chef's tasting 6–14 with the
  chef at the pass, full buyout 16–40 showing the whole restaurant and the
  seats the party fills) and the guest count. Capacities sit on the format
  cards and in a facts row; the planner is a plain GET form, so "Enquire" opens
  Contact with subject, format and guests already set, with or without
  JavaScript. The platter photo is now captioned as what it is; the bar
  canopy crop shows the room's light.

### Pass 4 — reservations, gallery, contact (Claude, T21)
- **Reservations** (P1.3, P1.4): the engine (seeded availability, closed
  Mondays, 60-day window, same-day 90-minute cutoff, downstream reset, .ics)
  is kept. Focus now moves deliberately: party → "Choose a date"; each new
  step focuses its heading; choosing a day or a time keeps focus on that
  button after the grid redraws; the calendar has a roving tabindex with
  arrow keys, Home/End and Page Up/Down; errors are linked with
  `aria-describedby` and the first invalid field takes focus; the
  confirmation heading takes focus. Calendar days show "few left" (≤3 times)
  and "full"/"closed" in words; times are grouped Early/Peak/Late, and times
  within 45 minutes of high water carry a boat icon. Phones get a sticky bar
  with the running summary and the step's Continue button. The confirmation
  is a ticket with name, party, date, time, the tide when you sit down,
  reference, .ics, directions and "book another". 8+ routes to the private
  room planner or a pre-filled enquiry. Controls are 15–17px; Font Awesome
  for every arrow and the check.
- **Gallery** (P2.10): four chapters (landing, preparation, room, table) with
  a chapter nav and an editorial mosaic; phones get a two-column grid
  (5,700px instead of ~9,400px). Captions now match the pictures (no more
  "branzino" on a salmon plate or "duck" on a steak). The viewer keeps
  arrows/swipe/Escape, adds Font Awesome controls, shows the chapter, loads
  the full picture over the thumbnail, makes the rest of the page inert,
  cycles Tab inside and returns focus to the picture last viewed.
- **Contact** (P2.10): intent cards instead of a select; choosing private
  dining reveals format, guests and preferred date, all pre-filled from the
  planner (with a note saying so). A drawn quay sketch with parking and the
  dock sits under "Getting here", which the footer links to. The success
  state is a recap (about, from, format, date, reference) with what happens
  next for that kind of enquiry, and takes focus. Backend TODO comments kept.

## Verification

- check-rules: **OK** (99 files, 26 projects).
- verify-sites: `--only 26 --cdn-mirror` → home OK, console 0, page 0,
  failed requests 0. This script alone does not cover the nested pages.
- All-page browser audit: **28 configurations**, all seven pages at
  1440×900 / 390×844 and normal/reduced motion; **zero console/page/request
  failures**. No sideways document overflow. Full-page walks at both widths
  loaded every content image without a broken image.
- Visual check, desktop 1440×900: **DONE**, all seven pages and relevant
  interaction states; current weaknesses are recorded above.
- Visual check, mobile 390×844: **DONE**, all seven pages, drawer, menu
  filters, booking steps/confirmation, gallery viewer and contact success.
- Reduced motion: **DONE**, all pages render; remaining drawer/explicit
  smooth-scroll paths are audit findings, not a claim of full compliance.
- Reservations at both widths/modes: 8+ route visible; party 4 → date →
  available slot → details; empty submit marks all three required fields;
  valid local fixture gives a matching summary and a downloadable calendar
  event; restart returns to party selection. Calendar/slot focus loss was
  reproduced in all four configurations.
- Gallery: Next/ArrowRight shows 2 / 18, Escape returns focus to the opened
  `.m-item`. Contact: three invalid fields on empty submit, then local
  success with valid fixture data. Vegan filter: three matching dishes in
  all four configurations.
- Browser: system Chromium / SwiftShader, Asia/Bangkok timezone, protocol
  CDN/font mirror. No site code or assets modified during the audit.
- Thumbnail regenerated: **No — audit only.** Existing thumbnail inspected;
  Claude regenerates it after the T21 rebuild/T22 Hub work.

## Review

T18 audit above is the input for T21. Formal review of the rebuilt site,
Hub and guide belongs to Codex in T24.

## Fix log

_No code changes in T18._
