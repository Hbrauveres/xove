# The ambilight's hard edge, dark corners and visible bands — plan

- Spec: [spec.md](spec.md) (approved 2026-10-07)
- Status: Approved (2026-10-07)
- Lab: https://claude.ai/artifact/RLxgFJVPnZWPz81Rg8jU28 (today, heavy, WebGL, light), where the approach was chosen.

## Approach

**Why it fails today** (`web/src/media/ambilight.ts`, `paintRing`). The picture is read back into JavaScript as 64×36 pixels, about 12 times a second. Each of its 200 edge LEDs is painted as a one-cell strip fading outward on a 96×68 canvas, blurred 3 px, and stretched by the page about 15×.
- **The hard edge:** the glow runs right up to the canvas's border, with nothing beyond it to fade into.
- **The dark corners:** only strips straight out from the sides are painted, never the four corner squares.
- **The bands:** each LED is a stretched one-cell block, and the dark tail has few alpha shades, each stretched over many screen pixels.

**The fix: "light"** (Henrique's pick in the lab). The browser's graphics pipeline draws the glow. JavaScript reads no pixels and does no maths per pixel.

Two small canvases per stream are sized from the grid that follows the stage's shape (spec 0107): 2 pixels per cell, the reach of 16 cells, then a margin of 3 empty cells.

1. **Edge canvas.** Every update draws the picture onto it with nine `drawImage` calls:
   - the whole picture under the stage, so no dark rim shows at the stage's rounded edge;
   - its thin edge strips (6 source pixels) stretched outward to the top, bottom, left and right;
   - its four corner patches stretched into the four corners (FR-2).

   They're drawn at partial opacity (`globalAlpha`) over the last update, which is the easing (FR-4a).
2. **Glow canvas** (the one on the page). It copies the edge canvas through one `blur` filter, then keeps it only where a **fade mask** allows (`destination-in`). The mask is made once per grid and holds:
   - the falloff `exp(-3.4·s) · (1 − s³)`, with `s` the distance from the frame over the reach. It reaches exactly zero before the margin, so nothing is cut (FR-1);
   - a fixed grain of ±0.8 on the alpha, the same every update, so the dark shades don't line up as bands (FR-3).
3. **The page stretches it,** as today. Neighbouring colours blend through the bilinear stretch and the blur (FR-3, along the edges).

**Timing (FR-4a).** Updates run on `requestAnimationFrame`, in step with the screen's refresh (up to 60 a second). The easing is a time constant of 120 ms: each update moves `1 − exp(−dt / 120 ms)` of the way, so it feels the same whatever the refresh rate. In the lab, longer easing made flashes linger, and the canvas's 8-bit colours settle early below about 0.12 a frame.

With reduced motion it updates every 500 ms, as today. It still stops while the tab is hidden, the video is paused or missing, or it's switched off. The page fades it in and out with the brightness, as today.

**Unreadable streams (FR-4b).** Nothing reads pixels back, so a stream the page can't read no longer throws, and it gets its light too. The "unreadable, no light" path goes.

**Cost (FR-5).** About a dozen draw calls per update, on canvases of about 200×150 pixels. The cost is the same at 1080p, 2K or 4K, since the page only stretches the canvas. In the lab it was about 0.4 ms on a slow headless browser drawing in software, against 2.2 ms for the heavy version. With a graphics card it's less.

**What stays:**
- the grid that follows the stage's shape (`gridFor`);
- the reach (16 cells, about 44% of the stage's height) and where the canvas sits (`ringPlacement`, now with the margin);
- the switch, the brightness and the per-stream keying in `Stage`.

**Rejected** (all tried in the lab):
- **Heavy:** each pixel computed in JavaScript, with adaptive easing. It looked as good but cost about five times more on the main thread.
- **WebGL at screen resolution:** it looked the smoothest, but stuttered on the 2K monitor, from the graphics card's load per screen pixel.
- **Patching today's strips:** a margin and corner gradients fix the edge and the corners, but not the bands.
- **A CSS blur of a second video element:** a screen-size blur, which lagged at 2K in spec 0104.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `web/src/media/ambilight.ts` | Pure helpers:<br>• `glowLayout(cols, rows)`: canvas size, stage rect, placement with the margin;<br>• `edgeDraws(layout, w, h)`: the nine source/destination rectangles;<br>• `fadeMask(layout, noise)`: alpha bytes with falloff and grain;<br>• `falloff(s)`;<br>• `easeFor(dt, tau)`.<br>`edgeColors`, `easeColors`, `paintRing`, `FALLOFF` and `LED_COUNT` go |
| Web | `web/src/components/stage/Ambilight.tsx` | Edge and glow canvases; the mask built once per grid; a `requestAnimationFrame` loop (500 ms with reduced motion); no pixel reads; no "unreadable" state |
| Web | `web/src/media/ambilight.test.ts`, `components/stage/Ambilight.test.tsx` | Tests for the mask, the draws, the timing and the pauses; the fake 2D context gains `createImageData`, `putImageData`, `globalAlpha` and `globalCompositeOperation` |
| Docs | `docs/architecture.md` (ambilight), `docs/decisions.md` | How the light is drawn now; decision 40 |
| Docs | `CLAUDE.md` | Web test count |

## API and data

None.

## Risks

- **8-bit easing:** drawing over the last frame at partial opacity can't take steps smaller than one colour level. Below about 0.12 a frame, colours stop just short of their target. The 120 ms time constant stays above that at 60 Hz, and `easeFor` has a floor of 0.12. On a 144 Hz monitor the per-frame step is smaller, so the floor matters there; the lab's numbers apply.
- **The look changes slightly:** colours sit crisper near the frame and softer further out than today, and flashes follow quickly. That's what Henrique chose. Check on staging at maximum brightness (AC-5).
- **Cost on weak machines:** a dozen accelerated draws per frame. If needed, the reduced-motion rate already exists, and drawing every second frame is a one-line change.
- **Tests in jsdom:** there's no real canvas. The geometry, mask and timing are tested as pure functions and through the fake context's calls; the look is checked in the lab and on staging.

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `ambilight.test.ts#fadeMask`: alpha is 0 everywhere in the margin and along the canvas's border; 255 under the stage; and it falls to 0 exactly at the reach | unit |
| AC-2 | `ambilight.test.ts#edgeDraws`: the nine destinations tile the whole canvas with no gaps (corners included), and each corner takes its source from that corner of the picture. `#fadeMask`: the alpha diagonally out from a corner equals the alpha straight out from a side at the same distance, so there's no dent | unit |
| AC-3 | `ambilight.test.ts#fadeMask`: along any ray outward the alpha never rises and never drops more than a few levels per pixel (smooth fade). `Ambilight.test.tsx`: each update draws the edge canvas into the glow through a blur, which blends neighbouring colours | unit / web UI |
| AC-4 | `Ambilight.test.tsx`, with fake timers and `requestAnimationFrame`: one update per frame while playing; every 500 ms with reduced motion; none while hidden, paused or off; `getImageData` never called. `#easeFor`: 120 ms gives the same easing per second at 60 and 144 Hz, never below the floor | web UI / unit |
| AC-5 | Staging, maximum brightness on the 2K monitor: no edge, lit corners, no bands, smooth, flashes that don't linger; the performance panel's update well under a millisecond | manual |

## Rollout

Web only, no setting or secret. It reaches staging on merge and production with the next tag. Roll back with `release.yml`'s "Run workflow" button.
