import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { WatchPrefs } from "../../media/preferences";
import { VolumeButton } from "./VolumeButton";

/** The button with its own state, as the stage uses it. */
function Harness({
  initial = { quality: "auto", volume: 0.6, muted: false },
  hasSound = true,
  canSetVolume = true,
  onChange,
  onOpenChange,
}: {
  initial?: WatchPrefs;
  hasSound?: boolean;
  canSetVolume?: boolean;
  onChange?: (p: WatchPrefs) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [prefs, setPrefs] = useState<WatchPrefs>(initial);
  return (
    <VolumeButton
      prefs={prefs}
      hasSound={hasSound}
      canSetVolume={canSetVolume}
      onOpenChange={onOpenChange}
      onChange={(next) => {
        setPrefs(next);
        onChange?.(next);
      }}
    />
  );
}

const slider = () => screen.queryByRole("slider", { name: "Volume" });
const sliderShown = () => {
  const s = slider();
  return s !== null && !s.closest("[inert]");
};

describe("volume button (spec 0101)", () => {
  it("mutes and unmutes with a click, saying which it does", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    const button = screen.getByRole("button", { name: "Mute" });
    expect(button).toHaveAccessibleDescription("Mute");
    await user.click(button);
    expect(onChange).toHaveBeenLastCalledWith({ quality: "auto", volume: 0.6, muted: true });
    await user.click(screen.getByRole("button", { name: "Unmute" }));
    expect(onChange).toHaveBeenLastCalledWith({ quality: "auto", volume: 0.6, muted: false });
  });

  it("slides a vertical volume up while pointed at, and away after the pointer leaves", async () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} onOpenChange={onOpenChange} />);
    expect(sliderShown()).toBe(false);

    await user.hover(screen.getByRole("button", { name: "Mute" }));
    expect(sliderShown()).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(slider()).toHaveAttribute("aria-orientation", "vertical");
    expect(slider()).toHaveValue("0.6");

    fireEvent.change(slider()!, { target: { value: "0.3" } });
    expect(onChange).toHaveBeenLastCalledWith({ quality: "auto", volume: 0.3, muted: false });

    await user.unhover(screen.getByRole("button", { name: "Mute" }));
    await waitFor(() => expect(sliderShown()).toBe(false));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("opens on keyboard focus, and the slider is the next stop", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Mute" })).toHaveFocus();
    expect(sliderShown()).toBe(true);
    await user.tab();
    expect(slider()).toHaveFocus();
    await user.tab();
    expect(sliderShown()).toBe(false);
  });

  it("still slides away after a click, once the pointer leaves", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole("button", { name: "Mute" });

    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Unmute" }));
    expect(sliderShown()).toBe(true);
    await user.unhover(button);

    await waitFor(() => expect(sliderShown()).toBe(false));
  });

  it("lets the player go when it disappears while open", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const view = render(<Harness onOpenChange={onOpenChange} />);
    await user.hover(screen.getByRole("button", { name: "Mute" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    view.unmount();

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("has no slider while muted", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ quality: "auto", volume: 0.6, muted: true }} />);

    await user.hover(screen.getByRole("button", { name: "Unmute" }));

    expect(slider()).toBeNull();
  });

  it("has no slider where the page can't set the volume (iPhones), and still mutes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness canSetVolume={false} onChange={onChange} />);

    await user.hover(screen.getByRole("button", { name: "Mute" }));
    expect(slider()).toBeNull();
    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ muted: true }));
  });

  it("is crossed and disabled for a stream without sound, saying why, with no slider", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness hasSound={false} onChange={onChange} />);

    const button = screen.getByRole("button", { name: "No sound in this stream" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("No sound in this stream");
    await user.hover(button);
    await user.click(button);

    expect(onChange).not.toHaveBeenCalled();
    expect(slider()).toBeNull();
  });
});
