import { describe, expect, it } from "vitest";
import { stagePick } from "./stagePick";

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
