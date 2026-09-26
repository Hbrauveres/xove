import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import type { ScreenState } from "../api/types";

/** How often every open room asks the API who is sharing. LiveKit events replace this later. */
export const SCREEN_POLL_MS = 2000;

export type ScreenSlot = {
  /** Null until the first answer arrives. */
  state: ScreenState | null;
  /** Message from the last failed take/release, safe to show. */
  error: string | null;
  busy: boolean;
  take: () => Promise<void>;
  release: () => Promise<void>;
};

/** The shared screen slot, owned by the API: polls it, and takes or releases it. */
export function useScreenSlot(pollMs: number = SCREEN_POLL_MS): ScreenSlot {
  const [state, setState] = useState<ScreenState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Bumped by every take/release. A poll that was already in flight carries
  // the old state, so its answer is dropped instead of undoing the click.
  const version = useRef(0);

  const refresh = useCallback(async () => {
    const askedAt = version.current;
    try {
      const next = await api.screen.current();
      if (askedAt === version.current) setState(next);
    } catch {
      // A missed poll is fine: the next one tries again.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [refresh, pollMs]);

  const run = useCallback(
    async (call: () => Promise<ScreenState>) => {
      version.current += 1;
      setBusy(true);
      setError(null);
      try {
        setState(await call());
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
        void refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const take = useCallback(() => run(api.screen.take), [run]);
  const release = useCallback(() => run(api.screen.release), [run]);

  return { state, error, busy, take, release };
}
