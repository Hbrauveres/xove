import type { Corner, Stroke } from "../../brand/mark";
import { STROKE, pointsAttr } from "../../brand/mark";

/** One stroke of the mark, square-ended, in the text colour. */
export function MarkStroke({ s }: { s: Stroke }) {
  return (
    <polyline
      points={pointsAttr(s.points)}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap={s.cap}
      strokeLinejoin={s.join}
      strokeMiterlimit={10}
    />
  );
}

/** A corner of the viewfinder: white, or red at the top right. */
export function MarkCorner({ c }: { c: Corner }) {
  return (
    <polyline
      data-corner={c.at}
      data-red={c.red || undefined}
      points={pointsAttr(c.points)}
      fill="none"
      stroke={c.red ? "var(--accent)" : "currentColor"}
      strokeWidth={c.width}
      strokeLinejoin="miter"
    />
  );
}

/** The record O: a ring as thick as the letters, and the red dot. */
export function RecordO({
  ring,
  dot,
}: {
  ring: { cx: number; cy: number; r: number; width: number };
  dot: { cx: number; cy: number; r: number };
}) {
  return (
    <>
      <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke="currentColor" strokeWidth={ring.width} />
      <circle data-dot cx={dot.cx} cy={dot.cy} r={dot.r} fill="var(--accent)" />
    </>
  );
}
