import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Friend } from "../../types";
import { HereCards } from "./HereCards";

const NOW = Date.parse("2026-10-09T20:00:00Z");
const person = (id: string, name: string): Friend => ({ id, name, hue: 100, online: true });
const me = person("me", "Henrique");
const caio = person("user-2", "Caio");
const nina = person("user-3", "Nina");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("who's here, as cards, when nobody is live (spec 0158)", () => {
  it("is headed Here with how many are in the room", () => {
    render(<HereCards people={[me, caio, nina]} meId="me" arrivedAt={{}} />);
    expect(screen.getByRole("heading", { name: /Here/ })).toHaveTextContent("3");
  });

  it("puts me first as (you), and the others waiting", () => {
    render(<HereCards people={[caio, me, nina]} meId="me" arrivedAt={{}} />);
    const cards = screen.getAllByRole("listitem");
    expect(cards.map((c) => within(c).getByRole("heading").textContent)).toEqual(["Henrique (you)", "Caio", "Nina"]);
    expect(within(cards[0]).queryByText("WAITING")).toBeNull();
    expect(within(cards[1]).getByText("WAITING")).toBeInTheDocument();
    expect(within(cards[2]).getByText("WAITING")).toBeInTheDocument();
  });

  it("says how long each has been here, and keeps counting", () => {
    render(
      <HereCards
        people={[me, caio, nina]}
        meId="me"
        arrivedAt={{ me: NOW - 65 * 60_000, "user-2": NOW - 18 * 60_000, "user-3": NOW - 20_000 }}
      />,
    );
    const cards = screen.getAllByRole("listitem");
    expect(cards[0]).toHaveTextContent("here 1 h 5 min");
    expect(cards[1]).toHaveTextContent("here 18 min");
    expect(cards[2]).toHaveTextContent("just arrived");

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getAllByRole("listitem")[2]).toHaveTextContent("here 1 min");
  });

  it("shows no time for someone the API doesn't know yet", () => {
    render(<HereCards people={[me, caio]} meId="me" arrivedAt={{ me: NOW }} />);
    const caioCard = screen.getAllByRole("listitem")[1];
    expect(caioCard).not.toHaveTextContent(/here|arrived/);
  });
});
