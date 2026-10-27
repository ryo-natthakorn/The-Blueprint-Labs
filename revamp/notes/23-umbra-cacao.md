# 23-umbra-cacao — UMBRA

- **Vertical:** Chocolate Maker
- **Batch:** 5 · **Builder:** Claude · **Reviewer:** Codex
- **Stage:** done

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
- Pass 1: Rebuilt as a live GPU stable-fluids vat (WebGL2 or WebGL1 half-float targets, with a procedural fallback): advect, splat, divergence, 14–22 Jacobi iterations, projection, a slow conching spin and a viscosity that rises with crystals. A dye field carries a broad relief and a fine colour pattern that stretch into ribbons and relax back. Shading uses a near-overhead camera, so the softbox and strip reflections land on the melt and bend with every wave. The copper vat has a rounded brushed lip and sits on a dark marble slab. Crystal model: unstable forms below 29 / melting above 29.5, Form V seeded below 28.5, growing to 32.2 and melting above. Once seeded and warmed, a thermostat holds 31.5°C. Thermometer, Form V / unstable bars, a live tempering curve with the three bands, and step-by-step cues in a quiet live region. Pour the bar shows a mould that fills and sets, with gloss, snap and bloom (grey streaks) from the temper actually reached, a verdict and tasting notes. Stir for me (toggle) and Hold to warm (pointer or Space/Enter) make it fully keyboard-playable. End-to-end runs: pouring straight away gives 'It will bloom' (fat bloom); the full curve gives 'A clean snap' at 31.2°C, Form V 97%.
- Pass 2: Checked 1024x640, 1920x1080, 360x640, 844x390 and reduced motion. The unstirred melt read as milky foam: blurry, over-wide reflections from a crinkly relief. The rest relief is now a smooth three-octave undulation, molten chocolate stays glossy (temper only sharpens it), and the reflections are crisp. A poured untempered bar now reads dull and grey (softer, weaker reflections, bloom streaks). The tempered bar is darker with smoother bevels. The bar mould relief was re-blurred and its normals widened, so there are no jagged bevel lines. Advice in the live region no longer carries a changing temperature (no chatter); the thermometer has its own readout.
- Pass 3: Final sweep of the opening, stirred, seeded, in-temper and both pour outcomes at both widths. Added a faint dashed gold ring at the stirring radius that turns the right way and fades after 1.5 s of stirring, so a first-time visitor knows what to do. Fixed an if/else ordering slip from adding it (page error caught by the verify run). Removing pointer-stir timing assumptions keeps slow devices stirring correctly.

## Verification
- check-rules: OK (97 files, 26 projects).
- verify-sites: `--only 23 --cdn-mirror` → ok, console 0, page 0, failed requests 0. The mirror served the Font Awesome CSS because this environment blocks cdnjs.
- Visual check, desktop 1440x900: done. Opening, hand-stirred, machine-stirred vortex, seeded at 26°C, in temper at 31.3°C, pour fill, and both bars (clean snap / fat bloom). Also 1024x640 and 1920x1080.
- Visual check, mobile 390x844: done. The vat, readouts and buttons in the first screen, the ritual below, and the pour. Also 360x640 and 844x390. No sideways scroll.
- Reduced motion: done. No conching spin; the melt only moves while you or the machine stir. The pour jumps straight to the set bar.
- Ritual end to end (Stir for me + Space on Hold to warm, Playwright): seeded at 26.2°C (Form V 30%), rewarmed to 31.2°C, in temper with Form V 97%, poured → "A clean snap", Mirror / Clean, loud / None. Pouring at once → "It will bloom", Fat bloom.
- Thumbnail regenerated: yes (`--wait 4000`), opening frame with the stirring ring, checked.

## Review
_Reviewer: add findings as `- [ ] R1 (must|nice) …`, then follow the checklist in PROTOCOL §5._

## Fix log

### Review in progress — 2026-10-27 · Codex (T17)

Reading the diff against `origin/v1-original` and checking desktop/mobile, normal/reduced motion. The sites are served unchanged; the protocol CDN/font mirror is used for local rendering. Final findings and verification follow below.

### Review result — 2026-10-27 · Codex (T17)

No findings. The contained fluid vat, explicit cool/seed/rewarm sequence and poured-bar outcome are a clear improvement over the original full-screen noise and pointer-speed meter.

Checklist: diff against `origin/v1-original` read; check-rules OK (99 files, 26 projects); scoped verify-sites `--cdn-mirror` has zero console/page errors and failed requests. Visual check DONE at 1440×900 and 390×844, normal/reduced motion: opening, automatic stirring, keyboard hold-to-warm/release, pour transition, finished reduced-motion bloom bar and new batch. No horizontal overflow, blank canvas or visible DOM text below 11px. Explicit labels/focus and low-quality simulation/renderer paths inspected. All imagery procedural; no people/faces. Existing regenerated thumbnail matches the copper vat and stirring cue.

Additional full-curve check: with WebGL disabled to avoid SwiftShader throttling, a local inspection hook advanced the unchanged `tick()` in 1/60s steps after real UI controls: seeded at 26.18°C / Form V 30.3%; rewarmed at 31.20°C / 80.4%, unstable crystals 0%; actual Pour button produced “A clean snap.” / Bloom “None”. This checked model/DOM behaviour; the normal rendering path was checked separately above. Normal pour animation advances slowly in this software renderer, as already documented by the builder. System Chromium and protocol CDN/font mirror used.
