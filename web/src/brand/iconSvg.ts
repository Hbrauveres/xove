import { iconMark, pointsAttr, type Optical } from "./mark.ts";

/** The icon files' colours, which can't read the page's tokens: the black ground (also the ink on a light browser), white and red. */
const GROUND = "#0c0c0d", WHITE = "#ebebec", RED = "#ef4b4b";

/**
 * The icon as a standalone SVG file (specs 0111 and 0113). scripts/brand-icons.mjs writes it.
 * - "favicon": the bare symbol at its 16 px weight, edge to edge. Its white parts turn dark
 *   black when the browser is light (browsers apply prefers-color-scheme inside SVG favicons);
 *   the red stays.
 * - "phone": the slim symbol on the black ground, with room around it. Phones fill
 *   transparency with black, so this one keeps its ground.
 */
export function iconSvg(kind: "favicon" | "phone"): string {
  const optical: Optical = kind === "favicon" ? "tiny" : "large";
  const icon = iconMark(optical);
  const { x, y, width, height } = icon.viewBox;
  const n = (v: number) => +v.toFixed(2);
  const ink = kind === "favicon" ? 'class="ink"' : `stroke="${WHITE}"`;
  const corners = icon.corners
    .map(
      (c) =>
        `<polyline points="${pointsAttr(c.points)}" fill="none" ${c.red ? `stroke="${RED}"` : ink} stroke-width="${c.width}" stroke-linejoin="miter"/>`,
    )
    .join("");
  const { ring, dot } = icon;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x)} ${n(y)} ${n(width)} ${n(height)}">`,
    kind === "favicon"
      ? `<style>.ink { stroke: ${WHITE}; } @media (prefers-color-scheme: light) { .ink { stroke: ${GROUND}; } }</style>`
      : `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="${GROUND}"/>`,
    corners,
    `<circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" ${ink} stroke-width="${ring.width}"/>`,
    `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${RED}"/>`,
    `</svg>`,
    "",
  ].join("\n");
}
