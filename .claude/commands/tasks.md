---
description: Break an approved plan into small, verifiable tasks
argument-hint: <spec folder>
---

Break `$ARGUMENTS/plan.md` into tasks.

1. Check that the plan has `Status: Approved`. If not, stop and tell me.
2. Create `$ARGUMENTS/tasks.md` from `specs/_templates/tasks.md`.
3. Each task: one commit's worth of work, leaves the build and tests green, names the FRs it covers and exactly how it's verified (a test class, a command, or a manual step).
4. Order: tests and core logic first, then wiring (controllers, UI), then docs, then a final review task.
5. Every FR and every AC in the spec must be covered by at least one task. End with a short coverage table (FR/AC → task) and point out anything uncovered.
