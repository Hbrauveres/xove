# LiveKit in infra, one server per environment — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes. The repo each task changes is in brackets; tasks marked **Henrique** are done by hand outside the repos.

- [x] **T1** [xove] The room comes from `LIVEKIT_ROOM` (`application.yml`: `room: ${LIVEKIT_ROOM:xove}`) · covers FR-3 · verify: `LiveKitControllerTest#usesTheConfiguredRoom` (a non-default room reaches the browser and the token), `./mvnw test`
  - Done: `application.yml` reads `room: ${LIVEKIT_ROOM:xove}`; new `LiveKitRoomSettingTest#usesTheConfiguredRoom` checks the room in the response and in the token's `video.room` claim. API 91/91.
- [x] **T2** [xove] The webhook ignores events for any room other than its own (one debug log line) · covers FR-4, FR-5 · verify: `LiveKitWebhookControllerTest#ignoresEventsFromAnotherRoom` (a valid, signed `participant_left` for the sharer from another room changes nothing); the existing webhook tests still pass
  - Done: `LiveKitWebhookController` reads `room.name` and ignores events from any other room (or none), with one debug line; new `LiveKitWebhookControllerTest#ignoresEventsFromAnotherRoom`. API 92/92.
- [x] **T3** [infra] `livekit/compose.yaml`: LiveKit once, container `livekit-${LIVEKIT_ENV}`, `LIVEKIT_KEYS` and `LIVEKIT_CONFIG` built from the environment's settings (ports listened on and published, webhook URL, key), network `web`, required values `${VAR:?}`; README explains it · covers FR-1, FR-2, FR-6 · verify: `checks.yml` step with a dummy env file: `docker compose config` passes, the container gets only `LIVEKIT_KEYS` and `LIVEKIT_CONFIG`, the published ports are the configured ones
  - Done: `infra/livekit/compose.yaml` (container `livekit-${LIVEKIT_ENV}`, `LIVEKIT_KEYS` + `LIVEKIT_CONFIG` from the settings, ports listened on and published from the settings, webhook URL and key, network `web`, required values `${VAR:?}`); `checks.yml` asserts the container gets only those two variables, the ports and the webhook URL, and that another secret in the settings never appears; a real LiveKit v1.13.7 started from it on TCP 7883 / UDP 7884; README explains it.
- [x] **T4** **Henrique**: DNS A record `rtc` → the VPS; open 7883/tcp and 7884/udp in ufw and the Hostinger panel; generate the production key pair (`livekit-server generate-keys`) and store it in `Xove App` as `livekit-prod` (username = key, password = secret) · covers FR-2 · verify: `dig +short rtc.xove.app` shows the VPS; `ufw status` lists both ports; the vault item exists
  - Done 2026-09-28: `rtc.xove.app` resolves to the VPS; 7883/tcp and 7884/udp open in ufw (IPv4 and IPv6) and in Hostinger's firewall; `livekit-prod` (key as username, secret as password) in `Xove App`.
- [x] **T5** [infra] Settings and sites: `config/stage.yaml` gains `LIVEKIT_ENV`, the ports, the webhook URL and `LIVEKIT_ROOM: xove-stage`; new `config/prod.yaml` with only the `livekit` group; `proxy/sites/rtc-stage.caddy` points to `livekit-stage:7880`; new `proxy/sites/rtc.caddy` for `rtc.xove.app` → `livekit-prod:7880` · covers FR-2, FR-3, FR-5 · verify: `check-config` and `caddy validate` in CI; `build-env stage --check` and `build-env prod --check` on the VPS
  - Done: `config/stage.yaml` gains `LIVEKIT_ROOM`, `LIVEKIT_ENV`, ports 7881/7882 and the webhook URL; new `config/prod.yaml` with production's LiveKit only; `rtc-stage.caddy` → `livekit-stage:7880`, new `rtc.caddy` → `livekit-prod:7880`; CI checks every LiveKit environment has what the compose file needs (and T3's leak check now really fails). `caddy validate` passes; on the VPS `build-env --check` resolves stage (15) and prod (7), including `livekit-prod`.
- [x] **T6** Local run: both LiveKit projects from `infra/livekit/compose.yaml` with dummy settings plus this branch's API; each server starts on its own ports; a join and leave on the staging server reaches the API's webhook; tokens signed for one server are refused by the other · covers FR-2, FR-4 · verify: results written in the PR (a rehearsal of AC-4 and AC-5)
  - Done (local, 2026-09-28): this branch's API as `xove-stage-api` (room `xove-stage`) plus both servers from `infra/livekit/compose.yaml` with test key pairs: staging on 7881/7882 and production on 7883/7884; a join and leave on staging reached the API (`participant_left` accepted); a room `other-room` on the same server was ignored; production refused a staging-signed token and staging a production-signed one; production accepted its own. 7/7.
- [x] **T7** [xove] `compose.yaml` drops the `livekit` service; the API gets `LIVEKIT_ROOM: ${LIVEKIT_ROOM:-xove}` · covers FR-1 · verify: AC-1 `git grep` finds no LiveKit server config outside the docs; commit checks (the validate stage doesn't need LiveKit)
  - Done: `compose.yaml` has only `web`, `api`, `db`, publishes no port, and passes `LIVEKIT_ROOM: ${LIVEKIT_ROOM:-xove}` to the API; AC-1 `git grep` finds no LiveKit server config outside docs and specs.
- [x] **T8** Docs in both repos: `architecture.md`, `operations.md`, `deployment.md`, `getting-started.md`, `CLAUDE.md`, `infra/README.md` · covers FR-7 · verify: AC-8 review
  - Done: `architecture.md` (component table, layout, webhooks per environment, a "Where LiveKit runs" paragraph, network rule), `operations.md` (LiveKit logs with `docker logs livekit-<env>`, troubleshooting, key pair rotation), `getting-started.md`, `deployment.md`, `CLAUDE.md` (counts 92/45, where LiveKit runs), decision #28; `infra/README.md` was done in T3.
- [x] **T9** Review every AC (`/review`) · verify: no gaps left
  - Done: spec-reviewer across both repos found the code meets the spec (API 92, infra 20 tests, config checks). Fixed after review: `operations.md` (one-time rollback caveat past the LiveKit move; `livekit-prod` in the inventory; Docker-published ports bypass ufw), `getting-started.md` variable table (`LIVEKIT_ROOM`, the pair's role), `infra/README.md` (`prod.yaml` now exists; addresses, ports and webhooks per server; how to check webhooks), a test for webhook events without a room (API 93). The rollout order goes in the PR as the T10 checklist.
- [ ] **T10** Rollout (Henrique, with Claude): merge `infra`; build `stage` and `prod` on the VPS; merge `xove` (the deploy removes the old LiveKit); start `livekit-stage` and recreate the proxy (AC-2, AC-5 logs); start `livekit-prod` (AC-7); token cross-checks with the LiveKit CLI (AC-4); published ports (AC-6) · covers FR-2, FR-4, FR-5, FR-6, FR-7 · verify: AC-2, AC-4, AC-5, AC-6, AC-7 written in the PR

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T3, T7 |
| FR-2 | T3, T4, T5, T6, T10 |
| FR-3 | T1, T5 |
| FR-4 | T2, T6, T10 |
| FR-5 | T2, T5, T10 |
| FR-6 | T3, T10 |
| FR-7 | T8, T10 |
| AC-1 | T7 |
| AC-2 | T10 |
| AC-3 | T1 |
| AC-4 | T6 (rehearsal), T10 |
| AC-5 | T2, T6, T10 |
| AC-6 | T10 |
| AC-7 | T10 |
| AC-8 | T8 |

Nothing uncovered. AC-2, AC-4, AC-6 and AC-7 need the real server; T6 rehearses AC-4 and AC-5 locally first.
