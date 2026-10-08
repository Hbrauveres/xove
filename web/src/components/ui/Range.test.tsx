import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Range } from "./Range";

describe("Range, the white slider (spec 0121)", () => {
  it("is a plain range input, with every prop passed through", () => {
    const onChange = vi.fn();
    render(<Range aria-label="Volume" className="mine" min={0} max={1} step={0.05} value={0.5} onChange={onChange} />);
    const slider = screen.getByRole("slider", { name: "Volume" });
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("step", "0.05");
    expect(slider).toHaveValue("0.5");
    expect(slider.className).toContain("mine");
    fireEvent.change(slider, { target: { value: "0.7" } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("can be disabled", () => {
    render(<Range aria-label="Brightness" min={0} max={1} value={0.2} onChange={() => {}} disabled />);
    expect(screen.getByRole("slider")).toBeDisabled();
  });

  it("tells its stylesheet how far the white fill goes, from min to max", () => {
    const fill = (value: number, min = 0.2, max = 1) => {
      const { unmount } = render(<Range aria-label="r" min={min} max={max} value={value} onChange={() => {}} />);
      const at = screen.getByRole("slider").style.getPropertyValue("--fill");
      unmount();
      return at;
    };
    expect(fill(0.2)).toBe("0%");
    expect(fill(0.6)).toBe("50%");
    expect(fill(1)).toBe("100%");
    // Out of range values stay on the track.
    expect(fill(2)).toBe("100%");
  });

  it("fills nothing, rather than breaking the track, without a value", () => {
    render(<Range aria-label="r" min={0} max={1} defaultValue={0.5} />);
    expect(screen.getByRole("slider").style.getPropertyValue("--fill")).toBe("0%");
  });
});
