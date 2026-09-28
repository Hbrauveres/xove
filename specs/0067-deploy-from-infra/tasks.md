# Deploy xove from infra using the app's own compose — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes. The repo each task changes is in brackets; tasks marked **Henrique** are done by hand on the server.

- [x] **T1** [infra] `ops/deploy.sh` skeleton: `<app> <env>` from the arguments, the action only from `$SSH_ORIGINAL_COMMAND` or the next arguments (`deploy <40-hex>`, `rollback`, `status`; anything else refused); `apps/<app>.conf` loaded (unknown app refused); state folder `state/<app>-<env>/`; `status` · covers FR-3, FR-4 · verify: `ops/test_deploy.sh` (new): refusals, unknown app, `status` on an empty and on a filled state
  - Done: `infra/ops/deploy.sh` skeleton (app and environment validated, `apps/<app>.conf` loaded, state in `state/<app>-<env>/`, action from `$SSH_ORIGINAL_COMMAND` or arguments, `status` from the state and Docker labels; `deploy`/`rollback` stubs for T2/T3); `ops/test_deploy.sh`: 14/14 (7 refused requests, unknown app, path and bad environment names, status empty and filled, status via SSH).
- [x] **T2** [infra] `deploy <sha>`: build the environment's settings, download that commit's compose file (template from the app file), refuse a compose file with a `livekit` service, write the tag, the tag guard, pull, `up -d --wait` with project `<app>-<env>`, history · covers FR-1, FR-2, FR-3, FR-8 · verify: `test_deploy.sh`: a healthy deploy; two commits with different compose files each run their own (AC-6); a pre-#44 compose file is refused and nothing changes, a post-#44 one deploys (AC-9); a failed settings build changes nothing
  - Done: `deploy <sha>` builds the settings, downloads that commit's compose file into `state/<app>-<env>/compose/` (URL template from the app file), refuses a compose file with a `livekit` service, writes the tag, checks every service resolves to it, pulls and runs `up -d --no-build --remove-orphans --wait` as project `<app>-<env>`, then records the history and keeps the last 10 compose files. `test_deploy.sh` (local registry, busybox images, fake commits, fake `build-env`): 29/29, including AC-6 and AC-9; shellcheck clean.
- [x] **T3** [infra] Automatic rollback when a deploy fails (the previous commit's saved compose file and tag), and `rollback` by hand from the history; pre-#44 refusal applies to rollbacks too · covers FR-3, FR-7, FR-8 · verify: `test_deploy.sh`: missing images and unhealthy images leave the previous version running (AC-4); `rollback` goes to the previous history entry; a carried-over history (entries without a saved compose file) still rolls back by downloading it
  - Done: a failed deploy shows the last logs and goes back to the last history entry (its compose file downloaded if missing, pre-#44 refused), or says "fix forward" with no history; `rollback` goes to the previous history entry the same way and records it; `HEALTH_TIMEOUT` can be overridden. `test_deploy.sh`: 40/40 (missing images, unhealthy images, manual rollback, a carried-over history without saved compose files, a pre-#44 rollback refused); shellcheck clean.
- [x] **T4** [infra] `apps/xove.conf`; `checks.yml` runs `ops/test_deploy.sh`; `.gitignore` ignores `state/`; README (deploy, rollback, status, where state lives) · covers FR-4 · verify: CI green on the PR
  - Done: `infra/apps/xove.conf` (compose URL template on GitHub, image prefix, `web api`); `checks.yml` runs `ops/test_deploy.sh` and checks every app file downloads a real compose file (xove at #44's merge `3ff2b717`); `.gitignore` ignores `state/`; README section "Deploying an app". The app-file check failed without the file and passes with it; actionlint clean.
- [x] **T5** [xove] `compose.yaml`: `healthcheck:` for `api` (`/api/health` says `UP`) and `web` (the page answers); the `db` check's stray `:?` text removed; `ci.yml` validate stage uses `docker compose up -d --wait --wait-timeout 150` instead of `ops/healthcheck.sh` · covers FR-2, FR-3 · verify: local `docker compose up -d --wait` goes healthy; the commit checks' validate stage is green
  - Done: `compose.yaml` gives `api` (`/api/health` says `UP`, 90 s start period) and `web` (the page answers) a `healthcheck:`; `db`'s check lost the stray `:?` text; optional settings are `${VAR:-}` (no "not set" warnings); `ci.yml` validate stage starts the stack with `up --wait --wait-timeout 150` instead of `ops/healthcheck.sh`. Locally: images built, `up --wait` exits 0 with api, db and web healthy; actionlint clean.
- [x] **T6** **Henrique** (after the `infra` PR is merged, before the `xove` one): `git pull` in `/srv/infra`; create `state/xove-stage/`, copy `.deploy/history` and `.deploy/image.env` from `/srv/apps/xove-stage`; `ops/deploy.sh xove stage status` lists the old deploys; switch the deploy key's `command=` to `/srv/infra/ops/deploy.sh xove stage`; with the key, `status` works and `bash` is refused · covers FR-3, FR-7 · verify: AC-5 (real key) and the first half of AC-8, written in the PR
  - Done 2026-09-28: `infra` #4 merged and pulled; `state/xove-stage/` holds the carried-over history and running tag (`sha-393239e5c468`, 5 previous deploys, containers found as project `xove-stage`); the deploy key's forced command is `/srv/infra/ops/deploy.sh xove stage` (backup in `authorized_keys.bak`); with the real key `status` answers from the new tool and `bash` is refused (AC-5).
- [x] **T7** [xove] Remove `ops/` (`deploy.sh`, `healthcheck.sh`); `stage.yml` comments point at `infra/ops/deploy.sh` · covers FR-9 · verify: AC-7 `git grep` finds no server script; commit checks green
  - Done: `ops/` removed (`deploy.sh`, `healthcheck.sh`); the bug template, `stage.yml` comments and `CLAUDE.md` point at `infra`'s `ops/deploy.sh <app> <env>`; outside docs and specs nothing refers to the old scripts (AC-7, first half).
- [x] **T8** Docs: `xove/docs/deployment.md`, `operations.md`, `pipeline.md`, `architecture.md`, `CLAUDE.md`; `infra/README.md` · covers FR-9 · verify: AC-7 review
  - Done: `deployment.md` (no checkout, the new deploy diagram, key points, commands and server setup with `/srv/infra/ops/deploy.sh xove <env>`), `operations.md` (commands by container name and through the tool, settings changes need a redeploy, the pre-#44 refusal), `pipeline.md`, `architecture.md` (no `ops/` in the layout), decision #29; `CLAUDE.md` in T7 and `infra/README.md` in T4. No old deploy wording left; the diagram renders.
- [x] **T9** Review every AC (`/review`) · verify: no gaps left
  - Done: three reviews; their fixes in a second `infra` PR (`fix/0067-deploy-hardening`, see the plan's "Review fixes") and here (stage release only for `main`, images deleted only on exit 2, docs). `test_deploy.sh` 75/75, infra unit tests 46/46, shellcheck and actionlint clean. Nothing blocking left; AC-1, 2, 3, 5 (real key with `restrict`) and 8 are T10.
- [ ] **T10** Rollout: on the VPS, `docker compose version` is 2.35 or newer; merge the `infra` review-fix PR and `git pull` in `/srv/infra`; check `~/.docker/config.json` has no `credsStore` (Compose runs with an empty environment); switch the deploy key's options to `restrict` and re-check AC-5 with the real key (`bash` refused, `status` works); count `users` and `access_requests`; merge `xove`; the stage release deploys through `infra` (AC-2); counts match (AC-3); drill: `rollback`, then deploy forward (AC-4, AC-8); remove `/srv/apps/xove-stage` (AC-1) · covers FR-1, FR-5, FR-6, FR-7 · verify: AC-1, AC-2, AC-3, AC-4, AC-5, AC-8 written in the PR

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T2, T10 |
| FR-2 | T2, T5 |
| FR-3 | T1, T2, T3, T5, T6 |
| FR-4 | T1, T4 |
| FR-5 | T10 |
| FR-6 | T10 |
| FR-7 | T3, T6, T10 |
| FR-8 | T2, T3 |
| FR-9 | T7, T8 |
| AC-1 | T10 |
| AC-2 | T10 |
| AC-3 | T10 |
| AC-4 | T3, T10 |
| AC-5 | T1, T6 |
| AC-6 | T2 |
| AC-7 | T7, T8 |
| AC-8 | T6, T10 |
| AC-9 | T2 |

Nothing uncovered. AC-1, AC-2, AC-3 and AC-8 need the real server; the simulation covers AC-4, AC-5, AC-6 and AC-9 on every `infra` PR.
