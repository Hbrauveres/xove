# Swipe the stage to change stream — spec

- Issue: #159
- Status: Approved (2026-10-09)
- Owner: Henrique
- Design: the upright phone in [0158's design](../0158-phone-upright/design.html) (the dots over the stage, the swipe).

## Problem

On a phone held upright (spec 0158), changing who's on the stage means scrolling the feed under it and tapping a card. When several people are live, a quick way to flick between them is missing, the way a stories or video app lets you swipe.

## Who it's for

Viewers on a phone held upright (the phone view of spec 0158), when more than one person is live.

## Functional requirements

- **FR-1** On the phone view, swiping the stage left goes to the next person live; swiping right goes to the previous one. A person sharing a screen and a camera is one step, as on the stage today (the screen big, the camera in the facecam).
- **FR-2** The order is the feed's: the person sharing the longest first, me included when I'm live. After the last it wraps around to the first, and before the first to the last.
- **FR-3** The picture follows the finger while swiping, then slides out as the next one slides in. A short or slow drag that doesn't go far enough springs back and changes nothing. With reduced motion, the change happens at once, with no slide.
- **FR-4** Dots over the bottom of the stage, just above the round buttons, show how many people are live and which one is on the stage. Tapping a dot puts that person on the stage. The dots fade and come back with the round buttons. With only one person live, there are no dots and swiping does nothing.
- **FR-5** A swipe changes the stage exactly like tapping a card in the feed: the sound follows the stage, the one that was on the stage goes back into the feed, and the change is reported as what I'm watching.
- **FR-6** Only a swipe that starts on the picture counts: dragging the facecam, the round buttons, a menu or the volume slider works as today. Up and down drags do nothing on the stage. The feed under it still scrolls as before.
- **FR-7** It works with a finger and, in a narrow desktop window showing the phone view, with a mouse drag. The desktop layout is unchanged.

## Acceptance criteria

- **AC-1** With three people live, swiping left twice goes from the first to the third, and once more back to the first; swiping right from the first goes to the third (automated test).
- **AC-2** A drag shorter than the threshold, or mostly up and down, changes nothing (automated test).
- **AC-3** The dots show one per person live and mark the one on the stage; tapping one puts that person on the stage; with one person live there are none (automated test).
- **AC-4** A swipe that starts on the facecam or the round buttons doesn't change the stage (automated test).
- **AC-5** After a swipe, the new person's sound plays, the previous one's isn't downloaded, the feed lists the previous one, and what I watch is reported (automated test).
- **AC-6** On staging, on Android Chrome and iPhone Safari held upright: the picture follows the finger and slides, the dots fade with the buttons, the feed still scrolls, and with reduced motion the change is instant (manual, written in the PR).

## Out of scope

- The phone sideways (#160, #161): there, a tap on the streams row changes the stage.
- Swiping on the desktop layout.
- Keyboard shortcuts for next and previous.

## Decisions

Made with Henrique, 2026-10-09:

- **One step per person,** in the feed's order, with wrap-around.
- **The picture follows the finger** and slides; reduced motion switches at once.
- **The dots fade with the buttons** and are tappable; none with one person live.

## Open questions

None.
