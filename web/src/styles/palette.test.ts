/// <reference types="node" />
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Every stylesheet in the app, by path, read from disk (the test runner stubs CSS imports). */
// Tests run from web/.
const src = `${process.cwd()}/src/`;
const sheets: Record<string, string> = Object.fromEntries(
  readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((p) => p.endsWith(".css"))
    .map((p) => [p, readFileSync(src + p, "utf8")]),
);
const all = Object.entries(sheets);
const global = Object.entries(sheets).find(([p]) => p.endsWith("styles/global.css"))?.[1] ?? "";

const token = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(global)?.[1].trim();

describe("the palette: red, white, black and grey (spec 0111)", () => {
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

  it("has neutral greys: none of the old blue-tinted ones", () => {
    const old = [
      "#0d1117", "#151b24", "#1c2430", "#273140", "#e7ebf1", "#8b96a8", "#5d6778",
      "#c3ccd8", "#aab4c4", "#9aa5b6", "#c9d1dc", "#05070a", "#10141b", "#1a1206",
    ];
    const glass = /rgba\(\s*(8,\s*10,\s*14|16,\s*20,\s*27|9,\s*12,\s*17|5,\s*7,\s*10)\s*,/;
    for (const [path, css] of all) {
      for (const hex of old) expect(css.toLowerCase(), `${path} ${hex}`).not.toContain(hex);
      expect(css, path).not.toMatch(glass);
    }
  });

  it("keeps the status colours: green for connected, yellow for reconnecting", () => {
    expect(token("ok")).toBe("#3fbf7f");
    expect(token("warn")).toBe("#e0b341");
  });

  it("writes LIVE in the accent's ink, so it reads on the red", () => {
    const now = Object.entries(sheets).find(([p]) => p.endsWith("NowWatching.module.css"))![1];
    const live = /\.live \{[^}]*\}/.exec(now)![0];
    expect(live).toMatch(/color:\s*var\(--accent-ink\)/);
  });
});
