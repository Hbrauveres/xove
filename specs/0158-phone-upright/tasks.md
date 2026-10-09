# The room upright on a phone — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the check on two real phones on staging (T13), and the release tag. The reference is [design.html](design.html), its upright phone.

## Core

- [x] **T1** The API remembers when each person arrived, tests first:
  - `RoomSeatsTest`:
    - a seat's `since` is set when it's given;
    - it's kept across a leave and a return within the kept time;
    - it's new after the seat ran out;
    - `arrivals()` lists every seat;
  - `StreamsControllerTest`: `GET /api/streams` has `here: [{ userId, since, mine }]` for everyone seated;
  - then `Seat.since`, `RoomSeats.arrivals()`, and `StreamsView.here`.
  - · covers FR-19 · verify: `cd api && ./mvnw test`
  - Done: `Seat.since`, `RoomSeats.arrivals()`, `StreamsView.here`; 5 tests; API suite 168 green.
- [x] **T2** The web reads it: `here` in `api/types.ts` (optional, for an older API); `useRoomSession` exposes `arrivedAt` by person id ("me", "user-42"). `useRoomSession.test.ts`: mapped by id, and empty without `here`. · covers FR-19 · verify: `useRoomSession.test.ts`
  - Done: `here` in the streams state (optional); `arrivedAt` by person id in the session.
- [x] **T3** `hereFor(sinceMs, nowMs)`: "just arrived" under a minute, "here N min", "here 1 h 5 min". `hereFor.test.ts`. · covers FR-18, FR-19 · verify: `hereFor.test.ts`
  - Done: `hereFor` in `stage/hereFor.ts`; on the hour it says "here 1 h".
- [x] **T4** `usePhoneView`: true for a window up to 760 px wide that is at least as tall as it is wide, following changes. `usePhoneView.test.ts` with a mocked `matchMedia`: 390×844 and 760×1000 true; 800×1000 and 844×390 false; a change re-renders. · covers FR-1 · verify: `usePhoneView.test.ts`
  - Done: `usePhoneView` and `PHONE_QUERY` (`max-width: 760px` and portrait).

## Pieces

- [x] **T5** `ActivityBell`: a round bell button opening the same dropdown and `ActivityList` as the pill, with no count, no dot and no unseen tracking. `ActivityBell.test.tsx`. · covers FR-4 · verify: `ActivityBell.test.tsx`
  - Done: `ActivityBell`, a round bell opening the same `ActivityList`, never counting.
- [x] **T6** The footer's items in the account menu:
  - `RoomFooter` exports `FooterItems`;
  - `AccountButton` gets an optional `footer` slot, shown at the end of the menu;
  - `AccountButton.test.tsx`: the menu ends with "Made by Hbrauveres", Buy me a coffee, GitHub and LinkedIn when given.
  - · covers FR-6 · verify: `AccountButton.test.tsx`
  - Done: `FooterItems` shared by the footer and the account menu's new `footer` slot.
- [x] **T7** `NowWatching` `compact`:
  - the 30 px avatar with its ring inside;
  - "Name · what" in bold;
  - the filled LIVE badge, the time in mono (muted grey), and "N watching" in words;
  - with no sharer, "Nobody live" and "0 of 6 · 6 free".
  - `NowWatching.test.tsx`: both cases. The desktop's rendering is unchanged (existing tests).
  - · covers FR-10, FR-17 · verify: `NowWatching.test.tsx`
  - Done: `NowWatching` `compact` (and `level`, `free`); `STREAM_PLACES` = 6.
- [x] **T8** `LiveFeed`:
  - "Live now" with "N of 6";
  - a card for every sharer except the one on the stage: a full-width 16:9 picture with nothing over it, then the compact `NowWatching` block;
  - no sound controls; a tap calls `pick`.

  `LiveFeed.test.tsx`.
  - · covers FR-11, FR-12, FR-13, FR-14 · verify: `LiveFeed.test.tsx`
  - Done: `LiveFeed`; its pictures join the video frames allowed pure black in `palette.test.ts`.
- [x] **T9** `HereCards`:
  - "Here" with the count;
  - a soft card per person: avatar, name, and `hereFor` (ticking every 30 s);
  - me first as "Name (you)", the others with "WAITING".

  `HereCards.test.tsx`, with fake timers for the tick.
  - · covers FR-18, FR-19 · verify: `HereCards.test.tsx`
  - Done: `HereCards`; no time shown for someone the API doesn't list yet.
- [x] **T10** The glowing colour bars:
  - `EmptyStage`'s colours in one exported list, at full colour (desktop too);
  - the line "Turn on your camera with the button below." when a screen can't be shared;
  - `Ambilight` takes a still canvas and draws it once (no loop); `Stage` passes it whenever the stage is empty, desktop and phone;
  - `Ambilight.test.tsx`: a still picture is drawn once and shown;
  - `EmptyStage` test: the camera-only line.
  - · covers FR-15, FR-16 · verify: `Ambilight.test.tsx`, `EmptyStage.test.tsx`
  - Done: full-colour `BARS` with `barsPicture()`; `Ambilight` `still`; `Stage` lights the empty stage on desktop and phone; the line sits above the buttons.

## Wiring

- [x] **T11** The phone layout in the room:
  - `Room` uses `usePhoneView` and sets `data-layout="phone"`;
  - on the phone:
    - the header's middle is empty, and its right side is people, `ActivityBell`, then `AccountButton` with the footer's items;
    - there's no `RoomFooter`;
  - `Stage` gets `layout="phone"`:
    - no LIVE badge over the stage;
    - under it, the compact `NowWatching`, then `LiveFeed`, or `HereCards` with nobody live;
    - the bars' glow on an empty stage;
    - the feed's sound left muted;
  - CSS:
    - `100dvh`, with only the block under the stage scrolling (`overflow-y: auto`);
    - the stage full width, edge to edge, its box capped at 60dvh with the hug formula;
    - the top bar: the wordmark as tall as the avatar, on one line with the right side.
  - Tests:
    - `RoomPage.test.tsx` (phone): the header's order, no footer, the same `<video>` element after switching layouts, the feed or the cards;
    - `Stage.test.tsx` (phone): no LIVE badge, the feed's sharers get `setSoundOn(false)`, nobody live shows the bars, "Nobody live" and the cards;
    - `layout.test.ts` (reads the CSS): `100dvh`, the scrolling block, the 60dvh cap.
  - · covers FR-1, FR-2, FR-3, FR-5, FR-6, FR-7, FR-8, FR-9, FR-14a, FR-18a · verify: `cd web && npm test && npm run build`
  - Done: `Room` follows `usePhoneView`; the phone's header, no footer, `Stage` `layout="phone"` with the compact row and the feed or the cards; the phone's CSS. The stage's checks live in `RoomPage.test.tsx` (phone: header order, footer items, nobody live, the silent feed, the same `<video>` when turning) and `layout.test.ts`. The stage never had a LIVE badge over it: it's in the info row.

## Docs and review

- [x] **T12** Docs:
  - `docs/architecture.md`:
    - "Watching": the phone view (when it applies, the top bar, the pinned stage, the feed, nobody live with the cards, the bars' glow);
    - "API": `here` in the streams state;
  - `CLAUDE.md`: test counts.
  - · verify: the pages describe the new behaviour
  - Done: "Watching" has the phone view and the lit bars; the API table has `here`; decision 42; test counts (API 168, web 415).
- [x] **T13** Review every AC (`/review`), then the PR with `Closes #158`. Henrique checks AC-10 on staging, on Android Chrome and iPhone Safari. · verify: no gaps left; AC-10 written in the PR
  - Done: review fixed: the feed stays silent after turning (a preview unmuted on desktop), tests for the full-colour bars, the lit empty stage (desktop and phone) and no LIVE badge on the stage, `here` only for seated members, formatting churn reverted. AC-10 is in the PR for Henrique.

## Coverage

| Requirement | Task |
| --- | --- |
| FR-1 | T4, T11 |
| FR-2 | T11 |
| FR-3, FR-5 | T11 |
| FR-4 | T5 |
| FR-6 | T6, T11 |
| FR-7, FR-8, FR-9 | T11 |
| FR-10 | T7 |
| FR-11, FR-12, FR-13, FR-14 | T8 |
| FR-14a | T11 |
| FR-15, FR-16 | T10 |
| FR-17 | T7 |
| FR-18 | T3, T9 |
| FR-18a | T11 |
| FR-19 | T1, T2, T3, T9 |
| AC-1 | T4, T11 (manual playback on a phone: T13) |
| AC-2 | T5, T11 |
| AC-3 | T6, T11 |
| AC-4 | T11 |
| AC-5 | T7, T11 |
| AC-6 | T8, T11 |
| AC-7 | T8, T11 |
| AC-8 | T7, T9, T10, T11 |
| AC-9 | T1, T2, T3, T9 |
| AC-10 | T13 (manual on staging) |

Nothing uncovered.
