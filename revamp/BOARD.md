# Revamp board

**Next up / ถัดไป: Codex** ← the only line the user needs to read

Kickoff message (the same for both agents, every time):

> Read revamp/PROTOCOL.md, then revamp/BOARD.md, and do every task
> assigned to you there, following the protocol exactly. Work on and push
> to the `revamp` branch. Reply to me in Thai.

Rules: `revamp/PROTOCOL.md`. Per-site detail: `revamp/notes/`.
Baseline to compare against: branch `v1-original` (the live site before the revamp; use `git diff origin/v1-original -- sites/NN-slug`).

## Queue

Take open tasks from the top, in order. Status: `todo` · `in progress` · `done` · `skipped`.

| # | Task | Owner | Status |
|---|---|---|---|
| T1 | Build batch 1 (01–05) | Claude | done |
| T2 | Review batch 1 | Codex | done |
| T3 | Build batch 2 (06–10) | Codex | done |
| T4 | Fix batch 1 | Claude | skipped |
| T5 | Review batch 2 | Claude | done |
| T6 | Build batch 3 (11–15) | Claude | done |
| T7 | Confirm batch 1 | Codex | skipped |
| T8 | Fix batch 2 | Codex | done |
| T9 | Review batch 3 | Codex | done |
| T10 | Build batch 4 (16–20) | Codex | done |
| T11 | Confirm batch 2 | Claude | done |
| T12 | Fix batch 3 | Claude | done |
| T13 | Review batch 4 | Claude | done |
| T14 | Build batch 5 (21–25) | Claude | done |
| T15 | Confirm batch 3 | Codex | done |
| T16 | Fix batch 4 | Codex | done |
| T17 | Review batch 5 | Codex | done |
| T18 | Audit site 26 (all 7 pages, no code changes) | Codex | done |
| T19 | Confirm batch 4 | Claude | done |
| T20 | Fix batch 5 | Claude | done |
| T21 | Build site 26 (5 passes, starting from the audit) | Claude | done |
| T22 | Hub and guide | Claude | done |
| T22a | Fix 18 (R3 from T19: mobile intro line) | Codex | todo |
| T23 | Confirm batch 5 | Codex | todo |
| T24 | Review site 26 + Hub + guide | Codex | todo |
| T24a | Confirm 18 | Claude | todo |
| T25 | Fix site 26 + Hub + guide | Claude | todo |
| T26 | Final (full check, PR revamp → master) | Claude | todo |

## Sites

Stage: `not started` → `building` → `awaiting review` → `changes requested` → `fixing` → `awaiting confirm` → `done`

| Site | Batch | Builder | Reviewer | Stage | Note |
|---|---|---|---|---|---|
| 01-aurora-audio | 1 | Claude | Codex | done | [note](notes/01-aurora-audio.md) |
| 02-terra-atelier | 1 | Claude | Codex | done | [note](notes/02-terra-atelier.md) |
| 03-nova-orbit | 1 | Claude | Codex | done | [note](notes/03-nova-orbit.md) |
| 04-cipher-security | 1 | Claude | Codex | done | [note](notes/04-cipher-security.md) |
| 05-flora-lab | 1 | Claude | Codex | done | [note](notes/05-flora-lab.md) |
| 06-meridian-watches | 2 | Codex | Claude | done | [note](notes/06-meridian-watches.md) |
| 07-pulse-athletics | 2 | Codex | Claude | done | [note](notes/07-pulse-athletics.md) |
| 08-glacier-water | 2 | Codex | Claude | done | [note](notes/08-glacier-water.md) |
| 09-noctua-observatory | 2 | Codex | Claude | done | [note](notes/09-noctua-observatory.md) |
| 10-ember-bakery | 2 | Codex | Claude | done | [note](notes/10-ember-bakery.md) |
| 11-vertex-architecture | 3 | Claude | Codex | done | [note](notes/11-vertex-architecture.md) |
| 12-ligature-foundry | 3 | Claude | Codex | done | [note](notes/12-ligature-foundry.md) |
| 13-bathyal-institute | 3 | Claude | Codex | done | [note](notes/13-bathyal-institute.md) |
| 14-suminaga-teahouse | 3 | Claude | Codex | done | [note](notes/14-suminaga-teahouse.md) |
| 15-vector-drift | 3 | Claude | Codex | done | [note](notes/15-vector-drift.md) |
| 16-orrery-capital | 4 | Codex | Claude | done | [note](notes/16-orrery-capital.md) |
| 17-maison-vela | 4 | Codex | Claude | done | [note](notes/17-maison-vela.md) |
| 18-koppar-roastery | 4 | Codex | Claude | changes requested | [note](notes/18-koppar-roastery.md) |
| 19-voltaic-moto | 4 | Codex | Claude | done | [note](notes/19-voltaic-moto.md) |
| 20-halftone-records | 4 | Codex | Claude | done | [note](notes/20-halftone-records.md) |
| 21-petrichor-atmos | 5 | Claude | Codex | done | [note](notes/21-petrichor-atmos.md) |
| 22-grammage-paper | 5 | Claude | Codex | awaiting confirm | [note](notes/22-grammage-paper.md) |
| 23-umbra-cacao | 5 | Claude | Codex | done | [note](notes/23-umbra-cacao.md) |
| 24-pendula-works | 5 | Claude | Codex | awaiting confirm | [note](notes/24-pendula-works.md) |
| 25-somne-railways | 5 | Claude | Codex | done | [note](notes/25-somne-railways.md) |
| 26-the-tideline | 26 | Claude | Codex | awaiting review | [note](notes/26-the-tideline.md) |

## Questions for the user

_None yet._

## Session log

One line per session: date · agent · tasks · last commit · handoff note.

- 2026-09-29 · Claude · Set up the board, protocol, notes, and `check-rules.js` · (setup) · Ready for T1.
- 2026-10-21 · Claude · T1 done: 01–05 rebuilt, all `awaiting review` · d145ef7 · This environment blocks cdn.jsdelivr.net and cdnjs, so checks used `--cdn-mirror` (PROTOCOL §7). Pushed to `claude/zealous-allen-7c1i7s` with PR #2 into `revamp`. Codex: T2, review batch 1.

- 2026-10-21 · Codex · T2 done: 01–05 reviewed with no findings; T3 done: 06–10 rebuilt and awaiting review · c539b15 · T4 skipped (no R items). Claude: T5 review batch 2. Local checks used the CDN/font mirror.
- 2026-10-22 · Claude · T5 done: 06–10 reviewed, all `changes requested` (R items in each note, for T8). T6 done: 11–15 rebuilt, all `awaiting review` · 496ad6a · Checks used `--cdn-mirror`, which now serves the real Google Fonts stylesheet first (the Fontsource fallback lacks variable axes, e.g. site 12's opsz/SOFT/WONK). `screenshot.js` takes `--wait ms` for sites that need time to compose (12, 13, 14, 15 used 4000–6500). Codex: T7 confirm batch 1, then T8 fix batch 2 and T9 review batch 3.
- 2026-10-22 · Codex · T7 skipped (01–05 already done; no fixes to confirm). T8 done: 06–10 fixed in cc4aa7b and awaiting confirm. T9 done: 13 done; 11, 12, 14, 15 have must-fix R1 findings. T10 done: 16–20 rebuilt in three passes and awaiting review · 629bf0a (source) · Checks used the CDN/font mirror; Fraunces fallback now preserves all four axes. All scoped verify runs reported zero console/page/request failures; 16–20 checked at desktop/mobile with motion on/off plus short viewports and full-quality desktop. Thumbnails regenerated. Claude Code: T11 confirm batch 2, T12 fix batch 3, T13 review batch 4, then T14 build batch 5.
- 2026-10-27 · Claude · T11 done: 06–10 confirmed, all `done` (176cce8). T12 done: R1 fixed in 11 (d1d9a0a), 12 (b804ccc), 14 (1539b97) and 15 (c25c774), now `awaiting confirm`. T13 done: 16–20 reviewed, all `changes requested`, with R items in each note (d4c06b0). T14 done: 21–25 rebuilt in three passes, all `awaiting review` · 8921178 · Checks used `--cdn-mirror`. Headless Chromium here is SwiftShader at 2–6 fps, so simulated time runs slow in captures. Site 25 takes `?warp=2–8` to speed up its train clock for checking motion (off unless asked), and the thumbnail used `--wait 7000`. Codex: T15 confirm batch 3, T16 fix batch 4, T17 review batch 5, T18 audit site 26.

- 2026-10-27 · Codex · T15 done: confirmed 11, 12, 14, 15; batch 3 is done. T16 done: 16–20 readability fixed in 61fd555, 16 slider/regime state and 18 roast development corrected; all awaiting confirm (17 optional cloth self-collision declined with reason). T17 done: 21, 23, 25 done; 22 mobile picker covers copy and 24 mobile Look hides the sheet, both must-fix R1 items for T20. T18 done: all seven Tideline pages audited, prioritized list and five-pass proposal in its note, no code changes · 63b47c3 (audit; 391b1c1 review) · check-rules OK; scoped verification 11/12/14/15, 16–20, 21–25 and 26 all zero console/page/request failures using the protocol CDN/font mirror. Desktop/mobile and motion on/off checks complete; 16–20 thumbnails regenerated. Claude Code: T19 confirm batch 4, T20 fix 22/24, T21 rebuild site 26 in five passes from the audit, T22 Hub and guide.
- 2026-10-28 · Claude · T19 done: 16, 17, 19, 20 confirmed and `done`; 18 re-opened with must-fix R3 (mobile intro line 11px and reads "almostand"), Fix task T22a added for Codex and Confirm T24a for Claude (6865b5c). T20 done: 22 R1 (cards stick above the picker, 07c9bdc) and 24 R1 (Look docks the bench on phones, 0f4088b), both `awaiting confirm`. T21 done: The Tideline rebuilt in five passes from the T18 audit (shared system, shoreline shader + tide gauge, menu sheet / story day + map / private-dining floor plan, reservations focus + phone bar / gallery chapters / contact intents, all-page sweep); branded bar photos replaced by unbranded crops; `awaiting review` (d5667dd). T22 done: all thumbnails regenerated (09 and 14 kept their reviewed captures: both are generative and a retake only catches a random moment; their code is unchanged), Hub flagship and cards checked against `projects.json`, /guide gains a revamp section naming Claude Code (Claude Opus 5.5) and Codex (Astra / GPT 6) · see last commit · Checks used `--cdn-mirror` (this container can't reach jsdelivr, cdnjs, unpkg or any stock-photo host). Site 26 sweep: 7 pages × 4 viewports × motion on/off, zero errors. New dev tool: `node scripts/tideline-partials.js` owns site 26's shared head/header/drawer/footer. Codex: T22a fix 18, T23 confirm batch 5, T24 review site 26 + Hub + guide.
