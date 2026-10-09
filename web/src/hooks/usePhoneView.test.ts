import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PHONE_QUERY, usePhoneView } from "./usePhoneView";

/** A matchMedia that answers the phone query for a window of this size, and can be resized. */
function windowOf(width: number, height: number) {
  const listeners = new Set<() => void>();
  let size = { width, height };
  const matches = () => size.width <= 760 && size.height >= size.width;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === PHONE_QUERY && matches();
    },
    media: query,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }));
  return {
    resize(w: number, h: number) {
      size = { width: w, height: h };
      listeners.forEach((l) => l());
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("the phone view applies to a narrow, upright window (spec 0158)", () => {
  it("asks the browser for a window up to 760 px wide, held upright", () => {
    expect(PHONE_QUERY).toBe("(max-width: 760px) and (orientation: portrait)");
  });

  it("is on for a phone held upright and a narrow upright window", () => {
    windowOf(390, 844);
    expect(renderHook(() => usePhoneView()).result.current).toBe(true);
    windowOf(760, 1000);
    expect(renderHook(() => usePhoneView()).result.current).toBe(true);
  });

  it("is off for a wider window and a phone held sideways", () => {
    windowOf(800, 1000);
    expect(renderHook(() => usePhoneView()).result.current).toBe(false);
    windowOf(844, 390);
    expect(renderHook(() => usePhoneView()).result.current).toBe(false);
  });

  it("follows the window when it turns", () => {
    const win = windowOf(390, 844);
    const hook = renderHook(() => usePhoneView());
    expect(hook.result.current).toBe(true);
    act(() => win.resize(844, 390));
    expect(hook.result.current).toBe(false);
    act(() => win.resize(390, 844));
    expect(hook.result.current).toBe(true);
  });
});
