# A stage that hugs the picture, and a better info row — spec

- Issue: #107
- Status: Approved (2026-10-06)
- Owner: Henrique
- Design: [design.html](design.html), the final clickable draft (round five), also at https://claude.ai/artifact/AnJm8Pn4WmBQVKCRtFCxUi. Its look, sizes and behaviour are the reference: the app matches it.

## Problem

Since spec 0104 the stage is always 16:9 and fits the picture inside it, so anything that isn't 16:9 gets black bars:

- a wide window (Steam, about 1.84:1) gets bars above and below;
- a portrait monitor gets wide bars at the sides, with the picture in a thin strip in the middle.

The info row under the stage looks off too:

- the on-stage avatar's accent ring sticks out past the left edge of the stage;
- the left (who is on the stage) is too plain, and the right ("Also live", its count, and the dashed box) is too much;
- the two sides have different heights;
- "Nobody is sharing right now" is dull;
- in a narrower window, the right side runs past the stage and over the left text.

## Who it's for

Everyone in the room: what they watch, and how the row under it reads.

## Functional requirements

**The stage hugs the picture**

- **FR-1** The page keeps today's 16:9 box: as big as the window allows, with the 24 px margins (spec 0104, FR-1). The info row is always exactly as wide as this box.
- **FR-2** The stage takes the picture's own shape inside that box, so it never shows black bars:
  - **Wider than 16:9 (a wide window, an ultrawide screen):** the stage is the box's full width, and shorter.
  - **Taller than 16:9 (a portrait monitor, a square window):** the stage is the box's full height, narrower, and centred.
  - **Exactly 16:9:** the stage fills the box, as today.
- **FR-3** The shape comes from the picture itself and follows it. When the sharer resizes the window they share, or switches to another, the stage changes shape smoothly (about a third of a second). With reduced motion it changes at once.
- **FR-4** The stage, its info row and the space they leave stay centred in the middle of the page as one block.
- **FR-5** The things on the stage move with it: the round buttons, the facecam and the fullscreen button stay in their places relative to the stage's edges. The ambilight follows the stage's shape, so it glows around the picture, not around the box.
- **FR-6** An empty stage, and a stream still loading, are 16:9.

**The info row**

- **FR-7** Both sides of the row are centred on one line, with the same height.
- **FR-8** The left side (someone on the stage):
  - their avatar, with the accent ring drawn inside it, so its outer edge lines up with the stage's left edge;
  - their name, in the display font;
  - a filled red LIVE badge, what they share, and for how long;
  - who is watching this stream: their avatars side by side (never overlapping), then "N watching". It counts everyone watching, you included, but never the sharer of their own stream. Up to 4 avatars, then the count covers the rest. Hidden while nobody watches.
- **FR-9** The right side:
  - no "Also live" title;
  - the other live streams as small previews, as today, with their sound controls (spec 0104, FR-21a);
  - then, while places are free, a dashed box with the count inside it: "N of 6 live", and under it "M free · share yours". With all 6 live the box is gone, with no empty slot in its place.
- **FR-10** The row always fits the box. When room runs short:
  - the left gives way first: "N watching" drops its words, then its avatars, then the name shortens with an ellipsis;
  - the previews scroll sideways, with the dashed box fixed at the right edge;
  - the scrollbar is slim (4 px), rounded, without arrows, and sits in the gap under the previews so nothing moves. It's faint until the pointer is over the strip, and amber under the pointer.
  - the hover and focus ring of a preview is drawn inside it, so the scrolling strip never cuts it.
- **FR-11** An empty stage:
  - the left says "The stage is *yours*." in the display font, "yours" in the accent colour;
  - under it, the avatars of the others in the room and "Bruno, Ana and Diego are here, waiting for someone to go live."; with more than three, "Bruno, Ana and 5 others are here, …" (avatars of the first ones); alone, "Nobody else is here yet." with no avatars;
  - the dashed box says "0 of 6 live" and "6 free · share yours".

**Small screens**

- **FR-12** On a phone the stage hugs the picture the same way, and the info row stacks as today (spec 0104, FR-23): who's on the stage, then the previews and the box.

## Acceptance criteria

- **AC-1** Given a picture wider than 16:9, the stage is the box's width and the picture's height, with no bars; given a taller one, it's the box's height and the picture's width, centred; given 16:9, an empty stage, or a stream still loading, it fills the box (automated test).
- **AC-2** When the picture's size changes, the stage takes the new shape (automated test).
- **AC-3** On staging, sharing a Steam window, then a portrait monitor: no black bars, the light glows around the picture, the buttons and facecam stay on the stage, and the change of shape is smooth (manual, written in the PR).
- **AC-4** The info row is as wide as the 16:9 box in every case, and the avatar's ring doesn't pass the stage's left edge (manual on staging at 1080p, 2K and a narrower window).
- **AC-5** The left side shows the filled LIVE badge, what's shared, how long, and who's watching (up to 4 avatars and "N watching", counting you but not the sharer; hidden when nobody watches) (automated test).
- **AC-6** The right side has no "Also live" title; the dashed box says "N of 6 live" and "M free · share yours", and is gone with all 6 live; previews still go on the stage when clicked (automated test).
- **AC-7** With nobody live: "The stage is yours.", the others in the room (three, more than three, or alone), "0 of 6 live" and "6 free · share yours" (automated test).
- **AC-8** In a narrow window, the row never runs past the stage: the left gives way, the previews scroll with the slim scrollbar, the box stays in place, and a preview's hover ring isn't cut (manual on staging).

## Out of scope

- Fullscreen: it fills the screen, so a picture of another shape keeps its bars there.
- Rotating and zooming the picture (#103).
- The header, the footer and the dropdowns (spec 0104).
- Making "share yours" clickable.

## Decisions

Made with Henrique on the drafts, 2026-10-06:

- **Hug, not blurred fill:** for tall pictures the stage narrows to the picture's shape. A blurred copy of the picture behind it was drafted and dropped.
- **Two boxes:** the 16:9 box holds the info row and sets its edges. The stage above it is flexible and hugs the stream inside that box.
- **The count lives in the dashed box:** the "Also live" title and the separate "N of 6" are gone. The box is the count and the invitation in one.
- **One height:** both sides of the info row are centred on one line.
- **No overlapping avatars:** avatars in a row sit side by side with a small gap.
- **The left gives way first** in a narrow row; the previews scroll; the dashed box never moves.
- **Rings and scrollbars inside the strip:** a preview's ring is drawn inside it, and the strip's scrollbar is slim, without arrows, and only shows up when pointed at.
- **An invitation for an empty stage:** "The stage is yours." with who's here, instead of "Nobody is sharing right now".
- **All 6 live:** the dashed box disappears, with no empty slot.
- **"N watching"** counts everyone watching, you included; a sharer never counts for their own stream.
- **Who's here, on an empty stage:** up to three names; past that, "and N others"; alone, "Nobody else is here yet.".
- **Fullscreen keeps its bars:** the screen's shape is fixed, so the picture fits inside it.

## Open questions

None.
