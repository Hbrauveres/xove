import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Segmented } from "./Segmented";

const MODES = [
  { value: "smooth", label: "Smooth", title: "Keeps motion fluid" },
  { value: "sharp", label: "Sharp", title: "Keeps detail sharp" },
] as const;

describe("Segmented, the app's segmented control", () => {
  it("is a group of radios named by its label, the chosen one checked, each with its tooltip", () => {
    render(<Segmented label="Mode" options={MODES} value="smooth" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Mode" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Smooth" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Sharp" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Sharp" })).toHaveAttribute("title", "Keeps detail sharp");
  });

  it("picks another option on a click, and does nothing on the chosen one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented label="Mode" options={MODES} value="smooth" onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Smooth" }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "Sharp" }));
    expect(onChange).toHaveBeenCalledWith("sharp");
  });

  it("moves with the arrow keys, like any radio group, with one tab stop", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented label="Mode" options={MODES} value="smooth" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Smooth" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Sharp" })).toHaveAttribute("tabindex", "-1");
    screen.getByRole("radio", { name: "Smooth" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("sharp");
  });

  it("tells its stylesheet where the sliding pill goes", () => {
    render(<Segmented label="Quality" options={[{ value: "1080p", label: "1080p" }, { value: "720p", label: "720p" }, { value: "480p", label: "480p" }]} value="720p" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup");
    expect(group.style.getPropertyValue("--n")).toBe("3");
    expect(group.style.getPropertyValue("--i")).toBe("1");
  });

  it("can be disabled", () => {
    render(<Segmented label="Mode" options={MODES} value="smooth" onChange={() => {}} disabled />);
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });
});
