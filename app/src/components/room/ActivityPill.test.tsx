import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActivityEvent, ConnectionState, Friend } from "../../types";
import { ActivityPill } from "./ActivityPill";

const people: Friend[] = [
  { id: "me", name: "Henrique", hue: 36, online: true },
  { id: "user-3", name: "Ana", hue: 300, online: true },
  { id: "user-9", name: "Diego", hue: 90, online: true },
];
let seq = 0;
const ev = (kind: ActivityEvent["kind"], actorId: string, stream?: "screen" | "camera"): ActivityEvent => ({
  id: `e${++seq}`,
  kind,
  actorId,
  at: Date.now(),
  stream,
});

function Pill({ events, connection = "connected" }: { events: ActivityEvent[]; connection?: ConnectionState }) {
  return (
    <ActivityPill
      events={events}
      people={people}
      meId="me"
      connection={connection}
      isLive={() => true}
      watching={null}
      onWatch={vi.fn()}
    />
  );
}

const pill = () => screen.getByRole("button", { name: /^Activity|Connection/ });

describe("activity pill (spec 0104)", () => {
  it("counts events that came in while the list was open as seen once it closes", async () => {
    const user = userEvent.setup();
    const first = [ev("joined", "user-9")];
    const { rerender } = render(<Pill events={first} />);
    await user.click(pill());

    rerender(<Pill events={[...first, ev("left", "user-9")]} />);
    await user.keyboard("{Escape}");

    expect(pill()).toHaveAccessibleName("Activity: Diego left, just now");
    expect(pill()).toHaveFocus();
  });

  it("shows the latest event with how long ago, and counts the new ones", () => {
    const first = [ev("joined", "user-9")];
    const { rerender } = render(<Pill events={first} />);
    expect(pill()).toHaveTextContent("Diego joined");
    expect(pill()).toHaveTextContent("now");

    rerender(<Pill events={[...first, ev("started", "user-3", "screen")]} />);

    expect(pill()).toHaveTextContent("Ana started sharing");
    expect(pill()).toHaveAccessibleName("Activity: Ana started sharing, just now, 2 new");
  });

  it("opens the list on a click, and the new ones count as seen", async () => {
    const user = userEvent.setup();
    render(<Pill events={[ev("joined", "user-9"), ev("started", "user-3", "screen")]} />);

    await user.click(pill());

    const list = screen.getByRole("dialog", { name: "Activity" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(pill()).toHaveAccessibleName("Activity: Ana started sharing, just now");
  });

  it("says when the connection drops, then shows the latest event again", () => {
    const events = [ev("joined", "user-9")];
    const { rerender } = render(<Pill events={events} connection="reconnecting" />);
    expect(pill()).toHaveAccessibleName("Connection dropped. Reconnecting");
    expect(pill()).toHaveTextContent("Connection dropped. Reconnecting…");

    act(() => {
      rerender(<Pill events={[...events, ev("reconnected", "me")]} connection="connected" />);
    });
    expect(pill()).toHaveTextContent("Reconnected");
  });

  it("has a calm line before anything happened", () => {
    render(<Pill events={[]} />);
    expect(pill()).toHaveTextContent("Nothing new yet");
  });
});
