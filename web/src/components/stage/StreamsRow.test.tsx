import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FakeTrack } from "../../test/fakeLiveKit";
import type { MediaTrack, Sharer } from "../../types";
import { StreamsRow } from "./StreamsRow";

const sharer = (id: string, name: string, kind: "screen" | "camera"): Sharer => ({
  person: { id, name, hue: 100, online: true },
  isMe: false,
  since: Date.now(),
  [kind]: {
    kind,
    startedAt: Date.now(),
    settings: { quality: "1080p", mode: "smooth" },
    remote: { video: new FakeTrack() as unknown as MediaTrack, setQuality: () => {} },
  },
  hasSound: true,
  sound: new FakeTrack() as unknown as MediaTrack,
});
const RAFA = sharer("user-3", "Rafa", "screen");
const DUDA = sharer("user-4", "Duda", "camera");

function row(open: boolean, onPick = vi.fn(), onOpen = vi.fn(), onClose = vi.fn()) {
  const view = render(
    <StreamsRow others={[RAFA, DUDA]} liveCount={3} open={open} onOpen={onOpen} onClose={onClose} onPick={onPick} />,
  );
  return { ...view, onPick, onOpen, onClose };
}

describe("the streams row, sideways (spec 0160)", () => {
  it("is headed Live now with how many of the 6 are live, then a picture per stream with its name", () => {
    row(true);
    const region = screen.getByRole("region", { name: /Live now/ });
    expect(region).toHaveTextContent("3 of 6");
    expect(within(region).getByRole("button", { name: "Watch Rafa's screen" })).toHaveTextContent("Rafa");
    expect(within(region).getByRole("button", { name: "Watch Duda's camera" })).toHaveTextContent("Duda");
  });

  it("is silent: no sound controls and no sound played", () => {
    const { container } = row(true);
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByRole("button", { name: /mute|sound|volume/i })).toBeNull();
    expect(container.querySelector("audio")).toBeNull();
  });

  it("puts a stream on the stage when tapped", async () => {
    const { onPick } = row(true);
    await userEvent.setup().click(screen.getByRole("button", { name: "Watch Duda's camera" }));
    expect(onPick).toHaveBeenCalledWith("user-4");
  });

  it("is closed at first, out of reach, with a button with an arrow up that opens it", async () => {
    const { container, onOpen } = row(false);
    expect(container.querySelector("[data-open]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Watch Rafa's screen" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Show the other streams" }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("while open, the same button with an arrow down closes it, and it's never the start of a swipe", async () => {
    const { container, onClose } = row(true);
    expect(screen.queryByRole("button", { name: "Show the other streams" })).toBeNull();
    const hide = screen.getByRole("button", { name: "Hide the other streams" });
    expect(hide).toHaveAttribute("data-arrow", "down");
    await userEvent.setup().click(hide);
    expect(onClose).toHaveBeenCalled();
    expect(container.querySelector("[data-open]")).toHaveAttribute("data-no-swipe");
  });

  it("has no tab at the bottom: the button sits at the bottom left, arrow up", () => {
    row(false);
    const show = screen.getByRole("button", { name: "Show the other streams" });
    expect(show).toHaveAttribute("data-arrow", "up");
    expect(show.querySelector("svg")).not.toBeNull();
  });
});
