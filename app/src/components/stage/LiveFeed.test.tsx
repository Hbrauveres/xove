import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FakeTrack } from "../../test/fakeLiveKit";
import type { Friend, MediaTrack, Sharer } from "../../types";
import { LiveFeed } from "./LiveFeed";

const video = () => new FakeTrack() as unknown as MediaTrack;
const sharer = (id: string, name: string, kinds: ("screen" | "camera")[]): Sharer => ({
  person: { id, name, hue: 100, online: true },
  isMe: false,
  since: Date.now() - 38 * 60_000 - 5_000,
  ...Object.fromEntries(
    kinds.map((kind) => [
      kind,
      {
        kind,
        startedAt: Date.now(),
        settings: { quality: "1080p", mode: "smooth" },
        remote: { video: video(), setQuality: () => {} },
      },
    ]),
  ),
  hasSound: true,
  sound: new FakeTrack() as unknown as MediaTrack,
});

const RAFA = sharer("user-2", "Rafa", ["screen"]);
const DUDA = sharer("user-3", "Duda", ["camera"]);
const watcher = (id: string): Friend => ({ id, name: id, hue: 1, online: true });

function feed(onPick = vi.fn()) {
  render(
    <LiveFeed
      others={[RAFA, DUDA]}
      liveCount={3}
      watchersOf={(id) => (id === "user-2" ? [watcher("a"), watcher("b"), watcher("c")] : [])}
      onPick={onPick}
    />,
  );
  return onPick;
}

describe("the phone's feed of live streams (spec 0158)", () => {
  it("is headed Live now with how many of the 6 are live", () => {
    feed();
    const head = screen.getByRole("heading", { name: /Live now/ });
    expect(head).toHaveTextContent("3 of 6");
  });

  it("has a card for each other stream: its picture with nothing over it, then who, LIVE, the time and who's watching", () => {
    feed();
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    const rafa = cards[0];
    expect(within(rafa).getByRole("heading", { level: 3, name: "Rafa · Screen" })).toBeInTheDocument();
    expect(within(rafa).getByText("LIVE")).toBeInTheDocument();
    expect(within(rafa).getByText("38:05")).toBeInTheDocument();
    expect(within(rafa).getByText("3 watching")).toBeInTheDocument();
    expect(within(rafa).getByLabelText("Rafa's shared screen")).toBeInTheDocument();
    expect(within(cards[1]).getByRole("heading", { name: "Duda · Camera" })).toBeInTheDocument();
    // Nothing over the picture: the LIVE badge is only in the line under it.
    expect(within(rafa).getAllByText("LIVE")).toHaveLength(1);
  });

  it("is silent: no speaker, no volume, and no sound played", () => {
    const { container } = render(
      <LiveFeed others={[RAFA]} liveCount={2} watchersOf={() => []} onPick={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /sound|mute|volume/i })).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(container.querySelector("audio")).toBeNull();
  });

  it("puts a stream on the stage when its card is tapped", async () => {
    const user = userEvent.setup();
    const onPick = feed();
    await user.click(screen.getByRole("button", { name: "Watch Duda's camera" }));
    expect(onPick).toHaveBeenCalledWith("user-3");
    await user.click(screen.getByRole("heading", { name: "Rafa · Screen" }));
    expect(onPick).toHaveBeenLastCalledWith("user-2");
  });
});
