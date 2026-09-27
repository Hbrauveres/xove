# Free the screen when the sharer leaves — spec

- Issue: #38
- Status: Approved (2026-09-27); amended after review (2026-09-27): FR-7, AC-10, note on AC-7
- Owner: Henrique

## Problem

When the person sharing closes the tab, loses connection or their browser crashes, nothing gives the screen slot back. Everyone else keeps seeing "Loading X's screen…" until someone clicks "Take the screen". The room looks broken, and people who don't know about the takeover button think the app froze.

## Who it's for

Viewers in the room (they're stuck on a dead stage) and the next person who wants to share.

## Functional requirements

- **FR-1** When the connection that is sharing leaves the LiveKit room (tab closed, network lost, crash), the API frees the slot. Other connections of the same person (another tab or device) leaving don't free it.
- **FR-2** When the slot holder stops publishing their screen track without calling release (for example the browser ends the capture), the API frees the slot.
- **FR-3** Events about anyone other than the current holder never change the slot.
- **FR-4** The API only acts on events that LiveKit signed for this environment; any other request is refused and changes nothing.
- **FR-5** Viewers see the stage become free within 10 seconds of the sharer closing their tab, with no action from anyone. After a lost connection, the slot is freed as soon as LiveKit reports the sharer gone, however long that takes.
- **FR-6** When the slot is freed this way, everyone's activity feed shows "<sharer> stopped sharing", the same as after Stop.
- **FR-7** Taking the screen requires saying which LiveKit connection and screen track the share comes from. A take without them is refused and changes nothing, so no share can exist that the API can't free.

## Acceptance criteria

- **AC-1** Given Ana holds the slot, when LiveKit reports that Ana left the room, then `GET /api/screen` returns no holder.
- **AC-2** Given Ana holds the slot, when LiveKit reports that Ana's screen share track was unpublished, then `GET /api/screen` returns no holder.
- **AC-3** Given Ana holds the slot, when LiveKit reports that Bruno left the room or unpublished a track, then Ana still holds it.
- **AC-4** Given Ana holds the slot, when LiveKit reports that Ana unpublished a track that isn't her screen share (none exist today, but the rule must hold), then Ana still holds it.
- **AC-5** A request to the event endpoint with a missing or wrong signature gets 401, and the slot doesn't change.
- **AC-6** Given nobody holds the slot, a valid "left" event for anyone is accepted and changes nothing.
- **AC-7** Given Ana shares from her laptop and also has the room open on her phone, when LiveKit reports that her phone connection left, then Ana still holds the slot. (Note: LiveKit allows one connection per person, so in practice opening the phone disconnects the laptop and frees the slot; this AC proves that a report about a connection that isn't sharing never frees it. See plan.md, "Decided trade-off".)
- **AC-8** Given Bruno's room shows Ana sharing, when the slot is freed by an event, then Bruno's feed shows "Ana stopped sharing".
- **AC-9** Manual on staging: Ana shares, then closes her tab; within 10 seconds Bruno's stage shows "Nobody is sharing right now" and his feed shows "Ana stopped sharing".
- **AC-10** A take without the connection or the screen track id gets 400 with a message to reload, and the slot doesn't change.

## Out of scope

- Moving LiveKit to the `infra` repo (Step 5, FR-5.2).
- Any change to how "Take the screen", "Stop" or release work.
- Enforcing the slot on LiveKit's side (only the holder allowed to publish).
- Reconnection grace periods beyond what LiveKit already does.

## Open questions

None. Decided with Henrique on 2026-09-27: only the sharing connection counts (FR-1, AC-7); the 10-second target is for a closed tab, a lost connection frees whenever LiveKit reports it (FR-5); the feed shows "stopped sharing" (FR-6, AC-8).
