# Player controls polish — spec

- Issue: #101
- Status: Approved (2026-10-06)
- Owner: Henrique

## Problem

Spec 0098 moved the screen and camera buttons onto the player. Using it in production showed some rough edges:

- After picking a window in Chrome's picker, Chrome jumps to that window, so the sharer doesn't see Xovê's setup window and has to come back to click "Start sharing".
- In fullscreen, clicking share or camera seems to do nothing: the setup window opens behind the player.
- The no-sound mark is a tiny badge in the wrong place.
- The screen button's focus ring circles only the icon, not its arrow.
- The viewer's volume and quality are still an old-style bar on the left: the slider is always shown (even muted or without sound), and the quality is a plain select. They don't match the round buttons.

## Who it's for

- The sharer: starting a share without losing Xovê, also in fullscreen.
- Viewers: a cleaner player, with the same round buttons for what they watch.

## Functional requirements

**Starting a share**

- **FR-1** After the sharer picks a window or tab in the browser's picker, the browser stays on Xovê, so the setup window is right there. Where the browser can't do that, it behaves as today.
- **FR-2** In fullscreen, the setup window (and any message from starting) shows over the fullscreen player, which stays fullscreen.
- **FR-3** The setup window's texts are up to date: settings change "from the button's menu" (not "from your player"), and its no-sound hint matches what the picker offers today (a tab, or a window with "Share this app's audio too").

**The buttons**

- **FR-4** One centred row at the bottom middle of the player holds all the round buttons, in this order: volume, screen, camera, settings. Volume and settings show only while watching someone else's stream; screen and camera always (as in spec 0098). Fullscreen stays in the top-right corner. The row shows, fades and stays like the buttons do today.
- **FR-5** The volume button is round like the others: its speaker icon shows the sound's state (on, muted, none), and a click mutes or unmutes.
- **FR-6** Hovering the volume button (or focusing it) slides a vertical volume slider up above it, easing in; it goes away when the pointer or focus leaves. While muted, or for a stream without sound, no slider shows.
- **FR-7** For a stream without sound, the volume button shows a crossed speaker, is disabled, and its tooltip says "No sound in this stream" (spec 0098 FR-15 still holds). That is the only no-sound mark viewers get.
- **FR-8** The settings button (a gear) opens a menu, like the stream menus, with the viewer's quality: Auto and the qualities this stream offers (spec 0086 FR-9). The choice applies at once and is remembered, as today.
- **FR-9** The screen button's focus ring goes around the whole button, its arrow included.

**No sound**

- **FR-10** The small no-sound badge on the screen button goes away. The sharer still learns their screen has no sound from the screen button's tooltip and menu.

**Everyone**

- **FR-11** The new buttons and menus work with the keyboard (the slider with the arrow keys) and have names for screen readers.

## Acceptance criteria

- **AC-1** Starting a screen share asks the browser not to switch to the picked window or tab (automated test); on staging, picking a window in Chrome stays on Xovê with the setup window open (manual).
- **AC-2** In fullscreen, clicking share or camera shows the setup window over the player, still fullscreen (automated test, plus manual on staging).
- **AC-3** The setup window's texts say "from the button's menu" and give today's sound hint (automated test).
- **AC-4** Watching someone: the row holds volume, screen, camera and settings, in that order, centred; with nobody to watch, only screen and camera; the old bar is gone (automated test).
- **AC-5** The volume button mutes and unmutes; the vertical slider appears on hover or focus and changes the volume; muted or without sound, no slider (automated test).
- **AC-6** Without sound, the volume button shows a crossed speaker, is disabled, and its tooltip says "No sound in this stream" (automated test).
- **AC-7** The settings menu lists Auto and the stream's qualities, ticks the current one, applies and remembers a pick (automated test).
- **AC-8** The screen button has no no-sound badge; its tooltip and menu still explain it to the sharer (automated test).
- **AC-9** Keyboard only: reach every button, move the slider with the arrow keys, use the settings menu; names announced (automated test).
- **AC-10** On staging, in Chrome: the row centred and tidy, the slider easing in on hover, the focus ring around the whole screen button, the crossed speaker and its tooltip (manual, written in the PR).

## Out of scope

- The facecam, thumbnails and their sound controls (spec 0060 and 0098 stay).
- What the stream menus contain (spec 0098).
- Browsers other than Chrome and Edge for FR-1: they behave as today.

## Open questions

None. Decided with Henrique on 2026-10-06: one centred row (volume, screen, camera, settings), fullscreen stays top-right; a vertical slider on hover, none while muted or without sound; a gear menu for quality; the setup window shown inside fullscreen; no sound shown only as a crossed, disabled volume button with a tooltip (no chip, no badge).
