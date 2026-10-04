# Several streams at once — plan

- Spec: [spec.md](spec.md) (approved 2026-10-03)
- Status: Approved (2026-10-03)

## Approach

Two new things live in the API's memory, like the screen slot today:

- **The streams:** up to 6 places instead of one slot.
- **The seats:** up to 20 people in the room, and a queue behind them.

The rest is in the web app.

### Streams (FR-1 to FR-5, FR-15)

- The one `ScreenSlot` becomes `Streams`: a list of up to 6 live streams.
- A stream is one person's screen or camera, each with:
  - its LiveKit connection and track;
  - its quality and mode (spec 0086);
  - when it started.
- A person has at most one screen and one camera.
- **No takeover any more:** with 6 places nobody is pushed out (#62 stays out of scope). The take-over button and its confirmation go away.
- **Ending a stream works as today (spec 0038), for both kinds:**
  - LiveKit's `track_unpublished` ends one stream.
  - `participant_left` ends all of that person's streams.
- **Cameras:** the LiveKit token also allows `camera`. It still never allows the microphone (decision 11). The browser asks for the camera only when its person clicks "Turn on camera".
- **After an API restart** (every deploy), the list is empty again:
  - A browser that is still sending a stream registers it again on its next poll, instead of stopping it as today.
  - If the 6 places filled up in between, it stops.

### Seats and the queue (FR-12 to FR-14)

- **The API hands out seats.** A LiveKit token is given only to someone with a seat, so the room can't go past 20.
- **The number of seats is a setting:** `XOVE_ROOM_SEATS`, public, in each environment's `infra/config/<env>.yaml`.
  - Production: 20. Staging: 3, so the queue can be tried with 4 people.
  - Missing means 20; anything that isn't a whole number from 1 to 20 stops the API at start-up, with a clear message.
- **Entering:** the room page calls `POST /api/room/enter`.
  - With a free seat, you're in.
  - Otherwise you get a place in the queue, and the page shows the waiting screen.
  - The waiting screen calls `enter` again every 2 seconds. That poll is also how the API knows you're still there.
- **Leaving keeps your place for a while:**

  | You were | How you left | How the API knows | Kept for |
  | --- | --- | --- | --- |
  | In the room | closed the tab | LiveKit's `participant_left`, reason `CLIENT_INITIATED` | 30 s |
  | In the room | connection dropped | `participant_left`, any other reason | 60 s |
  | In the queue | closed the tab | the page sends `POST /api/room/leave` while closing (`fetch` with `keepalive`) | 30 s |
  | In the queue | connection dropped | no poll for a while | 90 s after the last poll (Chrome lets a hidden tab poll about once a minute) |

- **Coming back in time** gives you the same seat, or the same place in the queue.
- **Without timers:** expired places are removed each time someone asks, based on the clock. This is easy to test with a fake clock.
- **When a seat frees, it's offered to the first in the queue** (FR-13):
  - Their waiting screen shows a popup: "Enter room" or "Cancel", with a 60-second countdown. The tab's title changes too ("Your turn — Xovê"), in case the tab is in the background.
  - The seat is held for them during those 60 s; nobody else moves.
  - "Enter room" (`POST /api/room/accept`) gives them the seat. "Cancel" (`POST /api/room/cancel`) takes them out of the queue.
  - No answer in 60 s, even if they're away: they go to the end of the queue, and the seat is offered to the next person.
  - The offer runs on the API's clock, so it's the same whatever the browser does.
- **A seat that is never used** (the token was handed out but nobody joined LiveKit) is given up after 60 s.
- **After an API restart,** the seats are empty again. The room's poll (`GET /api/streams`) says `seated: false`, so each page calls `enter` again. The people already in the room get their seats back before anyone new, because they poll within 2 seconds.

### Watching (FR-6 to FR-11, FR-16)

- **Every viewer decides who is big, in their own browser:**
  - Their own pick, while that person is still sharing.
  - Otherwise, the person who has been sharing the longest (the earliest start among their streams).
  - This covers FR-6 and FR-8 with one rule, written as a pure function (`media/stagePick.ts`) and tested alone.
- **Thumbnails:** one per other sharing person. It shows their screen, or their camera if they have no screen. Click it to make that person big.
- **Screen and camera together: the facecam.** As soon as a person has both on, the screen is in the big player and the camera is a small window over it, the facecam.
  - **Swap:** a button inside the facecam with two arrows, labelled "Swap views" (shown on hover, and read by screen readers). It's a player button like the others: semi-transparent, same style as the player bar (spec 0086), and it fades with them. It makes the camera big and puts the screen in the facecam; pressing it again swaps them back. Anyone watching can swap, the sharer too on their own preview.
  - Clicking the facecam itself does nothing, so dragging it never swaps by accident.
  - **Drag** moves the facecam with the pointer (mouse or touch), kept inside the player.
  - **Collapse** turns the facecam into a tab; **expand** brings it back.
  - Each viewer's browser remembers these choices for the session only, not in `localStorage`.
- **Sound:**
  - The big person's sound plays.
  - Thumbnails are muted. Each has its own mute button and volume (spec 0086 `PlayerControls`).
  - A thumbnail that stays muted isn't downloaded at all (`setSubscribed(false)` on its sound).
- **Bandwidth (FR-16):** what's already on does the job:
  - adaptive stream: each video is downloaded at the size it's shown, so thumbnails and the facecam come in low;
  - dynacast: layers nobody watches aren't sent.
  - The viewer's quality menu applies to the big player only.

### Rejected

- **Mesh P2P without LiveKit:** decided against earlier. 6 streams to 20 people doesn't fit each sharer's upload.
- **Limiting the room in LiveKit only (`max_participants`):** LiveKit can refuse the 21st, but it can't queue them or keep a place. The API stays in charge.
- **Keeping the seats and streams in the database:** one API instance and a handful of people. Memory plus re-registering after a restart is enough, as with the slot today.
- **Timers that run by themselves:** places expire when someone asks instead. That's simpler and gives the same result to anyone polling every 2 s.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| API | `stream/Streams.java` (replaces `screen/ScreenSlot.java`) | Up to 6 streams; start, change settings, stop; end on LiveKit reports |
| API | `stream/Stream.java`, `StreamKind.java` (`SCREEN`, `CAMERA`), `StartRequest.java`, `StreamsView.java` | The records; `StreamSettings`, `SharingConnection`, `NotTheHolderException` move over |
| API | `stream/StreamsController.java` (replaces `ScreenController`) | `GET /api/streams`, `POST /api/streams`, `POST /api/streams/{kind}/settings`, `POST /api/streams/{kind}/stop` |
| API | `room/RoomSeats.java`, `room/RoomController.java` | 20 seats, the queue, the 30 s and 60 s grace, the 60 s offer; `POST /api/room/enter`, `accept`, `cancel`, `leave` |
| API | `livekit/LiveKitController.java` | Token only for someone with a seat (409 otherwise) |
| API | `livekit/LiveKitTokens.java` | Allows `camera`, never the microphone |
| API | `livekit/LiveKitWebhookController.java` | `participant_joined` marks the seat used; `participant_left` ends the person's streams and starts the grace (reason `disconnectReason`); `track_unpublished` for `SCREEN_SHARE` and `CAMERA` |
| Web | `api/client.ts`, `api/types.ts` | The new endpoints and shapes; `/api/screen` goes away |
| Web | `hooks/useStreams.ts` (replaces `useScreenSlot.ts`), `hooks/useRoomSeat.ts` | Polls the streams; enters the room, waits, leaves |
| Web | `hooks/useLiveKitRoom.ts` | Camera capture and publish; remote tracks per person (screen, camera, sound); sound subscribed only when it plays |
| Web | `hooks/useRoomSession.ts` | Several streams, mine and others'; start, stop and change each kind |
| Web | `media/stagePick.ts` (new) | Who is big |
| Web | `components/stage/Stage.tsx`, `Facecam.tsx` (new), `Thumbnails.tsx` (new) | Big player, the facecam (swap, drag, collapse), thumbnails with mute |
| Web | `components/controls/ShareControls.tsx` | "Share screen", "Turn on camera", stop each; "6 streams live" when full; `TakeoverConfirm.tsx` deleted |
| Web | `components/share/ShareSetup.tsx`, `media/shareSettings.ts` | Also for the camera: preview, quality, mode. Camera presets 720p (default) and 480p |
| Web | `pages/RoomPage.tsx`, `components/room/WaitingRoom.tsx`, `SeatOffer.tsx` (new) | The waiting screen with the place in the queue; the "Enter room" / "Cancel" popup with its countdown |
| Web | `components/activity/ActivityFeed.tsx`, `types.ts` | Events per stream ("started their camera"); "took" goes away |
| Database | none | Nothing is stored |
| API | `config/XoveProperties.java`, `application.yml` | `xove.room.seats` from `XOVE_ROOM_SEATS` (default 20, 1 to 20) |
| Config | `compose.yaml` | Passes `XOVE_ROOM_SEATS` to the API (`${XOVE_ROOM_SEATS:-20}`) |
| Infra | `infra/config/prod.yaml`, `stage.yaml`, `dev.yaml` (separate `infra` PR) | `XOVE_ROOM_SEATS`: 20 in production and dev, 3 in staging |
| Docs | `docs/architecture.md`, `docs/decisions.md` (decision 32), `CLAUDE.md` | Room rules, API table, tokens allow camera, test counts |

## API and data

**`POST /api/room/enter`** (member): idempotent; also the waiting screen's poll. One of:

- `{ "status": "in" }`
- `{ "status": "waiting", "place": 3 }`
- `{ "status": "offered", "until": "2026-10-03T20:01:00Z" }`: a seat is waiting for you.

**`POST /api/room/accept`** (member): takes the offered seat: `{ "status": "in" }`. `409` when there's no offer for you (it ran out).

**`POST /api/room/cancel`** (member): `204`. Leaves the queue, or turns down the offer.

**`POST /api/room/leave`** (member): `204`. "I'm closing the tab": keeps the place for 30 s.

**`GET /api/streams`** (member):

```json
{
  "seated": true,
  "streams": [
    { "kind": "screen", "userId": 7, "name": "Ana", "avatarUrl": null,
      "since": "2026-10-03T20:00:00Z", "settings": { "quality": "1080p", "mode": "smooth" }, "mine": false }
  ],
  "free": 5
}
```

**`POST /api/streams`** (member with a seat): `{ kind, participantSid, trackSid, quality?, mode? }`.

- Starting the same kind again replaces your own stream, so a reconnect and the re-register after a restart work.
- `400`: unknown kind or settings, missing connection.
- `409`: "The room already has 6 streams.", or no seat.

**`POST /api/streams/{kind}/settings`**: `{ quality, mode }`. `409` when it isn't yours.

**`POST /api/streams/{kind}/stop`**: stopping a stream you don't have does nothing.

**`POST /api/livekit/token`**: `409` "Wait for your turn." without a seat.

No tables, no migration.

## Risks

- **LiveKit's leave reason** (`disconnectReason` in `participant_left`) decides 30 or 60 s.
  - It's in LiveKit's participant info, but this plan checks it on staging first.
  - If it's missing, every leave counts as a drop (60 s): safe, just longer.
- **A dropped connection takes longer than 60 s in total:**
  - LiveKit first waits for the browser to come back (about 20 to 30 s), and only then reports the leave.
  - The seat is then kept for 60 s more.
  - The docs say so.
- **Old tokens:** a token is valid for an hour, so someone who lost their seat could rejoin LiveKit with an old one.
  - Members are trusted friends, and the page always asks for a seat first, so this plan doesn't block it in LiveKit.
- **Deploys restart the API:**
  - Streams and seats are registered again from the browsers within a couple of polls.
  - For a few seconds, someone new could enter the queue before a re-registering person. That's accepted.
- **Upload for a person with screen and camera:** two streams with layers. The camera goes up to 720p, which keeps its part small.
- **The size of the change:** a big web change. It's split into tasks that each leave the app working.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `StreamsTest#sixStreamsThenFull`, `StreamsControllerTest#startWhenFullIs409`; `RoomPage.test.tsx` "start buttons say the room is full"; manual on staging | unit / web layer / web UI / manual |
| AC-2 | `StreamsTest#screenAndCameraTakeTwoPlaces`; `RoomPage.test.tsx` "screen and camera together" | unit / web UI |
| AC-3 | `RoomPage.test.tsx` "camera only after the click, never a microphone"; `LiveKitTokensTest#allowsCameraNeverMicrophone` | web UI / unit |
| AC-4 | `LiveKitWebhookControllerTest#leaveEndsStreamsAndKeepsSeat`; manual on staging (close a sharer's tab) | web layer / manual |
| AC-5 | `stagePick.test.ts`; `RoomPage.test.tsx` "first is big, click swaps, longest takes over" | unit / web UI |
| AC-6 | `Facecam.test.tsx` (swap, drag, collapse, expand); manual | web UI / manual |
| AC-7 | `RoomPage.test.tsx` "only the big sound plays, unmute a thumbnail" | web UI |
| AC-8 | `RoomSeatsTest` (20 then the queue, in order, the 30 s and 60 s grace, the offer: accept, cancel, no answer to the end of the queue, a seat never used), `RoomControllerTest`, `LiveKitControllerTest#noSeatNoToken`; `RoomPage.test.tsx` "waiting screen, the popup, the countdown"; manual | unit / web layer / web UI / manual |
| AC-9 | Manual on staging: `chrome://webrtc-internals`, written in the PR | manual |
| AC-10 | Manual on staging: Hostinger's panel during a session, written in the PR | manual |

## Rollout

1. The `infra` PR (the `XOVE_ROOM_SEATS` values) can merge before or after: without it, the API uses 20. No secrets, nothing in 1Password.
2. The PR merges and staging deploys the API and the web app together.
3. On staging:
   - check that `disconnectReason` arrives (API log of the webhook);
   - run the manual checks for AC-1, AC-4, AC-6, AC-8, AC-9 and AC-10, written in the PR.
4. Henrique tags a release for production.
5. **Rollback:** the previous version knows only `/api/screen`. API and web roll back together, nothing is stored, so it just works.
