# Production environment and release from a tag — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Done outside the repos (Henrique, 2026-09-29): Google OAuth client for production (`google-oauth-prod`), `postgres-prod`, `deploy-ssh-prod`, and the `www` DNS record.

- [x] **T1** [infra] Production's settings in `config/prod.yaml`: the `app` and `db` groups (room `xove`, own Google client, own database password) · covers FR-2, FR-4, FR-5 · verify: `ops/check-config` and the infra tests pass; on the VPS, `ops/build-env prod --check` lists every key
  - Done: `app` and `db` groups in `config/prod.yaml` (own Google client and database password, room `xove`); `build-env prod --check` resolves 15 values on Henrique's laptop. New CI step: every variable the app's `compose.yaml` uses must be set in `stage.yaml` and `prod.yaml` (fails when one is missing, tested).
- [ ] **T2** [infra] Security updates: `host/apt/52xove-unattended-upgrades` (security only, restart at 04:00) and how to install it in the README · covers FR-14 · verify: the file is valid for `unattended-upgrades --dry-run` on the VPS
- [ ] **T3** [xove] `release.yml`, first two stages: "Check the release" (tag format, on `main`, stage release green, images exist) and "Tag the images" (`vX.Y.Z` and `prod`, same digests) · covers FR-7, FR-8, FR-9 · verify: actionlint clean
- [ ] **T4** [xove] `release.yml`: "Deploy production" (production's key), "Check production" (from the internet), and "Roll back production" (runs when the check fails, and alone from the "Run workflow" button) · covers FR-10, FR-11, FR-12 · verify: actionlint clean; review that the button and the failed check run the same job
- [ ] **T5** [xove] `release.yml`: GitHub Release (pre-release for `v0.0.x`) and Discord notification for every result · covers FR-13 · verify: actionlint clean
- [ ] **T6** Docs: `deployment.md`, `pipeline.md`, `operations.md`, a new decision in `decisions.md`, `CLAUDE.md`; nothing says to deploy production by hand · covers FR-15 · verify: review
- [ ] **T7** Review every AC (`/review`) · verify: no gaps left
- [ ] **T8** Rollout · covers FR-1, FR-3, FR-6 · verify: AC-1 to AC-13 written in the PR:
  1. Merge the `infra` PR; on the VPS: `git pull`, add production's public key to `authorized_keys` (`command="/srv/infra/ops/deploy.sh xove prod",restrict`), install the update settings, `ops/build-env prod --check`.
  2. Merge the `xove` PR; tag `v0.0.1`; the production release goes green (AC-6).
  3. Small `infra` PR: the real `xove.app` site and the `www` redirect in the proxy; merge, reload the proxy (AC-1).
  4. Check AC-2 to AC-5, AC-8 and AC-11.
  5. Tag `v0.0.2`, run "Roll back production" by hand, `v0.0.1` is back (AC-9); tag a commit whose stage release didn't pass (AC-7).
  6. End with `v0.0.1` live (AC-13).

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T8 |
| FR-2 | T1 |
| FR-3 | T1, T8 |
| FR-4 | T1 |
| FR-5 | T1 |
| FR-6 | T8 |
| FR-7 | T3 |
| FR-8 | T3 |
| FR-9 | T3 |
| FR-10 | T4 |
| FR-11 | T4 |
| FR-12 | T4 |
| FR-13 | T5 |
| FR-14 | T2 |
| FR-15 | T6 |
| AC-1 to AC-9, AC-11, AC-13 | T8 |
| AC-10 | T4, T7 |
| AC-12 | T6, T7 |

Nothing uncovered. Almost every AC is checked by hand on the real server, since this is mostly setup and pipeline.
