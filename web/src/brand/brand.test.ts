/// <reference types="node" />
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
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
    expect(html).toMatch(/<meta name="theme-color" content="#000000"/);
  });

  it("ships every file it links", () => {
    for (const f of ["favicon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "site.webmanifest"]) {
      expect(shipped, f).toContain(f);
    }
  });

  it("lists the phone icons in the manifest, under Xovê's name", () => {
    const manifest = JSON.parse(manifestText);
    expect(manifest.name).toBe("Xovê");
    expect([manifest.background_color, manifest.theme_color]).toEqual(["#000000", "#000000"]);
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
    // Square, and the symbol's full height (146, strokes included) fills it.
    const [, , w, h] = /viewBox="([^"]+)"/.exec(favicon)![1].split(" ").map(Number);
    expect(w).toBe(h);
    expect(h).toBe(146);
  });

  it("follows the browser's mode: white strokes on dark, black on light, the red fixed (spec 0113)", () => {
    expect(favicon).toMatch(/\.ink\s*\{\s*stroke:\s*#ebebec/);
    expect(favicon).toMatch(/@media \(prefers-color-scheme: light\)\s*\{\s*\.ink\s*\{\s*stroke:\s*#000000/);
    expect(favicon).toMatch(/stroke="#ef4b4b"/);
    expect(favicon).toMatch(/fill="#ef4b4b"/);
  });

  it("puts the phone icon's larger, slim symbol on the black ground (spec 0113)", () => {
    const phone = iconSvg("phone");
    expect(phone).toMatch(/<rect[^>]*fill="#000000"/);
    expect(phone).toMatch(/stroke-width="10"/);
  });
});

describe("the phone icon files (spec 0113, FR-6b)", () => {
  /** A PNG's size and its top-left pixel (8-bit RGB, as rendered), read without image tools. */
  const pngAt = (name: string) => {
    const buf = readFileSync(`${__dirname}/../../public/${name}`);
    const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
    const chunks: Buffer[] = [];
    for (let at = 8; at < buf.length; ) {
      const len = buf.readUInt32BE(at), type = buf.toString("ascii", at + 4, at + 8);
      if (type === "IDAT") chunks.push(buf.subarray(at + 8, at + 8 + len));
      at += 12 + len;
    }
    // The first pixel of the first row is stored as is, whatever the row's filter.
    const raw = inflateSync(Buffer.concat(chunks));
    return { width, height, colorType: buf[25], first: [raw[1], raw[2], raw[3]] };
  };

  it("ships the three sizes, on the black ground", () => {
    for (const [name, size] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]] as const) {
      const png = pngAt(name);
      expect([png.width, png.height], name).toEqual([size, size]);
      expect(png.colorType, name).toBe(2);
      expect(png.first, name).toEqual([0x00, 0x00, 0x00]);
    }
  });
});
