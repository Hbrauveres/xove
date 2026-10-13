import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SLIDE_MS, swipeOutcome, useStageSwipe } from "./useStageSwipe";

const W = 400;

describe("what a drag on the stage means (spec 0159)", () => {
  it("steps to the next person on a long enough drag left, the previous on a drag right", () => {
    expect(swipeOutcome(-100, 0, 600, W)).toBe(1);
    expect(swipeOutcome(120, 10, 600, W)).toBe(-1);
  });

  it("steps on a quick flick even when it's short", () => {
    expect(swipeOutcome(-40, 0, 60, W)).toBe(1);
  });

  it("does nothing for a short or slow drag", () => {
    expect(swipeOutcome(-60, 0, 600, W)).toBe(0);
    expect(swipeOutcome(-20, 0, 20, W)).toBe(0);
  });

  it("does nothing for a mostly up-and-down drag", () => {
    expect(swipeOutcome(-120, 150, 300, W)).toBe(0);
  });
});

// ---- the gesture ----

function Harness({ onStep, enabled = true }: { onStep: (d: 1 | -1) => void; enabled?: boolean }) {
  const slide = useRef<HTMLDivElement>(null);
  const handlers = useStageSwipe(slide, { enabled, onStep });
  return (
    <div data-testid="frame" {...handlers}>
      <div data-testid="slide" ref={slide} />
      <div data-no-swipe>
        <button type="button">Volume</button>
      </div>
    </div>
  );
}

const reduced = (on: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: on && q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: W, height: 225 } as DOMRect);
  reduced(false);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function drag(el: Element, dx: number, dy = 0, ms = 400) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 200, clientY: 100, button: 0 });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: 200 + dx / 2, clientY: 100 + dy / 2 });
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: 200 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: 200 + dx, clientY: 100 + dy });
}

describe("the stage's swipe gesture (spec 0159)", () => {
  it("follows the finger while dragging", () => {
    render(<Harness onStep={vi.fn()} />);
    fireEvent.pointerDown(screen.getByTestId("frame"), { pointerId: 1, clientX: 200, clientY: 100, button: 0 });
    fireEvent.pointerMove(screen.getByTestId("frame"), { pointerId: 1, clientX: 140, clientY: 104 });
    expect(screen.getByTestId("slide").style.getPropertyValue("--swipe")).toBe("-60px");
  });

  it("slides out, steps, and slides back in", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    drag(screen.getByTestId("frame"), -150);
    expect(onStep).not.toHaveBeenCalled();
    expect(screen.getByTestId("slide").style.getPropertyValue("--swipe")).toBe(`-${W}px`);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS);
    });
    expect(onStep).toHaveBeenCalledWith(1);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 2);
    });
    expect(screen.getByTestId("slide").style.getPropertyValue("--swipe")).toBe("0px");
  });

  it("springs back on a short drag and changes nothing", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    drag(screen.getByTestId("frame"), 40);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 3);
    });
    expect(onStep).not.toHaveBeenCalled();
    expect(screen.getByTestId("slide").style.getPropertyValue("--swipe")).toBe("0px");
  });

  it("ignores a drag that starts on the controls", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    drag(screen.getByRole("button", { name: "Volume" }), -200);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 3);
    });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("changes at once, with no slide, with reduced motion", () => {
    reduced(true);
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    drag(screen.getByTestId("frame"), 150);
    expect(onStep).toHaveBeenCalledWith(-1);
    expect(screen.getByTestId("slide").style.getPropertyValue("--swipe")).toBe("0px");
  });

  it("lets go of a mouse drag released outside the stage", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    const frame = screen.getByTestId("frame");
    fireEvent.pointerDown(frame, { pointerId: 1, clientX: 200, clientY: 100, button: 0, pointerType: "mouse" });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 100, clientY: 100, buttons: 1, pointerType: "mouse" });
    // Back over the stage with no button held: the drag is over, nothing follows the mouse.
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 60, clientY: 100, buttons: 0, pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 2);
    });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 20, clientY: 100, buttons: 0, pointerType: "mouse" });
    expect(screen.getByTestId("slide").style.getPropertyValue("--swipe")).toBe("0px");
    expect(onStep).not.toHaveBeenCalled();
  });

  it("ignores a new swipe while the last one is still sliding", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    drag(screen.getByTestId("frame"), -150, 0, 0);
    drag(screen.getByTestId("frame"), -150, 0, 0);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 4);
    });
    expect(onStep).toHaveBeenCalledTimes(1);
    // Once it's done, the next swipe works.
    drag(screen.getByTestId("frame"), -150, 0, 0);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 4);
    });
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it("does nothing when it's off", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} enabled={false} />);
    drag(screen.getByTestId("frame"), -200);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 3);
    });
    expect(onStep).not.toHaveBeenCalled();
  });
});

// ---- up and down, sideways (spec 0160) ----

function Vertical({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
  const slide = useRef<HTMLDivElement>(null);
  const handlers = useStageSwipe(slide, { enabled: true, axis: "vertical", onOpen, onClose });
  return (
    <div data-testid="frame" {...handlers}>
      <div data-testid="slide" ref={slide} />
    </div>
  );
}

describe("the stage's up-and-down swipe (spec 0160)", () => {
  it("opens on a swipe up and closes on a swipe down, without moving the picture", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(<Vertical onOpen={onOpen} onClose={onClose} />);
    const frame = screen.getByTestId("frame");
    drag(frame, 0, -120);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("slide").style.getPropertyValue("--swipe")).toBe("");
    drag(frame, 10, 120);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a left or right drag, or a short one", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(<Vertical onOpen={onOpen} onClose={onClose} />);
    const frame = screen.getByTestId("frame");
    drag(frame, -200, 10);
    drag(frame, 0, -10);
    act(() => {
      vi.advanceTimersByTime(SLIDE_MS * 3);
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("slide").style.getPropertyValue("--swipe")).not.toBe("-200px");
  });
});
