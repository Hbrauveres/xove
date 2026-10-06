# Theater-mode room with ambilight — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the checks on staging (T13), and the release tag. [design.html](design.html) is the reference for every visual task: sizes, colours, fonts, blur, timings and copy.

## API

- [x] **T1** Plain Java, nothing wired yet:
  - `RoomSeats.occupancy()`: seats in total, taken, waiting.
  - `stream/Watching`: who has which stream on their stage, by user id. It can set, clear and forget, and its read keeps only seated watchers and live targets.
  - · covers FR-13, FR-14a · verify: `RoomSeatsTest`, `WatchingTest` (new)
  - Done: `Occupancy` and `RoomSeats.occupancy()`; `Watching` with `watch`, `clear` and `current(seated, streams)`. 8 tests.
- [x] **T2** HTTP:
  - `PUT /api/streams/watching` (members, CSRF; `{sharerId, kind}` or `{}`; 204, or 400 for a bad kind);
  - the streams view gains `seats` and `watching`;
  - a person leaving the room (webhook) forgets what they watched.
  - · covers FR-13, FR-14a · verify: `StreamsControllerTest`, `LiveKitWebhookControllerTest`; `cd api && ./mvnw test`
  - Done: `PUT /api/streams/watching` (`WatchRequest`); `StreamsView` gains `seats` and `watching`; `participant_left` clears the watch. 7 tests; API 163.

## Web core

- [x] **T3** Data:
  - `api/types.ts` and `api/client.ts` get the new fields and `api.streams.watching(target)`;
  - `useRoomSession` exposes the seats and who watches what from the poll, adds a "Reconnected" event when the connection comes back, and gives each event the id of the stream it's about;
  - an API without the new fields still works.
  - · covers FR-9, FR-10, FR-13, FR-14a · verify: `RoomPage.test.tsx` (session through the page), `client` tests
  - Done: `seats` and `watchingOf` (room ids, "me" for me) and a "reconnected" event from `useRoomSession`; `api.streams.watching`; the API's watch entries gained `mine`, since `/api/me` has no user id. Tested in `useRoomSession.test.ts` (new, 3) and `client.test.ts` (1); the fake API serves the new fields.
- [x] **T4** `media/ambilight.ts` and the preferences:
  - the edge colours from a 64×36 frame (200 LEDs, averaged inward);
  - the easing;
  - painting the ring with the soft-curve falloff and the 3 px blur at small size;
  - the ring's placement over the stage;
  - `xove.ambilight.on` and `xove.ambilight.brightness`.
  - · covers FR-4, FR-5, FR-6a · verify: `ambilight.test.ts` (new), `preferences.test.ts`
  - Done: `media/ambilight.ts` (`edgeColors`, `easeColors`, `ringPlacement`, `paintRing`, the falloff) and `loadAmbilight`/`saveAmbilight` (on, 90% by default). 7 tests.
- [x] **T5** `stage/Ambilight.tsx`: samples a given `<video>` about 12 times a second (2 with reduced motion), with `requestVideoFrameCallback` or a timer. It stops while the tab is hidden, the video is paused or missing, or it's switched off. Brightness sets the opacity; an unreadable frame turns it off quietly · covers FR-4, FR-5, FR-6, FR-6a · verify: `Ambilight.test.tsx` (new)
  - Done: `Ambilight` with a timer that runs only while the tab is visible (no `requestVideoFrameCallback`: the timer already caps the reads at 12 a second); it follows the video's play and pause events. 7 tests.
- [x] **T6** `ui/Dropdown.tsx`:
  - frosted sections with 2 px clear cuts, as in the design;
  - the height roll in both directions, instant with reduced motion;
  - sections that don't shrink while rolling, and a thin styled scrollbar only when needed;
  - one open at a time, closed by a click outside or Escape with the focus back on its button;
  - menu or dialog roles.
  - · covers FR-15, FR-16, FR-17, FR-18 · verify: `Dropdown.test.tsx` (new)
  - Done: `Dropdown` and `DropdownSection`; the roll's height is set on the element (with `data-rolled` for tests, since jsdom drops grid styles); one-at-a-time through a window event. 5 tests.
- [x] **T7** `ActivityPill` and `ActivityList`:
  - the pill: bell, avatar, latest event, time, unseen count, slide-in, and the amber reconnecting state;
  - the list: every kind, newest first, unseen highlighted;
  - events about live streams show WATCH (on hover or focus) and WATCHING, and a click picks that stream.
  - · covers FR-8, FR-9, FR-10, FR-11, FR-12 · verify: `ActivityPill.test.tsx`, `ActivityList.test.tsx` (new)
  - Done: `ActivityPill` (in a `Dropdown`), `ActivityList`, `ActivityIcon` and `activityText` (the texts and short times). New counts from the last event seen; opening marks them seen. 8 tests.
- [x] **T8** `PeopleButton` and `AccountButton`:
  - people: the icon and number; the panel's seats bar, people with "Sharing …", "Watching <name>" or "In the room", icons, and the queue line;
  - account: the avatar with its connection dot; the menu's name, role and connection, the ambilight switch and brightness slider (saved), Admin for admins, and Sign out.
  - · covers FR-6a, FR-13, FR-14 · verify: `PeopleButton.test.tsx`, `AccountButton.test.tsx` (new)
  - Done: `PeopleButton` (seats bar as a progressbar, people notes, queue line; seats and queue left out when the API doesn't say) and `AccountButton`. The account panel is a dialog, not a menu: a menu's arrow keys would fight the brightness slider. 8 tests.
- [ ] **T9** `NowWatching` and `AlsoLive`:
  - now watching: the avatar with its ring, name, pulsing LIVE, what, and elapsed time; or "Nobody is sharing right now";
  - also live: "N of 6", the previews with their chip (a click picks), and the dashed free slot;
  - preview sound, from `Thumbnails`: muted by default and not downloaded, a round speaker crossed while muted, a click to unmute, and a horizontal slider sliding out on hover; no speaker without sound.
  - · covers FR-20, FR-21, FR-21a, FR-21b · verify: `NowWatching.test.tsx`, `AlsoLive.test.tsx` (new)

## Wiring

- [ ] **T10** The stage pick at room level (`useStagePick`): the stage, the activity list and the previews all pick through it, and a camera event shows that person's camera big. The pick is reported to the API once after 1 s of stillness, and again when the poll lost it. `ScreenVideo` exposes its video; `StageOverlay` loses the LIVE chip · covers FR-12, FR-14a, FR-19 · verify: `RoomPage.test.tsx`
- [ ] **T11** The room page:
  - the full-height layout with the stage-width column (24 px margins);
  - the new header, info row, ambilight and footer ("xovê · Made by Hbrauveres", with Buy me a coffee, GitHub and LinkedIn as plain text);
  - the small-screen layout;
  - `AppHeader`, `ViewerList`, `ActivityFeed` and `Thumbnails` deleted, their tests moved.
  - · covers FR-1, FR-2, FR-3, FR-7, FR-19, FR-21b, FR-22, FR-23 · verify: `RoomPage.test.tsx`; `cd web && npm test && npm run build`

## Docs and review

- [ ] **T12** Docs: the room's layout, ambilight and who-watches-what in `docs/architecture.md` and `docs/overview.md`; decision 36 in `docs/decisions.md`; test counts in `CLAUDE.md` · verify: the pages describe the new behaviour
- [ ] **T13** Review every AC (`/review`), fix what it finds, and open the PR with `Closes #104`. Then on staging after merge, written in the PR (Henrique):
  - at 1080p, 2K and a narrow window: sizes, edges, the header and footer see-through above the light (AC-2, AC-12);
  - on the 2K monitor: the ambilight looks like the design and stays smooth, under a millisecond per update in Chrome's performance panel (AC-4);
  - dropdowns: frosted and readable, clear cuts, a smooth roll with the blur, no scrollbar flash (AC-10).
  - · verify: no gaps left; every check written in the PR

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1, FR-2, FR-3 | T11, T13 |
| FR-4, FR-5 | T4, T5, T13 |
| FR-6 | T5, T13 |
| FR-6a | T4, T5, T8 |
| FR-7 | T11 |
| FR-8, FR-11 | T7 |
| FR-9, FR-10 | T3, T7 |
| FR-12 | T7, T10 |
| FR-13 | T1, T2, T3, T8 |
| FR-14 | T8 |
| FR-14a | T1, T2, T3, T10 |
| FR-15 to FR-18 | T6, T13 |
| FR-19 | T10, T11 |
| FR-20, FR-21, FR-21a | T9 |
| FR-21b | T9, T11 |
| FR-22 | T11 |
| FR-23 | T11, T13 |
| AC-1 | T11 |
| AC-2 | T13 |
| AC-3 | T4, T5 |
| AC-4 | T13 |
| AC-5 | T7 |
| AC-6 | T7, T10 |
| AC-7 | T8 |
| AC-8 | T8 |
| AC-9 | T6 |
| AC-10 | T13 |
| AC-11 | T9 |
| AC-12 | T13 |
| AC-13 | T5, T8 |
| AC-14 | T1, T2, T10 |
| AC-15 | T9 |
| AC-16 | T11 |

Nothing uncovered. The look, the light's smoothness and the dropdowns' blur can only be judged in a real browser: staging, T13.
