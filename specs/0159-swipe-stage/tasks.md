# Swipe the stage to change stream — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the check on two phones on staging (T7), and the release tag.

## Core

- [x] **T1** `stepOnStage(order, current, direction)` in `media/stagePick.ts`: next and previous in the feed's order, wrapping both ways; null with fewer than two people. `stagePick.test.ts`. · covers FR-1, FR-2 · verify: `stagePick.test.ts`
  - Done: `stepOnStage`; with nobody on the stage it starts from the first.
- [x] **T2** `swipeOutcome(dx, dy, ms, width)`: next, previous, or nothing.
  - Next or previous for at least 25% of the width, or a flick faster than 0.5 px/ms over at least 30 px.
  - Nothing when shorter, or mostly up and down.

  `useStageSwipe.test.ts`.
  - · covers FR-3, FR-6 · verify: `useStageSwipe.test.ts`
  - Done: `swipeOutcome` with `SWIPE_SHARE`, `FLICK_SPEED`, `FLICK_MIN_PX`.
- [x] **T3** `useStageSwipe(frameRef, { enabled, onStep })`:
  - pointer down, move and up on the frame, ignoring pointers that go down inside `[data-no-swipe]`;
  - `--swipe` set while dragging;
  - on a step: a slide out, then `onStep`, then a slide in, or `onStep` at once with reduced motion; otherwise a spring back.

  `useStageSwipe.test.ts` (with fake timers).
  - · covers FR-3, FR-6, FR-7 · verify: `useStageSwipe.test.tsx`
  - Done: `useStageSwipe(slide, { enabled, onStep })` returns pointer handlers for the frame; the wrapper moves with `--swipe` and `data-phase`.

## Pieces and wiring

- [ ] **T4** `StageDots`:
  - one button per person live, in the feed's order, with `aria-label="Watch <name>"` and `aria-current` on the stage's;
  - a tap calls `pick`;
  - nothing with fewer than two people;
  - the current one is a pill.

  `StageDots.test.tsx`.
  - · covers FR-4 · verify: `StageDots.test.tsx`
- [ ] **T5** The stage on the phone:
  - the `.slide` wrapper around the picture, with its transitions and `--swipe`;
  - `useStageSwipe` on the frame, enabled on the phone with at least two people live, stepping with `stepOnStage` and `pick`;
  - `data-no-swipe` on the controls layer and the facecam;
  - `touch-action: pan-y` on the phone;
  - `StageDots` above the round buttons, fading with them.

  `RoomPage.test.tsx` (phone):
  - swiping through three people and wrapping;
  - a short drag does nothing;
  - drags on the facecam or a round button don't change the stage;
  - after a swipe, the sound, the feed and `PUT /api/streams/watching` follow;
  - the dots jump.
  - · covers FR-1–FR-7 · verify: `cd web && npm test && npm run build`

## Docs and review

- [ ] **T6** `docs/architecture.md` ("On a phone held upright"): the swipe and the dots. `CLAUDE.md`: test counts. · verify: the page describes the new behaviour
- [ ] **T7** Review every AC (`/review`), then the PR with `Closes #159`. Henrique checks AC-6 on staging, on Android Chrome and iPhone Safari. · verify: no gaps left; AC-6 written in the PR

## Coverage

| Requirement | Task |
| --- | --- |
| FR-1, FR-2 | T1, T5 |
| FR-3 | T2, T3, T5 |
| FR-4 | T4, T5 |
| FR-5 | T5 |
| FR-6 | T2, T3, T5 |
| FR-7 | T3, T5 |
| AC-1 | T1, T5 |
| AC-2 | T2, T5 |
| AC-3 | T4 |
| AC-4 | T5 |
| AC-5 | T5 |
| AC-6 | T7 (manual on staging) |

Nothing uncovered.
