# The cozy dark-blue palette, and a bare, larger favicon — plan

- Spec: [spec.md](spec.md) (approved 2026-10-07)
- Status: Approved (2026-10-07)

> **Changed the same day:** Henrique committed to black instead of the dark blue (see spec, Decisions). The tokens become 0111's black with raised `#1b1b1d`; the glass and dropdown greys stay 0111's neutral values; the icon files' ground and light-mode ink are `#0c0c0d`. Everything else in this plan stands.

## Approach

**Palette (FR-1 to FR-4)** — a change of tokens, as in spec 0111, the other way.

The tokens in `web/src/styles/global.css` become the board's colours:

| Token | Colour |
| --- | --- |
| `--ground` | `#0b0e13` |
| `--surface` | `#10141b` |
| `--surface-raised` | `#181f2a` |
| `--line` | `#222b38` |
| `--text` | `#e7ebf1` |
| `--text-muted` | `#8b96a8` |
| `--text-faint` | `#667083` |

`--accent`, `--accent-ink`, `--live`, `--ok` and `--warn` stay.

The literals that 0111 made neutral go back to the blue family:
- **Glass:** `rgba(10, 10, 11, …)` → `rgba(8, 10, 14, …)`, `rgba(20, 20, 21, …)` → `rgba(16, 20, 27, …)`, `rgba(12, 12, 13, …)` → `rgba(9, 12, 17, …)`, `rgba(7, 7, 8, …)` → `rgba(5, 7, 10, …)`.
- **The dropdowns' text greys:** `#cacacd` → `#c3ccd8`, `#b3b3b8` → `#aab4c4`, `#a4a4a9` → `#9aa5b6`, `#d0d0d3` → `#c9d1dc`.
- **Two dark literals:** `#070708` → `#05070a`, `#131314` → `#10141b`.

`index.html`'s `theme-color` and the manifest's colours become `#0b0e13`.

`palette.test.ts` flips: it now fails on the neutral values and checks the board's.

**Contrast (FR-4).** With the board's raised surface (`#1c2430`) and faint grey (`#5d6778`), two pairs fell short: faint on raised (2.7:1) and red on raised (4.3:1). Henrique chose to adjust the palette, without leaving it. The raised surface becomes `#181f2a` and the faint grey `#667083`, both on the same hue and saturation, a few points apart in lightness. Every pair now passes on every surface: text 13.8+, muted 5.5+, faint 3.3+ (3:1 for minor labels), red 4.6+. The token values above use these two.

**Animation (FR-7)** — only where things move. The timeline (`markTimeline.ts`) stays: same steps, timings and blink.
- `mark.ts`'s `closed` positions change:
  - the left corners don't move (`dx.left = 0`);
  - a new `textShift` slides the letters left, until the O sits `ICON_SPACING.left` from the left frame line;
  - `dx.right` brings the right corners to the O's right edge plus `ICON_SPACING.right`.
- `XoveMark` puts the letters in an inner group, so the clip (on the outer group) stays put while the letters move under it.
- `useMarkAnimation` moves that inner group by `textShift × slide`, keeps the clip's left edge fixed, and moves only the right side.

**The symbol by size (FR-5, FR-6, FR-6a, FR-6b).**
- **Geometry:** `iconMark()` takes an optical size: `"large"` (stroke 10, the current one), `"small"` (32 px: stroke 12) or `"tiny"` (16 px: stroke 16, longer arms, dot r 31).
  - The corners' outer edges stay where the icon has them, so heavier strokes grow inward.
  - Each returns a square crop: about 70% for large, 84% for small, edge to edge for tiny.
- **`favicon.svg`** becomes the tiny symbol with no background.
  - Its strokes carry a class.
  - A `<style>` in the file sets them white, and `#0b0e13` under `@media (prefers-color-scheme: light)`, which browsers apply to SVG favicons.
  - The red is fixed.
  - Browsers draw the tab at 16 CSS px (32 device pixels on a sharp screen) from this one file, so tiny is right for both.
- **Phone PNGs** (180, 192, 512) become the large symbol on `#0b0e13`, at about 70%. `scripts/brand-icons.mjs --phone` prints that SVG; they're rendered and committed as before.
- `XoveIcon` (unused in the app so far) uses the large version.

**Rejected:**
- **Separate favicon files for 16 and 32 px:** browsers pick one SVG for the tab, and a PNG pair loses the light and dark switch.
- **Moving the few labels that fall short instead of nudging two colours:** every future label on a raised surface would have to remember the exception.
- **A brighter red:** red is the mark's and LIVE's colour, and a lighter red would weaken the ink on red fills.
- **Moving the corners in JavaScript per size instead of in `mark.ts`:** the favicon script needs the same numbers.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `web/src/styles/global.css` | The board's tokens |
| Web | the stylesheets 0111 neutralised | Glass and dropdown greys back to the blue family |
| Web | `web/src/styles/palette.test.ts` | Checks the board's colours; fails on 0111's neutrals |
| Web | `web/src/brand/mark.ts` | `closed`: left fixed, `textShift`, right to the O; `iconMark(optical)` with large, small and tiny |
| Web | `web/src/components/brand/XoveMark.tsx`, `useMarkAnimation.ts` | Letters in an inner group that slides; left corners still |
| Web | `web/src/brand/iconSvg.ts`, `web/scripts/brand-icons.mjs` | Bare, mode-aware tiny favicon; `--phone` for the large symbol on dark blue |
| Web | `web/public/` | New `favicon.svg`; three PNGs re-rendered; manifest colours |
| Web | `web/index.html` | `theme-color` `#0b0e13` |
| Docs | `docs/architecture.md` ("The look"), `docs/decisions.md` | The palette, the animation's direction, the symbol's sizes; decision 39 |
| Docs | `CLAUDE.md` | Web test count |

## API and data

None.

## Risks

- **Contrast:** the ratios are computed in `palette.test.ts` from the tokens, so a later change that breaks them fails the test.
- **The favicon's light mode:** Chrome, Edge and Firefox apply `prefers-color-scheme` inside SVG favicons. Safari ignores SVG favicons in tabs and shows the apple-touch-icon (the dark blue tile), which reads on light and dark alike.
- **Animation regressions:** the timeline is unchanged, so only the positions can go wrong. `mark.test.ts` checks the closed positions against the icon's spacing, and `useMarkAnimation.test.tsx` checks that the left corners never move.
- **Caching:** the favicon keeps its name. Browsers cache favicons hard, so the old tile may linger for a while; Caddy serves it with `no-cache`.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `palette.test.ts`: the tokens are the board's (with the two nudged values); no 0111 neutral greys or glass; accent, status and avatar colours unchanged; every text token passes its minimum on ground, surface and raised, computed from the tokens | unit |
| AC-1 | Contrast pass in headless Chrome (room, dropdowns, home, admin); ratios in the PR | manual |
| AC-1a | `mark.test.ts`: when closed, the left corners stay, the O sits `ICON_SPACING.left` from the left frame line, and the right corners meet the O. `useMarkAnimation.test.tsx`: during the slide the left corners stay at `translate(0,…)`, the letters move left, and the right corners move left; it settles, blinks and returns to rest. `markTimeline.test.ts` unchanged and still green | unit / web UI |
| AC-1a | Staging: it looks like the design | manual |
| AC-2 | `brand.test.ts`: `favicon.svg` has no background shape; its viewBox is a tight square (tiny, edge to edge); it has the light-mode rule switching the strokes to `#0b0e13`; the red is fixed; it equals `iconSvg()`. The manifest and `theme-color` are `#0b0e13` | unit |
| AC-2 | The PNGs' look: rendered, checked by eye, and on a phone on staging | manual |
| AC-3 | Staging: the pages feel like the board; the bare favicon in a dark and a light tab | manual |

## Rollout

Web only, no setting or secret. It reaches staging on merge and production with the next tag. Roll back with `release.yml`'s "Run workflow" button.
