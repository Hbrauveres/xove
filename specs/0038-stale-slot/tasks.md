# Free the screen when the sharer leaves — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

- [ ] **T1** — `ScreenSlot` keeps the sharing connection (`participantSid`, `trackSid`, optional) next to the holder; `take(…)` accepts them; new `connectionLeft(…)` and `screenUnpublished(…)` free only on a match, fall back to the person when no ids are stored, and ignore a late event after a restarted share · covers FR-1, FR-2, FR-3 · verify: `ScreenSlotTest` (new cases) and `./mvnw test`
- [ ] **T2** — `POST /api/screen/take` accepts the optional body `{ participantSid, trackSid }`; `GET /api/screen` never shows them · covers FR-1, FR-2 · verify: `ScreenControllerTest` (with body, without body, ids absent from the response)
- [ ] **T3** — `LiveKitWebhookVerifier`: HS256 with the secret, `iss` = key, time window with small skew, `sha256` claim = hash of the raw body · covers FR-4 · verify: `LiveKitWebhookVerifierTest` (valid, missing, wrong secret, wrong key, expired, body changed)
- [ ] **T4** — `LiveKitWebhookController` at `POST /api/livekit/webhook` (raw body → verify → `participant_left` / `track_unpublished` → slot), open in `SecurityConfig` without login or CSRF, one log line per freed slot · covers FR-1, FR-2, FR-3, FR-4 · verify: `LiveKitWebhookControllerTest` for AC-1 to AC-7
- [ ] **T5** — Web: after publishing, `useLiveKitRoom` returns the connection id and screen track id; `useRoomSession` passes them to `api.screen.take` · covers FR-1, FR-2 · verify: `client.test.ts` (body sent) and `RoomPage.test.tsx` "sends the connection and track ids when taking the screen"; `npm test` and `npm run build`
- [ ] **T6** — Web: test that a slot freed from outside logs "Ana stopped sharing" (no code change expected) · covers FR-6 · verify: `RoomPage.test.tsx` "logs 'stopped sharing' when the slot is freed from outside" (AC-8)
- [ ] **T7** — `compose.yaml`: LiveKit config as a `LIVEKIT_CONFIG` block with the webhook, `livekit` joins `internal`; delete `livekit/livekit.yaml` · covers FR-1, FR-2, FR-5 · verify: local run of the real LiveKit v1.13.7 with the API from this branch: LiveKit starts, and a `room_started` webhook reaches the API and passes the signature check (API log, 200)
- [ ] **T8** — Docs: `docs/architecture.md` (room rule, endpoints, remove "Known limitation", layout), `docs/decisions.md` #24, `docs/operations.md` (webhook logs) · verify: the pages describe the new behaviour; no `livekit.yaml` left in `git grep`
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
