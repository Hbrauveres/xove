# Only the app's sound when sharing a window — spec

- Issue: #95
- Status: Approved (2026-10-04)
- Owner: Henrique

## Problem

Friends talk on Discord while they watch each other on Xovê. When someone shares one app's window, say a game, Chrome only offers "Share system audio", which sends everything the computer plays, Discord included. Friends hear their own voices back in the stream, a moment late: an echo.

Chrome can send only the shared app's sound, but its picker offers that only when the page asks for it. Xovê doesn't ask today.

## Who it's for

- The sharer: what sound their stream carries when they share a window.
- Viewers: no echo of their own voices.

## Functional requirements

- **FR-1** When the sharer picks a window in Chrome's picker, the sound switch offers that app's sound (all its windows), not the whole system sound.
- **FR-2** Sharing a tab works as today: that tab's sound.
- **FR-3** Sharing the whole screen sends the system sound without Xovê's own sound (the streams playing in Xovê), so viewers don't hear themselves through Xovê. Other apps' sound, Discord included, still comes through.
- **FR-4** In a browser that can't share an app's sound, sharing works as today (the system sound or none), and the notice from spec 0086 still shows when no sound is shared.
- **FR-5** The app's sound reaches viewers with the same quality as today (spec 0086 FR-3: stereo, music quality, no voice filters).

## Acceptance criteria

- **AC-1** Starting a screen share asks the browser for the app's sound when a window is picked, and to leave out Xovê's own sound (automated test of the capture settings).
- **AC-2** On staging, in Chrome on Windows, picking a window shows the switch "Share this app's audio too" (or its translation), not "Share system audio" (manual, written in the PR).
- **AC-3** On staging, sharing a game or player window with that switch on while a Discord call plays: viewers hear the app, and not the Discord call (manual, written in the PR).
- **AC-4** On staging, sharing a tab still carries its sound as before (manual, written in the PR).
- **AC-5** On staging, sharing the whole screen while a friend's stream plays sound in Xovê: viewers hear other apps, but not that stream coming back (manual, written in the PR).

## Out of scope

- Leaving one app's sound out of a full-screen share: only the operating system can do that, not a browser.
- Mixing the sound of several apps into one stream.
- Cameras and microphones (decision 11 still holds).

## Open questions

None. Decided with Henrique on 2026-10-04: a full-screen share leaves out Xovê's own sound.
