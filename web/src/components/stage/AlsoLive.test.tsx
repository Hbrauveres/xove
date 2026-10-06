import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FakeTrack } from "../../test/fakeLiveKit";
import type { MediaTrack, Sharer } from "../../types";
import { AlsoLive } from "./AlsoLive";
import { MUTED, type PreviewSound } from "./previewSound";

const video = () => new FakeTrack() as unknown as MediaTrack;
const sharer = (id: string, name: string, kinds: ("screen" | "camera")[], withSound = false): Sharer => ({
  person: { id, name, hue: 100, online: true },
  isMe: false,
  since: Date.now(),
  ...Object.fromEntries(
    kinds.map((kind) => [
      kind,
      {
        kind,
        startedAt: Date.now(),
        settings: { quality: "1080p", mode: "smooth" },
        remote: { video: video(), setQuality: () => {} },
      },
    ]),
  ),
  hasSound: withSound,
  sound: withSound ? (new FakeTrack() as unknown as MediaTrack) : undefined,
});

const BRUNO = sharer("user-7", "Bruno", ["screen", "camera"], true);
const ANA = sharer("user-3", "Ana", ["screen"], true);
const DIEGO = sharer("user-9", "Diego", ["camera"]);

function Harness({
  others,
  free = 3,
  canSetVolume = true,
  onPick = vi.fn(),
}: {
  others: Sharer[];
  free?: number;
  canSetVolume?: boolean;
  onPick?: (id: string) => void;
}) {
  const [sound, setSound] = useState<Record<string, PreviewSound>>({});
  return (
    <AlsoLive
      others={others}
      liveCount={6 - free}
      free={free}
      onPick={onPick}
      sound={sound}
      onSoundChange={(id, s) => setSound((prev) => ({ ...prev, [id]: s }))}
      canSetVolume={canSetVolume}
    />
  );
}

const preview = (name: RegExp) => screen.getByRole("button", { name });

describe("also live (spec 0104)", () => {
  it("shows my own stream from my browser, as You, with no speaker", () => {
    const local = video();
    const me: Sharer = {
      person: { id: "me", name: "Henrique", hue: 36, online: true },
      isMe: true,
      since: Date.now(),
      screen: { kind: "screen", startedAt: Date.now(), settings: { quality: "1080p", mode: "smooth" }, local },
      hasSound: true,
    };
    render(<Harness others={[me]} />);

    expect(preview(/Watch your screen/)).toHaveTextContent("You · screen");
    expect((local as unknown as FakeTrack).attached).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /mute/i })).not.toBeInTheDocument();
  });

  it("says Loading until someone's video arrives", () => {
    const waiting: Sharer = { ...ANA, screen: { ...ANA.screen!, remote: undefined } };
    render(<Harness others={[waiting]} />);
    expect(preview(/Watch Ana's screen/)).toHaveTextContent("Loading…");
  });

  it("counts the live streams, shows each other one with its chip, and the free places", () => {
    render(<Harness others={[ANA, DIEGO]} free={3} />);

    expect(screen.getByText("Also live")).toBeInTheDocument();
    expect(screen.getByText("3 of 6")).toBeInTheDocument();
    expect(preview(/Watch Ana's screen/)).toHaveTextContent("Ana · screen");
    expect(preview(/Watch Diego's camera/)).toHaveTextContent("Diego · camera");
    expect(screen.getByText("3 free · share yours")).toBeInTheDocument();
  });

  it("puts a preview on the stage when clicked", async () => {
    const onPick = vi.fn();
    render(<Harness others={[ANA]} onPick={onPick} />);
    await userEvent.setup().click(preview(/Watch Ana's screen/));
    expect(onPick).toHaveBeenCalledWith("user-3");
  });

  it("has no free slot when all 6 places are taken", () => {
    render(<Harness others={[ANA]} free={0} />);
    expect(screen.getByText("6 of 6")).toBeInTheDocument();
    expect(screen.queryByText(/free · share yours/)).not.toBeInTheDocument();
  });

  it("keeps previews muted, with a crossed speaker, and their sound not played", () => {
    render(<Harness others={[BRUNO]} />);

    expect(screen.getByRole("button", { name: "Unmute Bruno" })).toBeInTheDocument();
    expect(BRUNO.sound && (BRUNO.sound as unknown as FakeTrack).attached).toHaveLength(0);
    expect(MUTED.muted).toBe(true);
  });

  it("plays a preview's sound when unmuted, with its own horizontal slider on hover", async () => {
    const user = userEvent.setup();
    render(<Harness others={[BRUNO]} />);

    await user.click(screen.getByRole("button", { name: "Unmute Bruno" }));
    await waitFor(() => expect((BRUNO.sound as unknown as FakeTrack).attached).toHaveLength(1));

    await user.hover(screen.getByRole("button", { name: "Mute Bruno" }));
    expect(screen.getByRole("slider", { name: "Bruno's volume" })).toHaveAttribute("aria-orientation", "horizontal");

    await user.click(screen.getByRole("button", { name: "Mute Bruno" }));
    expect(screen.getByRole("button", { name: "Unmute Bruno" })).toBeInTheDocument();
    await waitFor(() => expect((BRUNO.sound as unknown as FakeTrack).attached).toHaveLength(0));
  });

  it("sets a preview's own volume", async () => {
    const user = userEvent.setup();
    render(<Harness others={[BRUNO]} />);
    await user.click(screen.getByRole("button", { name: "Unmute Bruno" }));
    await user.hover(screen.getByRole("button", { name: "Mute Bruno" }));

    fireEvent.change(screen.getByRole("slider", { name: "Bruno's volume" }), { target: { value: "0.4" } });

    const audio = (BRUNO.sound as unknown as FakeTrack).attached[0] as HTMLAudioElement;
    await waitFor(() => expect(audio.volume).toBeCloseTo(0.4));
  });

  it("shows no speaker for a preview without sound, nor a slider where volume can't be set", async () => {
    const { unmount } = render(<Harness others={[DIEGO]} />);
    expect(within(screen.getByRole("list")).queryByRole("button", { name: /mute/i })).not.toBeInTheDocument();
    unmount();

    const user = userEvent.setup();
    render(<Harness others={[ANA]} canSetVolume={false} />);
    await user.click(screen.getByRole("button", { name: "Unmute Ana" }));
    await user.hover(screen.getByRole("button", { name: "Mute Ana" }));
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });
});
