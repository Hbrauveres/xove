---
description: Draft the technical plan for an approved spec
argument-hint: <spec folder, e.g. specs/0012-stale-slot>
---

Write the plan for `$ARGUMENTS`.

1. Check that `$ARGUMENTS/spec.md` has `Status: Approved`. If not, stop and tell me.
2. Read the spec, `specs/_templates/plan.md`, `CLAUDE.md`, and the code and `docs/` pages the change touches. Look at how similar things are already done in the codebase and follow the same patterns.
3. Create `$ARGUMENTS/plan.md` from the template: approach (with the alternatives you rejected and why), the table of changes, API and data changes, risks, a test plan mapping **every AC** to a test, and the rollout.
4. Database changes are new Flyway migrations only, compatible with the previous version of the code.
5. Name every new setting or secret and where it goes; never write a secret value.
6. Ask me about any real trade-off before finishing.
7. When I say the plan is approved: set `Status: Approved (<today>)` and comment "Plan approved" on the issue.

Don't write code yet.
