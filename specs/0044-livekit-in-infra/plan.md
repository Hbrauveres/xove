# LiveKit in infra, one server per environment — plan

- Spec: [spec.md](spec.md) (approved 2026-09-28)
- Status: Approved (2026-09-28); written on top of #43's settings and decision #26

## Approach

**Two LiveKit servers from one definition in `infra`.** `infra/livekit/compose.yaml` defines LiveKit once. Everything that differs per environment comes from that environment's generated settings (#43): `/srv/infra/generated/<env>.env`, built by `ops/build-env <env>` from `infra/config/<env>.yaml` and the `Xove App` vault. Each environment runs as its own Compose project:

```bash
cd /srv/infra/livekit
docker compose -p livekit-stage --env-file /srv/infra/generated/stage.env up -d
docker compose -p livekit-prod  --env-file /srv/infra/generated/prod.env  up -d
```

Separate projects mean separate containers, key pairs, configs and restarts. The env file is only used for interpolation: the container receives just `LIVEKIT_KEYS` and `LIVEKIT_CONFIG`, never the environment's other secrets.

**One key pair per environment, one source.** The app and its LiveKit already read the same `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` from `config/<env>.yaml` → vault (`livekit-stage`, and a new `livekit-prod`). Moving LiveKit doesn't duplicate anything: both sides still read the one generated file of their environment.

**Config stays in `LIVEKIT_CONFIG`.** Same technique as today (LiveKit needs `webhook.api_key` in its config and can't read variables from a file; verified in spec 0038), moved as is into `infra/livekit/compose.yaml`, with per-environment values:

| | Staging | Production |
| --- | --- | --- |
| Compose project / container | `livekit-stage` | `livekit-prod` |
| Public address | `rtc-stage.xove.app` (unchanged) | `rtc.xove.app` (new) |
| Media ports (TCP fallback / UDP) | 7881 / 7882 (unchanged) | 7883 / 7884 (new) |
| Key pair (vault) | `livekit-stage` (unchanged) | `livekit-prod` (new) |
| Webhook URL | `http://xove-stage-api:8080/api/livekit/webhook` | `http://xove-prod-api:8080/api/livekit/webhook` |
| Room (app setting) | `xove-stage` | `xove` |

The production server listens on 7883/7884 inside the container too (not just a host mapping), because LiveKit advertises the ports it listens on to browsers.

**Reaching each other.** Caddy reaches both servers over the shared `web` network by container name, and each LiveKit calls its own API by container name over `web`. Separation between environments rests on the key pairs: the other environment's API refuses a webhook signed with a key it doesn't know, and a server refuses tokens signed with another key (AC-4). One network per environment was considered and left out: too much setup for one VPS (Henrique, 2026-09-28).

**The app keeps only settings (decision #26).** `xove/compose.yaml` loses the `livekit` service; the API gains `LIVEKIT_ROOM`. `application.yml` reads `room: ${LIVEKIT_ROOM:xove}`. As an extra safeguard, the webhook controller ignores events for any room other than its own (AC-5).

### Alternatives considered

- **One LiveKit for both environments, isolated by tokens.** Rejected by the spec: LiveKit keys aren't tied to rooms, so a leaked staging secret could reach production.
- **Both servers in one Compose project.** Rejected: applying staging would touch production, and one project would need both key pairs.
- **A compose file per environment.** Rejected: the same definition twice; only values differ, and those live in `config/`.
- **`env_file:` in the LiveKit compose** (like the proxy). Rejected: it would hand the container every setting of the environment (database password, Google secret); `--env-file` only fills in what the service declares.
- **Mapping production's host ports 7883/7884 to the container's 7881/7882.** Rejected: LiveKit would advertise 7881/7882 and browsers would connect to staging's ports.
- **One Docker network per environment.** Rejected for now (see above).

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| API | `application.yml` | `room: ${LIVEKIT_ROOM:xove}` |
| API | `livekit/LiveKitWebhookController.java` | Ignore events whose `room.name` isn't the configured room (one debug log line) |
| App | `xove/compose.yaml` | Remove the `livekit` service (and its `internal` network membership); the API gets `LIVEKIT_ROOM: ${LIVEKIT_ROOM:-xove}` |
| Infra | `infra/livekit/compose.yaml` (new) | LiveKit once: container `livekit-${LIVEKIT_ENV:?}`, `LIVEKIT_KEYS` from the pair, `LIVEKIT_CONFIG` with ports `${LIVEKIT_TCP_PORT:?}`/`${LIVEKIT_UDP_PORT:?}` (published and listened on), webhook `${LIVEKIT_WEBHOOK_URL:?}` signed with `${LIVEKIT_API_KEY:?}`, network `web` |
| Infra | `infra/config/stage.yaml` | `livekit`: add `LIVEKIT_ENV: stage`, ports 7881/7882, the staging webhook URL; `app`: add `LIVEKIT_ROOM: xove-stage` |
| Infra | `infra/config/prod.yaml` (new) | Only the `livekit` group for now: `LIVEKIT_ENV: prod`, `LIVEKIT_URL: wss://rtc.xove.app`, ports 7883/7884, the production webhook URL, the pair from `livekit-prod`. The app's groups come with #46 |
| Infra | `infra/proxy/sites/rtc-stage.caddy` | Upstream `livekit-stage:7880` (was `xove-stage-livekit:7880`) |
| Infra | `infra/proxy/sites/rtc.caddy` (new) | `rtc.xove.app` → `livekit-prod:7880` |
| Infra | `infra/.github/workflows/checks.yml` | `docker compose config` of `livekit/compose.yaml` with a dummy env file, asserting the container gets only `LIVEKIT_KEYS` and `LIVEKIT_CONFIG` |
| Infra | `infra/README.md` | `livekit/` and its two commands |
| Docs | `xove/docs/architecture.md`, `operations.md`, `deployment.md`, `getting-started.md`, `CLAUDE.md` | LiveKit runs from `infra`, one per environment; logs with `docker logs livekit-stage`; local dev keeps its own dev server |
| Database | — | None |

## API and data

No endpoint changes. `POST /api/livekit/token` returns the configured room. `POST /api/livekit/webhook` answers 200 and changes nothing for another room's events.

**Settings and secrets**

| Name | Where | Notes |
| --- | --- | --- |
| `LIVEKIT_ENV`, `LIVEKIT_TCP_PORT`, `LIVEKIT_UDP_PORT`, `LIVEKIT_WEBHOOK_URL` | `infra/config/<env>.yaml`, group `livekit` | Public, in git |
| `LIVEKIT_ROOM` | `infra/config/<env>.yaml`, group `app` | Public; optional in the app (default `xove`) |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | vault `Xove App`: `livekit-stage` (exists), `livekit-prod` (new) | Staging's pair is unchanged; production's is generated with `livekit-server generate-keys` and stored straight in the vault |

## Risks

- **Video down during the switch** (a few minutes, accepted by the spec): the `xove` deploy removes the old LiveKit container (`--remove-orphans`), and video is back when `livekit-stage` starts from `infra`.
- **Port conflict on rollback:** rolling `xove` back to a commit with LiveKit in its compose needs `livekit-stage` stopped first, since both want 7881/7882. The rollback steps say so.
- **Firewall:** 7883/tcp and 7884/udp must be opened in ufw and in Hostinger's panel. AC-7 checks the address, and a CLI join in AC-4 checks the media path.
- **Webhooks to a production API that doesn't exist yet:** `livekit-prod` retries and logs failures until #46. Harmless.
- **`prod.yaml` is partial** until #46: `build-env prod` works (only the LiveKit values), and the app can't be started for production by mistake because its required settings are missing (`${VAR:?}` in `xove/compose.yaml`).

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `git grep -n -i "livekit-server\|LIVEKIT_CONFIG\|7882"` in `xove` finds only docs | manual, in the PR |
| AC-2 | Two browsers on staging: share, watch with sound, close the tab, stage frees within 10 s | manual |
| AC-3 | `LiveKitControllerTest#usesTheConfiguredRoom` (room `xove-test`), `LiveKitTokensTest` room claim | web layer / unit |
| AC-4 | LiveKit CLI: join `rtc.xove.app` with a staging-signed token → refused; join `rtc-stage.xove.app` with a production-signed token → refused; each with its own key → joins | manual, in the PR |
| AC-5 | Config review (each webhook URL) + staging logs of a join and leave; `LiveKitWebhookControllerTest#ignoresEventsFromAnotherRoom` | manual + web layer |
| AC-6 | `docker ps --format '{{.Names}} {{.Ports}}'` and `ss -lntu` on the VPS | manual, in the PR |
| AC-7 | `curl https://rtc.xove.app` answers `OK` with a valid certificate | manual |
| AC-8 | Docs reviewed in both PRs | review |

Before the PRs, a local run: both LiveKit projects from `infra/livekit/compose.yaml` with dummy env files plus this branch's API, checking that each server starts on its own ports, that a webhook from `livekit-stage` reaches the API, and the AC-4 token checks.

## Rollout

Two PRs, `infra` first (it changes nothing on the server until applied), then `xove`. Henrique does the VPS steps; #69 automates them later.

1. **Prepare** (Henrique): DNS A record `rtc` → the VPS; open 7883/tcp and 7884/udp in ufw and the Hostinger panel; generate the production key pair and store it in the vault as `livekit-prod`.
2. **Merge the `infra` PR**, then on the VPS: `cd /srv/infra && git pull && ops/build-env stage && ops/build-env prod`. Don't start anything yet.
3. **Merge the `xove` PR.** The stage release deploys the API with room `xove-stage` (from the rebuilt `stage.env`) and removes the old LiveKit container. Video is down from here.
4. **Start staging video:** `cd /srv/infra/livekit && docker compose -p livekit-stage --env-file /srv/infra/generated/stage.env up -d`, then `docker compose up -d --force-recreate` in `infra/proxy` (new sites). Video is back. Run AC-2.
5. **Start production video:** `docker compose -p livekit-prod --env-file /srv/infra/generated/prod.env up -d`. Run AC-4, AC-6, AC-7.
6. **Rollback:** `docker compose -p livekit-stage --env-file /srv/infra/generated/stage.env down` in `infra/livekit`, then `ops/deploy.sh rollback` in `/srv/apps/xove-stage` (the previous commit brings its own LiveKit back), and revert the proxy sites.
