# The room sideways on a phone, and tablets — plan

- Spec: [spec.md](spec.md) (approved 2026-10-09)
- Status: Approved (2026-10-09)

## Approach

Web only, building on spec 0158's single room with layouts around a stage that never moves in the tree.

**Which layout (FR-1, FR-2, FR-2a, FR-3).**
- `usePhoneView` (a boolean) becomes `useRoomLayout()`, returning `"desktop" | "upright" | "sideways"` from four media queries, followed for changes:
  - `(pointer: coarse)`: a touch screen is the main pointer;
  - `(max-width: 500px), (max-height: 500px)`: the screen's shorter side is at most 500 px;
  - `(orientation: portrait)`;
  - today's `PHONE_QUERY`: narrow and upright.
- The rule, as a pure function `layoutFor({ touch, small, portrait, narrowUpright })`:

  | Device | Upright | Sideways |
  | --- | --- | --- |
  | Phone (`touch` and `small`) | `upright` | `sideways` |
  | Tablet (`touch`, not `small`) | `upright` | `desktop` |
  | Anything else | `upright` if `narrowUpright`, else `desktop` | `desktop` |

- `Room` passes the layout down. `data-layout` on the page is `phone` (upright, as in 0158, so its CSS and tests stay) or `sideways`. `Stage` gets `layout: "phone" | "sideways" | undefined`.
- The stage keeps its place in the tree in all three layouts, so turning never remounts the video (FR-3). Only the pieces around it change.

**The sideways room (FR-4 to FR-7).**
- `Room` renders no header and no footer when sideways. The people button, the bell and the account button move into the stage's top bar: `Room` passes them to `Stage` as a new `topRight` node.
- **`Stage`, sideways,** fills the screen (`100dvh`) as one layer, with its parts over the picture:
  - **the box:** as tall as the screen, hugging the picture (`width: min(100vw, 100dvh × shape)`), centred, black at its sides. The ambilight keeps its place around the box, so it glows in the side space (FR-4).
  - **the top bar:** a black gradient fading downward, across the whole screen (not just the box). On its left, the compact `NowWatching` (spec 0158's info row: avatar, "Name · what", LIVE, time, watching, or "Nobody live · 0 of 6 · 6 free"); on its right, `topRight` (FR-5, FR-7).
  - **the round buttons:** at the bottom of the stage, centred, unchanged (FR-6).
  - **the streams row:** at the bottom of the screen (below).
- **The panels** open under their buttons as today. Sideways they get `max-height: calc(100dvh - 64px)` and scroll inside (FR-5).
- **Sideways, the info row under the stage, the feed and the Here cards aren't rendered.** The row replaces the feed; nobody live shows only the bars and the top line.

**Fading (FR-8).**
- Today the stage's controls fade from `data-chrome` on the frame, driven by pointer moves and taps on the frame.
- Sideways, the whole stage layer (`section`) listens for pointer moves and taps, so a touch on the black side space counts too. It carries `data-chrome` as well, and the CSS fades the top bar, the round buttons and the row's tab with it.
- When the controls hide, an open row closes (an effect on `chromeShown`).
- Over the empty stage `data-chrome` isn't set (as today), so nothing fades.

**The streams row (FR-9 to FR-12).**
- A new `StreamsRow` component, shown only sideways:
  - "Live now · N of 6" above one sideways-scrolling row of small 16:9 pictures (about 104 px wide), each with the person's name over its bottom edge;
  - silent, with no sound props, like `LiveFeed`: the stage's existing effect keeps everyone's sound off but the stage's on the phone layouts;
  - a tap calls `pick` (FR-11).
- It sits at the bottom of the screen over a black gradient fading upward. `data-open` slides it in or out with `transform: translateY`, with no slide under reduced motion.
- **The tab:** a small handle at the bottom edge while the row is closed. It shows and fades with the other controls, and a tap opens the row (FR-10).
- **Opening and closing (FR-10, FR-12):**
  - `useStageSwipe` gets an `axis` option. With `axis: "vertical"` it reads up and down drags with the same `swipeOutcome` (axes swapped): up opens, down closes, with no picture motion.
  - Sideways, the stage uses the vertical axis only, so a left/right drag does nothing.
  - `data-no-swipe` already guards the facecam and the buttons, and the row gets it too.
- The row starts closed each time the phone turns sideways (state in `Stage`, reset when the layout changes).

**Tablets upright (FR-2b).**
- CSS only, under the phone layout: on screens wider than 500 px, the stage stays full width with its 60% cap, while the info row and the scrolling block below it get `max-width: 640px` and `margin-inline: auto`.

**Rejected:**

| Alternative | Why not |
| --- | --- |
| Detecting phones from the user agent | Brittle and spoofable; touch plus screen size is what the layout actually depends on. |
| Keeping the room's header sideways, made see-through | It's sized and placed for a page, outside the stage, so it couldn't fade with the stage's controls or span the side bars as one gradient. |
| Rendering the top bar inside the stage's frame | The frame hugs the picture, so a portrait camera would leave the gradient and the buttons narrower than the screen. |
| A left/right swipe sideways too | The spec gives changing streams to the row (FR-12), and a horizontal swipe fights with scrolling the row. |

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `hooks/usePhoneView.ts` → `hooks/useRoomLayout.ts` (+ test) | `layoutFor` and `useRoomLayout` |
| Web | `pages/RoomPage.tsx`, `.module.css` | The three layouts; sideways: no header or footer, the top bar's right side handed to `Stage` |
| Web | `components/stage/Stage.tsx`, `.module.css` | `layout: "sideways"`: the full-screen layer, the top bar, chrome on the layer, the row, the vertical swipe, the row closing with the controls; the tablet column |
| Web | `components/stage/StreamsRow.tsx`, `.module.css` (+ test, new) | The row and its tab |
| Web | `hooks/useStageSwipe.ts` (+ test) | `axis: "vertical"`, with open and close callbacks |
| Web | `components/ui/Dropdown.module.css` | Sideways: a max height and scrolling |
| Docs | `docs/architecture.md` | "On a phone held upright" becomes "On a phone or tablet": the rule, sideways, the row, tablets |
| Docs | `docs/decisions.md`, `CLAUDE.md` | Decision 43; test counts |

## API and data

None.

## Risks

| Risk | How the plan handles it |
| --- | --- |
| **`pointer: coarse` on touch laptops,** whose main pointer is still the mouse. | `(pointer: coarse)` describes the main pointer, so they report `fine` and keep the desktop rules. |
| **Fading an ancestor of an open panel stops its blur** (`Dropdown.module.css` warns against it). | An open panel holds the controls shown (as menus already do), so the bar is at full opacity, with no fade, while a panel is open. Checked in the harness. |
| **iPhone Safari's toolbars** change `100dvh` sideways. | `dvh` follows them. Checked on an iPhone (AC-7). |
| **Fullscreen sideways.** | The fullscreen button stays on the frame; fullscreen still shows the frame only, as today. |
| **A swipe up fights with pull-to-refresh or the browser's own bars.** | `touch-action: none` on the sideways frame: a drag there is ours. Checked on Android (AC-7). |

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `useRoomLayout.test.ts`: `layoutFor` for a phone upright and sideways, a tablet upright and sideways, a desktop narrow and wide; the hook follows a change. `RoomPage.test.tsx`: turning between upright and sideways keeps the same `<video>`. | web unit / web UI |
| AC-1a | `layout.test.ts`: the phone layout's info and scrolling block have `max-width: 640px` and centre. Manual on a tablet. | web unit / manual |
| AC-2 | `RoomPage.test.tsx` (sideways): no header, logo or footer; the top line with the person's info and, on the right, people, the bell and my account. `layout.test.ts`: the sideways box's height-first size. | web UI / web unit |
| AC-3 | `RoomPage.test.tsx` (sideways, nobody live): the bars, "Nobody live", "0 of 6 · 6 free", the camera button. | web UI |
| AC-4 | `RoomPage.test.tsx` (sideways): with a stream, after the idle time the stage layer is `data-chrome="hidden"` and an open row has closed; a touch shows them again; with nobody live there's no `data-chrome`. `layout.test.ts`: the top bar, buttons and tab fade under `data-chrome="hidden"`. | web UI / web unit |
| AC-5 | `StreamsRow.test.tsx`: the heading, the pictures with names, a tap calls `pick`, no sound controls, the tab opens it. `RoomPage.test.tsx` (sideways): closed at first, opened by a swipe up, closed by a swipe down, a tap changes the stage, the row's sound isn't downloaded. `useStageSwipe.test.tsx`: the vertical axis. | web UI / web unit |
| AC-6 | `RoomPage.test.tsx` (sideways): a left/right drag doesn't change the stream; drags starting on the facecam or a button don't open the row. | web UI |
| AC-7 | On staging: Android Chrome and iPhone Safari sideways, and a tablet (or tablet emulation) upright and sideways. Written in the PR. | manual |

Every view is also checked in the local Playwright harness against the design before the PR.

## Rollout

- Web only: no settings, secrets or migrations.
- Merged to `main`, it reaches staging; Henrique checks AC-7, then tags a release.
- Rollback: redeploy the previous web image.
