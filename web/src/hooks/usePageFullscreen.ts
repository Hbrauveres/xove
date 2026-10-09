import { useEffect, useRef } from "react";

/**
 * The address bar away on a phone or tablet (spec 0160, FR-13): the first tap puts the whole
 * page in fullscreen where the browser allows it (Android; iPhone Safari doesn't for pages).
 * Browsers allow it only as a tap ends, so it listens for the finger lifting. Asked once, and
 * again after each turn if it was left; turning keeps it. `turn` is the current orientation.
 */
export function usePageFullscreen(active: boolean, turn: string) {
  const armed = useRef(true);
  // A new turn: ask again on the next tap, unless it's still fullscreen.
  useEffect(() => {
    armed.current = true;
  }, [turn]);

  useEffect(() => {
    if (!active) return;
    const ask = () => {
      if (!armed.current) return;
      armed.current = false;
      const page = document.documentElement;
      if (document.fullscreenElement || typeof page.requestFullscreen !== "function") return;
      page.requestFullscreen({ navigationUI: "hide" }).catch(() => {
        /* Not allowed here: the address bar stays. */
      });
    };
    document.addEventListener("pointerup", ask);
    return () => document.removeEventListener("pointerup", ask);
  }, [active]);
}
