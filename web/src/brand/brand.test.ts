import { describe, expect, it } from "vitest";
import html from "../../index.html?raw";
import favicon from "../../public/favicon.svg?raw";
import manifestText from "../../public/site.webmanifest?raw";
import { iconSvg } from "./iconSvg";

/** Everything in public/, by name. */
const shipped = Object.keys(import.meta.glob("../../public/*")).map((p) => p.split("/").pop());
const href = (rel: string) => new RegExp(`<link[^>]*rel="${rel}"[^>]*href="([^"]+)"`).exec(html)?.[1];

describe("Xovê's icon in the browser and on phones (spec 0111, FR-4)", () => {
  it("links the favicon, the home-screen icon and the manifest from the page", () => {
    expect(href("icon")).toBe("/favicon.svg");
    expect(href("apple-touch-icon")).toBe("/apple-touch-icon.png");
    expect(href("manifest")).toBe("/site.webmanifest");
    expect(html).toMatch(/<meta name="theme-color" content="#0c0c0d"/);
  });

  it("ships every file it links", () => {
    for (const f of ["favicon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "site.webmanifest"]) {
      expect(shipped, f).toContain(f);
    }
  });

  it("lists the phone icons in the manifest, under Xovê's name", () => {
    const manifest = JSON.parse(manifestText);
    expect(manifest.name).toBe("Xovê");
    expect(manifest.icons.map((i: { src: string; sizes: string }) => `${i.src} ${i.sizes}`)).toEqual([
      "/icon-192.png 192x192",
      "/icon-512.png 512x512",
    ]);
  });

  it("keeps the favicon in step with the mark's geometry", () => {
    expect(favicon).toBe(iconSvg({ rounded: true }));
  });
});
