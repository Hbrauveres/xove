import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActivityEvent, Friend } from "../../types";
import { ActivityBell } from "./ActivityBell";

const people: Friend[] = [
  { id: "me", name: "Henrique", hue: 36, online: true },
  { id: "user-3", name: "Ana", hue: 300, online: true },
];
const events: ActivityEvent[] = [
  { id: "e1", kind: "joined", actorId: "user-3", at: Date.now() },
  { id: "e2", kind: "started", actorId: "user-3", at: Date.now(), stream: "screen" },
];

function Bell({ list = events }: { list?: ActivityEvent[] }) {
  return <ActivityBell events={list} people={people} meId="me" isLive={() => true} watching={null} onWatch={vi.fn()} />;
}

describe("the activity bell on the phone (spec 0158)", () => {
  it("opens the activity list", async () => {
    const user = userEvent.setup();
    render(<Bell />);
    await user.click(screen.getByRole("button", { name: "Activity" }));
    const list = screen.getByRole("dialog", { name: "Activity" });
    expect(within(list).getAllByText(/Ana/).length).toBeGreaterThan(0);
  });

  it("never shows a count or a dot, however many events come in", () => {
    const { rerender } = render(<Bell list={[]} />);
    const bell = screen.getByRole("button", { name: "Activity" });
    rerender(<Bell />);
    expect(bell).toHaveTextContent("");
    expect(bell.querySelector("[data-new]")).toBeNull();
    expect(screen.getByRole("button", { name: "Activity" })).toBe(bell);
  });
});
