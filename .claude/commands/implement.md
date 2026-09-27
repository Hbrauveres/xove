---
description: Implement the next open task of a spec, test first
argument-hint: <spec folder>
---

Implement the next unticked task in `$ARGUMENTS/tasks.md`. One task per run.

1. Read `CLAUDE.md`, the spec, the plan and the task. If the spec or the plan isn't approved, stop.
2. Make sure you're on a feature branch for this spec (`feat/<folder name>` or `fix/<folder name>`), not on `main`. If not, create it from an up-to-date `main`.
3. Write or update the test that proves the task first, run it and watch it fail for the right reason.
4. Implement the smallest change that makes it pass. Follow the patterns already in the codebase.
5. Run the relevant suite: `cd api && ./mvnw test` and/or `cd web && npm test && npm run build`. Everything must pass.
6. Tick the task in `tasks.md` and write one line under it on what changed.
7. Show me the diff summary and the test results. Commit only when I say so, with a conventional message that mentions the spec folder (e.g. `feat(api): free the slot on participant_left (0012)`).

Never read `.env` files, never print secrets, never push to `main`.
