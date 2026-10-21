# Revamp protocol (Phase 7)

This file is the operating manual for revamping all 26 sites. Two agents
take turns: **Claude** (Claude Code, Claude Opus 5.5) and **Codex** (Codex,
Astra / GPT 6). They never work at the same time. Everything one agent
knows that the other needs goes into the repo, never only into chat.
This file is identical for both agents.

The user speaks Thai and prefers plain language. Every session starts with
the same kickoff message, and the board tells you what to do:

> Read revamp/PROTOCOL.md, then revamp/BOARD.md, and do every task
> assigned to you there, following the protocol exactly. Work on and push
> to the `revamp` branch. Reply to me in Thai.

## 1. Goal and scope

Upgrade every site **in place**, using what current models can do:

- Keep each site's folder, URL, fictional brand, and core concept.
- Raise everything else: visual craft, interaction depth, motion quality,
  mobile experience, load behaviour, and small-detail polish.
- A site may change technique (e.g. Canvas 2D to WebGL) if that serves
  the same concept better.
- All hard constraints in `CLAUDE.md` / `AGENTS.md` still apply, without
  exception. `node scripts/check-rules.js` enforces the ones that can be
  checked mechanically.

## 2. Who you are

- If you are Claude Code, you are **Claude**.
- If you are Codex, you are **Codex**.

Write that name exactly in the board's Owner and Log columns.

## 3. Start of every session

1. `git fetch origin && git checkout revamp && git pull --ff-only origin revamp`
2. Read this file, then `revamp/BOARD.md`.
3. Check the last Session log entry on the board. If it says a PR is
   waiting to be merged into `revamp`, confirm its commits are on
   `revamp`. If they aren't, stop and tell the user to merge that PR
   first. Don't redo that work.
4. Your work list is every open task at the top of the Queue that is
   assigned to you, taken in order. Stop when you reach a task owned by
   the other agent or by the user. If the first open task isn't yours,
   tell the user who is next and stop.
5. If a task of yours is `in progress`, your previous session stopped
   early. Read that site's note, find its **Next step**, and resume from
   there.

## 4. Task types

Every site has a note at `revamp/notes/NN-slug.md`. Read it before
touching the site. Write to it as you go, not only at the end.

### Build (builder)
For each site in the batch:
1. **Audit before changing code.** Serve the repo (§7), open the site at
   desktop and mobile widths, and read its code. In the note, record what
   to keep and each weak point, with evidence.
2. **Plan.** Write a few bullets in the note on what the revamp will do.
3. **Revamp, in three full passes.** Pass 1 is the rebuild. Passes 2 and
   3 hunt for design problems, missed opportunities, animation polish,
   and responsiveness. Log each pass in the note.
4. **Verify** (§6) and fill in the note's Verification section.
5. Regenerate the thumbnail:
   `cd scripts && node screenshot.js --base-url http://localhost:4173 --id NN-slug --force`
6. Update the site's `projects.json` entry if description, tags, or tech
   changed. Never add `builtBy`.
7. Set the site's stage to `awaiting review`.

### Review (reviewer)
For each site: open it at desktop and mobile widths, read the diff against the
original (`git diff origin/v1-original -- sites/NN-slug`), and go through the checklist in §5. Write findings in the
note's Review section as unchecked items (`- [ ] R1 …`). Tag each one
`must` (blocks done) or `nice` (builder's call).
- No findings: stage `done` (see §8).
- Otherwise: stage `changes requested`.

Don't fix the site yourself during a review. The builder owns the fix, so
the history stays clear.

### Fix (builder)
Work through every `R` item on each `changes requested` site. Tick the
item and add a line under Fix log: `R1: fixed in <short sha>` or
`R1: not fixed, because …`. Then re-verify (§6) and set the stage to
`awaiting confirm`. If the reviewer found nothing, mark the task
`skipped`.

### Confirm (reviewer)
Check only the fixes. If each `must` item is fixed or reasonably
declined, set the stage to `done`. If one isn't, add it back as a new
`must` item, set the stage to `changes requested`, and add a Fix task for
the builder to the Queue, directly after your current tasks.

### Audit (site 26)
Explore all seven pages of The Tideline at desktop and mobile widths. In
`revamp/notes/26-the-tideline.md`, write a prioritized improvement list.
Don't change any code.

### Hub and guide
- Regenerate every thumbnail.
- Make sure the Hub cards and the flagship section still match
  `projects.json`.
- Add a short revamp section to `/guide` naming both tools. `/guide` is
  the only page where AI may be mentioned.

### Final
Run `check-rules` and `verify-sites` across everything. Then open a PR
from `revamp` into `master` whose body summarizes the whole revamp, and
tell the user it's ready to merge.

## 5. Review checklist

- [ ] Concept and brand still recognisable; craft clearly above the
      original (branch `v1-original`).
- [ ] No console errors. No frozen or blank canvas.
- [ ] Mobile width (390px) is a real experience, not broken or
      squeezed, and nothing scrolls sideways.
- [ ] `prefers-reduced-motion` gives a finished-looking static state,
      and the default experience is not dampened.
- [ ] Heavy effects are reduced on mobile or low-end devices.
- [ ] Visible focus states, semantic HTML, and alt text on content
      images.
- [ ] No people or faces in any image.
- [ ] `node scripts/check-rules.js` passes.
- [ ] Thumbnail regenerated and it matches the new look.

## 6. Verification (both roles)

- `node scripts/check-rules.js` must print `OK`.
- `NODE_PATH=$(npm root -g) node scripts/verify-sites.js --base-url http://localhost:4173 --only NN`
  (drop `NODE_PATH` if `scripts/node_modules` exists). No page errors.
  Font or CDN failures mean the environment's network is blocking
  those hosts (see §7). They are not a pass.
- Look at the site yourself at 1440x900 and 390x844, both with reduced
  motion off and on.
- **If you can't render something**, for example because a CDN is
  blocked, write `Visual check: NOT DONE, <reason>` in the note. Never
  leave it blank or imply it passed. The next agent must do that check
  before anything else.

## 7. Environment

- Serve the repo root with `python3 -m http.server 4173`, then open
  `http://localhost:4173/sites/NN-slug/`. The trailing slash matters
  locally.
- The sites load Three.js/GSAP from `cdn.jsdelivr.net`, fonts from
  `fonts.googleapis.com` / `fonts.gstatic.com`, and icons from
  `cdnjs.cloudflare.com`. The environment must allow those hosts.
- Playwright: in Claude Code cloud, Chromium lives at `/opt/pw-browsers`.
  Don't run `playwright install` there.

## 8. When a site reaches `done`

Append one line to `BUILD_LOG.md` under `## Phase 7 — Revamp`:
`- [NN-slug] Title — revamped by <builder>, reviewed by <reviewer>`

## 9. End of every session (don't skip any step)

1. Every site you touched has a current note: stage, pass log,
   verification, and a **Next step** line whenever the stage isn't
   `done`.
2. Board: update the stage column, mark your tasks `done`, `skipped`, or
   `in progress`, set **Next up** to the owner of the first open task,
   and add one Session log line.
3. `node scripts/check-rules.js` passes.
4. Commit with a message like `revamp: build batch 1 (01-05) [Claude]`,
   then `git push origin revamp`. If you can't push to `revamp`, push
   your own branch, open a PR into `revamp`, and change Next up to
   `USER: merge PR <link> into revamp, then open <next agent>`.
5. Finish your chat reply to the user in plain Thai: what you did in one
   or two lines, then exactly which tool to open next and that the
   kickoff message stays the same.

## 10. Stopping early

If you're running out of context or time, stop at a clean point. Leave
the current task `in progress`, fill in the note's **Next step**, set
**Next up** to yourself, and still run every step of §9. A half-finished
site that is committed with a clear next step is fine. Uncommitted work
is lost.

## 11. Disagreements and questions

- If you disagree with the other agent's work, say so in the site note
  under Review or Fix log with your reasoning. Don't silently undo it.
- If only the user can decide something, add it to the board's
  **Questions for the user**. Keep working on everything that doesn't
  depend on the answer.
