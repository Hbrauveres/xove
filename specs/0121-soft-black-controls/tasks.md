# Soft black ground, white sliders and a red-knob switch — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the check on staging (T7), and the release tag. The identity board (https://claude.ai/artifact/Jgsv3cDXn6FogBPDHsEgGb, its black palette and Controls section) is the reference, kept as [design.html](design.html).

## Core

- [x] **T1** The soft black ground, tests first:
  - `palette.test.ts`:
    - the ground is `#0c0c0d`;
    - pure black (`#000`) appears only in the five video frames: `Stage`, `ScreenVideo`, `Facecam`, `AlsoLive`, `ShareSetup`;
  - `brand.test.ts`: `theme-color`, the manifest, the favicon's light-mode strokes, the phone SVG's ground and each PNG's first pixel are `#0c0c0d`;
  - then change `--ground`, `index.html`, `site.webmanifest`, `GROUND` in `iconSvg.ts`;
  - regenerate `favicon.svg` (`node scripts/brand-icons.mjs`) and the three phone PNGs (from `--phone`).
  - · covers FR-1, FR-2, FR-3 · verify: `palette.test.ts`, `brand.test.ts`; `cd web && npm test && npm run build`
  - Done: `--ground`, theme colour, manifest and `iconSvg.ts` at `#0c0c0d`; favicon and phone PNGs regenerated; a test keeps `#000` to the five video frames.
- [x] **T2** `components/ui/Range`, the white slider, tests first:
  - `Range.test.tsx`: renders a range input, passes props through (label, min, max, step, value, disabled, onChange, className), and sets `--fill` right at the ends and the middle;
  - `controls.test.ts` (new): `Range.module.css` has the 3 px round track, the white fill (via `--fill` in WebKit, `::-moz-range-progress` in Firefox), `#ebebec` at 22% for the rest, a 12 px white thumb growing to 14 px on hover and focus, a focus ring, the dimmed disabled look, and no `--accent`;
  - each vendor's rules in their own blocks.
  - · covers FR-4, FR-5 · verify: `Range.test.tsx`, `controls.test.ts`
  - Done: `Range` sets `--fill` (clamped) and passes props through; `Range.module.css` draws the board's slider for WebKit and Firefox. 7 tests.

## Wiring

- [ ] **T3** The three sliders use `Range`:
  - `AccountButton` (ambilight brightness), `VolumeButton` (vertical, still turned a quarter), `AlsoLive` (preview volume);
  - their stylesheets keep only size and placement, and drop `accent-color`;
  - `controls.test.ts`: no `accent-color` left in the three.
  - · covers FR-4, FR-5 · verify: `controls.test.ts`, existing `AccountButton`, `VolumeButton` and `AlsoLive` tests; `npm test && npm run build`
- [ ] **T4** The switch, in `AccountButton.module.css`:
  - the button stays 36 × 20 px with a transparent background;
  - a `::before` track, 36 × 14 px, `#3a3a3d`, centred, the same in both states;
  - the `<i>` knob, 20 px with a soft shadow, `#bdbdc0` off and `var(--accent)` on, moving 16 px in 180 ms;
  - no transition with reduced motion;
  - the focus ring in the text colour;
  - `controls.test.ts` checks these values.
  - · covers FR-6, FR-7 · verify: `controls.test.ts`, existing `AccountButton` tests (role, `aria-checked`, toggling)
- [ ] **T5** "Buy me a coffee" in the text colour: `.coffee` uses `var(--text)`; `controls.test.ts` checks it. · covers FR-8 · verify: `controls.test.ts`

## Docs

- [ ] **T6** Docs:
  - `docs/architecture.md` "The look": the soft black ground, pure black only behind the video, the controls (white `Range`, the switch), the coffee link, and the reference in 0121's design;
  - `docs/decisions.md`: decision 40;
  - `CLAUDE.md`: the web test count.
  - · verify: the pages describe the new look

## Review

- [ ] **T7** Review every AC (`/review`), then the PR with `Closes #121`. Henrique checks AC-6 on staging (Chrome and Firefox). · verify: no gaps left; AC-6 written in the PR

## Coverage

| Requirement | Task |
| --- | --- |
| FR-1, FR-2, FR-3 | T1 |
| FR-4, FR-5 | T2, T3 |
| FR-6, FR-7 | T4 |
| FR-8 | T5 |
| AC-1, AC-2 | T1 |
| AC-3 | T2, T3 |
| AC-4 | T4 |
| AC-5 | T5 |
| AC-6 | T7 (manual on staging) |

Nothing uncovered.
