# Share and camera buttons on the player — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the checks on staging (T11), and the release tag.

## Core

- [x] **T1** `StreamButtons` and `StreamMenu`, standalone and not wired yet:
  - one round button per kind: icon, slash when off, lit when live, tooltip, `aria-pressed`;
  - the arrow only when live, opening the menu: Quality, Mode, then Change window and Stop sharing (screen), or the camera list and Turn off camera (camera);
  - full room: off buttons disabled with the "6 streams" tooltip; the no-sound badge, with the explanation in the tooltip and the menu;
  - no screen button without `getDisplayMedia`; buttons wait while busy;
  - keyboard: Tab, Enter, arrow keys, Escape back to the arrow; readable menu text on a lit button.
  - · covers FR-2, FR-3, FR-6, FR-7, FR-11, FR-12, FR-13, FR-14, FR-16, FR-17 · verify: `StreamButtons.test.tsx`
  - Done: `StreamButtons` (with its menu inside) and its styles; the mode labels come from `ShareSettingsFields`. 11 tests.
- [x] **T2** Camera choice: `xove.camera.device` in `preferences.ts`, `cameraCaptureOptions(deviceId?)`, and a gone device falls back to the default · covers FR-9 · verify: `preferences.test.ts`, `shareSettings.test.ts`
  - Done: `loadCameraDevice`/`saveCameraDevice`; the camera is asked as `ideal`, so a gone one falls back. 2 tests.
- [x] **T3** `useLiveKitRoom`: `changeScreen()` re-picks and swaps the video on the same publication, with the sound per the plan's table, the content hint, the cap, and the end of the capture handled on the new track; a closed picker changes nothing. `cameras` (listed, refreshed on `devicechange`) and `pickCamera(deviceId)` restart the published camera on that device, saved for next time. Fakes: `replaceTrack`, `restartTrack`, the camera list · covers FR-8, FR-9 · verify: `useLiveKitRoom.test.ts` (new, with `renderHook`); `cd web && npm test && npm run build`
  - Done: `changeScreen`, `cameras`, `cameraId` and `pickCamera` in `useLiveKitRoom`; the camera's "ended" watch is set again after a switch. `CameraDevice` lives in `types.ts`. 8 tests.

## Wiring

- [x] **T4** The stage draws `StreamButtons` at the bottom centre of its overlay: always on the empty stage, fading with the player's bars over a stream, staying while focused or a menu is open, also in fullscreen. `RoomPage` passes what the bar had plus change window and pick camera. `ShareControls` is deleted; the empty stage loses its button. Existing start and stop tests move to the new buttons · covers FR-1, FR-4, FR-5 · verify: `RoomPage.test.tsx`, `Stage.test.tsx` (new)
  - Done: the stage draws `StreamButtons` in a layer that fades with its bars (and stays while a menu is open); `ShareControls` deleted; the empty stage's button gone. The session also gets `changeScreen`, `cameras` and `pickCamera` (tested in T6). The checks went into `RoomPage.test.tsx` (3 new tests), which already plays the stage's fading; no separate `Stage.test.tsx`.
- [x] **T5** The sharer's own player loses its quality and mode fields; the menus change them live through the API, as before · covers FR-7, FR-10 · verify: `RoomPage.test.tsx`
  - Done: my player shows only my video; `ShareSettingsFields` keeps only the setup window's look. The live-change tests now go through the menus.
- [x] **T6** "Change window" and the camera list wired from the menus to the session · covers FR-8, FR-9 · verify: `RoomPage.test.tsx`
  - Done: wired in T4; 3 room tests here (swap on the same stream, sound and badge follow; closed picker; camera switch). Checked that they fail with the wiring removed.
- [x] **T7** A screen without sound: the viewer's volume (big player and thumbnail) shows muted and is disabled, and works again when the sharer's swap brings sound · covers FR-15 · verify: `PlayerControls.test.tsx`, `RoomPage.test.tsx`
  - Done: `PlayerControls` takes `hasSound` (locked, muted, the saved volume kept); thumbnails show a disabled "shares no sound" speaker. The fake gained `publishSound`. 2 tests.
- [x] **T8** Fullscreen toggles, following `fullscreenchange`; named "Fullscreen" or "Exit fullscreen" · covers FR-18 · verify: `Stage.test.tsx`
  - Done: the stage follows `fullscreenchange` and the button enters or leaves; its icon and name follow. Tested in `RoomPage.test.tsx` (1 test).
- [x] **T9** Thumbnails centred under the player (`safe center`), and the hover and focus ring drawn inside each thumbnail · covers FR-19, FR-20 · verify: `npm run build`; manual on staging (T11)
  - Done: `justify-content: safe center` on the row; the 1px line and the 2px hover and focus ring are an inset shadow over each thumbnail's video.

## Docs and review

- [x] **T10** Docs: the controls on the player in `docs/architecture.md` and `docs/overview.md`; decision 34 in `docs/decisions.md`; test counts in `CLAUDE.md` · verify: the pages describe the new behaviour
  - Done: architecture (buttons, menus, change window, camera list, no-sound lock, centred thumbnails), overview, decision 34, web 199 tests.
- [ ] **T11** Review every AC (`/review`), fix what it finds, open the PR with `Closes #98`. Then on staging after merge, written in the PR (Henrique, Chrome):
  - "Change window" during a share: viewers see the new window without a break, sound follows (AC-5);
  - switching between two webcams while live (AC-6);
  - looks like the preview, readable menus, fullscreen in and out with the button (AC-14);
  - thumbnails centred, the ring whole on the first, middle and last one (AC-15).
  - · verify: no gaps left; every check written in the PR
  - Review done: no AC uncovered. Fixed what it found: a "Change window" racing a stop (the new pick stopped), a failed camera switch (back to the previous camera, or stopped; not remembered), the camera's mode after a switch, the menus waiting while busy, named groups for screen readers, a menu reopening by itself, the buttons over the viewer's bar at mid widths (a container query), and no sound lock on cameras. 7 tests. The staging checks are Henrique's, after merge.

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T4 |
| FR-2, FR-3 | T1, T11 |
| FR-4 | T4, T11 |
| FR-5 | T4 |
| FR-6 | T1 |
| FR-7 | T1, T5 |
| FR-8 | T3, T6, T11 |
| FR-9 | T2, T3, T6, T11 |
| FR-10 | T5 |
| FR-11 | T1, T11 |
| FR-12, FR-13, FR-14 | T1 |
| FR-15 | T7 |
| FR-16, FR-17 | T1 |
| FR-18 | T8, T11 |
| FR-19, FR-20 | T9, T11 |
| AC-1 | T1, T4 |
| AC-2 | T4 |
| AC-3 | T4 |
| AC-4 | T1, T5 |
| AC-5 | T3, T6, T11 |
| AC-6 | T2, T3, T6, T11 |
| AC-7 | T5 |
| AC-8, AC-9, AC-10, AC-11 | T1 |
| AC-12 | T7 |
| AC-13 | T8 |
| AC-14 | T11 |
| AC-15 | T9, T11 |

Nothing uncovered. FR-11 (readable menus) and FR-19/20 (layout) are only partly testable in jsdom, which doesn't paint; staging checks them (T11).
