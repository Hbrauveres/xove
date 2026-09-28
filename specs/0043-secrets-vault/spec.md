# Secrets in 1Password, one generated .env per environment — spec

- Issue: #43
- Status: Approved (2026-09-28); FR-1 amended during planning (two vaults)
- Owner: Henrique

## Problem

Secrets are typed by hand into `.env` files on the server (the app's, the proxy's), copied into GitHub Actions secrets, and only partly kept in 1Password. There's no single place that says what each environment's settings and secrets are, rotating one means editing files on the server, and public settings (ports, addresses, room names) are mixed with secrets in files that aren't in git.

## Who it's for

Henrique (one place for every secret, rotation without touching the server by hand) and the deploy (it builds each environment's settings the same way every time).

## Functional requirements

- **FR-1** Every secret of every environment lives in the Xovê 1Password vaults (runtime secrets and pipeline secrets in separate vaults, amended by the plan on 2026-09-28), one item per secret group, with separate values per environment where they differ. Nothing else is the source of a secret.
- **FR-2** Every public setting of an environment (addresses, ports, room names, feature toggles later) lives in git, in one settings file per environment in the `infra` repo, grouped by service.
- **FR-3** For each environment, one `.env` is built from that environment's settings file plus its secrets from the vault. It's never in git, never edited by hand, readable only by the deploy user, and every service of that environment reads it.
- **FR-4** The server reads the vault with its own credential that can only read this vault, and only read; that credential is the one secret set up by hand on the server.
- **FR-5** Building an environment's `.env` fails loudly and leaves the previous file in place if a secret or setting is missing, instead of producing a partial file.
- **FR-6** Rotating a secret is: change it in 1Password, rebuild and redeploy the environment. The rotation runbook says so, with the special cases (database password, Google secret, deploy key).
- **FR-7** No secret value is in any repo, and every secret in use has a vault item.
- **FR-8** The services running today switch to the generated `.env` in this issue: the proxy and the staging app. Staging keeps working the same.
- **FR-9** The pipeline reads its secrets (deploy key, Discord webhook, stage cookie…) from the vault when it runs. The only secret stored in GitHub is the pipeline's own read-only vault credential.
- **FR-10** Local development gets its settings from the vault too (a `dev` set of values), with one documented command to run the API and the web app locally.

## Acceptance criteria

- **AC-1** Deleting an environment's `.env` on the server and rebuilding it gives the same values, and the environment works after a restart (manual, in the PR).
- **AC-2** Rotating the staging LiveKit key pair only in 1Password, then rebuilding and redeploying, keeps video working on staging (manual).
- **AC-3** A missing secret or setting makes the build fail with a message naming it, and the existing `.env` is unchanged (automated test of the build step).
- **AC-4** The server's vault credential can't read another vault and can't write (manual check with the 1Password CLI, in the PR).
- **AC-5** `git grep` in every repo finds no secret value; the secrets inventory in the docs lists every secret with its vault item and who uses it (review).
- **AC-6** The generated `.env` is `chmod 600`, owned by the deploy user, and not in git (manual, in the PR).
- **AC-7** `docs/operations.md` describes the vault, the settings files, how an `.env` is built, and the rotation runbook.
- **AC-8** After the switch, staging works as before (sign in, share, watch) and the proxy serves every site with the staging gate (manual).
- **AC-9** The GitHub repo has exactly one Actions secret (the vault credential); a stage release is green and posts to Discord (manual, in the PR).
- **AC-10** Following `docs/getting-started.md`, the API and the web app run locally with values from the vault (manual).

## Out of scope

- Moving LiveKit (#44) or the app runtime (#67) to `infra`; they consume the generated `.env` in their own issues.
- Backup bucket credentials (#42): added to the vault when backups are built.
- A secrets manager other than 1Password, or secrets injected at container runtime instead of a file.

## Open questions

None. Decided with Henrique on 2026-09-28: the proxy and the staging app switch in this issue (FR-8); the pipeline reads its secrets from the vault at run time (FR-9); local development uses the vault too (FR-10).
