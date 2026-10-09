import { useCallback, useEffect, useRef, type RefObject } from "react";

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

/** How long the picture takes to slide out, and the next to slide in. */
export const SLIDE_MS = 180;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

type Options = {
  /** On the phone with at least two people live (spec 0159). */
  enabled: boolean;
  /** Puts the next (`1`) or previous (`-1`) person on the stage. */
  onStep: (direction: 1 | -1) => void;
};

/**
 * Swiping the phone's stage (spec 0159). Spread the handlers on the stage's frame; `slide` is
 * the picture's wrapper, moved with `--swipe` and its `data-phase`: following the finger
 * ("drag"), easing ("settle"), or still. A drag that starts inside `[data-no-swipe]` (the
 * facecam, the round buttons, a menu) is left alone.
 */
export function useStageSwipe(slide: RefObject<HTMLElement | null>, { enabled, onStep }: Options) {
  const start = useRef<{ id: number; x: number; y: number; at: number } | null>(null);
  const timers = useRef<number[]>([]);
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  });
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const move = (px: number, phase?: "drag" | "settle") => {
    const el = slide.current;
    if (!el) return;
    el.style.setProperty("--swipe", `${px}px`);
    if (phase) el.dataset.phase = phase;
    else delete el.dataset.phase;
  };
  const later = (ms: number, then: () => void) => timers.current.push(window.setTimeout(then, ms));

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0 || (e.target as Element).closest("[data-no-swipe]")) return;
      start.current = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now() };
    },
    [enabled],
  );
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    // Up and down is left to the page; only a sideways drag moves the picture.
    if (Math.abs(dx) > Math.abs(e.clientY - s.y)) move(dx, "drag");
  }, []);
  const finish = useCallback((e: React.PointerEvent, cancelled: boolean) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    const width = slide.current?.getBoundingClientRect().width || 1;
    const direction = cancelled ? 0 : swipeOutcome(e.clientX - s.x, e.clientY - s.y, performance.now() - s.at, width);
    if (direction === 0) {
      move(0, "settle");
      later(SLIDE_MS, () => move(0));
      return;
    }
    if (reducedMotion()) {
      move(0);
      step.current(direction);
      return;
    }
    // Out the way the finger went, then the next one in from the other side.
    move(-direction * width, "settle");
    later(SLIDE_MS, () => {
      step.current(direction);
      move(direction * width);
      later(16, () => {
        move(0, "settle");
        later(SLIDE_MS, () => move(0));
      });
    });
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: useCallback((e: React.PointerEvent) => finish(e, false), [finish]),
    onPointerCancel: useCallback((e: React.PointerEvent) => finish(e, true), [finish]),
  };
}
