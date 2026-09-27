# Free the screen when the sharer leaves — plan

- Spec: [spec.md](spec.md) (approved 2026-09-27)
- Status: Approved (2026-09-27)

## Approach

**LiveKit tells the API.** LiveKit already knows the moment a connection leaves or a track stops. We turn on its webhooks: on every room event it sends a signed `POST` to the API. The API frees the slot when the event is about the connection that is sharing.

**The slot remembers which connection is sharing.** When the browser takes the slot, it also sends its LiveKit connection id (`participantSid`) and its screen track id (`trackSid`). The slot keeps them next to the holder, never shown to other people. Then:

- `participant_left` frees the slot when its connection id matches the sharing connection (FR-1, FR-5).
- `track_unpublished` frees it when the track is a `SCREEN_SHARE` and its id matches the shared track (FR-2). Matching the track, not just the person, means an old "unpublished" arriving late can't free a share Ana has just restarted.
- Anything else, or anything about another person or connection, changes nothing (FR-3).
- Taking the screen without both ids is refused with 400 (FR-7, added after review): a share the API can't match could never be freed. A browser still running the previous web version must reload before sharing.

**Only LiveKit can call it (FR-4).** Verified with the real LiveKit v1.13.7: each webhook carries `Authorization: <JWT>` signed HS256 with the API secret, `iss` = the API key, a 5-minute validity, and a `sha256` claim with the base64 SHA-256 of the body. The API checks all four with Nimbus (already used for the tokens), on the raw body, before reading it. Anything else gets 401 and changes nothing.

**The feed needs no change (FR-6).** `useRoomSession` already logs "X stopped sharing" whenever the slot goes from someone to nobody, whatever freed it. A test proves it for this case.

**LiveKit config moves into `compose.yaml`.** LiveKit refuses webhooks without `webhook.api_key` in its config, and its YAML can't read environment variables. Verified: if the config is passed as the `LIVEKIT_CONFIG` variable, LiveKit ignores the config file, so the two can't be combined. The whole config (today's `livekit.yaml` plus the webhook part) therefore becomes a `LIVEKIT_CONFIG` block in `compose.yaml`, with `${LIVEKIT_API_KEY}` filled in by Compose. No new secret, and nothing environment-specific in git.

**LiveKit reaches the API privately.** LiveKit joins the project's `internal` network and calls `http://api:8080/api/livekit/webhook`. `api` only resolves to this environment's API on that network; the shared `web` network has the API of every environment.

### Alternatives considered

- **The API asks LiveKit who's in the room every few seconds** (`ListParticipants`). Rejected: constant traffic, an admin-level key in use all the time, and still up to one interval late.
- **Heartbeats from the sharer's browser**, with the slot expiring after N seconds without one. Rejected: a crash still takes N seconds, it adds traffic from every sharer, and LiveKit already knows.
- **The API learns the connection ids from the `track_published` webhook** instead of the browser sending them. Rejected: that event and `POST /api/screen/take` race each other, so the slot could be taken before the API knows the ids.
- **A different LiveKit identity per connection**, so one person could be in the room twice. Rejected for now: see the open trade-off below.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| API | `screen/ScreenSlot.java` | Keeps the sharing connection (`participantSid`, `trackSid`, both optional) next to the holder. `take(…)` accepts them. New `connectionLeft(userId, participantSid)` and `screenUnpublished(userId, participantSid, trackSid)`: free only on a match (fallback to the person when no ids are stored). Returns whether it freed the slot, for logging |
| API | `screen/ScreenController.java` | `POST /api/screen/take` requires the JSON body `{ participantSid, trackSid }`; 400 without it |
| API | `livekit/LiveKitWebhookVerifier.java` (new) | Checks the `Authorization` JWT (HS256 with the secret, `iss` = key, time window with a small clock skew) and that its `sha256` matches the raw body |
| API | `livekit/LiveKitWebhookController.java` (new) | `POST /api/livekit/webhook`: raw body as bytes → verify → parse with Jackson (unknown fields ignored) → for `participant_left` and `track_unpublished`, turn the identity `user-<id>` back into a user id and call the slot. Always 200 for a valid event, even when nothing changes |
| API | `config/SecurityConfig.java` | `/api/livekit/webhook`: no login and no CSRF (LiveKit has neither); the signature is the protection |
| Web | `api/client.ts` | `screen.take(connection?)` sends `{ participantSid, trackSid }` when given |
| Web | `hooks/useLiveKitRoom.ts` | After publishing the screen, returns the local connection id and the screen track id |
| Web | `hooks/useRoomSession.ts` | Passes those ids to `take` |
| Database | — | None: the slot lives in memory |
| Config | `compose.yaml` | `livekit`: `LIVEKIT_CONFIG` block (today's settings + `webhook: { api_key: ${LIVEKIT_API_KEY}, urls: [http://api:8080/api/livekit/webhook] }`), no `--config` or volume, joins the `internal` network |
| Config | `livekit/livekit.yaml` | Deleted; its settings and comments move into `compose.yaml` |
| Docs | `docs/architecture.md` | Room rules: the new "leaves" rule; endpoint table: `POST /api/livekit/webhook` and the `take` body; remove the "Known limitation" paragraph; repository layout without `livekit/` |
| Docs | `docs/decisions.md` | #24: LiveKit webhooks free the slot (vs polling or heartbeats) |
| Docs | `docs/operations.md` | What the webhook logs look like, and how to check LiveKit is sending them |

## API and data

**`POST /api/livekit/webhook`** (called by LiveKit only)

- Headers: `Authorization: <JWT>` (no `Bearer`), `Content-Type: application/webhook+json`.
- Body: LiveKit's `WebhookEvent`. Fields used: `event`, `participant.identity`, `participant.sid`, `track.sid`, `track.source`.
- 200: valid event, handled or ignored. 401: missing, badly signed, expired, wrong issuer, or body hash mismatch; nothing changes.
- Logs one line per slot change: `slot freed: user 12 left (PA_…)`. Never logs the JWT or the body.

**`POST /api/screen/take`**: required body `{ "participantSid": "PA_…", "trackSid": "TR_…" }`. Without it: 400, "Your browser didn't say which video connection is sharing. Reload the page and try again." 

**`GET /api/screen`**: unchanged. The connection ids are never included.

No database changes.

## Risks

- **Forged events freeing someone's share.** The endpoint is reachable through the proxy (`/api/*`). Handled by the full signature check (key, secret, time window, body hash) before anything is read; tests cover each failure.
- **Replay of a captured event within 5 minutes.** It could only free a slot for the exact same connection or track again, which has already left. Accepted.
- **LiveKit can't reach the API** (network or URL wrong). The slot then behaves as today, stuck until a takeover. Caught by AC-9 on staging; LiveKit logs failed deliveries.
- **LiveKit restarts on deploy** because its config changes: everyone's video reconnects once, a few seconds. Acceptable on staging; production doesn't exist yet.
- **Old browsers without the new web version** send no ids and get 400 until they reload. Acceptable: only staging runs today.
- **Step 5 (shared LiveKit in `infra`)** will need a webhook URL per environment and the `internal` network trick won't apply. Noted for FR-5.2; out of scope here.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `LiveKitWebhookControllerTest#freesTheSlotWhenTheSharingConnectionLeaves` | web layer (MockMvc, request signed in the test) |
| AC-2 | `LiveKitWebhookControllerTest#freesTheSlotWhenTheScreenTrackIsUnpublished` | web layer |
| AC-3 | `LiveKitWebhookControllerTest#ignoresEventsAboutSomeoneElse` | web layer |
| AC-4 | `LiveKitWebhookControllerTest#ignoresOtherTracksOfTheSharer` | web layer |
| AC-5 | `LiveKitWebhookControllerTest#refuses…` (no header, wrong secret, wrong key, expired, body changed after signing) | web layer |
| AC-6 | `LiveKitWebhookControllerTest#acceptsEventsWhenNobodyShares` | web layer |
| AC-7 | `LiveKitWebhookControllerTest#ignoresAnotherConnectionOfTheSharer` | web layer |
| AC-8 | `RoomPage.test.tsx` "logs 'stopped sharing' when the slot is freed from outside" | web UI (fake API) |
| AC-10 | `ScreenControllerTest#takingWithoutSayingWhichConnectionIsRefused`, `ScreenSlotTest#takingWithoutSayingWhichConnectionIsRefused` | web layer / unit |
| AC-9 | Two browsers on staging: share, close the tab, time it | manual |

Also: `ScreenSlotTest` for the matching rules, the fallback and a late event after a restarted share; `ScreenControllerTest` for `take` with and without a body; `LiveKitWebhookVerifierTest` for the JWT checks; `client.test.ts` and `RoomPage.test.tsx` for sending the ids on take.

Before the PR, a local run of the real LiveKit v1.13.7 with the new `compose.yaml` config, checking that it starts and posts `room_started` to the API with a valid signature.

## Rollout

1. The PR goes through the commit checks. `2 · Validate build` doesn't start LiveKit, so the local check above covers its config.
2. Merge → the stage release deploys the new images and recreates `livekit` with the new config.
3. AC-9 on staging with two browsers.
4. No new setting or secret: the webhook uses the existing `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
5. Rollback: `ops/deploy.sh rollback` (or reverting the PR) restores the previous `compose.yaml` and `livekit/livekit.yaml`; the slot goes back to today's behaviour.

## Decided trade-off

**Same person on two devices.** Everyone joins LiveKit as `user-<id>`, and a second connection with the same identity makes LiveKit disconnect the first (`DUPLICATE_IDENTITY`, verified on v1.13.7). If Ana shares from her laptop and opens the room on her phone, the laptop is kicked, its share stops and the slot is freed. AC-7 still holds: an event about a connection that isn't sharing never frees the slot.

Decided with Henrique on 2026-09-27: **one connection per person, the newest device wins.** Supporting several devices at once is not planned.
