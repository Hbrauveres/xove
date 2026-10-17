import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOLD_MS, OPEN_DELAY_MS } from "../ui/DropUp";
import { FULL_ROOM, NO_SCREEN, NO_SOUND, PlayerButtons } from "./PlayerButtons";

const CAMERAS = [
  { deviceId: "cam-1", label: "Logitech C920" },
  { deviceId: "cam-2", label: "Integrated Webcam" },
];

/** A mouse that can rest on things: the drop-ups exist only then. */
function withMouse() {
  const real = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) =>
    q.includes("hover: hover") ? ({ ...real(q), matches: true, media: q } as MediaQueryList) : real(q),
  );
}

function setup(props: Partial<Parameters<typeof PlayerButtons>[0]> = {}) {
  const handlers = {
    onStart: vi.fn(),
    onStop: vi.fn(),
    onChangeWindow: vi.fn(),
    onPickCamera: vi.fn(),
    onMenuChange: vi.fn(),
    onSettings: vi.fn(),
  };
  const user = userEvent.setup();
  const base = {
    mine: { screen: false, camera: false },
    free: 6,
    cameras: CAMERAS,
    camera: "cam-1",
    canShareScreen: true,
    settingsOpen: false,
    ...handlers,
    ...props,
  };
  const view = render(<PlayerButtons {...base} />);
  const rerender = (next: Partial<Parameters<typeof PlayerButtons>[0]>) => view.rerender(<PlayerButtons {...base} {...next} />);
  return { user, rerender, ...handlers };
}

/** Rests the pointer on a button long enough for its drop-up to unroll. */
function rest(button: HTMLElement) {
  vi.useFakeTimers();
  fireEvent.pointerEnter(button.closest("[data-dropup]")!);
  act(() => vi.advanceTimersByTime(OPEN_DELAY_MS));
  vi.useRealTimers();
}
const dropUp = (button: HTMLElement) => button.closest("[data-dropup]") as HTMLElement | null;

afterEach(() => vi.restoreAllMocks());

describe("stream buttons: off and live", () => {
  it("shows a screen and a camera button, off, each saying what a click does", () => {
    setup();
    const share = screen.getByRole("button", { name: "Share your screen" });
    const camera = screen.getByRole("button", { name: "Turn on your camera" });
    expect(share).toHaveAttribute("aria-pressed", "false");
    expect(camera).toHaveAttribute("aria-pressed", "false");
    expect(share).toHaveAccessibleDescription("Share your screen");
  });

  it("lights a live stream's button, which stops it, with no arrow (spec 0107)", async () => {
    const { user, onStart, onStop } = setup({ mine: { screen: true, camera: false } });

    const stop = screen.getByRole("button", { name: "Stop sharing your screen" });
    expect(stop).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /options/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(stop);
    await user.click(screen.getByRole("button", { name: "Turn on your camera" }));
    expect(onStop).toHaveBeenCalledWith("screen");
    expect(onStart).toHaveBeenCalledWith("camera");
  });

  it("names the camera's stop", () => {
    setup({ mine: { screen: false, camera: true } });
    expect(screen.getByRole("button", { name: "Turn off your camera" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("player buttons: the row (specs 0101 and 0107)", () => {
  it("puts the volume before my buttons, and the cog last", () => {
    setup({ before: <button type="button">Volume</button> });
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([
      "Volume",
      "Share your screen",
      "Turn on your camera",
      "Settings",
    ]);
  });

  it("always has the cog, also with nobody live, and it opens and closes the settings", async () => {
    const { user, onSettings, rerender } = setup();
    const cog = screen.getByRole("button", { name: "Settings" });
    expect(cog).toHaveAttribute("aria-expanded", "false");
    expect(cog.querySelector('svg[data-icon="cog"]')).toBeInTheDocument();
    await user.click(cog);
    expect(onSettings).toHaveBeenCalledOnce();
    rerender({ settingsOpen: true });
    expect(screen.getByRole("button", { name: "Settings" })).toHaveAttribute("aria-expanded", "true");
  });
});

describe("stream buttons: the drop-ups (spec 0107)", () => {
  it("are there only while the stream is live", () => {
    withMouse();
    const { rerender } = setup();
    expect(dropUp(screen.getByRole("button", { name: "Share your screen" }))).toBeNull();
    rerender({ mine: { screen: true, camera: true } });
    expect(dropUp(screen.getByRole("button", { name: "Stop sharing your screen" }))).not.toBeNull();
    expect(dropUp(screen.getByRole("button", { name: "Turn off your camera" }))).not.toBeNull();
  });

  it("open by touch with a press and hold, and close once a camera is picked", async () => {
    vi.useFakeTimers();
    const { onPickCamera, onStop } = setup({ mine: { screen: false, camera: true } });
    const stop = screen.getByRole("button", { name: "Turn off your camera" });
    const touch = { pointerType: "touch", clientX: 5, clientY: 5 };
    fireEvent.pointerDown(stop, touch);
    act(() => vi.advanceTimersByTime(HOLD_MS));
    fireEvent.pointerUp(stop, touch);
    fireEvent.click(stop);
    expect(onStop).not.toHaveBeenCalled();
    expect(dropUp(stop)).toHaveAttribute("data-open", "true");
    expect(dropUp(stop)).toHaveAttribute("data-touch");
    vi.useRealTimers();
    const quick = within(dropUp(stop)!).getByRole("group", { name: "Your camera" });
    fireEvent.click(within(quick).getByRole("button", { name: "Camera: Logitech C920" }));
    fireEvent.click(within(quick).getByRole("radio", { name: "Integrated Webcam" }));
    expect(onPickCamera).toHaveBeenCalledWith("cam-2");
    expect(dropUp(stop)).toHaveAttribute("data-open", "false");
  });

  it("the screen's: what's shared, and Change", async () => {
    withMouse();
    const { user, onChangeWindow, onStop } = setup({ mine: { screen: true, camera: false }, screenSurface: "browser" });
    const stop = screen.getByRole("button", { name: "Stop sharing your screen" });
    rest(stop);
    const quick = within(dropUp(stop)!).getByRole("group", { name: "What you share" });
    expect(within(quick).getByText("A tab")).toBeInTheDocument();
    await user.click(within(quick).getByRole("button", { name: "Change" }));
    expect(onChangeWindow).toHaveBeenCalledOnce();
    // The button itself still stops it.
    await user.click(stop);
    expect(onStop).toHaveBeenCalledWith("screen");
  });

  it("the camera's: its picker, opening upward in glass, switches the camera", async () => {
    withMouse();
    const { user, onPickCamera, onMenuChange } = setup({ mine: { screen: false, camera: true } });
    const stop = screen.getByRole("button", { name: "Turn off your camera" });
    rest(stop);
    const quick = within(dropUp(stop)!).getByRole("group", { name: "Your camera" });
    const pill = within(quick).getByRole("button", { name: "Camera: Logitech C920" });
    expect(pill.closest("[data-picker]")).toHaveAttribute("data-opens", "up");
    expect(pill.closest("[data-picker]")).toHaveAttribute("data-look", "glass");
    await user.click(pill);
    expect(onMenuChange).toHaveBeenLastCalledWith(true);
    await user.click(within(quick).getByRole("radio", { name: "Integrated Webcam" }));
    expect(onPickCamera).toHaveBeenCalledWith("cam-2");
  });
});

describe("stream buttons: when they can't be used", () => {
  it("disables the off buttons of a full room, saying why, and keeps the live ones", async () => {
    const { user, onStart, onStop } = setup({ mine: { screen: true, camera: false }, free: 0 });

    const camera = screen.getByRole("button", { name: "Turn on your camera" });
    expect(camera).toHaveAttribute("aria-disabled", "true");
    expect(camera).toHaveAccessibleDescription(FULL_ROOM);
    await user.click(camera);
    expect(onStart).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Stop sharing your screen" }));
    expect(onStop).toHaveBeenCalledWith("screen");
  });

  it("draws an unavailable button faded, with its crossed icon only", () => {
    setup({ free: 0 });

    for (const [name, icon] of [["Turn on your camera", "camera-off"], ["Share your screen", "screen-off"]]) {
      const button = screen.getByRole("button", { name });
      expect(button.parentElement?.className).toMatch(/disabled/);
      expect(button.querySelector(`svg[data-icon="${icon}"]`)).toBeInTheDocument();
      expect(button.querySelector('svg[data-icon$="-on"]')).not.toBeInTheDocument();
    }
  });

  it("waits while a request is on its way, in the drop-ups too", async () => {
    withMouse();
    const { user, onStop, onChangeWindow } = setup({ mine: { screen: true, camera: true }, busy: true });
    const stop = screen.getByRole("button", { name: "Stop sharing your screen" });
    await user.click(stop);
    expect(onStop).not.toHaveBeenCalled();
    rest(stop);
    expect(within(dropUp(stop)!).getByRole("button", { name: "Change" })).toBeDisabled();
    expect(within(dropUp(screen.getByRole("button", { name: "Turn off your camera" }))!).getByRole("button", { name: /^Camera:/ })).toBeDisabled();
    expect(onChangeWindow).not.toHaveBeenCalled();
  });

  it("says when a screen is shared without sound, and how to share it", () => {
    setup({ mine: { screen: true, camera: false }, noSound: true });

    // No badge on the button (spec 0101): its description says it.
    expect(screen.queryByRole("img", { name: "No sound" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop sharing your screen" })).toHaveAccessibleDescription(
      `Stop sharing your screen. ${NO_SOUND}`,
    );
  });

  it("greys out the screen button where the browser can't share a screen, saying why (a phone)", async () => {
    const { user, onStart } = setup({ canShareScreen: false });
    const share = screen.getByRole("button", { name: "Share your screen" });
    expect(share).toHaveAttribute("aria-disabled", "true");
    expect(share).toHaveAccessibleDescription(NO_SCREEN);
    expect(share.parentElement?.className).toMatch(/disabled/);
    await user.click(share);
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Turn on your camera" })).not.toHaveAttribute("aria-disabled");
  });
});

describe("icons: one state system (spec 0106)", () => {
  const icon = (button: HTMLElement) => [...button.querySelectorAll("svg[data-icon]")].map((s) => s.getAttribute("data-icon"));

  it("shows a crossed monitor while not sharing, with the share icon for hover and focus", () => {
    setup();

    const share = screen.getByRole("button", { name: "Share your screen" });

    expect(icon(share)).toEqual(["screen-off", "screen-share"]);
  });

  it("shows the plain monitor while sharing, and says it stops sharing your screen", () => {
    setup({ mine: { screen: true, camera: false } });

    const stop = screen.getByRole("button", { name: "Stop sharing your screen" });

    expect(icon(stop)).toEqual(["screen-on"]);
  });

  it("crosses the camera while it's off, and shows it plain while it's on", () => {
    const { rerender } = setup();
    expect(icon(screen.getByRole("button", { name: "Turn on your camera" }))).toEqual(["camera-off"]);

    rerender({ mine: { screen: false, camera: true } });

    expect(icon(screen.getByRole("button", { name: "Turn off your camera" }))).toEqual(["camera-on"]);
  });
});

