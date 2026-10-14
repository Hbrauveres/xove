import { useEffect, useState } from "react";

/** A touch screen is the main pointer (spec 0160): a phone or a tablet, not a touch laptop. */
export const TOUCH_QUERY = "(pointer: coarse)";
/** The screen's shorter side is at most 500 px: a phone (spec 0160). */
export const SMALL_QUERY = "(max-width: 500px), (max-height: 500px)";
export const PORTRAIT_QUERY = "(orientation: portrait)";
/** A narrow window held upright (spec 0158): the upright view, whatever the device. */
export const NARROW_UPRIGHT_QUERY = "(max-width: 760px) and (orientation: portrait)";

/** The room's layouts: the desktop's, a phone held upright (spec 0158), or sideways (spec 0160). */
export type RoomLayout = "desktop" | "upright" | "sideways";

type Screen = { touch: boolean; small: boolean; portrait: boolean; narrowUpright: boolean };

/**
 * Which layout (specs 0158 and 0160): a phone always gets a phone view, upright or sideways; a
 * tablet the upright view held upright and the desktop's sideways; anything else the upright
 * view only in a narrow, upright window.
 */
export function layoutFor({ touch, small, portrait, narrowUpright }: Screen): RoomLayout {
  if (touch && small) return portrait ? "upright" : "sideways";
  if (touch) return portrait ? "upright" : "desktop";
  return narrowUpright ? "upright" : "desktop";
}

const QUERIES = [TOUCH_QUERY, SMALL_QUERY, PORTRAIT_QUERY, NARROW_UPRIGHT_QUERY] as const;
const matches = (q: string) => window.matchMedia?.(q).matches ?? false;
const current = () =>
  layoutFor({
    touch: matches(TOUCH_QUERY),
    small: matches(SMALL_QUERY),
    portrait: matches(PORTRAIT_QUERY),
    narrowUpright: matches(NARROW_UPRIGHT_QUERY),
  });

/** The room's layout, following the screen as it turns or the window resizes. */
export function useRoomLayout(): RoomLayout {
  const [layout, setLayout] = useState(current);
  useEffect(() => {
    if (!window.matchMedia) return;
    const lists = QUERIES.map((q) => window.matchMedia(q));
    const follow = () => setLayout(current());
    follow();
    lists.forEach((l) => l.addEventListener("change", follow));
    return () => lists.forEach((l) => l.removeEventListener("change", follow));
  }, []);
  return layout;
}
