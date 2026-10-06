# A stage that hugs the picture, and a better info row — plan

- Spec: [spec.md](spec.md) (approved 2026-10-06)
- Status: Approved (2026-10-06)

## Approach

**The stage takes the picture's shape, in CSS, from one number.** Today `.box` and `.frame` in `Stage.module.css` are both `aspect-ratio: 16 / 9`, and the video is `object-fit: contain` inside. The column keeps its 16:9 sizing (RoomPage's `.column` is unchanged, so the info row keeps the box's edges, FR-1). The stage section becomes an inline-size container, and the box gets its size from the picture's shape `r`, passed as a CSS variable `--shape`:

- width `min(100cqw, 100cqw * 9 / 16 * r)`;
- height `min(100cqw / r, 100cqw * 9 / 16)`.

A wide picture keeps the full width and gets shorter; a tall one keeps the full height and gets narrower. `margin-inline: auto` centres it. The frame fills the box, so the buttons, the facecam (placed in fractions of the frame) and the fullscreen button move with it (FR-5). Width and height transition in 0.35 s, and not at all with reduced motion (FR-3). The column already centres its content vertically, so the shorter block stays in the middle (FR-4). The video keeps `object-fit: contain`: inline, its box now has the picture's shape, so nothing shows; in fullscreen, it keeps its bars as the spec says.

**Where `r` comes from.** A small hook, `useVideoShape(video)`, reads `videoWidth / videoHeight` from the big `<video>` that `Stage` already holds for the ambilight (`bigVideoEl`, mine or someone else's). It reads on `loadedmetadata` and on the video's `resize` event, which fires when the sharer resizes or switches the window (FR-3). It returns 16:9 until a size arrives, for an empty stage, and while loading (FR-6). To avoid jitter between simulcast layers (1920×1080 vs 1918×1080), it ignores changes under 1%.

**The ambilight follows the shape (FR-5).** The light's canvas is already placed in percentages of the box, so it follows the box. On their own, though, its 64×36 cells would stretch with an odd shape, and the glow would reach unevenly. `ambilight.ts`'s helpers already take `cols` and `rows`. A new `gridFor(r)` keeps the cells square:
- 36 cells along the shorter side, and the longer side to scale, capped at 96;
- the same 16-cell spread, so the glow reaches the same distance on every side.

A 16:9 picture stays at today's 64×36 (200 LEDs), and a portrait one gets 36×64; even 21:9 is about 240 LEDs, so the cost stays well under a millisecond. The canvas is keyed by its grid, so a change of shape starts a fresh one.

**The info row.**
- **Layout:** `.info` becomes a flex row, centred on one line (FR-7), and an inline-size container. The left grows and shrinks (`flex: 1; min-width: 0`). The right is `flex: 0 1 auto` with `max-width: calc(100% - 280px)`, so it never runs past the box; on phones it still stacks as today (FR-12).
- **`NowWatching` (left):**
  - a 52 px avatar with the ring drawn inside it (FR-8). It's a new `ring="inside"` option on `Avatar`, painted by an `::after` with inset shadows. The people panel keeps its outer ring.
  - a filled LIVE badge, and who's watching: `watchers: Friend[]`, up to 4 avatars side by side and "N watching".
  - Container queries drop the words under 900 px and the avatars under 760 px; the name already ends in an ellipsis (FR-10).
  - Empty, it shows "The stage is *yours*." and a "who's here" line from a pure `whoIsHere(names)` (FR-11): one, two or three names, then "and N others", alone "Nobody else is here yet.".
- **`AlsoLive` (right):**
  - loses its head, and the previews go in their own scroller. The free box sits outside it, so it never moves, and holds the count: "N of 6 live" / "M free · share yours". It's gone when nothing is free (FR-9).
  - The scroller gets the draft's slim scrollbar, through `::-webkit-scrollbar` with a standard `scrollbar-width` fallback (FR-10). A preview's ring is already drawn inside (spec 0101).
- **Data:** who watches whom is already in the session (`watchingOf`, spec 0104). RoomPage computes the watchers of the big person from `session.people` and `watchingOf`: anyone whose `sharerId` is the person on the stage, me included, never the sharer. It hands them to `Stage` with the others in the room. No API change.

**Rejected:**
- **A blurred fill for tall pictures:** decided on the drafts.
- **Measuring the stage in JS** (ResizeObserver plus pixel sizes): CSS container units do it with one variable and no re-render on resize.
- **`aspect-ratio: var(--shape)` on the box:** a change of shape wouldn't animate as smoothly, and the box would need a max height anyway.
- **Keeping the ambilight's 64×36 grid for every shape:** on a portrait picture the glow would reach far above and below but barely beside it.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `web/src/hooks/useVideoShape.ts` (new) | The picture's width/height from a `<video>`, 16:9 until known, following `resize`, ignoring changes under 1% |
| Web | `web/src/components/stage/Stage.tsx` + `.module.css` | `--shape` on the box, container sizing, transition; passes the shape to the ambilight; takes `watchers` and `others` for the info row; the info row as a flex row and an inline-size container |
| Web | `web/src/media/ambilight.ts`, `components/stage/Ambilight.tsx` | `gridFor(r)`; the sampler, the canvas and its placement use that grid; keyed by it |
| Web | `web/src/components/ui/Avatar.tsx` + `.module.css` | `ring="inside"` option |
| Web | `web/src/components/stage/NowWatching.tsx` + `.module.css` | Bigger avatar with the inner ring, the LIVE badge, who's watching (with container queries), the empty-stage invitation; `whoIsHere()` |
| Web | `web/src/components/stage/AlsoLive.tsx` + `.module.css` | No head; previews in a scroller with the slim scrollbar; the count inside the free box; the box fixed, gone when full |
| Web | `web/src/pages/RoomPage.tsx` | Watchers of the person on the stage and the others in the room, passed to `Stage` |
| Docs | `docs/architecture.md`, `docs/overview.md` | The stage's shape, the light's grid, the info row as it now reads |
| Docs | `docs/decisions.md` | Decision 37: the stage hugs the picture inside a 16:9 box |
| Docs | `CLAUDE.md` | Web test count |

## API and data

None. Who watches what already comes from `GET /api/streams` (`watching`, spec 0104).

## Risks

- **Extreme shapes:** a very thin window (say 1:4) gives a narrow stage. That's the agreed hug. The buttons row fits down to about 260 px wide, and a stage that narrow only happens for a picture under about 1:2.6 on a 1080p screen. The facecam is placed in fractions, so it stays inside.
- **Shape changes while watching:** the transition moves the buttons and facecam smoothly. The ambilight starts a fresh canvas, so it fades back in rather than jumping.
- **Jitter between simulcast layers:** changes under 1% are ignored.
- **Fullscreen:** the frame fills the screen, as today, with the video contained, so bars there are expected (out of scope).
- **Browser support:** container units, `min()` and container queries are in every browser Xovê supports (spec 0104 already relies on them). Firefox gets the standard thin scrollbar instead of the WebKit-styled one.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `useVideoShape.test.ts`: 16:9 without a video or size; the video's ratio once known. `Stage` via `RoomPage.test.tsx#the stage takes the picture's shape`: the box's `--shape` for a wide, a tall, an empty and a loading stage | web UI |
| AC-1, FR-5 | `ambilight.test.ts#gridFor`: 64×36 at 16:9, 36×64 at 9:16, capped at 96; square cells | unit |
| AC-2 | `useVideoShape.test.ts#follows a resize`, and ignores a change under 1% | web UI |
| AC-3 | Staging: share a Steam window, then a portrait monitor; no bars, the light around the picture, the buttons and facecam on the stage, a smooth change | manual |
| AC-4 | Staging at 1080p, 2K and a narrower window: the info row as wide as the box; the ring inside the stage's left edge | manual |
| AC-5 | `NowWatching.test.tsx`: LIVE, what and how long; who's watching (4 avatars and "N watching", counting me, not the sharer; hidden when none). `RoomPage.test.tsx`: watchers taken from the session | web UI |
| AC-6 | `AlsoLive.test.tsx`: no "Also live" title; "N of 6 live" and "M free · share yours"; no box when full; a click on a preview picks it | web UI |
| AC-7 | `NowWatching.test.tsx`: "The stage is yours.", and the who's-here line for three, more than three and alone; `AlsoLive.test.tsx`: "0 of 6 live" and "6 free · share yours" | web UI |
| AC-8 | Staging in a narrow window: the left gives way, the previews scroll with the slim bar, the box stays, the hover ring is whole | manual |

## Rollout

Web only, no setting or secret. It reaches staging on merge and production with the next tag. Roll back with `release.yml`'s "Run workflow" button.
