import { useEffect, useRef, type RefObject } from "react";

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
  /** A slide out and in is running: a new drag waits until it's done. */
  const sliding = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  // The latest stage and order, when a slide finishes after a re-render (or the phone turned).
  const latest = useRef({ enabled, onStep });
  useEffect(() => {
    latest.current = { enabled, onStep };
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  /** Where the picture is, and how it gets there. */
  const place = (px: number, phase?: "drag" | "settle") => {
    const el = slide.current;
    if (!el) return;
    el.style.setProperty("--swipe", `${px}px`);
    if (phase) el.setAttribute("data-phase", phase);
    else el.removeAttribute("data-phase");
  };
  const later = (ms: number, then: () => void) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(then, ms);
  };
  const settle = (then?: () => void) => {
    place(0, "settle");
    later(SLIDE_MS, () => {
      place(0);
      sliding.current = false;
      then?.();
    });
  };

  const finish = (pointerId: number, x: number, y: number, cancelled: boolean) => {
    const s = start.current;
    if (!s || s.id !== pointerId) return;
    start.current = null;
    const width = slide.current?.getBoundingClientRect().width || 1;
    const direction =
      cancelled || !latest.current.enabled ? 0 : swipeOutcome(x - s.x, y - s.y, performance.now() - s.at, width);
    sliding.current = true;
    if (direction === 0) {
      settle();
      return;
    }
    if (reducedMotion()) {
      place(0);
      sliding.current = false;
      latest.current.onStep(direction);
      return;
    }
    // Out the way the finger went, then the next one in from the other side.
    place(-direction * width, "settle");
    later(SLIDE_MS, () => {
      if (latest.current.enabled) latest.current.onStep(direction);
      place(direction * width);
      // Lay out the jump to the other side before easing back, so it slides rather than snaps.
      void slide.current?.getBoundingClientRect();
      settle();
    });
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (!enabled || sliding.current || e.button !== 0 || (e.target as Element).closest("[data-no-swipe]")) return;
      start.current = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now() };
      // The drag keeps coming here even when it leaves the stage (a mouse in a narrow window).
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      // A mouse let go somewhere we didn't hear about: no drag any more.
      if (e.pointerType === "mouse" && e.buttons === 0) {
        finish(e.pointerId, e.clientX, e.clientY, true);
        return;
      }
      const dx = e.clientX - s.x;
      // Up and down is left to the page; only a sideways drag moves the picture.
      if (Math.abs(dx) > Math.abs(e.clientY - s.y)) place(dx, "drag");
    },
    onPointerUp: (e: React.PointerEvent) => finish(e.pointerId, e.clientX, e.clientY, false),
    onPointerCancel: (e: React.PointerEvent) => finish(e.pointerId, e.clientX, e.clientY, true),
  };
}
