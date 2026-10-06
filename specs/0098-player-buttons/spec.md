# Share and camera buttons on the player — spec

- Issue: #98
- Status: Approved (2026-10-05)
- Owner: Henrique

## Problem

Starting a share or the camera happens in a bar under the player: two large buttons and a line of hint text. It takes space, looks heavy next to the player, and splits the controls in two: the buttons are under the player, while the quality and mode of a live stream are changed from the sharer's own player bar. To share something else, the sharer has to stop and start again; to switch webcams, turn the camera off and on.

Discord puts these controls on the stream itself: round buttons at the bottom, each with a small menu for its settings. Xovê should feel the same.

## Who it's for

- The sharer: starting, stopping and adjusting their screen and camera.
- Everyone in the room: a cleaner page, with the stage taking the space the bar used.

## Functional requirements

**The buttons**

- **FR-1** The bar under the player goes away: its buttons, its hint text and its notices.
- **FR-2** Two round buttons sit over the bottom center of the stage: screen and camera. Icons only, semi-transparent like the player's other buttons. Off: the icon with a slash. Live: the button lights up in the accent colour. A click starts or stops that stream.
- **FR-3** Each button has a tooltip on hover and keyboard focus saying what a click does: "Share your screen", "Stop sharing", "Turn on camera", "Turn off camera".
- **FR-4** When the stage is empty, the buttons are always shown. While a stream plays, they show and fade with the player's labels and bars (spec 0086 FR-13): mouse movement or a tap shows them, and they stay while one has the keyboard focus or a menu is open. The same in fullscreen.
- **FR-5** Starting works as today: the browser's picker (or camera prompt), then the setup window with a preview and the settings, and nothing is sent until "Start".

**The menus**

- **FR-6** While a stream is live, its button shows a small arrow (▾) that opens its menu. The arrow isn't shown while the stream is off.
- **FR-7** The screen's menu: Quality, Mode, Change window, Stop sharing. The camera's menu: Quality, Mode, the list of cameras to pick from, Turn off camera. Quality and mode changes apply live, as today (spec 0086 FR-7).
- **FR-8** "Change window" opens the browser's picker again. Picking something swaps what is shared at once, with the current settings (no setup window): viewers keep watching the same stream, with no stop and start, and the sound follows the new pick (spec 0095). Closing the picker keeps the current share.
- **FR-9** Picking another camera in the camera's menu switches to it without turning the camera off. This browser remembers the camera picked.
- **FR-10** The sharer's own player no longer has quality and mode menus: the button's menu is the one place for them.
- **FR-11** The menus are easy to read: their text stays legible on the menu's background, also when the button is lit.

**Messages**

- **FR-12** When 6 streams are live, the buttons of streams that are off are greyed out, and their tooltip says "6 streams are live, the most at once. You can start yours when one stops." Live streams can still be changed or stopped.
- **FR-13** When a shared screen has no sound, the screen button shows a small muted-speaker badge; its tooltip and its menu explain how to share sound (today's notice).
- **FR-14** While a start, change or stop is on its way, the buttons wait (as today).
- **FR-15** For viewers, a screen shared without sound shows its volume as muted, and it can't be unmuted. When the sharer changes to a window or tab with sound, the volume control works again, at the viewer's own volume.

**Everyone**

- **FR-16** In a browser that can't share a screen (phones), only the camera button shows.
- **FR-17** The buttons and menus work with the keyboard and have names for screen readers.
- **FR-18** The player's fullscreen button toggles: in fullscreen, clicking it leaves fullscreen (today it does nothing), and its name says which it does ("Fullscreen", "Exit fullscreen").
- **FR-19** The other live streams (the thumbnails under the player) are centred under the player, and still scroll sideways when they don't fit.
- **FR-20** A thumbnail's orange ring on hover and keyboard focus shows whole: never cut off by the row's edges or hidden behind other parts of the page.

## Acceptance criteria

- **AC-1** The room page has no bar under the player; the screen and camera buttons are on the stage, with the right icon, state and tooltip when off and when live (automated test).
- **AC-2** A click starts (picker, setup window, Start) or stops each stream, as today (automated test).
- **AC-3** On an empty stage the buttons are always shown; over a playing stream they fade and come back with the player's bars, and stay while focused or while a menu is open (automated test).
- **AC-4** The arrow shows only on a live stream's button; its menu lists the items of FR-7, and changing quality or mode reaches the API and the stream, as today (automated test).
- **AC-5** "Change window" with a new pick swaps the shared video (and sound) on the same stream, without stopping it; closing the picker changes nothing (automated test, plus manual on staging: viewers see the new window without a break).
- **AC-6** Picking another camera switches the camera without turning it off, and the choice is used next time (automated test, plus manual on staging with two webcams).
- **AC-7** The sharer's own player has no quality or mode menu (automated test).
- **AC-8** With 6 streams live, off buttons are disabled with the "6 streams" tooltip, and live ones still work (automated test).
- **AC-9** A screen shared without sound shows the badge, and the explanation is in its tooltip and menu (automated test).
- **AC-10** Without screen sharing in the browser, the screen button isn't shown (automated test).
- **AC-11** The buttons and menus can be used with the keyboard alone, and screen readers announce them (automated test).
- **AC-12** A viewer of a screen without sound sees its volume muted and can't unmute it; after the sharer changes to a window with sound, they can (automated test).
- **AC-13** In fullscreen, the fullscreen button leaves it; outside, it enters it (automated test).
- **AC-14** On staging, in Chrome: the buttons look like the preview (round, icons, lit when live), the menus' text is readable, and everything works in fullscreen, including leaving it with the button; the thumbnails are centred and their ring shows whole, the first and last included (manual, written in the PR).
- **AC-15** The thumbnails row is centred under the player, and its hover and focus ring is drawn inside the row so nothing clips it (automated test of the styles where possible; manual on staging).

## Out of scope

- The viewer's controls (volume, quality) stay as they are.
- What the setup window shows.
- Microphones (decision 11).
- A layout for phones beyond hiding the screen button.

## Open questions

None. Decided with Henrique on 2026-10-05, after a clickable preview: buttons at the bottom centre that fade with the player; the setup window kept for starting; an arrow menu per live stream (no gear); "Change window" swaps at once; a camera list in the camera's menu; the sharer's player loses its quality and mode menus; tooltips and a no-sound badge instead of the bar's texts; icons only; the screen button hidden on phones; the buttons also in fullscreen; a no-sound screen stays muted for viewers; the fullscreen button also leaves fullscreen. Added on 2026-10-05 with the plan: the thumbnails centred under the player, and their hover ring never clipped.
