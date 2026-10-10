# xove — notes for Claude

This repo is worked on from the private `xove-workspace` repo, where it's the submodule `repos/xove`. The workspace's `CLAUDE.md` holds every rule (workflow, git, secrets, tests); its `specs/` (with the `design.html` references mentioned in code comments), decisions and the cross-repo contracts are there. Read those first.

This repo's own `docs/` (architecture, API, getting started, testing) and `README.md` describe the code: update them in the same PR as the code they describe. They're public: nothing about servers, secrets or the process.

Specific to this repo:

- Tests: `cd api && ./mvnw test`; `cd web && npm test && npm run build`.
- Never push to `main`; PRs are squash-merged with a conventional-commit title.
- Never edit a Flyway migration that already ran.
- Never read `.env` files or print a secret.
