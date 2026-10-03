# Smooth screen video, clear audio, and quality and volume controls — plan

- Spec: [spec.md](spec.md) (approved 2026-10-03)
- Status: Approved (2026-10-03)

## Approach

**It's all in the web app.** The causes are in how the browser publishes the screen (`web/src/hooks/useLiveKitRoom.ts`), which today uses LiveKit's defaults for slides and voice calls. The API, the database, `infra` and the LiveKit servers don't change.

**One place decides the settings.** A new small module, `web/src/media/shareSettings.ts`, turns the sharer's choice (quality and mode) into LiveKit's capture and publish options. It's a pure function, so the tests can check every combination (AC-1, AC-2) without a browser.

**Codec: VP9 with layers inside one stream (SVC).** The sharer sends one stream that holds every quality; the server forwards to each viewer only the layers they need. That's less upload for the sharer and smoother switching for viewers than VP8, at the cost of more work for the sharer's computer. Browsers that can't send VP9 (Firefox) fall back to VP8 by themselves (LiveKit's backup codec). The codec is one setting in `shareSettings.ts`, so switching to VP8 is a one-line change if VP9 struggles.

| Preset | Qualities inside the stream | Budget (whole stream) |
| --- | --- | --- |
| 1080p · 30 fps (default) | 1080p, 720p, 480p | ~3 Mbit/s |
| 720p · 30 fps | 720p, 480p | ~1.7 Mbit/s |
| 480p · 30 fps | 480p | ~0.8 Mbit/s |

- **Smooth mode:** the track is marked "motion", and the browser is told to keep the frame rate and lower the resolution when the connection is tight.
- **Sharp mode:** marked "detail", and the browser keeps the resolution and lowers the frame rate.
- The budgets are below LiveKit's own 1080p30 preset (5 Mbit/s), on purpose: they're what keeps a full room within the VPS's traffic (#60).

**Sound.** The screen's sound is captured without the microphone filters (echo cancellation, noise suppression, automatic volume), in stereo, and published with LiveKit's "music, high quality, stereo" preset, without silence skipping (DTX). If the browser gives no sound with the screen, the sharer sees a notice (FR-4). In Chrome, sound comes only from a tab, or from the whole screen on Windows; Firefox and Safari give none.

**Changing quality or mode while sharing.** The browser keeps the same capture (the picker doesn't open again). The app republishes it with the new settings, so viewers see a short reload (about 1–2 seconds).

**The sharer's preview.** The player shows the sharer's own track, attached locally, with its sound muted. Sharing the whole screen shows a "mirror" effect (the page inside the page). That's expected, and the hint suggests sharing a tab or window instead.

**The viewer's controls** sit in a bar over the player, like YouTube's:
- **Volume:** a slider and a speaker icon. Clicking the icon mutes, and clicking again unmutes back to the same volume. It only changes this browser's playback.
- **Quality:** "Auto" plus each layer the sharer sends, down to 480p.
  - "Auto" keeps today's adaptive stream: the server sends what fits the player's size and the connection.
  - A fixed quality caps it, using LiveKit's per-viewer quality request, so the server really sends less (FR-12).
- **Fullscreen**, as today.

**Remembered choices.** Each choice is stored in the browser's `localStorage` (sharer: quality and mode; viewer: quality, volume, muted). Reading and writing never break the page: if storage isn't available, the defaults apply.

### Alternatives considered

- **VP8 with simulcast** (three separate copies): lighter on the sharer's CPU and works everywhere, but more upload (about 5.5 Mbit/s at 1080p) and rougher switching between qualities. Kept as the fallback, and as the first thing to try if VP9 drops frames on a busy computer.
- **Changing the settings live on the existing stream,** without republishing: only the mode could change that way, not the resolution and layers. Two paths for one feature isn't worth a 1–2 second reload.
- **Server-side changes** (LiveKit config): not needed. Simulcast, adaptive stream and dynacast are client settings, and dynacast is already on.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `web/src/media/shareSettings.ts` (new) + test | Presets, modes and their LiveKit options; the audio settings |
| Web | `web/src/media/preferences.ts` (new) + test | Remembered choices in `localStorage`, safe defaults |
| Web | `web/src/hooks/useLiveKitRoom.ts` | Publish with the settings; republish on change; expose the local track for the preview; report "no sound" |
| Web | `web/src/components/stage/Stage.tsx`, `ScreenVideo.tsx` | The sharer's own preview (muted); volume and quality applied to the remote tracks |
| Web | `web/src/components/stage/PlayerControls.tsx` (new) + test | Volume slider and mute icon, quality menu, fullscreen |
| Web | `web/src/components/controls/ShareControls.tsx` | Quality and mode before starting and while sharing; the "no sound" notice |
| Web | `web/src/test/fakeLiveKit.ts` | Records publish options and quality requests, so tests can check them |
| Docs | `docs/architecture.md` (room section), `docs/decisions.md` (new decision), `CLAUDE.md` (test counts) | Quality presets, sound settings, the controls |
| API, database, infra | — | None |

## API and data

None. No endpoint, table or setting changes. The browser stores five values under `xove.*` keys in `localStorage`.

## Risks

- **The sharer's CPU with VP9:** encoding VP9 in software is 2–3× heavier than VP8; with a game running, the encoder may drop frames. Checked on staging: `chrome://webrtc-internals` shows the frame rate and why quality drops ("cpu" or "bandwidth"). If it says "cpu", switch the codec setting to VP8.
- **The sharer's upload:** about 3 Mbit/s at 1080p. A weak upload can't keep up. Mitigated: lower presets, and Smooth mode degrades gracefully.
- **Volume on iPhones:** iOS ignores volume set by a page (only the hardware buttons work). The slider is hidden there, and mute still works.
- **Sound depends on the browser:** no sound from Firefox or Safari, and only from a tab in Chrome (except the whole screen on Windows). The notice (FR-4) makes that visible instead of silent.
- **The 1–2 second reload** when the sharer changes quality mid-share. Accepted (see Approach).
- **Tests can't see real video.** Smoothness and sound quality (AC-8 to AC-10) are checked by hand on staging, with numbers from `chrome://webrtc-internals` written in the PR.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `shareSettings.test.ts`: each preset × mode gives the right resolution, frame rate, bitrate, VP9 layers down to 480p (VP8 backup), content hint and degradation preference | unit |
| AC-2 | `shareSettings.test.ts`: audio capture without the three filters, stereo; publish with music stereo preset, `dtx: false` | unit |
| AC-3 | `RoomPage.test.tsx` with the fake LiveKit: changing quality or mode while sharing republishes with the new options, and the share stays on | web UI, plus manual |
| AC-4 | `Stage` test: the sharer sees their own track in the player, muted | web UI |
| AC-5 | `PlayerControls.test.tsx`: menu shows "Auto" and the sharer's layers down to 480p only; picking one sends the quality request (fake LiveKit); plus `webrtc-internals` on staging | web UI, plus manual |
| AC-6 | `PlayerControls.test.tsx`: the slider changes the volume; the icon mutes and unmutes back to the same volume | web UI |
| AC-7 | `RoomPage.test.tsx`: a share without sound shows the notice | web UI |
| AC-8 | Staging, Chrome, a video or a game: about 30 fps in `webrtc-internals`, codec VP9, and the reason for any quality drop ("cpu" or "bandwidth") | manual |
| AC-9 | Staging, music from a tab: stereo, music quality, no pumping or cuts | manual |
| AC-10 | Staging with network throttling: Smooth stays fluid; Sharp stays readable | manual |
| AC-11 | `preferences.test.ts`, plus a page test: choices survive a reload; defaults when empty or when storage fails | unit, web UI |

## Rollout

1. One `xove` PR. Merging deploys to staging; checks AC-8 to AC-10 there, with you sharing and someone else watching.
2. Release to production with a version tag.
3. No settings, secrets or `infra` changes. Undoing it means rolling production back with the button.

## Decided trade-offs

Decided with Henrique on 2026-10-03:

1. **VP9 (SVC) first,** with VP8 as the automatic fallback for browsers that can't send VP9. Switch the setting to VP8 if staging shows the sharer's CPU can't keep up.
2. **A 1–2 second reload** for viewers when the sharer changes quality or mode mid-share is fine.
