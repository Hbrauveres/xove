---
description: Review the branch against every acceptance criterion of its spec
argument-hint: <spec folder>
---

Use the `spec-reviewer` subagent to review the current branch against `$ARGUMENTS/spec.md`.

Give it the spec folder and the diff (`git diff main...HEAD`). It must not rely on anything you remember about how the code was written.

When it reports back:

1. Show me its table (every FR and AC: covered by which test or change, or missing).
2. List what's missing or risky, most important first.
3. If everything is covered, draft the PR description from `.github/pull_request_template.md` with `Closes #<issue>`, the AC checklist ticked, and the manual checks still to do on staging.
