# xove — notes for Claude

This repo is worked on from the private `xove-workspace` repo, where it's the submodule `repos/xove`. The workspace's `CLAUDE.md` holds every rule (workflow, git, secrets, tests), and its `docs/` and `specs/` document this repo. Read those first; specs and design references (`specs/<folder>/design.html`, mentioned in code comments) are there.

Specific to this repo:

- Tests: `cd api && ./mvnw test`; `cd web && npm test && npm run build`.
- Never push to `main`; PRs are squash-merged with a conventional-commit title.
- Never edit a Flyway migration that already ran.
- Never read `.env` files or print a secret.
