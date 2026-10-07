import { describe, expect, it } from "vitest";
import html from "../../index.html?raw";
import favicon from "../../public/favicon.svg?raw";
import manifestText from "../../public/site.webmanifest?raw";
import { iconSvg } from "./iconSvg";

/** Everything in public/, by name. */
const shipped = Object.keys(import.meta.glob("../../public/*")).map((p) => p.split("/").pop());
/** The page's <link> tags, as rel → href. */
const links = new Map(
  [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => [/rel="([^"]+)"/.exec(tag)?.[1], /href="([^"]+)"/.exec(tag)?.[1]]),
);
const href = (rel: string) => links.get(rel);

describe("Xovê's icon in the browser and on phones (spec 0111, FR-4)", () => {
  it("links the favicon, the home-screen icon and the manifest from the page", () => {
    expect(href("icon")).toBe("/favicon.svg");
    expect(href("apple-touch-icon")).toBe("/apple-touch-icon.png");
    expect(href("manifest")).toBe("/site.webmanifest");
    expect(html).toMatch(/<meta name="theme-color" content="#0b0e13"/);
  });

  it("ships every file it links", () => {
    for (const f of ["favicon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "site.webmanifest"]) {
      expect(shipped, f).toContain(f);
    }
  });

  it("lists the phone icons in the manifest, under Xovê's name", () => {
    const manifest = JSON.parse(manifestText);
    expect(manifest.name).toBe("Xovê");
    expect([manifest.background_color, manifest.theme_color]).toEqual(["#0b0e13", "#0b0e13"]);
    expect(manifest.icons.map((i: { src: string; sizes: string }) => `${i.src} ${i.sizes}`)).toEqual([
      "/icon-192.png 192x192",
      "/icon-512.png 512x512",
    ]);
  });

  it("keeps the favicon in step with the mark's geometry", () => {
    expect(favicon).toBe(iconSvg("favicon"));
  });

  it("makes the favicon only the symbol, at its 16 px weight, edge to edge (spec 0113)", () => {
    expect(favicon).not.toMatch(/<rect/);
    expect(favicon).toMatch(/stroke-width="16"/);
    // Square, and the symbol's height fills it.
    const [, , w, h] = /viewBox="([^"]+)"/.exec(favicon)![1].split(" ").map(Number);
    expect(w).toBe(h);
  });

  it("follows the browser's mode: white strokes on dark, dark blue on light, the red fixed (spec 0113)", () => {
    expect(favicon).toMatch(/\.ink\s*\{\s*stroke:\s*#e7ebf1/);
    expect(favicon).toMatch(/@media \(prefers-color-scheme: light\)\s*\{\s*\.ink\s*\{\s*stroke:\s*#0b0e13/);
    expect(favicon).toMatch(/stroke="#ef4b4b"/);
    expect(favicon).toMatch(/fill="#ef4b4b"/);
  });

  it("puts the phone icon's larger, slim symbol on the dark blue ground (spec 0113)", () => {
    const phone = iconSvg("phone");
    expect(phone).toMatch(/<rect[^>]*fill="#0b0e13"/);
    expect(phone).toMatch(/stroke-width="10"/);
  });
});
