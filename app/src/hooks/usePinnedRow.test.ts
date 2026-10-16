import { describe, expect, it } from "vitest";
import { heldShift } from "./usePinnedRow";

describe("keeping the clicked button still (spec 0106)", () => {
  it("moves the row by however far the button under the pointer was pushed", () => {
    // A button appeared on the left and pushed the anchor 29 px to the right.
    expect(heldShift(0, 400, 429)).toBe(-29);
    // One went on the left and pulled it back 29 px.
    expect(heldShift(-29, 400, 371)).toBe(0);
  });

  it("leaves the row where it is when the button didn't move", () => {
    expect(heldShift(12, 300, 300)).toBe(12);
  });
});
