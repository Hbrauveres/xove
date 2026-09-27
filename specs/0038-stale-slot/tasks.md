# Free the screen when the sharer leaves — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

- [x] **T1** — `ScreenSlot` keeps the sharing connection (`participantSid`, `trackSid`, optional) next to the holder; `take(…)` accepts them; new `connectionLeft(…)` and `screenUnpublished(…)` free only on a match, fall back to the person when no ids are stored, and ignore a late event after a restarted share · covers FR-1, FR-2, FR-3 · verify: `ScreenSlotTest` (new cases) and `./mvnw test`
  - Done: new `SharingConnection` record; `ScreenSlot.take(…, connection)`, `connectionLeft` and `screenUnpublished` with id matching and the no-ids fallback; 8 new `ScreenSlotTest` cases.
- [x] **T2** — `POST /api/screen/take` accepts the optional body `{ participantSid, trackSid }`; `GET /api/screen` never shows them · covers FR-1, FR-2 · verify: `ScreenControllerTest` (with body, without body, ids absent from the response)
  - Done: `ScreenController.take` reads an optional `SharingConnection` body; 2 new `ScreenControllerTest` cases (ids stored, never in the response; no body still works).
- [x] **T3** — `LiveKitWebhookVerifier`: HS256 with the secret, `iss` = key, time window with small skew, `sha256` claim = hash of the raw body · covers FR-4 · verify: `LiveKitWebhookVerifierTest` (valid, missing, wrong secret, wrong key, expired, body changed)
  - Done: new `LiveKitWebhookVerifier` (bean in `LiveKitConfig`); test helper `WebhookSigner` signs like LiveKit; 8 `LiveKitWebhookVerifierTest` cases.
- [x] **T4** — `LiveKitWebhookController` at `POST /api/livekit/webhook` (raw body → verify → `participant_left` / `track_unpublished` → slot), open in `SecurityConfig` without login or CSRF, one log line per freed slot · covers FR-1, FR-2, FR-3, FR-4 · verify: `LiveKitWebhookControllerTest` for AC-1 to AC-7
  - Done: new `LiveKitWebhookController` (verify → parse → slot, one log line per freed slot); `SecurityConfig` opens the path without login or CSRF; 8 `LiveKitWebhookControllerTest` cases for AC-1 to AC-7 plus ignored events.
- [x] **T5** — Web: after publishing, `useLiveKitRoom` returns the connection id and screen track id; `useRoomSession` passes them to `api.screen.take` · covers FR-1, FR-2 · verify: `client.test.ts` (body sent) and `RoomPage.test.tsx` "sends the connection and track ids when taking the screen"; `npm test` and `npm run build`
  - Done: `startScreenShare` resolves with `{ participantSid, trackSid }` (or null); `useRoomSession` passes it to `slot.take`, which sends it as the body; fake LiveKit has a local sid and screen track; 2 new tests.
- [x] **T6** — Web: test that a slot freed from outside logs "Ana stopped sharing" (no code change expected) · covers FR-6 · verify: `RoomPage.test.tsx` "logs 'stopped sharing' when the slot is freed from outside" (AC-8)
  - Done: new `RoomPage.test.tsx` case (AC-8); no code change needed; the test fails when the feed text is broken on purpose.
- [x] **T7** — `compose.yaml`: LiveKit config as a `LIVEKIT_CONFIG` block with the webhook, `livekit` joins `internal`; delete `livekit/livekit.yaml` · covers FR-1, FR-2, FR-5 · verify: local run of the real LiveKit v1.13.7 with the API from this branch: LiveKit starts, and a `room_started` webhook reaches the API and passes the signature check (API log, 200)
  - Done: `compose.yaml` holds the LiveKit config in `LIVEKIT_CONFIG` with the webhook to `http://api:8080/api/livekit/webhook`; `livekit` joins `internal`; `livekit/livekit.yaml` deleted; the controller logs accepted events (debug) and refused ones (warn). Local run with LiveKit v1.13.7: `room_started`, `participant_joined`, `participant_left` accepted; an unsigned request got 401.
- [x] **T8** — Docs: `docs/architecture.md` (room rule, endpoints, remove "Known limitation", layout), `docs/decisions.md` #24, `docs/operations.md` (webhook logs) · verify: the pages describe the new behaviour; no `livekit.yaml` left in `git grep`
  - Done: architecture (diagram, rule 6, webhooks paragraph, endpoints, layout), operations (log lines, troubleshooting), getting-started (dev LiveKit has no webhooks), decisions #24; the diagram renders.
- [ ] **T9** — Review every AC (`/review`) · verify: no gaps left
- [ ] **T10** — After merge, manual AC-9 on staging with two browsers: Ana shares, closes her tab; within 10 s Bruno sees "Nobody is sharing right now" and "Ana stopped sharing" · covers FR-5, FR-6 · verify: result written in the PR

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T1, T2, T4, T5, T7 |
| FR-2 | T1, T2, T4, T5, T7 |
| FR-3 | T1, T4 |
| FR-4 | T3, T4 |
| FR-5 | T7, T10 |
| FR-6 | T6, T10 |
| AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | T4 (plus T1 for the slot rules, T3 for AC-5) |
| AC-8 | T6 |
| AC-9 | T10 |

Nothing uncovered. FR-5's 10-second target can only be proven on staging (T10); the tests prove the slot frees on the first event.
