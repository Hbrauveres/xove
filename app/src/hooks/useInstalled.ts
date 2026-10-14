import { useEffect, useState } from "react";

/** Opened from the home screen (spec 0171): the app's display modes, Android and iOS 16.4+. */
export const INSTALLED_QUERY = "(display-mode: fullscreen), (display-mode: standalone)";

const installed = () =>
  (window.matchMedia?.(INSTALLED_QUERY).matches ?? false) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Whether Xovê runs from the home screen rather than in a browser tab (spec 0171). */
export function useInstalled(): boolean {
  const [value, setValue] = useState(installed);
  useEffect(() => {
    const query = window.matchMedia?.(INSTALLED_QUERY);
    if (!query) return;
    const follow = () => setValue(installed());
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);
  return value;
}
