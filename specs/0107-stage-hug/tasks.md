# A stage that hugs the picture, and a better info row — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the checks on staging (T8), and the release tag. [design.html](design.html) is the reference for every visual task: sizes, colours, fonts, timings and copy.

## Core

- [x] **T1** `useVideoShape(video)`: the picture's width ÷ height from a `<video>`.
  - It's 16:9 without a video, or until the size is known.
  - It follows `loadedmetadata` and `resize`, and ignores changes under 1%.
  - · covers FR-2, FR-3, FR-6 · verify: `useVideoShape.test.ts` (new)
  - Done: `hooks/useVideoShape.ts` with `WIDESCREEN`; 6 tests.
- [x] **T2** `gridFor(r)` in `media/ambilight.ts`:
  - square cells, 36 along the shorter side, the longer side to scale, capped at 96;
  - 64×36 at 16:9, 36×64 at 9:16.
  - `Ambilight` samples, paints and places with that grid, and is keyed by it.
  - · covers FR-5 · verify: `ambilight.test.ts#gridFor`, `Ambilight.test.tsx` still green
  - Done: `gridFor()`; `Ambilight` takes `shape` and reads, paints and places with its grid. 6 tests.

## The stage

- [x] **T3** The stage hugs the picture:
  - the shape from T1 goes to the box as `--shape`;
  - the stage is an inline-size container, and the box takes `min()` sizes, centred;
  - the frame fills it, with a 0.35 s transition (none with reduced motion);
  - the ambilight gets the shape;
  - empty and loading stay 16:9.
  - · covers FR-1–FR-6 · verify: `RoomPage.test.tsx#the stage takes the picture's shape` (wide, tall, empty, loading); `cd web && npm test && npm run build`
  - Done: `Stage` reads the shape from its big video into `--shape` (and `data-shape`); `.box` sizes with `min()` in container units, the frame fills it; the ambilight gets the shape. 1 page test; the hook keeps the shape per video (no state reset in an effect).

## The info row

- [x] **T4** `Avatar` gains `ring="inside"`, drawn inside the avatar. The info row becomes a flex row, centred on one line, and an inline-size container; the right side never runs past the box; phones stack as today.
  - · covers FR-7, FR-8 (ring), FR-10, FR-12 · verify: `Avatar` rendered with the option in `NowWatching.test.tsx`; build green
  - Done: `Avatar` `ring="inside"` (`data-ring`); `.info` a flex row and container, stacked on phones; `.now` grows, `.also` stops 280 px short of the left. 1 test.
- [x] **T5** `NowWatching`:
  - a 52 px avatar with the inner ring, the name, a filled LIVE badge, what's shared and for how long;
  - who's watching: up to 4 avatars side by side and "N watching", hidden when none. Container queries drop the words, then the avatars.
  - Empty: "The stage is *yours*." and `whoIsHere()` (three names, "and N others", alone "Nobody else is here yet.").
  - RoomPage passes the watchers (from `people` and `watchingOf`: me included, never the sharer) and the others in the room through `Stage`.
  - · covers FR-8, FR-10, FR-11 · verify: `NowWatching.test.tsx`, `RoomPage.test.tsx#who's watching the stage`
  - Done: `NowWatching` with the 52 px inner-ring avatar, filled LIVE, watchers (4 avatars, "N watching", container queries) and the invitation; `whoIsHere()` in its own file; RoomPage computes watchers and others. 8 tests; the page tests now look for "The stage is yours.".
- [x] **T6** `AlsoLive`:
  - no head; the previews in their own scroller, with the slim scrollbar;
  - the free box outside it, with "N of 6 live" / "M free · share yours", and gone when nothing is free;
  - the previews' sound and picking unchanged.
  - · covers FR-9, FR-10, FR-11 · verify: `AlsoLive.test.tsx`; `RoomPage.test.tsx` updated for the new copy
  - Done: no head; the list scrolls with the slim bar; the box (`data-free`) sits outside it with "N of 6 live" and the free places, gone when full. 2 tests changed, 2 page checks added.

## Docs

- [ ] **T7** Docs:
  - `docs/architecture.md` and `docs/overview.md`: the stage's shape, the light's grid, the info row;
  - `docs/decisions.md`: decision 37;
  - `CLAUDE.md`: the web test count.
  - · verify: the pages describe the new behaviour

## Review

- [ ] **T8** Review every AC (`spec-reviewer`), fix what it finds, open the PR with `Closes #107`.
  - Henrique on staging:
    - AC-3: a Steam window, then a portrait monitor;
    - AC-4: 1080p, 2K and a narrow window;
    - AC-8: a narrow window with previews.
  - · verify: no gaps left; manual ACs written in the PR

## Coverage

| FR / AC | Task |
| --- | --- |
| FR-1, FR-2, FR-4 | T3 (T1) |
| FR-3, FR-6 | T1, T3 |
| FR-5 | T2, T3 |
| FR-7 | T4 |
| FR-8 | T4, T5 |
| FR-9 | T6 |
| FR-10 | T4, T5, T6 |
| FR-11 | T5, T6 |
| FR-12 | T4 |
| AC-1 | T1, T2, T3 |
| AC-2 | T1 |
| AC-3, AC-4, AC-8 | T8 (manual) |
| AC-5 | T5 |
| AC-6 | T6 |
| AC-7 | T5, T6 |

Nothing uncovered.
