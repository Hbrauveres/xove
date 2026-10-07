# Xovê — notes for Claude

Read this first in any session about this repository.

## What this is

Xovê: a private web app where invited friends share their screens and cameras (up to 6 at once, 20 people in the room) and watch each other. React web app (`web/`), Java 21 + Spring Boot API (`api/`), PostgreSQL, a self-hosted LiveKit server, all in Docker Compose on one VPS behind a shared Caddy proxy (configured in the separate private `infra` repo).

- Project wiki: `docs/` (start at `docs/README.md`). Architecture, testing, pipeline, deployment, operations, decisions.
- What's next: the backlog in GitHub Issues, on the "Xovê" project board, grouped by milestone (one per roadmap step). Each issue holds its requirements until its spec is written. The early build plan (`xove-plan.md`) is retired.

## Who you're working with

Henrique, software engineer, owner of the project. He builds Xovê to learn and to show Java on his GitHub. Casual Brazilian Portuguese or English, direct and practical. He wants **one step at a time**: one clear action, wait for the result, then the next. **Keep replies short and direct**: a few lines, one command, at most one line of why. Explain only what he asks; no extra options, background or flourish. If something unexpected comes up, say it in one line and ask before going deeper.

## How we work

1. **Henrique owns the spec, plan and tasks; Claude Code implements the whole spec.** Once the tasks are approved, one `/implement` run does every task by itself: branch from an up-to-date `main`, code and tests, commit and push as it goes, then the review and the PR. Henrique reviews the full change in the PR, carefully, and asks for rework there.
2. **Say what Henrique must do before starting.** Anything only he can do (1Password items, DNS, the VPS, merges, tags) is listed at the start of the run, so he does it first. Stop in the middle only for a real question, an opinion, or an action from him.
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

- Test counts at the last checkpoint: API 163, web 357 (2026-10-07, spec 0118).
- LiveKit runs from the `infra` repo, one server per environment: staging `rtc-stage.xove.app` (room `xove-stage`), production `rtc.xove.app` (room `xove`).
- The room's seats come from `XOVE_ROOM_SEATS` in `infra/config/<env>.yaml`: 20 in production, 3 in staging (to try the queue with 4 people).
- Staging: `stage.xove.app` (behind an extra gate), deployed on every merge. Production: `xove.app`, released only by a version tag `vX.Y.Z` (`release.yml`); its "Run workflow" button rolls production back. `v0.0.x` are test releases until backups exist (#42).
- Images: `ghcr.io/hbrauveres/xove-api`, `ghcr.io/hbrauveres/xove-web`, tagged `sha-<12 chars of the commit>`.
- On the server, deploys run from the `infra` repo, not a checkout of this one: `/srv/infra/ops/deploy.sh xove <env> status | deploy <sha> | rollback`. By hand only for staging; each environment has its own deploy key.
