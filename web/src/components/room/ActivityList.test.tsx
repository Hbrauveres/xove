import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActivityEvent, Friend } from "../../types";
import { ActivityList } from "./ActivityList";

const people: Friend[] = [
  { id: "me", name: "Henrique", hue: 36, online: true },
  { id: "user-3", name: "Ana", hue: 300, online: true },
  { id: "user-7", name: "Bruno", hue: 210, online: true },
  { id: "user-9", name: "Diego", hue: 90, online: true },
];
const now = Date.now();
const ev = (
  id: string,
  kind: ActivityEvent["kind"],
  actorId: string,
  minutesAgo: number,
  stream?: "screen" | "camera",
): ActivityEvent => ({
  id,
  kind,
  actorId,
  at: now - minutesAgo * 60_000,
  stream,
});
const EVENTS: ActivityEvent[] = [
  ev("1", "joined", "me", 15),
  ev("2", "started", "user-7", 13, "screen"),
  ev("3", "joined", "user-9", 9),
  ev("4", "started", "user-7", 6, "camera"),
  ev("5", "started", "user-3", 2, "screen"),
  ev("6", "stopped", "user-9", 1, "screen"),
  ev("7", "left", "user-9", 1),
  ev("8", "reconnected", "me", 0),
];

function setup(watching: { personId: string; kind: "screen" | "camera" } | null = null) {
  const onWatch = vi.fn();
  render(
    <ActivityList
      events={EVENTS}
      people={people}
      meId="me"
      unseen={2}
      // Bruno's screen and camera and Ana's screen are live; Diego's ended.
      isLive={(personId, kind) => ["user-7|screen", "user-7|camera", "user-3|screen"].includes(`${personId}|${kind}`)}
      watching={watching}
      onWatch={onWatch}
    />,
  );
  return { onWatch, user: userEvent.setup() };
}

describe("activity list (spec 0104)", () => {
  it("lists every kind of event, newest first", () => {
    setup();
    const items = within(screen.getByRole("list"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(items.map((t) => t?.replace(/(\d+ min|now)$/, "").replace(/WATCH(ING)?$/, ""))).toEqual([
      "Reconnected",
      "Diego left",
      "Diego stopped sharing",
      "Ana started sharing",
      "Bruno turned on their camera",
      "Diego joined",
      "Bruno started sharing",
      "You joined",
    ]);
  });

  it("highlights the events not seen yet", () => {
    setup();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[0].querySelector("[data-unseen]")).not.toBeNull();
    expect(items[1].querySelector("[data-unseen]")).not.toBeNull();
    expect(items[2].querySelector("[data-unseen]")).toBeNull();
  });

  it("lets a live stream's event put it on the stage", async () => {
    const { onWatch, user } = setup();

    await user.click(screen.getByRole("button", { name: "Bruno turned on their camera: watch" }));
    expect(onWatch).toHaveBeenCalledWith("user-7", "camera");
    await user.click(screen.getByRole("button", { name: "Ana started sharing: watch" }));
    expect(onWatch).toHaveBeenLastCalledWith("user-3", "screen");
  });

  it("marks the stream being watched, and leaves ended streams and people events as text", () => {
    setup({ personId: "user-7", kind: "screen" });

    const watched = screen.getByRole("button", { name: "Bruno started sharing: watching" });
    expect(watched).toHaveTextContent("WATCHING");
    expect(screen.queryByRole("button", { name: /Diego/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /joined|left|Reconnected/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
