# Operations

Day-to-day checks and fixes on a server running Xovê. There's no checkout of this repo on the server: deploys run from the `infra` repo (`/srv/infra/ops/deploy.sh xove <env> …`), and containers are named `xove-<env>-<service>` (`xove-stage-api`).

## Is it up?

```bash
/srv/infra/ops/deploy.sh xove stage status     # running version, last deploys, containers
ls -t /srv/infra/state/xove-stage/logs | head   # the output of recent deploys and rollbacks
docker ps --filter name=xove-stage              # every container, restarts, health ("healthy" comes from compose.yaml)
```

From anywhere: `https://<environment host>/api/health` answers `{"status":"UP"}` (staging needs its gate passed first).

## Logs

```bash
docker logs --tail 100 -f xove-stage-api   # or xove-stage-web, xove-stage-db
docker logs --tail 100 -f livekit-stage    # LiveKit runs from infra: livekit-stage, livekit-prod
docker logs --since 30m xove-stage-api
```

What to look for:

| Service | Useful lines |
| --- | --- |
| api | `Started XoveApiApplication`, Flyway `Migrating schema`, `Google login failed: …` (the reason a sign-in was refused), `slot freed: user 12 left (PA_…)` (LiveKit freed the screen), `webhook refused: …` (a webhook with a bad signature), stack traces |
| livekit | `starting LiveKit server` with the public IP it found, participant joins and leaves, `sent webhook` for each event sent to the API |
| db | `database system is ready to accept connections` |
| web | Caddy access log: one JSON line per request |

## Common problems

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Sign-in ends on `/?error=login-failed` | The API refused the Google login | `docker logs xove-stage-api 2>&1 \| grep "login failed"` shows why. Often a stale session in the browser: try a private window |
| "Video offline" in the room | The API has no LiveKit settings, or can't sign tokens | Check the `livekit` group of `infra/config/<env>.yaml` and the `livekit-<env>` vault item (secret ≥ 32 characters), then redeploy the app |
| "Loading X's screen…" forever | The sharer's video can't reach LiveKit, or LiveKit's webhooks don't reach the API | Anyone can take over the screen. `docker logs livekit-stage \| grep webhook` should show `sent webhook`; errors there, or `webhook refused` in the API logs, mean the URL or the key pair is wrong. If video never arrives for anyone, check that LiveKit's media ports are open in every firewall |
| Video works on Wi-Fi but not on mobile data | UDP media blocked somewhere | Check the server's firewall and the provider's panel for the LiveKit UDP and TCP media ports |
| Deploy failed in the pipeline | New version unhealthy; the server already rolled back | Read the deploy step's log (it includes the container logs), fix forward |
| Deploy refused, "isn't on the app's main branch" | The commit isn't on `main` (a branch, a fork) | Merge it first; only `main` deploys |
| Deploy refused, "breaks the rules above" | `compose.yaml` uses something `infra/ops/check-compose` doesn't allow (another image, a host mount, a new key…) | Change `compose.yaml`, or allow it in `infra` if it's safe |
| Stage release cancelled during the deploy | The server keeps going: the deploy may have finished, but the images weren't marked `:stage` | `status` on the server; re-run the stage release if needed |
| Deploy refused, "nothing was changed" (exit 3) | GitHub, the registry or 1Password didn't answer, or another deploy was running | Re-run the whole stage release (its images were kept) |
| Deploy failed, "running: unknown" in `status` | The deploy and its rollback both failed, or there was no version to go back to | Read the logs, then deploy a version that works: `deploy <sha>` |
| Pipeline's vulnerability scan fails on a PR that changed nothing related | A new CVE was published for a dependency | Follow the [vulnerability policy](pipeline.md#vulnerability-policy) |
| A container restarts in a loop | Crash on boot | `docker logs --tail 200 xove-<env>-<service>` |

## Restarting and updating

```bash
/srv/infra/ops/deploy.sh xove stage deploy <commit-sha>   # move to another published version (rebuilds the settings first)
/srv/infra/ops/deploy.sh xove stage rollback              # back to the previous deploy
docker restart xove-stage-api                             # restart one container as it is
```

Changed settings or secrets need a redeploy of the running version (`deploy <current sha>`): a restart doesn't re-read them.

**Rolling back past the LiveKit move.** The deploy tool refuses versions from before [spec 0044](../specs/0044-livekit-in-infra/spec.md): their `compose.yaml` still starts its own LiveKit on 7881/7882, which `livekit-stage` (from `infra`) now holds. If one is ever needed, it's a manual job: stop `livekit-stage`, run that version's compose file by hand as project `xove-stage`, and point `rtc-stage.caddy` back at `xove-stage-livekit:7880`.

## Database

```bash
docker exec -it xove-stage-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Useful queries:

```sql
select email, status, created_at from users order by created_at;
select u.email, r.status, r.created_at from access_requests r join users u on u.id = r.user_id order by r.created_at desc limit 20;
select count(*) from spring_session;
```

Change data through the app (admin page) rather than by hand, so the rules (sessions ended on removal, one pending request per user) still apply.

**Backups (planned):** a nightly `pg_dump` per environment, kept 14 days, with a copy off the server and a tested restore.

## Settings and secrets

Nobody writes a `.env` by hand. Each environment's settings are built from two sources ([spec 0043](../specs/0043-secrets-vault/spec.md), decisions 25 and 27):

- **Public settings** live in git, in the private `infra` repo: `config/<env>.yaml` (`platform` for the shared proxy, `stage`, `dev`; `prod` arrives with production, #46), grouped by service. A secret appears there only as a 1Password reference, `op://<vault>/<item>/<field>`; CI refuses a plain value for any key ending in `_SECRET`, `_PASSWORD`, `_TOKEN`, `_HASH`, `_COOKIE` or `_KEY`.
- **Secrets** live only in 1Password, in two vaults:

| Vault | Holds | Read by |
| --- | --- | --- |
| `Xove App` | Everything the running services need (per environment), plus the throwaway dev values | The server, with the service account `xove-server` (read only, this vault only) |
| `Xove CI` | What the pipeline needs to deploy and notify | The stage release, with the service account `xove-ci` (read only, this vault only) |

`infra/ops/build-env <env>` resolves the references and writes `/srv/infra/generated/<env>.env` (`chmod 600`, never committed). If anything is missing, it names the key and keeps the previous file. On the server it authenticates with `~/.config/op/token`; `ops/deploy.sh` runs it before every deploy and rollback. Locally, `eval "$(../infra/ops/build-env dev --export)"` loads the dev values into one terminal ([getting started](getting-started.md#settings-from-1password)).

### Secrets inventory

| Item | Vault | Fields | Used by |
| --- | --- | --- | --- |
| `google-oauth-stage` | Xove App | `password` (client secret) | API (staging and local dev) |
| `postgres-stage` | Xove App | `password` | db, API |
| `livekit-stage` | Xove App | `username` (API key), `password` (API secret) | Staging's LiveKit and API |
| `livekit-prod` | Xove App | `username` (API key), `password` (API secret) | Production's LiveKit (and its API, from #46) |
| `stage-gate` | Xove App | `password`, `hash`, `cookie` | You (the gate prompt), the proxy |
| `postgres-dev`, `livekit-dev` | Xove App | as above | Local development only |
| `deploy-ssh` | Xove CI | SSH private key, `host`, `port`, `user`, `known-hosts` | Stage release |
| `discord-webhook` | Xove CI | `password` (the URL) | Stage release |
| `ghcr-read-token` | Xove App | `password` (GitHub token, `read:packages` only) | The server's `docker login ghcr.io`, to pull the app's images |
| `op-token xove-server`, `op-token xove-ci` | Henrique's own vault | the service account tokens | In use on the server and in GitHub. Kept outside the Xove vaults on purpose: they're the keys to those vaults |

Henrique's own SSH keys stay in his own vault. Production's items are added with production (#46).

## Rotating a secret

1. Change it in 1Password.
2. On the server: `cd /srv/infra && ops/build-env <env>` (or `platform` for the proxy).
3. Restart what uses it: `/srv/infra/ops/deploy.sh xove <env> deploy <current sha>` for the app, `docker compose up -d` in `infra/proxy` for the proxy.

Specific cases:

- **LiveKit key pair:** the API and its LiveKit read the same pair from `livekit-<env>`. After rebuilding the settings, redeploy the app and restart that LiveKit: `docker compose -p livekit-<env> --env-file /srv/infra/generated/<env>.env up -d` in `infra/livekit`. People in the room reconnect.
- **Database password:** also change it inside PostgreSQL (`ALTER USER … PASSWORD …`) before rebuilding and restarting the API.
- **Google client secret:** create the new secret in the Google console first; keep the old one until the API runs with the new one.
- **Staging gate password:** put the new password in `stage-gate`, its bcrypt hash in `hash` (`docker compose exec caddy caddy hash-password` in `infra/proxy`), then rebuild `platform` and restart the proxy.
- **Pipeline deploy key:** add the new public key on the server, replace the key in `deploy-ssh`, run a deploy, then remove the old public key.
- **A service account token:** create a new token in 1Password, replace `~/.config/op/token` (server) or the `OP_SERVICE_ACCOUNT_TOKEN` Actions secret (pipeline), then revoke the old one.

## Server hardening in place

SSH with keys only on a non-default port (enforced by `/etc/ssh/sshd_config.d/00-keys-only.conf`: Ubuntu's `50-cloud-init.conf` had turned password logins back on, and sshd keeps the first value it reads), no root login, fail2ban (its `sshd` jail is overridden in `/etc/fail2ban/jail.d/sshd.local` to watch `ssh.service` and ban on the real SSH port; the Ubuntu defaults watched `sshd.service` and port 22, so it caught nothing until 2026-09-28), a host firewall plus the provider's firewall (ports published by Docker, like LiveKit's media ports, bypass the host firewall, so the provider's firewall is the one that decides for them), and no container ports published except the reverse proxy and LiveKit's media. Automatic security updates are planned before production opens to members.
