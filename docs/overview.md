# Overview

## What Xovê is

A private "watch my screen" room for a group of friends. One person shares a screen, a window or a browser tab, and everyone else in the room sees it live, with the tab's sound if they chose to share it. It's built for things like watching someone play a game, walking through code together, or showing something on your screen without setting up a meeting.

There's exactly one room: opening the app is entering it.

## Who can use it

Access is by invitation, handled inside the app:

1. Anyone can sign in with a Google account.
2. A new account lands on a "You need access" page and can send a request, with an optional message.
3. An admin approves or declines requests from the admin page.
4. Approved members go straight to the room from then on. An admin can remove a member at any time, which also signs them out everywhere.

Admins are configured on the server (a list of emails). Admins are always members.

## What you can do in the room

- **See who's here:** everyone connected right now, and a feed of who joined, left, started or stopped sharing.
- **Share your screen:** the round buttons at the bottom of the player share your screen or turn on your camera. The browser's own picker opens; pick a screen, window or tab, and you stay on Xovê to start.
- **Turn on your camera:** alongside your screen or on its own. Your camera then shows as a facecam over your screen.
- **Several at once:** up to 6 streams live (screens and cameras), nobody is pushed out.
- **While live:** the small arrow on your button opens its menu: quality, mode, "Change window" (share something else without stopping) or another camera.
- **Stop:** with the buttons or the browser's own "Stop sharing" bar.
- **Watch:** one person fills the stage, with a timer and a fullscreen button (click it again to leave); the others are thumbnails. Click one to watch it big. Only the big one's sound plays, unless you unmute a thumbnail. The volume button (point at it for the slider) and the gear (quality) sit with your own buttons.
- **Wait your turn:** up to 20 people in the room. When it's full, you get a place in the queue and a popup when a seat frees.

The limits live on the server, so every browser agrees on who is in and what's live.

## What Xovê deliberately doesn't do (version 1)

- **No microphone.** Screens, their sound, and cameras. Voice happens wherever the group already talks.
- **No rooms.** One shared space.
- **No recording.** Nothing is stored except accounts, access requests and sessions.
- **No public sign-up.** Every member is approved by a person.

Several screens and cameras came with [spec 0060](../specs/0060-several-streams/spec.md).

## Environments

| Environment | Purpose | Who reaches it |
| --- | --- | --- |
| Local | Development on your machine | You |
| Staging | Every change merged to `main` lands here first | The maintainer and testers (extra gate in front) |
| Production | Tagged releases | Members |

See [Deployment](deployment.md) for how code moves between them.
