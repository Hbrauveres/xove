import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Friend } from "../../types";
import { StageDots } from "./StageDots";

const person = (id: string, name: string): Friend => ({ id, name, hue: 1, online: true });
const people = [person("user-7", "Marina"), person("user-3", "Rafa"), person("me", "Henrique")];

describe("the dots over the phone's stage (spec 0159)", () => {
  it("has one per person live, in order, marking the one on the stage", () => {
    render(<StageDots people={people} meId="me" onStage="user-3" onPick={vi.fn()} />);
    const dots = screen.getAllByRole("button");
    expect(dots.map((d) => d.getAttribute("aria-label"))).toEqual(["Watch Marina", "Watch Rafa", "Watch yourself"]);
    expect(dots[1]).toHaveAttribute("aria-current", "true");
    expect(dots[0]).not.toHaveAttribute("aria-current");
  });

  it("puts a person on the stage when tapped", async () => {
    const onPick = vi.fn();
    render(<StageDots people={people} meId="me" onStage="user-3" onPick={onPick} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Watch Marina" }));
    expect(onPick).toHaveBeenCalledWith("user-7");
  });

  it("isn't there with only one person live", () => {
    const { container } = render(<StageDots people={[people[0]]} meId="me" onStage="user-7" onPick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
