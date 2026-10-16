import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ButtonSlot, SLOT_MS } from "./ButtonSlot";

describe("a round button that comes and goes (spec 0106)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stays in the row while it fades out, then leaves it", () => {
    const view = render(<ButtonSlot shown side="start"><button>Volume</button></ButtonSlot>);
    expect(screen.getByRole("button", { name: "Volume" })).toBeInTheDocument();

    view.rerender(<ButtonSlot shown={false} side="start"><button>Volume</button></ButtonSlot>);

    // Going: still drawn, but out of reach for clicks and screen readers.
    expect(screen.queryByRole("button", { name: "Volume" })).toBeNull();
    expect(document.querySelector("[data-slot='leaving']")).not.toBeNull();
    act(() => vi.advanceTimersByTime(SLOT_MS));
    expect(document.querySelector("[data-slot]")).toBeNull();
  });

  it("doesn't animate a button that's there from the start, even when its effect runs twice", () => {
    render(
      <StrictMode>
        <ButtonSlot shown side="end"><button>Settings</button></ButtonSlot>
      </StrictMode>,
    );

    expect(document.querySelector("[data-slot]")?.getAttribute("data-slot")).toBe("in");
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});
