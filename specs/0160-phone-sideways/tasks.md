# The room sideways on a phone, and tablets — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the checks on staging (T9), and the release tag.

## Core

- [ ] **T1** `layoutFor({ touch, small, portrait, narrowUpright })` and `useRoomLayout()`, replacing `usePhoneView`:
  - `useRoomLayout.test.ts`: a phone upright and sideways, a tablet upright and sideways, a desktop narrow and wide, and the hook following a change;
  - `Room` uses it; the upright view is unchanged (existing phone tests pass).
  - · covers FR-1, FR-2, FR-2a · verify: `useRoomLayout.test.ts`, `RoomPage.test.tsx`
- [ ] **T2** `useStageSwipe` `axis: "vertical"`: up and down drags call `onOpen` / `onClose` (via `swipeOutcome` with the axes swapped), with no picture motion; left and right do nothing. `useStageSwipe.test.tsx`. · covers FR-10, FR-12 · verify: `useStageSwipe.test.tsx`

## Pieces

- [ ] **T3** `StreamsRow`:
  - "Live now · N of 6", then one row of small pictures with names, scrolling sideways;
  - silent;
  - a tap calls `pick`;
  - `data-open` slides it;
  - the tab opens it while closed;
  - `data-no-swipe` on it.

  `StreamsRow.test.tsx`.
  - · covers FR-9, FR-10, FR-11 · verify: `StreamsRow.test.tsx`

## Wiring

- [ ] **T4** The sideways room:
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
- [ ] **T5** Fading sideways:
  - the stage layer listens for touches and carries `data-chrome`;
  - the top bar, buttons and tab fade with it;
  - an open row closes when the controls hide;
  - nothing fades over the empty stage.

  `RoomPage.test.tsx` (sideways) and `layout.test.ts`.
  - · covers FR-8 · verify: `cd web && npm test`
- [ ] **T6** The row in the room:
  - `StreamsRow` sideways, starting closed (and again each time the phone turns sideways);
  - the vertical swipe opens and closes it;
  - a tap changes the stage;
  - the row's sound isn't downloaded;
  - a left/right drag does nothing;
  - drags from the facecam or a button don't open it.

  `RoomPage.test.tsx` (sideways).
  - · covers FR-9–FR-12 · verify: `cd web && npm test && npm run build`
- [ ] **T7** Tablets upright: the phone layout's info row and scrolling block in a centred column at most 640 px wide. `layout.test.ts`. · covers FR-2b · verify: `layout.test.ts`

## Docs and review

- [ ] **T8** Docs:
  - `docs/architecture.md`: "On a phone or tablet", covering the rule, sideways, the row and tablets;
  - `docs/decisions.md`: decision 43;
  - `CLAUDE.md`: test counts.
  - Checked in the local Playwright harness against the design: phone upright, phone sideways (live, nobody live, row open), tablet upright and sideways.
  - · verify: the pages describe the new behaviour; the harness screenshots match the design
- [ ] **T9** Review every AC (`/review`), then the PR with `Closes #160`, `Closes #161`, `Closes #163`. Henrique checks AC-7 on staging: Android Chrome and iPhone Safari sideways, and a tablet. · verify: no gaps left; AC-7 written in the PR

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
