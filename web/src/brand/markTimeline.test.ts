import { describe, expect, it } from "vitest";
import { TOTAL_MS, frameAt } from "./markTimeline";

describe("the mark's animation timeline (spec 0111, FR-4a)", () => {
  it("starts and ends at rest: the full wordmark, the dot round", () => {
    for (const t of [0, TOTAL_MS]) expect(frameAt(t)).toEqual({ slide: 0, settle: 0, eye: { sx: 1, sy: 1 } });
  });

  it("slides in first, then settles on the icon, before any blink", () => {
    expect(frameAt(300).slide).toBeGreaterThan(0);
    expect(frameAt(300).settle).toBe(0);
    expect(frameAt(600)).toMatchObject({ slide: 1, settle: 0 });
    expect(frameAt(980)).toMatchObject({ slide: 1, settle: 1, eye: { sx: 1, sy: 1 } });
  });

  it("blinks twice: the dot squashes nearly shut, opens, and again", () => {
    const sy = Array.from({ length: 1000 }, (_, i) => frameAt(1000 + i).eye.sy);
    const shut = sy.filter((v, i) => v < 0.1 && (i === 0 || sy[i - 1] >= 0.1));
    expect(shut).toHaveLength(2);
  });

  it("springs a little wide after the second blink, then settles round", () => {
    const peak = Math.max(...Array.from({ length: 300 }, (_, i) => frameAt(1500 + i).eye.sy));
    expect(peak).toBeGreaterThan(1);
    expect(frameAt(2100).eye).toEqual({ sx: 1, sy: 1 });
  });

  it("never jumps: each step starts where the last one ended", () => {
    for (let t = 1; t < TOTAL_MS; t++) {
      const a = frameAt(t - 1), b = frameAt(t);
      expect(Math.abs(b.eye.sy - a.eye.sy)).toBeLessThan(0.2);
      expect(Math.abs(b.eye.sx - a.eye.sx)).toBeLessThan(0.05);
      expect(Math.abs(b.slide - a.slide)).toBeLessThan(0.02);
      expect(Math.abs(b.settle - a.settle)).toBeLessThan(0.02);
    }
  });

  it("goes back the same way: the settle, then the slide", () => {
    expect(frameAt(2500)).toMatchObject({ slide: 1 });
    expect(frameAt(2500).settle).toBeLessThan(1);
    expect(frameAt(3000).settle).toBe(0);
    expect(frameAt(3000).slide).toBeLessThan(1);
  });
});
