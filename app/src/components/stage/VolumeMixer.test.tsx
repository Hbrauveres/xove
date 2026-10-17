import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearToast, currentToast } from "../ui/toast";
import { MIXER_IDLE_MS, NO_VOICE_YET, VolumeMixer, type Channel } from "./VolumeMixer";

/** The mixer with the screen's sound working and the voice greyed, as before #101. */
function Harness({ canSetVolume = true, onClose = vi.fn(), open = true }: { canSetVolume?: boolean; onClose?: () => void; open?: boolean }) {
  const [screenSound, setScreenSound] = useState({ volume: 0.6, muted: false });
  const channels: Channel[] = [
    { id: "screen", label: "Screen sound", ...screenSound, onChange: setScreenSound },
    { id: "voice", label: "Voice", volume: 0, muted: true, unavailable: NO_VOICE_YET },
  ];
  return <VolumeMixer channels={channels} canSetVolume={canSetVolume} open={open} onClose={onClose} />;
}

const mixer = () => screen.getByRole("group", { name: "Volume" });

describe("the volume mixer (spec 0108)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    act(() => clearToast());
  });

  it("has a column per sound: an upright bar and a round mute under it", () => {
    render(<Harness />);
    const bar = screen.getByRole("slider", { name: "Screen sound volume" });
    expect(bar).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByRole("button", { name: "Mute Screen sound" })).toHaveAttribute("aria-pressed", "false");
    // Both places are there from the start: the voice too, greyed.
    expect(mixer().querySelectorAll("[data-channel]")).toHaveLength(2);
  });

  it("sets the screen's volume, which also unmutes it", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Mute Screen sound" }));
    expect(screen.getByRole("button", { name: "Unmute Screen sound" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("slider", { name: "Screen sound volume" }), { target: { value: "0.3" } });
    expect(screen.getByRole("slider", { name: "Screen sound volume" })).toHaveValue("0.3");
    expect(screen.getByRole("button", { name: "Mute Screen sound" })).toBeInTheDocument();
    // Muting never closes it.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("draws the voice greyed in its place: its reason, nothing to grab, nothing changes", () => {
    render(<Harness />);
    const voice = mixer().querySelector('[data-channel="voice"]')!;
    expect(voice).toHaveAttribute("data-unavailable", "true");
    expect(voice).toHaveAttribute("title", NO_VOICE_YET);
    expect(screen.queryByRole("slider", { name: /Voice/ })).toBeNull();
    const button = screen.getByRole("button", { name: `Voice: ${NO_VOICE_YET}` });
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: `Voice: ${NO_VOICE_YET}` })).toBe(button);
  });

  it("says why by touch, in the toast; a mouse has the tooltip", () => {
    render(<Harness />);
    const button = screen.getByRole("button", { name: `Voice: ${NO_VOICE_YET}` });
    fireEvent.pointerDown(button, { pointerType: "mouse" });
    fireEvent.click(button);
    expect(currentToast()).toBeNull();
    fireEvent.pointerDown(button, { pointerType: "touch" });
    fireEvent.click(button);
    expect(currentToast()?.text).toBe(NO_VOICE_YET);
  });

  it("closes by itself after 4 s without a touch; a touch inside starts the count over", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    act(() => vi.advanceTimersByTime(MIXER_IDLE_MS - 1000));
    fireEvent.pointerDown(screen.getByRole("slider", { name: "Screen sound volume" }));
    act(() => vi.advanceTimersByTime(MIXER_IDLE_MS - 1));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closed, it can't be reached and counts nothing", () => {
    const onClose = vi.fn();
    render(<Harness open={false} onClose={onClose} />);
    expect(mixer().closest("[inert]")).not.toBeNull();
    act(() => vi.advanceTimersByTime(MIXER_IDLE_MS * 2));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("where the volume can't be set (iPhones): round on/off buttons, no bars, the voice greyed", () => {
    render(<Harness canSetVolume={false} />);
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    expect(mixer()).toHaveAttribute("data-pill", "true");
    const sound = screen.getByRole("button", { name: "Screen sound" });
    expect(sound).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(sound);
    expect(screen.getByRole("button", { name: "Screen sound" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: `Voice: ${NO_VOICE_YET}` })).toHaveAttribute("aria-disabled", "true");
  });
});
