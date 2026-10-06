import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SharePrefs } from "../../media/preferences";
import type { StreamKind } from "../../types";
import { FULL_ROOM, NO_SOUND, PlayerButtons } from "./PlayerButtons";

const PREFS: Record<StreamKind, SharePrefs> = {
  screen: { quality: "1080p", mode: "smooth" },
  camera: { quality: "720p", mode: "smooth" },
};
const CAMERAS = [
  { deviceId: "cam-1", label: "Logitech C920" },
  { deviceId: "cam-2", label: "Integrated Webcam" },
];

function setup(props: Partial<Parameters<typeof PlayerButtons>[0]> = {}) {
  const handlers = {
    onStart: vi.fn(),
    onStop: vi.fn(),
    onPrefsChange: vi.fn(),
    onChangeWindow: vi.fn(),
    onPickCamera: vi.fn(),
    onMenuChange: vi.fn(),
  };
  const user = userEvent.setup();
  const view = render(
    <PlayerButtons
      mine={{ screen: false, camera: false }}
      free={6}
      prefs={PREFS}
      cameras={CAMERAS}
      camera="cam-1"
      canShareScreen
      {...handlers}
      {...props}
    />,
  );
  const rerender = (next: Partial<Parameters<typeof PlayerButtons>[0]>) =>
    view.rerender(
      <PlayerButtons
        mine={{ screen: false, camera: false }}
        free={6}
        prefs={PREFS}
        cameras={CAMERAS}
        camera="cam-1"
        canShareScreen
        {...handlers}
        {...props}
        {...next}
      />,
    );
  return { user, rerender, ...handlers };
}

afterEach(() => vi.restoreAllMocks());

describe("stream buttons: off and live", () => {
  it("shows a screen and a camera button, off, each saying what a click does", () => {
    setup();
    const share = screen.getByRole("button", { name: "Share your screen" });
    const camera = screen.getByRole("button", { name: "Turn on camera" });
    expect(share).toHaveAttribute("aria-pressed", "false");
    expect(camera).toHaveAttribute("aria-pressed", "false");
    expect(share).toHaveAccessibleDescription("Share your screen");
    expect(screen.queryByRole("button", { name: /options/i })).not.toBeInTheDocument();
  });

  it("lights a live stream's button, which stops it, and gives it an arrow", async () => {
    const { user, onStart, onStop } = setup({ mine: { screen: true, camera: false } });

    const stop = screen.getByRole("button", { name: "Stop sharing" });
    expect(stop).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Screen options" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Camera options" })).not.toBeInTheDocument();

    await user.click(stop);
    await user.click(screen.getByRole("button", { name: "Turn on camera" }));
    expect(onStop).toHaveBeenCalledWith("screen");
    expect(onStart).toHaveBeenCalledWith("camera");
  });

  it("names the camera's stop", () => {
    setup({ mine: { screen: false, camera: true } });
    expect(screen.getByRole("button", { name: "Turn off camera" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("player buttons: the row (spec 0101)", () => {
  it("puts the volume before my buttons and the settings after them", () => {
    setup({
      before: <button type="button">Volume</button>,
      after: <button type="button">Settings</button>,
    });
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([
      "Volume",
      "Share your screen",
      "Turn on camera",
      "Settings",
    ]);
  });
});

describe("stream buttons: the menus", () => {
  it("lists the screen's quality, mode, change window and stop", async () => {
    const { user, onPrefsChange, onChangeWindow, onStop, onMenuChange } = setup({
      mine: { screen: true, camera: false },
    });

    await user.click(screen.getByRole("button", { name: "Screen options" }));
    const menu = screen.getByRole("menu", { name: "Screen options" });
    expect(onMenuChange).toHaveBeenLastCalledWith(true);
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map((i) => i.textContent),
    ).toEqual(["1080p", "720p", "480p", "Smooth (games, videos)", "Sharp (text, code)"]);
    expect(within(menu).getByRole("menuitemradio", { name: "1080p" })).toHaveAttribute("aria-checked", "true");

    await user.click(within(menu).getByRole("menuitemradio", { name: "720p" }));
    expect(onPrefsChange).toHaveBeenLastCalledWith("screen", { quality: "720p", mode: "smooth" });
    await user.click(within(menu).getByRole("menuitemradio", { name: "Sharp (text, code)" }));
    expect(onPrefsChange).toHaveBeenLastCalledWith("screen", { quality: "1080p", mode: "sharp" });

    await user.click(within(menu).getByRole("menuitem", { name: "Change window" }));
    expect(onChangeWindow).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onMenuChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Screen options" }));
    await user.click(screen.getByRole("menuitem", { name: "Stop sharing" }));
    expect(onStop).toHaveBeenCalledWith("screen");
  });

  it("lists the camera's quality up to 720p, its mode, the cameras and turn off", async () => {
    const { user, onPickCamera, onStop } = setup({ mine: { screen: false, camera: true } });

    await user.click(screen.getByRole("button", { name: "Camera options" }));
    const menu = screen.getByRole("menu", { name: "Camera options" });
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map((i) => i.textContent),
    ).toEqual(["720p", "480p", "Smooth (games, videos)", "Sharp (text, code)", "Logitech C920", "Integrated Webcam"]);
    expect(within(menu).getByRole("menuitemradio", { name: "Logitech C920" })).toHaveAttribute("aria-checked", "true");

    await user.click(within(menu).getByRole("menuitemradio", { name: "Integrated Webcam" }));
    expect(onPickCamera).toHaveBeenCalledWith("cam-2");

    await user.click(within(menu).getByRole("menuitem", { name: "Turn off camera" }));
    expect(onStop).toHaveBeenCalledWith("camera");
  });

  it("names each set of choices for screen readers", async () => {
    const { user } = setup({ mine: { screen: false, camera: true } });
    await user.click(screen.getByRole("button", { name: "Camera options" }));

    const names = (group: string) =>
      within(screen.getByRole("group", { name: group }))
        .getAllByRole("menuitemradio")
        .map((i) => i.textContent);
    expect(names("Quality")).toEqual(["720p", "480p"]);
    expect(names("Mode")).toEqual(["Smooth (games, videos)", "Sharp (text, code)"]);
    expect(names("Camera")).toEqual(["Logitech C920", "Integrated Webcam"]);
  });

  it("doesn't reopen by itself when its stream stops and starts again", async () => {
    const { user, rerender } = setup({ mine: { screen: true, camera: false } });
    await user.click(screen.getByRole("button", { name: "Screen options" }));

    // Stopped from elsewhere (the browser's own bar), then started again.
    rerender({ mine: { screen: false, camera: false } });
    rerender({ mine: { screen: true, camera: false } });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on a click outside", async () => {
    const { user } = setup({ mine: { screen: true, camera: false } });
    await user.click(screen.getByRole("button", { name: "Screen options" }));

    await user.click(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("stream buttons: when they can't be used", () => {
  it("disables the off buttons of a full room, saying why, and keeps the live ones", async () => {
    const { user, onStart, onStop } = setup({ mine: { screen: true, camera: false }, free: 0 });

    const camera = screen.getByRole("button", { name: "Turn on camera" });
    expect(camera).toHaveAttribute("aria-disabled", "true");
    expect(camera).toHaveAccessibleDescription(FULL_ROOM);
    await user.click(camera);
    expect(onStart).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Stop sharing" }));
    expect(onStop).toHaveBeenCalledWith("screen");
  });

  it("waits while a request is on its way, in the menus too", async () => {
    const { user, onStart, onStop, onChangeWindow, onPrefsChange, onPickCamera } = setup({
      mine: { screen: true, camera: true },
      busy: true,
    });
    await user.click(screen.getByRole("button", { name: "Stop sharing" }));
    expect(onStop).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Screen options" }));
    for (const item of [
      screen.getByRole("menuitemradio", { name: "720p" }),
      screen.getByRole("menuitem", { name: "Change window" }),
      screen.getByRole("menuitem", { name: "Stop sharing" }),
    ]) {
      expect(item).toHaveAttribute("aria-disabled", "true");
      await user.click(item);
    }
    await user.click(screen.getByRole("button", { name: "Camera options" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Integrated Webcam" }));

    expect(onStart).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
    expect(onChangeWindow).not.toHaveBeenCalled();
    expect(onPrefsChange).not.toHaveBeenCalled();
    expect(onPickCamera).not.toHaveBeenCalled();
  });

  it("marks a screen shared without sound, and says how to share it", async () => {
    const { user } = setup({ mine: { screen: true, camera: false }, noSound: true });

    // No badge on the button (spec 0101): the tooltip and the menu say it.
    expect(screen.queryByRole("img", { name: "No sound" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop sharing" })).toHaveAccessibleDescription(
      `Stop sharing. ${NO_SOUND}`,
    );
    await user.click(screen.getByRole("button", { name: "Screen options" }));
    expect(within(screen.getByRole("menu")).getByText(NO_SOUND)).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Change window" })).toHaveAccessibleDescription(NO_SOUND);
  });

  it("has no screen button where the browser can't share a screen", () => {
    setup({ canShareScreen: false });
    expect(screen.queryByRole("button", { name: "Share your screen" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn on camera" })).toBeInTheDocument();
  });
});

describe("stream buttons: keyboard", () => {
  it("opens the menu on its first item, moves with the arrow keys and closes with Escape", async () => {
    const { user, onPrefsChange } = setup({ mine: { screen: true, camera: false } });

    await user.tab();
    expect(screen.getByRole("button", { name: "Stop sharing" })).toHaveFocus();
    await user.tab();
    const arrow = screen.getByRole("button", { name: "Screen options" });
    expect(arrow).toHaveFocus();
    expect(arrow).toHaveAttribute("aria-haspopup", "menu");

    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitemradio", { name: "1080p" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitemradio", { name: "720p" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Stop sharing" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onPrefsChange).toHaveBeenLastCalledWith("screen", { quality: "720p", mode: "smooth" });

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(arrow).toHaveFocus();
  });
});
