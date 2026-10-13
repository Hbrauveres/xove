# Contributing

## The flow

1. Every change starts as an issue and a written spec (numbered requirements and testable acceptance criteria), then a plan and small tasks. Code comes after they're approved.
2. Branch from an up-to-date `main`: `feat/…`, `fix/…`, `docs/…`, `ci/…`, `chore/…`.
3. Make the change **with its tests**, and run them locally ([Testing](docs/testing.md)).
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/) and the area in parentheses: `feat(web): keep the stage when the sharer reloads`.
5. Push. **Every push runs the commit checks** (build, validate the image, tests, vulnerability scan, SAST), even before a pull request exists.
6. Open the pull request when the branch is green. It's **squash-merged**: its title becomes the one commit on `main`, so it must be a conventional commit too. Merging deploys to staging; a version tag releases to production.

## Rules that don't bend

- Tests come with every change.
- **The API changes first.** A web change that needs a new API field ships in [`xove-api`](https://github.com/Hbrauveres/xove-api) first; this repo's release is tagged only once that API version is live in production, and the web app still works without the field.
- No secrets, server details or personal data in code, config or docs. Settings are environment variables; their values live outside this repo.
- `docs/` changes in the same pull request as the behaviour it describes.
- A red pipeline on `main` is fixed before anything else is merged.
