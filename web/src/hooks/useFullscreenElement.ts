import { useEffect, useLayoutEffect, useState } from "react";

/** What's fullscreen, unless it's the whole page (spec 0160): then the page is still the page. */
const playerFullscreen = () => {
  const element = document.fullscreenElement ?? null;
  return element === document.documentElement ? null : element;
};

/**
 * The element shown fullscreen, or null (spec 0101). While there is one, only it and
 * what's inside it can be seen, so windows meant for the page go inside it. The whole page
 * fullscreen on a phone (spec 0160) doesn't count: everything is still in view.
 */
export function useFullscreenElement(): Element | null {
  const [element, setElement] = useState<Element | null>(playerFullscreen);
  useEffect(() => {
    const follow = () => setElement(playerFullscreen());
    document.addEventListener("fullscreenchange", follow);
    return () => document.removeEventListener("fullscreenchange", follow);
  }, []);
  return element;
}

/**
 * A container for windows over the page, that moves into the fullscreen element and back
 * out with it (spec 0101). Moving the container instead of rendering elsewhere keeps what's
 * inside it (a window's choices, where its focus goes back to) when fullscreen starts or ends.
 */
export function useFullscreenHost(): HTMLElement {
  const fullscreen = useFullscreenElement();
  const [host] = useState(() => document.createElement("div"));
  useLayoutEffect(() => {
    (fullscreen ?? document.body).appendChild(host);
  }, [fullscreen, host]);
  useLayoutEffect(() => () => host.remove(), [host]);
  return host;
}
