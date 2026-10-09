import { useEffect, useMemo, useRef, useState } from "react";
import { WIDESCREEN } from "../../hooks/useVideoShape";
import { CELL_PX, easeFor, edgeDraws, fadeMask, glowLayout, gridFor, type EdgeDraw } from "../../media/ambilight";
import type { AmbilightPrefs } from "../../media/preferences";
import styles from "./Ambilight.module.css";

/**
 * About 60 updates a second, on the screen's frames: a faster screen skips frames evenly, so
 * each update's easing stays above its 8-bit floor and the rate is 60 on any refresh rate.
 */
export const UPDATE_MS = 1000 / 60;
/** A frame this early still counts as on time (frames never land exactly). */
const ON_TIME_MS = 2;
/** With reduced motion, the light changes slowly instead: twice a second, a gentle step each time. */
export const SLOW_SAMPLE_MS = 500;
export const SLOW_EASE = 0.3;
/** The easing's time constant: after this long the light has gone about two thirds of the way. */
export const EASE_MS = 120;

type Props = {
  /** The stage's video, or null when nothing is on the stage. */
  video: HTMLVideoElement | null;
  /** A still picture to light when there's no video: the empty stage's colour bars (spec 0158). */
  still?: HTMLCanvasElement | null;
  prefs: AmbilightPrefs;
  /** The stage's shape, width ÷ height (spec 0107): the glow follows it. */
  shape?: number;
};

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Ambilight (specs 0104 and 0118): the picture's own edges glow round the stage. Drawn by the
 * browser's graphics pipeline, with no pixel reads: each update draws the picture's edges
 * stretched outward onto a small canvas, over the last update at partial opacity (the
 * easing), then blurs it once and cuts it with a fade mask made once. The page only stretches
 * the result, so a 4K monitor costs the same as a small one. It updates with the screen's
 * refresh, and stops while the tab is hidden, the video is paused or missing, or it's off.
 */
export function Ambilight({ video, still = null, prefs, shape = WIDESCREEN }: Props) {
  const { cols, rows } = gridFor(shape);
  const layout = useMemo(() => glowLayout(cols, rows), [cols, rows]);
  // The fade mask's alpha, computed once per grid.
  const maskAlpha = useMemo(() => fadeMask(layout), [layout]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);

  // Whether the video plays, from its own events.
  useEffect(() => {
    if (!video) return;
    const follow = () => setPlaying(!video.paused);
    follow();
    const events = ["play", "playing", "pause", "ended", "emptied"];
    events.forEach((e) => video.addEventListener(e, follow));
    return () => events.forEach((e) => video.removeEventListener(e, follow));
  }, [video]);

  const shown = prefs.on && video !== null && playing;
  // A still picture is lit once, while there's no video.
  const stillShown = prefs.on && video === null && still !== null;

  useEffect(() => {
    const out = canvas.current?.getContext("2d");
    if (!stillShown || !still || !out) return;
    const { width, height } = layout;
    const edgeCanvas = document.createElement("canvas");
    edgeCanvas.width = width;
    edgeCanvas.height = height;
    const edge = edgeCanvas.getContext("2d");
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d");
    if (!edge || !maskCtx) return;
    const img = maskCtx.createImageData(width, height);
    for (let i = 0; i < maskAlpha.length; i++) img.data[i * 4 + 3] = maskAlpha[i];
    maskCtx.putImageData(img, 0, 0);
    for (const { src, dst } of edgeDraws(layout, still.width, still.height)) {
      edge.drawImage(still, src[0], src[1], src[2], src[3], dst[0], dst[1], dst[2], dst[3]);
    }
    out.globalCompositeOperation = "copy";
    out.filter = `blur(${CELL_PX * 3}px)`;
    out.drawImage(edgeCanvas, 0, 0);
    out.filter = "none";
    out.globalCompositeOperation = "destination-in";
    out.drawImage(maskCanvas, 0, 0);
    out.globalCompositeOperation = "source-over";
  }, [stillShown, still, layout, maskAlpha]);

  useEffect(() => {
    const out = canvas.current?.getContext("2d");
    if (!shown || !video || !out) return;
    const { width, height } = layout;
    const edgeCanvas = document.createElement("canvas");
    edgeCanvas.width = width;
    edgeCanvas.height = height;
    const edge = edgeCanvas.getContext("2d");
    // The fade mask, made once for this grid: alpha only.
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d");
    if (!edge || !maskCtx) return;
    const img = maskCtx.createImageData(width, height);
    for (let i = 0; i < maskAlpha.length; i++) img.data[i * 4 + 3] = maskAlpha[i];
    maskCtx.putImageData(img, 0, 0);

    const slow = reducedMotion();
    let primed = false;
    let last = 0;
    // The nine draws, kept until the picture's size changes.
    let draws: EdgeDraw[] = [];
    let drawsFor = "";
    const draw = (now: number) => {
      if (video.paused || video.readyState < 2 || !video.videoWidth) return;
      edge.globalAlpha = !primed ? 1 : slow ? SLOW_EASE : easeFor(last ? now - last : UPDATE_MS, EASE_MS);
      primed = true;
      last = now;
      const size = `${video.videoWidth}x${video.videoHeight}`;
      if (size !== drawsFor) {
        draws = edgeDraws(layout, video.videoWidth, video.videoHeight);
        drawsFor = size;
      }
      for (const { src, dst } of draws) {
        edge.drawImage(video, src[0], src[1], src[2], src[3], dst[0], dst[1], dst[2], dst[3]);
      }
      out.globalCompositeOperation = "copy";
      out.filter = `blur(${CELL_PX * 3}px)`;
      out.drawImage(edgeCanvas, 0, 0);
      out.filter = "none";
      out.globalCompositeOperation = "destination-in";
      out.drawImage(maskCanvas, 0, 0);
      out.globalCompositeOperation = "source-over";
    };

    // In step with the screen while the tab can be seen; slowly with reduced motion.
    let raf: number | undefined;
    let timer: number | undefined;
    const stop = () => {
      if (raf !== undefined) cancelAnimationFrame(raf);
      window.clearInterval(timer);
      raf = timer = undefined;
    };
    let due = 0;
    const frame = (now: number) => {
      if (now >= due - ON_TIME_MS) {
        draw(now);
        // Keep the cadence; after a long gap (a hidden tab), start again from now.
        due = due + UPDATE_MS < now - UPDATE_MS ? now + UPDATE_MS : due + UPDATE_MS;
      }
      raf = requestAnimationFrame(frame);
    };
    const run = () => {
      stop();
      if (document.hidden) return;
      due = 0;
      if (slow) {
        draw(performance.now());
        timer = window.setInterval(() => draw(performance.now()), SLOW_SAMPLE_MS);
      } else {
        raf = requestAnimationFrame(frame);
      }
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", run);
    };
  }, [shown, video, layout, maskAlpha]);

  // No stream and no still picture: no light at all. Switched off or paused: the light fades
  // out (and nothing is drawn), and fades back in.
  if (!video && !still) return null;
  const lit = shown || stillShown;
  return (
    <canvas
      ref={canvas}
      className={styles.light}
      width={layout.width}
      height={layout.height}
      style={{ ...layout.placement, opacity: lit ? prefs.brightness : 0 }}
      data-on={lit || undefined}
      aria-hidden="true"
    />
  );
}
