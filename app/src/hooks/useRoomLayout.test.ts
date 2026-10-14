import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NARROW_UPRIGHT_QUERY, PORTRAIT_QUERY, SMALL_QUERY, TOUCH_QUERY, layoutFor, useRoomLayout } from "./useRoomLayout";

describe("which layout the room uses (specs 0158 and 0160)", () => {
  const phone = { touch: true, small: true };
  const tablet = { touch: true, small: false };
  const desktop = { touch: false, small: false };

  it("gives a phone a phone view, upright or sideways", () => {
    expect(layoutFor({ ...phone, portrait: true, narrowUpright: true })).toBe("upright");
    expect(layoutFor({ ...phone, portrait: false, narrowUpright: false })).toBe("sideways");
  });

  it("gives a tablet the upright view held upright, the desktop layout sideways", () => {
    expect(layoutFor({ ...tablet, portrait: true, narrowUpright: false })).toBe("upright");
    expect(layoutFor({ ...tablet, portrait: false, narrowUpright: false })).toBe("desktop");
  });

  it("keeps a desktop on today's rule: narrow and upright is the upright view", () => {
    expect(layoutFor({ ...desktop, portrait: true, narrowUpright: true })).toBe("upright");
    expect(layoutFor({ ...desktop, portrait: true, narrowUpright: false })).toBe("desktop");
    expect(layoutFor({ ...desktop, portrait: false, narrowUpright: false })).toBe("desktop");
  });

  it("asks the browser the right questions", () => {
    expect(TOUCH_QUERY).toBe("(pointer: coarse)");
    expect(SMALL_QUERY).toBe("(max-width: 500px), (max-height: 500px)");
    expect(PORTRAIT_QUERY).toBe("(orientation: portrait)");
    expect(NARROW_UPRIGHT_QUERY).toBe("(max-width: 760px) and (orientation: portrait)");
  });
});

/** A screen of this size, touch-first or not, that can turn. */
function screenOf(width: number, height: number, touch: boolean) {
  const listeners = new Set<() => void>();
  let size = { width, height };
  const answers = (q: string) => {
    const { width: w, height: h } = size;
    if (q === TOUCH_QUERY) return touch;
    if (q === SMALL_QUERY) return w <= 500 || h <= 500;
    if (q === PORTRAIT_QUERY) return h >= w;
    if (q === NARROW_UPRIGHT_QUERY) return w <= 760 && h >= w;
    return false;
  };
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return answers(query);
    },
    media: query,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }));
  return {
    turn() {
      size = { width: size.height, height: size.width };
      listeners.forEach((l) => l());
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("the room's layout follows the screen (spec 0160)", () => {
  it("phone 412 × 915 upright, then sideways at 915 × 412", () => {
    const s = screenOf(412, 915, true);
    const hook = renderHook(() => useRoomLayout());
    expect(hook.result.current).toBe("upright");
    act(() => s.turn());
    expect(hook.result.current).toBe("sideways");
  });

  it("a desktop window: upright at 412 × 915, the desktop layout at 915 × 412", () => {
    const s = screenOf(412, 915, false);
    const hook = renderHook(() => useRoomLayout());
    expect(hook.result.current).toBe("upright");
    act(() => s.turn());
    expect(hook.result.current).toBe("desktop");
  });

  it("a tablet: upright at 820 × 1180, the desktop layout at 1180 × 820", () => {
    const s = screenOf(820, 1180, true);
    const hook = renderHook(() => useRoomLayout());
    expect(hook.result.current).toBe("upright");
    act(() => s.turn());
    expect(hook.result.current).toBe("desktop");
  });
});
