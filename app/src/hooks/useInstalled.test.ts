import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INSTALLED_QUERY, useInstalled } from "./useInstalled";

function displayMode(installed: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q === INSTALLED_QUERY && installed,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as { standalone?: boolean }).standalone;
});

describe("opened from the home screen or not (spec 0171)", () => {
  it("asks the browser for the home-screen display modes", () => {
    expect(INSTALLED_QUERY).toBe("(display-mode: fullscreen), (display-mode: standalone)");
  });

  it("is true from the home screen, false in a browser tab", () => {
    displayMode(true);
    expect(renderHook(() => useInstalled()).result.current).toBe(true);
    displayMode(false);
    expect(renderHook(() => useInstalled()).result.current).toBe(false);
  });

  it("knows an older iPhone's home-screen app by navigator.standalone", () => {
    displayMode(false);
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    expect(renderHook(() => useInstalled()).result.current).toBe(true);
  });
});
