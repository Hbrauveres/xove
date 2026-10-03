# Smooth screen video, clear audio, and quality and volume controls — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part is at the end: merging, the checks on staging (T8), and the release.

- [ ] **T1** `web/src/media/shareSettings.ts`: the three presets (1080p, 720p, 480p at 30 fps), Smooth and Sharp modes, and the LiveKit options they produce: VP9 with layers down to 480p and a VP8 backup, the bandwidth budgets, content hint and degradation preference; the screen sound's capture (no filters, stereo) and publish settings (music stereo, no DTX) · covers FR-1, FR-2, FR-3, FR-5, FR-6, FR-12 · verify: `shareSettings.test.ts` (every preset × mode, and the audio settings)
- [ ] **T2** `web/src/media/preferences.ts`: remembered choices in `localStorage` (sharer quality and mode; viewer quality, volume, muted), with defaults when empty or when storage fails · covers FR-11 · verify: `preferences.test.ts`
- [ ] **T3** Publishing with the settings in `useLiveKitRoom.ts`: share with the chosen preset and mode; change them mid-share by republishing the same capture; report when there's no sound; expose the local track for the preview. The fake LiveKit records publish options · covers FR-1 to FR-7 · verify: `RoomPage.test.tsx` (publish options for the chosen preset; a change mid-share republishes and the share stays on; a share without sound is reported)
- [ ] **T4** `ShareControls`: pick quality and mode before starting (remembered), change them while sharing, and the "no sound" notice · covers FR-4, FR-5, FR-6, FR-7, FR-11 · verify: `RoomPage.test.tsx` (the choices reach the publish options; the notice shows; the choice is remembered after a reload)
- [ ] **T5** The sharer's preview: the stage plays the sharer's own track, muted, instead of the notice; the hint suggests sharing a tab or window · covers FR-8 · verify: `Stage` test (own track attached, muted)
- [ ] **T6** `PlayerControls`: volume slider and speaker icon (mute and unmute back to the same volume; slider hidden on iOS), quality menu ("Auto" and the sharer's qualities down to 480p, sent as the viewer's quality request), fullscreen; remembered · covers FR-9, FR-10, FR-11, FR-12 · verify: `PlayerControls.test.tsx` (menu items, quality request, volume, mute and unmute), plus a reload test for remembered values
- [ ] **T7** Docs: `docs/architecture.md` (presets, modes, sound, the controls), a new decision in `docs/decisions.md` (VP9 with VP8 fallback, the budgets), `CLAUDE.md` test counts · verify: review
- [ ] **T8** Review every AC (`/review`), then the checks on staging after merge, written in the PR · verify: no gaps left; on staging: about 30 fps with VP9 and the reason for any drop (AC-8), stereo music-quality sound with no pumping (AC-9), Smooth and Sharp under throttling (AC-10), a viewer's fixed quality really lowers what they receive (AC-5)

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-1 | T1, T3, T8 |
| FR-2 | T1, T3, T8 |
| FR-3 | T1, T3, T8 |
| FR-4 | T3, T4 |
| FR-5 | T1, T3, T4 |
| FR-6 | T1, T3, T4 |
| FR-7 | T3, T4 |
| FR-8 | T5 |
| FR-9 | T6 |
| FR-10 | T6 |
| FR-11 | T2, T4, T6 |
| FR-12 | T1, T6, T8 |
| AC-1 | T1 |
| AC-2 | T1 |
| AC-3 | T3 |
| AC-4 | T5 |
| AC-5 | T6, T8 |
| AC-6 | T6 |
| AC-7 | T3, T4 |
| AC-8 | T8 |
| AC-9 | T8 |
| AC-10 | T8 |
| AC-11 | T2, T4, T6 |

Nothing uncovered. AC-8 to AC-10 need real browsers and real video, so they're checked by hand on staging.
