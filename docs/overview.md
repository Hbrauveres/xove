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
- **Share your screen:** the browser's own picker opens; pick a screen, window or tab.
- **Take the screen:** if someone else is sharing, you can take over after confirming. Their share stops and yours starts.
- **Stop sharing:** with the button or the browser's own "Stop sharing" bar.
- **Watch:** the current share fills the stage, with a timer and a full-screen button.

Only one person shares at a time. That rule lives on the server, so every browser agrees on who holds the screen.

## What Xovê deliberately doesn't do (version 1)

- **No camera and no microphone.** Screen and screen audio only. Voice happens wherever the group already talks.
- **No rooms.** One shared space.
- **No recording.** Nothing is stored except accounts, access requests and sessions.
- **No public sign-up.** Every member is approved by a person.

Several screens at once and cameras are possible later: the design keeps "one screen slot" as a limit, not an assumption.

## Environments

| Environment | Purpose | Who reaches it |
| --- | --- | --- |
| Local | Development on your machine | You |
| Staging | Every change merged to `main` lands here first | The maintainer and testers (extra gate in front) |
| Production | Tagged releases | Members |

See [Deployment](deployment.md) for how code moves between them.
