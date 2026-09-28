# Contributing

## Spec first

Changes start as a GitHub issue (Feature or Bug template) and a written spec with numbered functional requirements and testable acceptance criteria. Code comes after the spec and its plan are approved, and the pull request proves every acceptance criterion. The whole process, the Definition of Ready and Done, and the project board are in [`specs/README.md`](../specs/README.md).

## The flow

1. Start from an up-to-date `main`:
   ```bash
   git switch main && git pull && git switch -c feat/short-description
   ```
   (A git alias saves typing: `git config --global alias.start '!f() { git switch main && git pull && git switch -c "$1"; }; f'`, then `git start feat/x`.)
2. Make the change **with its tests**. Run them locally ([Testing](testing.md)).
3. Commit and push. **Every push runs the commit checks** (build, validate, tests, scans), so you see a red commit right away, even before a pull request exists.
4. Open a pull request to `main` when the branch is green. Its required checks are the runs of your last commit.
5. **Squash and merge.** The whole pull request becomes one commit on `main`, titled after the pull request, and the branch is deleted automatically. The pipeline then publishes and deploys to staging; check it there.

## Merge policy

- Only **squash merging** is allowed, and `main` requires a linear history. One pull request = one spec = one commit on `main`.
- The **pull request title becomes the commit message**, so it must be a conventional commit: `feat(api): free the screen when the sharer leaves`. GitHub adds `(#23)` at the end.
- The individual commits of the branch (one per task) stay visible in the pull request.
- Undoing a feature is `git revert <that commit>` in a new pull request.

## Branch names

| Prefix | For |
| --- | --- |
| `feat/` | New behaviour |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `ci/` | Pipeline changes |
| `chore/` | Dependencies, cleanup, tooling |

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), with the area in parentheses:

```
feat(api): screen endpoints for members
fix(web): stop the share when the slot is taken
ci: split build and test into stages
docs: pipeline and deployment pages
```

## Pull request checklist

The pull request template has the full checklist. In short:

- [ ] Tests cover the new behaviour, and `./mvnw test` / `npm test` pass locally
- [ ] Database changes are a **new** Flyway migration, compatible with the previous version of the code ([why](deployment.md#database-migrations-and-rollback))
- [ ] No secrets, hostnames of servers or personal data in code, config or docs
- [ ] New settings are added to every environment's file in `infra/config/` (secrets as 1Password references) and the [environment variables](getting-started.md#environment-variables) table
- [ ] Docs updated if behaviour, setup or the pipeline changed

## Rules that don't bend

- Never commit a `.env` file or a secret. Settings live in `infra/config/<env>.yaml`; secrets only in 1Password.
- Never edit a migration that already ran anywhere. Add a new one.
- Never push to `main` directly (the ruleset blocks it anyway).
- A red pipeline on `main` is fixed before anything else is merged.
