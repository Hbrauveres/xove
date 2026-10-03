import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import type { SharingConnection, StreamKind, StreamSettings, StreamsState } from "../api/types";

/** How often every open room asks the API which streams are live. */
export const STREAMS_POLL_MS = 2000;

export type Streams = {
  /** Null until the first answer arrives. */
  state: StreamsState | null;
  /** Message from the last failed start, change or stop, safe to show. */
  error: string | null;
  busy: boolean;
  /** Resolves true when the API accepted. The connection lets the API end the stream when it stops. */
  start: (kind: StreamKind, connection: SharingConnection, settings: StreamSettings) => Promise<boolean>;
  /** Its person changes what a stream is sent with. Resolves true when the API accepted. */
  changeSettings: (kind: StreamKind, settings: StreamSettings) => Promise<boolean>;
  stop: (kind: StreamKind) => Promise<boolean>;
};

/** The room's live streams, owned by the API (spec 0060): polls them, and starts, changes or stops mine. */
export function useStreams(pollMs: number = STREAMS_POLL_MS): Streams {
  const [state, setState] = useState<StreamsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Bumped by every start/change/stop. A poll that was already in flight carries
  // the old state, so its answer is dropped instead of undoing the click.
  const version = useRef(0);

  const refresh = useCallback(async () => {
    const askedAt = version.current;
    try {
      const next = await api.streams.current();
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
    async (call: () => Promise<StreamsState>) => {
      version.current += 1;
      setBusy(true);
      setError(null);
      try {
        setState(await call());
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
        void refresh();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const start = useCallback(
    (kind: StreamKind, connection: SharingConnection, settings: StreamSettings) =>
      run(() => api.streams.start(kind, connection, settings)),
    [run],
  );
  const changeSettings = useCallback(
    (kind: StreamKind, settings: StreamSettings) => run(() => api.streams.settings(kind, settings)),
    [run],
  );
  const stop = useCallback((kind: StreamKind) => run(() => api.streams.stop(kind)), [run]);

  return { state, error, busy, start, changeSettings, stop };
}
