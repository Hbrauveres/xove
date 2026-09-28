# Deploy xove from infra using the app's own compose — plan

- Spec: [spec.md](spec.md) (approved 2026-09-28)
- Status: Approved (2026-09-28)

## Approach

**One deploy tool in `infra`, told which app and environment.** `infra/ops/deploy.sh <app> <env> <action>` replaces `xove/ops/deploy.sh`. The pipeline's restricted key gets a new forced command, `/srv/infra/ops/deploy.sh xove stage`; the pipeline keeps sending `deploy <sha>` exactly as today (FR-6), and `status` / `rollback` still work by hand. The key can't choose another app or environment: those are fixed in `authorized_keys`.

**What an app is, to the tool.** A small file per app, `infra/apps/xove.conf`: where its `compose.yaml` is (`https://raw.githubusercontent.com/Hbrauveres/xove/<sha>/compose.yaml`), its image prefix (`ghcr.io/hbrauveres/xove`) and the services built from its commits (`web api`). Adding an app later is one more file (FR-4).

**The compose file of the deployed commit, nothing else of the app (FR-1, FR-2).** For `deploy <sha>`, the tool downloads that commit's `compose.yaml` from GitHub and keeps it in the environment's state folder (`/srv/infra/state/xove-stage/compose/<sha12>.yaml`, the last few kept for rollback). No checkout, no source. Verified: `docker compose up --no-build` runs a compose file whose `build:` folders don't exist.

**Same data, same containers (FR-5).** The tool runs Compose with the project name `xove-stage` (`-p <app>-<env>`), the name Compose derives today from the checkout folder. The database volume (`xove-stage_db_data`), the network and the container names stay the same, so the move recreates the containers on the same data.

**Health belongs to the app.** Today `xove/ops/healthcheck.sh` knows what "healthy" means for `api` and `web`. It moves into `xove/compose.yaml` as `healthcheck:` entries (the API's `/api/health` says `UP`; the web page answers), next to the database's. The tool then just runs `docker compose up -d --wait --wait-timeout 180`, and the CI validate stage does the same. Nothing app-specific is left in `infra` beyond the app file.

**Every guarantee carries over (FR-3).** In order: build the environment's settings (`build-env`); download the compose file (a missing commit fails here, before anything changes); refuse a compose file that still has a `livekit` service (FR-8: that's every version from before #44, detected from the file itself, no git needed); write the tag; check that Compose resolves `web` and `api` to that tag (the guard from #43); pull; `up --wait`; on failure, the previous commit's saved compose file and tag go back up the same way. History, `status` and `rollback` work as today, from the state folder.

**History carries over (FR-7).** During the move, today's `.deploy/history` and `.deploy/image.env` are copied into `/srv/infra/state/xove-stage/`, and the running version's `compose.yaml` is downloaded into it, so the first rollback after the move works.

### Alternatives considered

- **Publish `compose.yaml` with the images** (as an OCI artifact or an image label), so deploys don't depend on GitHub. Rejected for now: more moving parts; GitHub is already needed to pull the images, and `xove` is public. See the open trade-off.
- **Keep a per-app health check script in `infra`.** Rejected: "healthy" is app knowledge; in the compose file it's versioned with the app and used by CI too.
- **Detect "before #44" with git history** (compare with the #44 commit). Rejected: needs a checkout or the GitHub API; the compose file itself already says whether it brings LiveKit.
- **A generic deploy action per environment in the key** (`command="…deploy.sh"` reading app/env from the request). Rejected: the pipeline could then ask for any app or environment.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Infra | `infra/ops/deploy.sh` (new) | `<app> <env> deploy <sha> | rollback | status`: settings, compose download, pre-#44 refusal, tag guard, pull, `up --wait`, automatic rollback, history; project `<app>-<env>`; state in `/srv/infra/state/<app>-<env>/` |
| Infra | `infra/apps/xove.conf` (new) | Compose URL template, image prefix, services |
| Infra | `infra/ops/test_deploy.sh` (new) + `checks.yml` | The Step 1 deploy simulation, ported and extended: local registry, a fake app whose compose files are served from a folder (the URL template points at it), a fake `build-env`; runs in CI |
| Infra | `infra/.gitignore`, `README.md` | Ignore `state/`; how to deploy, roll back and check status |
| App | `xove/compose.yaml` | `healthcheck:` for `api` and `web`; the `db` check cleaned up (a stray `:?` message from #43) |
| App | `xove/.github/workflows/ci.yml` | The validate stage uses `docker compose up -d --wait` instead of `ops/healthcheck.sh` |
| App | `xove/.github/workflows/stage.yml` | Comments only (the command it sends doesn't change) |
| App | `xove/ops/` | Removed (`deploy.sh`, `healthcheck.sh`) |
| Docs | `xove/docs/deployment.md`, `operations.md`, `pipeline.md`, `architecture.md`, `CLAUDE.md`; `infra/README.md` | Where the deploy lives, the commands, the state folder, the pre-#44 boundary |
| Database | — | None |

## API and data

No API or database changes. On the server:

| Path | What |
| --- | --- |
| `/srv/infra/state/xove-stage/history` | One line per healthy deploy (carried over from `.deploy/history`) |
| `/srv/infra/state/xove-stage/image.env` | The running tag |
| `/srv/infra/state/xove-stage/compose/<sha12>.yaml` | The compose file of each recent deploy (for rollback) |
| `~/.ssh/authorized_keys` | The deploy key's forced command becomes `/srv/infra/ops/deploy.sh xove stage` |

No new setting or secret.

## Risks

- **The first deploy through the new tool recreates the containers** (new working folder, same project name). Mitigated: same project name, volume and network, checked in the simulation; row counts compared before and after (AC-3).
- **GitHub unreachable at deploy time**: the deploy fails before changing anything (like a missing image). Accepted (open trade-off).
- **The forced command switch** must happen together with the merge: the new tool must be on the server before the pipeline calls it. The rollout keeps a window where both scripts exist.
- **A rollback crossing #44** is refused by design (FR-8); the operations doc already explains the manual path.
- **Health checks in the compose file** run inside the containers: the API and web images must have `wget` (both do today; the CI validate stage proves it on every commit).

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `/srv/apps/xove-stage` removed after the move; staging works | manual, in the PR |
| AC-2 | The first merge after the move: stage release green, Discord ✅ | manual |
| AC-3 | `select count(*)` of `users` and `access_requests` before and after | manual, in the PR |
| AC-4 | `test_deploy.sh`: missing images → nothing changes; unhealthy images → rollback; plus the rollback drill on staging | CI simulation + manual |
| AC-5 | `test_deploy.sh`: anything but `deploy <40-hex>`, `rollback`, `status` is refused; plus `ssh … bash` with the real key | CI simulation + manual |
| AC-6 | `test_deploy.sh`: two commits whose compose files differ; each deploy runs its own commit's file | CI simulation |
| AC-7 | `git grep` in `xove` finds no `ops/` script; docs reviewed | manual + review |
| AC-8 | Right after the move: `status` lists the old deploys; the drill's `rollback` returns to the previous version | manual |
| AC-9 | `test_deploy.sh`: a commit whose compose file has `livekit` is refused, nothing changes; a post-#44 one deploys | CI simulation |

## Rollout

1. **`infra` PR** (tool, app file, simulation). Merge; on the VPS `cd /srv/infra && git pull`. Nothing changes yet.
2. **Prepare the state** (Henrique): `mkdir -p /srv/infra/state/xove-stage/compose`, copy `/srv/apps/xove-stage/.deploy/history` and `.deploy/image.env` into it, and check `ops/deploy.sh xove stage status` shows the old deploys.
3. **Switch the key:** in `~/.ssh/authorized_keys`, change the deploy key's `command=` to `/srv/infra/ops/deploy.sh xove stage`; check with the key that `status` works and `bash` is refused (AC-5).
4. **`xove` PR** (health checks in compose, CI validate with `--wait`, `ops/` removed, docs). Merge: the stage release deploys through `infra` (AC-2); compare row counts (AC-3).
5. **Drill:** `ops/deploy.sh xove stage rollback`, then deploy forward again (AC-4, AC-8).
6. **Remove** `/srv/apps/xove-stage` (AC-1).
7. **Rollback of the move itself:** put the old `command=` back in `authorized_keys`; the old checkout still exists until step 6.

## Decided trade-offs

Decided with Henrique on 2026-09-28:

1. **The compose file comes from GitHub at the deployed commit.** Simple, no new artifact. If `xove` ever goes private, the tool gets a read-only token; if GitHub is down, a deploy fails before changing anything.
2. **"Healthy" is defined in the app's compose file** (`healthcheck:` for every service), used the same way by CI and by the server (`up --wait`).
