import { describe, expect, it } from "vitest";
import { timeAgo } from "./useElapsed";

describe("timeAgo", () => {
  const now = 1_000_000_000_000;

  it('says "just now" under 45 seconds', () => {
    expect(timeAgo(now - 30_000, now)).toBe("just now");
  });

  it("counts minutes", () => {
    expect(timeAgo(now - 4 * 60_000, now)).toBe("4 min ago");
  });

  it("switches to hours at 60 minutes", () => {
    expect(timeAgo(now - 60 * 60_000, now)).toBe("1 h ago");
  });
});
