# Smooth screen video, clear audio, and quality and volume controls — plan

- Spec: [spec.md](spec.md) (approved 2026-10-03; FR-5, FR-7, FR-12, FR-13, AC-3 and AC-12 updated with Henrique on 2026-10-03 and 2026-10-04)
- Status: Approved (2026-10-03), updated 2026-10-04 after Henrique tried the first version

## Approach

**Mostly the web app, plus a small API addition.** The choppy video and bad sound came from how the browser publishes the screen (`web/src/hooks/useLiveKitRoom.ts`), which used LiveKit's defaults for slides and voice calls. The API changes only so viewers can learn the sharer's quality and mode. The database, `infra` and the LiveKit servers don't change.

**One place decides the settings.** A small module, `web/src/media/shareSettings.ts`, turns the sharer's choices into LiveKit's capture and publish options. These are pure functions, so tests can check every combination (AC-1, AC-2) without a browser.

**Starting a share takes two steps** (FR-5):
1. **The browser's picker.** The click on "Share my screen" opens it (browsers only allow that straight from a click). The screen is captured (`createScreenTracks`), but nothing is sent.
2. **The setup window.** It shows a small preview of the captured screen, the send quality and the mode, starting with the choices used last time.
   - "Start sharing" publishes the tracks and takes the slot with the chosen settings.
   - "Cancel" (or Escape) stops the capture.
   - The window is modal: the focus stays inside and goes back to the share button when it closes.
   - If the browser's own "Stop sharing" bar is used while the window is open, it closes and the capture stops.

**Codec and layers.**
- The screen is always captured at 1080p and sent in **VP9 with three layers** (1080p, 720p, 480p), one stream per layer (LiveKit's VP9 simulcast: `simulcast: true`, `L1T3`).
  - VP9 as a single stream with layers inside (SVC) was rejected: it halves the size at each step (1080p, 540p, 270p), so viewers couldn't get exactly 720p or 480p.
- **VP8 fallback:** browsers that can't send VP9 (Firefox) send VP8 automatically. Firefox and Safari send a single layer.
- **Switching codecs** to VP8 is a one-line change in `shareSettings.ts`.

| Layer | Ceiling |
| --- | --- |
| 1080p · 30 fps | 8 Mbit/s |
| 720p · 30 fps | 4 Mbit/s |
| 480p · 30 fps | 2 Mbit/s |

The ceilings are high on purpose (FR-12): only each person's computer and connection limit the picture, and the browser and LiveKit lower the bitrate by themselves when a connection can't keep up. The VPS's monthly traffic is watched in Hostinger's panel.

**The sharer's quality is a cap, not a different stream.**
- The chosen quality is the highest layer anyone can get.
- The sharer's browser applies it right away (`setPublishingQuality`), and the API stores it with the share, so viewers' apps read it with the screen slot (every 2 seconds).
- **Viewers follow the cap.** Their quality menu offers nothing above it, and "Auto" asks for no more than it. Since nobody asks for the layers above the cap, LiveKit stops sending them (dynacast), so the sharer's upload really drops.
- **Raising the cap** works the same way: all three layers were captured and published from the start.

**The mode:**
- **Smooth:** the track is marked "motion", and the browser keeps the frame rate and lowers the resolution when the connection is tight.
- **Sharp:** marked "detail", and the browser keeps the resolution and lowers the frame rate.
- Both apply live on the same track (`contentHint`, `setDegradationPreference`).

**Changing quality or mode while sharing** (FR-7):
- The sharer's settings sit in **their own player's bar**, where viewers have theirs.
- A change applies live to LiveKit, then goes to the API (`POST /api/screen/settings`). There's no new track and no reload for viewers.
- Changes run one after the other. If the API refuses one, the last accepted settings go back on screen, in storage and in LiveKit.

**Sound.** The screen's sound is captured without the microphone filters (echo cancellation, noise suppression, automatic volume), in stereo, and published at 128 kbit/s stereo without silence skipping (DTX).
- **No sound:** if the browser gives none, the setup window and the share controls say so (FR-4).
- **Browser limits:** in Chrome, sound comes only from a tab, or from the whole screen on Windows. Firefox and Safari give none.

**The sharer's preview.** The player shows the sharer's own track with its sound muted. Sharing the whole screen shows a "mirror" effect (the page inside the page); a tab or window avoids it.

**The viewer's controls** sit in a bar over the player, like YouTube's:
- **Volume:** a slider and a speaker icon.
  - Clicking the icon mutes, and clicking again unmutes back to the same volume.
  - It only changes this browser's playback.
  - The slider is hidden on iPhones and iPads, which ignore a page's volume.
- **Quality:** "Auto" plus each layer up to the sharer's cap, down to 480p.
  - A fixed quality asks the server for that size, so the viewer really downloads less (FR-12).
  - A remembered quality the sharer doesn't offer counts as "Auto".
- **Fullscreen**, as before.

**The player's labels and bars fade** (FR-13). The LIVE label, the name and both bars show while the mouse moves over a playing video, or after a tap. They fade after 2.5 seconds without movement, or when the mouse leaves.
- **Touch:** only the timer hides them. A finger lifting off fires "pointer leave" at once, which would otherwise hide them before they could be tapped.
- **Keyboard:** nothing fades while a control has the focus.
- **Notices and the empty stage** never fade.

**Remembered choices.** Each choice is stored in the browser's `localStorage`:
- **Sharer:** quality and mode.
- **Viewer:** quality, volume and muted.

If storage isn't available, the defaults apply.

### Alternatives considered

- **Republishing the stream on every change** (the first version): a 1–2 second reload for viewers, and the API had to follow a new track each time. Henrique found it didn't work well in practice, and a live cap needs neither.
- **Settings chosen before the picker** (the first version): the sharer chose blind. Choosing after the picker, with a preview, is clearer.
- **Telling viewers the cap through LiveKit** (participant attributes or data messages): it needs extra LiveKit permissions in the token, and attributes would also let people rename themselves. The API already tells every viewer who is sharing every 2 seconds.
- **VP8 with simulcast:** lighter on the sharer's CPU, but more bandwidth for the same picture. Kept as the fallback if VP9 drops frames on a busy computer.
- **Tight bandwidth budgets** (2.5, 1.2 and 0.6 Mbit/s): they protected the VPS's traffic, but held the picture back. Henrique chose high ceilings and to watch the traffic instead.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| API | `screen/StreamSettings.java` (new), `TakeRequest.java` (new) | The quality and mode of a share, validated; the take body with optional settings (a missing quality is 1080p, a missing mode Smooth) |
| API | `screen/ScreenSlot.java`, `ScreenState.java`, `ScreenController.java`, `NotTheHolderException.java` | The slot keeps the settings with the share; `POST /api/screen/settings` for the holder; the state carries `settings` |
| Web | `web/src/media/shareSettings.ts` (new) + test | Presets, modes, the cap, and their LiveKit options; the sound settings; what viewers can pick |
| Web | `web/src/media/preferences.ts` (new) + test | Remembered choices in `localStorage`, safe defaults |
| Web | `web/src/api/client.ts`, `types.ts`, `hooks/useScreenSlot.ts` | Take with settings; change settings; read them |
| Web | `web/src/hooks/useLiveKitRoom.ts` | Capture without sending; publish a capture; apply settings live; the viewer's quality request |
| Web | `web/src/hooks/useRoomSession.ts` | The two-step start, the pending capture's lifecycle, live changes in order with a revert |
| Web | `web/src/components/share/ShareSetup.tsx`, `ShareSettingsFields.tsx` (new) | The setup window with a preview; the quality and mode fields (window and player bar) |
| Web | `web/src/components/stage/Stage.tsx`, `ScreenVideo.tsx`, `StageOverlay` CSS | The sharer's preview and settings bar; the viewer's bar following the cap; volume; the fading labels and bars |
| Web | `web/src/components/stage/PlayerControls.tsx` (new) + test | Volume slider and mute icon, quality menu |
| Web | `web/src/components/controls/ShareControls.tsx` | Share, take and stop only; the "no sound" notice |
| Web | `web/src/test/fakeLiveKit.ts`, `fakeApi.ts` | Capture and publish, layer caps, quality requests; the settings endpoint |
| Docs | `docs/architecture.md`, `docs/decisions.md` (decision 31), `CLAUDE.md` | The flow, the cap, the endpoints, test counts |
| Database, infra | — | None |

## API and data

| Endpoint | Change |
| --- | --- |
| `GET /api/screen` | Adds `settings: { quality, mode }`, or `null` when nobody shares |
| `POST /api/screen/take` | The body may add `quality` and `mode` (a missing quality is 1080p, a missing mode Smooth); 400 for an unknown value |
| `POST /api/screen/settings` (new) | `{ quality, mode }` from the person sharing; 400 for an unknown value; 409 for anyone else ("Only the person sharing can change how their screen is sent.") |

The settings live in the API's memory with the slot, like the slot itself, and go away when the share ends. Allowed values: quality `1080p`, `720p`, `480p`; mode `smooth`, `sharp`. No table or migration.

The browser stores five values under `xove.*` keys in `localStorage`.

## Risks

- **The sharer's CPU with VP9:** encoding VP9 in software is heavier than VP8, and the sharer encodes three layers. With a game running, the encoder may drop frames.
  - Checked on staging: `chrome://webrtc-internals` shows the frame rate and why quality drops ("cpu" or "bandwidth").
  - If it says "cpu", switch the codec to VP8.
- **The sharer's upload:** all layers go up, up to about 14 Mbit/s at 1080p on a great connection. A weaker upload sends less by itself, and lower caps reduce it.
- **The VPS's traffic** isn't capped by the app. It's watched in Hostinger's panel (8 TB a month).
- **The cap takes up to 2 seconds to reach viewers** (the next poll). Meanwhile a viewer may still receive the old top layer; it corrects itself.
- **Sharp mode's frame rate:** Chrome may lower it a lot for screen content in VP9. Checked on staging (AC-10).
- **Volume on iPhones:** iOS ignores a page's volume, so the slider is hidden there; mute still works.
- **Sound depends on the browser:** none from Firefox or Safari, and only from a tab in Chrome (except the whole screen on Windows). The notice makes it visible.
- **Tests can't see real video.** Smoothness, sound and throttling (AC-8 to AC-10) are checked by hand on staging, with numbers from `chrome://webrtc-internals` written in the PR.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `shareSettings.test.ts`: always 1080p capture; VP9 with 1080p, 720p and 480p layers, VP8 backup, ceilings; content hint and degradation per mode; the cap per quality | unit |
| AC-2 | `shareSettings.test.ts`: sound captured without the three filters, in stereo; published with 128 kbit/s stereo, `dtx: false` | unit |
| AC-3 | `RoomPage.test.tsx` with the fake LiveKit and API: picking shows the setup window with a preview and sends nothing; Start publishes and takes with the settings; Cancel sends nothing; a change while sharing applies to the same track, reaches the API, can be raised back, runs in order, and is reverted if refused; viewers' menus follow the cap. `ScreenSlotTest`, `ScreenControllerTest`: settings with the share, changes by the holder only, validation | web UI, API, plus manual |
| AC-4 | `RoomPage.test.tsx`: the sharer sees their own track in the player, muted, with their settings bar | web UI |
| AC-5 | `PlayerControls.test.tsx` and `RoomPage.test.tsx`: the menu shows "Auto" and the layers up to the cap, down to 480p; picking one asks the server for that size; plus `webrtc-internals` on staging | web UI, plus manual |
| AC-6 | `PlayerControls.test.tsx`, `RoomPage.test.tsx`: the slider changes the volume; the icon mutes and unmutes back to the same volume | web UI |
| AC-7 | `RoomPage.test.tsx`: a screen without sound shows the notice in the setup window and while sharing | web UI |
| AC-8 | Staging, Chrome, a video or a game: about 30 fps in `webrtc-internals`, codec VP9, three layers, and the reason for any quality drop | manual |
| AC-9 | Staging, music from a tab: stereo, music quality, no pumping or cuts | manual |
| AC-10 | Staging with network throttling: Smooth stays fluid; Sharp stays readable (note its frame rate) | manual |
| AC-11 | `preferences.test.ts`, plus page tests: choices survive a reload; defaults when empty or when storage fails | unit, web UI |
| AC-12 | `RoomPage.test.tsx`: labels and bars show on mouse movement and fade when it stops or leaves; a tap keeps them; keyboard focus keeps them; nothing fades over the empty stage | web UI |

## Rollout

1. One `xove` PR (#87). Merging deploys the API and the web app to staging together. Check AC-8 to AC-10 there, with Henrique sharing and someone else watching.
2. Release to production with a version tag.
3. No settings, secrets or `infra` changes. Undoing it means rolling production back with the button.

## Decided trade-offs

Decided with Henrique:

1. **VP9 first** (2026-10-03), sent as one stream per quality, with VP8 as the automatic fallback. Switch to VP8 if staging shows the sharer's CPU can't keep up.
2. **No tight bandwidth limits** (2026-10-03): high ceilings, and the VPS's traffic watched in Hostinger's panel.
3. **Set up after the picker, change live** (2026-10-04):
   - The settings are chosen in a setup window with a preview, after the picker.
   - They change live from the sharer's player.
   - The API carries them to viewers.
