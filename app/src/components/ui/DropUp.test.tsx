import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DropUp, HOLD_MS, LEAVE_GRACE_MS, OPEN_DELAY_MS } from "./DropUp";

let hover = true;
beforeEach(() => {
  vi.useFakeTimers();
  hover = true;
  vi.spyOn(window, "matchMedia").mockImplementation(
    (q: string) => ({ matches: q.includes("hover: hover") ? hover : false, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup(props: Partial<Parameters<typeof DropUp>[0]> = {}) {
  const onLeave = vi.fn();
  render(
    <DropUp label="The window you share" enabled onLeave={onLeave} trigger={<button>Stop sharing your screen</button>} {...props}>
      <button>Change</button>
    </DropUp>,
  );
  const wrap = screen.getByRole("button", { name: "Stop sharing your screen" }).closest("[data-dropup]")!;
  const shown = () => wrap.getAttribute("data-open") === "true";
  return { wrap, shown, onLeave };
}

describe("DropUp by touch: press and hold", () => {
  const touch = { pointerType: "touch", clientX: 10, clientY: 10 };
  function touchSetup(props: Partial<Parameters<typeof DropUp>[0]> = {}) {
    hover = false;
    const onStop = vi.fn();
    const view = render(
      <div>
        <DropUp label="Your camera" enabled trigger={<button onClick={onStop}>Turn off your camera</button>} {...props}>
          <button>Integrated Webcam</button>
        </DropUp>
        <button>Elsewhere</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "Turn off your camera" });
    const wrap = trigger.closest("[data-dropup]")!;
    const shown = () => wrap.getAttribute("data-open") === "true";
    const hold = (ms = HOLD_MS) => {
      fireEvent.pointerDown(trigger, touch);
      act(() => vi.advanceTimersByTime(ms));
      fireEvent.pointerUp(trigger, touch);
      fireEvent.click(trigger);
    };
    return { onStop, trigger, shown, hold, view };
  }

  it("opens after a 500 ms press and hold, and that press doesn't stop the stream", () => {
    const { onStop, shown, hold } = touchSetup();
    hold();
    expect(HOLD_MS).toBe(500);
    expect(shown()).toBe(true);
    expect(onStop).not.toHaveBeenCalled();
  });

  it("leaves a short tap alone: it still stops the stream", () => {
    const { onStop, shown, hold } = touchSetup();
    hold(150);
    expect(shown()).toBe(false);
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("doesn't open when the finger moves away (a scroll)", () => {
    const { shown, trigger } = touchSetup();
    fireEvent.pointerDown(trigger, touch);
    fireEvent.pointerMove(trigger, { ...touch, clientX: 40 });
    act(() => vi.advanceTimersByTime(HOLD_MS));
    expect(shown()).toBe(false);
  });

  it("stays open when the finger lifts, until a tap outside", () => {
    const { shown, hold } = touchSetup();
    hold();
    act(() => vi.advanceTimersByTime(LEAVE_GRACE_MS * 3));
    expect(shown()).toBe(true);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Elsewhere" }), touch);
    expect(shown()).toBe(false);
  });

  it("closes when its action is done (a camera picked, Change), told by its owner", () => {
    const { shown, hold, view } = touchSetup({ closeSignal: 0 });
    hold();
    view.rerender(
      <div>
        <DropUp label="Your camera" enabled closeSignal={1} trigger={<button>Turn off your camera</button>}>
          <button>Integrated Webcam</button>
        </DropUp>
      </div>,
    );
    expect(shown()).toBe(false);
  });

  it("closes when the button is pressed again, without stopping the stream", () => {
    const { onStop, shown, hold, trigger } = touchSetup();
    hold();
    fireEvent.pointerDown(trigger, touch);
    fireEvent.pointerUp(trigger, touch);
    fireEvent.click(trigger);
    expect(shown()).toBe(false);
    expect(onStop).not.toHaveBeenCalled();
  });

  it("offers no text selection or long-press menu on the button", () => {
    const { trigger } = touchSetup();
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    trigger.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });
});

describe("DropUp, the quick-access pill over a live button", () => {
  it("opens a short pause after the pointer arrives, not at once", () => {
    const { wrap, shown } = setup();
    fireEvent.pointerEnter(wrap);
    expect(shown()).toBe(false);
    act(() => vi.advanceTimersByTime(OPEN_DELAY_MS));
    expect(shown()).toBe(true);
    expect(OPEN_DELAY_MS).toBe(120);
  });

  it("forgives a slip outside shorter than the grace, and closes after it", () => {
    const { wrap, shown, onLeave } = setup();
    fireEvent.pointerEnter(wrap);
    act(() => vi.advanceTimersByTime(OPEN_DELAY_MS));
    fireEvent.pointerLeave(wrap);
    act(() => vi.advanceTimersByTime(LEAVE_GRACE_MS - 50));
    fireEvent.pointerEnter(wrap);
    act(() => vi.advanceTimersByTime(LEAVE_GRACE_MS));
    expect(shown()).toBe(true);
    fireEvent.pointerLeave(wrap);
    act(() => vi.advanceTimersByTime(LEAVE_GRACE_MS));
    expect(shown()).toBe(false);
    expect(onLeave).toHaveBeenCalledOnce();
    expect(LEAVE_GRACE_MS).toBe(300);
  });

  it("closes when the pointer leaves even right after a click inside", () => {
    const { wrap, shown } = setup();
    fireEvent.pointerEnter(wrap);
    act(() => vi.advanceTimersByTime(OPEN_DELAY_MS));
    screen.getByRole("button", { name: "Change" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.pointerLeave(wrap);
    act(() => vi.advanceTimersByTime(LEAVE_GRACE_MS));
    expect(shown()).toBe(false);
  });

  it("opens for the keyboard's focus, and closes with Escape", () => {
    const { wrap, shown } = setup();
    const trigger = screen.getByRole("button", { name: "Stop sharing your screen" });
    vi.spyOn(trigger, "matches").mockReturnValue(true);
    fireEvent.focus(trigger);
    expect(shown()).toBe(true);
    fireEvent.keyDown(wrap, { key: "Escape" });
    expect(shown()).toBe(false);
  });

  it("is out of reach while closed", () => {
    setup();
    expect(document.querySelector("[data-dropup] [role=group]")).toHaveAttribute("inert");
  });

  it("keeps its button, and the keyboard's focus on it, when the stream starts or stops", () => {
    const view = render(<DropUp label="x" enabled={false} trigger={<button>Turn on your camera</button>}><button>Change</button></DropUp>);
    const button = screen.getByRole("button", { name: "Turn on your camera" });
    button.focus();
    view.rerender(<DropUp label="x" enabled trigger={<button>Turn on your camera</button>}><button>Change</button></DropUp>);
    expect(screen.getByRole("button", { name: "Turn on your camera" })).toBe(button);
    expect(button).toHaveFocus();
  });

  it("isn't there while the stream is off", () => {
    render(<DropUp label="x" enabled={false} trigger={<button>a</button>}><button>Change</button></DropUp>);
    expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
  });
});

describe("DropUp redirected: another panel shows the setting (spec 0115)", () => {
  const touch = { pointerType: "touch", clientX: 10, clientY: 10 };

  it("resting the mouse calls the redirect after the same pause, and nothing opens", () => {
    const redirect = vi.fn();
    const { wrap, shown } = setup({ redirect });
    fireEvent.pointerEnter(wrap, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(OPEN_DELAY_MS - 1));
    expect(redirect).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(redirect).toHaveBeenCalledOnce();
    expect(shown()).toBe(false);
  });

  it("the 500 ms hold calls the redirect, opens nothing, and its tap doesn't stop the stream", () => {
    hover = false;
    const redirect = vi.fn();
    const onStop = vi.fn();
    render(
      <DropUp label="Your camera" enabled redirect={redirect} trigger={<button onClick={onStop}>Turn off your camera</button>}>
        <button>Integrated Webcam</button>
      </DropUp>,
    );
    const trigger = screen.getByRole("button", { name: "Turn off your camera" });
    fireEvent.pointerDown(trigger, touch);
    act(() => vi.advanceTimersByTime(HOLD_MS));
    fireEvent.pointerUp(trigger, touch);
    fireEvent.click(trigger);
    expect(redirect).toHaveBeenCalledOnce();
    expect(onStop).not.toHaveBeenCalled();
    expect(trigger.closest("[data-dropup]")).toHaveAttribute("data-open", "false");
    // A short tap still stops it.
    fireEvent.pointerDown(trigger, touch);
    act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerUp(trigger, touch);
    fireEvent.click(trigger);
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("the keyboard's focus doesn't redirect, nor open it", () => {
    const redirect = vi.fn();
    const { wrap, shown } = setup({ redirect });
    const button = wrap.querySelector("button")!;
    vi.spyOn(button, "matches").mockReturnValue(true);
    fireEvent.focus(button);
    expect(redirect).not.toHaveBeenCalled();
    expect(shown()).toBe(false);
  });
});
