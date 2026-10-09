/** How far a drag must go, as a share of the stage's width, to change stream (spec 0159). */
export const SWIPE_SHARE = 0.25;
/** A flick this fast (px per ms) changes stream even when short... */
export const FLICK_SPEED = 0.5;
/** ...as long as it went at least this far. */
export const FLICK_MIN_PX = 30;

/**
 * What a drag on the stage means (spec 0159): `1` the next person (a drag left), `-1` the
 * previous (a drag right), `0` nothing (too short and slow, or mostly up and down).
 */
export function swipeOutcome(dx: number, dy: number, ms: number, width: number): 1 | -1 | 0 {
  if (Math.abs(dy) > Math.abs(dx)) return 0;
  const far = Math.abs(dx) >= width * SWIPE_SHARE;
  const flick = Math.abs(dx) >= FLICK_MIN_PX && Math.abs(dx) / Math.max(1, ms) > FLICK_SPEED;
  if (!far && !flick) return 0;
  return dx < 0 ? 1 : -1;
}
