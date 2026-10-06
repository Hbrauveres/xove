# Player controls polish — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the checks on staging (T9), and the release tag. The [preview](https://claude.ai/artifact/D8KcX27xta878WV3KhoKTb) is the reference for every visual task.

## Core

- [x] **T1** Stay on Xovê after the picker: a `CaptureController` in the screen request (with its own small type), and `setFocusBehavior("no-focus-change")` as soon as the picker answers, for a start and for "Change window"; nothing breaks without it. Fake controller in the tests · covers FR-1 · verify: `shareSettings.test.ts`, `useLiveKitRoom.test.ts`
  - Done: `newCaptureController()` in `shareSettings.ts`; `pickScreen()` in `useLiveKitRoom.ts` serves both a start and "Change window", and asks right after the answer. 4 tests.
- [x] **T2** Shared pieces, no visible change yet: `RoundButton.module.css` (pill, lit, disabled, tooltip, one focus ring around the whole pill) and `PlayerMenu` (ARIA menu, named groups, radio and action items, arrow keys, Escape, outside click, waiting while busy), taken out of `StreamButtons`, which now uses them · covers FR-9, FR-11 · verify: `StreamButtons.test.tsx` unchanged and green; `PlayerMenu.test.tsx` (new)
  - Done: `RoundButton.module.css` and `PlayerMenu` (with its items); each menu now sits above its own button, no taller than the stage (`.frame` is a size container, `100cqh`). 4 tests.
- [x] **T3** `VolumeButton`: round speaker (on, muted, crossed); click mutes or unmutes; a vertical slider (a rotated range input) eases in on pointer or focus and goes 150 ms after leaving; none while muted, without sound, or on iPhones; crossed, disabled and "No sound in this stream" without sound · covers FR-5, FR-6, FR-7, FR-11 · verify: `VolumeButton.test.tsx` (new)
  - Done: `VolumeButton` on the shared pill; the slider is a turned range input in a capsule that eases in and out (kept mounted, `inert` while closed), after the button in Tab order. 6 tests.
- [x] **T4** `WatchSettings`: a gear opening a `PlayerMenu` with "Quality": Auto and the offered qualities, the current one ticked, a pick reported · covers FR-8, FR-11 · verify: `WatchSettings.test.tsx` (new)
  - Done: `WatchSettings`, a gear on the shared pill with a `PlayerMenu`; a pick closes it and gives the focus back to the gear. 5 tests.

## Wiring

- [ ] **T5** The row: `StreamButtons` becomes `PlayerButtons` with the volume and settings slots, in the order volume, screen, camera, settings. The stage fills them only while someone else's stream is big, and keeps the controls shown while the slider or a menu is open. `PlayerControls` and the old bar are deleted, with the container query; the no-sound badge goes. Room tests move to the new buttons · covers FR-4, FR-7, FR-8, FR-10 · verify: `PlayerButtons.test.tsx`, `RoomPage.test.tsx`
- [ ] **T6** Fullscreen: `useFullscreenElement()`; the room draws the setup window and the error line inside the fullscreen element while there is one · covers FR-2 · verify: `RoomPage.test.tsx`
- [ ] **T7** The setup window's texts: "from the button's menu", and today's sound hint · covers FR-3 · verify: `RoomPage.test.tsx`

## Docs and review

- [ ] **T8** Docs: the row, volume and settings in `docs/architecture.md` and `docs/overview.md`; decision 35 in `docs/decisions.md`; test counts in `CLAUDE.md` · verify: the pages describe the new behaviour
- [ ] **T9** Review every AC (`/review`), fix what it finds, open the PR with `Closes #101`. Then on staging after merge, written in the PR (Henrique, Chrome):
  - picking a window stays on Xovê with the setup window open (AC-1);
  - in fullscreen, share and camera show the setup window over the player (AC-2);
  - the row matches the preview, the slider eases in, the ring goes around the whole screen button, the crossed speaker and its tooltip (AC-10).
  - · verify: no gaps left; every check written in the PR

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T1, T9 |
| FR-2 | T6, T9 |
| FR-3 | T7 |
| FR-4 | T5 |
| FR-5, FR-6 | T3, T9 |
| FR-7 | T3, T5 |
| FR-8 | T4, T5 |
| FR-9 | T2, T9 |
| FR-10 | T5 |
| FR-11 | T2, T3, T4 |
| AC-1 | T1, T9 |
| AC-2 | T6, T9 |
| AC-3 | T7 |
| AC-4 | T5 |
| AC-5 | T3 |
| AC-6 | T3 |
| AC-7 | T4, T5 |
| AC-8 | T5 |
| AC-9 | T2, T3, T4 |
| AC-10 | T9 |

Nothing uncovered. The look and the easing (AC-10) and Chrome really staying on Xovê (AC-1) can only be seen in a real browser: staging, T9.
