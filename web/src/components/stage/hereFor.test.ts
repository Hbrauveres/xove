import { describe, expect, it } from "vitest";
import { hereFor } from "./hereFor";

const at = Date.parse("2026-10-09T10:00:00Z");
const after = (seconds: number) => at + seconds * 1000;

describe("how long someone has been here (spec 0158)", () => {
  it("says just arrived under a minute", () => {
    expect(hereFor(at, at)).toBe("just arrived");
    expect(hereFor(at, after(59))).toBe("just arrived");
  });

  it("counts minutes, then hours and minutes", () => {
    expect(hereFor(at, after(60))).toBe("here 1 min");
    expect(hereFor(at, after(59 * 60 + 59))).toBe("here 59 min");
    expect(hereFor(at, after(3600))).toBe("here 1 h");
    expect(hereFor(at, after(3600 + 5 * 60))).toBe("here 1 h 5 min");
    expect(hereFor(at, after(3 * 3600 + 42 * 60 + 10))).toBe("here 3 h 42 min");
  });

  it("never goes below just arrived when a clock is ahead", () => {
    expect(hereFor(after(30), at)).toBe("just arrived");
  });
});
