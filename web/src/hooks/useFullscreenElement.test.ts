import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFullscreenElement } from "./useFullscreenElement";

let fullscreen: Element | null = null;
Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreen });
afterEach(() => {
  fullscreen = null;
});

describe("the fullscreen element (specs 0101 and 0160)", () => {
  it("is the player when the player is fullscreen", () => {
    const hook = renderHook(() => useFullscreenElement());
    const player = document.createElement("div");
    fullscreen = player;
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(hook.result.current).toBe(player);
  });

  it("is none when the whole page is fullscreen: windows stay in the page", () => {
    const hook = renderHook(() => useFullscreenElement());
    fullscreen = document.documentElement;
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(hook.result.current).toBeNull();
  });
});
