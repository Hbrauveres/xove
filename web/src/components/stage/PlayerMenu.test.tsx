import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { MenuGroup, MenuItem, MenuRadio, PlayerMenu } from "./PlayerMenu";

function Harness({
  onClose,
  onPick,
  busy = false,
}: {
  onClose: (r: boolean) => void;
  onPick: (q: string) => void;
  busy?: boolean;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={anchor}>
        <button type="button">Settings</button>
      </div>
      <button type="button">Elsewhere</button>
      <PlayerMenu label="Settings" anchor={anchor} onClose={onClose}>
        <MenuGroup label="Quality">
          <MenuRadio checked busy={busy} onSelect={() => onPick("auto")}>
            Auto
          </MenuRadio>
          <MenuRadio checked={false} busy={busy} onSelect={() => onPick("720p")}>
            720p
          </MenuRadio>
        </MenuGroup>
        <MenuItem busy={busy} onSelect={() => onPick("reset")}>
          Reset
        </MenuItem>
      </PlayerMenu>
    </>
  );
}

describe("a player menu (spec 0101)", () => {
  it("opens on its first item and moves around with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness onClose={vi.fn()} onPick={vi.fn()} />);

    expect(screen.getByRole("menuitemradio", { name: "Auto" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitemradio", { name: "720p" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("menuitemradio", { name: "Auto" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Reset" })).toHaveFocus();
  });

  it("names its groups and ticks the current choice", () => {
    render(<Harness onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByRole("menu", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Quality" })).toContainElement(
      screen.getByRole("menuitemradio", { name: "720p" }),
    );
    expect(screen.getByRole("menuitemradio", { name: "Auto" })).toHaveAttribute("aria-checked", "true");
  });

  it("closes with Escape (focus back to its button), Tab, or a click outside, not inside", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClose={onClose} onPick={vi.fn()} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenLastCalledWith(true);
    await user.keyboard("{Tab}");
    expect(onClose).toHaveBeenLastCalledWith(false);

    onClose.mockClear();
    fireEvent.pointerDown(screen.getByRole("menuitemradio", { name: "720p" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Settings" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Elsewhere" }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("does nothing while a request is on its way", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClose={vi.fn()} onPick={onPick} busy />);

    await user.click(screen.getByRole("menuitemradio", { name: "720p" }));
    await user.click(screen.getByRole("menuitem", { name: "Reset" }));

    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: "Reset" })).toHaveAttribute("aria-disabled", "true");
  });
});
