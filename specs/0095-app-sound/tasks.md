# Only the app's sound when sharing a window — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the checks on staging (T5), and the release tag.

- [x] **T1** `shareSettings.ts`: the screen's request to the browser asks for the app's sound when a window is picked (`windowAudio: "window"`) and leaves out Xovê's own sound (`restrictOwnAudio: true`), keeping 0086's sound settings, the video size and frame rate, and `selfBrowserSurface: "exclude"` · covers FR-1, FR-3, FR-5 · verify: `shareSettings.test.ts`
  - Done: `screenCaptureRequest()` builds the browser's request; the content hint stays with `contentHintOf`. 3 tests changed or added.
- [x] **T2** `useLiveKitRoom.ts`: a screen share asks the browser with that request and wraps the video and sound in LiveKit's track types (screen sources, content hint) instead of `createScreenTracks`; a closed picker and a share with no sound behave as today. Fakes for the picker and the tracks in `fakeLiveKit.ts` · covers FR-1 to FR-5 · verify: `useLiveKitRoom.test.ts` and the existing share tests; `cd web && npm test && npm run build`
  - Done: `captureScreen` in `useLiveKitRoom.ts` calls `getDisplayMedia` and wraps the tracks; `screenCaptureOptions` is gone. The fake picker lives on the fake room and `setup.ts` points `navigator.mediaDevices` at it. The checks are in `RoomPage.test.tsx` (there is no `useLiveKitRoom.test.ts`): the request, the sources and the content hint.
- [x] **T3** Docs: decision 33 in `docs/decisions.md` (a window shares its app's sound, the whole screen leaves out Xovê's own sound, Xovê opens the picker itself because livekit-client drops `windowAudio`); test counts in `CLAUDE.md` · verify: the pages describe the new behaviour
  - Done: decision 33, a "Which sound" line in `docs/architecture.md`, web 162 tests in `CLAUDE.md`.
- [x] **T4** Review every AC (`/review`), fix what it finds, open the PR with `Closes #95` · verify: no gaps left
  - Done: no gaps. Fixed: the video size matches LiveKit's again (`ideal`, `max` only in Safari); the page's sound is unlocked as LiveKit did (`startAudio`); tests for a capture without a screen and a browser without the picker.
- [x] **T5** On staging after merge, written in the PR (Henrique, Chrome on Windows, with Discord on):
  - picking a window shows "Share this app's audio too" (AC-2);
  - a game window shared during a Discord call: viewers hear the game, not the call (AC-3);
  - a shared tab still carries its sound (AC-4);
  - the whole screen shared while a friend's stream plays in Xovê: viewers don't hear it come back (AC-5).
  - · verify: every check written in the PR
  - Done 2026-10-04: Henrique checked it on staging after #96 merged; all as planned. Live in production with v0.0.5.

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T1, T2, T5 |
| FR-2 | T2, T5 |
| FR-3 | T1, T2, T5 |
| FR-4 | T2 |
| FR-5 | T1, T2 |
| AC-1 | T1, T2 |
| AC-2 | T5 |
| AC-3 | T5 |
| AC-4 | T5 |
| AC-5 | T5 |

Nothing uncovered. FR-4 (other browsers) is checked by the tests only: the browser ignores options it doesn't know.
