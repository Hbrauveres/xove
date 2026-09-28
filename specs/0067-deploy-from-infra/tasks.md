# Deploy xove from infra using the app's own compose — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes. The repo each task changes is in brackets; tasks marked **Henrique** are done by hand on the server.

- [ ] **T1** [infra] `ops/deploy.sh` skeleton: `<app> <env>` from the arguments, the action only from `$SSH_ORIGINAL_COMMAND` or the next arguments (`deploy <40-hex>`, `rollback`, `status`; anything else refused); `apps/<app>.conf` loaded (unknown app refused); state folder `state/<app>-<env>/`; `status` · covers FR-3, FR-4 · verify: `ops/test_deploy.sh` (new): refusals, unknown app, `status` on an empty and on a filled state
- [ ] **T2** [infra] `deploy <sha>`: build the environment's settings, download that commit's compose file (template from the app file), refuse a compose file with a `livekit` service, write the tag, the tag guard, pull, `up -d --wait` with project `<app>-<env>`, history · covers FR-1, FR-2, FR-3, FR-8 · verify: `test_deploy.sh`: a healthy deploy; two commits with different compose files each run their own (AC-6); a pre-#44 compose file is refused and nothing changes, a post-#44 one deploys (AC-9); a failed settings build changes nothing
- [ ] **T3** [infra] Automatic rollback when a deploy fails (the previous commit's saved compose file and tag), and `rollback` by hand from the history; pre-#44 refusal applies to rollbacks too · covers FR-3, FR-7, FR-8 · verify: `test_deploy.sh`: missing images and unhealthy images leave the previous version running (AC-4); `rollback` goes to the previous history entry; a carried-over history (entries without a saved compose file) still rolls back by downloading it
- [ ] **T4** [infra] `apps/xove.conf`; `checks.yml` runs `ops/test_deploy.sh`; `.gitignore` ignores `state/`; README (deploy, rollback, status, where state lives) · covers FR-4 · verify: CI green on the PR
- [ ] **T5** [xove] `compose.yaml`: `healthcheck:` for `api` (`/api/health` says `UP`) and `web` (the page answers); the `db` check's stray `:?` text removed; `ci.yml` validate stage uses `docker compose up -d --wait --wait-timeout 150` instead of `ops/healthcheck.sh` · covers FR-2, FR-3 · verify: local `docker compose up -d --wait` goes healthy; the commit checks' validate stage is green
- [ ] **T6** **Henrique** (after the `infra` PR is merged, before the `xove` one): `git pull` in `/srv/infra`; create `state/xove-stage/`, copy `.deploy/history` and `.deploy/image.env` from `/srv/apps/xove-stage`; `ops/deploy.sh xove stage status` lists the old deploys; switch the deploy key's `command=` to `/srv/infra/ops/deploy.sh xove stage`; with the key, `status` works and `bash` is refused · covers FR-3, FR-7 · verify: AC-5 (real key) and the first half of AC-8, written in the PR
- [ ] **T7** [xove] Remove `ops/` (`deploy.sh`, `healthcheck.sh`); `stage.yml` comments point at `infra/ops/deploy.sh` · covers FR-9 · verify: AC-7 `git grep` finds no server script; commit checks green
- [ ] **T8** Docs: `xove/docs/deployment.md`, `operations.md`, `pipeline.md`, `architecture.md`, `CLAUDE.md`; `infra/README.md` · covers FR-9 · verify: AC-7 review
- [ ] **T9** Review every AC (`/review`) · verify: no gaps left
- [ ] **T10** Rollout: count `users` and `access_requests`; merge `xove`; the stage release deploys through `infra` (AC-2); counts match (AC-3); drill: `rollback`, then deploy forward (AC-4, AC-8); remove `/srv/apps/xove-stage` (AC-1) · covers FR-1, FR-5, FR-6, FR-7 · verify: AC-1, AC-2, AC-3, AC-4, AC-8 written in the PR

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
