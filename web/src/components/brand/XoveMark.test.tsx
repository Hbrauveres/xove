import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { XoveIcon } from "./XoveIcon";
import { XoveMark } from "./XoveMark";

describe("the wordmark (spec 0111)", () => {
  it("is one image named Xovê, drawn, not typed", () => {
    render(<XoveMark height={26} />);
    const mark = screen.getByRole("img", { name: "Xovê" });
    expect(mark.tagName.toLowerCase()).toBe("svg");
    expect(mark).toHaveAttribute("height", "26");
    expect(mark.textContent).toBe("");
  });

  it("has the record O and a red top-right corner", () => {
    render(<XoveMark height={26} />);
    const mark = screen.getByRole("img", { name: "Xovê" });
    expect(mark.querySelector("[data-dot]")).toHaveAttribute("fill", "var(--accent)");
    const red = mark.querySelectorAll("[data-corner][data-red]");
    expect([...red].map((c) => c.getAttribute("data-corner"))).toEqual(["top-right"]);
    expect(mark.querySelectorAll("[data-corner]")).toHaveLength(4);
  });
});

describe("the icon (spec 0111)", () => {
  it("is the record O in the same corners, named Xovê", () => {
    render(<XoveIcon size={32} />);
    const icon = screen.getByRole("img", { name: "Xovê" });
    expect(icon.querySelector("[data-dot]")).toBeInTheDocument();
    expect(icon.querySelectorAll("[data-corner]")).toHaveLength(4);
    expect(icon.querySelector("[data-corner][data-red]")).toHaveAttribute("data-corner", "top-right");
  });
});
