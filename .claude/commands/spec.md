---
description: Draft the spec for a GitHub issue (what and why, no code)
argument-hint: <issue number>
---

Write the spec for GitHub issue #$ARGUMENTS.

1. Read the issue and its comments: `gh issue view $ARGUMENTS --comments`.
2. Read `specs/README.md`, `specs/_templates/spec.md`, `specs/_templates/example-spec.md`, and the parts of `docs/` the issue touches (usually `docs/architecture.md`).
3. Create `specs/<issue number padded to 4 digits>-<short-slug>/spec.md` from the template.
4. Write it from the user's point of view: problem, who it's for, functional requirements (FR-n, observable from outside the code), acceptance criteria (AC-n, each testable by an automated test or a written manual step), out of scope, open questions.
5. Do not design the solution or name classes here. That's the plan.
6. If anything is ambiguous, list it under "Open questions" and ask me about each one before finishing. Don't guess.
7. When I say the spec is approved: set `Status: Approved (<today>)`, and comment "Spec approved: specs/<folder>/spec.md" on the issue with `gh issue comment`.

Don't create a branch, commit or push unless I ask.
