# Content Brief — Site 26 (Flagship Restaurant)

Pre-written so Fable 5's budget goes into craft and execution, not
inventing content mid-build. Treat everything below as a strong starting
point, not a rigid script — refine wording, add dishes, expand the story
if the concept calls for it. Do not deviate from the *facts* (name,
pricing tier, location conceit) without good reason, since projects.json
and the Hub card need to match what's actually built.

---

## Concept

**Name:** The Tideline
**Category:** Modern coastal kitchen — seasonal, ingredient-led, tide-to-
table sourcing conceit (local water and coastal farms, not a specific
real regional cuisine — keep it a point of view, not a claim of
authenticity to any real culture or place)
**Positioning:** Elevated-casual, not ultra-fine-dining. $$$ tier — the
kind of place a regular person saves a table for on a special night, not
an exclusivity play. This matters for relatability: the client looking at
this site should recognize the *tier* they'd actually hire you to build.
**Location conceit:** A fictional harbor town — "Harrow's Point" — not a
real city or street address, to avoid implying a real establishment
exists at a real address.
**Design direction:** Story-first, per the research brief — lead with
the tide-to-table narrative and a distinctive point of view before the
menu. Moody, muted, coastal palette (slate, driftwood, sea-glass, low
warm light) signals the price tier before a single word is read. Mobile
gets full design fidelity here, not a reduced fallback — 60%+ of real
restaurant site traffic is mobile.

## Chef / story

No chef headshot or posed photography (project-wide rule — hands,
plating, kitchen process, and ingredient shots only).

**Bio copy (adapt freely):**
> The Tideline is built around one idea: cook what the tide gives you.
> Our kitchen sources same-day from harbor docks and three coastal farms
> within twenty miles — the menu changes with what showed up that
> morning, not what a printed card says it should be. No dish is
> permanent. That's the point.

## Sample menu (use as real menu content, not placeholder)

**Starters**
- Charred Octopus, white bean purée, chili oil — $19
- Raw Bar Selection (oysters, market fish crudo, mignonette) — MP
- Grilled Sourdough, cultured butter, sea salt — $9
- Heirloom Tomato, stracciatella, basil oil — $16

**Mains**
- Whole Roasted Branzino, fennel, citrus, olive — $34
- Butter-Poached Lobster, corn, brown butter — $42
- Dry-Aged Duck Breast, charred plum, jus — $36
- Seasonal Risotto (rotates weekly, ask your server) — $26
- Tide Vegetable Plate (fully seasonal, vegan) — $24

**Sides** — $8 each: Charred Broccolini · Roasted Fingerlings ·
Market Greens

**Dessert**
- Brown Butter Tart, sea salt caramel — $12
- Citrus Olive Oil Cake — $11

**Drinks** — coastal-leaning wine list (12 by the glass), 6 house
cocktails, non-alcoholic pairing flight available

*(Allergen/dietary tags belong inline next to each dish — call-out from
the research brief: surfacing this builds trust, don't bury it in a
separate page.)*

## Sample reviews (fictional — invented outlets and quotes, not real
critics or publications)

> "The kind of place you start planning your return visit before you've
> finished the first course." — *Harrow's Point Weekly*

> "Confident, unfussy cooking that trusts the ingredient over the
> technique." — *Coastal Table Quarterly*

> "Reservations book out weeks ahead for a reason." — *The Local Fork*

## Hours / practical info

Tue–Sun, 5:00 PM – 10:00 PM (closed Mondays). Bar opens 4:30 PM.
Private dining room seats up to 14 — chef's-table and full-buyout
catering available on request.

## Events / private dining blurb

> Our private dining room sits just off the main kitchen — same menu,
> same sourcing, a table that's actually yours for the night. Chef's
> tasting available for parties of 6+. Full restaurant buyouts available
> for larger events; reach out for availability.

---

## Reservation-flow interaction spec

This is the centerpiece interactive moment — it needs to *feel* like a
real product, even with no real backend.

1. **Entry point:** prominent "Reserve a Table" CTA, present in the
   header on every page (not just hidden on a contact page) and again
   above the fold on the homepage — per the research finding that
   reservation CTAs are now a homepage-level design decision, not an
   afterthought.
2. **Step 1 — party size:** simple stepper or button group (1–8+, with
   8+ routing to the private dining blurb instead of a normal booking)
3. **Step 2 — date:** a real calendar-style picker, not a plain text
   input
4. **Step 3 — time:** a grid of available time slots for the chosen
   date (fake but *varied* availability data — some slots taken, some
   open — not uniformly all-open, which reads as fake)
5. **Step 4 — contact details:** name, email, phone, optional note
   (allergies/occasion)
6. **Confirmation state:** a genuine success screen/summary (not just
   an alert()) — "Table for 4, Sat July 18, 7:30 PM" style recap.
   Mark clearly in code comments that this is a front-end-only
   simulation with `TODO:` for real backend/reservation-platform
   integration (Resy/OpenTable/Tock-style, per the research brief —
   don't claim a real integration, just build the UX pattern).
7. Whole flow should work on mobile as a first-class experience, not a
   cramped desktop-flow squeeze.

## Photography direction

Self-host from Unsplash/Pexels/Pixabay (per CLAUDE.md). No real,
identifiable people — food close-ups, plating process, hands, coastal/
interior/architectural shots, ambient light, texture. Avoid anything
that reads as generic stock-photo food (the overlit, plastic-looking
kind) — favor moodier, editorial-leaning shots consistent with the
muted coastal palette.
