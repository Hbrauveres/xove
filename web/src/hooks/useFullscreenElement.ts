import { useEffect, useState } from "react";

/**
 * The element shown fullscreen, or null (spec 0101). While there is one, only it and
 * what's inside it can be seen, so windows meant for the page go inside it.
 */
export function useFullscreenElement(): Element | null {
  const [element, setElement] = useState<Element | null>(() => document.fullscreenElement ?? null);
  useEffect(() => {
    const follow = () => setElement(document.fullscreenElement ?? null);
    document.addEventListener("fullscreenchange", follow);
    return () => document.removeEventListener("fullscreenchange", follow);
  }, []);
  return element;
}
