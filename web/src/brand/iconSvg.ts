import { iconMark, pointsAttr } from "./mark.ts";

/** The colours of the icon files, which can't read the page's tokens: ground, white and red. */
const GROUND = "#0c0c0d", WHITE = "#ebebec", RED = "#ef4b4b";

/**
 * The icon as a standalone SVG file (spec 0111, FR-4): the symbol on a dark tile, so it
 * reads on light and dark tabs alike. `rounded` for the favicon; square for the PNGs a
 * phone rounds itself. scripts/brand-icons.mjs writes it to public/favicon.svg.
 */
export function iconSvg({ rounded }: { rounded: boolean }): string {
  const icon = iconMark();
  const { x, y, width, height } = icon.viewBox;
  // The symbol takes about two thirds of the tile, centred.
  const size = Math.round(Math.max(width, height) / 0.66);
  const ox = (size - width) / 2 - x, oy = (size - height) / 2 - y;
  const corners = icon.corners
    .map((c) => `<polyline points="${pointsAttr(c.points)}" fill="none" stroke="${c.red ? RED : WHITE}" stroke-width="${c.width}" stroke-linejoin="miter"/>`)
    .join("");
  const { ring, dot } = icon;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}"${rounded ? ` rx="${Math.round(size * 0.22)}"` : ""} fill="${GROUND}"/>`,
    `<g transform="translate(${+ox.toFixed(2)},${+oy.toFixed(2)})">`,
    corners,
    `<circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="${WHITE}" stroke-width="${ring.width}"/>`,
    `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${RED}"/>`,
    `</g></svg>`,
    "",
  ].join("\n");
}
