import { describe, expect, it } from "vitest";
import { stagePick, stepOnStage } from "./stagePick";

// Spec 0060, FR-6 to FR-8: who is shown big, for one viewer.
describe("who is big", () => {
  it("nobody when nobody shares", () => {
    expect(stagePick([], null)).toBeNull();
    expect(stagePick([], "user-7")).toBeNull();
  });

  it("the person sharing the longest, by default", () => {
    expect(stagePick(["user-7", "user-9"], null)).toBe("user-7");
  });

  it("the person the viewer picked, while they share", () => {
    expect(stagePick(["user-7", "user-9"], "user-9")).toBe("user-9");
  });

  it("the longest sharing again when the picked person stops", () => {
    expect(stagePick(["user-7", "user-3"], "user-9")).toBe("user-7");
  });

  it("the longest remaining when the big one stops", () => {
    expect(stagePick(["user-3", "user-9"], null)).toBe("user-3");
  });
});

// Spec 0159: swiping the phone's stage steps through the people live, in the feed's order.
describe("the next or previous person on the stage", () => {
  const order = ["user-7", "user-3", "user-9"];

  it("steps forward and back", () => {
    expect(stepOnStage(order, "user-7", 1)).toBe("user-3");
    expect(stepOnStage(order, "user-3", -1)).toBe("user-7");
  });

  it("wraps around at both ends", () => {
    expect(stepOnStage(order, "user-9", 1)).toBe("user-7");
    expect(stepOnStage(order, "user-7", -1)).toBe("user-9");
  });

  it("has nowhere to go with fewer than two people", () => {
    expect(stepOnStage(["user-7"], "user-7", 1)).toBeNull();
    expect(stepOnStage([], null, 1)).toBeNull();
  });

  it("starts from the first when nobody is on the stage", () => {
    expect(stepOnStage(order, null, 1)).toBe("user-7");
  });
});
