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

describe("the palette: black, neutral greys, red accent (specs 0111 and 0113)", () => {
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

  it("is soft black, neutral greys and red (specs 0113 and 0121), with the raised surface nudged to pass", () => {
    expect(token("ground")).toBe("#0c0c0d");
    expect(token("surface")).toBe("#161617");
    expect(token("surface-raised")).toBe("#1b1b1d");
    expect(token("line")).toBe("#2c2c2f");
    expect(token("text")).toBe("#ebebec");
    expect(token("text-muted")).toBe("#9a9a9f");
    expect(token("text-faint")).toBe("#66666b");
  });

  it("has none of the blue-tinted greys or glass left", () => {
    const blue = [
      "#0b0e13", "#10141b", "#181f2a", "#1c2430", "#222b38", "#e7ebf1", "#8b96a8", "#667083", "#5d6778",
      "#0d1117", "#151b24", "#273140", "#c3ccd8", "#aab4c4", "#9aa5b6", "#c9d1dc", "#05070a",
    ];
    const glass = /rgba\(\s*(8,\s*10,\s*14|16,\s*20,\s*27|9,\s*12,\s*17|5,\s*7,\s*10)\s*,/;
    for (const [path, css] of all) {
      for (const hex of blue) expect(css.toLowerCase(), `${path} ${hex}`).not.toContain(hex);
      expect(css, path).not.toMatch(glass);
    }
  });

  it("uses the neutral glass", () => {
    const css = all.map(([, c]) => c).join("\n");
    for (const glass of ["rgba(10, 10, 11,", "rgba(20, 20, 21,", "rgba(12, 12, 13,", "rgba(7, 7, 8,"]) expect(css).toContain(glass);
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

  it("keeps pure black only behind the video, the picture's own frame (spec 0121)", () => {
    // The phone's feed pictures are video frames too (spec 0158).
    const frames = ["Stage", "ScreenVideo", "Facecam", "AlsoLive", "LiveFeed", "StreamsRow", "ShareSetup"].map((n) => `/${n}.module.css`);
    for (const [path, css] of all) {
      // Comments may say "black"; only the rules count.
      const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
      const black = /#000(000)?\b|\bblack\b|rgb\(\s*0[\s,]+0[\s,]+0\s*\)/i.test(rules);
      expect(black, path).toBe(frames.some((f) => path.endsWith(f)));
    }
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
