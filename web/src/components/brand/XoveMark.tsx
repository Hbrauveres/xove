import { useId } from "react";
import { wordMark } from "../../brand/mark";
import { MarkCorner, MarkStroke, RecordO } from "./parts";

const MARK = wordMark();
const { x, y, width, height } = MARK.viewBox;

/**
 * Xovê's wordmark (spec 0111): [XOVE] in a viewfinder, the O a record button and the
 * top-right corner red. Drawn, not typed, so it looks the same everywhere. The text colour
 * paints it; the red comes from the accent.
 */
export function XoveMark({ height: h }: { height: number }) {
  // Ids for the clips: a letter's flat tips (the V), and the letters as a whole.
  const id = useId().replace(/:/g, "");
  return (
    <svg
      role="img"
      aria-label="Xovê"
      viewBox={`${x} ${y} ${width} ${height}`}
      height={h}
      width={(h * width) / height}
      style={{ overflow: "visible" }}
    >
      <defs>
        {MARK.letters.map(
          (l) =>
            l.clip && (
              <clipPath key={l.letter} id={`${id}-${l.letter}`}>
                <rect x={l.clip.x} y={0} width={l.clip.width} height={100} />
              </clipPath>
            ),
        )}
      </defs>
      {MARK.corners.map((c) => (
        <g key={c.at} data-side={c.at}>
          <MarkCorner c={c} />
        </g>
      ))}
      <g data-letters>
        {MARK.letters.map((l) =>
          l.letter === "O" ? (
            <RecordO key="O" ring={MARK.ring} dot={MARK.dot} />
          ) : (
            <g key={l.letter} clipPath={l.clip ? `url(#${id}-${l.letter})` : undefined}>
              {l.strokes.map((s, i) => (
                <MarkStroke key={i} s={s} />
              ))}
            </g>
          ),
        )}
      </g>
    </svg>
  );
}
