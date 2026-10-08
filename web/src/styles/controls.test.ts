/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** A stylesheet from src/, read from disk (the test runner stubs CSS imports). */
const sheet = (path: string) => readFileSync(`${__dirname}/../${path}`, "utf8");
/** The first rule whose selector is exactly `selector`, its body only. */
const rule = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("}", at));
};

describe("the white slider, like a video player's (spec 0121, FR-4)", () => {
  const range = sheet("components/ui/Range.module.css");

  it("has a 3 px round track: white up to the knob, the text colour at 22% after", () => {
    const track = rule(range, ".range::-webkit-slider-runnable-track");
    expect(track).toMatch(/height:\s*3px/);
    expect(track).toMatch(/border-radius:\s*999px/);
    expect(track).toMatch(/#ffffff 0 var\(--fill/);
    expect(track).toMatch(/rgba\(235, 235, 236, 0\.22\) var\(--fill/);
    const moz = rule(range, ".range::-moz-range-track");
    expect(moz).toMatch(/height:\s*3px/);
    expect(moz).toMatch(/rgba\(235, 235, 236, 0\.22\)/);
    expect(rule(range, ".range::-moz-range-progress")).toMatch(/background:\s*#ffffff/);
  });

  it("has a 12 px white knob that grows to 14 px on hover or keyboard focus", () => {
    for (const thumb of [".range::-webkit-slider-thumb", ".range::-moz-range-thumb"]) {
      const css = rule(range, thumb);
      expect(css, thumb).toMatch(/width:\s*12px/);
      expect(css, thumb).toMatch(/height:\s*12px/);
      expect(css, thumb).toMatch(/background:\s*#ffffff/);
    }
    expect(range).toMatch(/\.range:hover::-webkit-slider-thumb,\s*\.range:focus-visible::-webkit-slider-thumb \{[^}]*width:\s*14px/);
    expect(range).toMatch(/\.range:hover::-moz-range-thumb,\s*\.range:focus-visible::-moz-range-thumb \{[^}]*width:\s*14px/);
  });

  it("keeps a focus ring and the dimmed disabled look, and has no red", () => {
    expect(rule(range, ".range:focus-visible")).toMatch(/outline:\s*2px solid var\(--text\)/);
    expect(rule(range, ".range:disabled")).toMatch(/opacity:\s*0\.4/);
    expect(range).not.toMatch(/--accent|accent-color/);
  });

  it("keeps each browser's rules apart, so one browser doesn't drop the other's", () => {
    for (const [, selectors] of range.matchAll(/([^{}]+)\{/g)) {
      const vendors = new Set([...selectors.matchAll(/::-(webkit|moz)-/g)].map(([, v]) => v));
      expect(vendors.size, selectors.trim()).toBeLessThanOrEqual(1);
    }
  });
});
