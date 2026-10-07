// Writes public/favicon.svg from the mark's geometry (spec 0111), so the favicon can't drift
// from the mark. Run from web/: node scripts/brand-icons.mjs (Node 22.18+ strips the types).
//
// The phone icons (apple-touch-icon.png 180, icon-192.png, icon-512.png) are PNGs, rendered
// once from the square version (iconSvg({ rounded: false })) and committed, so the build
// needs no image tools. To redo them, pass --square to print that SVG, and render it at each
// size with any SVG renderer (a headless browser screenshot works).
import { writeFileSync } from "node:fs";
import { iconSvg } from "../src/brand/iconSvg.ts";

if (process.argv.includes("--square")) {
  process.stdout.write(iconSvg({ rounded: false }));
} else {
  writeFileSync(new URL("../public/favicon.svg", import.meta.url), iconSvg({ rounded: true }));
  console.log("wrote public/favicon.svg");
}
