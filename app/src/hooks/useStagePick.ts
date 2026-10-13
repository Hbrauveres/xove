import { useCallback, useState } from "react";
import { stagePick } from "../media/stagePick";
import type { Sharer, StreamKind } from "../types";

export type StagePick = {
  /** Who is big, or null on an empty stage. */
  big: Sharer | null;
  /** What of theirs is big: their screen, or their camera (only one, or swapped). */
  mainKind: StreamKind | null;
  /** The big video plays (not still loading): only then does it count as watched (spec 0104). */
  playing: boolean;
  /** Per person: their camera big and their screen in the facecam. For this visit only. */
  swappedFor: Record<string, boolean>;
  /** Puts a person on the stage; with a kind, that stream of theirs big. */
  pick: (personId: string, kind?: StreamKind) => void;
  /** Swaps a person's screen and camera (the facecam's button). */
  toggleSwap: (personId: string) => void;
};

/**
 * Who is on the stage (spec 0104), kept by the room so the stage, the previews and the
 * activity list can all change it. By default, and when the picked person stops, it's the
 * person sharing the longest; a pick holds while that person shares.
 */
export function useStagePick(sharers: Sharer[]): StagePick {
  const [picked, setPicked] = useState<string | null>(null);
  const [swappedFor, setSwappedFor] = useState<Record<string, boolean>>({});
  // A pick is forgotten once that person stops: if they share again later, the longest
  // sharing person is big again (set while rendering, React's way to follow a prop).
  if (picked !== null && !sharers.some((s) => s.person.id === picked)) setPicked(null);

  const bigId = stagePick(
    sharers.map((s) => s.person.id),
    picked,
  );
  const big = sharers.find((s) => s.person.id === bigId) ?? null;
  const both = Boolean(big?.screen && big?.camera);
  const mainKind: StreamKind | null = !big
    ? null
    : both
      ? swappedFor[big.person.id]
        ? "camera"
        : "screen"
      : big.screen
        ? "screen"
        : "camera";

  const mainFeed = big && mainKind ? big[mainKind] : undefined;
  const playing = Boolean(big && mainFeed && (big.isMe ? mainFeed.local : mainFeed.remote));

  const pick = useCallback((personId: string, kind?: StreamKind) => {
    setPicked(personId);
    if (kind) setSwappedFor((prev) => ({ ...prev, [personId]: kind === "camera" }));
  }, []);
  const toggleSwap = useCallback(
    (personId: string) => setSwappedFor((prev) => ({ ...prev, [personId]: !prev[personId] })),
    [],
  );

  return { big, mainKind, playing, swappedFor, pick, toggleSwap };
}
