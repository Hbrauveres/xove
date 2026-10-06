import { useEffect, useState } from "react";

/** The stage's shape when there's no picture to follow: empty, or still loading. */
export const WIDESCREEN = 16 / 9;

/** Changes smaller than this (simulcast layers of the same window) don't move the stage. */
const IGNORE = 0.01;

/**
 * The shape of a video's picture, width ÷ height (spec 0107): 16:9 until its size is known,
 * then the picture's own, following it when the sharer resizes or switches the window.
 */
export function useVideoShape(video: HTMLVideoElement | null): number {
  const [shape, setShape] = useState(WIDESCREEN);

  useEffect(() => {
    if (!video) {
      setShape(WIDESCREEN);
      return;
    }
    const read = () => {
      const { videoWidth: w, videoHeight: h } = video;
      if (!w || !h) return;
      const next = w / h;
      setShape((prev) => (Math.abs(next - prev) / prev < IGNORE ? prev : next));
    };
    read();
    video.addEventListener("loadedmetadata", read);
    video.addEventListener("resize", read);
    return () => {
      video.removeEventListener("loadedmetadata", read);
      video.removeEventListener("resize", read);
    };
  }, [video]);

  return shape;
}
