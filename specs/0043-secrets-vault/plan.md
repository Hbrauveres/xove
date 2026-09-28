# Secrets in 1Password, one generated .env per environment — plan

- Spec: [spec.md](spec.md) (approved 2026-09-28)
- Status: Approved (2026-09-28)

## Approach

**Settings in git, secrets as references.** Each environment has one file in `infra/config/`: `stage.yaml`, `prod.yaml`, `dev.yaml` (local development), plus `platform.yaml` for what's shared by every environment (the proxy). Each file groups variables by service. Public values are written as they are; secrets are written as **1Password references**, never values:

```yaml
# infra/config/stage.yaml
app:
  APP_ENV: stage
  LIVEKIT_URL: wss://rtc-stage.xove.app
  GOOGLE_CLIENT_SECRET: op://Xove App/google-oauth-stage/secret
db:
  POSTGRES_DB: xove
  POSTGRES_PASSWORD: op://Xove App/postgres-stage/password
```

A reference isn't a secret, so the whole file lives in git and shows exactly what an environment needs and where each value comes from.

**One build step.** `infra/ops/build-env <env>` (Python 3, standard library plus the distro's `python3-yaml`) reads the environment's YAML, flattens the groups into `KEY=value` lines (a key defined twice is an error), resolves every `op://` reference with the 1Password CLI, writes the result to a temporary file and moves it over `/srv/infra/generated/<env>.env` only if everything resolved (FR-5). The file is `chmod 600` and owned by the deploy user (FR-3). With `--export`, it prints `export` lines instead, for local development (FR-10).

**Consumers only read what they declare.** The generated file is used as a Compose `--env-file` (interpolation only). Containers still receive only the variables their service lists under `environment:`, as the app's compose already does. The proxy moves from `env_file: .env` (which hands the container every variable) to an explicit `environment:` list.

**Who reads the vault:**

| Reader | Credential | Can read |
| --- | --- | --- |
| The VPS (`build-env`) | 1Password service account `xove-server`, token in `~/.config/op/token` (`chmod 600`) | Vault `Xove App`, read only |
| The pipeline | 1Password service account `xove-ci`, token as the only Actions secret `OP_SERVICE_ACCOUNT_TOKEN` | Vault `Xove CI`, read only |
| Henrique, locally | His own 1Password account (desktop app integration with the CLI) | Everything he owns |

**The pipeline** loads its secrets at the start of each job that needs them, with 1Password's `load-secrets-action` (pinned to a SHA). Its references live in the workflow file (`op://…`), so `stage.yml` shows where each value comes from.

**The staging app switches now (FR-8).** Until #67 moves the app to `infra`, `xove/ops/deploy.sh` calls `/srv/infra/ops/build-env stage` before each deploy and runs Compose with `--env-file /srv/infra/generated/stage.env`. `IMAGE_TAG` stops living in `.env`: it moves to `.deploy/image.env`, deploy state the script owns, passed as a second `--env-file`.

### Alternatives considered

- **Templates per consumer with `op inject`** (`xove/.env.tpl`, `infra/proxy/.env.tpl`), the original requirement. Rejected by decision #25: settings belong in one file per environment in `infra`, and one `.env` per environment.
- **`op run` wrapping each container start** (secrets only in process memory, no file). Rejected: Compose restarts containers on its own (`restart: unless-stopped`, reboots) without `op`, and the spec asks for a file.
- **Plain GitHub Actions secrets copied from the vault.** Rejected by the spec (FR-9): two sources of truth.
- **`yq` or a shell script instead of Python.** Rejected: the missing-value and duplicate-key rules need tests (AC-3); Python's standard `unittest` runs them in `infra`'s CI with nothing to install.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Infra | `infra/config/{platform,stage,prod,dev}.yaml` | Every setting and secret reference per environment (prod is filled in, but only used in #46) |
| Infra | `infra/ops/build-env` + `infra/ops/test_build_env.py` | The build step and its tests (fake `op` on `PATH`) |
| Infra | `infra/proxy/compose.yaml` | `environment:` lists the proxy's variables; run with `--env-file /srv/infra/generated/platform.env` |
| Infra | `infra/.github/workflows/caddy.yml` (or a new `checks.yml`) | Runs the `build-env` tests and checks that no config value looks like a secret (only `op://` for secret keys) |
| Infra | `infra/.gitignore`, `infra/README.md` | Ignore `generated/`; how to build an environment |
| App | `xove/ops/deploy.sh` | Build `stage.env` before a deploy (fail the deploy if the build fails); `IMAGE_TAG` in `.deploy/image.env`; Compose with both env files |
| App | `xove/.github/workflows/stage.yml` | `load-secrets-action` for the deploy key, known hosts, host/port/user and Discord webhook; only `OP_SERVICE_ACCOUNT_TOKEN` from GitHub. The post-deploy check from outside (through the staging gate) is removed: `deploy.sh`'s health check on the VPS decides (Henrique, 2026-09-28), so the stage cookie never leaves `Xove App` |
| App | `xove/.env.example` | Removed; `docs/getting-started.md` points to `infra/config/dev.yaml` and `build-env dev --export` |
| Docs | `docs/operations.md` | Vault, settings files, building an `.env`, secrets inventory, rotation runbook |
| Docs | `docs/getting-started.md`, `docs/deployment.md`, `docs/pipeline.md`, `CLAUDE.md` | Local dev from the vault; deploy builds the env; pipeline reads the vault; the one Actions secret |
| Database | — | None |

## API and data

No API or database changes.

**Secrets inventory** (vault `Xove App` for runtime secrets, `Xove CI` for pipeline secrets; item names are final in the PR):

| Item | Fields | Used by |
| --- | --- | --- |
| `google-oauth-<env>` | client id, secret | app |
| `postgres-<env>` | password | db, app |
| `livekit-<env>` | api key, secret | LiveKit, app |
| `stage-gate` | password, bcrypt hash, cookie | proxy (`Xove App`) |
| `deploy-ssh` (`Xove CI`) | private key, known hosts, host, port, user | pipeline |
| `discord-webhook` | url | pipeline (`Xove CI`); a copy in `Xove App` for backups later |
| `ghcr-read-token` | token | VPS (`docker login`) |
| `op-server-token`, `op-ci-token` | token | reference copies of the two service account tokens |

**New settings:** `OP_SERVICE_ACCOUNT_TOKEN` (the only Actions secret); `~/.config/op/token` on the VPS.

## Risks

- **Service accounts on Henrique's Individual/Families plan.** The docs set no plan requirement, only that they can't use the built-in Private/Shared vaults (we create our own). Confirmed in 1Password's Developer section before any code.
- **Two copies of the Discord webhook** (one per vault, once backups use it): rotating it means updating both items; the runbook says so.
- **The server token can read every runtime secret.** It's `chmod 600` for the deploy user only, and read only. A leak means rotating the token and, to be safe, the secrets.
- **A failed build blocks deploys** (1Password down, token expired). That's the safe side: the running version keeps running, and the error names the cause.
- **Switch-over mistakes.** The old `.env` files are kept as `.env.bak` (`chmod 600`) until AC-1 and AC-8 pass, then deleted.
- **Log leaks.** `build-env` never prints values, only key names; `load-secrets-action` masks values in the Actions logs.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | On the VPS: build `stage.env`, compare it with the old `.env` key by key without printing values (hash per key), restart, check staging | manual, in the PR |
| AC-2 | Rotate the staging LiveKit pair in 1Password (and LiveKit's copy), rebuild, redeploy, share and watch | manual |
| AC-3 | `test_build_env.py`: missing reference, missing setting, duplicate key, `op` failure → non-zero exit, message names the key, existing file unchanged; success → `chmod 600`, all keys present | unit (infra CI) |
| AC-4 | With the server token: `op vault list` shows only `Xove`; `op item edit …` is refused | manual, in the PR |
| AC-5 | `gitleaks` over both repos; the config check in infra CI; inventory reviewed against the vault | CI + review |
| AC-6 | `ls -l /srv/infra/generated/` and `git status` in `infra` | manual, in the PR |
| AC-7 | `docs/operations.md` reviewed | review |
| AC-8 | Staging: sign in, share, watch; the gate still asks once | manual |
| AC-9 | `gh secret list` shows only `OP_SERVICE_ACCOUNT_TOKEN`; a stage release is green with a Discord message | manual, in the PR |
| AC-10 | Following `getting-started.md` on Henrique's machine, the API and web run with vault values | manual |

## Rollout

1. **Henrique, in 1Password:** confirm the plan supports service accounts; create vaults `Xove App` and `Xove CI`; create the items above from today's `.env` files and Actions secrets (copy, don't retype); create the service accounts `xove-server` (read `Xove App`) and `xove-ci` (read `Xove CI`).
2. **Henrique, on the VPS:** install the 1Password CLI and `python3-yaml`; save the server token to `~/.config/op/token` (`chmod 600`).
3. **`infra` PR** (config, `build-env`, tests, proxy compose). After the merge, `git pull` on the VPS, then `ops/build-env platform` and `ops/build-env stage`; compare with the old files (AC-1); `docker compose --env-file … up -d` for the proxy (AC-8).
4. **`xove` PR** (deploy script, pipeline, docs). Add `OP_SERVICE_ACCOUNT_TOKEN` to GitHub first. The merge's stage release uses the vault end to end (AC-9); then delete the other Actions secrets and the `.env.bak` files.
5. **Rollback:** restore `.env.bak` and the previous proxy compose, `ops/deploy.sh rollback`, and re-add the Actions secrets from the vault.

## Decided trade-off

**Two vaults** (Henrique, 2026-09-28): `Xove` for runtime secrets, read by the server; `Xove CI` for pipeline secrets, read by the pipeline. A leaked CI token can't read the database password or the Google secret. The spec's FR-1 is amended to "the Xovê vaults".

**Naming (2026-09-28):** the runtime vault is `Xove App`; references look like `op://Xove App/livekit-stage/password`. Built-in fields are used where they fit (`username`, `password`) plus labelled custom fields (`hash`, `cookie`, `host`, `port`, `user`, `known-hosts`). Public values (client id, database name and user, URLs) are settings in `config/`, not vault items.

**Accepted exception (review, 2026-09-28):** the two service account tokens stay in Henrique's own vault, not in the Xove vaults they unlock. Every other secret, including the server's GHCR read token (`ghcr-read-token`), lives in `Xove App` or `Xove CI`.
