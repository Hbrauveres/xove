# Swipe the stage to change stream — plan

- Spec: [spec.md](spec.md) (approved 2026-10-09)
- Status: Approved (2026-10-09)

## Approach

**Web only.** A swipe ends in the same `pick(personId)` a feed card already calls (`useStagePick`), so the sound, the feed and the "watching" report follow with no new wiring (FR-5).

**Who's next (FR-1, FR-2).**
- A pure function, `stepOnStage(order, current, direction)`, in `media/stagePick.ts` next to `stagePick`.
- It takes the people live in the feed's order (`sharers`, the longest first, me included) and returns the next or previous person's id, wrapping around at both ends.
- It returns null with fewer than two people.

**The gesture (FR-3, FR-6, FR-7).**
- A hook, `useStageSwipe(frameRef, { enabled, onStep })`, listens to pointer events on the stage's frame. Pointer events cover a finger and a mouse alike (FR-7).
- **Which drags count (FR-6):**
  - A drag counts only when it starts on the picture. A pointer that goes down inside `[data-no-swipe]` is ignored. The facecam and the round buttons' layer get that attribute, and so do the menus and the volume slider, which live inside that layer.
  - The facecam keeps its own drag (pointer capture), untouched.
- **While dragging,** the hook sets a `--swipe` offset in pixels on a new wrapper around the stage's picture (`.slide`). The picture follows the finger; the buttons and the dots stay put.
- **On release,** a pure function, `swipeOutcome(dx, dy, ms, width)`, decides:
  - **next or previous:** the drag went at least 25% of the stage's width, or was a fast flick (more than 0.5 px/ms over at least 30 px);
  - **nothing, springing back:** the drag was shorter, or mostly up and down (|dy| > |dx|).
- **On a step,** the wrapper slides out (`translateX(∓100%)`, 180 ms), `pick` is called, and the new picture slides in from the other side.
- **With reduced motion,** there's no transform: `pick` is called at once (FR-3).
- `touch-action: pan-y` on the frame, on the phone, so the browser leaves horizontal drags to the page and keeps vertical ones. The stage itself doesn't scroll (0158 pins it). The feed is outside the frame and scrolls as before.
- **Phone view only:** `enabled` is `layout === "phone"` and at least two people live (FR-4, FR-7).

**The dots (FR-4).**
- A new `StageDots` component, inside the stage's controls layer, so it fades and comes back with the round buttons as everything there does.
- It sits just above them, centred.
- There's one small button per person live, in the same order: `aria-label="Watch Marina"`, and `aria-current` on the one on the stage. Tapping one calls `pick`.
- The current one is a short pill; the others are dots, as in the design.
- There are no dots with fewer than two people live.

**Rejected:**

| Alternative | Why not |
| --- | --- |
| A carousel library (Swiper, Embla) | It would render every stream side by side, playing several videos at the stage's size. Ours shows one video and only changes which. It also adds a dependency for a 50-line gesture. |
| Touch events (`touchstart`, `touchmove`) | They don't fire for a mouse in a narrow desktop window (FR-7); pointer events cover both. |
| Showing the next stream's picture while dragging | It means a second full-size video, downloaded at the stage's quality just in case. The picture moves; the next one appears when it's chosen. |
| Swipe on the whole stage section, info row included | The info row and the feed are for reading and scrolling; only the picture is the stage. |

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `media/stagePick.ts` (+ test) | `stepOnStage(order, current, direction)` |
| Web | `hooks/useStageSwipe.ts` (+ test), with `swipeOutcome` | The gesture: follow, decide, slide, step |
| Web | `components/stage/StageDots.tsx`, `.module.css` (+ test, new) | The dots, tappable |
| Web | `components/stage/Stage.tsx`, `.module.css` | The `.slide` wrapper and its transitions; the hook on the frame; `data-no-swipe` on the controls layer; the dots on the phone |
| Web | `components/stage/Facecam.tsx` | `data-no-swipe` |
| Docs | `docs/architecture.md` ("On a phone held upright") | The swipe and the dots |
| Docs | `CLAUDE.md` | Test counts |

## API and data

None.

## Risks

| Risk | How the plan handles it |
| --- | --- |
| **A swipe fights the browser:** back or forward on iOS edge swipes, or a pull to refresh. | `touch-action: pan-y` on the frame, and only drags that start on the picture count. An iOS edge-back swipe still belongs to the browser (it starts at the screen's edge). Checked on an iPhone (AC-6). |
| **The facecam or a slider drag also swipes.** | `data-no-swipe` on both, ignored where the pointer goes down. Tested (AC-4). |
| **A tap on the picture (to show the controls) reads as a tiny drag.** | Under the threshold nothing happens, and the existing `onPointerDown` still shows the controls. |
| **The video blinks between pictures.** | The `<video>` element stays the same; only its track changes, as with a feed tap. The slide hides the switch. |

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `stagePick.test.ts`: `stepOnStage` next and previous, wrapping both ways, null with one person. `RoomPage.test.tsx` (phone): three live; two left swipes go to the third, a third goes back to the first; a right swipe from the first goes to the third. | web unit / web UI |
| AC-2 | `useStageSwipe.test.ts`: `swipeOutcome` for a short drag, a mostly vertical drag, a 25% drag and a fast flick. `RoomPage.test.tsx`: a short drag leaves the stage alone. | web unit / web UI |
| AC-3 | `StageDots.test.tsx`: one dot per person, `aria-current` on the stage's, a tap calls `pick`, none with one person. | web UI |
| AC-4 | `RoomPage.test.tsx` (phone): a drag that starts on the facecam, or on a round button, doesn't change the stage. | web UI |
| AC-5 | `RoomPage.test.tsx` (phone): after a swipe, the new person's sound is subscribed and the previous one's isn't, the feed lists the previous person, and `PUT /api/streams/watching` reports the new one. | web UI |
| AC-6 | On staging, Android Chrome and iPhone Safari upright: following the finger, the slide, the dots fading, the feed scrolling, reduced motion instant. Written in the PR. | manual |

## Rollout

- Web only: no settings, secrets or migrations.
- Merged to `main`, it reaches staging; Henrique checks AC-6 on two phones, then tags a release.
- Rollback: redeploy the previous web image.
