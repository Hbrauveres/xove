# Production environment and release from a tag — plan

- Spec: [spec.md](spec.md) (approved 2026-09-29)
- Status: Approved (2026-09-29)

## Approach

**Production is staging's twin, with its own values.** The app's `compose.yaml` doesn't change: it already names containers after the environment (`xove-prod-api`, `xove-prod-web`, `xove-prod-db`) and takes every value from settings. Production gets its own settings in `infra/config/prod.yaml` and its own vault items. The deploy tool already handles `xove prod`, so production gets its own database volume (`xove-prod_db_data`) and joins the proxy's `web` network like staging. LiveKit is already running for production since #44 and already sends its events to `xove-prod-api`.

**A separate pipeline for production: `release.yml`, "Production release".** It runs when a tag `vX.Y.Z` is pushed, and has these stages:

1. **Check the release.** The tag looks like `vX.Y.Z` and is on a `main` commit. The stage release for that commit finished green, so its images were built, tested and ran on staging. Its `sha-<12>` images are in the registry.
2. **Tag the images.** The images get the tags `vX.Y.Z` and `prod` in the registry. This isn't a rebuild: they're the same images (same digests).
3. **Deploy production.** SSH with production's own key sends `deploy <commit>`. On the server, the same tool as staging runs: it builds the settings, runs the checks, waits until healthy, and rolls back by itself if the new version isn't healthy.
4. **Check production.** From the internet: `https://xove.app` loads, and `https://xove.app/api/health` says `UP`. It tries for up to 2 minutes.
5. **Roll back production.** Runs only if the check fails. It sends `rollback` with the same key, and the server puts back the version that ran before.
6. **GitHub Release.** Only when everything passed: a release named after the tag, with notes of what changed. `v0.0.x` versions are marked as pre-releases.
7. **Notify Discord.** Every result, success or failure.

The same workflow has a **"Run workflow" button** (manual run) that does only stage 5, "Roll back production", then notifies Discord. That's the manual rollback.

**Rollback means "the version that ran before"**, read from the server's deploy history, as it works on staging today. Right after a release, that's the previous release.

**Production's key can only deploy production.** A new key pair: its public key goes in the VPS's `authorized_keys` with `command="/srv/infra/ops/deploy.sh xove prod",restrict`, and its private key goes in the `Xove CI` vault. Staging's key stays bound to `xove stage`.

**The proxy.** In `infra/proxy/sites/xove.caddy`, "coming soon" is replaced by the real site: `/api/*` goes to `xove-prod-api:8080`, everything else to `xove-prod-web:80`. There's no password and no `noindex`. `www.xove.app` redirects to `xove.app`.

**Security updates.** Ubuntu's `unattended-upgrades` installs security updates only, and restarts the server at 04:00 when an update needs it. Every container has `restart: unless-stopped`, so everything comes back after the restart. The settings file is kept in `infra` (`host/apt/`) so the server's setup is written down.

### Alternatives considered

- **Add production to the stage release** (one pipeline for both): rejected. You asked for a separate production pipeline, and it keeps "stage" out of production's names.
- **Rebuild the images for production:** rejected. Production must run exactly what staging tested.
- **Roll back to a chosen tag** (the button asks which version): rejected for now. "The version before" covers launch, with less to get wrong.
- **One deploy key for both environments:** rejected. A leaked key could then change production.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Pipeline | `xove/.github/workflows/release.yml` (new) | "Production release": the stages above, on `v*` tags, plus the manual rollback |
| Config | `infra/config/prod.yaml` | Adds the `app` and `db` groups: `APP_ENV: prod`, `LIVEKIT_ROOM: xove`, `ADMIN_EMAILS`, `GOOGLE_CLIENT_ID` (public), `GOOGLE_CLIENT_SECRET` and `POSTGRES_PASSWORD` (vault references), `POSTGRES_DB`, `POSTGRES_USER` |
| Proxy | `infra/proxy/sites/xove.caddy` | The real site plus the `www` redirect |
| Server | `infra/host/apt/52xove-unattended-upgrades` (new) + `infra/README.md` | Security updates only; automatic restart at 04:00 |
| Docs | `xove/docs/deployment.md`, `pipeline.md`, `operations.md`, `decisions.md`, `CLAUDE.md` | How production is set up, released and rolled back; no manual deploy |
| API, web, database | — | None |

## API and data

- No code or API changes.
- Production starts with an empty database; Flyway creates the tables on the first start.

**New secrets and settings (names only):**

| Where | Name | What it is |
| --- | --- | --- |
| Vault `Xove App` | `google-oauth-prod` | The secret of production's new Google OAuth client |
| Vault `Xove App` | `postgres-prod` | Production's database password (new, random) |
| Vault `Xove CI` | `deploy-ssh-prod` | Production's deploy key (private key; host, port, user and known-hosts like `deploy-ssh`) |
| `infra/config/prod.yaml` | `GOOGLE_CLIENT_ID` | Public ID of the new Google OAuth client, whose redirect address is `https://xove.app/api/login/oauth2/code/google` |
| DNS | `www.xove.app` | A record pointing at the VPS, like `xove.app` |

## Risks

- **Pressing rollback twice goes forward again.** The server's rollback goes to "the version before the current one", so after one rollback, the next one returns to the version that was just rolled back. Mitigated by the docs: to go further back, tag an older commit.
- **Google login in "Testing" mode.** Only accounts added by hand can sign in until the Google project is switched to "In production". This is a rollout step, needed before #47.
- **Proxy changed before production runs** would show an error page on `xove.app`. Mitigated by the order: deploy `v0.0.1` first, then switch the proxy.
- **Two databases on one small VPS.** Memory limits are already set in the compose file (API 512 MB, database 256 MB each). Worth watching after launch.
- **A night restart** takes the site offline for about a minute. Accepted.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | Open `xove.app` and `www.xove.app` | manual |
| AC-2 | Sign in, admin page, a second account requests, is approved, shares, you watch | manual |
| AC-3 | The browser connects to `rtc.xove.app` room `xove`; `docker logs livekit-prod` shows the join | manual |
| AC-4 | Review of `config/prod.yaml` (only `-prod` items); production's users aren't on staging | review + manual |
| AC-5 | `stage.xove.app` still asks for its password and works | manual |
| AC-6 | Tag `v0.0.1`: pipeline green, same digests as the stage release, GitHub Release, Discord ✅ | manual |
| AC-7 | Tag a commit whose stage release didn't pass: stage 1 fails, production unchanged, Discord ❌ | manual |
| AC-8 | Production's key asking for `xove stage`, and staging's key for `xove prod`: both refused | manual |
| AC-9 | After `v0.0.2`, run the rollback by hand: `v0.0.1` is back | manual |
| AC-10 | Review: the rollback job runs when "Check production" fails, and it's the same job the button runs | review |
| AC-11 | `systemctl status unattended-upgrades` and its log | manual |
| AC-12 | Review of the docs | review |
| AC-13 | At the end, `v0.0.1` is live through the pipeline | manual |

## Rollout

1. **You, outside the repo:** create the Google OAuth client and the vault items `google-oauth-prod`, `postgres-prod` and `deploy-ssh-prod`; add the `www` DNS record.
2. **`infra` PR:** production's config, the proxy site (kept on "coming soon" until step 5), and the update settings. Merge, then `git pull` on the VPS.
3. **On the VPS (you):** add production's key to `authorized_keys`; turn on `unattended-upgrades` with the file from `infra`; `ops/build-env prod --check`.
4. **`xove` PR:** `release.yml` and the docs. Merge (staging deploys as usual).
5. **First release:**
   - Tag `v0.0.1`, and production comes up.
   - Switch the proxy to the real site, then check AC-1 to AC-5.
   - Tag `v0.0.2`, run the rollback (AC-9), then test the refused tag (AC-7).
   - End with `v0.0.1` live (AC-13).
6. **Undoing it:** put "coming soon" back in the proxy; production's containers can stay stopped.

## Decided trade-offs

Decided with Henrique on 2026-09-29:

1. **The automatic rollback isn't tested with a real failure.** It runs the same job as the manual rollback, which AC-9 proves by hand; a review checks that the job runs when the check fails (AC-10).
