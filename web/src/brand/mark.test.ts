import { describe, expect, it } from "vitest";
import { CAP, ICON_SPACING, OPTICAL, STROKE, iconMark, wordMark } from "./mark";

describe("the wordmark (spec 0111)", () => {
  const w = wordMark();

  it("is X, O, V and E on one cap height, framed by four corners", () => {
    expect(w.letters.map((l) => l.letter)).toEqual(["X", "O", "V", "E"]);
    expect(w.corners).toHaveLength(4);
  });

  it("has only the top-right corner in red", () => {
    expect(w.corners.filter((c) => c.red).map((c) => c.at)).toEqual(["top-right"]);
  });

  it("draws the X with square ends that stay on the cap height", () => {
    const x = w.letters[0];
    for (const s of x.strokes) {
      expect(s.cap).toBe("butt");
      for (const [, y] of s.points) {
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(CAP);
      }
    }
  });

  it("makes the O a record button: a ring as thick as the letters, and a big dot", () => {
    expect(w.ring.width).toBe(STROKE);
    expect(w.ring.r + STROKE / 2).toBe(50);
    expect(w.dot.r).toBeCloseTo(29.4);
    expect(w.dot.cx).toBe(w.ring.cx);
  });

  it("frames the letters 28 apart, with every corner as slim as the letters", () => {
    const [first] = w.letters;
    expect(first.left - w.frame.left).toBe(28);
    expect(w.frame.top).toBe(-28);
    expect(w.frame.bottom).toBe(CAP + 28);
    for (const c of w.corners) expect(c.width).toBe(STROKE);
  });

  it("closes on the logo's left (spec 0113): the left corners stay, the word slides, the right corners meet the O", () => {
    const o = w.letters[1];
    expect(w.closed.dx.left).toBe(0);
    // The O slides to where the icon has it, next to the left corners that didn't move.
    expect(o.left + w.closed.textShift).toBe(w.frame.left + ICON_SPACING.left);
    expect(w.frame.right + w.closed.dx.right).toBe(o.left + w.closed.textShift + 100 + ICON_SPACING.right);
    expect(w.frame.top + w.closed.dy.top).toBe(-ICON_SPACING.top);
    expect(w.frame.bottom + w.closed.dy.bottom).toBe(100 + ICON_SPACING.bottom);
  });
});

describe("the icon (spec 0111)", () => {
  const i = iconMark();

  it("is the record O alone in the same corners, the top-right one red", () => {
    expect(i.corners).toHaveLength(4);
    expect(i.corners.filter((c) => c.red).map((c) => c.at)).toEqual(["top-right"]);
    expect(i.ring.width).toBe(STROKE);
  });

  it("keeps its own spacing around the O", () => {
    const oLeft = i.ring.cx - 50, oTop = i.ring.cy - 50;
    expect(oLeft - i.frame.left).toBe(ICON_SPACING.left);
    expect(i.frame.right - (oLeft + 100)).toBe(ICON_SPACING.right);
    expect(oTop - i.frame.top).toBe(ICON_SPACING.top);
    expect(i.frame.bottom - (oTop + 100)).toBe(ICON_SPACING.bottom);
  });
});

describe("the icon at each size (spec 0113)", () => {
  const outer = (i: ReturnType<typeof iconMark>) => {
    const w = i.corners[0].width;
    return [i.frame.left - w / 2, i.frame.right + w / 2, i.frame.top - w / 2, i.frame.bottom + w / 2];
  };
  const fill = (i: ReturnType<typeof iconMark>) => (outer(i)[3] - outer(i)[2]) / i.viewBox.height;

  it("draws large slim with room to breathe, small and tiny heavier and fuller", () => {
    const [large, small, tiny] = (["large", "small", "tiny"] as const).map((o) => iconMark(o));
    expect([large.corners[0].width, small.corners[0].width, tiny.corners[0].width]).toEqual([10, 12, 16]);
    expect(fill(large)).toBeCloseTo(0.7, 2);
    expect(fill(small)).toBeCloseTo(0.84, 2);
    expect(fill(tiny)).toBeCloseTo(1, 2);
    expect(tiny.dot.r).toBe(OPTICAL.tiny.dot);
  });

  it("keeps the same outer edges at every size: heavier strokes grow inward", () => {
    const edges = (["large", "small", "tiny"] as const).map((o) => outer(iconMark(o)));
    expect(edges[1]).toEqual(edges[0]);
    expect(edges[2]).toEqual(edges[0]);
  });

  it("crops every size to a square centred on the symbol", () => {
    for (const o of ["large", "small", "tiny"] as const) {
      const i = iconMark(o);
      expect(i.viewBox.width).toBe(i.viewBox.height);
      const [l, r] = outer(i);
      expect(i.viewBox.x + i.viewBox.width / 2).toBeCloseTo((l + r) / 2);
    }
  });
});
