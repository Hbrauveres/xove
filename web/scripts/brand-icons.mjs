// Writes public/favicon.svg from the mark's geometry (specs 0111 and 0113), so the favicon
// can't drift from the mark. Run from web/: node scripts/brand-icons.mjs (Node 22.18+ strips
// the types).
//
// The phone icons (apple-touch-icon.png 180, icon-192.png, icon-512.png) are PNGs, rendered
// once from iconSvg("phone") and committed, so the build needs no image tools. To redo them,
// pass --phone to print that SVG, and render it at each size with any SVG renderer (a
// headless browser screenshot works).
import { writeFileSync } from "node:fs";
import { iconSvg } from "../src/brand/iconSvg.ts";

if (process.argv.includes("--phone")) {
  process.stdout.write(iconSvg("phone"));
} else {
  writeFileSync(new URL("../public/favicon.svg", import.meta.url), iconSvg("favicon"));
  console.log("wrote public/favicon.svg");
}
