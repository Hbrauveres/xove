import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { WatchPrefs } from "../../media/preferences";
import { PlayerControls } from "./PlayerControls";

/** The controls with their own state, as the stage uses them. */
function Harness({ height, onChange, canSetVolume = true }: { height: number; onChange?: (p: WatchPrefs) => void; canSetVolume?: boolean }) {
  const [prefs, setPrefs] = useState<WatchPrefs>({ quality: "auto", volume: 0.6, muted: false });
  return (
    <PlayerControls
      sharerHeight={height}
      prefs={prefs}
      canSetVolume={canSetVolume}
      onChange={(next) => {
        setPrefs(next);
        onChange?.(next);
      }}
    />
  );
}

describe("player controls: quality", () => {
  it("offers Auto and the sharer's quality down to 480p", () => {
    render(<Harness height={1080} />);
    const options = [...(screen.getByLabelText("Quality") as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toEqual(["auto", "1080p", "720p", "480p"]);
  });

  it("never offers more than the sharer sends", () => {
    render(<Harness height={720} />);
    const options = [...(screen.getByLabelText("Quality") as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toEqual(["auto", "720p", "480p"]);
  });

  it("offers only the sharer's quality when they send just one", () => {
    render(<PlayerControls sharerHeight={1080} layers={1} prefs={{ quality: "auto", volume: 1, muted: false }} onChange={() => {}} canSetVolume />);
    const options = [...(screen.getByLabelText("Quality") as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toEqual(["auto", "1080p"]);
  });

  it("reports the quality picked", async () => {
    const onChange = vi.fn();
    render(<Harness height={1080} onChange={onChange} />);

    await userEvent.setup().selectOptions(screen.getByLabelText("Quality"), "480p");

    expect(onChange).toHaveBeenLastCalledWith({ quality: "480p", volume: 0.6, muted: false });
  });
});

describe("player controls: volume", () => {
  it("turns the volume up and down with the slider", () => {
    const onChange = vi.fn();
    render(<Harness height={1080} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.25" } });
    expect(onChange).toHaveBeenLastCalledWith({ quality: "auto", volume: 0.25, muted: false });

    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.9" } });
    expect(onChange).toHaveBeenLastCalledWith({ quality: "auto", volume: 0.9, muted: false });
  });

  it("mutes with the speaker icon, and unmutes back to the same volume", async () => {
    const onChange = vi.fn();
    render(<Harness height={1080} onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(onChange).toHaveBeenLastCalledWith({ quality: "auto", volume: 0.6, muted: true });

    await user.click(screen.getByRole("button", { name: "Unmute" }));
    expect(onChange).toHaveBeenLastCalledWith({ quality: "auto", volume: 0.6, muted: false });
  });

  it("unmutes when the slider moves while muted", async () => {
    const onChange = vi.fn();
    render(<Harness height={1080} onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Mute" }));

    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.4" } });

    expect(onChange).toHaveBeenLastCalledWith({ quality: "auto", volume: 0.4, muted: false });
  });

  it("hides the slider where the page can't set the volume (iPhones), and keeps mute", () => {
    render(<Harness height={1080} canSetVolume={false} />);

    expect(screen.queryByLabelText("Volume")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
  });
});
