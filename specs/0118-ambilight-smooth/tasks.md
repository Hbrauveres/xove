# The ambilight's hard edge, dark corners and visible bands — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the check on staging (T4), and the release tag. The lab (https://claude.ai/artifact/RLxgFJVPnZWPz81Rg8jU28, "Light") is the reference for the look and the timing.

## Core

- [x] **T1** Pure helpers in `media/ambilight.ts`, tests first:
  - `glowLayout(cols, rows)`: 2 px per cell, the 16-cell reach, a 3-cell margin, the stage rect and the placement;
  - `edgeDraws`: the nine rectangles, tiling the canvas, with corners from the picture's corners;
  - `falloff`;
  - `fadeMask`: zero at the reach and beyond, 255 under the stage, smooth outward, the same diagonally and straight, with a fixed grain;
  - `easeFor(dt, tau)`: time-based, with a floor of 0.12.
  - · covers FR-1, FR-2, FR-3, FR-4a · verify: `ambilight.test.ts`
  - Done: `glowLayout`, `edgeDraws`, `falloff`, `fadeMask` (seeded grain) and `easeFor` in `media/ambilight.ts`. 8 tests. The old helpers stay until T2.

## The component

- [x] **T2** `Ambilight.tsx` draws with the helpers:
  - edge and glow canvases;
  - the mask built once per grid;
  - per update, the nine draws at `easeFor`, then the blur copy and `destination-in` with the mask;
  - a `requestAnimationFrame` loop, every 500 ms with reduced motion;
  - pauses as before;
  - no pixel reads and no "unreadable" state.

  The old helpers (`edgeColors`, `easeColors`, `paintRing`, `FALLOFF`, `LED_COUNT`) go.
  - · covers FR-1–FR-5 · verify: `Ambilight.test.tsx` (one update per frame, slow with reduced motion, none when hidden, paused or off, no `getImageData`, the blur and the mask), `RoomPage.test.tsx` still green; `cd web && npm test && npm run build`
  - Done:
    - `Ambilight.tsx` draws the nine edge pieces at `easeFor(dt, 120 ms)`, blurs once and cuts with the mask (built once per grid);
    - it runs on `requestAnimationFrame` (capped at 60 a second, so faster screens keep the easing above its floor), or every 500 ms with reduced motion;
    - no pixel reads; old helpers and tests removed;
    - 10 component tests;
    - the real room rendered in headless Chrome: corners lit, smooth fade.

## Docs and review

- [x] **T3** Docs:
  - `docs/architecture.md` (ambilight): how it's drawn now;
  - `docs/decisions.md`: decision 40;
  - `CLAUDE.md`: the web test count.
  - · verify: the pages describe the new behaviour
  - Done: the ambilight section of `docs/architecture.md` rewritten, decision 40, the web count updated.
- [ ] **T4** Review every AC (`spec-reviewer`), fix what it finds, open the PR with `Closes #118`.
  - Henrique on staging (AC-5): maximum brightness on the 2K monitor, and the performance panel.
  - · verify: no gaps left; the manual AC written in the PR

## Coverage

| FR / AC | Task |
| --- | --- |
| FR-1, FR-2, FR-3 | T1, T2 |
| FR-4, FR-4a, FR-4b, FR-5 | T2 (T1 for the easing) |
| AC-1, AC-2, AC-3 | T1 (T2 for the blur) |
| AC-4 | T1, T2 |
| AC-5 | T4 (manual) |

Nothing uncovered.
