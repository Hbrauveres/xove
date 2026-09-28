# Xovê — notes for Claude

Read this first in any session about this repository.

## What this is

Xovê: a private web app where one person shares their screen and invited friends watch it. React web app (`web/`), Java 21 + Spring Boot API (`api/`), PostgreSQL, a self-hosted LiveKit server, all in Docker Compose on one VPS behind a shared Caddy proxy (configured in the separate private `infra` repo).

- Project wiki: `docs/` (start at `docs/README.md`). Architecture, testing, pipeline, deployment, operations, decisions.
- What's next: the backlog in GitHub Issues, on the "Xovê" project board, grouped by milestone (one per roadmap step). Each issue holds its requirements until its spec is written. The early build plan (`xove-plan.md`) is retired.

## Who you're working with

Henrique, software engineer, owner of the project. He builds Xovê to learn and to show Java on his GitHub. Casual Brazilian Portuguese or English, direct and practical. He wants **one step at a time**: one clear action, wait for the result, then the next. **Keep replies short and direct**: a few lines, one command, at most one line of why. Explain only what he asks; no extra options, background or flourish. If something unexpected comes up, say it in one line and ask before going deeper.

## How we work

1. **Claude Code executes, Henrique reviews and approves.** In the repo, you run the commands: create the branch from an up-to-date `main`, edit the files, run the tests (and, for pipeline or deploy changes, a local simulation with Docker), commit, push and open the PR.
2. **Show before you act outward.** Before every commit, show Henrique the `git diff` (or a summary plus the full diff on request) and wait for his approval. Pushes, issues, issue comments and PRs also need his approval (`.claude/settings.json` asks for them).
3. **Henrique merges and releases.** Merging a PR, creating `v*` tags and anything on the VPS stay with him; never try to work around the denied commands in `.claude/settings.json`.
4. Every push runs the commit checks; `main` only accepts PRs whose checks pass. Merges to `main` deploy to staging automatically.
5. After every milestone: close or update its issues, record decisions in `docs/decisions.md`, and update this file.

## Spec-driven development

Every change follows `specs/README.md`: GitHub issue → `spec.md` (approved by Henrique) → `plan.md` (approved) → `tasks.md` → code and tests one task at a time → review against every acceptance criterion → PR with `Closes #<issue>`. Use the commands in `.claude/commands/`: `/spec <issue>`, `/plan <folder>`, `/tasks <folder>`, `/implement <folder>`, `/review <folder>`. Never write code for a spec or plan that isn't approved. The backlog is GitHub Issues on the project board; there's no Slack.

## Rules

- **Secrets never in git and never in chat.** They live only in 1Password (vaults `Xove App` and `Xove CI`); public settings live in `infra/config/<env>.yaml`, and each environment's `.env` is generated from both by `infra/ops/build-env` (never edited by hand). If Henrique pastes a secret, tell him to rotate it.
- **Never edit a Flyway migration that already ran.** Add a new `V<n>__…` file. Keep migrations compatible with the previous code (rollback doesn't undo migrations).
- **Never push to `main` directly.** Branch names `feat/`, `fix/`, `docs/`, `ci/`, `chore/`; conventional commits (`feat(api): …`). PRs are squash-merged, so the PR title must be a conventional commit too.
- Tests come with every change. API: `cd api && ./mvnw test`. Web: `cd web && npm test && npm run build`.
- Keep `docs/` in step with the code in the same PR.
- Keep this `CLAUDE.md` in step too: update it in the same PR whenever a fact here changes (test counts, commands, workflow, rules).
- The vulnerability scan blocks HIGH/CRITICAL findings that have a fix. Fix by upgrading; `.trivyignore` only with a reason and a recheck date.
- Production releases are tags `vX.Y.Z` (SemVer, starting at `v0.1.0`) on a commit of `main` that already runs on staging. Only Henrique creates tags; the tag is the approval.

## Useful facts

- Test counts at the last checkpoint: API 92, web 45 (2026-09-28, spec 0044).
- LiveKit runs from the `infra` repo, one server per environment: staging `rtc-stage.xove.app` (room `xove-stage`), production `rtc.xove.app` (room `xove`).
- Staging: `stage.xove.app` (behind an extra gate). Production: `xove.app` (placeholder until launch).
- Images: `ghcr.io/hbrauveres/xove-api`, `ghcr.io/hbrauveres/xove-web`, tagged `sha-<12 chars of the commit>`.
- On the server, `ops/deploy.sh status | deploy <sha> | rollback` in the environment's checkout.
