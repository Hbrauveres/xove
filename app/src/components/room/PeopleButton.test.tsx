import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Friend } from "../../types";
import { PeopleButton } from "./PeopleButton";

const people: Friend[] = [
  { id: "me", name: "Henrique", hue: 36, online: true },
  { id: "user-7", name: "Bruno", hue: 210, online: true },
  { id: "user-3", name: "Ana", hue: 300, online: true },
  { id: "user-9", name: "Diego", hue: 90, online: true },
];

function setup(props: Partial<Parameters<typeof PeopleButton>[0]> = {}) {
  render(
    <PeopleButton
      people={people}
      meId="me"
      sharing={{ "user-7": { screen: true, camera: true }, "user-3": { screen: true, camera: false } }}
      watchingOf={{ me: { sharerId: "user-7", kind: "screen" }, "user-9": { sharerId: "user-3", kind: "screen" } }}
      seats={{ total: 20, taken: 4, waiting: 0 }}
      {...props}
    />,
  );
  return userEvent.setup();
}

/** A person's row, by the name in bold (not a mention like "Watching Bruno"). */
const row = (name: RegExp) =>
  within(screen.getByRole("dialog", { name: "Here now" }))
    .getAllByRole("listitem")
    .find((li) => name.test(li.querySelector("b")?.textContent ?? ""))!;

describe("people button (spec 0104)", () => {
  it("shows a people icon and the number, named for screen readers", () => {
    setup();
    expect(screen.getByRole("button", { name: "4 people here" })).toHaveTextContent(/^4$/);
  });

  it("opens the seats, everyone with what they share or watch, and the queue", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "4 people here" }));

    const panel = screen.getByRole("dialog", { name: "Here now" });
    expect(within(panel).getByText((_, el) => el?.textContent === "4 of 20 · 16 free")).toBeInTheDocument();
    expect(within(panel).getByRole("progressbar", { name: "Seats taken" })).toHaveAttribute("aria-valuenow", "4");
    expect(row(/Bruno/)).toHaveTextContent("Sharing screen and camera");
    expect(within(row(/Bruno/)).getByLabelText("Screen")).toBeInTheDocument();
    expect(within(row(/Bruno/)).getByLabelText("Camera")).toBeInTheDocument();
    expect(row(/Ana/)).toHaveTextContent("Sharing their screen");
    expect(row(/Henrique/)).toHaveTextContent("(you)");
    expect(row(/Henrique/)).toHaveTextContent("Watching Bruno");
    expect(row(/Diego/)).toHaveTextContent("Watching Ana");
    expect(within(panel).getByText("Nobody is waiting for a seat.")).toBeInTheDocument();
  });

  it("lists the people sharing first, then me, then everyone else, as in the design", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "4 people here" }));

    const names = within(screen.getByRole("dialog", { name: "Here now" }))
      .getAllByRole("listitem")
      .map((li) => li.querySelector("b")?.textContent);
    expect(names).toEqual(["Bruno", "Ana", "Henrique", "Diego"]);
  });

  it("says who's just in the room, and how many wait", async () => {
    const user = setup({ watchingOf: {}, seats: { total: 20, taken: 20, waiting: 2 } });
    await user.click(screen.getByRole("button", { name: "4 people here" }));

    expect(row(/Diego/)).toHaveTextContent("In the room");
    expect(screen.getByText("2 people are waiting for a seat.")).toBeInTheDocument();
  });

  it("leaves the seats and the queue out when the API doesn't say them", async () => {
    const user = setup({ seats: null });
    await user.click(screen.getByRole("button", { name: "4 people here" }));

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/waiting for a seat/)).not.toBeInTheDocument();
  });
});
