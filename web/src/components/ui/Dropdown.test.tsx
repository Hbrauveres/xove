import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { Dropdown, DropdownSection } from "./Dropdown";

/** A button with its dropdown, as the header uses them. */
function Trigger({ name, role = "dialog" }: { name: string; role?: "dialog" | "menu" }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <div ref={anchor}>
      <button ref={button} type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {name}
      </button>
      <Dropdown
        open={open}
        label={`${name} panel`}
        role={role}
        anchor={anchor}
        onClose={(returnFocus) => {
          setOpen(false);
          if (returnFocus) button.current?.focus();
        }}
      >
        <DropdownSection>
          {role === "menu" ? (
            <>
              <button type="button" role="menuitem">
                First
              </button>
              <button type="button" role="menuitem">
                Second
              </button>
            </>
          ) : (
            <p>Inside {name}</p>
          )}
        </DropdownSection>
        <DropdownSection scroll>
          <p>More of {name}</p>
        </DropdownSection>
      </Dropdown>
    </div>
  );
}

const panel = (name: string) => screen.queryByRole("dialog", { name: `${name} panel` });

describe("dropdown (spec 0104)", () => {
  it("opens as a named panel of sections, and closes with Escape, the focus back on its button", async () => {
    const user = userEvent.setup();
    render(<Trigger name="People" />);

    await user.click(screen.getByRole("button", { name: "People" }));
    expect(panel("People")).toBeInTheDocument();
    expect(screen.getByText("Inside People")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(panel("People")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "People" })).toHaveFocus();
  });

  it("closes on a click outside, not on a click inside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Trigger name="People" />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "People" }));

    fireEvent.pointerDown(screen.getByText("Inside People"));
    expect(panel("People")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Elsewhere" }));

    await waitFor(() => expect(panel("People")).not.toBeInTheDocument());
  });

  it("keeps only one open at a time", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Trigger name="People" />
        <Trigger name="Activity" />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "People" }));
    await user.click(screen.getByRole("button", { name: "Activity" }));

    expect(panel("Activity")).toBeInTheDocument();
    await waitFor(() => expect(panel("People")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "People" })).toHaveAttribute("aria-expanded", "false");
  });

  it("as a menu: opens on its first item and moves with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Trigger name="Account" role="menu" />);

    await user.click(screen.getByRole("button", { name: "Account" }));

    expect(screen.getByRole("menu", { name: "Account panel" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Second" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus();
  });

  it("unrolls by its height and rolls back up the same way, never by a fade or clip that stops its blur", async () => {
    const user = userEvent.setup();
    render(<Trigger name="People" />);

    await user.click(screen.getByRole("button", { name: "People" }));
    const opened = panel("People")!;
    // jsdom drops grid-template-rows from inline styles; data-rolled follows the same state.
    await waitFor(() => expect(opened).toHaveAttribute("data-rolled", "out"));
    expect(opened.style.opacity).toBe("");
    expect(opened.style.clipPath).toBe("");

    await user.click(screen.getByRole("button", { name: "People" }));
    expect(opened).toHaveAttribute("data-rolled", "up");
    await waitFor(() => expect(panel("People")).not.toBeInTheDocument());
  });
});
