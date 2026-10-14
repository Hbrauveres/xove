# xove-web — notes for Claude

This repo is worked on from the private `xove-workspace` repo, where it's the submodule `repos/xove-web`. The workspace's `CLAUDE.md` holds every rule (workflow, git, secrets, tests); its `specs/` (with the `design.html` references mentioned in code comments), decisions and the cross-repo contracts are there. Read those first.

This repo's own `docs/` (architecture, design, getting started, testing) and `README.md` describe the code: update them in the same PR as the code they describe. They're public: nothing about servers, secrets or the process.

Specific to this repo:

- This repo is the web app, in `app/`; the API is in `xove-api`. A web release that needs a new API field is tagged only once that API version is live in production (`release.yml`'s header).
- Tests: `cd app && npm test && npm run build`.
- Never push to `main`; PRs are squash-merged with a conventional-commit title.
- Never read `.env` files or print a secret.
- **The look is in `docs/design.md`** (the design sheet): use its tokens and components for any UI work, and update it (text and pictures) in the same PR when the look changes.
