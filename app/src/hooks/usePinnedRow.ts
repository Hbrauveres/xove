import { useEffect, useRef } from "react";

/** How long the row takes to glide back to the centre once the pointer leaves it. */
export const RECENTRE_MS = 220;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/** The row's offset after the button under the pointer moved from `before` to `now` (px). */
export function heldShift(shift: number, before: number, now: number): number {
  return shift + (before - now);
}

/**
 * Keeps the button under the pointer still whenever the row changes width (spec 0106): a
 * button coming or going, a live stream's arrow appearing or going on the click itself.
 * The row is watched with a ResizeObserver, which reports a change after layout and before
 * paint, so the row moves back by however far the button was pushed in the same frame, and
 * on every frame of a 220 ms slot animation. Once the pointer leaves the row, it glides back
 * to the centre. Without the pointer on the row, nothing is held.
 */
export function usePinnedRow<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    let shift = 0;
    let anchor: HTMLElement | null = null;
    // Where the button under the pointer sits while it rests there.
    let rest = 0;

    const apply = (animate: boolean) => {
      row.style.transition = animate ? `transform ${RECENTRE_MS}ms ${EASE}` : "none";
      row.style.transform = shift ? `translateX(${shift}px)` : "";
    };
    const over = (e: PointerEvent) => {
      const button = (e.target as Element | null)?.closest("button");
      if (!button || button === anchor) return;
      anchor = button;
      rest = button.getBoundingClientRect().left;
    };
    const leave = () => {
      anchor = null;
      if (shift !== 0) {
        shift = 0;
        apply(true);
      }
    };
    const resized = () => {
      if (!anchor || !anchor.isConnected) return;
      const now = anchor.getBoundingClientRect().left;
      if (Math.abs(now - rest) < 0.5) return;
      shift = heldShift(shift, rest, now);
      apply(false);
    };

    row.addEventListener("pointerover", over);
    row.addEventListener("pointerleave", leave);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resized);
    observer?.observe(row);
    return () => {
      row.removeEventListener("pointerover", over);
      row.removeEventListener("pointerleave", leave);
      observer?.disconnect();
    };
  }, []);

  return { ref };
}
