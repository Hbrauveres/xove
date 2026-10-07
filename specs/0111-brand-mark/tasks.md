# The new Xovê mark, and a red, white, black and grey palette — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the checks on staging (T9), and the release tag. [design.html](design.html) is the reference for the mark's shapes, spacing and animation; [text on red](https://claude.ai/artifact/Pgf6AjY2kypPDrpDFwWivM) for the ink on red fills.

## The mark

- [x] **T1** `brand/mark.ts`: the mark's geometry, ported from the design.
  - The letters: cap height 100, stroke 10, the X with square ends.
  - The O: ring and dot.
  - The viewfinder: the corners, with the red one at the top right.
  - The icon: the O with its own corner spacing.
  - The corner positions the animation moves to.
  - · covers FR-1, FR-2 · verify: `mark.test.ts` (new): the shapes' sizes and spacing, the red corner, the icon's spacing
  - Done: `brand/mark.ts` (`wordMark`, `iconMark`, `ICON_SPACING`, the closed positions); loads in Node too. 8 tests.
- [x] **T2** `XoveMark` and `XoveIcon`: inline SVG from `mark.ts`, with `role="img"`, `aria-label="Xovê"`, `currentColor` and the accent red.
  - · covers FR-1, FR-2, FR-3 · verify: `XoveMark.test.tsx` (new)
  - Done: `components/brand/XoveMark`, `XoveIcon` and shared `parts`; corners in `data-side` groups and letters in one group, ready for the animation. 3 tests.
- [x] **T3** `useMarkAnimation`, used by `XoveMark` (`tabIndex=0`):
  - the steps: slide, settle, double blink, back;
  - a hover or focus starts it, and one already playing isn't restarted;
  - nothing plays with reduced motion;
  - it moves refs, without re-rendering.
  - · covers FR-4a · verify: `useMarkAnimation.test.tsx` (new, fake timers and `requestAnimationFrame`)
  - Done: the timeline as a pure function (`brand/markTimeline.ts`, 6 tests, including one that no frame jumps); `useMarkAnimation` applies it to the corner groups, the letters' clip and the dot (4 tests). The second blink's spring now flows into the settle (the draft jumped there).
- [x] **T4** The mark replaces "xovê." in `RoomHeader`, `HomePage`, `RequestAccessPage` and `AdminPage` (where "admin" stays beside it). The old `.logo` / `.dot` styles go.
  - · covers FR-3 · verify: `RoomPage.test.tsx`, `AdminPage.test.tsx`, `RequestAccessPage.test.tsx`, `HomePage.test.tsx` (new): the image "Xovê" is shown and "xovê." is gone
  - Done: the mark at 32 px (room header), 40 (home), 36 (request access) and 30 beside "admin"; the old `.dot` styles gone. 4 page checks.
- [x] **T5** The icons:
  - `scripts/brand-icons.mjs` writes `public/favicon.svg` from `mark.ts`;
  - the 180, 192 and 512 px PNGs are rendered from it and committed;
  - `site.webmanifest`;
  - `index.html` links the icon, the apple-touch-icon, the manifest and `theme-color`.
  - · covers FR-4 · verify: `brand.test.ts` (new): the links, the files, the manifest's icons, `favicon.svg` matching `mark.ts`
  - Done: `brand/iconSvg.ts` (the symbol on a dark tile); `scripts/brand-icons.mjs` writes the favicon (and prints the square SVG for the PNGs); 3 PNGs, the manifest and the `index.html` links. 4 tests.

## The palette

- [ ] **T6** The test first, then the change:
  - `palette.test.ts` reads every stylesheet;
  - `global.css`:
    - `--accent` `#ef4b4b`, `--accent-ink` `#3a0808` and `--accent-soft`;
    - the neutral greys;
    - `--ok` and `--warn` unchanged.
  - `--tally*` is renamed to `--accent*` in every stylesheet;
  - the blue-tinted literals (the glass backgrounds, the dropdown text greys) become neutral;
  - the primary button's hover becomes a lighter red;
  - the LIVE badge's text uses the accent ink.
  - · covers FR-5, FR-6, FR-7, FR-8 · verify: `palette.test.ts` (new); `cd web && npm test && npm run build`
- [ ] **T7** Contrast pass: in a headless Chrome render of the room, the home page and the admin page, nothing reads worse than before:
  - text on surfaces;
  - red text on the ground;
  - ink on red fills.
  - · covers FR-7 · verify: screenshots compared with the old palette; ratios noted in the PR

## Docs

- [ ] **T8** Docs:
  - `docs/architecture.md`: the mark, the icons and how to regenerate them, the palette tokens;
  - `docs/decisions.md`: decision 38;
  - `CLAUDE.md`: the web test count.
  - · verify: the pages describe the new behaviour

## Review

- [ ] **T9** Review every AC (`spec-reviewer`), fix what it finds, open the PR with `Closes #111` and `Closes #110`.
  - Henrique on staging (AC-4, AC-1a):
    - every page, dropdown, button and badge in the new palette;
    - the mark at header size, and its animation;
    - the icon in the tab and on a phone's home screen.
  - · verify: no gaps left; manual ACs written in the PR

## Coverage

| FR / AC | Task |
| --- | --- |
| FR-1 | T1, T2 |
| FR-2 | T1, T2 |
| FR-3 | T2, T4 |
| FR-4 | T5 |
| FR-4a | T3 |
| FR-5, FR-6, FR-8 | T6 |
| FR-7 | T6, T7 |
| AC-1 | T2, T4 |
| AC-1a | T3, T9 (manual) |
| AC-2 | T5 |
| AC-3 | T6 |
| AC-4 | T9 (manual) |

Nothing uncovered.
