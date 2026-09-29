# Production environment and release from a tag — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Done outside the repos (Henrique, 2026-09-29): Google OAuth client for production (`google-oauth-prod`), `postgres-prod`, `deploy-ssh-prod`, and the `www` DNS record.

- [x] **T1** [infra] Production's settings in `config/prod.yaml`: the `app` and `db` groups (room `xove`, own Google client, own database password) · covers FR-2, FR-4, FR-5 · verify: `ops/check-config` and the infra tests pass; on the VPS, `ops/build-env prod --check` lists every key
  - Done: `app` and `db` groups in `config/prod.yaml` (own Google client and database password, room `xove`); `build-env prod --check` resolves 15 values on Henrique's laptop. New CI step: every variable the app's `compose.yaml` uses must be set in `stage.yaml` and `prod.yaml` (fails when one is missing, tested).
- [x] **T2** [infra] Security updates: `host/apt/90security-updates` (security only, restart at 04:00) and how to install it in the README · covers FR-14 · verify: the file is valid for `unattended-upgrades --dry-run` on the VPS
  - Done: `host/apt/90security-updates` (daily updates, Ubuntu's security-only origins, restart at 04:00 when needed, old kernels removed) and a README section. Tested in an Ubuntu 24.04 container: without the file there's no automatic restart; with it, `apt-config` shows the settings and `unattended-upgrades --dry-run` runs.
- [x] **T3** [xove] `release.yml`, first two stages: "Check the release" (tag format, on `main`, stage release green, images exist) and "Tag the images" (`vX.Y.Z` and `prod`, same digests) · covers FR-7, FR-8, FR-9 · verify: actionlint clean
  - Done: `release.yml` stage 1 checks the tag is `vX.Y.Z` on `main`, the commit has a green stage release (GitHub API) and its `sha-<12>` images exist; stage 2 adds the `vX.Y.Z` tag to the same images. Not done: a moving `prod` image tag (it would go stale after a rollback; the server's `status` says what runs). Checked: actionlint, and each check run by hand against real commits and images.
- [x] **T4** [xove] `release.yml`: "Deploy production" (production's key), "Check production" (from the internet), and "Roll back production" (runs when the check fails, and alone from the "Run workflow" button) · covers FR-10, FR-11, FR-12 · verify: actionlint clean; review that the button and the failed check run the same job
  - Done: "Deploy production" (production's key from `deploy-ssh-prod`), "Check production" (page and `/api/health` from the internet, 2 minutes), "Roll back production" (runs when the check fails, or alone from the "Run workflow" button on `main`; then checks the site again). The button and the failed check run the same job. Checked: actionlint; the site check fails on today's "coming soon" page, as it should.
- [x] **T5** [xove] `release.yml`: GitHub Release (pre-release for `v0.0.x`) and Discord notification for every result · covers FR-13 · verify: actionlint clean
  - Done: GitHub Release with generated notes after a passing check (pre-release for `v0.0.x`); Discord for every result (released, failed and rolled back, failed deploy, refused, manual rollback). Checked: actionlint.
- [x] **T6** Docs: `deployment.md`, `pipeline.md`, `operations.md`, a new decision in `decisions.md`, `CLAUDE.md`; nothing says to deploy production by hand · covers FR-15 · verify: review
  - Done: `deployment.md` (environments table, "Production releases", staging-only manual deploys), `pipeline.md` (the three pipelines, when each runs, failures, secrets), `operations.md` (production's secrets, security updates, no manual production deploys), decision 30, `CLAUDE.md` facts. Also in `infra`: the `xove.app` proxy site with the `www` redirect, and a CI step that checks the proxy's sites are valid.
- [x] **T7** Review every AC (`/review`) · verify: no gaps left
  - Done: review found no blocker. Fixed: Discord messages for a failed check whose rollback failed, time limits on every job, the staging check counts only green stage releases of `main` pushes, docs. Left for Henrique: the rollout order (see the PR) and an optional GitHub Environment for production's key.
- [x] **T8** Rollout · covers FR-1, FR-3, FR-6 · verify: AC-1 to AC-13 written in the PR:
  1. Merge the `infra` PR; on the VPS: `git pull`, add production's public key to `authorized_keys` (`command="/srv/infra/ops/deploy.sh xove prod",restrict`), install the update settings, `ops/build-env prod --check`.
  2. Merge the `xove` PR; tag `v0.0.1`; the production release goes green (AC-6).
  3. Small `infra` PR: the real `xove.app` site and the `www` redirect in the proxy; merge, reload the proxy (AC-1).
  4. Check AC-2 to AC-5, AC-8 and AC-11.
  5. Tag `v0.0.2`, run "Roll back production" by hand, `v0.0.1` is back (AC-9); tag a commit whose stage release didn't pass (AC-7).
  6. End with `v0.0.1` live (AC-13).
  - Done 2026-09-29, in this order (the proxy had to point at production before the first tag, since the release checks xove.app from the internet):
    1. infra#6 merged, `git pull` on the VPS, `build-env prod --check` resolves 15 values; production's key added with `restrict`; each key reaches only its own environment (AC-8). The new key had Windows line endings, so both pipelines now strip them.
    2. Security updates installed and enabled (AC-11).
    3. xove#82 merged (plus a Jackson 3.1.6 fix for a new CVE); the proxy reloaded; `www.xove.app` redirects (AC-1).
    4. `v0.0.1` released through the pipeline, all stages green, GitHub pre-release, Discord ✅ (AC-6). The version tag had a different digest than staging's image (same image inside); fixed in xove#83, and `v0.0.2` then had the exact same digest.
    5. `v0.0.2` released, then the "Run workflow" button rolled production back to `v0.0.1` in about 15 seconds (AC-9); a tag on a commit that isn't on `main` (`v0.0.3`, deleted afterwards) failed at stage 1 and changed nothing (AC-7).
    6. `v0.0.1` is live; Henrique signed in, and other people signed in, shared and watched on xove.app (AC-2, AC-3, AC-13); staging kept working (AC-5).
  - Follow-up: #84 (show which version is live; the rollback's Discord message shows the commit the button ran on).

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
