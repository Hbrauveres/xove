import { describe, expect, it } from "vitest";
import { makeRoom, ROOM_GAP } from "./makeRoom";

// The upright full view of a 440 × 956 phone: a 48 px top bar, a sheet over 58% of it.
const screen = { height: 956, bar: 48, sheet: Math.round(956 * 0.58) };

describe("making room for the settings sheet (spec 0107, design decision 6)", () => {
  it("moves a widescreen player up, between the top bar and the sheet, at the same size", () => {
    // A 16:9 band 247.5 px tall, in the middle of the screen.
    const band = { top: (956 - 247.5) / 2, height: 247.5 };
    const lift = makeRoom({ ...screen, band });
    const free = screen.height - screen.sheet - screen.bar - 2 * ROOM_GAP;
    const top = band.top - lift;
    expect(lift).toBeGreaterThan(0);
    expect(top).toBeGreaterThanOrEqual(screen.bar + ROOM_GAP);
    expect(top + band.height).toBeLessThanOrEqual(screen.height - screen.sheet - ROOM_GAP);
    // Centred in the free space.
    expect(top - (screen.bar + ROOM_GAP)).toBeCloseTo((free - band.height) / 2);
  });

  it("leaves a player that doesn't fit where it is: the sheet covers it (a vertical share)", () => {
    const band = { top: (956 - 782) / 2, height: 782 };
    expect(makeRoom({ ...screen, band })).toBe(0);
  });

  it("never moves the player down", () => {
    const band = { top: 60, height: 200 };
    expect(makeRoom({ ...screen, band })).toBe(0);
  });
});
