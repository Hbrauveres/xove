# Theater-mode room with ambilight — plan

- Spec: [spec.md](spec.md) (approved 2026-10-06)
- Status: Approved (2026-10-06)

## Approach

The [design](design.html) is the reference for every visual detail: sizes, colours, fonts, blur, animation timings and copy. Its CSS and drawing code are the starting point, rebuilt as React components with CSS modules and Xovê's tokens. Nothing is "approximately" like it.

### Page layout (FR-1 to FR-3, FR-23)

`RoomPage` becomes a full-height flex column: header, middle, footer.
- **Middle:** a size container, holding one column whose width is `min(100cqw − 48px, (100cqh − info row − gap) × 16/9)`. The stage and the info row live in it, so their edges line up, as in the design.
- **Header and footer:** full width, transparent, no lines, above the light (`z-index`).
- **Small screens:** a breakpoint rearranges the header, dropdowns and info row as in the design.
- **Left alone:** the waiting room and the seat offer don't change; they wrap the room as today.

### Ambilight (FR-4 to FR-6a)

A pure module and a component:

- **`media/ambilight.ts` (pure, tested):**
  - `edgeColors(pixels, cols, rows)` turns a 64×36 RGBA frame into 200 edge colours, each averaged with its inward neighbour;
  - `easeColors(current, next, k)` moves each LED towards its new colour;
  - `paintRing(...)` draws the LEDs into a small canvas with the soft-curve falloff (stops 1, .62, .26, .08, 0) and a 3 px blur at that size;
  - `ringPlacement(cols, rows, spread)` gives the canvas's position so its middle maps exactly onto the stage.
- **`stage/Ambilight.tsx`:** a canvas behind the stage. It samples the big `<video>` about 12 times a second (2 per second with reduced motion), using `requestVideoFrameCallback` where available and a timer otherwise. It stops when:
  - the tab is hidden;
  - the video is paused or gone;
  - the switch is off.
- **Cost:** no CSS blur; the GPU only stretches a ~96×68 canvas. The brightness slider sets the canvas's opacity.
- **Why the video can be read:** WebRTC video is same-origin, so `getImageData` works. If a browser refuses, the light just stays off; it never errors.

`ScreenVideo` exposes its `<video>` element (a ref), so the stage can hand the big one to `Ambilight`.

### Who watches what (FR-13, FR-14a)

The API keeps, in memory like the streams, what each seated person has on their stage:
- **Reporting:** each browser reports it with `PUT /api/streams/watching`, sending the sharer's user id and the kind, or nothing for an empty stage. It reports when the big stream changes (after 1 s of stillness, so quick clicks send one report), and again when a poll shows the API forgot it (after a restart).
- **Reading:** the streams poll (`GET /api/streams`, every 2 s) returns it.
- **Cleanup:** a watch is dropped when its person leaves the room (the seat ends) or their stream ends. The view only lists watches of seated people on live streams; nothing runs on a timer, as with seats.

### Seats and queue for the people panel (FR-13)

`RoomSeats` gains `occupancy()`: seats in total, seats taken, people waiting. The streams poll returns it, so the panel needs no new request.

### Stage, info row, activity (FR-8 to FR-12, FR-19 to FR-21b)

- **Who is on the stage:** the choice moves from `Stage` up to the room (`useStagePick`), so the activity list and the previews can change it too. Picking a camera event shows that person with their camera big (the existing swap, set for them).
- **Info row:** new components:
  - `NowWatching`: avatar, name, LIVE, what, and the elapsed time with the existing `useElapsed`, or "Nobody is sharing right now";
  - `AlsoLive`: "N of 6", the previews and the free slot. It replaces `Thumbnails`, keeping its sound logic: muted by default, sound not downloaded, its own volume. The speaker becomes the design's round chip, and the slider slides out horizontally inside the preview.
- **Activity:** the room's events (`useRoomSession.activity`, already joins, leaves, shares and cameras) gain a "Reconnected" kind and the id of the stream they're about.
  - `ActivityPill` shows the latest, the unseen count and the reconnecting state.
  - `ActivityList` renders the list, with "WATCH" and "WATCHING" on events about live streams.
  - The last 30 are kept, as today. The list starts when you join; there's no history from before.
- **`StageOverlay`:** loses the LIVE chip and keeps fullscreen.

### Header, account, people (FR-7, FR-13, FR-14)

- **`RoomHeader`:** the logo, `ActivityPill`, `PeopleButton` and `AccountButton`. It replaces `AppHeader`, used only by the room.
- **People panel:** seats, the people with "Sharing …", "Watching <name>" or "In the room", and the queue line.
- **Account menu:** name, role and connection; the ambilight's switch and brightness, saved as `xove.ambilight.on` and `xove.ambilight.brightness`; Admin for admins; Sign out.
- **Removed:** `ViewerList` and `ActivityFeed`.

### Dropdowns (FR-15 to FR-18)

One shared `Dropdown` gives all three panels the same behaviour:
- frosted sections with 2 px clear cuts;
- the height roll (`grid-template-rows` 0fr → 1fr), which keeps the blur, unlike a clip or a fade;
- sections that don't shrink while rolling, and a thin styled scrollbar only when needed;
- one open at a time, closed by a click outside or Escape, with the focus going back to its button.

The account menu uses menu roles; activity and people are dialogs with lists, as in the design.

### Rejected

- **A full copy of the video, blurred behind the stage:** tried in round three. It costs a full-size blur and looked less like LEDs.
- **CSS `filter: blur` on the LED layer:** tried in round four. It lagged on a 2K monitor, because the whole glow is re-blurred at screen size on every update.
- **WebGL for the ambilight:** faster in theory, but a 96×68 canvas is already well under a millisecond, and WebGL adds a context and shaders for nothing visible.
- **Sending "who watches what" through LiveKit data messages:** no API change, but every browser would have to collect and trust everyone's messages, with nothing to fix them after a reload. The API already owns the room's shared state, and the streams poll already reaches everyone.
- **A separate request for seats and the queue:** the streams poll already runs every 2 s.
- **Keeping `Thumbnails` and restyling it in place:** it would mix the old strip's layout with the new row's. Its sound logic moves into `AlsoLive` instead.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| API | `stream/Watching.java` (new) | In-memory who-watches-what, by user id; set, clear, forget; a read that keeps only live targets and seated watchers. |
| API | `stream/StreamsController.java` | `PUT /api/streams/watching`; the streams view gains `seats` and `watching`. |
| API | `stream/StreamsView.java` | `seats { total, taken, waiting }` and `watching [{ userId, sharerId, kind }]`. |
| API | `room/RoomSeats.java` | `occupancy()`. |
| API | `livekit/LiveKitWebhookController.java` | A person leaving the room also forgets what they watched. |
| Web | `api/types.ts`, `api/client.ts` | The new fields; `api.streams.watching(target)`. |
| Web | `pages/RoomPage.tsx` (+ CSS) | The full-height layout and the column; the new header, info row and footer; the stage pick lifted up. |
| Web | `components/room/RoomHeader.tsx`, `ActivityPill.tsx`, `ActivityList.tsx`, `PeopleButton.tsx`, `AccountButton.tsx`, `RoomFooter.tsx` (new) | Header, activity, people, account, footer. |
| Web | `components/ui/Dropdown.tsx` (new, + CSS) | The shared frosted, rolling dropdown. |
| Web | `components/stage/NowWatching.tsx`, `AlsoLive.tsx`, `Ambilight.tsx` (new) | Info row and ambilight. |
| Web | `media/ambilight.ts` (new), `media/preferences.ts` | The sampling and painting; the ambilight preferences. |
| Web | `hooks/useStagePick.ts` (new), `hooks/useRoomSession.ts` | The stage pick at room level, reported to the API; "Reconnected" events and the events' stream ids; seats and watching from the poll. |
| Web | `components/stage/Stage.tsx`, `StageOverlay.tsx`, `ScreenVideo.tsx` | Pick from props; no LIVE chip; the video's ref for the ambilight. |
| Web | `components/layout/AppHeader.tsx`, `viewers/ViewerList.tsx`, `activity/ActivityFeed.tsx`, `stage/Thumbnails.tsx` (+ CSS, tests) | Deleted; their tests move to the new components. |
| Docs | `docs/architecture.md`, `docs/overview.md`, `docs/decisions.md` | The room's layout, ambilight, who-watches-what; decision 36. |
| Docs | `CLAUDE.md` | Test counts. |

No database change, no setting or secret. New browser settings: `xove.ambilight.on`, `xove.ambilight.brightness`.

## API and data

- `GET /api/streams`, and every streams answer, adds two fields:
  ```json
  "seats": { "total": 20, "taken": 4, "waiting": 0 },
  "watching": [ { "userId": 3, "sharerId": 7, "kind": "screen" } ]
  ```
- `PUT /api/streams/watching`, for members with the CSRF token:
  - the body `{ "sharerId": 7, "kind": "screen" }` sets it, and `{}` clears it;
  - it answers 204, or 400 for a bad kind;
  - only a seated person's watch is kept.
- Nothing is stored in Postgres: like the streams and seats, it starts empty after an API restart and fills again from the browsers' reports.

## Risks

- **Ambilight cost on weak machines:** measured in the design at well under a millisecond per update at 12 per second; there's an off switch; reduced motion slows it; it stops in hidden tabs. AC-4 checks it on your 2K monitor.
- **Reading video frames:** if a browser marks a WebRTC frame unreadable, `getImageData` throws. That's caught once, and the light stays off for that video.
- **Watch reports at scale:** at most one report per person per second, and only on change. With 20 people that's negligible next to the polls.
- **A stale "Watching X":** a target that stopped is hidden at once (live streams only), and a viewer who left is dropped with their seat.
- **A big change to the room page:** many tests move. The old components are deleted only once the new ones and their tests are in.
- **`backdrop-filter`:** no fade, clip or filter on the dropdowns' ancestors (they would stop the blur, as found in round eight). There's a test that the roll uses the height, and AC-10 checks it by eye.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `RoomPage.test.tsx`: no sidebar or old header items; logo, pill, people and account in the header; the footer text | web UI |
| AC-2 | Staging at 1080p, 2K and narrow: sizes, edges, transparent header and footer above the light | manual |
| AC-3 | `ambilight.test.ts`: edge colours from a known frame, easing, the ring's placement. `Ambilight.test.tsx`: no sampling while hidden, paused, empty or switched off | unit |
| AC-4 | Staging on a 2K monitor: looks like the design, smooth; Chrome's performance panel under a millisecond per update | manual |
| AC-5 | `ActivityPill.test.tsx`: the latest event, the unseen count, new events; reconnecting state and "Reconnected" | unit |
| AC-6 | `ActivityList.test.tsx`: every kind, newest first; WATCH and WATCHING; clicking puts the stream on the stage; ended ones are plain text. `RoomPage.test.tsx`: the stage follows | unit / web UI |
| AC-7 | `PeopleButton.test.tsx`: the icon and number with the screen-reader name; seats, people, queue | unit |
| AC-8 | `AccountButton.test.tsx`: name, role, connection, Admin only for admins, Sign out; the dot follows the connection | unit |
| AC-9 | `Dropdown.test.tsx`: one at a time, outside click, Escape and focus back, keyboard, names; the roll animates the height | unit |
| AC-10 | Staging: frosted, readable, clear cuts, smooth roll with blur, no scrollbar flash | manual |
| AC-11 | `NowWatching.test.tsx`, `AlsoLive.test.tsx`: the stage's person, what, how long; "N of 6", previews, free slot; a click puts a preview on the stage | unit |
| AC-12 | Staging, narrow window | manual |
| AC-13 | `AccountButton.test.tsx`, `Ambilight.test.tsx`: the switch and brightness apply at once and survive a reload; off means no sampling | unit |
| AC-14 | `WatchingTest`, `StreamsControllerTest` (API): set, clear, only seated and live, forgotten on leave, CSRF and members only. `RoomPage.test.tsx`: a pick is reported once after a pause; "Watching <name>" and "In the room" in the panel | unit / web layer / web UI |
| AC-15 | `AlsoLive.test.tsx`: muted by default, not downloaded; the speaker unmutes; the horizontal slider on hover sets its own volume; no speaker without sound | unit |
| AC-16 | `RoomPage.test.tsx`: nobody live → no light, the empty stage, "Nobody is sharing right now" and "6 free · share yours" | web UI |

## Rollout

API and web together, no migration, no setting. Merge to `main` and it reaches staging, where Henrique checks AC-2, AC-4, AC-10 and AC-12. Production with the next `v*` tag. An older web app ignores the new fields, and the new one copes with an API that lacks them (no seats line, no "Watching" notes), so the two can be rolled back separately.
