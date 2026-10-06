import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WIDESCREEN, useVideoShape } from "./useVideoShape";

/** A <video> whose picture size the test sets, as the browser would. */
function videoOf(width: number, height: number) {
  const el = document.createElement("video");
  const size = { width, height };
  Object.defineProperty(el, "videoWidth", { get: () => size.width });
  Object.defineProperty(el, "videoHeight", { get: () => size.height });
  const resize = (w: number, h: number) => {
    size.width = w;
    size.height = h;
    el.dispatchEvent(new Event("resize"));
  };
  return { el, resize };
}

describe("useVideoShape", () => {
  it("is 16:9 without a video", () => {
    const { result } = renderHook(() => useVideoShape(null));
    expect(result.current).toBe(WIDESCREEN);
  });

  it("is 16:9 until the picture's size is known", () => {
    const { el } = videoOf(0, 0);
    const { result } = renderHook(() => useVideoShape(el));
    expect(result.current).toBe(WIDESCREEN);
  });

  it("takes the picture's own shape", () => {
    const { el } = videoOf(1080, 1920);
    const { result } = renderHook(() => useVideoShape(el));
    expect(result.current).toBeCloseTo(0.5625);
  });

  it("follows a resize", () => {
    const { el, resize } = videoOf(1920, 1080);
    const { result } = renderHook(() => useVideoShape(el));
    act(() => resize(1840, 1000));
    expect(result.current).toBeCloseTo(1.84);
  });

  it("ignores a change under 1%", () => {
    const { el, resize } = videoOf(1920, 1080);
    const { result } = renderHook(() => useVideoShape(el));
    act(() => resize(1918, 1080));
    expect(result.current).toBeCloseTo(16 / 9);
  });

  it("goes back to 16:9 when the video goes", () => {
    const { el } = videoOf(1080, 1920);
    const { result, rerender } = renderHook(({ v }) => useVideoShape(v), {
      initialProps: { v: el as HTMLVideoElement | null },
    });
    rerender({ v: null });
    expect(result.current).toBe(WIDESCREEN);
  });
});
