// Writes public/favicon.svg from the mark's geometry (specs 0111 and 0113), so the favicon
// can't drift from the mark. Run from web/: node scripts/brand-icons.mjs (Node 22.18+ strips
// the types).
//
// The phone icons (apple-touch-icon.png 180, icon-192.png, icon-512.png) are PNGs, rendered
// once from iconSvg("phone") and committed, so the build needs no image tools. To redo them,
// pass --phone to print that SVG, and render it at each size with any SVG renderer (a
// headless browser screenshot works). --maskable prints Android's maskable icon
// (icon-maskable-512.png), rendered the same way.
import { writeFileSync } from "node:fs";
import { iconSvg } from "../src/brand/iconSvg.ts";

/** The phone icon in a wider frame: the mark fits the maskable safe circle (40% radius). */
function maskable(svg) {
  const [x, y, w, h] = /viewBox="([^"]+)"/.exec(svg)[1].split(" ").map(Number);
  const side = Math.max(w, h) * 1.3;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const box = [cx - side / 2, cy - side / 2, side, side].map((n) => +n.toFixed(2)).join(" ");
  return svg
    .replace(/viewBox="[^"]+"/, `viewBox="${box}"`)
    .replace(/<rect [^>]*\/>/, (r) =>
      r
        .replace(/x="[^"]+"/, `x="${+(cx - side / 2).toFixed(2)}"`)
        .replace(/y="[^"]+"/, `y="${+(cy - side / 2).toFixed(2)}"`)
        .replace(/width="[^"]+"/, `width="${+side.toFixed(2)}"`)
        .replace(/height="[^"]+"/, `height="${+side.toFixed(2)}"`),
    );
}

if (process.argv.includes("--phone")) {
  process.stdout.write(iconSvg("phone"));
} else if (process.argv.includes("--maskable")) {
  // Android crops a maskable icon to its own shape (a circle, a squircle…), keeping only the
  // middle 80%: the same icon with more ground around it, so the corners stay whole (spec 0171).
  process.stdout.write(maskable(iconSvg("phone")));
} else {
  writeFileSync(new URL("../public/favicon.svg", import.meta.url), iconSvg("favicon"));
  console.log("wrote public/favicon.svg");
}
