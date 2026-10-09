import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePageFullscreen } from "./usePageFullscreen";

let fullscreen: Element | null = null;
const request = vi.fn(async () => {
  fullscreen = document.documentElement;
});

beforeEach(() => {
  fullscreen = null;
  request.mockClear();
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreen });
  document.documentElement.requestFullscreen = request as unknown as typeof document.documentElement.requestFullscreen;
});
afterEach(() => {
  // @ts-expect-error back to jsdom's own
  delete document.fullscreenElement;
});

/** A tap: browsers allow fullscreen when the finger lifts, not when it touches down. */
const tap = () => document.dispatchEvent(new Event("pointerup"));
const touchDown = () => document.dispatchEvent(new Event("pointerdown"));

describe("the whole page fullscreen on a phone or tablet (spec 0160)", () => {
  it("asks when the first tap lifts, once", () => {
    renderHook(() => usePageFullscreen(true, "upright"));
    touchDown();
    expect(request).not.toHaveBeenCalled();
    tap();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
    fullscreen = null; // they left it themselves
    tap();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("asks again after the next turn if it was left, and keeps it through a turn", () => {
    const hook = renderHook(({ turn }) => usePageFullscreen(true, turn), { initialProps: { turn: "upright" } });
    tap();
    expect(request).toHaveBeenCalledTimes(1);
    // Still fullscreen after turning: nothing to ask.
    hook.rerender({ turn: "sideways" });
    tap();
    expect(request).toHaveBeenCalledTimes(1);
    // Left it, then turned: the next tap asks again.
    fullscreen = null;
    hook.rerender({ turn: "upright" });
    tap();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("never asks on a desktop, or where the browser has no fullscreen", () => {
    renderHook(() => usePageFullscreen(false, "upright"));
    tap();
    expect(request).not.toHaveBeenCalled();
    // @ts-expect-error a browser without it (iPhone Safari)
    document.documentElement.requestFullscreen = undefined;
    renderHook(() => usePageFullscreen(true, "sideways"));
    expect(() => tap()).not.toThrow();
  });
});
