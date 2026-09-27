# Free the screen when the sharer leaves — spec

This is a complete example of a spec, written for a real gap in Xovê. When it becomes an issue, it moves to `specs/<issue>-stale-slot/spec.md`.

- Issue: #<number>
- Status: Draft
- Owner: Henrique

## Problem

When the person sharing closes the tab, loses connection or their browser crashes, nothing gives the screen slot back. Everyone else keeps seeing "Loading X's screen…" until someone clicks "Take the screen". The room looks broken, and people who don't know about the takeover button think the app froze.

## Who it's for

Viewers (they're stuck on a dead stage) and the next person who wants to share.

## Functional requirements

- **FR-1** When the slot holder leaves the LiveKit room (tab closed, network lost, crash), the API frees the slot.
- **FR-2** When the slot holder stops publishing their screen track without calling release (for example the browser ends the capture), the API frees the slot.
- **FR-3** Events about anyone other than the current holder never change the slot.
- **FR-4** The API only accepts these events from LiveKit: every request must carry a valid LiveKit webhook signature made with the API's key and secret; anything else is refused.
- **FR-5** Viewers see the stage become free within 10 seconds of the sharer leaving, with no action from anyone.

## Acceptance criteria

- **AC-1** Given Ana holds the slot, when LiveKit sends `participant_left` for Ana's identity, then `GET /api/screen` returns no holder.
- **AC-2** Given Ana holds the slot, when LiveKit sends `track_unpublished` for Ana's `screen_share` track, then the slot is free.
- **AC-3** Given Ana holds the slot, when LiveKit sends `participant_left` for Bruno, then Ana still holds it.
- **AC-4** A webhook request with a missing or wrong signature gets 401 and changes nothing.
- **AC-5** Manual on staging: Ana shares, closes her tab; within 10 seconds Bruno's stage shows "Nobody is sharing right now".

## Out of scope

- Enforcing the slot on LiveKit's side (only the holder allowed to publish): a separate spec.
- Reconnection grace periods (keeping the slot for a sharer who comes back within N seconds).

## Open questions

None.
