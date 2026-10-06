/**
 * Ambilight (spec 0104): LEDs around the stage take the colours of the picture's own edges.
 * Pure helpers; `Ambilight.tsx` runs them on the stage's video.
 *
 * The picture is read as a tiny 64×36 frame. Its edges give 200 LEDs, each painted as a
 * strip fading outward into a small canvas, blurred a little at that size. The page then only
 * stretches that small image past the frame: no blur at screen size, so a 4K monitor costs
 * the same as a small one.
 */

export const COLS = 64;
export const ROWS = 36;
/** How far the light reaches beyond the frame, in LED cells: about 40% of the stage's height. */
export const SPREAD = 16;
export const LED_COUNT = COLS * 2 + ROWS * 2;
/** How far each LED moves towards its new colour per update: it breathes instead of flickering. */
export const EASE = 0.3;
/** The light's falloff from the frame outward: strong near it, a long gentle tail. */
export const FALLOFF: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.25, 0.62],
  [0.55, 0.26],
  [0.8, 0.08],
  [1, 0],
];

/**
 * The LEDs' colours from a `cols`×`rows` RGBA frame: the top edge left to right, the bottom
 * edge, the left edge top to bottom, then the right edge. Each is averaged with the pixel next
 * to it inward, so a single bright pixel doesn't flash.
 */
export function edgeColors(px: Uint8ClampedArray, cols = COLS, rows = ROWS): Float32Array {
  const out = new Float32Array((cols * 2 + rows * 2) * 3);
  let i = 0;
  const take = (x: number, y: number, dx: number, dy: number) => {
    const a = (y * cols + x) * 4;
    const b = ((y + dy) * cols + (x + dx)) * 4;
    for (let c = 0; c < 3; c++) out[i++] = (px[a + c] + px[b + c]) / 2;
  };
  for (let x = 0; x < cols; x++) take(x, 0, 0, 1);
  for (let x = 0; x < cols; x++) take(x, rows - 1, 0, -1);
  for (let y = 0; y < rows; y++) take(0, y, 1, 0);
  for (let y = 0; y < rows; y++) take(cols - 1, y, -1, 0);
  return out;
}

/** Moves `current` towards `next` by `k` (1 jumps there), in place. */
export function easeColors(current: Float32Array, next: Float32Array, k: number) {
  for (let i = 0; i < current.length; i++) current[i] += (next[i] - current[i]) * k;
}

/** Where the light's canvas goes, relative to the stage, so its middle covers the stage exactly. */
export function ringPlacement(cols = COLS, rows = ROWS, spread = SPREAD) {
  return {
    left: `${(-spread / cols) * 100}%`,
    width: `${((cols + spread * 2) / cols) * 100}%`,
    top: `${(-spread / rows) * 100}%`,
    height: `${((rows + spread * 2) / rows) * 100}%`,
  };
}

/**
 * Paints the LEDs into `scratch` (each a strip fading outward from its spot on the frame),
 * then copies it into `out` with a 3 px blur: at this tiny size that's cheap, and stretched
 * it reads as a wide, smooth glow. Both canvases are (cols + 2·spread) × (rows + 2·spread).
 */
export function paintRing(
  out: CanvasRenderingContext2D,
  scratch: CanvasRenderingContext2D,
  colors: Float32Array,
  cols = COLS,
  rows = ROWS,
  spread = SPREAD,
) {
  const { width, height } = scratch.canvas;
  scratch.clearRect(0, 0, width, height);
  const S = spread;
  const strip = (j: number, x0: number, y0: number, x1: number, y1: number, w: number, h: number) => {
    const rgb = `${colors[j] | 0},${colors[j + 1] | 0},${colors[j + 2] | 0}`;
    const fade = scratch.createLinearGradient(x0, y0, x1, y1);
    for (const [at, alpha] of FALLOFF) fade.addColorStop(at, `rgba(${rgb},${alpha})`);
    scratch.fillStyle = fade;
    scratch.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h);
  };
  let j = 0;
  for (let x = 0; x < cols; x++, j += 3) strip(j, S + x, S + 1, S + x, 0, 1, S + 1); // top
  for (let x = 0; x < cols; x++, j += 3) strip(j, S + x, S + rows - 1, S + x, S * 2 + rows, 1, S + 1); // bottom
  for (let y = 0; y < rows; y++, j += 3) strip(j, S + 1, S + y, 0, S + y, S + 1, 1); // left
  for (let y = 0; y < rows; y++, j += 3) strip(j, S + cols - 1, S + y, S * 2 + cols, S + y, S + 1, 1); // right

  out.clearRect(0, 0, width, height);
  out.filter = "blur(3px)";
  out.drawImage(scratch.canvas, 0, 0);
  out.filter = "none";
}
