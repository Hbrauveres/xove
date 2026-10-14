import { iconMark } from "../../brand/mark";
import { MarkCorner, RecordO } from "./parts";

const ICON = iconMark();
const { x, y, width, height } = ICON.viewBox;

/** Xovê's symbol (spec 0111): the record O alone in the viewfinder's corners. */
export function XoveIcon({ size }: { size: number }) {
  return (
    <svg role="img" aria-label="Xovê" viewBox={`${x} ${y} ${width} ${height}`} width={size} height={size}>
      {ICON.corners.map((c) => (
        <MarkCorner key={c.at} c={c} />
      ))}
      <RecordO ring={ICON.ring} dot={ICON.dot} />
    </svg>
  );
}
