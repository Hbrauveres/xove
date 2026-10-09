import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetPrompt, listenForInstall } from "../install/prompt";
import { InstallPage } from "./InstallPage";

const APPLE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36";

function on(userAgent: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
}
function offerPrompt() {
  listenForInstall();
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void> };
  event.prompt = vi.fn(async () => {});
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
  forgetPrompt();
});

describe("the install screen (spec 0171)", () => {
  it("says the same on every device, with an i that shows and hides why", async () => {
    on(ANDROID);
    render(<InstallPage />);
    expect(screen.getByRole("heading", { name: /Xovê works best from your home screen/ })).toBeInTheDocument();
    expect(screen.getByText("Start watching and sharing moments with your friends.")).toBeInTheDocument();
    expect(screen.getByText("Already added? Open Xovê from your home screen.")).toBeInTheDocument();
    const info = screen.getByRole("button", { name: "Why the home screen?" });
    expect(screen.queryByText(/no address bar or browser buttons/)).toBeNull();
    await userEvent.setup().click(info);
    expect(info).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Opened from your home screen, Xovê fills the whole screen/)).toBeInTheDocument();
    await userEvent.setup().click(info);
    expect(screen.queryByText(/no address bar or browser buttons/)).toBeNull();
  });

  it("on an iPhone or iPad, shows Safari's Share steps and no button", () => {
    on(APPLE);
    render(<InstallPage />);
    const steps = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(steps).toEqual(["Tap Share in Safari's bar", "Choose Add to Home Screen", "Open Xovê from your home screen"]);
    expect(screen.queryByRole("button", { name: /Get Xovê/ })).toBeNull();
  });

  it("on Android, Get Xovê opens the browser's install prompt", async () => {
    on(ANDROID);
    const prompt = offerPrompt();
    render(<InstallPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Get Xovê" }));
    expect(prompt.prompt).toHaveBeenCalled();
    expect(screen.getByText(/No prompt\? Open the menu/)).toBeInTheDocument();
  });

  it("without a prompt, Get Xovê points to the menu line instead", async () => {
    on(ANDROID);
    render(<InstallPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Get Xovê" }));
    expect(screen.getByText(/No prompt\? Open the menu/)).toHaveAttribute("data-highlight");
  });

  it("once installed, says to open it from the home screen", () => {
    on(ANDROID);
    offerPrompt();
    render(<InstallPage />);
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.getByText("Installed. Open Xovê from your home screen.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get Xovê" })).toBeNull();
  });
});
