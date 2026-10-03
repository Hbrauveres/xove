# Several streams at once — spec

- Issue: #60 (absorbs #61, cameras)
- Status: Approved (2026-10-03)
- Owner: Henrique

## Problem

Only one person can share at a time. When friends want to show each other something at once (two games, a game and a video), one has to stop so the other can start, and nobody can turn on a camera. The room should hold several streams at once, and a sharer should be able to show their screen and their face together, with a facecam, without the VPS's bandwidth growing out of control.

## Who it's for

- Sharers: up to 6 streams at once, screens and cameras.
- Viewers: up to 20 people in the room, each choosing what to watch big.
- People who arrive when the room is full: they wait their turn.
- Henrique: the VPS's traffic stays within its monthly plan.

## Functional requirements

**Streams**

- **FR-1** Up to 6 streams can be live at once. Each stream is a shared screen or a camera.
- **FR-2** One person can share their screen and turn on their camera at the same time. That takes 2 of the 6 places.
- **FR-3** Anyone in the room can start a stream while a place is free. With 6 live, the start buttons say the room is full of streams.
- **FR-4** Cameras are off by default. A camera turns on only when its person turns it on. No microphones (decision 11).
- **FR-5** Each person stops their own streams. A stream ends by itself when its person leaves or loses connection, as today (spec 0038).

**Watching**

- **FR-6** The first person to start sharing is shown big by default. People who start later appear as thumbnails: small live views of their streams.
- **FR-7** A viewer can click a thumbnail to make that person the big one; the previous one goes back to the thumbnails.
- **FR-8** When the person shown big stops, the one who has been sharing the longest takes the big place.
- **FR-9** When a person shares their screen and their camera together, they're shown with a **facecam**: the screen big, and the camera as a small window on top of it.
  - It starts by itself as soon as the person has both on. A swap button inside the facecam (two arrows, "Swap views" on hover, semi-transparent like the other player buttons) makes the camera big and puts the screen in the facecam; pressing it again swaps them back. The sharer can swap their own preview too.
  - The facecam can be dragged anywhere over the big one, wherever it bothers least.
  - It can be collapsed to a small tab and expanded again.
- **FR-10** Viewers hear the sound of the person shown big. Thumbnails are muted, and each viewer can unmute any of them (with the volume control from spec 0086).
- **FR-11** The controls from spec 0086 work for every stream: the sharer's quality and mode for each of their streams, and each viewer's quality and volume for each stream they watch.
  - A camera goes up to 720p (the default), or 480p. Changed with Henrique on 2026-10-03: no need for more.

**A full room**

- **FR-12** Up to 20 people can be in the room at once, sharers included.
- **FR-13** Someone who arrives when 20 people are in the room goes to a waiting screen. It shows their place in the queue, in order of arrival.
  - When a seat frees, the first in the queue gets a popup with "Enter room" and "Cancel", and 60 seconds to answer. The seat is kept for them meanwhile.
  - "Enter room" takes them in. "Cancel" takes them out of the queue.
  - With no answer in 60 seconds, they go to the end of the queue, and the next person gets the popup.
  - Changed with Henrique on 2026-10-03: entering is confirmed, not automatic.
- **FR-14** Leaving doesn't give up a place at once, whether it's a seat in the room or a place in the queue:
  - If the person **closes the tab** (or the browser), the place is kept for **30 seconds**.
  - If their **connection drops**, it's kept for **60 seconds**.
  - If they come back within that time, they get the same seat or the same place in the queue, and nobody else moves. After that, the place is given up and the queue moves on.
- **FR-15** A person's streams end as soon as they leave or drop, as today (spec 0038), so viewers don't watch a frozen picture. Their stream places are free for others; when they come back, they start sharing again.

**Bandwidth**

- **FR-16** Each viewer receives full quality only for what they watch big. Thumbnails and facecams arrive in low quality, and a quality that nobody is watching isn't sent at all.
- **FR-17** Bandwidth isn't capped by the app (spec 0086, FR-12); the VPS's monthly traffic is watched in Hostinger's panel. Changed with Henrique on 2026-10-03: no fixed budget.

## Acceptance criteria

- **AC-1** Six streams are live at once, screens and cameras mixed; a seventh can't be started and the buttons say why (automated test, plus manual on staging).
- **AC-2** One person shares a screen and a camera together, and they count as 2 of the 6 (automated test).
- **AC-3** A camera is off until its person turns it on, and no microphone is ever requested (automated test).
- **AC-4** When a sharer closes their tab, their streams disappear for everyone within a few seconds, but their seat in the room is kept for 30 seconds (manual on staging).
- **AC-5** The first sharer is big; later sharers are thumbnails; clicking a thumbnail swaps it with the big one; when the big one stops, the longest-sharing remaining person takes the big place (automated test).
- **AC-6** For a person sharing screen and camera: the camera is a facecam over the screen; swapping makes the camera big and puts the screen in the facecam's place; the facecam can be dragged, collapsed and expanded (automated test, plus manual).
- **AC-7** Only the big person's sound plays; unmuting a thumbnail plays its sound too (automated test).
- **AC-8** With 20 people in the room, the 21st sees the waiting screen with their place; when someone leaves, the first in the queue gets the popup: "Enter room" takes them in, "Cancel" takes them out of the queue, and no answer in 60 seconds moves them to the end of the queue and offers the seat to the next; closing the tab and coming back within 30 seconds, or dropping and coming back within 60 seconds, keeps the same seat or queue place without moving anyone; after that time the place is given up and the queue moves on (automated test of the API's room limit and queue, plus manual).
- **AC-9** On staging, with several streams live, a viewer receives high quality only for the big stream, and low quality for thumbnails and the facecam (LiveKit's stats or `chrome://webrtc-internals`, written in the PR).
- **AC-10** On staging, with as many streams and people as can be gathered, the VPS's outgoing traffic is measured and written in the PR, to compare with the monthly 8 TB (Hostinger's panel or LiveKit stats).

## Out of scope

- Video and sound quality settings and controls (spec 0086, done first).
- Microphones and voice chat.
- Recording.
- A takeover policy between streams (#62): with 6 places, nobody is pushed out.

## Open questions

None. Decided with Henrique on 2026-10-03:
- A screen and a camera together take 2 places.
- The first sharer is big by default.
- Sharers count toward the 20 people.
- A full room has a waiting screen with a queue.
- Seats in the room and places in the queue are kept for 30 seconds after the tab closes, and 60 seconds after the connection drops.
- Screen and camera together are shown with a facecam that can be swapped, dragged, collapsed and expanded.
- A free seat is offered with a popup and 60 seconds to confirm; no answer moves the person to the end of the queue.
- Cameras go up to 720p.
