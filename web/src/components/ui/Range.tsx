import type { CSSProperties, InputHTMLAttributes } from "react";
import styles from "./Range.module.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * A slider, white like a video player's (spec 0121): a plain range input, so the keyboard,
 * screen readers and touch work as on any slider. WebKit has no part for the filled side of
 * the track, so `--fill` tells the stylesheet how far the white goes.
 */
export function Range({ className, style, min = 0, max = 100, value, ...rest }: Props) {
  const lo = Number(min), hi = Number(max);
  const at = hi > lo ? (Number(value) - lo) / (hi - lo) : 0;
  const fill = `${+(Math.min(1, Math.max(0, at)) * 100).toFixed(2)}%`;
  return (
    <input
      type="range"
      className={[styles.range, className].filter(Boolean).join(" ")}
      style={{ ...style, "--fill": fill } as CSSProperties}
      min={min}
      max={max}
      value={value}
      {...rest}
    />
  );
}
