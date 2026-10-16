import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SharePrefs } from "../../media/preferences";
import type { StreamKind } from "../../types";
import { SettingsPanel } from "./SettingsPanel";

const PREFS: Record<StreamKind, SharePrefs> = {
  screen: { quality: "1080p", mode: "smooth" },
  camera: { quality: "720p", mode: "smooth" },
};
const CAMERAS = [
  { deviceId: "cam-1", label: "Logitech C920" },
  { deviceId: "cam-2", label: "Integrated Webcam" },
];
const track = () => ({ attach: vi.fn((el: HTMLMediaElement) => el), detach: vi.fn((el: HTMLMediaElement) => el) });

function setup(props: Partial<Parameters<typeof SettingsPanel>[0]> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onPrefsChange: vi.fn(),
    onChangeWindow: vi.fn(),
    onPickCamera: vi.fn(),
    onPreviewCamera: vi.fn(),
  };
  const user = userEvent.setup();
  const all = {
    variant: "drawer" as const,
    open: true,
    screenTab: true,
    mine: { screen: false, camera: false },
    prefs: PREFS,
    cameras: CAMERAS,
    cameraId: "cam-1",
    ...handlers,
    ...props,
  };
  const view = render(<SettingsPanel {...all} />);
  return { user, ...handlers, rerender: (next: Partial<typeof all>) => view.rerender(<SettingsPanel {...all} {...next} />) };
}

const panel = () => screen.getByRole("dialog", { name: "Settings" });

describe("the settings panel: tabs", () => {
  it("opens on Screen, with Screen and Camera tabs and a red marker under the chosen one", () => {
    setup();
    const tabs = within(panel()).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Screen", "Camera"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(within(panel()).getByRole("tablist").style.getPropertyValue("--i")).toBe("0");
  });

  it("has only Camera where a screen can't be shared (a phone)", () => {
    setup({ screenTab: false });
    expect(within(panel()).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Camera"]);
    expect(within(panel()).getByRole("tabpanel", { name: "Camera" })).toBeInTheDocument();
  });

  it("marks with a red dot the tab of what I'm sending", () => {
    setup({ mine: { screen: false, camera: true }, cameraVideo: track() });
    expect(within(panel()).getByRole("tab", { name: /Camera/ }).querySelector("[data-live]")).not.toBeNull();
    expect(within(panel()).getByRole("tab", { name: /Screen/ }).querySelector("[data-live]")).toBeNull();
  });

  it("closes from its ✕ and with Escape", async () => {
    const { user, onClose } = setup();
    await user.click(within(panel()).getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("is drawn as a drawer or a sheet, and leaves once closed", async () => {
    const { rerender } = setup({ variant: "sheet" });
    expect(panel()).toHaveAttribute("data-variant", "sheet");
    rerender({ open: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("the settings panel: the Screen tab", () => {
  it("while not sharing: no preview, a line saying these are used next time, quality and mode", () => {
    setup();
    const tab = within(panel()).getByRole("tabpanel", { name: "Screen" });
    expect(tab.querySelector("video")).toBeNull();
    expect(within(tab).getByText(/You're not sharing\. These are used the next time you do/)).toBeInTheDocument();
    expect(within(tab).getByRole("radiogroup", { name: "Screen quality" })).toBeInTheDocument();
    expect(within(tab).getAllByRole("radio").map((r) => r.textContent)).toEqual(["1080p", "720p", "480p", "Smooth", "Sharp"]);
    expect(within(tab).queryByRole("button", { name: /change/i })).not.toBeInTheDocument();
  });

  it("while sharing: what's shared with Change, and no preview", async () => {
    const { user, onChangeWindow } = setup({ mine: { screen: true, camera: false }, screenSurface: "window" });
    const tab = within(panel()).getByRole("tabpanel", { name: "Screen" });
    expect(tab.querySelector("video")).toBeNull();
    expect(within(tab).getByText("A window")).toBeInTheDocument();
    await user.click(within(tab).getByRole("button", { name: "Change" }));
    expect(onChangeWindow).toHaveBeenCalledOnce();
  });

  it("changes the quality and the mode, with the modes' tooltips", async () => {
    const { user, onPrefsChange } = setup();
    const tab = within(panel()).getByRole("tabpanel", { name: "Screen" });
    await user.click(within(tab).getByRole("radio", { name: "720p" }));
    expect(onPrefsChange).toHaveBeenLastCalledWith("screen", { quality: "720p", mode: "smooth" });
    const sharp = within(tab).getByRole("radio", { name: "Sharp" });
    expect(sharp).toHaveAttribute("title", "Keeps detail sharp when the connection is tight: text, code");
    await user.click(sharp);
    expect(onPrefsChange).toHaveBeenLastCalledWith("screen", { quality: "1080p", mode: "sharp" });
  });
});

describe("the settings panel: the Camera tab", () => {
  it("turns the camera on for the preview only while the tab is open, and off when it closes", async () => {
    const { user, onPreviewCamera, rerender } = setup();
    expect(onPreviewCamera).not.toHaveBeenCalled();
    await user.click(within(panel()).getByRole("tab", { name: /Camera/ }));
    expect(onPreviewCamera).toHaveBeenLastCalledWith(true);
    await user.click(within(panel()).getByRole("tab", { name: /Screen/ }));
    expect(onPreviewCamera).toHaveBeenLastCalledWith(false);
    await user.click(within(panel()).getByRole("tab", { name: /Camera/ }));
    rerender({ open: false });
    expect(onPreviewCamera).toHaveBeenLastCalledWith(false);
  });

  it("shows the preview as only mine while off, and LIVE while sent; no preview capture while live", async () => {
    const preview = track();
    const { user, onPreviewCamera, rerender } = setup({ cameraVideo: preview });
    await user.click(within(panel()).getByRole("tab", { name: /Camera/ }));
    const tab = within(panel()).getByRole("tabpanel", { name: "Camera" });
    expect(preview.attach).toHaveBeenCalled();
    expect(within(tab).getByText("Only you see this")).toBeInTheDocument();
    onPreviewCamera.mockClear();
    rerender({ mine: { screen: false, camera: true } });
    expect(within(tab).getByText("LIVE")).toBeInTheDocument();
    expect(onPreviewCamera).toHaveBeenLastCalledWith(false);
  });

  it("picks another camera from its picker, opened in place", async () => {
    const { user, onPickCamera } = setup({ screenTab: false });
    await user.click(within(panel()).getByRole("button", { name: "Camera: Logitech C920" }));
    expect(within(panel()).getByRole("button", { name: "Camera: Logitech C920" }).closest("[data-picker]")).toHaveAttribute("data-opens", "in-place");
    await user.click(within(panel()).getByRole("radio", { name: "Integrated Webcam" }));
    expect(onPickCamera).toHaveBeenCalledWith("cam-2");
  });

  it("offers 720p and 480p, and the modes", async () => {
    const { user, onPrefsChange } = setup({ screenTab: false });
    const tab = within(panel()).getByRole("tabpanel", { name: "Camera" });
    expect(within(within(tab).getByRole("radiogroup", { name: "Camera quality" })).getAllByRole("radio").map((r) => r.textContent)).toEqual(["720p", "480p"]);
    await user.click(within(tab).getByRole("radio", { name: "480p" }));
    expect(onPrefsChange).toHaveBeenLastCalledWith("camera", { quality: "480p", mode: "smooth" });
  });
});

describe("the settings panel: leaving", () => {
  it("stops the preview when it unmounts", () => {
    const onPreviewCamera = vi.fn();
    const view = render(
      <SettingsPanel variant="drawer" open screenTab={false} mine={{ screen: false, camera: false }} prefs={PREFS} cameras={CAMERAS} cameraId="cam-1"
        onClose={() => {}} onPrefsChange={() => {}} onChangeWindow={() => {}} onPickCamera={() => {}} onPreviewCamera={onPreviewCamera} />,
    );
    expect(onPreviewCamera).toHaveBeenLastCalledWith(true);
    act(() => view.unmount());
    expect(onPreviewCamera).toHaveBeenLastCalledWith(false);
  });
});
