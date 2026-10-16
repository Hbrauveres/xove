import { act, render, screen } from "@testing-library/react";
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

  it("tells the row when it starts to come or go, so the row can hold the clicked button", () => {
    const onChange = vi.fn();
    const view = render(<ButtonSlot shown={false} side="end" onChange={onChange}><button>Settings</button></ButtonSlot>);

    view.rerender(<ButtonSlot shown side="end" onChange={onChange}><button>Settings</button></ButtonSlot>);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});
