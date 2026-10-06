# Player controls polish — plan

- Spec: [spec.md](spec.md) (approved 2026-10-06)
- Status: Approved (2026-10-06)

## Approach

Web only. The [preview](https://claude.ai/artifact/D8KcX27xta878WV3KhoKTb) Henrique approved is the reference for the look and the behaviour: the real code matches it, not just its layout.

**One family of round controls.** Today the round button styles and the menu (keyboard, outside click, Escape) live inside `StreamButtons`. They move into two small shared pieces:
- `RoundButton` styles: the pill, its states (lit, disabled), its tooltip, and one focus ring around the whole pill (`:has(:focus-visible)`), which fixes the ring that missed the arrow (FR-9).
- `PlayerMenu`: the popup with its ARIA roles, named groups, radio and action items, keyboard moves, outside click and Escape.

The screen and camera buttons, the new volume button and the new settings button are all built from them, so they look and behave the same.

**The row (FR-4).** `StreamButtons` becomes `PlayerButtons`: the centred row, in this order: volume, screen, camera, settings. The stage passes the viewer's part (volume and quality) only while someone else's stream is big; otherwise the row holds only screen and camera. The old viewer bar (`PlayerControls`) is deleted, and with it the container query that lifted the buttons above it.

**Volume (FR-5 to FR-7).** A round speaker button, with three icons (on, muted, crossed for no sound); a click mutes or unmutes.
- Pointing at it or focusing it opens a vertical slider above it, easing in. It closes 150 ms after the pointer leaves (so the pointer can travel to the slider) or when the focus leaves.
- No slider at all while muted, without sound, or where the page can't set the volume (iPhones).
- The slider is a real `<input type="range">` turned a quarter (`transform: rotate(-90deg)`), so the arrow keys and screen readers work as on any slider, and it's vertical in every browser. (`writing-mode` would need Chrome 124 or newer; older ones would draw it sideways and break the popup.)
- Open state is React state, not just CSS `:hover`, so it's testable, and the player keeps its controls shown while it's open, as it does for a menu.

**Settings (FR-8).** A gear button opening a `PlayerMenu` with one group, "Quality": Auto and the qualities this stream offers. Same choices and saving as the old select (`viewerQualities`, `effectiveQuality`, `saveWatchPrefs`).

**Staying on Xovê after the picker (FR-1).** Chrome's `CaptureController.setFocusBehavior("no-focus-change")`. The screen request gets a `controller`, and the call is made right when the picker answers, before anything else. The same applies to "Change window". Where `CaptureController` doesn't exist, nothing changes. TypeScript's DOM types don't know it yet, so a small typed declaration goes next to `screenCaptureRequest`.

**Fullscreen (FR-2).** In fullscreen only the fullscreen element and what's inside it are shown. A small `useFullscreenElement()` hook follows `fullscreenchange`. The room renders the setup window, and the error line that starting can show, through a React portal into that element while there is one (into the page otherwise). The setup window's backdrop is `position: fixed`, which inside a fullscreen element covers the screen, so its layout doesn't change.

**Texts and badge (FR-3, FR-10).**
- The setup window says "from the button's menu", and gives the sound hint the picker matches today: a tab, or a window with "Share this app's audio too".
- The no-sound badge on the screen button is removed; its tooltip and menu text stay.

Rejected:
- **Pure CSS hover for the slider:** simpler, but the chrome would fade under the pointer's slider, and it can't be tested.
- **Leaving fullscreen before the picker:** Henrique chose to stay in fullscreen.
- **A slider library or a hand-made slider:** a native range input already gives keyboard and screen-reader support.
- **Moving the setup window into the stage component:** it belongs to the room's start flow; a portal keeps it where it is and only changes where it's drawn.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `components/stage/RoundButton.module.css` (new), `PlayerMenu.tsx` (new) | The shared pill styles (with the whole-pill focus ring) and the shared menu. |
| Web | `components/stage/StreamButtons.tsx` → `PlayerButtons.tsx` | The centred row; screen and camera built from the shared pieces; no badge; volume and settings slots. |
| Web | `components/stage/VolumeButton.tsx` (new), `WatchSettings.tsx` (new) | The volume button with its vertical slider; the gear with the quality menu. |
| Web | `components/stage/PlayerControls.tsx` (+ CSS, test) | Deleted; its tests move to the two new components. |
| Web | `components/stage/Stage.tsx`, `Stage.module.css` | Gives the row the viewer's part while watching someone else; keeps the controls shown while the slider or a menu is open; drops the old bar and the container query. |
| Web | `hooks/useFullscreenElement.ts` (new), `pages/RoomPage.tsx` | The setup window and the error line drawn inside fullscreen. |
| Web | `components/share/ShareSetup.tsx` | Updated texts. |
| Web | `media/shareSettings.ts`, `hooks/useLiveKitRoom.ts` | A `CaptureController` in the screen request, and `setFocusBehavior("no-focus-change")` as soon as the picker answers (start and change window). |
| Web | `test/setup.ts`, `test/fakeLiveKit.ts` | A fake `CaptureController`, and fullscreen support for the tests. |
| Docs | `docs/architecture.md`, `docs/overview.md`, `docs/decisions.md` | The row, volume and settings buttons; decision 35. |
| Docs | `CLAUDE.md` | Test counts. |

No API, database, infra or setting change. Browser storage stays as it is (`xove.watch.*`).

## API and data

None.

## Risks

- **`setFocusBehavior` timing:** Chrome accepts the call only right after the picker answers. It's the first thing done after `getDisplayMedia` resolves, before any other `await`. An exception there is caught, so the worst case is today's behaviour. Checked on staging (AC-1).
- **The rotated slider:** a rotated element keeps its unrotated box, so the popup sizes it explicitly (its length as the popup's height). Checked by eye on staging (AC-10).
- **Portals and focus:** the setup window already gives the focus back to its opener on close; inside fullscreen the opener is in the same element, so that keeps working. Covered by a test.
- **The arrow and tooltip of the volume popup** could overlap the tooltip of the button. The tooltip hides while the slider is open, as the preview does.
- **Phones:** four round buttons are about 260px wide, which fits a 360px stage; below 520px they shrink to 42px, as in the preview.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `useLiveKitRoom.test.ts`: the request carries a controller, and `setFocusBehavior("no-focus-change")` is called once the picker answers (start and change window); no controller → nothing breaks. Manual on staging. | unit / manual |
| AC-2 | `RoomPage.test.tsx`: in fullscreen, the setup window is drawn inside the fullscreen element, which stays fullscreen; the error line too. Manual on staging. | web UI / manual |
| AC-3 | `RoomPage.test.tsx`: the setup window's hint and sound texts | web UI |
| AC-4 | `RoomPage.test.tsx`: watching someone, the row is volume, screen, camera, settings, in order; with nobody to watch, only screen and camera; no old bar | web UI |
| AC-5 | `VolumeButton.test.tsx`: mute and unmute; the slider on pointer enter and on focus, gone after leaving; changing it sets the volume; no slider while muted, without sound, or on iPhones | unit |
| AC-6 | `VolumeButton.test.tsx`: no sound → crossed, disabled, tooltip "No sound in this stream" | unit |
| AC-7 | `WatchSettings.test.tsx`: Auto and the offered qualities, the current one ticked, a pick reported; `RoomPage.test.tsx`: it reaches LiveKit and is remembered | unit / web UI |
| AC-8 | `PlayerButtons.test.tsx`: no badge; the tooltip and menu still explain no sound | unit |
| AC-9 | `PlayerButtons.test.tsx`, `VolumeButton.test.tsx`, `WatchSettings.test.tsx`: keyboard only (Tab, arrow keys on the slider and menu, Escape) and accessible names | unit |
| AC-10 | Staging, Chrome: matches the preview; slider eases in; the ring around the whole screen button; crossed speaker and its tooltip | manual |

## Rollout

Web only, no settings or secrets. Merge to `main`, Henrique checks AC-1, AC-2 and AC-10 on staging, then the next `v*` tag. Roll back with the release workflow's "Run workflow" button.
