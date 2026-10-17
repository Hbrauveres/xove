import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Picker } from "./Picker";

const CAMERAS = [
  { value: "c920", label: "Webcam C920" },
  { value: "mbp", label: "MacBook Pro camera" },
  { value: "obs", label: "OBS Virtual Camera" },
];

function setup(props: Partial<Parameters<typeof Picker>[0]> = {}) {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <div>
      <Picker label="Camera" options={CAMERAS} value="c920" onChange={onChange} {...props} />
      <button>Elsewhere</button>
    </div>,
  );
  return { user, onChange, pill: screen.getByRole("button", { name: "Camera: Webcam C920" }) };
}

describe("Picker, the app's one-box picker", () => {
  it("shows the chosen option in its pill, closed", () => {
    const { pill } = setup();
    expect(pill).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("opens into one box with the other options only: the chosen one stays in the pill", async () => {
    const { user, pill } = setup();
    await user.click(pill);
    expect(pill).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("radiogroup", { name: "Camera" });
    const names = within(list).getAllByRole("radio").map((r) => r.textContent);
    expect(names).toEqual(["MacBook Pro camera", "OBS Virtual Camera"]);
  });

  it("picks one and closes", async () => {
    const { user, pill, onChange } = setup();
    await user.click(pill);
    await user.click(screen.getByRole("radio", { name: "OBS Virtual Camera" }));
    expect(onChange).toHaveBeenCalledWith("obs");
    expect(pill).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on a click outside, and on Escape with the focus back on the pill", async () => {
    const { user, pill } = setup();
    await user.click(pill);
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(pill).toHaveAttribute("aria-expanded", "false");
    await user.click(pill);
    await user.keyboard("{Escape}");
    expect(pill).toHaveAttribute("aria-expanded", "false");
    expect(pill).toHaveFocus();
  });

  it("moves through the options with the arrow keys", async () => {
    const { user, pill } = setup();
    pill.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "MacBook Pro camera" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "OBS Virtual Camera" })).toHaveFocus();
  });

  it("opens down, floating, in a panel, or upward over the video", async () => {
    const down = setup();
    expect(down.pill.closest("[data-picker]")).toHaveAttribute("data-opens", "down");
  });

  it("opens upward over the video", async () => {
    const { user, pill } = setup({ opens: "up", look: "glass" });
    await user.click(pill);
    const picker = pill.closest("[data-picker]")!;
    expect(picker).toHaveAttribute("data-opens", "up");
    expect(picker).toHaveAttribute("data-look", "glass");
  });

  it("can be told to close (its drop-up was left), and says when it opens or closes", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Picker label="Camera" options={CAMERAS} value="c920" onChange={() => {}} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Camera: Webcam C920" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    rerender(<Picker label="Camera" options={CAMERAS} value="c920" onChange={() => {}} onOpenChange={onOpenChange} closed />);
    expect(screen.getByRole("button", { name: "Camera: Webcam C920" })).toHaveAttribute("aria-expanded", "false");
    // Closed from outside, it says so too: the player lets its controls fade again.
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("says its list closed when it goes away open (its stream stopped)", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const view = render(<Picker label="Camera" options={CAMERAS} value="c920" onChange={() => {}} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Camera: Webcam C920" }));
    view.unmount();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe("Picker: floating over its panel (spec 0111)", () => {
  /** A panel holding the picker and two controls: one right under its list, one far below. */
  function panel() {
    const user = userEvent.setup();
    render(
      <div data-list-host>
        <Picker label="Camera" options={CAMERAS} value="c920" onChange={() => {}} />
        <div data-testid="under">Quality</div>
        <div data-testid="far">Mode</div>
      </div>,
    );
    const at: Record<string, [number, number]> = { list: [40, 140], under: [80, 120], far: [300, 340] };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const key = this.getAttribute("role") === "radiogroup" ? "list" : this.dataset.testid ?? "";
      const [top, bottom] = at[key] ?? [0, 0];
      return { top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top } as DOMRect;
    });
    return { user, pill: screen.getByRole("button", { name: "Camera: Webcam C920" }) };
  }

  it("hides only what's right behind its list, fading back in under it, and nothing else; all back on closing", async () => {
    const { user, pill } = panel();
    await user.click(pill);
    const under = screen.getByTestId("under");
    expect(under.style.maskImage).toMatch(/transparent/);
    expect(screen.getByTestId("far").style.maskImage).toBe("");
    await user.keyboard("{Escape}");
    // Kept while it rolls back, so nothing shows through it on the way; then gone.
    expect(under.style.maskImage).toMatch(/transparent/);
    await waitFor(() => expect(under.style.maskImage).toBe(""));
    vi.restoreAllMocks();
  });

  it("fades what's under it back in: hidden, 8% halfway, 35% at three quarters, fully there at 30 px", async () => {
    const { user, pill } = panel();
    await user.click(pill);
    // The list ends at 140, Quality starts at 80: hidden to 60 + 4 px, then the 30 px fade.
    expect(screen.getByTestId("under").style.maskImage).toBe(
      "linear-gradient(rgb(0, 0, 0) -40px, transparent -40px, transparent 64px, rgba(0, 0, 0, 0.08) 79px, rgba(0, 0, 0, 0.35) 86.5px, rgb(0, 0, 0) 94px)",
    );
    vi.restoreAllMocks();
  });

  it("closes, and lets go of the masks, when the window changes size or its options change", async () => {
    const { user, pill } = panel();
    await user.click(pill);
    act(() => window.dispatchEvent(new Event("resize")));
    expect(pill).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(screen.getByTestId("under").style.maskImage).toBe(""));
    vi.restoreAllMocks();
  });

  it("lets go of the masks when it goes away open (its panel closed, its tab switched)", async () => {
    const user = userEvent.setup();
    const view = render(
      <div data-list-host>
        <Picker label="Camera" options={CAMERAS} value="c920" onChange={() => {}} />
        <div data-testid="under">Quality</div>
      </div>,
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 40, bottom: 140, left: 0, right: 300, width: 300, height: 100, x: 0, y: 40 } as DOMRect);
    await user.click(screen.getByRole("button", { name: "Camera: Webcam C920" }));
    const under = screen.getByTestId("under");
    expect(under.style.maskImage).toMatch(/transparent/);
    view.rerender(<div data-list-host><div data-testid="under">Quality</div></div>);
    expect(under.style.maskImage).toBe("");
    vi.restoreAllMocks();
  });

  it("rolls back before it goes: closing, it stays drawn but out of reach, then leaves", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Picker label="Camera" options={CAMERAS} value="c920" onChange={() => {}} />);
    const pill = screen.getByRole("button", { name: "Camera: Webcam C920" });
    await user.click(pill);
    const list = document.querySelector("[data-picker] [role=radiogroup]")!;
    await user.click(pill);
    expect(pill).toHaveAttribute("aria-expanded", "false");
    expect(list.isConnected).toBe(true);
    expect(list).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("radio")).toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(list.isConnected).toBe(false);
    vi.useRealTimers();
  });

  it("unrolls its options in order, the nearest to the pill first", async () => {
    const { user, pill } = setup();
    await user.click(pill);
    const order = screen.getAllByRole("radio").map((r) => (r as HTMLElement).style.getPropertyValue("--k"));
    expect(order).toEqual(["0", "1"]);
  });

  it("upward, the nearest is the last one", async () => {
    const { user, pill } = setup({ opens: "up", look: "glass" });
    await user.click(pill);
    const order = screen.getAllByRole("radio").map((r) => (r as HTMLElement).style.getPropertyValue("--k"));
    expect(order).toEqual(["1", "0"]);
  });
});

describe("Picker: long names and an upward list (spec 0114)", () => {
  const LONG = [
    { value: "studio", label: "EMEET STUDIO Virtual Camera" },
    { value: "pixy", label: "EMEET PIXY (328f:00c0)" },
  ];

  it("shows the full name as the pill's tooltip and in its accessible name, and on each option", async () => {
    const user = userEvent.setup();
    render(<Picker label="Camera" options={LONG} value="studio" onChange={() => {}} />);
    const pill = screen.getByRole("button", { name: "Camera: EMEET STUDIO Virtual Camera" });
    expect(pill).toHaveAttribute("title", "EMEET STUDIO Virtual Camera");
    await user.click(pill);
    expect(screen.getByRole("radio", { name: "EMEET PIXY (328f:00c0)" })).toHaveAttribute("title", "EMEET PIXY (328f:00c0)");
  });

  it("opens an upward list scrolled to the pill's end", async () => {
    const user = userEvent.setup();
    const height = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(300);
    render(<Picker label="Camera" options={CAMERAS} value="c920" onChange={() => {}} opens="up" look="glass" />);
    await user.click(screen.getByRole("button", { name: "Camera: Webcam C920" }));
    expect(screen.getByRole("radiogroup", { name: "Camera" }).scrollTop).toBe(300);
    height.mockRestore();
  });

  it("opens a downward list at its top", async () => {
    const user = userEvent.setup();
    const height = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(300);
    render(<Picker label="Camera" options={CAMERAS} value="c920" onChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Camera: Webcam C920" }));
    expect(screen.getByRole("radiogroup", { name: "Camera" }).scrollTop).toBe(0);
    height.mockRestore();
  });
});
