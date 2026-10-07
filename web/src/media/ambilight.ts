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

/** The most cells along the stage's longer side: past that, a very long stage gets wider cells. */
const MAX_CELLS = 96;

/**
 * The grid for a stage of shape `r` (width ÷ height, spec 0107): square cells, ROWS of them
 * along the shorter side, so the light reaches as far beyond every edge. 64×36 at 16:9.
 */
export function gridFor(r: number): { cols: number; rows: number } {
  const long = (k: number) => Math.min(MAX_CELLS, Math.round(ROWS * k));
  return r >= 1 ? { cols: long(r), rows: ROWS } : { cols: ROWS, rows: long(1 / r) };
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

// ---- Spec 0118: the light drawn by the graphics pipeline, with no pixel reads. ----
// The picture's edges are drawn stretched outward onto a small canvas, eased by drawing over
// the last update at partial opacity, blurred once and cut by a fade mask made once. The page
// stretches it. These helpers hold the geometry; `Ambilight.tsx` does the drawing.

/** Canvas pixels per cell. */
export const CELL_PX = 2;
/** Empty cells past the reach, so the fade ends inside the canvas and nothing is cut. */
export const MARGIN = 3;
/** How thick a strip of the picture's edge is stretched outward, in source pixels. */
const STRIP = 6;
/** The smallest easing step: drawing at less than this, 8-bit colours settle short of the target. */
const EASE_FLOOR = 0.12;

export type GlowLayout = {
  width: number;
  height: number;
  /** The stage inside the canvas, in canvas pixels. */
  stage: { x: number; y: number; w: number; h: number };
  /** Where the canvas sits round the stage, so its middle covers the stage exactly. */
  placement: { left: string; width: string; top: string; height: string };
};

export function glowLayout(cols: number, rows: number): GlowLayout {
  const off = SPREAD + MARGIN;
  return {
    width: (cols + off * 2) * CELL_PX,
    height: (rows + off * 2) * CELL_PX,
    stage: { x: off * CELL_PX, y: off * CELL_PX, w: cols * CELL_PX, h: rows * CELL_PX },
    placement: {
      left: `${(-off / cols) * 100}%`,
      width: `${((cols + off * 2) / cols) * 100}%`,
      top: `${(-off / rows) * 100}%`,
      height: `${((rows + off * 2) / rows) * 100}%`,
    },
  };
}

type Rect = [number, number, number, number];
export type EdgeDraw = { at: string; src: Rect; dst: Rect };

/**
 * The nine draws that put a `w`×`h` picture on the canvas: the whole picture under the stage
 * (so no dark rim shows at its rounded edge), each edge strip stretched outward, and each
 * corner patch stretched into its corner. Together they cover every canvas pixel once.
 */
export function edgeDraws(l: GlowLayout, w: number, h: number): EdgeDraw[] {
  const { x, y, w: sw, h: sh } = l.stage;
  const x1 = x + sw, y1 = y + sh, R = l.width - x1, B = l.height - y1;
  const e = STRIP;
  return [
    { at: "stage", src: [0, 0, w, h], dst: [x, y, sw, sh] },
    { at: "top", src: [0, 0, w, e], dst: [x, 0, sw, y] },
    { at: "bottom", src: [0, h - e, w, e], dst: [x, y1, sw, B] },
    { at: "left", src: [0, 0, e, h], dst: [0, y, x, sh] },
    { at: "right", src: [w - e, 0, e, h], dst: [x1, y, R, sh] },
    { at: "top-left", src: [0, 0, e, e], dst: [0, 0, x, y] },
    { at: "top-right", src: [w - e, 0, e, e], dst: [x1, 0, R, y] },
    { at: "bottom-left", src: [0, h - e, e, e], dst: [0, y1, x, B] },
    { at: "bottom-right", src: [w - e, h - e, e, e], dst: [x1, y1, R, B] },
  ];
}

/** The light's strength at `s` of the reach: strong at the frame, a long tail, exactly zero at 1, with no kink. */
export function falloff(s: number): number {
  if (s <= 0) return 1;
  if (s >= 1) return 0;
  return Math.exp(-3.4 * s) * (1 - s * s * s);
}

/** A fixed pseudo-random sequence (mulberry32), so the grain is the same every time. */
function grainOf(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The fade mask's alpha, one byte per canvas pixel: 255 under the stage, the falloff by
 * distance from the frame (the corners measured from the corner, so the light wraps round),
 * zero from the reach on, plus a fixed grain of ±0.8 so the darkest shades don't band.
 */
export function fadeMask(l: GlowLayout): Uint8ClampedArray {
  const { width, height, stage } = l;
  const reach = SPREAD * CELL_PX;
  const grain = grainOf(118);
  const out = new Uint8ClampedArray(width * height);
  for (let py = 0; py < height; py++) {
    const cy = py + 0.5;
    const dy = Math.max(stage.y - cy, 0, cy - (stage.y + stage.h));
    for (let px = 0; px < width; px++) {
      const cx = px + 0.5;
      const dx = Math.max(stage.x - cx, 0, cx - (stage.x + stage.w));
      const s = Math.hypot(dx, dy) / reach;
      const g = (grain() - 0.5) * 1.6;
      out[py * width + px] = s >= 1 ? 0 : s <= 0 ? 255 : Math.round(falloff(s) * 255 + g);
    }
  }
  return out;
}

/** How far an update eases towards the new picture after `dt` ms, for a time constant `tau` ms. */
export function easeFor(dt: number, tau: number): number {
  if (tau <= 0) return 1;
  return Math.min(1, Math.max(EASE_FLOOR, 1 - Math.exp(-dt / tau)));
}
