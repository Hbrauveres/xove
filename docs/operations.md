# Operations

Day-to-day checks and fixes on a server running Xovê. Commands run from the environment's checkout on the server unless said otherwise.

## Is it up?

```bash
ops/deploy.sh status          # running version, last deploys, containers
ops/healthcheck.sh 10         # api and web answer?
docker compose ps             # every container, restarts, health
```

From anywhere: `https://<environment host>/api/health` answers `{"status":"UP"}` (staging needs its gate passed first).

## Logs

```bash
docker compose logs --tail 100 -f api      # or web, db, livekit
docker compose logs --since 30m api
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
| Sign-in ends on `/?error=login-failed` | The API refused the Google login | `docker compose logs api \| grep "login failed"` shows why. Often a stale session in the browser: try a private window |
| "Video offline" in the room | The API has no LiveKit settings, or can't sign tokens | Check `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `.env` (secret ≥ 32 characters), then `docker compose up -d api` |
| "Loading X's screen…" forever | The sharer's video can't reach LiveKit, or LiveKit's webhooks don't reach the API | Anyone can take over the screen. `docker compose logs livekit \| grep webhook` should show `sent webhook`; errors there, or `webhook refused` in the API logs, mean the URL or the key pair is wrong. If video never arrives for anyone, check that LiveKit's media ports are open in every firewall |
| Video works on Wi-Fi but not on mobile data | UDP media blocked somewhere | Check the server's firewall and the provider's panel for the LiveKit UDP and TCP media ports |
| Deploy failed in the pipeline | New version unhealthy; the server already rolled back | Read the deploy step's log (it includes the container logs), fix forward |
| Pipeline's vulnerability scan fails on a PR that changed nothing related | A new CVE was published for a dependency | Follow the [vulnerability policy](pipeline.md#vulnerability-policy) |
| A container restarts in a loop | Crash on boot | `docker compose logs --tail 200 <service>` |

## Restarting and updating

```bash
ops/deploy.sh deploy <commit-sha>          # move to another published version (rebuilds the settings first)
ops/deploy.sh rollback                     # back to the previous deploy
```

For compose commands by hand in an environment's checkout, point Compose at the generated settings first:

```bash
export COMPOSE_ENV_FILES=/srv/infra/generated/stage.env,.deploy/image.env
docker compose restart api                 # restart one service
docker compose up -d                       # apply changed settings (a restart doesn't re-read them)
```

## Database

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
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

- **Public settings** live in git, in the private `infra` repo: `config/<env>.yaml` (`platform` for the shared proxy, `stage`, `prod`, `dev`), grouped by service. A secret appears there only as a 1Password reference, `op://<vault>/<item>/<field>`; CI refuses a plain value for any key ending in `_SECRET`, `_PASSWORD`, `_TOKEN`, `_HASH`, `_COOKIE` or `_KEY`.
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
| `livekit-stage` | Xove App | `username` (API key), `password` (API secret) | LiveKit, API |
| `stage-gate` | Xove App | `password`, `hash`, `cookie` | You (the gate prompt), the proxy |
| `postgres-dev`, `livekit-dev` | Xove App | as above | Local development only |
| `deploy-ssh` | Xove CI | SSH private key, `host`, `port`, `user`, `known-hosts` | Stage release |
| `discord-webhook` | Xove CI | `password` (the URL) | Stage release |
| `op-token xove-server`, `op-token xove-ci` | Henrique's own vault | the service account tokens | Kept to re-create them; in use on the server and in GitHub |

Also outside the vaults' reach: the server's GHCR read token (in Docker's login on the server, a copy in Henrique's vault) and the SSH keys Henrique uses himself. Production's items are added with production (#46).

## Rotating a secret

1. Change it in 1Password.
2. On the server: `cd /srv/infra && ops/build-env <env>` (or `platform` for the proxy).
3. Restart what uses it: `ops/deploy.sh deploy <current sha>` for the app, `docker compose up -d` in `infra/proxy` for the proxy.

Specific cases:

- **LiveKit key pair:** the API and LiveKit read the same pair, so both restart; people in the room reconnect.
- **Database password:** also change it inside PostgreSQL (`ALTER USER … PASSWORD …`) before rebuilding and restarting the API.
- **Google client secret:** create the new secret in the Google console first; keep the old one until the API runs with the new one.
- **Staging gate password:** put the new password in `stage-gate`, its bcrypt hash in `hash` (`docker compose exec caddy caddy hash-password` in `infra/proxy`), then rebuild `platform` and restart the proxy.
- **Pipeline deploy key:** add the new public key on the server, replace the key in `deploy-ssh`, run a deploy, then remove the old public key.
- **A service account token:** create a new token in 1Password, replace `~/.config/op/token` (server) or the `OP_SERVICE_ACCOUNT_TOKEN` Actions secret (pipeline), then revoke the old one.

## Server hardening in place

SSH with keys only on a non-default port, no root login, fail2ban, a host firewall plus the provider's firewall, and no container ports published except the reverse proxy and LiveKit's media. Automatic security updates are planned before production opens to members.
