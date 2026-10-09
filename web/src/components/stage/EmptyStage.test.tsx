import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BARS, EmptyStage } from "./EmptyStage";

describe("the empty stage (spec 0158)", () => {
  it("shows the colour bars at full colour", () => {
    const { container } = render(<EmptyStage />);
    const bars = container.querySelectorAll("[data-bar]");
    expect(bars).toHaveLength(BARS.length);
    expect(container.querySelector("[data-bars]")).not.toHaveAttribute("data-faded");
  });

  it("asks to share a screen or turn on a camera, or only the camera where a screen can't be shared", () => {
    const { rerender } = render(<EmptyStage />);
    expect(screen.getByText("Share your screen or turn on your camera with the buttons below.")).toBeInTheDocument();
    rerender(<EmptyStage canShareScreen={false} />);
    expect(screen.getByText("Turn on your camera with the button below.")).toBeInTheDocument();
  });
});
