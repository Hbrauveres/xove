# Smooth screen video, clear audio, and quality and volume controls — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part is at the end: merging, the checks on staging (T12), and the release.

## First version

- [x] **T1** `web/src/media/shareSettings.ts`: presets, modes, VP9 with a VP8 backup, the sound settings · covers FR-1, FR-2, FR-3, FR-5, FR-6, FR-12 · verify: `shareSettings.test.ts`
  - Done: three presets, Smooth and Sharp, sound without filters in stereo at 128 kbit/s and no DTX, and what a viewer can pick. VP9 is sent as one stream per quality, not one SVC stream (SVC halves the size at each step: 1080p, 540p, 270p).
- [x] **T2** `web/src/media/preferences.ts`: remembered choices in `localStorage`, with defaults when empty or when storage fails · covers FR-11 · verify: `preferences.test.ts`
  - Done: five `xove.*` values; odd or missing values and blocked storage fall back to the defaults. 7 tests.
- [x] **T3** Publishing with the settings in `useLiveKitRoom.ts`, and a change mid-share by republishing · covers FR-1 to FR-7 · verify: `RoomPage.test.tsx`
  - Done, then replaced by T9 and T10: republishing gave viewers a 1–2 second reload and didn't work well in practice.
- [x] **T4** `ShareControls`: quality and mode before starting, and the "no sound" notice · covers FR-4 to FR-7, FR-11 · verify: `RoomPage.test.tsx`
  - Done, then replaced by T9 and T10: the settings moved to the setup window and the sharer's player.
- [x] **T5** The sharer's preview: the stage plays the sharer's own track, muted · covers FR-8 · verify: `RoomPage.test.tsx`
  - Done: my track attached to "Your shared screen", muted, and my sound not played back.
- [x] **T6** `PlayerControls`: volume slider and speaker icon, quality menu, remembered · covers FR-9, FR-10, FR-11, FR-12 · verify: `PlayerControls.test.tsx`, `RoomPage.test.tsx`
  - Done: mute and unmute back to the same volume; the slider hidden on iPhones and iPads; "Auto" or a fixed quality, which asks the server for that size; only the qualities the sharer sends.
- [x] **T7** Docs: `docs/architecture.md`, decision 31, `CLAUDE.md` test counts · verify: review
  - Done, and kept up to date with T8 to T11.

## After Henrique tried it (2026-10-03 and 2026-10-04)

- [x] **T8** API: the share's quality and mode · covers FR-7 · verify: `ScreenSlotTest`, `ScreenControllerTest`
  - Done:
    - `StreamSettings` (validated) is kept with the slot.
    - `/take` accepts optional `quality` and `mode` (a missing quality is 1080p, a missing mode Smooth).
    - New `POST /api/screen/settings` for the holder only (409 for anyone else, 400 for unknown values).
    - `GET /api/screen` returns `settings`, or `null` when nobody shares.
    - 16 new tests.
- [x] **T9** The two-step start: capture without sending, then a setup window with a preview, quality and mode; "Start sharing" publishes and takes the slot · covers FR-5, FR-6 · verify: `RoomPage.test.tsx`
  - Done:
    - `captureScreen`, `publishCapture` and `discardCapture` in `useLiveKitRoom.ts`; `ShareSetup.tsx`.
    - Cancel, the browser's "Stop sharing" bar, and leaving the page all stop a capture that was never sent.
    - The window keeps the focus inside, and gives it back to the share button when it closes.
- [x] **T10** The quality as a live cap, and the mode applied live, from the sharer's player bar; viewers follow the cap through the API · covers FR-7, FR-9, FR-12 · verify: `shareSettings.test.ts`, `RoomPage.test.tsx`
  - Done:
    - Always a 1080p capture, with three VP9 layers at high ceilings (8, 4 and 2 Mbit/s).
    - `setPublishingQuality(cap)`, the content hint and the degradation preference change live, on the same track.
    - Changes run in order, and a refused one goes back to the last accepted settings.
    - Viewers' menus offer nothing above the cap, and Auto asks for at most the cap, so LiveKit stops sending the layers above it.
- [x] **T11** The player's labels and bars fade · covers FR-13 · verify: `RoomPage.test.tsx`
  - Done:
    - They show while the mouse moves over a playing video, and fade after 2.5 s or when the mouse leaves.
    - On touch, a tap keeps them up long enough to use them.
    - Nothing fades while a control has the keyboard focus, or over the empty stage or a notice.
- [ ] **T12** Review every AC (`/review`), then the checks on staging after merge, written in the PR · verify: no gaps left
  - Review: three rounds; all findings fixed (the touch and keyboard behaviour, capture leaks, the order of quick changes, a missing setting's default).
  - On staging after merge:
    - About 30 fps with VP9 and three layers, and the reason for any drop (AC-8).
    - Stereo music-quality sound with no pumping (AC-9).
    - Smooth and Sharp under throttling, and Sharp's frame rate (AC-10).
    - A viewer's fixed quality really lowers what they receive (AC-5).
    - A live change of the cap reaches viewers within a couple of seconds (AC-3).

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T1, T10, T12 |
| FR-2 | T1, T10, T12 |
| FR-3 | T1, T9, T12 |
| FR-4 | T9 |
| FR-5 | T9 |
| FR-6 | T9, T10 |
| FR-7 | T8, T10 |
| FR-8 | T5 |
| FR-9 | T6, T10 |
| FR-10 | T6 |
| FR-11 | T2, T6, T9 |
| FR-12 | T6, T10, T12 |
| FR-13 | T11 |
| AC-1 | T1, T10 |
| AC-2 | T1 |
| AC-3 | T8, T9, T10, T12 |
| AC-4 | T5 |
| AC-5 | T6, T10, T12 |
| AC-6 | T6 |
| AC-7 | T9 |
| AC-8 | T12 |
| AC-9 | T12 |
| AC-10 | T12 |
| AC-11 | T2, T9 |
| AC-12 | T11 |

Nothing uncovered. AC-8 to AC-10, and the live parts of AC-3 and AC-5, need real browsers and real video, so they're checked by hand on staging.
