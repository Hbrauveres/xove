import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DropUp, LEAVE_GRACE_MS, OPEN_DELAY_MS } from "./DropUp";

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

  it("isn't there at all on a touch screen, or while the stream is off", () => {
    hover = false;
    const first = render(<DropUp label="x" enabled trigger={<button>a</button>}><button>Change</button></DropUp>);
    expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
    first.unmount();
    hover = true;
    render(<DropUp label="x" enabled={false} trigger={<button>a</button>}><button>Change</button></DropUp>);
    expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
  });
});
