# The new Xovê mark, and a red, white, black and grey palette — plan

- Spec: [spec.md](spec.md) (approved 2026-10-07)
- Status: Approved (2026-10-07)

## Approach

**One source for the mark's geometry.** A pure module, `web/src/brand/mark.ts`, describes the wordmark and the icon on the design's grid, ported from [design.html](design.html):
- cap height 100 and stroke 10;
- letter widths X 88, O 100, V 90, E 68, with gaps of 20;
- the viewfinder's corners: 24 long, padded 28 from the letters;
- the O: a ring as thick as the letters, with the dot at r 29.4, as in the design;
- the X: square ends whose outer corners touch the cap line;
- the icon: the O with its corners 15 and 14 away across and 18 away up and down.

It returns plain shape data (lines, polylines, circles, the red corner), so the components and the favicon draw from the same numbers.

**Two components.** In `web/src/components/brand/`:
- `<XoveMark height>` draws the wordmark as inline SVG. It has `role="img"` and `aria-label="Xovê"`, and paints in `currentColor` with the red from the accent token. It replaces "xovê<span>.</span>" in the four places it appears: `RoomHeader`, `HomePage`, `RequestAccessPage` and `AdminPage`, where "admin" stays beside it.
- `<XoveIcon>` draws the symbol. It's ready for later use; nothing in the app uses it yet.

**The animation (FR-4a)** lives in a small hook, `useMarkAnimation`, which `XoveMark` uses. It follows the design's timeline:
- **Slide** (0.6 s): the four corner groups move horizontally, and a clip rectangle follows their inner edges, erasing the letters.
- **Settle** (0.38 s): the top and bottom corners move to the icon's spacing.
- **Blink:** the dot's vertical scale goes 1 → 0.06 → 1 twice, closing with an ease-in and opening with an ease-out. The second opening springs past 1 and settles.
- **The way back**, in reverse.

It runs from `pointerenter` and `focus` (the mark gets `tabIndex=0`), keeps a "playing" flag so a new hover doesn't restart it, and does nothing under `prefers-reduced-motion`. It drives `requestAnimationFrame` and sets SVG transforms on refs, so React doesn't re-render for each frame.

**Favicon and app icon (FR-4).** Vite copies `web/public/` to the site's root unchanged:
- `favicon.svg` is the icon, written from `mark.ts` by a small script (`web/scripts/brand-icons.mjs`) so it can't drift.
- `apple-touch-icon.png` (180 px) and `icon-192.png` / `icon-512.png` are rendered once from that SVG and committed. Phones need PNGs, and the build stays free of image tools. The script's header says how to regenerate them.
- `site.webmanifest` names Xovê and lists the PNGs, so Android shows the icon on the home screen.
- `index.html` links all of them, plus `theme-color`.
- Caddy already serves files at the root with `no-cache`, so a new icon shows up after a deploy.

**The palette (FR-5 to FR-8)** is mostly a change of tokens in `styles/global.css`:
- **Accent:** `--tally`, `--tally-ink` and `--tally-soft` become `--accent`, `--accent-ink` and `--accent-soft`, renamed in the 19 stylesheets that use them, since the name "tally amber" no longer fits. `--accent` is the LIVE red, `#ef4b4b`.
- **Neutral greys:** the ground, surfaces, lines and text tokens keep their lightness but lose the blue tint:
  - ground `#0c0c0d`, surface `#161617`, raised `#1e1e20`;
  - line `#2c2c2f`;
  - text `#ebebec`, muted `#9a9a9f`, faint `#66666b`.
- **Hard-coded literals:** the few colours not using tokens get neutral equivalents or move onto tokens:
  - the dark glass backgrounds (`rgba(8, 10, 14, …)`, `rgba(16, 20, 27, …)`, `rgba(9, 12, 17, …)`, `rgba(5, 7, 10, …)`);
  - the text greys in the dropdowns (`#c3ccd8`, `#aab4c4`, `#9aa5b6`, `#c9d1dc`);
  - the primary button's hover (`#f7bb5f`, which becomes a lighter red).
- **What stays:**
  - `--ok` (green) and `--warn` (yellow), which are status colours;
  - the avatars' per-person hues;
  - the empty stage's colour bars (a test card, where the colours are the point);
  - the Google button's own logo colours.

**Rejected:**
- **Typing the wordmark in a font:** none matched on the drafts, and the drawn mark looks the same everywhere.
- **The mark as an image file in the pages:** inline SVG takes the theme's colours, animates, and costs no request.
- **Generating the PNGs during the build:** that needs an image library (sharp or a headless browser) in CI for three files that rarely change.
- **CSS keyframes for the animation:** the corner positions depend on the letters' geometry, and the blink's spring is easier to get right in the same timeline as the slide.
- **Keeping the name `--tally`:** a renamed token is greppable, and the old name would mislead.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `web/src/brand/mark.ts` (new) | The mark's geometry: wordmark, icon, corner positions for the animation |
| Web | `web/src/components/brand/XoveMark.tsx`, `XoveIcon.tsx` (new) | Inline SVG from `mark.ts`; `role="img"`, `aria-label="Xovê"` |
| Web | `web/src/components/brand/useMarkAnimation.ts` (new) | Slide, settle, double blink, back; once per hover; none with reduced motion |
| Web | `RoomHeader`, `HomePage`, `RequestAccessPage`, `AdminPage` | The mark instead of "xovê."; the old `.logo` / `.dot` styles go |
| Web | `web/src/styles/global.css` | `--accent*` in red; neutral greys |
| Web | 19 stylesheets | `--tally*` → `--accent*`; blue-tinted literals → neutral; the button hover |
| Web | `web/public/` (new): `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` | The icon for the tab and the home screen |
| Web | `web/scripts/brand-icons.mjs` (new) | Writes `favicon.svg` from `mark.ts`; notes how the PNGs were made |
| Web | `web/index.html` | Icon, apple-touch-icon, manifest and theme-color links |
| Docs | `docs/architecture.md` | The mark, the icons, the palette tokens |
| Docs | `docs/decisions.md` | Decision 38: the mark and the palette |
| Docs | `CLAUDE.md` | Web test count |

## API and data

None.

## Risks

- **Contrast (FR-7):** the accent is used both as text and as a fill.
  - Red text on the dark ground is about 5:1, so it passes.
  - On red fills (primary buttons, the unseen count, the selected chips, WATCHING, LIVE), the text is a deep red, `--accent-ink: #3a0808`: tone on tone, about 4.7:1, so it passes. Decided with Henrique on a comparison ([text on red](https://claude.ai/artifact/Pgf6AjY2kypPDrpDFwWivM)); it also settles #110 for the LIVE badge.
- **Missed colours:** a literal hidden in a stylesheet would keep the old amber or blue. The AC-3 test reads every stylesheet and fails on the old values, so nothing slips through.
- **Animation cost:** a few transforms for three seconds, only on hover. No layout work.
- **Small sizes:** at the header's height (about 26 px) the slim stroke is about 2.6 px, which is crisp. The drafts checked it at 22 px.
- **Stale icons:** browsers cache favicons hard. Caddy's `no-cache` on root files helps; at worst the old blank tab icon stays until the cache clears.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `XoveMark.test.tsx`: renders an image named "Xovê" with the record O and the red corner. `RoomPage.test.tsx`, `AdminPage.test.tsx`, `RequestAccessPage.test.tsx` and a new `HomePage.test.tsx`: the page shows the mark (`getByRole("img", { name: "Xovê" })`), and "xovê." is gone | web UI |
| AC-1a | `useMarkAnimation.test.tsx`, with fake timers and `requestAnimationFrame`: a hover plays (corners move, then the dot squashes twice) and ends back at rest; a second hover while playing doesn't restart it; with reduced motion nothing moves. Staging: it looks like the design | web UI / manual |
| AC-2 | `brand.test.ts`: `index.html` links the favicon, the apple-touch-icon and the manifest; those files exist in `public/`; the manifest lists the PNGs; `favicon.svg` matches what `mark.ts` produces | unit |
| AC-3 | `palette.test.ts`: reads every `.css` file under `src/`. No old amber (`#f2a93b`, `#f7bb5f`, `242, 169, 59`), no old blue-tinted greys or glass values, and no `--tally`. The accent is `#ef4b4b` and its ink `#3a0808`; the LIVE badge uses that ink. `--ok`, `--warn` and the avatar formula are unchanged | unit |
| AC-4 | Staging: every page, dropdown, button and badge in the new palette; the mark at header size; the icon in the tab and on a phone's home screen | manual |

## Rollout

Web only, with no setting or secret. It reaches staging on merge and production with the next tag. Roll back with `release.yml`'s "Run workflow" button. The icons are static files, so they roll back with the image.
