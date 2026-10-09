# The room sideways on a phone, and tablets — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the checks on staging (T9), and the release tag.

## Core

- [x] **T1** `layoutFor({ touch, small, portrait, narrowUpright })` and `useRoomLayout()`, replacing `usePhoneView`:
  - `useRoomLayout.test.ts`: a phone upright and sideways, a tablet upright and sideways, a desktop narrow and wide, and the hook following a change;
  - `Room` uses it; the upright view is unchanged (existing phone tests pass).
  - · covers FR-1, FR-2, FR-2a · verify: `useRoomLayout.test.ts`, `RoomPage.test.tsx`
  - Done: `useRoomLayout` with `layoutFor` and four queries (`PHONE_QUERY` is now `NARROW_UPRIGHT_QUERY`); `Room` uses it, with the upright view unchanged.
- [x] **T2** `useStageSwipe` `axis: "vertical"`: up and down drags call `onOpen` / `onClose` (via `swipeOutcome` with the axes swapped), with no picture motion; left and right do nothing. `useStageSwipe.test.tsx`. · covers FR-10, FR-12 · verify: `useStageSwipe.test.tsx`
  - Done: `axis: "vertical"` with `onOpen` and `onClose`; `onStep` optional.

## Pieces

- [x] **T3** `StreamsRow`:
  - "Live now · N of 6", then one row of small pictures with names, scrolling sideways;
  - silent;
  - a tap calls `pick`;
  - `data-open` slides it;
  - the tab opens it while closed;
  - `data-no-swipe` on it.

  `StreamsRow.test.tsx`.
  - · covers FR-9, FR-10, FR-11 · verify: `StreamsRow.test.tsx`
  - Done: `StreamsRow`; closed, it's `inert` and hidden from screen readers; its pictures join the video frames allowed pure black.

## Wiring

- [x] **T4** The sideways room:
  - `Room`: no header or footer sideways, and `topRight` (people, bell, account) handed to `Stage`;
  - `Stage` `layout="sideways"`:
    - the full-screen layer with the height-first box;
    - the top bar (the compact `NowWatching` and `topRight`);
    - the round buttons;
    - no info row, feed or cards;
    - panels capped at the screen's height.

  `RoomPage.test.tsx` (sideways):
  - no header, logo or footer;
  - the top line, live and with nobody live;
  - the same `<video>` when turning.

  `layout.test.ts`: the box's size.
  - · covers FR-3, FR-4, FR-5, FR-6, FR-7 · verify: `cd web && npm test && npm run build`
  - Done: `Room` without header or footer sideways, my buttons handed to `Stage` as `topRight`; `Stage` `layout="sideways"`: the full-screen layer, the height-first box, the top bar; the fullscreen button moves to the bottom right and the round buttons sit higher, clear of the tab (seen in the harness). The panels are capped sideways (`--panel-max`, scrolling inside).
- [x] **T5** Fading sideways:
  - the stage layer listens for touches and carries `data-chrome`;
  - the top bar, buttons and tab fade with it;
  - an open row closes when the controls hide;
  - nothing fades over the empty stage.

  `RoomPage.test.tsx` (sideways) and `layout.test.ts`.
  - · covers FR-8 · verify: `cd web && npm test`
  - Done: the stage layer takes the touches and carries `data-chrome`; `[data-fades]` on the top bar and the tab; an open row closes when the controls hide.
- [x] **T6** The row in the room:
  - `StreamsRow` sideways, starting closed (and again each time the phone turns sideways);
  - the vertical swipe opens and closes it;
  - a tap changes the stage;
  - the row's sound isn't downloaded;
  - a left/right drag does nothing;
  - drags from the facecam or a button don't open it.

  `RoomPage.test.tsx` (sideways).
  - · covers FR-9–FR-12 · verify: `cd web && npm test && npm run build`
  - Done: `StreamsRow` sideways, closed at first and on each turn; the vertical swipe (a second `useStageSwipe`); 6 room tests.
- [x] **T7** Tablets upright: the phone layout's info row and scrolling block in a centred column at most 640 px wide. `layout.test.ts`. · covers FR-2b · verify: `layout.test.ts`
  - Done: the centred 640 px column for the info row and the block under it.

## Docs and review

- [x] **T8** Docs:
  - `docs/architecture.md`: "On a phone or tablet", covering the rule, sideways, the row and tablets;
  - `docs/decisions.md`: decision 43;
  - `CLAUDE.md`: test counts.
  - Checked in the local Playwright harness against the design: phone upright, phone sideways (live, nobody live, row open), tablet upright and sideways.
  - · verify: the pages describe the new behaviour; the harness screenshots match the design
  - Done: "On a phone or tablet" in the architecture page, decision 43, web count 465. Harness (Playwright, real `RoomPage` with fakes): phone upright, sideways live, nobody live, a portrait camera, the row opened by a swipe up and closed after idling, tablet upright (640 px column) and sideways (desktop).
- [x] **T9** Review every AC (`/review`), then the PR with `Closes #160`, `Closes #161`, `Closes #163`. Henrique checks AC-7 on staging: Android Chrome and iPhone Safari sideways, and a tablet. · verify: no gaps left; AC-7 written in the PR
  - Done: review fixed:
    - an open panel (or focus in the top bar) keeps the controls shown;
    - the panels capped to the screen and scrolling;
    - no row from the empty stage, and no tab with nobody else live;
    - the row opens only from a drag on the picture;
    - the controls show when turning sideways.

    Tests for each, and the panel checked at 667 × 375 in the harness. AC-7 is in the PR.

## After the first check on a phone

- [x] **T10** FR-13 to FR-15 (added 2026-10-09):
  - `usePageFullscreen`: the first lifted tap on a phone or tablet, upright or sideways, asks for the page's fullscreen, again after a turn if it was left;
  - `useFullscreenElement` ignores the page's fullscreen, and the stage's button enlarges the player from it;
  - the manifest's display is `fullscreen`, with Apple's meta tags;
  - the setup window, sideways, shows its preview left and settings right.

  Tests: `usePageFullscreen.test.ts`, `useFullscreenElement.test.ts`, `brand.test.ts`, `layout.test.ts`, `RoomPage.test.tsx`. Checked in the harness at 915 × 412 and 667 × 375: no scroll. · covers FR-13, FR-14, FR-15, AC-8, AC-9, AC-10 · verify: `cd web && npm test && npm run build`

- [x] **T11** After the second phone check (2026-10-09):
  - sound unlocks on the first tap or key (`room.startAudio()`);
  - no pull-to-refresh (`overscroll-behavior: none`), restored with spec 0171 (phones use the home-screen app);
  - the row's tab replaced by an arrow button at the bottom left (up opens, down on the row closes);
  - left and right swipes change the stream sideways too.

  Tests: `useLiveKitRoom.test.ts`, `layout.test.ts`, `StreamsRow.test.tsx`, `RoomPage.test.tsx`; checked in the harness. · covers FR-10, FR-12, AC-5, AC-6 · verify: `cd web && npm test && npm run build`

- [x] **T12** Before #171: the tap-to-fullscreen removed (`usePageFullscreen`), since a browser tab can't keep it and the home-screen app will be the way in; the dots show sideways too. Tests: `RoomPage.test.tsx` (the dots sideways); the hook's tests removed with it. · covers FR-13 (removed), FR-12 · verify: `cd web && npm test && npm run build`

## Coverage

| Requirement | Task |
| --- | --- |
| FR-1, FR-2, FR-2a | T1 |
| FR-2b | T7 |
| FR-3 | T1, T4 |
| FR-4, FR-5, FR-6, FR-7 | T4 |
| FR-8 | T5 |
| FR-9, FR-10, FR-11 | T3, T6 |
| FR-12 | T2, T6 |
| AC-1 | T1, T4 |
| AC-1a | T7 |
| AC-2, AC-3 | T4 |
| AC-4 | T5 |
| AC-5 | T3, T6 |
| AC-6 | T6 |
| AC-7 | T9 (manual on staging) |

Nothing uncovered.
