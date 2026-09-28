# Secrets in 1Password, one generated .env per environment — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes. The repo each task changes is in brackets; tasks marked **Henrique** are done by hand outside the repos.

- [x] **T1** [infra] `ops/build-env <env>`: read `config/<env>.yaml`, flatten the groups (duplicate key → error), resolve `op://` references with the 1Password CLI, write to a temp file and move it to `generated/<env>.env` with `chmod 600` only on full success; `--export` prints `export` lines; `--check` resolves everything and reports missing keys without writing; never prints values · covers FR-3, FR-5 · verify: `python3 -m unittest ops/test_build_env.py` with a fake `op` on `PATH` (missing reference, missing setting, duplicate key, `op` failure, success, file mode, no values in output)
  - Done: `infra/ops/build-env` (Python 3 + PyYAML): flattens groups, refuses duplicate/badly named/empty keys and unsafe values, resolves `op://` with `op read` (server token from `~/.config/op/token`), writes atomically with `chmod 600`, `--check` and `--export`; 15 tests in `ops/test_build_env.py`. Checked that Compose keeps `$` literal in single-quoted values.
- [x] **T2** [infra] CI runs the `build-env` tests and a config check: every key that holds a secret must be an `op://` reference (a list of secret key names, e.g. `*_SECRET`, `*_PASSWORD`, `*_TOKEN`, `*_HASH`, `*_COOKIE`) · covers FR-7 · verify: the checks pass on the PR; a test config with a plain secret value fails them
  - Done: `infra/ops/check-config` (keys ending in `_SECRET`, `_PASSWORD`, `_TOKEN`, `_HASH`, `_COOKIE`, `_KEY` must be `op://`; prints file and key, never the value) with 4 tests; `infra/.github/workflows/checks.yml` runs every `ops/test_*.py` and the check on PRs and `main`. actionlint and Semgrep clean.
- [x] **T3** **Henrique**: in 1Password, confirm service accounts can be created; create vaults `Xove` and `Xove CI`; copy every secret from today's `.env` files and Actions secrets into items (inventory in the plan); create service accounts `xove-server` (read `Xove`) and `xove-ci` (read `Xove CI`). On the VPS: install the 1Password CLI and `python3-yaml`; save the server token in `~/.config/op/token` (`chmod 600`) · covers FR-1, FR-4 · verify: AC-4 with the server token (`op vault list` shows only `Xove`; editing an item is refused), result in the PR
  - Done 2026-09-28: vaults `Xove App` (google-oauth-stage, postgres-stage, livekit-stage, stage-gate) and `Xove CI` (deploy-ssh, discord-webhook); service accounts `xove-server` (read `Xove App`) and `xove-ci` (read `Xove CI`); on the VPS 1Password CLI 2.39.0, `python3-yaml`, token in `~/.config/op/token` (600). AC-4: `op vault list` shows only `Xove App`; `op item create` refused ("You do not have permission").
- [x] **T4** [infra] `config/platform.yaml`, `stage.yaml`, `prod.yaml`, `dev.yaml` with every setting and secret reference (prod complete but unused until #46) · covers FR-2, FR-7 · verify: `build-env --check` passes for `platform`, `stage` and `dev` with Henrique's 1Password; the T2 config check passes
  - Done: `infra/config/platform.yaml` (proxy gate), `stage.yaml`, `dev.yaml` (dev secrets in new items `postgres-dev`, `livekit-dev`); `prod.yaml` deferred to #46 (its items don't exist yet). On the VPS, `build-env --check` resolves platform (2), stage (10) and dev (9) values; `check-config` passes.
- [x] **T5** [infra] `proxy/compose.yaml` lists its variables under `environment:` and runs with `--env-file /srv/infra/generated/platform.env`; `.gitignore` ignores `generated/`; `README.md` explains building an environment · covers FR-3, FR-8 · verify: `caddy validate` in CI; `docker compose config` with a sample env file shows only the proxy's variables in the container
  - Done: `proxy/compose.yaml` reads `env_file: ../generated/platform.env` (only the proxy's two values, so no `--env-file` flag to forget; replaces `environment:` + `--env-file` from the plan); `.gitignore` ignores `generated/`; README explains config, `build-env` and the proxy; `checks.yml` asserts the proxy sees exactly its two variables.
- [x] **T6** [xove] `ops/deploy.sh` runs `/srv/infra/ops/build-env stage` before a deploy (a failed build fails the deploy, nothing changes), keeps `IMAGE_TAG` in `.deploy/image.env`, runs Compose with both env files; status and rollback read the tag from the new place · covers FR-3, FR-8 · verify: `shellcheck`; a local Docker simulation of `deploy`, `rollback` and a failing build (fake `build-env`), like the Step 1 verification
  - Done: `deploy.sh` builds `<env>.env` with `$INFRA_DIR/ops/build-env` before every deploy and rollback (a failed build fails before any change); environment from the folder name or `XOVE_ENV`; `COMPOSE_ENV_FILES` gives every Compose call (incl. `healthcheck.sh`) the generated file plus `.deploy/image.env`; the running tag moves to `.deploy/image.env` with a fallback to the old `.env`. Local Docker simulation (fake repo, local registry, busybox images, fake `build-env`): 17/17 checks (healthy deploy, failed build changes nothing, unhealthy deploy rolls back, status, rollback); shellcheck clean.
- [x] **T7** [xove] `stage.yml` loads the deploy key, known hosts, host, port, user and Discord webhook from `Xove CI` with `load-secrets-action` (pinned SHA); only `OP_SERVICE_ACCOUNT_TOKEN` comes from GitHub; the outside health check through the staging gate is removed (`deploy.sh` checks health on the VPS) · covers FR-9 · verify: actionlint and Semgrep pass; the stage release after merge is green (T11)
  - Done: `stage.yml` loads the deploy key, known hosts, host, port, user (deploy job) and the Discord webhook (notify job) from `Xove CI` with `1password/load-secrets-action` v5.0.1 (SHA-pinned, CLI 2.39.0); the outside check through the gate is removed. Workflows now use only `OP_SERVICE_ACCOUNT_TOKEN` and `GITHUB_TOKEN`; actionlint and Semgrep clean. The real run is checked in T11.
- [x] **T8** [xove] Local development from the vault: remove `.env.example`; `docs/getting-started.md` uses `eval "$(../infra/ops/build-env dev --export)"` before running the API and the web app · covers FR-10 · verify: AC-10 on Henrique's machine, result in the PR
  - Done: `.env.example` removed; `getting-started.md` sets up the 1Password CLI (Windows CLI linked into WSL) and loads settings with `eval "$(../infra/ops/build-env dev --export)"`; the dev database and LiveKit start with vault values; `contributing.md` points to `infra/config/`; `infra/config/dev.yaml` gains a `compose` group for the full stack. AC-10 on Henrique's machine (2026-09-28): values loaded, API healthy against a database created with the vault password.
- [x] **T9** Docs: `docs/operations.md` (vaults, settings files, building an `.env`, secrets inventory, rotation runbook with the special cases and the two-copy items), `docs/deployment.md`, `docs/pipeline.md`, `CLAUDE.md`, and decision #26 if anything outlives the spec · covers FR-6, FR-7 · verify: review; the inventory matches the vault item list
  - Done: `operations.md` (new "Settings and secrets" with the two vaults, `build-env`, secrets inventory; rotation runbook incl. gate password and service account tokens; manual compose commands with `COMPOSE_ENV_FILES`), `deployment.md` (diagram and server setup), `pipeline.md` (one GitHub secret, vault references, no outside check), `README.md`, `CLAUDE.md` (secrets rule), decision #27. No mention of `.env.example`, `STAGE_COOKIE` or the password manager left; the deploy diagram renders.
- [x] **T10** Review every AC (`/review`) · verify: no gaps left
  - Done: spec-reviewer across both repos (19 infra tests passing, no committed secrets). Fixed after review: `deploy.sh` fails unless Compose resolves web/api to the new tag (simulation 20/20); `compose.yaml` marks required settings `${VAR:?}`; `export-env: false` on the vault steps; gitleaks over the whole history in `infra` CI (one fake test value ignored); `check-config` reports a malformed group instead of crashing; `infra/proxy/.env.example` removed; `.env*` ignored in `xove`; `ghcr-read-token` joins `Xove App` in the inventory (service account tokens stay in Henrique's vault, accepted); docs note that a vault failure also silences Discord and that `prod.yaml` comes with #46.
- [ ] **T11** Rollout on the VPS (Henrique, with Claude): merge `infra`, build `platform.env` and `stage.env`, compare with the old files key by key without printing values (AC-1), switch the proxy (AC-8), check file modes (AC-6); add `OP_SERVICE_ACCOUNT_TOKEN` to GitHub, merge `xove`, check the stage release and Discord (AC-9). The merge's deploy still runs the old `deploy.sh` (the server runs its current copy), so keep the old `.env` until then and run `ops/deploy.sh deploy <sha>` once more by hand to switch to the vault; delete the other Actions secrets and the `.env.bak` files · covers FR-3, FR-8, FR-9 · verify: AC-1, AC-6, AC-8, AC-9 written in the PR
- [ ] **T12** Rotation drill: rotate the staging LiveKit key pair only in 1Password, rebuild, redeploy, share and watch · covers FR-6 · verify: AC-2, written in the PR

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T3 |
| FR-2 | T4 |
| FR-3 | T1, T5, T6, T11 |
| FR-4 | T3 |
| FR-5 | T1 |
| FR-6 | T9, T12 |
| FR-7 | T2, T4, T9 |
| FR-8 | T5, T6, T11 |
| FR-9 | T7, T11 |
| FR-10 | T8 |
| AC-1 | T11 |
| AC-2 | T12 |
| AC-3 | T1 |
| AC-4 | T3 |
| AC-5 | T2, T9 |
| AC-6 | T11 |
| AC-7 | T9 |
| AC-8 | T11 |
| AC-9 | T11 |
| AC-10 | T8 |

Nothing uncovered. AC-1, AC-2, AC-4, AC-6, AC-8, AC-9 and AC-10 are manual by nature (they need the real vault and server); their results go in the PRs.
