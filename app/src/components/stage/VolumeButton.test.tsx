import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearToast, currentToast } from "../ui/toast";
import { VolumeButton } from "./VolumeButton";
import { MIXER_IDLE_MS, NO_VOICE_YET, type Channel, type ChannelSound } from "./VolumeMixer";

/** The button with its own state, as the stage uses it: the screen's sound and the voice greyed. */
function Harness({
  initial = { volume: 0.6, muted: false },
  screenSound = true,
  canSetVolume = true,
  onOpenChange,
}: {
  initial?: ChannelSound;
  screenSound?: boolean;
  canSetVolume?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [sound, setSound] = useState(initial);
  const [open, setOpen] = useState(false);
  const channels: Channel[] = [
    { id: "screen", label: "Screen sound", ...sound, onChange: setSound, unavailable: screenSound ? undefined : "No sound in this stream" },
    { id: "voice", label: "Voice", volume: 0, muted: true, unavailable: NO_VOICE_YET },
  ];
  return (
    <VolumeButton
      channels={channels}
      canSetVolume={canSetVolume}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
    />
  );
}

const button = () => screen.getByRole("button", { name: /^Volume|No sound/ });
const mixerOpen = () => screen.queryByRole("group", { name: "Volume" })?.hasAttribute("data-open") ?? false;
const icon = () => button().querySelector("svg")!.getAttribute("data-icon");

describe("volume button (specs 0101 and 0108)", () => {
  afterEach(() => act(() => clearToast()));

  it("opens and closes the mixer with a click, and never mutes", () => {
    render(<Harness />);
    expect(button()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button());
    expect(mixerOpen()).toBe(true);
    expect(button()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Mute Screen sound" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button());
    expect(mixerOpen()).toBe(false);
    expect(icon()).toBe("volume");
  });

  it("opens by touch too, and a tap never mutes", () => {
    render(<Harness />);
    fireEvent.pointerDown(button(), { pointerType: "touch" });
    fireEvent.click(button());
    expect(mixerOpen()).toBe(true);
    expect(icon()).toBe("volume");
  });

  it("doesn't open on hover or on focus", () => {
    render(<Harness />);
    fireEvent.pointerEnter(button().parentElement!, { pointerType: "mouse" });
    fireEvent.focus(button());
    expect(mixerOpen()).toBe(false);
  });

  it("Escape closes it and gives the focus back to the button", () => {
    render(<Harness />);
    fireEvent.click(button());
    const bar = screen.getByRole("slider", { name: "Screen sound volume" });
    bar.focus();
    fireEvent.keyDown(bar, { key: "Escape" });
    expect(mixerOpen()).toBe(false);
    expect(button()).toHaveFocus();
  });

  it("closing by itself with the focus inside gives the focus back to the button", () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(button());
    screen.getByRole("slider", { name: "Screen sound volume" }).focus();
    act(() => vi.advanceTimersByTime(MIXER_IDLE_MS));
    expect(mixerOpen()).toBe(false);
    expect(button()).toHaveFocus();
    vi.useRealTimers();
  });

  it("Escape closes it wherever the focus is", () => {
    render(<Harness />);
    fireEvent.click(button());
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(mixerOpen()).toBe(false);
  });

  it("a press outside closes it; a press inside doesn't", () => {
    render(
      <>
        <button>elsewhere</button>
        <Harness />
      </>,
    );
    fireEvent.click(button());
    fireEvent.pointerDown(screen.getByRole("slider", { name: "Screen sound volume" }));
    expect(mixerOpen()).toBe(true);
    fireEvent.pointerDown(screen.getByRole("button", { name: "elsewhere" }));
    expect(mixerOpen()).toBe(false);
  });

  it("is crossed when every sound you can hear is muted: the greyed voice doesn't count", () => {
    render(<Harness />);
    fireEvent.click(button());
    fireEvent.click(screen.getByRole("button", { name: "Mute Screen sound" }));
    expect(icon()).toBe("volume-off");
    expect(button()).toHaveAccessibleName("Volume, all muted");
    // Still open: muting never closes it.
    expect(mixerOpen()).toBe(true);
  });

  it("is crossed at zero volume too", () => {
    render(<Harness initial={{ volume: 0, muted: false }} />);
    expect(icon()).toBe("volume-off");
  });

  it("is crossed and locked when there's nothing to hear, saying why, by touch in the toast", () => {
    render(<Harness screenSound={false} />);
    expect(button()).toHaveAccessibleName("No sound in this stream");
    expect(button()).toHaveAttribute("aria-disabled", "true");
    expect(icon()).toBe("volume-off");
    fireEvent.pointerDown(button(), { pointerType: "touch" });
    fireEvent.click(button());
    expect(mixerOpen()).toBe(false);
    expect(currentToast()?.text).toBe("No sound in this stream");
  });

  it("tells the stage when it opens and closes, so the player stays shown", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.click(button());
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(button());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("opens the pill of round on/off buttons where the volume can't be set (iPhones)", () => {
    render(<Harness canSetVolume={false} />);
    fireEvent.click(button());
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Mute Screen sound" }));
    expect(icon()).toBe("volume-off");
  });
});
