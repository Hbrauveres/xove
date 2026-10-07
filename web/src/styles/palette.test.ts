/// <reference types="node" />
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Every stylesheet in the app, by path, read from disk (the test runner stubs CSS imports). */
// src/, from this file's own folder, wherever the tests are started.
const src = `${__dirname}/../`;
const sheets: Record<string, string> = Object.fromEntries(
  readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((p) => p.endsWith(".css"))
    .map((p) => [p, readFileSync(src + p, "utf8")]),
);
const all = Object.entries(sheets);
const global = Object.entries(sheets).find(([p]) => p.endsWith("styles/global.css"))?.[1] ?? "";

/** global.css's custom properties, as name → value. */
const tokens = new Map([...global.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
const token = (name: string) => tokens.get(name);

describe("the palette: the cozy dark blue, red accent (specs 0111 and 0113)", () => {
  it("reads every stylesheet", () => {
    expect(all.length).toBeGreaterThan(20);
    expect(global).toContain(":root");
  });

  it("has red as the one accent, with deep red ink on red fills", () => {
    expect(token("accent")).toBe("#ef4b4b");
    expect(token("accent-ink")).toBe("#3a0808");
    expect(token("live")).toBe("#ef4b4b");
  });

  it("has no amber left, and no old token name", () => {
    for (const [path, css] of all) {
      expect(css, path).not.toMatch(/--tally/);
      expect(css, path).not.toMatch(/#f2a93b|#f7bb5f|242,\s*169,\s*59/i);
    }
  });

  it("is the board's dark blue (spec 0113), with the raised surface and faint grey nudged to pass", () => {
    expect(token("ground")).toBe("#0b0e13");
    expect(token("surface")).toBe("#10141b");
    expect(token("surface-raised")).toBe("#181f2a");
    expect(token("line")).toBe("#222b38");
    expect(token("text")).toBe("#e7ebf1");
    expect(token("text-muted")).toBe("#8b96a8");
    expect(token("text-faint")).toBe("#667083");
  });

  it("has none of spec 0111's neutral greys or neutral glass left", () => {
    const neutral = [
      "#0c0c0d", "#161617", "#1e1e20", "#2c2c2f", "#ebebec", "#9a9a9f", "#66666b",
      "#cacacd", "#b3b3b8", "#a4a4a9", "#d0d0d3", "#070708", "#131314",
    ];
    const glass = /rgba\(\s*(10,\s*10,\s*11|20,\s*20,\s*21|12,\s*12,\s*13|7,\s*7,\s*8)\s*,/;
    for (const [path, css] of all) {
      for (const hex of neutral) expect(css.toLowerCase(), `${path} ${hex}`).not.toContain(hex);
      expect(css, path).not.toMatch(glass);
    }
  });

  it("uses the blue-tinted glass (spec 0113)", () => {
    const css = all.map(([, c]) => c).join("\n");
    for (const glass of ["rgba(8, 10, 14,", "rgba(16, 20, 27,", "rgba(9, 12, 17,", "rgba(5, 7, 10,"]) expect(css).toContain(glass);
  });

  it("keeps every text colour readable on every surface (4.5:1; faint labels 3:1)", () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const bg of ["ground", "surface", "surface-raised"]) {
      for (const [fg, min] of [["text", 4.5], ["text-muted", 4.5], ["accent", 4.5], ["text-faint", 3]] as const) {
        expect(ratio(token(fg)!, token(bg)!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
      }
    }
    expect(ratio(token("accent-ink")!, token("accent")!), "ink on red").toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the status colours: green for connected, yellow for reconnecting", () => {
    expect(token("ok")).toBe("#3fbf7f");
    expect(token("warn")).toBe("#e0b341");
  });

  it("keeps a colour per person on the avatars", () => {
    const avatar = readFileSync(`${src}components/ui/Avatar.tsx`, "utf8");
    expect(avatar).toContain("background: `hsl(${person.hue} 42% 38%)`");
  });

  it("writes LIVE in the accent's ink, so it reads on the red", () => {
    const now = Object.entries(sheets).find(([p]) => p.endsWith("NowWatching.module.css"))![1];
    const live = /\.live \{[^}]*\}/.exec(now)![0];
    expect(live).toMatch(/color:\s*var\(--accent-ink\)/);
  });
});
