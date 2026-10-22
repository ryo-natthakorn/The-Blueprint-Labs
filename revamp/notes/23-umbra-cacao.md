# 23-umbra-cacao — UMBRA

- **Vertical:** Chocolate Maker
- **Batch:** 5 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** building
- **Next step:** Pass 1 rebuild (plan below).

## Original audit
_Written before changing any code. Compare against branch `origin/v1-original`._

**Keep:** UMBRA and its quiet voice. Molten chocolate filling the screen, stirring as the whole interaction, the temper meter idea (Form V crystals), the tasting-note payoff, Prata + Outfit, cacao and gold.

**Weak points (with evidence):** Audited 2026-10-22 at 1440x900 and 390x844, motion on and reduced. Stirred in steady circles for 40 s with Playwright (CDN/font mirror). Read all three files.
- The "melt" is domain-warped FBM with six decaying swirl centres. Stirring barely changes it: the mid-stir and end-of-stir frames look like the idle frame. Nothing flows, piles up or keeps a wake.
- It is a flat brown texture edge to edge, with no vat, rim, surface or depth. The specular is a small soft blob, so it never reads as glossy liquid.
- The temper "physics" is just a speed window. Real tempering is a temperature curve (melt, cool and seed, rewarm), and there's no thermometer. In this environment 40 s of steady circles reached 13%. Software rendering slows the clock, but even at 60 fps it's ~18 s of stirring with only a hairline rail as feedback.
- At 98% the note says "pour the bar", but nothing pours: there's no payoff.
- Pointer only: no keyboard path to stir or finish. Labels are 9–10px (`CRYSTAL V`, stage line, footer).

## Revamp plan
- Make it a real liquid: a GPU stable-fluids simulation (advect, splat, divergence, Jacobi pressure, projection) inside a round copper vat on a dark marble slab. Stirring pushes the melt and leaves wakes. A dye field carries two scales of surface pattern that stretch into ribbons and relax back. The melt gets thicker as crystals form. Softbox reflections sharpen with temper. Procedural fallback when float render targets aren't available.
- A true tempering curve: a thermometer from 48°C, stirring cools it, a hold-to-warm plate, crystal model for Form V vs unstable forms (seed at 27–28, melt out unstable above 29.5, lose Form V above 32.2), and a live temperature-vs-time chart with the three bands. The steps (cool & seed → rewarm → pour) are spelled out.
- Payoff: Pour the bar. The vat gives way to a mould that fills, then sets. Its gloss, snap and bloom follow the temper you actually reached, then the tasting notes and a new batch.
- Keyboard: Stir for me (toggle) and Warm the vat (hold by key or pointer). Readable type. Reduced motion: no ambient conching, and the melt only moves while you stir.

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
