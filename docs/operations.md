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
| api | `Started XoveApiApplication`, Flyway `Migrating schema`, `Google login failed: …` (the reason a sign-in was refused), stack traces |
| livekit | `starting LiveKit server` with the public IP it found, participant joins and leaves |
| db | `database system is ready to accept connections` |
| web | nginx access log: one line per request |

## Common problems

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Sign-in ends on `/?error=login-failed` | The API refused the Google login | `docker compose logs api \| grep "login failed"` shows why. Often a stale session in the browser: try a private window |
| "Video offline" in the room | The API has no LiveKit settings, or can't sign tokens | Check `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `.env` (secret ≥ 32 characters), then `docker compose up -d api` |
| "Loading X's screen…" forever | The sharer left without releasing the slot (known limitation), or their video can't reach LiveKit | Anyone can take over the screen. If video never arrives for anyone, check the LiveKit logs and that its media ports are open in every firewall |
| Video works on Wi-Fi but not on mobile data | UDP media blocked somewhere | Check the server's firewall and the provider's panel for the LiveKit UDP and TCP media ports |
| Deploy failed in the pipeline | New version unhealthy; the server already rolled back | Read the deploy step's log (it includes the container logs), fix forward |
| Pipeline's vulnerability scan fails on a PR that changed nothing related | A new CVE was published for a dependency | Follow the [vulnerability policy](pipeline.md#vulnerability-policy) |
| A container restarts in a loop | Crash on boot | `docker compose logs --tail 200 <service>` |

## Restarting and updating

```bash
docker compose restart api                 # restart one service
docker compose up -d                       # apply .env or compose.yaml changes
ops/deploy.sh deploy <commit-sha>          # move to another published version
ops/deploy.sh rollback                     # back to the previous deploy
```

Changes to `.env` need `docker compose up -d` (a restart doesn't re-read it).

## Database

```bash
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Useful queries:

```sql
select email, status, created_at from users order by created_at;
select u.email, r.status, r.created_at from access_requests r join users u on u.id = r.user_id order by r.created_at desc limit 20;
select count(*) from spring_session;
```

Change data through the app (admin page) rather than by hand, so the rules (sessions ended on removal, one pending request per user) still apply.

**Backups (planned):** a nightly `pg_dump` per environment, kept 14 days, with a copy off the server and a tested restore.

## Rotating a secret

1. Generate the new value and store it in the password manager.
2. Update the environment's `.env` on the server.
3. `docker compose up -d` so the containers pick it up.

Specific cases:

- **LiveKit key pair:** the API and LiveKit read the same pair, so both restart; people in the room reconnect.
- **Database password:** also change it inside PostgreSQL (`ALTER USER … PASSWORD …`) before restarting the API.
- **Google client secret:** create the new secret in the Google console first; keep the old one until the API runs with the new one.
- **Pipeline deploy key:** add the new public key on the server, update the `DEPLOY_SSH_KEY` secret, run a deploy, then remove the old key.

## Server hardening in place

SSH with keys only on a non-default port, no root login, fail2ban, a host firewall plus the provider's firewall, and no container ports published except the reverse proxy and LiveKit's media. Automatic security updates are planned before production opens to members.
