# The room upright on a phone — plan

- Spec: [spec.md](spec.md) (approved 2026-10-08)
- Status: Approved (2026-10-09)

## Approach

**One room, two layouts (FR-1, FR-2).**

- A new hook, `usePhoneView`, follows a media query, `(max-width: 760px) and (orientation: portrait)`, and re-renders when it changes. `orientation: portrait` means the window is at least as tall as it is wide.
- `Room` (in `RoomPage.tsx`) passes the result down, and the page gets `data-layout="phone"`.
- **The stage stays in the same place in the component tree in both layouts.** Only what's around it changes:
  - the header's pieces;
  - the block under the stage;
  - the footer.

  React then never remounts the `<video>`, so turning the phone doesn't stop what's playing. The share lives in `useRoomSession`, above both layouts, so it keeps going too.
- The current `@media (max-width: 760px)` rules stay for a narrow window held sideways, which keeps today's layout as the spec says.

**The top bar (FR-3 to FR-6).**

- `RoomHeader` gets the phone's arrangement from CSS under `data-layout="phone"`: the wordmark (`XoveMark`), as tall as the avatar and centred on the same line, then the right side.
- On the phone, the header's middle slot is empty, and its right side holds:
  - `PeopleButton` (its trigger shows the icon and the count);
  - a new `ActivityBell`;
  - `AccountButton`, at the far right.
- `ActivityBell` is a round icon button that opens the same `Dropdown` with the same `ActivityList` as the pill. It has no count, no dot and no unseen tracking.
- The dropdowns already open full width under the header below 760 px.
- `AccountButton` gets an optional `footer` slot. On the phone, `Room` passes the footer's items (a `FooterItems` piece taken out of `RoomFooter`, so both share it) and doesn't render `RoomFooter`.

**The stage (FR-7 to FR-9).**

- On the phone, `.theater` still fills exactly one screen (`100dvh`), and nothing but the block under the stage scrolls (FR-14a):
  - `.middle` loses its size container and its side padding, and becomes a column;
  - `.column` is the full width; the stage and the info row keep their size, and the feed or the cards fill the rest with `overflow-y: auto`.
- The stage's `.box` keeps hugging the picture (spec 0107), with its height capped at 60% of the screen:
  - width: `min(100cqw, 60dvh × shape)`;
  - height: `min(100cqw ÷ shape, 60dvh)`.

  A wider-than-tall picture is the full width, and a portrait one stops at 60% with bars at its sides (FR-7).
- The frame loses its rounded corners and runs edge to edge.
- The ambilight, the round buttons and the facecam don't change. `PlayerButtons` already leaves out the screen button where a screen can't be shared.

**Under the stage (FR-10 to FR-14).**

- `Stage` gets a `layout` prop.
- With `"phone"`, its `.info` holds two new components instead of `NowWatching` and `AlsoLive`:
  - `NowWatching`, the desktop's, with a new `compact` prop that changes its layout to the phone's: a 30 px avatar with a 2 px ring inside, "Name · what" in bold at the body size, then the same filled LIVE badge, the time in mono in the muted grey (not the faint one), and "N watching" as words without the avatars. The badge and its pulse stay shared with the desktop.
  - `LiveFeed`: the "Live now" heading with "N of 6", then a card for each other sharer:
    - a full-width 16:9 picture (the same video `AlsoLive` shows: their screen, or their camera), with nothing over it;
    - under the picture, the same `NowWatching` block, compact, for that sharer (its own watchers).
- **The feed is silent (FR-13).** `LiveFeed` gets no sound props, and `Stage` leaves its thumbnail sound at the default (muted), so `setSoundOn(false)` keeps the feed's sound from being downloaded.
- **Tapping a card (FR-14)** calls `pick(personId)`. The stage is pinned, so nothing needs to scroll.
- **Video size.** Adaptive stream already sizes each video to its element, so a feed picture about 390 px wide comes in at the low layer.

**Nobody live (FR-15 to FR-19).**

- **The empty stage on the phone (FR-15).** It's `EmptyStage`, with the line "Turn on your camera with the button below." when `canShareScreen()` is false.
  - Today the line is the same everywhere.
  - The desktop never lacks the screen button, so it keeps its line.
- **The glowing colour bars (FR-16).**
  - `EmptyStage`'s colours move to one exported list.
  - `Ambilight` learns to take a still picture as well as a video: a small canvas with the bars drawn on it once.
  - With a still picture, it draws the edges once (no animation loop) and shows the result.
  - `Stage` passes that canvas only when `layout === "phone"` and the stage is empty. The desktop's empty stage keeps no light.
- **"Nobody live" and "0 of 6 · 6 free" (FR-17)** come from `NowWatching` in its compact form, given no sharer: it replaces the desktop's "The stage is yours." there.
- **The "Here" cards (FR-18, FR-18a).** Only while nobody is live; otherwise the feed is there, and who's in the room stays in the people panel. A new `HereCards` component:
  - the heading and the count;
  - a card for each person: avatar, name, and how long they've been here;
  - me first, as "Name (you)", and "WAITING" on the others' cards.
- **How long (FR-19).** It's a small pure function, `hereFor(sinceMs, nowMs)`: "just arrived", "here N min", "here 1 h 5 min". A 30-second tick re-renders it.

**When each person arrived (FR-19).**

- The API's `RoomSeats` already keeps a seat through a reload (30 to 60 s), so the seat is the right place to remember arrival:
  - `Seat` gets `since`, set when the seat is first given (`Seat.reserved(now)`), and never changed while the seat is kept;
  - a new `RoomSeats.arrivals()` returns `userId → since` for every seat.
- `StreamsView` adds `here: [{ userId, since, mine }]`, and the web reads it in `useRoomSession` as `arrivedAt` by person id ("me", "user-42").
- **An API restart** empties the seats; each page enters again within a poll and gets a new seat, so the time counts from then, as the spec says.
- **An older API** sends no `here`: the cards show no time.

**Rejected:**

| Alternative | Why not |
| --- | --- |
| The whole page scrolling, the stage going up with it | Henrique chose the pinned stage, like the YouTube app and the draft: the picture is always in view. |
| A separate `PhoneRoom` component tree | Rotating would remount the stage's `<video>` and blink or pause it (FR-2). Two trees would also drift apart. |
| Phone layout from CSS alone, with no prop | The feed, the cards and the bell are different elements, not the same ones rearranged. |
| Arrival time from LiveKit (`participant.joinedAt`) | It resets on every reload, against FR-19. The API's seat survives a reload. |
| A CSS blur of a copy of the bars for the glow | It wouldn't match the ambilight's look (falloff, grain, brightness setting). Reusing `Ambilight` with a still picture keeps one look. |
| Reusing `AlsoLive` for the feed | Its previews are small, carry sound controls and scroll sideways. The feed is a different shape, with no sound. |

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| API | `room/RoomSeats.java` | `Seat.since`; `arrivals()` |
| API | `stream/StreamsView.java`, `StreamsController.java` | `here: [{ userId, since, mine }]` |
| Web | `hooks/usePhoneView.ts` (new) | Follows the phone media query |
| Web | `api/types.ts`, `hooks/useRoomSession.ts` | `here` in the streams state; `arrivedAt` by person id |
| Web | `pages/RoomPage.tsx`, `.module.css` | `data-layout="phone"`; the phone's header pieces; no footer; scrolling page |
| Web | `room/RoomHeader.module.css` | The phone's top bar |
| Web | `room/ActivityBell.tsx`, `.module.css` (new) | The bell, opening the activity list |
| Web | `room/AccountButton.tsx` | Optional `footer` slot |
| Web | `room/RoomFooter.tsx` | `FooterItems`, shared with the account menu |
| Web | `stage/Stage.tsx`, `.module.css` | `layout` prop; the 60% cap; edge to edge; the phone's info and feed; the bars' glow |
| Web | `stage/NowWatching.tsx`, `.module.css` | `compact`: the phone's size, "N watching" in words, and "Nobody live" |
| Web | `stage/LiveFeed.tsx`, `HereCards.tsx` (+ `.module.css`, new) | The feed, the cards |
| Web | `stage/hereFor.ts` (new) | "just arrived", "here N min", "here 1 h 5 min" |
| Web | `stage/EmptyStage.tsx` | Shared bar colours; the camera-only line |
| Web | `stage/Ambilight.tsx` | A still picture, drawn once |
| Docs | `docs/architecture.md` | "Watching": the phone view; API: `here` |
| Docs | `CLAUDE.md` | Test counts |

## API and data

- `GET /api/streams` (and the answers of start, settings and stop) adds:

  ```json
  "here": [{ "userId": 42, "since": "2026-10-08T19:02:11Z", "mine": false }]
  ```

  It lists everyone with a seat (in the room, on the way in, or away for a moment), in any order.
- No new endpoint, no error cases, no database change: seats live in memory.

## Risks

| Risk | How the plan handles it |
| --- | --- |
| **Rotating remounts the video.** | The stage keeps its place in the tree; only siblings change. A test renders both layouts in turn and checks that the same `<video>` element stays. |
| **A scrolling area under a touch stage.** A swipe on the feed must scroll it, not move the facecam or fade the stage's buttons. | The feed is its own scroll container, outside the stage's frame; the facecam already uses pointer capture. Checked on a real phone (AC-10). |
| **Six full-width feed videos.** | Adaptive stream sends the small layer for a 390 px picture. With more than a screen's worth, the ones scrolled out of view are paused by LiveKit's `adaptiveStream` visibility (on by default). |
| **`100dvh` and `60dvh` on iPhone Safari** while its toolbars show and hide. | `dvh` follows them; the 60% cap may shift slightly while scrolling, with no layout jump. Checked on an iPhone. |
| **Exposing arrival times.** | Only to seated members, who already see who's here. No new personal data. |

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `usePhoneView.test.ts`: true for 390×844 and 760×1000; false for 800×1000 and 844×390 (mocked `matchMedia`), and it follows a change. `RoomPage.test.tsx`: switching layouts keeps the same `<video>` element. Manual on a phone: rotating doesn't stop playback or a share. | web unit / web UI / manual |
| AC-2 | `RoomPage.test.tsx` (phone): the header has the logo, people with count, the bell, then the account, in that order. `ActivityBell.test.tsx`: it opens the activity list, with no count or dot. | web UI |
| AC-3 | `RoomPage.test.tsx` (phone): no footer. `AccountButton.test.tsx`: the menu ends with the footer's items. | web UI |
| AC-4 | `layout.test.ts` (reads the CSS, as `controls.test.ts` does): on the phone, the stage is full width and its box is capped at 60dvh with the hug formula. Manual: the light around a live stream. | web unit / manual |
| AC-5 | `NowWatching.test.tsx` (compact): the ringed avatar, "Name · what", the LIVE badge, the time, "N watching" in words. `Stage.test.tsx` (phone): no LIVE badge over the stage. | web UI |
| AC-6 | `LiveFeed.test.tsx`: "N of 6", a card for every sharer except the one on the stage, no badge over the picture, then avatar, "Name · what", "LIVE time · N watching"; no sound controls. `Stage.test.tsx` (phone): the feed's sharers get `setSoundOn(false)`. | web UI |
| AC-7 | `LiveFeed.test.tsx`: a tap calls `pick` with the person. `layout.test.ts`: on the phone the room is `100dvh` and only the block under the stage has `overflow-y: auto`. Manual on a phone: the feed scrolls, the stage stays. | web UI / web unit / manual |
| AC-8 | `Stage.test.tsx` (phone, nobody live): the bars, the camera-only line when a screen can't be shared, "Nobody live", "0 of 6 · 6 free". `HereCards.test.tsx`: me first as "(you)", the others with "WAITING". `Ambilight.test.tsx`: a still picture is drawn once. Manual: the bars glow on a phone. | web UI / manual |
| AC-9 | `hereFor.test.ts`: under a minute, minutes, hours and minutes. `RoomSeatsTest`: `since` is set on entering, kept across a leave and a return within the kept time, and new after the seat ran out. `StreamsControllerTest`: `here` lists the seated with `since` and `mine`. `useRoomSession.test.ts`: `arrivedAt` by person id. | web unit / API unit / web layer |
| AC-10 | On staging, Android Chrome and iPhone Safari: live and with nobody live, the upright phone matches the design, and nothing scrolls sideways. Written in the PR. | manual |

## Rollout

- No settings, secrets or migrations.
- The API change only adds a field, and the web app copes without it. So the API and web images can reach staging in any order, and a rollback of either is safe.
- Merged to `main`, it reaches staging; Henrique checks AC-10 on two phones, then tags a release.
- Rollback: redeploy the previous images.
