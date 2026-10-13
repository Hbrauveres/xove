import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { WordMark } from "../../brand/mark";
import { TOTAL_MS, frameAt, type Frame } from "../../brand/markTimeline";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Plays the wordmark's animation (specs 0111 and 0113) on its SVG: the letters slide left
 * under a clip while the right corners close in (the left ones stay), then the corners settle
 * and the dot blinks. Frame by frame, without re-rendering.
 * Once per hover: a call while it plays is ignored. Nothing plays with reduced motion.
 */
export function useMarkAnimation(svg: RefObject<SVGSVGElement | null>, mark: WordMark) {
  const raf = useRef<number | undefined>(undefined);
  const playing = useRef(false);
  useEffect(() => () => cancelAnimationFrame(raf.current ?? 0), []);

  const apply = useCallback(
    (f: Frame) => {
      const el = svg.current;
      if (!el) return;
      const { dx, dy, textShift } = mark.closed;
      const lx = dx.left * f.slide, rx = dx.right * f.slide;
      el.querySelector("[data-letters]")?.setAttribute("transform", `translate(${+(textShift * f.slide).toFixed(2)},0)`);
      const ty = dy.top * f.settle, by = dy.bottom * f.settle;
      const move = (at: string, x: number, y: number) =>
        el.querySelector(`[data-side="${at}"]`)?.setAttribute("transform", `translate(${+x.toFixed(2)},${+y.toFixed(2)})`);
      move("top-left", lx, ty);
      move("bottom-left", lx, by);
      move("bottom-right", rx, by);
      move("top-right", rx, ty);
      // The letters show only between the corners' inner edges.
      const wipe = el.querySelector("[data-wipe]");
      const left = mark.frame.left + lx + mark.corners[0].width / 2;
      const right = mark.frame.right + rx - mark.corners[0].width / 2;
      wipe?.setAttribute("x", String(left));
      wipe?.setAttribute("width", String(Math.max(0, right - left)));
      const dot = el.querySelector("[data-dot]");
      const { cx, cy } = mark.dot;
      if (f.eye.sx === 1 && f.eye.sy === 1) dot?.removeAttribute("transform");
      else dot?.setAttribute("transform", `translate(${cx},${cy}) scale(${f.eye.sx},${f.eye.sy}) translate(${-cx},${-cy})`);
    },
    [svg, mark],
  );

  return useCallback(() => {
    if (playing.current || reducedMotion()) return;
    playing.current = true;
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const t = now - start;
      apply(frameAt(t));
      if (t < TOTAL_MS) raf.current = requestAnimationFrame(step);
      else playing.current = false;
    };
    raf.current = requestAnimationFrame(step);
  }, [apply]);
}
