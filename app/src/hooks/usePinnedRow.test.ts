import { act, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { heldShift, usePinnedRow } from "./usePinnedRow";

describe("keeping the clicked button still (spec 0106)", () => {
  it("moves the row by however far the button under the pointer was pushed", () => {
    expect(heldShift(0, 400, 409)).toBe(-9);
    expect(heldShift(-9, 400, 391)).toBe(0);
    expect(heldShift(12, 300, 300)).toBe(12);
  });
});

describe("the row holds the button under the pointer when its width changes (spec 0106)", () => {
  let resized: () => void = () => {};
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          resized = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function Row() {
    const { ref } = usePinnedRow<HTMLDivElement>();
    return createElement("div", { ref, "data-testid": "row" }, createElement("button", null, "Camera"));
  }

  it("moves the row back when a change in the row pushes the button under the pointer, and recentres once the pointer leaves", () => {
    const { getByRole, getByTestId } = render(createElement(Row));
    const camera = getByRole("button");
    let left = 400;
    camera.getBoundingClientRect = () => ({ left, right: left + 48, top: 0, bottom: 48, width: 48, height: 48, x: left, y: 0, toJSON() {} });

    fireEvent.pointerOver(camera);
    // The camera's arrow went away and the centred row pushed the camera 9 px right.
    left = 409;
    act(() => resized());

    expect(getByTestId("row").style.transform).toBe("translateX(-9px)");

    fireEvent.pointerLeave(getByTestId("row"));

    expect(getByTestId("row").style.transform).toBe("");
    expect(getByTestId("row").style.transition).toContain("220ms");
  });

  it("does nothing while the pointer isn't on the row", () => {
    const { getByTestId } = render(createElement(Row));

    act(() => resized());

    expect(getByTestId("row").style.transform).toBe("");
  });
});
