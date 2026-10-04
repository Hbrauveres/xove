# Only the app's sound when sharing a window — plan

- Spec: [spec.md](spec.md) (approved 2026-10-04)
- Status: Approved (2026-10-04)

## Approach

Two browser options do the job:

- `windowAudio: "window"` asks Chrome to offer the app's sound when a window is picked (FR-1). It has no effect on tabs or the whole screen (FR-2, FR-3).
- `restrictOwnAudio: true`, inside the sound settings, asks it to leave Xovê's own sound out of the system sound (FR-3).

Browsers that don't know them ignore them, so sharing works as today there (FR-4). The sound settings from spec 0086 stay as they are (FR-5).

The catch: livekit-client (2.22.3, the latest) builds the browser request itself and passes only the options it knows, and `windowAudio` isn't one of them. `restrictOwnAudio` gets through, since the sound settings are passed whole. So Xovê asks the browser for the screen itself and wraps what comes back in LiveKit's track types, the same few lines LiveKit's `createScreenTracks` runs. Everything after that (the setup window, publishing, live changes) is unchanged.

Rejected:
- **Patching livekit-client** in `node_modules`: lost or broken on every upgrade.
- **Waiting for LiveKit to support it:** no sign of it yet, and the browser call is small. If LiveKit adds it later, we go back to `createScreenTracks`.
- **Only `restrictOwnAudio`:** fixes Xovê's own echo but not Discord's, which is the main problem.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `web/src/media/shareSettings.ts` | The capture settings gain `windowAudio: "window"` and, inside the sound, `restrictOwnAudio: true`; a function turns them into the browser's request (video size and frame rate as LiveKit does today: `ideal`, or `max` in Safari; `selfBrowserSurface`, sound). |
| Web | `web/src/hooks/useLiveKitRoom.ts` | `capture` for a screen asks the browser directly and wraps the video and sound in `LocalVideoTrack` and `LocalAudioTrack` (screen sources, content hint), instead of `createScreenTracks`. Errors (closed picker) are handled as today. |
| Web | `web/src/test/fakeLiveKit.ts` | Fake `LocalVideoTrack` and `LocalAudioTrack`, and a fake browser picker for the tests. |
| Docs | `docs/decisions.md` | Decision 33: a window shares its app's sound, the whole screen leaves out Xovê's own sound, and why we ask the browser ourselves. |
| Docs | `CLAUDE.md` | Test counts. |

No API, database or infra change.

## API and data

None.

## Risks

- **Chrome may ignore the hint**, since `windowAudio` is only a hint. Then it falls back to system sound, as today. Checked by hand on Chrome 154 (it works); AC-2 checks it again on staging.
- **Wrapping the tracks ourselves** could miss something LiveKit sets. The wrapping copies LiveKit's code (source, content hint, sound track), and the tests check the tracks that get published.
- **`restrictOwnAudio`** might remove more than Xovê's sound, or nothing, depending on the Chrome version. AC-5 checks it on staging. If it misbehaves, removing that one line restores today's behaviour.
- **Other browsers:** Edge is Chrome inside and should behave the same. Firefox and Safari ignore the unknown options; the notice from 0086 still shows when there's no sound.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `shareSettings.test.ts`: the request has `windowAudio: "window"`, `restrictOwnAudio: true`, the 0086 sound settings and `selfBrowserSurface: "exclude"`. `RoomPage.test.tsx`: sharing a screen asks the browser with that request and publishes its video and sound as the screen and screen-sound sources. | unit / web UI |
| AC-2 | On staging, Chrome on Windows: picking a window shows "Share this app's audio too" | manual |
| AC-3 | On staging: a game window shared during a Discord call; viewers hear the game, not the call | manual |
| AC-4 | On staging: a shared tab still carries its sound | manual |
| AC-5 | On staging: the whole screen shared while a friend's stream plays in Xovê; viewers don't hear it come back | manual |

The existing tests for a closed picker, no sound (the notice) and live changes keep passing.

## Rollout

Web only, no settings or secrets. Merge to `main` and it reaches staging, where Henrique runs AC-2 to AC-5. Production with the next `v*` tag. Roll back with the release workflow's "Run workflow" button, or remove the two options.
