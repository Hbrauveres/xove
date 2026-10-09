import { describe, expect, it } from "vitest";
import { swipeOutcome } from "./useStageSwipe";

const W = 400;

describe("what a drag on the stage means (spec 0159)", () => {
  it("steps to the next person on a long enough drag left, the previous on a drag right", () => {
    expect(swipeOutcome(-100, 0, 600, W)).toBe(1);
    expect(swipeOutcome(120, 10, 600, W)).toBe(-1);
  });

  it("steps on a quick flick even when it's short", () => {
    expect(swipeOutcome(-40, 0, 60, W)).toBe(1);
  });

  it("does nothing for a short or slow drag", () => {
    expect(swipeOutcome(-60, 0, 600, W)).toBe(0);
    expect(swipeOutcome(-20, 0, 20, W)).toBe(0);
  });

  it("does nothing for a mostly up-and-down drag", () => {
    expect(swipeOutcome(-120, 150, 300, W)).toBe(0);
  });
});
