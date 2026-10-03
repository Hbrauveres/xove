# Several streams at once — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repos before starting. Henrique's part: merging the `infra` PR (T5) and this one, the checks on staging (T14), and the release tag.

## API

- [x] **T1** `stream/Streams.java` and its records (`Stream`, `StreamKind`, `StartRequest`, `StreamsView`; `StreamSettings`, `SharingConnection` and `NotTheHolderException` move over). Plain Java, next to the old slot, nothing wired yet:
  - up to 6 streams; at most one screen and one camera per person;
  - starting the same kind again replaces your own;
  - change settings and stop only your own;
  - LiveKit reports end one stream (track) or all of a person's (connection);
  - camera qualities 720p or 480p only.
  - · covers FR-1, FR-2, FR-3, FR-5, FR-11, FR-15 · verify: `StreamsTest`
  - Done: `Streams` with its records in the new `stream` package; a camera's settings are 720p or 480p (default 720p Smooth). `StartRequest` and `StreamsView` come with the HTTP part (T3). 17 tests.
- [x] **T2** `room/RoomSeats.java`, plain Java with a clock:
  - 20 seats, then the queue in order of arrival;
  - away from the room: 30 s after a closed tab, 60 s after a drop; away from the queue: 30 s after "leave", 60 s after the last poll; same seat or place when back in time;
  - a free seat is offered to the first in the queue for 60 s; accept takes it, cancel leaves the queue, no answer moves them to the end and offers it to the next;
  - a seat never used is given up after 60 s;
  - everything expires when someone asks, nothing runs by itself.
  - · covers FR-12, FR-13, FR-14 · verify: `RoomSeatsTest`
  - Done: `RoomSeats` with `SeatStatus` (in, waiting with the place, offered until); an offer held for its person even while away; 22 tests.
- [x] **T3** Streams over HTTP: `StreamsController` (`GET /api/streams`, `POST /api/streams`, `/{kind}/settings`, `/{kind}/stop`) replaces `ScreenController` and `ScreenSlot`; the token allows `camera` and never the microphone; the webhook ends streams on `track_unpublished` (screen and camera) and `participant_left` · covers FR-1 to FR-5, FR-15 · verify: `StreamsControllerTest`, `LiveKitTokensTest`, `LiveKitWebhookControllerTest`
  - Done: `/api/streams` replaces `/api/screen` (the `screen` package is gone, with the takeover); the token allows `camera`, never `microphone`; the webhook ends a screen or camera on `track_unpublished` and all of a person's streams on `participant_left`. API 128 tests.
- [x] **T4** Seats over HTTP: `RoomController` (`POST /api/room/enter`, `accept`, `cancel`, `leave`); a token only with a seat (409 otherwise); `GET /api/streams` says `seated`; the webhook marks a seat used on `participant_joined` and starts the 30 or 60 s on `participant_left` (`disconnectReason`) · covers FR-12, FR-13, FR-14 · verify: `RoomControllerTest`, `LiveKitControllerTest`, `LiveKitWebhookControllerTest`
  - Done: `/api/room` (`enter`, `accept`, `cancel`, `leave`); token and `POST /api/streams` need a seat (409); `GET /api/streams` says `seated`; the webhook marks a seat used on `participant_joined` and keeps it 30 s (`CLIENT_INITIATED`) or 60 s (anything else) on `participant_left`, and logs the reason for the staging check. API 139 tests.

- [x] **T5** The room size as a setting: `xove.room.seats` from `XOVE_ROOM_SEATS` (default 20; not a whole number from 1 to 20 stops the API at start-up); passed in `compose.yaml`; an `infra` PR sets it in `config/prod.yaml` (20), `stage.yaml` (3) and `dev.yaml` (20) · covers FR-12 · verify: `XovePropertiesTest`, `RoomControllerTest`, `ops/check-compose`, infra's config tests
  - Done: `xove.room.seats` (`XoveProperties.Room`, 1 to 20, 20 when missing; anything else stops start-up); `compose.yaml` passes it; infra PR #7 sets 20 / 3 / 20. `XovePropertiesTest`, `RoomSizeSettingTest`, `check-compose` and infra's checks pass. API 143 tests.

## Web

- [x] **T6** Several screens: `api/client.ts` and `types.ts` for the new endpoints; `useStreams` replaces `useScreenSlot`; `useRoomSession` handles a list of streams; no takeover (`TakeoverConfirm` deleted); "6 streams live" on the buttons when full; a share still being sent after an API restart is registered again · covers FR-1, FR-3, FR-5 · verify: `RoomPage.test.tsx`
  - Done: `useStreams` replaces `useScreenSlot`; `useLiveKitRoom` and `useRoomSession` handle both kinds (the camera's capture and settings are written here, its tests come in T8); the longest sharing person is big for now; takeover gone; full-room message; a stream still being sent is registered again after an API restart, or stopped if the places filled up. Web 105 tests.
- [x] **T7** The seat and the queue: `useRoomSeat` enters before asking for a token, and again when `seated` is false; `WaitingRoom` with the place in the queue; `SeatOffer` popup ("Enter room", "Cancel", 60 s countdown, the tab's title); "leave" sent with `keepalive` when the tab closes · covers FR-12, FR-13, FR-14 · verify: `RoomPage.test.tsx`
  - Done: `useRoomSeat` (enter, poll while waiting, accept, cancel, rejoin, re-enter); `RoomPage` joins the video room only with a seat; `WaitingRoom` with the place; `SeatOffer` popup with the countdown, the tab's title, focus kept inside; `leave` with `keepalive` on `pagehide`; a forgotten seat is asked again without leaving the room. Web 112 tests.
- [x] **T8** The camera: "Turn on camera" asks the browser for the camera only then, never the microphone; the setup window with preview, 720p (default) or 480p, and mode; stop the camera; screen and camera together count as 2 · covers FR-2, FR-4, FR-11 · verify: `RoomPage.test.tsx`, `shareSettings.test.ts`
  - Done: "Turn on camera" and "Turn off camera"; the camera asked for only on click, `audio: false`; the setup window for the camera (720p or 480p, mode); turning it off unpublishes it so the API hears; blocked or missing camera messages; camera presets and remembered choices (`xove.camera.*`). Web 127 tests.
- [ ] **T9** Who is big: `media/stagePick.ts` (a viewer's pick while that person shares, otherwise the longest sharing); `Stage` with the big player and `Thumbnails`; click a thumbnail to make that person big · covers FR-6, FR-7, FR-8, FR-16 · verify: `stagePick.test.ts`, `RoomPage.test.tsx`
- [ ] **T10** The facecam: `Facecam.tsx` starts by itself when a person has both on; the "Swap views" button inside it (two arrows, semi-transparent like the player's buttons, fades with them), for the sharer's preview too; drag inside the player with mouse or touch; collapse to a tab and expand · covers FR-9 · verify: `Facecam.test.tsx`, `RoomPage.test.tsx`
- [ ] **T11** Sound and controls per stream: the big person's sound plays; thumbnails muted, each with its own mute and volume; a muted thumbnail's sound isn't downloaded; the sharer's quality and mode for each of their streams; the viewer's quality menu on the big player; activity feed events per stream ("started their camera") · covers FR-10, FR-11, FR-16, FR-17 · verify: `RoomPage.test.tsx`, `PlayerControls.test.tsx`

## Wrap-up

- [ ] **T12** Docs: `docs/architecture.md` (room rules, seats and queue, facecam, API table, tokens allow the camera), decision 32 in `docs/decisions.md`, `CLAUDE.md` (test counts, room facts, `XOVE_ROOM_SEATS`) · verify: review
- [ ] **T13** Review every AC (`/review`), fix what it finds, open the PR · verify: no gaps left
- [ ] **T14** On staging after merge, written in the PR (Henrique, with friends):
  - six streams, a seventh refused (AC-1);
  - a sharer closes the tab: streams gone in seconds, seat kept 30 s; check `disconnectReason` arrives (AC-4);
  - facecam: swap, drag, collapse (AC-6);
  - the queue and the popup, with staging's 3 seats and 4 people (AC-8);
  - high quality only for the big stream (AC-9);
  - the VPS's traffic in Hostinger's panel (AC-10).
  - · verify: every check written in the PR

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T1, T3, T6 |
| FR-2 | T1, T3, T8 |
| FR-3 | T1, T3, T6 |
| FR-4 | T3, T8 |
| FR-5 | T1, T3, T6 |
| FR-6 | T9 |
| FR-7 | T9 |
| FR-8 | T9 |
| FR-9 | T10 |
| FR-10 | T11 |
| FR-11 | T1, T8, T11 |
| FR-12 | T2, T4, T5, T7 |
| FR-13 | T2, T4, T7 |
| FR-14 | T2, T4, T7 |
| FR-15 | T1, T3 |
| FR-16 | T9, T11, T14 |
| FR-17 | T11, T14 |
| AC-1 | T1, T3, T6, T14 |
| AC-2 | T1, T8 |
| AC-3 | T3, T8 |
| AC-4 | T3, T4, T14 |
| AC-5 | T9 |
| AC-6 | T10, T14 |
| AC-7 | T11 |
| AC-8 | T2, T4, T5, T7, T14 |
| AC-9 | T14 |
| AC-10 | T14 |

Nothing uncovered.
