import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Sharer } from "../../types";
import { NowWatching } from "./NowWatching";

const feed = (kind: "screen" | "camera", minutesAgo: number) => ({
  kind,
  startedAt: Date.now() - minutesAgo * 60_000,
  settings: { quality: "1080p" as const, mode: "smooth" as const },
});
const bruno = (camera: boolean): Sharer => ({
  person: { id: "user-7", name: "Bruno", hue: 210, online: true },
  isMe: false,
  since: Date.now() - 12 * 60_000 - 40_000,
  screen: feed("screen", 12),
  camera: camera ? feed("camera", 11) : undefined,
});

describe("now watching (spec 0104)", () => {
  it("names who is on the stage, live, what they share and for how long", () => {
    render(<NowWatching sharer={bruno(true)} />);

    expect(screen.getByRole("heading", { name: "Bruno" })).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("Screen with camera")).toBeInTheDocument();
    expect(screen.getByText("12:40")).toBeInTheDocument();
  });

  it("says Screen or Camera when that's all they share", () => {
    const { rerender } = render(<NowWatching sharer={bruno(false)} />);
    expect(screen.getByText("Screen")).toBeInTheDocument();

    rerender(<NowWatching sharer={{ ...bruno(true), screen: undefined }} />);
    expect(screen.getByText("Camera")).toBeInTheDocument();
  });

  it("says You when I'm on the stage", () => {
    render(<NowWatching sharer={{ ...bruno(false), isMe: true }} />);
    expect(screen.getByRole("heading", { name: "You" })).toBeInTheDocument();
  });

  it("says nobody is sharing on an empty stage", () => {
    render(<NowWatching sharer={null} />);
    expect(screen.getByText("Nobody is sharing right now")).toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });
});
