import { useCallback, useEffect, useRef } from "react";

/** How long the row holds the clicked button still: the slot's 220 ms change, and a frame or two. */
export const HOLD_MS = 260;
/** How long the row takes to glide back to the centre once the pointer leaves it. */
export const RECENTRE_MS = 220;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/** The row's offset after the button under the pointer moved from `before` to `now` (px). */
export function heldShift(shift: number, before: number, now: number): number {
  return shift + (before - now);
}

/**
 * Keeps the button under the pointer still while a round button comes or goes (spec 0106):
 * for the length of the change, the row moves by however far that button was pushed. Once
 * the pointer leaves the row, the row glides back to the centre. Without the pointer on the
 * row, nothing is held: the row just stays centred.
 */
export function usePinnedRow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const shift = useRef(0);
  const anchor = useRef<HTMLElement | null>(null);
  const inside = useRef(false);
  const frame = useRef(0);

  const apply = useCallback((animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${RECENTRE_MS}ms ${EASE}` : "none";
    el.style.transform = shift.current ? `translateX(${shift.current}px)` : "";
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const over = (e: PointerEvent) => {
      inside.current = true;
      anchor.current = (e.target as Element | null)?.closest("button") ?? anchor.current;
    };
    const leave = () => {
      inside.current = false;
      anchor.current = null;
      cancelAnimationFrame(frame.current);
      if (shift.current !== 0) {
        shift.current = 0;
        apply(true);
      }
    };
    el.addEventListener("pointerover", over);
    el.addEventListener("pointermove", over);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerover", over);
      el.removeEventListener("pointermove", over);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame.current);
    };
  }, [apply]);

  /** A slot starts to come or go: hold the button under the pointer where it is. */
  const hold = useCallback(() => {
    const target = anchor.current;
    if (!inside.current || !target || !target.isConnected) return;
    const before = target.getBoundingClientRect().left;
    const until = performance.now() + HOLD_MS;
    cancelAnimationFrame(frame.current);
    const step = () => {
      if (!target.isConnected) return;
      shift.current = heldShift(shift.current, before, target.getBoundingClientRect().left);
      apply(false);
      if (performance.now() < until) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [apply]);

  return { ref, hold };
}
