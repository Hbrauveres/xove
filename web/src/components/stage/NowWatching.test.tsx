import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Friend, Sharer } from "../../types";
import { NowWatching } from "./NowWatching";
import { whoIsHere } from "./whoIsHere";

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

  it("draws the avatar's ring inside it, so it lines up with the stage's edge (spec 0107)", () => {
    const { container } = render(<NowWatching sharer={bruno(false)} />);
    expect(container.querySelector('[data-ring="inside"]')).toBeInTheDocument();
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

});

const friend = (id: string, name: string): Friend => ({ id, name, hue: 100, online: true });
const people = (...names: string[]) => names.map((n, i) => friend(`user-${i + 1}`, n));

describe("now watching: who's watching (spec 0107)", () => {
  it("shows who's watching: their avatars side by side and how many", () => {
    const { container } = render(<NowWatching sharer={bruno(false)} watchers={people("Henrique", "Diego")} />);

    expect(screen.getByText("2 watching")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-watcher]")).toHaveLength(2);
  });

  it("shows up to 4 avatars, and the count covers the rest", () => {
    const { container } = render(
      <NowWatching sharer={bruno(false)} watchers={people("Ana", "Diego", "Carla", "Leo", "Rui", "Bia")} />,
    );

    expect(screen.getByText("6 watching")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-watcher]")).toHaveLength(4);
  });

  it("shows nothing about watching while nobody watches", () => {
    render(<NowWatching sharer={bruno(false)} watchers={[]} />);
    expect(screen.queryByText(/watching/)).not.toBeInTheDocument();
  });
});

describe("now watching: an empty stage (spec 0107)", () => {
  it("invites someone to go live, with who's here", () => {
    const { container } = render(<NowWatching sharer={null} others={people("Bruno", "Ana", "Diego")} />);

    expect(screen.getByRole("heading", { name: "The stage is yours." })).toBeInTheDocument();
    expect(screen.getByText("Bruno, Ana and Diego are here, waiting for someone to go live.")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-here]")).toHaveLength(3);
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });

  it("says nobody else is here when I'm alone, with no avatars", () => {
    const { container } = render(<NowWatching sharer={null} others={[]} />);

    expect(screen.getByText("Nobody else is here yet.")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-here]")).toHaveLength(0);
  });

  it("names up to three, then counts the others", () => {
    expect(whoIsHere(["Bruno"])).toBe("Bruno is here, waiting for someone to go live.");
    expect(whoIsHere(["Bruno", "Ana"])).toBe("Bruno and Ana are here, waiting for someone to go live.");
    expect(whoIsHere(["Bruno", "Ana", "Diego", "Carla", "Leo", "Rui", "Bia"])).toBe(
      "Bruno, Ana and 5 others are here, waiting for someone to go live.",
    );
    expect(whoIsHere([])).toBe("Nobody else is here yet.");
  });

  it("shows the avatars of the first four at most", () => {
    const { container } = render(<NowWatching sharer={null} others={people("A", "B", "C", "D", "E", "F")} />);
    expect(container.querySelectorAll("[data-here]")).toHaveLength(4);
  });
});
