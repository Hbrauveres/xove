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
  // The shape read, and the video it was read from: another video starts again at 16:9.
  const [read, setRead] = useState<{ video: HTMLVideoElement; shape: number } | null>(null);

  useEffect(() => {
    if (!video) return;
    const update = () => {
      const { videoWidth: w, videoHeight: h } = video;
      if (!w || !h) return;
      const next = w / h;
      setRead((prev) =>
        prev?.video === video && Math.abs(next - prev.shape) / prev.shape < IGNORE ? prev : { video, shape: next },
      );
    };
    update();
    video.addEventListener("loadedmetadata", update);
    video.addEventListener("resize", update);
    return () => {
      video.removeEventListener("loadedmetadata", update);
      video.removeEventListener("resize", update);
    };
  }, [video]);

  return video && read?.video === video ? read.shape : WIDESCREEN;
}
