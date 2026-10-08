# Soft black ground, white sliders and a red-knob switch — plan

- Spec: [spec.md](spec.md) (approved 2026-10-07)
- Status: Approved (2026-10-07)

## Approach

**The ground (FR-1 to FR-3): a change of one value, everywhere the ground is written.**

- `--ground` in `web/src/styles/global.css` becomes `#0c0c0d`. Every page follows it through the token.
- The places that can't read the token change by hand, to the same value:
  - `index.html`'s `theme-color`;
  - the manifest's `background_color` and `theme_color`;
  - `GROUND` in `brand/iconSvg.ts`.
- The icon files are regenerated from `iconSvg.ts`:
  - `favicon.svg` with `node scripts/brand-icons.mjs`;
  - the three phone PNGs rendered from `--phone`, as in spec 0113.
- The `#000` behind the video stays (spec, Decisions):
  - in `Stage`, `ScreenVideo`, `Facecam`, `AlsoLive` and `ShareSetup`;
  - the palette test lists those five as the only places pure black may appear, so a new one can't slip in as a ground.
- The other tokens don't change. The contrast test already computes every pair from the tokens, so it covers FR-3.

**The sliders (FR-4, FR-5): one shared, styled range input.**

- A new `components/ui/Range` (with `Range.module.css`) renders a plain `<input type="range">` and passes every prop through.
- It adds one thing: a `--fill` custom property, the value's position as a percentage of `min`–`max`, set on each render.
- The stylesheet draws the board's slider on the native input:
  - **WebKit:** the track (`::-webkit-slider-runnable-track`) is 3 px, round, with a background of white up to `--fill` and `#ebebec` at 22% after. The thumb (`::-webkit-slider-thumb`) is a 12 px white circle, centred on the track.
  - **Firefox:** the same, with `::-moz-range-track`, `::-moz-range-progress` (the white fill, no variable needed) and `::-moz-range-thumb`.
  - **Hover and keyboard focus:** the thumb grows to 14 px.
  - **Focus:** the focus ring stays.
  - **Disabled:** the input keeps today's dimmed look.
- The three sliders use it:
  - the ambilight's brightness in `AccountButton`;
  - the stage's volume in `VolumeButton`, still turned a quarter, so it stays vertical;
  - a preview's volume in `AlsoLive`.
- Their own stylesheets keep only size and placement, and lose `accent-color: var(--accent)`.

**The switch (FR-6, FR-7): the same button, new CSS.**

- `AccountButton`'s switch keeps its markup: a `button` with `role="switch"`, `aria-checked`, and an `<i>` knob.
- In `AccountButton.module.css`:
  - the button stays 36 × 20 px, so it's as easy to hit as today, with a transparent background;
  - a `::before` draws the 36 × 14 px grey `#3a3a3d` track, centred, the same in both states;
  - the `<i>` becomes the 20 px knob, with a soft shadow, `#bdbdc0` off and `--accent` on;
  - the knob starts 2 px past the track's left end and moves 20 px (overhanging both ends, as on the board), in 180 ms, with `transform` and `background` transitions; reduced motion turns the transition off, as today.
- Its focus ring changes from red to the text colour, as on the board.

**The footer (FR-8).** In `RoomFooter.module.css`, `.coffee` changes from `var(--accent)` to `var(--text)`.

**Rejected:**

| Alternative | Why not |
| --- | --- |
| A custom slider (divs and pointer events), as drawn on the board | Rebuilds the keyboard, screen-reader and touch behaviour that the native range input already has, and the vertical volume would need its own maths. |
| Colouring the sliders with `accent-color: #fff` | Browsers draw their own thumb and track shapes: no thin 3 px track, no faint rest, no growing knob. |
| Styling each slider in its own stylesheet | Three copies of the vendor rules, which would drift. |
| A new token for the switch's grey | It's used once, and `palette.test.ts` already lists literals by purpose. A token can come when a second control needs it. |

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `web/src/styles/global.css` | `--ground: #0c0c0d` |
| Web | `web/index.html`, `web/public/site.webmanifest` | Theme and manifest colours `#0c0c0d` |
| Web | `web/src/brand/iconSvg.ts` | `GROUND = "#0c0c0d"` |
| Web | `web/public/favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Regenerated |
| Web | `web/src/components/ui/Range.tsx`, `Range.module.css` (new) | The white slider, with `--fill` |
| Web | `AccountButton.tsx` and `.module.css` | Use `Range`; the new switch |
| Web | `VolumeButton.tsx`, `AlsoLive.tsx` and their stylesheets | Use `Range`; drop `accent-color` |
| Web | `RoomFooter.module.css` | Coffee in the text colour |
| Web | `styles/palette.test.ts`, `brand/brand.test.ts` | The new ground, and pure black only behind the video |
| Web | `components/ui/Range.test.tsx` (new), `styles/controls.test.ts` (new) | The slider, the switch and the coffee link |
| Docs | `docs/architecture.md` ("The look"), `docs/decisions.md` | The ground, the controls; decision 41 |
| Docs | `CLAUDE.md` | Web test count |

## API and data

None.

## Risks

| Risk | How the plan handles it |
| --- | --- |
| **Vendor pseudo-elements differ between browsers.** WebKit has no "progress" part, hence `--fill`. A rule that mixes WebKit and Firefox selectors is dropped whole by both browsers. | Each vendor's rules stay in their own block. Checked by hand in Chrome and Firefox on staging. |
| **`--fill` out of step with the value.** | `Range` computes it from the same `value`, `min` and `max` it renders, on every render. A test covers the ends and the middle. |
| **The vertical volume.** It's a range input turned −90°; the track and thumb turn with it. | Only colours and sizes change, not the turn. Checked on staging. |
| **The phone PNGs.** They're rendered by hand. | `brand.test.ts` reads each PNG's first pixel and fails unless it's the new ground. |

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `palette.test.ts`: the ground is `#0c0c0d`, and `#000` appears only in the five video frames. `brand.test.ts`: `theme-color`, the manifest, the favicon's light-mode strokes, the phone SVG's ground and each PNG's first pixel are `#0c0c0d`. | web unit |
| AC-2 | `palette.test.ts`: the other tokens unchanged; contrast computed on every surface, the new ground included. | web unit |
| AC-3 | `Range.test.tsx`: props pass through, and `--fill` is right at the ends and the middle. `controls.test.ts`: `Range.module.css` has the 3 px track, white fill and thumb, `#ebebec` at 22%, a 12 px thumb growing to 14 px, and no `--accent`; the three slider stylesheets have no `accent-color`. Existing `AccountButton`, `VolumeButton` and `AlsoLive` tests: keyboard and values still work. | web unit / web UI |
| AC-4 | `controls.test.ts`: the switch's track is 36 × 14 `#3a3a3d` in both states, and the knob is 20 px, `#bdbdc0` off and `--accent` on. Existing `AccountButton` tests: role, `aria-checked` and toggling. | web unit / web UI |
| AC-5 | `controls.test.ts`: `.coffee` uses `var(--text)`, not the accent. | web unit |
| AC-6 | On staging: the room, the account menu, the stage's and a preview's volume, and the footer look like the board, in Chrome and Firefox. | manual |

## Rollout

- Web only: no settings, secrets or migrations.
- Merged to `main`, it reaches staging; Henrique checks AC-6, then tags a release.
- Rollback is the usual one: redeploy the previous image.
- The favicon and phone icons may stay cached in browsers for a while. That's harmless: they only differ by the ground's shade.
