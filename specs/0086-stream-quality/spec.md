# Smooth screen video, clear audio, and quality and volume controls — spec

- Issue: #86 (absorbs the screen part of #58)
- Status: Approved (2026-10-03)
- Owner: Henrique

## Problem

Watching a shared screen on Xovê feels like a slideshow. The picture is sharp, but motion is never smooth, and it gets worse with games and videos, which is most of what people share. The shared sound is bad too: music and game audio come out muffled, the volume pumps up and down, and quiet moments are cut.

Nobody can choose anything either. The sharer can't pick how good their stream is, a viewer on a weak connection can't ask for less, nobody can turn the sound down, and the sharer sees a notice instead of what they're actually sending.

## Who it's for

- Viewers: what they see and hear, and how much they download.
- The sharer: what their browser sends, and seeing it.

## Functional requirements

**Smooth and clear by default**

- **FR-1** A shared screen plays smoothly for viewers: about 30 frames per second on a normal connection.
- **FR-2** In Smooth mode (the default), when a connection gets tight, the picture gets softer before it gets choppy: motion keeps flowing, and the image loses detail first.
- **FR-3** Shared sound reaches viewers as it was played: no voice filters (echo cancellation, noise suppression, automatic volume), in stereo, at music quality, with no cuts in quiet moments.
- **FR-4** The sharer is told when their browser can't share sound (some browsers only share sound from a tab, or none at all), instead of the sound just being missing.

**The sharer's controls**

- **FR-5** When starting, the sharer picks the quality they send: 1080p at 30 fps (the default), 720p at 30 fps, or 480p at 30 fps.
- **FR-6** The sharer also picks a mode: **Smooth** (the default, for games and videos: when the connection is tight, the picture gets softer and motion keeps flowing) or **Sharp** (for text and code: the picture keeps its detail and the frame rate drops instead).
- **FR-7** While sharing, the sharer can change the quality and the mode without stopping the share.
- **FR-8** The sharer sees their own stream in the player, as viewers see it, instead of a notice. Its sound is muted for them, so it doesn't echo.

**The viewer's controls**

- **FR-9** Like YouTube, each viewer picks the quality they watch: "Auto" (the default: the best their connection can take), or a fixed quality from what the sharer sends down to 480p. Nobody can pick more than the sharer sends.
- **FR-10** Each viewer has a volume control on the player, like YouTube's: a slider to turn the stream up or down, and a speaker icon that mutes it with one click (and unmutes it, back to the same volume). It only changes what they hear.

**Remembered choices**

- **FR-11** Each browser remembers its own choices for next time: the sharer's quality and mode, and the viewer's quality and volume (including muted).

**Bandwidth**

- **FR-12** Nothing of ours limits the picture: each quality may use as much bandwidth as the sharer's and the viewer's computers and connections allow (high ceilings only). A viewer who picks a lower quality really downloads less. The VPS's monthly traffic is watched in Hostinger's panel (changed with Henrique on 2026-10-03: no tight budget).

## Acceptance criteria

- **AC-1** For each preset, the app asks LiveKit for the matching resolution and frame rate; in Smooth mode marked as motion and favouring frame rate, in Sharp mode marked as detail and favouring sharpness; with high ceilings that don't hold the picture back, and with lower layers down to 480p for viewers to choose (automated test of the publish settings).
- **AC-2** The app asks for screen sound without echo cancellation, noise suppression or automatic volume, in stereo, at music quality and without silence skipping (automated test of the capture and publish settings).
- **AC-3** Changing the quality or the mode while sharing changes what is sent, and the share keeps going (automated test, plus manual).
- **AC-4** The sharer sees their own stream in the player, and its sound doesn't play for them (automated test).
- **AC-5** A viewer's quality menu offers "Auto" and every quality from the sharer's down to 480p, and nothing above the sharer's; picking one changes what that viewer receives (automated test, plus `chrome://webrtc-internals` on staging, written in the PR).
- **AC-6** The slider lowers and raises the stream's volume, and clicking the speaker icon mutes it and unmutes it back to the same volume, for that viewer only (automated test).
- **AC-7** Sharing from a browser or surface that gives no sound shows the sharer a short notice (automated test).
- **AC-8** On staging, sharing a video or a game in Chrome at the default quality: the viewer's browser shows about 30 frames per second (`chrome://webrtc-internals`, written in the PR), and it looks smooth (manual).
- **AC-9** On staging, sharing music from a tab: the viewer hears stereo sound with no pumping or cuts, and the stats show stereo music-quality audio (manual, written in the PR).
- **AC-10** On a slowed connection (Chrome's network throttling on the sharer): in Smooth mode, motion stays fluid and the picture gets softer instead of freezing; in Sharp mode, text stays readable and the frame rate drops (manual).
- **AC-11** After a reload, the sharer's quality and mode and the viewer's quality and volume are the ones chosen before; with nothing saved, the defaults apply (automated test).

## Out of scope

- Several screens at once, cameras, and the focus and thumbnail view (#60). The controls here are built so #60 can use them for each stream.
- Changing LiveKit itself or the server's settings, unless the plan finds it necessary.
- Microphones (decision 11 still holds: screen sound only).

## Open questions

None. Decided with Henrique on 2026-10-03: presets 1080p, 720p and 480p, all at 30 fps (no 60 fps for now); a Smooth and a Sharp mode, Smooth by default; choices remembered in each browser; a YouTube-style volume slider with a speaker icon that mutes.
