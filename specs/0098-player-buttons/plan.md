# Share and camera buttons on the player — plan

- Spec: [spec.md](spec.md) (approved 2026-10-05)
- Status: Approved (2026-10-05)

## Approach

Web only. The bar under the player (`ShareControls`) becomes a small row of round buttons drawn by the stage itself, inside the player's overlay, so they fade, stay while focused and follow fullscreen exactly like the LIVE label and the viewer's bar already do (spec 0086). The clickable preview ([artifact](https://claude.ai/artifact/D8KcX27xta878WV3KhoKTb)) is the visual reference.

**The buttons and menus.** A new `StreamButtons` component: one `StreamButton` per kind (screen, camera) with its icon, lit state, tooltip, the no-sound badge, and, while live, an arrow that opens a `StreamMenu`. The menu is a plain popup with ARIA menu roles (`menu`, `menuitemradio`, `menuitem`), opened with the arrow, moved through with the arrow keys and closed with Escape or a click outside, focus going back to the arrow. Quality and mode items call the same `setPrefs` the player bar uses today, so live changes keep going through the API (spec 0086 FR-7). The menu's text colour comes from its own surface, not the button's, so a lit button can't make it unreadable (FR-11).

**Change window.** The screen is re-picked with the same browser request as a start (spec 0095), then swapped into the tracks already published: `replaceTrack` on the screen's video keeps its LiveKit publication and track id, so the API's stream and the viewers' players don't notice (no stop, no webhook). Sound follows the new pick:

| Before | After the new pick | What happens |
| --- | --- | --- |
| sound | sound | `replaceTrack` on the sound track |
| no sound | sound | publish a new screen-sound track |
| sound | no sound | unpublish the sound track (the webhook ignores sound tracks, so the stream stays) |

The content hint and the "browser ended the capture" handling move to the new track. Closing the picker does nothing.

**Pick a camera.** The camera menu lists the browser's cameras (`enumerateDevices`, refreshed on `devicechange`). Picking one restarts the published camera track on that device (`restartTrack({ deviceId })`): same publication, no stop. The pick is saved as `xove.camera.device` and used by the next camera start; a saved camera that's gone falls back to the default.

**No sound for viewers (FR-15).** Each sharer already carries `hasSound`. When a screen has none, the viewer's volume control (and that stream's thumbnail control) shows muted and is disabled, with "This screen is shared without sound" as its name. The viewer's saved volume isn't touched, so it comes back when sound arrives.

**Fullscreen (FR-18).** The stage tracks `document.fullscreenElement` (`fullscreenchange`). The button enters or leaves fullscreen and is named "Fullscreen" or "Exit fullscreen".

**Thumbnails (FR-19, FR-20).** The row is centred under the player with `justify-content: safe center`, so it centres when the thumbnails fit and still starts at the left edge and scrolls when they don't. The ring was cut because a row that scrolls sideways also clips what's drawn outside its edges: the ring moves inside each thumbnail (an inset ring), so nothing can clip or cover it.

**Removed:** `ShareControls` and the sharer's quality and mode fields on their own player (`ShareSettingsFields` stays for the setup window). The empty stage keeps its title and text but loses its big "Share my screen" button, since the round buttons sit right there. The screen button is hidden when `navigator.mediaDevices.getDisplayMedia` doesn't exist (FR-16).

Rejected:
- **Keep the buttons outside the player, just restyled:** they wouldn't fade or show in fullscreen (FR-4).
- **Stop and start again for "Change window":** viewers see the stream end and come back, and the API logs a new stream.
- **A menu library** (Radix and similar): one more dependency for two small menus; the ARIA pattern is short.
- **Unpublishing the camera and publishing a new one to switch cameras:** the same stop-and-start blip.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `components/stage/StreamButtons.tsx` (new), `StreamMenu.tsx` (new), CSS modules | The round buttons, tooltips, badge, arrow and menus. Inline SVG icons, like the player's. |
| Web | `components/stage/Stage.tsx`, `StageOverlay.tsx` | Draw the buttons at the bottom centre of the overlay, also on the empty stage (never fading there); drop my player's settings fields; fullscreen toggle and its name. |
| Web | `components/stage/EmptyStage.tsx` | No button, just the title and text. |
| Web | `components/stage/PlayerControls.tsx`, `Thumbnails.tsx` | Muted and disabled volume for a screen without sound. |
| Web | `components/stage/Thumbnails.module.css` | Centred row; the hover and focus ring drawn inside each thumbnail. |
| Web | `components/controls/ShareControls.tsx` (+ CSS) | Deleted. |
| Web | `pages/RoomPage.tsx` | The stage gets what the bar had (`mine`, `free`, `busy`, `noSound`, start, stop) plus change window and pick camera. |
| Web | `hooks/useRoomSession.ts`, `hooks/useLiveKitRoom.ts` | `changeScreen()`: re-pick and swap the tracks. `cameras` and `pickCamera(deviceId)`: list and switch. |
| Web | `media/preferences.ts`, `media/shareSettings.ts` | `xove.camera.device`; `cameraCaptureOptions(deviceId?)`. |
| Web | `test/fakeLiveKit.ts` | `replaceTrack`, `restartTrack`, the camera list, and fullscreen in jsdom. |
| Docs | `docs/architecture.md`, `docs/overview.md`, `docs/decisions.md` | The controls on the player; decision 34 (on the player, arrow menus, swap without stopping). |
| Docs | `CLAUDE.md` | Test counts. |

No API, database or infra change.

## API and data

None. The API keeps one stream per published track; "Change window" and "pick a camera" keep the same track, so it sees nothing. One new browser setting: `xove.camera.device` (this browser's camera).

## Risks

- **`replaceTrack` on a screen share** must keep the layers (1080p, 720p, 480p) and the cap. LiveKit re-encodes the new track with the same sender settings; the tests check the cap and content hint are applied again, and AC-5 checks it by eye on staging.
- **The browser's "Stop sharing" bar after a swap:** LiveKit listens for the end of whichever track it holds; the "ended" listener we add ourselves (the camera's) moves to the new track. Tested with the fake.
- **A swap during a pending start or stop:** the buttons and menu items wait while busy (FR-14), so a swap can't overlap a start.
- **Menus near the edge of a small stage:** the menu opens upward and is kept inside the stage; checked at phone width in the tests' layout and on staging.
- **Facecam over the buttons:** the facecam's default place is the lower right, clear of the centre; it can still be dragged over them, and the buttons stay on top.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `RoomPage.test.tsx`: no "Screen sharing" bar; the buttons' names, pressed state and tooltip, off and live | web UI |
| AC-2 | `RoomPage.test.tsx`: start through picker, setup and Start; stop with a click (existing start and stop tests moved to the new buttons) | web UI |
| AC-3 | `Stage.test.tsx` (new): always shown on an empty stage; fade after `CHROME_IDLE_MS` over a stream; stay while focused or a menu is open | web UI |
| AC-4 | `StreamButtons.test.tsx` (new): arrow only when live; the menu items of FR-7; `RoomPage.test.tsx`: a quality change reaches the API and the track | unit / web UI |
| AC-5 | `RoomPage.test.tsx`: "Change window" replaces the video on the same publication, and sound per the table above; a closed picker changes nothing. Manual on staging | web UI / manual |
| AC-6 | `RoomPage.test.tsx`: picking a camera restarts the track on it, stays live, and the next start uses it. Manual with two webcams | web UI / manual |
| AC-7 | `RoomPage.test.tsx`: my own player has no quality or mode control | web UI |
| AC-8 | `StreamButtons.test.tsx`: full room disables off buttons with the tooltip; live ones still work | unit |
| AC-9 | `StreamButtons.test.tsx`: no-sound badge, tooltip and menu text | unit |
| AC-10 | `StreamButtons.test.tsx`: no screen button without `getDisplayMedia` | unit |
| AC-11 | `StreamButtons.test.tsx`: keyboard only (Tab, Enter, arrow keys, Escape) and accessible names | unit |
| AC-12 | `PlayerControls.test.tsx`, `RoomPage.test.tsx`: muted and disabled without sound; usable after a swap brings sound | unit / web UI |
| AC-13 | `Stage.test.tsx`: the button enters fullscreen, and leaves it when in fullscreen; its name follows | web UI |
| AC-14 | Staging, Chrome: looks like the preview, readable menus, fullscreen in and out, thumbnails centred with their ring whole | manual |
| AC-15 | Staging (jsdom doesn't lay out or paint): the row is centred and the ring shows whole on the first, middle and last thumbnail | manual |

## Rollout

Web only, no settings or secrets. Merge to `main`, then Henrique checks AC-5, AC-6, AC-14 and AC-15 on staging. Production with the next `v*` tag. Roll back with the release workflow's "Run workflow" button.
