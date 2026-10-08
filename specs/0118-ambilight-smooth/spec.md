# The ambilight's hard edge, dark corners and visible bands — spec

- Issue: #118
- Status: Approved (2026-10-07; response speed and unreadable streams added the same day, see Decisions)
- Owner: Henrique
- Type: defect, in the ambilight from spec 0104 (with the grid that follows the stage's shape, spec 0107).

## Problem

On production (v0.0.8), the ambilight around the stage shows three flaws, most visible at high brightness on the black ground:

1. **A hard edge.** The glow doesn't fade all the way to nothing: where the effect stops, a line shows, as if the light were cut by a box.
2. **Dark corners.** The light reaches out from the four sides but not around the corners. Each corner shows a dent, as if something were blocking the light there.
3. **Visible bands.** Along the edges, the change from one colour to the next shows steps. From the bright side outward, the fade shows steps too, instead of a smooth gradient.

## Who it's for

Everyone watching a stream with the ambilight on.

## Functional requirements

- **FR-1** The glow fades smoothly to the ground colour on every side. No line, edge or box shows where it ends, at any brightness up to the maximum.
- **FR-2** The glow wraps around the corners. Each corner is lit by the colours of the picture's corner, blending into the two sides next to it, with no dent and no seam.
- **FR-3** The glow blends smoothly:
  - along the stage's edges, between neighbouring colours;
  - outward, from the bright edge to nothing.

  No steps or bands are visible, on any size of monitor up to 4K.
- **FR-4** Everything else about the ambilight stays the same:
  - how far it reaches;
  - how it follows the picture's shape;
  - the on/off switch and the brightness slider;
  - it pauses with the tab hidden, the video paused or the stage empty, and slows down with reduced motion.
- **FR-4a** It follows the picture closely and smoothly:
  - it updates in step with the screen's refresh, up to 60 times a second, so it never stutters;
  - it eases towards new colours over about a tenth of a second, so it breathes instead of flickering, but a flash or a cut doesn't linger after it's gone.
- **FR-4b** A stream the page isn't allowed to read pixel by pixel still gets its light (today it gets none).
- **FR-5** It stays as light on the computer as today or lighter: about the same cost on a 1080p, 2K or 4K monitor, and well under a millisecond per update on the page's main thread.

## Acceptance criteria

- **AC-1** At the light's outer border, the painted glow is fully transparent all the way round, with nothing beyond it to cut (automated test of the painting).
- **AC-2** With a picture whose corners are lit, the corner areas of the glow are lit too, and continuous with both sides next to them (automated test of the painting).
- **AC-3** Between two neighbouring LEDs of very different colours, the glow changes gradually across the space between them, not in one step (automated test of the painting).
- **AC-4** The light updates once per screen refresh while playing (up to 60 a second), and slowly with reduced motion. It still pauses when hidden, paused or switched off. It reads no pixels, so an unreadable stream is lit too (automated tests).
- **AC-5** On staging, at maximum brightness on a 2K monitor: no edge, lit corners, no visible bands, smooth movement, flashes that don't linger, and the page stays smooth; Chrome's performance panel shows the update well under a millisecond (manual, written in the PR).

## Out of scope

- The light's colours or reach.
- A new look for the ambilight (more spread, other shapes).
- The light's settings in the account menu.

## Decisions

Made with Henrique on 2026-10-07, in the ambilight lab (https://claude.ai/artifact/RLxgFJVPnZWPz81Rg8jU28):

- **The "light" approach:** the browser's graphics pipeline draws the glow, with no pixel reads. A per-pixel "heavy" version and a WebGL version were tried. Heavy looked as good but cost five times more; WebGL stuttered on the 2K monitor.
- **Smooth and quick:** updates at the screen's refresh, with easing of about a tenth of a second. Slower easing made flashes linger.

## Open questions

None.
