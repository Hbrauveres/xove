import { useEffect, useLayoutEffect, useState } from "react";

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
