---
description: Implement a whole spec, task by task, test first, up to the PR
argument-hint: <spec folder>
---

Implement every unticked task in `$ARGUMENTS/tasks.md`, in order, in one run.

1. Read `CLAUDE.md`, the spec, the plan and the tasks. If the spec or the plan isn't approved, stop.
2. Before any change, list what Henrique must do himself for this spec (1Password items, DNS, the VPS, merges, tags, anything outside the repos). If something must happen before the work, stop and ask him to do it first.
3. Work on a feature branch for this spec (`feat/<folder name>` or `fix/<folder name>`), created from an up-to-date `main`. Never push to `main`.
4. For each task:
   - Write or update the test that proves it first, run it, and watch it fail for the right reason.
   - Implement the smallest change that makes it pass, following the patterns already in the codebase.
   - Run the relevant suite (`cd api && ./mvnw test`, `cd web && npm test && npm run build`, or the repo's checks). Everything must pass.
   - Tick the task in `tasks.md` with one line on what changed, and commit with a conventional message that mentions the spec folder (e.g. `feat(api): free the slot on participant_left (0012)`). Push when it makes sense.
5. Stop and ask only for a real question, an opinion, or an action that only Henrique can do.
6. At the end: run the review task (the `spec-reviewer` subagent), fix what it finds, then open the PR(s) with `Closes #<issue>`, and tell Henrique, in plain words, what changed and what's left for him (merges, rollout steps).

Never read `.env` files, never print secrets.
