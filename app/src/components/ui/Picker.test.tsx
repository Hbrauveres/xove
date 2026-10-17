import { render, screen, within } from "@testing-library/react";
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

  it("opens in place in a panel, or upward over the video", async () => {
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
