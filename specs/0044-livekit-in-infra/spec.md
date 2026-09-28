# LiveKit in infra, one server per environment — spec

- Issue: #44
- Status: Approved (2026-09-28)
- Owner: Henrique

## Problem

The video server (LiveKit) is defined inside the app: its service, config and published media ports sit in `xove/compose.yaml`. It's infrastructure, not app code, and the app's compose file publishes ports on the server because of it. Production also needs video, fully separated from staging: a staging secret, room or event must never reach production.

## Who it's for

People in the staging and production rooms (video keeps working, and each environment is private to itself), and Henrique (the app repo only describes the app; video servers are run and updated in one place).

## Functional requirements

- **FR-1** The video servers run from the `infra` repo, on the VPS. The `xove` repo no longer defines, configures or publishes ports for LiveKit; it only needs the address, credentials and room of its environment as settings.
- **FR-2** Each environment has its own LiveKit server, with its own key pair, public address and media ports: staging at `rtc-stage.xove.app`, production at `rtc.xove.app`. Nothing about one is shared with the other.
- **FR-3** Each environment uses its own room name (staging `xove-stage`, production `xove`), set as a setting of the app, not in code.
- **FR-4** A staging token, secret or event never reaches production, and the other way round: a token signed with one environment's secret is refused by the other environment's server, and each API only receives the events of its own server.
- **FR-5** The screen slot keeps freeing itself as in spec 0038 on every environment (sharer leaves → stage frees).
- **FR-6** Only the proxy's ports and each LiveKit's media ports (one UDP port and one TCP fallback per server) are published on the VPS.
- **FR-7** The move keeps staging working (a few minutes without video during the switch is acceptable): signing in, sharing and watching behave the same after the move, and the change is documented in both repos.

## Acceptance criteria

- **AC-1** `xove/compose.yaml` has no `livekit` service and publishes no port; `git grep` in `xove` finds no LiveKit server config.
- **AC-2** Manual on staging after the move: Ana shares, Bruno watches with video and sound; Ana closes her tab and Bruno's stage frees within 10 seconds (spec 0038 still holds).
- **AC-3** The room name given to browsers comes from the app's room setting (automated test with a non-default room); staging runs with `xove-stage`.
- **AC-4** A token signed with the staging key pair is refused by the production LiveKit, and a production token by the staging one (manual check with LiveKit's CLI, written in the PR).
- **AC-5** Each LiveKit sends its webhooks only to its own environment's API (config check plus the logs of a join and leave on staging, written in the PR).
- **AC-6** On the VPS, only the proxy's ports and the two LiveKit servers' media ports are published (`docker ps` / `ss -lntu`, written in the PR).
- **AC-7** The production LiveKit starts and answers at `https://rtc.xove.app` with a valid certificate, ready for #46/#47.
- **AC-8** `docs/architecture.md`, `docs/operations.md` and `infra`'s docs describe where each LiveKit runs, its address and ports, and how to check its logs and webhooks.

## Out of scope

- Production's app configuration, database and release (#45, #46); production video is only used in #47.
- Moving the app's runtime and deploy script to `infra` (#67) and CI templates (#68).
- TURN (#49) and server-side slot enforcement (#51).

## Open questions

None. Decided with Henrique on 2026-09-28: full separation, one LiveKit server per environment with its own key pair, address (`rtc-stage.xove.app`, `rtc.xove.app`) and media ports (FR-2, FR-4); a few minutes without video on staging during the move is fine (FR-7).
