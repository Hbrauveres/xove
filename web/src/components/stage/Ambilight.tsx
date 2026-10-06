import { useEffect, useRef, useState } from "react";
import {
  COLS,
  EASE,
  LED_COUNT,
  ROWS,
  SPREAD,
  easeColors,
  edgeColors,
  paintRing,
  ringPlacement,
} from "../../media/ambilight";
import type { AmbilightPrefs } from "../../media/preferences";
import styles from "./Ambilight.module.css";

/** About 12 readings a second: smooth, and still far from every frame. */
export const SAMPLE_MS = 83;
/** With reduced motion, the light changes slowly instead. */
export const SLOW_SAMPLE_MS = 500;

type Props = {
  /** The stage's video, or null when nothing is on the stage. */
  video: HTMLVideoElement | null;
  prefs: AmbilightPrefs;
};

const PLACE = ringPlacement();
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Ambilight (spec 0104): LEDs around the stage take the colours of the picture's edges. It
 * reads the video into a 64×36 frame about 12 times a second and paints a small canvas the
 * page only stretches. It stops while the tab is hidden, the video is paused or missing, or
 * it's switched off; a video the browser won't let it read just gets no light.
 */
export function Ambilight({ video, prefs }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [unreadable, setUnreadable] = useState<HTMLVideoElement | null>(null);

  // Whether the video plays, from its own events.
  useEffect(() => {
    if (!video) return;
    const follow = () => setPlaying(!video.paused);
    follow();
    const events = ["play", "playing", "pause", "ended", "emptied"];
    events.forEach((e) => video.addEventListener(e, follow));
    return () => events.forEach((e) => video.removeEventListener(e, follow));
  }, [video]);

  const shown = prefs.on && video !== null && playing && video !== unreadable;

  useEffect(() => {
    const out = canvas.current?.getContext("2d");
    if (!shown || !video || !out) return;
    const sample = document.createElement("canvas");
    sample.width = COLS;
    sample.height = ROWS;
    const reader = sample.getContext("2d", { willReadFrequently: true });
    const scratchCanvas = document.createElement("canvas");
    scratchCanvas.width = COLS + SPREAD * 2;
    scratchCanvas.height = ROWS + SPREAD * 2;
    const scratch = scratchCanvas.getContext("2d");
    if (!reader || !scratch) return;
    const colors = new Float32Array(LED_COUNT * 3);
    let primed = false;

    const tick = () => {
      if (video.paused || video.readyState < 2) return;
      let pixels: Uint8ClampedArray;
      try {
        reader.drawImage(video, 0, 0, COLS, ROWS);
        pixels = reader.getImageData(0, 0, COLS, ROWS).data;
      } catch {
        // The browser won't let this video be read: no light for it, and no more tries.
        setUnreadable(video);
        return;
      }
      easeColors(colors, edgeColors(pixels), primed ? EASE : 1);
      primed = true;
      paintRing(out, scratch, colors);
    };

    // Only while the tab can be seen.
    let timer: number | undefined;
    const run = () => {
      window.clearInterval(timer);
      timer = undefined;
      if (document.hidden) return;
      tick();
      timer = window.setInterval(tick, reducedMotion() ? SLOW_SAMPLE_MS : SAMPLE_MS);
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [shown, video]);

  // No stream, or one the browser won't let it read: no light at all. Switched off or
  // paused: the light fades out (and nothing is read), and fades back in.
  if (!video || video === unreadable) return null;
  return (
    <canvas
      ref={canvas}
      className={styles.light}
      width={COLS + SPREAD * 2}
      height={ROWS + SPREAD * 2}
      style={{ ...PLACE, opacity: shown ? prefs.brightness : 0 }}
      data-on={shown || undefined}
      aria-hidden="true"
    />
  );
}
