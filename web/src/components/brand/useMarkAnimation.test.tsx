import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOTAL_MS } from "../../brand/markTimeline";
import { XoveMark } from "./XoveMark";

let reduced = false;
beforeEach(() => {
  reduced = false;
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "setTimeout"] });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") && reduced, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const mark = () => screen.getByRole("img", { name: "Xovê" });
const side = (at: string) => mark().querySelector(`[data-side="${at}"]`)!;
const dot = () => mark().querySelector("[data-dot]")!;
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("the wordmark's hover animation (spec 0111, FR-4a)", () => {
  it("slides the corners in, blinks the dot, and comes back to rest", () => {
    render(<XoveMark height={26} />);
    fireEvent.pointerEnter(mark());

    advance(300);
    expect(side("top-left").getAttribute("transform")).toMatch(/translate\([1-9]/);
    expect(side("top-right").getAttribute("transform")).toMatch(/translate\(-[1-9]/);

    // Somewhere in the blinks the dot is squashed nearly shut.
    let shut = false;
    for (let t = 0; t < 1000 && !shut; t += 16) {
      advance(16);
      shut = /scale\([\d.]+,0\.[0-2]/.test(dot().getAttribute("transform") ?? "");
    }
    expect(shut).toBe(true);

    advance(TOTAL_MS);
    expect(side("top-left").getAttribute("transform")).toBe("translate(0,0)");
    expect(dot().getAttribute("transform")).toBeNull();
  });

  it("plays from the keyboard's focus too", () => {
    render(<XoveMark height={26} />);
    expect(mark()).toHaveAttribute("tabindex", "0");
    fireEvent.focus(mark());
    advance(300);
    expect(side("top-left").getAttribute("transform")).toMatch(/translate\([1-9]/);
  });

  it("doesn't restart while it plays", () => {
    render(<XoveMark height={26} />);
    fireEvent.pointerEnter(mark());
    advance(500);
    const before = side("top-left").getAttribute("transform");
    fireEvent.pointerLeave(mark());
    fireEvent.pointerEnter(mark());
    advance(16);
    // Still moving forward from where it was, not back at the start.
    const now = Number(/translate\(([\d.]+)/.exec(side("top-left").getAttribute("transform")!)![1]);
    expect(now).toBeGreaterThanOrEqual(Number(/translate\(([\d.]+)/.exec(before!)![1]));
  });

  it("doesn't play with reduced motion", () => {
    reduced = true;
    render(<XoveMark height={26} />);
    fireEvent.pointerEnter(mark());
    advance(500);
    expect(side("top-left").getAttribute("transform")).toBeNull();
  });
});
