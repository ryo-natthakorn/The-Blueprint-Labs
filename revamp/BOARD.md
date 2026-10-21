# Revamp board

**Next up / ถัดไป: Claude** ← the only line the user needs to read

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
| T1 | Build batch 1 (01–05) | Claude | todo |
| T2 | Review batch 1 | Codex | todo |
| T3 | Build batch 2 (06–10) | Codex | todo |
| T4 | Fix batch 1 | Claude | todo |
| T5 | Review batch 2 | Claude | todo |
| T6 | Build batch 3 (11–15) | Claude | todo |
| T7 | Confirm batch 1 | Codex | todo |
| T8 | Fix batch 2 | Codex | todo |
| T9 | Review batch 3 | Codex | todo |
| T10 | Build batch 4 (16–20) | Codex | todo |
| T11 | Confirm batch 2 | Claude | todo |
| T12 | Fix batch 3 | Claude | todo |
| T13 | Review batch 4 | Claude | todo |
| T14 | Build batch 5 (21–25) | Claude | todo |
| T15 | Confirm batch 3 | Codex | todo |
| T16 | Fix batch 4 | Codex | todo |
| T17 | Review batch 5 | Codex | todo |
| T18 | Audit site 26 (all 7 pages, no code changes) | Codex | todo |
| T19 | Confirm batch 4 | Claude | todo |
| T20 | Fix batch 5 | Claude | todo |
| T21 | Build site 26 (5 passes, starting from the audit) | Claude | todo |
| T22 | Hub and guide | Claude | todo |
| T23 | Confirm batch 5 | Codex | todo |
| T24 | Review site 26 + Hub + guide | Codex | todo |
| T25 | Fix site 26 + Hub + guide | Claude | todo |
| T26 | Final (full check, PR revamp → master) | Claude | todo |

## Sites

Stage: `not started` → `building` → `awaiting review` → `changes requested` → `fixing` → `awaiting confirm` → `done`

| Site | Batch | Builder | Reviewer | Stage | Note |
|---|---|---|---|---|---|
| 01-aurora-audio | 1 | Claude | Codex | not started | [note](notes/01-aurora-audio.md) |
| 02-terra-atelier | 1 | Claude | Codex | not started | [note](notes/02-terra-atelier.md) |
| 03-nova-orbit | 1 | Claude | Codex | not started | [note](notes/03-nova-orbit.md) |
| 04-cipher-security | 1 | Claude | Codex | not started | [note](notes/04-cipher-security.md) |
| 05-flora-lab | 1 | Claude | Codex | not started | [note](notes/05-flora-lab.md) |
| 06-meridian-watches | 2 | Codex | Claude | not started | [note](notes/06-meridian-watches.md) |
| 07-pulse-athletics | 2 | Codex | Claude | not started | [note](notes/07-pulse-athletics.md) |
| 08-glacier-water | 2 | Codex | Claude | not started | [note](notes/08-glacier-water.md) |
| 09-noctua-observatory | 2 | Codex | Claude | not started | [note](notes/09-noctua-observatory.md) |
| 10-ember-bakery | 2 | Codex | Claude | not started | [note](notes/10-ember-bakery.md) |
| 11-vertex-architecture | 3 | Claude | Codex | not started | [note](notes/11-vertex-architecture.md) |
| 12-ligature-foundry | 3 | Claude | Codex | not started | [note](notes/12-ligature-foundry.md) |
| 13-bathyal-institute | 3 | Claude | Codex | not started | [note](notes/13-bathyal-institute.md) |
| 14-suminaga-teahouse | 3 | Claude | Codex | not started | [note](notes/14-suminaga-teahouse.md) |
| 15-vector-drift | 3 | Claude | Codex | not started | [note](notes/15-vector-drift.md) |
| 16-orrery-capital | 4 | Codex | Claude | not started | [note](notes/16-orrery-capital.md) |
| 17-maison-vela | 4 | Codex | Claude | not started | [note](notes/17-maison-vela.md) |
| 18-koppar-roastery | 4 | Codex | Claude | not started | [note](notes/18-koppar-roastery.md) |
| 19-voltaic-moto | 4 | Codex | Claude | not started | [note](notes/19-voltaic-moto.md) |
| 20-halftone-records | 4 | Codex | Claude | not started | [note](notes/20-halftone-records.md) |
| 21-petrichor-atmos | 5 | Claude | Codex | not started | [note](notes/21-petrichor-atmos.md) |
| 22-grammage-paper | 5 | Claude | Codex | not started | [note](notes/22-grammage-paper.md) |
| 23-umbra-cacao | 5 | Claude | Codex | not started | [note](notes/23-umbra-cacao.md) |
| 24-pendula-works | 5 | Claude | Codex | not started | [note](notes/24-pendula-works.md) |
| 25-somne-railways | 5 | Claude | Codex | not started | [note](notes/25-somne-railways.md) |
| 26-the-tideline | 26 | Claude | Codex | not started | [note](notes/26-the-tideline.md) |

## Questions for the user

_None yet._

## Session log

One line per session: date · agent · tasks · last commit · handoff note.

- 2026-09-29 · Claude · Set up the board, protocol, notes, and `check-rules.js` · (setup) · Ready for T1.
