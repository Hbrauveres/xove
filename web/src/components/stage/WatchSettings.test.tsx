import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WatchPrefs } from "../../media/preferences";
import { WatchSettings } from "./WatchSettings";

const PREFS: WatchPrefs = { quality: "auto", volume: 0.6, muted: false };

function setup(props: Partial<Parameters<typeof WatchSettings>[0]> = {}) {
  const onChange = vi.fn();
  const onOpenChange = vi.fn();
  const user = userEvent.setup();
  render(
    <WatchSettings sharerHeight={1080} prefs={PREFS} onChange={onChange} onOpenChange={onOpenChange} {...props} />,
  );
  return { user, onChange, onOpenChange };
}

const choices = () =>
  within(screen.getByRole("group", { name: "Quality" }))
    .getAllByRole("menuitemradio")
    .map((i) => [i.textContent, i.getAttribute("aria-checked")]);

describe("the viewer's settings (spec 0101)", () => {
  it("opens a menu with Auto and the qualities the stream offers, the current one ticked", async () => {
    const { user, onOpenChange } = setup();

    const gear = screen.getByRole("button", { name: "Settings" });
    expect(gear).toHaveAttribute("aria-haspopup", "menu");
    await user.click(gear);

    expect(screen.getByRole("menu", { name: "Settings" })).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(choices()).toEqual([
      ["Auto", "true"],
      ["1080p", "false"],
      ["720p", "false"],
      ["480p", "false"],
    ]);
  });

  it("never offers more than the sharer sends", async () => {
    const { user } = setup({ sharerHeight: 1080, cap: "720p" });
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(choices().map(([q]) => q)).toEqual(["Auto", "720p", "480p"]);
  });

  it("ticks Auto when the remembered quality isn't offered", async () => {
    const { user } = setup({ sharerHeight: 720, prefs: { ...PREFS, quality: "1080p" } });
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(choices()[0]).toEqual(["Auto", "true"]);
  });

  it("reports a pick and closes", async () => {
    const { user, onChange, onOpenChange } = setup();
    await user.click(screen.getByRole("button", { name: "Settings" }));

    await user.click(screen.getByRole("menuitemradio", { name: "720p" }));

    expect(onChange).toHaveBeenCalledWith({ ...PREFS, quality: "720p" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("works with the keyboard: Enter opens, arrows move, Escape goes back to the gear", async () => {
    const { user, onChange } = setup();

    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitemradio", { name: "Auto" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith({ ...PREFS, quality: "1080p" });
    expect(screen.getByRole("button", { name: "Settings" })).toHaveFocus();

    await user.keyboard("{Enter}{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toHaveFocus();
  });
});
