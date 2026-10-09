# The room sideways on a phone, and tablets — spec

- Issues: #160 (the sideways room), #161 (its streams row) and #163 (tablets)
- Status: Approved (2026-10-09)
- Owner: Henrique
- Design: [design.html](design.html), the phone draft (also at https://claude.ai/artifact/BhUv6HajAfQW6xMv6pG8MU). Its **sideways** phone is the reference: the stage filling the screen with its glow, the top gradient, and the streams row along the bottom.

## Problem

Spec 0158 laid the room out for a phone held upright. Turning the phone sideways falls back to the desktop layout: a small stage with a header, an info row and previews squeezed into a short, wide screen. Watching sideways, the way people watch videos on a phone, wastes most of the screen.

The app also only knows "a narrow, upright window": a phone turned sideways is a wide window, so it can't tell it's a phone. A tablet held upright is wider than 760 px, so it gets the desktop layout squeezed into a tall screen.

## Who it's for

Everyone watching on a phone turned sideways, and on a tablet.

## Functional requirements

**Knowing it's a phone**

- **FR-1** A phone is a device whose main pointer is a touch screen and whose screen's shorter side is at most 500 px. A phone always gets a phone view: the upright view (spec 0158) when it's held upright, the sideways view (this spec) when it's sideways.
- **FR-2** A tablet is a device whose main pointer is a touch screen and whose shorter side is more than 500 px. Held upright, it gets the upright view; sideways, the desktop layout.
- **FR-2a** Anything else keeps today's rule: a window up to 760 px wide and at least as tall as wide gets the upright view; otherwise, the desktop layout.
- **FR-2b** On a screen wider than a phone (a tablet upright), the upright view keeps the stage full width (still at most 60% of the screen's height), and centres the info row, the feed and the "Here" cards in a column at most 640 px wide, so the feed's pictures don't grow huge.
- **FR-3** Turning the phone switches between the two views at once. What's playing keeps playing and a share keeps going, as in spec 0158.

**The sideways stage**

- **FR-4** The stage fills the screen, height first: it's as tall as the screen and hugs the picture as everywhere (spec 0107), centred, with black at its sides. The ambilight glows in the space at its sides.
- **FR-5** No header, no logo and no footer. Along the top, over the picture, a black gradient fading downward, with:
  - on the left, who's on the stage, in the phone's info row style (spec 0158, FR-10): the avatar with its ring, "Name · what", then the LIVE badge, the time and "N watching";
  - on the right, the people count, the bell and my avatar, as on the upright top bar; their panels open under them, as tall as the screen allows, scrolling inside.
- **FR-6** The round buttons sit over the bottom of the stage, centred, as on the upright view. The facecam works as everywhere.
- **FR-7** With nobody live: the colour bars fill the stage and glow (spec 0158), the top line says "Nobody live · 0 of 6 · 6 free", and the round buttons are there to go live.

**Fading**

- **FR-8** While a stream plays, everything over the picture fades after about 2.5 s without a touch: the top gradient with its line and buttons, the round buttons, the streams row (it closes) and its tab. Only the picture and its glow stay. A touch on the screen brings them back. Over the empty stage nothing fades.

**The streams row**

- **FR-9** The other live streams (everyone but the one on the stage) sit in one row of small pictures along the bottom, floating over the stage on a black gradient fading upward, with "Live now · N of 6" above them. Each picture shows the person's name over it. The row scrolls sideways when they don't fit. It's silent, as the upright feed is (spec 0158, FR-13).
- **FR-10** The row starts closed. A swipe up on the stage opens it; a swipe down closes it. While it's closed and the controls show, a small tab at the bottom edge opens it on a tap.
- **FR-11** Tapping a picture in the row puts that person on the stage, as a feed card does.
- **FR-12** Swipes start on the picture only, as in spec 0159: dragging the facecam, the round buttons or a menu works as before. A sideways drag on the stage does nothing here (changing stream sideways is the row's job).

## Acceptance criteria

- **AC-1** A touch-first device with a shorter side of 412 px shows the upright view at 412 × 915 and the sideways view at 915 × 412; a desktop window at 915 × 412 shows the desktop layout, and at 412 × 915 the upright view; a touch tablet with a shorter side of 820 px shows the upright view at 820 × 1180 and the desktop layout at 1180 × 820 (automated test). Turning doesn't restart the video (automated test; manual on a phone).
- **AC-1a** On a tablet upright, the stage is full width and the info row, feed and cards sit in a centred column at most 640 px wide (automated test of the styles; manual on a tablet).
- **AC-2** Sideways, the stage is the screen's height and hugs the picture, centred; there's no header, logo or footer; the top line shows who's on the stage (avatar, "Name · what", LIVE, time, watching) on the left, and the people count, the bell and my avatar on the right (automated test). The glow at the sides (manual).
- **AC-3** With nobody live: the bars, "Nobody live" and "0 of 6 · 6 free", and the camera button (automated test).
- **AC-4** While a stream plays, after about 2.5 s without a touch the top line, the round buttons and the row's tab fade, and an open row closes; a touch brings the controls back. Over the empty stage nothing fades (automated test).
- **AC-5** The row starts closed; a swipe up opens it, a swipe down closes it, the tab opens it; it lists every live stream but the stage's with names and "N of 6"; tapping one puts it on the stage; its sound isn't downloaded (automated test).
- **AC-6** A sideways drag on the sideways stage doesn't change the stream; drags starting on the facecam or the buttons don't open or close the row (automated test).
- **AC-7** On staging, on Android Chrome and iPhone Safari, sideways: the stage fills the screen with the glow at its sides, the top gradient and the buttons fade and come back on a touch, the row opens and closes with a swipe and the tab, a tap in the row changes the stage, and turning the phone back and forth keeps the video playing (manual, written in the PR). On a tablet (or a browser's tablet emulation): upright, the upright view with the centred column; sideways, the desktop layout (manual).

## Out of scope

- Multi-view on phones (#162).
- Swiping left or right to change stream sideways (the row does that).
- The desktop layout.

## Decisions

Made with Henrique, 2026-10-09:

- **A phone is touch-first with a small screen** (shorter side ≤ 500 px); it always gets a phone view. Desktops keep the narrow-and-upright rule.
- **#160, #161 and #163 in one spec,** so sideways and tablets are complete in one go.
- **A tablet upright gets the upright view** with its content in a centred 640 px column; sideways, the desktop layout.
- **The row starts closed** and closes with the rest of the controls when nothing is touched.
- **Over the empty stage nothing fades,** as on desktop.
- **Panels open under the top right,** as tall as the screen allows.

## Open questions

None.
