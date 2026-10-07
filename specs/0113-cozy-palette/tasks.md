# The cozy dark-blue palette, and a bare, larger favicon — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the checks on staging (T7), and the release tag. [design.html](design.html) is the reference for the colours, the animation and the symbol at each size.

## The palette

- [x] **T1** The test first, then the change:
  - `palette.test.ts` checks:
    - the board's tokens, with the nudged raised `#181f2a` and faint `#667083`;
    - that no 0111 neutral grey or glass is left;
    - that accent, status and avatar colours are unchanged;
    - each text token's contrast on ground, surface and raised, computed from the tokens (4.5:1, faint 3:1).
  - `global.css` gets the tokens; the glass, the dropdown greys and the two dark literals go back to the blue family.
  - `theme-color` and the manifest become `#0b0e13`.
  - · covers FR-1, FR-2, FR-3, FR-4 · verify: `palette.test.ts`, `brand.test.ts`; `cd web && npm test && npm run build`
  - Done: the board's tokens in `global.css`; 13 stylesheets back to the blue glass and greys; `theme-color` and the manifest `#0b0e13`. The test computes every text colour's contrast on ground, surface and raised. 3 tests new, 2 changed.

## The animation

- [ ] **T2** `mark.ts`'s closed positions:
  - the left corners stay;
  - a `textShift` brings the O to `ICON_SPACING.left` from the left frame line;
  - the right corners close to the O.
  - `XoveMark` gets the letters in an inner group under the clip; `useMarkAnimation` slides that group, keeps the clip's left edge, and moves only the right corners.
  - · covers FR-7, FR-3 · verify: `mark.test.ts`, `useMarkAnimation.test.tsx` (left corners always `translate(0,…)`, letters move left), `markTimeline.test.ts` unchanged

## The symbol by size

- [ ] **T3** `iconMark(optical)` in `mark.ts`:
  - `large` (stroke 10, about 70%);
  - `small` (stroke 12, about 84%);
  - `tiny` (stroke 16, longer arms, dot r 31, edge to edge).
  - The outer edges stay fixed in all three.
  - `XoveIcon` uses `large`.
  - · covers FR-6 · verify: `mark.test.ts` (each crop and stroke; the outer edges the same in all three)
- [ ] **T4** The icon files:
  - `iconSvg` writes the bare tiny symbol, with a `<style>` making its strokes white and `#0b0e13` under light mode, and the red fixed;
  - `--phone` gives the large symbol on `#0b0e13`;
  - `favicon.svg` regenerated; the three PNGs re-rendered and committed.
  - · covers FR-5, FR-6, FR-6a, FR-6b · verify: `brand.test.ts` (no background shape, tight square, the light-mode rule, the red fixed, equals `iconSvg()`); the PNGs checked by eye

## Check, docs and review

- [ ] **T5** Render pass in headless Chrome (room, dropdowns, home, admin): the pages look like the board, and nothing reads worse than the computed ratios.
  - · covers FR-1, FR-4, AC-3 (preview) · verify: screenshots; notes in the PR
- [ ] **T6** Docs:
  - `docs/architecture.md` ("The look"): the palette, the animation's direction, the symbol's sizes, the mode-aware favicon;
  - `docs/decisions.md`: decision 39;
  - `CLAUDE.md`: the web test count.
  - · verify: the pages describe the new behaviour
- [ ] **T7** Review every AC (`spec-reviewer`), fix what it finds, open the PR with `Closes #113`.
  - Henrique on staging (AC-1a, AC-2, AC-3):
    - the palette;
    - the animation;
    - the favicon in a dark and a light browser;
    - the phone icon.
  - · verify: no gaps left; manual ACs written in the PR

## Coverage

| FR / AC | Task |
| --- | --- |
| FR-1, FR-2 | T1, T5 |
| FR-3 | T1, T2 |
| FR-4 | T1, T5 |
| FR-5, FR-6a, FR-6b | T4 |
| FR-6 | T3, T4 |
| FR-7 | T2 |
| AC-1 | T1 |
| AC-1a | T2, T7 (manual) |
| AC-2 | T4, T7 (manual) |
| AC-3 | T5, T7 (manual) |

Nothing uncovered.
