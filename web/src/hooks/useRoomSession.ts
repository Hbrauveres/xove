import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadCameraPrefs, loadSharePrefs, saveCameraPrefs, saveSharePrefs, type SharePrefs } from "../media/preferences";
import type { ActivityEvent, CameraDevice, ConnectionState, Friend, LiveFeed, Sharer, StreamKind } from "../types";
import type { LiveStream, RoomSeatsState } from "../api/types";
import { useLiveKitRoom, type Capture } from "./useLiveKitRoom";
import { useStreams } from "./useStreams";

/**
 * Everything the room page shows, from two sources:
 * - the API decides which streams are live (useStreams);
 * - LiveKit carries the video and knows who is connected (useLiveKitRoom).
 */
export type RoomSession = {
  me: Friend;
  /** Me first, then everyone connected to the room. */
  people: Friend[];
  /** Everyone the feed may mention, including people who already left. */
  knownPeople: Friend[];
  /** Everyone with a live stream, the longest sharing first (spec 0060). */
  sharers: Sharer[];
  /** Which of my streams are live. */
  mine: Record<StreamKind, boolean>;
  /** Stream places left of the 6. */
  free: number;
  /** How I send my screen and my camera (remembered); changing them while live applies at once. */
  prefs: Record<StreamKind, SharePrefs>;
  setPrefs: (kind: StreamKind, prefs: SharePrefs) => void;
  /** A screen or camera I picked but haven't started sending: the setup window shows it. */
  pending: Capture | null;
  /** Starts sending the picked screen or camera with these settings. */
  confirm: (prefs: SharePrefs) => void;
  /** Drops the picked screen or camera without sending it. */
  cancelPending: () => void;
  /** Opens the browser's picker (screen) or asks for the camera. */
  start: (kind: StreamKind) => void;
  stop: (kind: StreamKind) => void;
  /** Opens the browser's picker again and swaps what my screen shares, without stopping it (spec 0098). */
  changeScreen: () => void;
  /** This browser's cameras, the one in use, and switching to another while live. */
  cameras: CameraDevice[];
  cameraId: string | null;
  pickCamera: (deviceId: string) => void;
  /** I'm sharing my screen, but my browser gave no sound with it. */
  noSound: boolean;
  /** False when the API doesn't know I'm in the room (it restarted): enter again. Null until known. */
  seated: boolean | null;
  /** My connection to the video room, to confirm my seat when entering again. */
  participantSid: () => string | undefined;
  activity: ActivityEvent[];
  /** How full the room is, when the API says (spec 0104). */
  seats: RoomSeatsState | null;
  /** Per person (by their id in the room): whose stream is on their stage (spec 0104). */
  watchingOf: Record<string, { sharerId: string; kind: StreamKind }>;
  connection: ConnectionState;
  error: string | null;
  busy: boolean;
};

export const identityOf = (userId: number) => `user-${userId}`;

const KINDS: StreamKind[] = ["screen", "camera"];

/** Same person, same colour, in every browser. */
const hueOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || "Someone";

const person = (id: string, name: string | null | undefined): Friend => ({
  id,
  name: firstName(name),
  hue: hueOf(id),
  online: true,
});

let streamSeq = 0;
const streamEvent = (kind: "started" | "stopped", actorId: string, stream: StreamKind): ActivityEvent => ({
  id: `stream${++streamSeq}`,
  at: Date.now(),
  kind,
  actorId,
  stream,
});

const loadPrefs = (): Record<StreamKind, SharePrefs> => ({ screen: loadSharePrefs(), camera: loadCameraPrefs() });
const savePrefs = (kind: StreamKind, prefs: SharePrefs) =>
  kind === "screen" ? saveSharePrefs(prefs) : saveCameraPrefs(prefs);

export function useRoomSession(me: Friend, pollMs?: number): RoomSession {
  const api = useStreams(pollMs);
  const lk = useLiveKitRoom();

  const loaded = api.state !== null;
  const live = api.state?.streams;
  const seated = api.state?.seated ?? null;

  const myLive = useMemo<Record<StreamKind, boolean>>(
    () => ({
      screen: live?.some((s) => s.mine && s.kind === "screen") ?? false,
      camera: live?.some((s) => s.mine && s.kind === "camera") ?? false,
    }),
    [live],
  );

  // Everyone with a stream, in the order the API lists them (oldest first).
  const sharers = useMemo<Sharer[]>(() => {
    const byPerson = new Map<number, LiveStream[]>();
    for (const s of live ?? []) byPerson.set(s.userId, [...(byPerson.get(s.userId) ?? []), s]);
    return [...byPerson.values()].map((streams) => {
      const first = streams[0];
      const isMe = first.mine;
      const identity = identityOf(first.userId);
      const media = isMe ? undefined : lk.remote[identity];
      const feed = (kind: StreamKind): LiveFeed | undefined => {
        const s = streams.find((x) => x.kind === kind);
        if (!s) return undefined;
        return {
          kind,
          startedAt: Date.parse(s.since),
          settings: s.settings,
          remote: media?.[kind],
          local: isMe ? lk.local[kind] : undefined,
        };
      };
      return {
        person: isMe ? me : person(identity, first.name),
        isMe,
        since: Date.parse(first.since),
        screen: feed("screen"),
        camera: feed("camera"),
        sound: media?.sound,
        hasSound: media?.hasSound,
        setSoundOn: media?.setSoundOn,
      };
    });
  }, [live, lk.remote, lk.local, me]);

  const people = useMemo(() => [me, ...lk.others.map((o) => person(o.identity, o.name))], [me, lk.others]);

  // People who were here or shared earlier, so the feed can still name them.
  const [seen, setSeen] = useState<Friend[]>([]);
  useEffect(() => {
    const fresh = [...people.slice(1), ...sharers.filter((s) => !s.isMe).map((s) => s.person)];
    setSeen((prev) => {
      const missing = fresh.filter((f) => !prev.some((p) => p.id === f.id));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, [people, sharers]);
  const knownPeople = useMemo(
    () => [...people, ...seen.filter((s) => !people.some((p) => p.id === s.id))],
    [people, seen],
  );

  // Turn changes of the live streams into feed events. The first answer is the
  // starting point, not a change, so it logs nothing.
  const [streamEvents, setStreamEvents] = useState<ActivityEvent[]>([]);
  const previous = useRef<Set<string> | undefined>(undefined);
  const streamKeys = useMemo(
    () => (live ? [...live].map((s) => `${s.mine ? me.id : identityOf(s.userId)}|${s.kind}`).sort().join(",") : null),
    [live, me.id],
  );
  useEffect(() => {
    if (streamKeys === null) return;
    const now = new Set(streamKeys ? streamKeys.split(",") : []);
    const before = previous.current;
    previous.current = now;
    if (!before) return;
    const events: ActivityEvent[] = [];
    for (const key of now) {
      if (!before.has(key)) {
        const [actor, kind] = key.split("|");
        events.push(streamEvent("started", actor, kind as StreamKind));
      }
    }
    for (const key of before) {
      if (!now.has(key)) {
        const [actor, kind] = key.split("|");
        events.push(streamEvent("stopped", actor, kind as StreamKind));
      }
    }
    if (events.length) setStreamEvents((prev) => [...prev, ...events].slice(-30));
  }, [streamKeys]);

  // My connection coming back after a drop is an event too (spec 0104).
  const [connectionEvents, setConnectionEvents] = useState<ActivityEvent[]>([]);
  const lastConnection = useRef(lk.connection);
  useEffect(() => {
    const before = lastConnection.current;
    lastConnection.current = lk.connection;
    if (before === "reconnecting" && lk.connection === "connected") {
      setConnectionEvents((prev) =>
        [...prev, { id: `conn${++streamSeq}`, at: Date.now(), kind: "reconnected" as const, actorId: me.id }].slice(-30),
      );
    }
  }, [lk.connection, me.id]);

  const activity = useMemo(
    () => [...lk.presence, ...streamEvents, ...connectionEvents].sort((a, b) => a.at - b.at),
    [lk.presence, streamEvents, connectionEvents],
  );

  // Who watches what, in the room's ids: "me" for me, "user-42" for everyone else.
  const watchers = api.state?.watching;
  const watchingOf = useMemo(() => {
    const idOf = (userId: number, mine: boolean) => (mine ? me.id : identityOf(userId));
    const sharerIsMe = (userId: number) => (live ?? []).some((s) => s.mine && s.userId === userId);
    const byPerson: Record<string, { sharerId: string; kind: StreamKind }> = {};
    for (const w of watchers ?? []) {
      byPerson[idOf(w.userId, w.mine)] = { sharerId: idOf(w.sharerId, sharerIsMe(w.sharerId)), kind: w.kind };
    }
    return byPerson;
  }, [watchers, live, me.id]);

  // ---- keeping my streams and the API in step ----

  // True between opening the picker and the API confirming the stream.
  const starting = useRef<Record<StreamKind, boolean>>({ screen: false, camera: false });
  const [isStarting, setStarting] = useState(false);
  const markStarting = (kind: StreamKind, on: boolean) => {
    starting.current[kind] = on;
    setStarting(starting.current.screen || starting.current.camera);
  };
  const [prefs, setPrefsState] = useState<Record<StreamKind, SharePrefs>>(loadPrefs);
  const [noSound, setNoSound] = useState(false);

  const [pending, setPendingState] = useState<Capture | null>(null);
  // Also kept in a ref, so leaving the page can stop a capture that was never sent.
  const pendingRef = useRef<Capture | null>(null);
  const setPending = useCallback((capture: Capture | null) => {
    pendingRef.current = capture;
    setPendingState(capture);
  }, []);

  // The settings the API last accepted for each of my streams: what a refused change goes back to.
  const accepted = useRef<Record<StreamKind, SharePrefs>>(prefs);
  // Changes made while live run one after the other, in the order they were made.
  // Each stream knows its own latest change, so a refused one goes back even when the
  // other stream changed meanwhile.
  const changes = useRef<Promise<void>>(Promise.resolve());
  const latestChange = useRef<Record<StreamKind, number>>({ screen: 0, camera: 0 });

  // Step 1, from the click: the browser's picker, or the camera. Captured, not sent.
  const start = useCallback(
    async (kind: StreamKind) => {
      markStarting(kind, true);
      try {
        const capture = await lk.capture(kind, prefs[kind].mode);
        if (capture) setPending(capture);
      } finally {
        markStarting(kind, false);
      }
    },
    [lk, prefs, setPending],
  );

  // Step 2, from the setup window: send it with the chosen settings, then tell the API.
  const confirm = useCallback(
    async (chosen: SharePrefs) => {
      const capture = pending;
      if (!capture) return;
      const kind = capture.kind;
      setPending(null);
      setPrefsState((prev) => ({ ...prev, [kind]: chosen }));
      savePrefs(kind, chosen);
      markStarting(kind, true);
      try {
        const sending = await lk.publishCapture(capture, chosen);
        if (!sending) return;
        const { hasSound, ...connection } = sending;
        const ok = (await api.start(kind, connection, chosen)) === "ok";
        if (!ok) {
          await lk.stop(kind);
          return;
        }
        accepted.current = { ...accepted.current, [kind]: chosen };
        if (kind === "screen") setNoSound(!hasSound);
      } finally {
        markStarting(kind, false);
      }
    },
    [lk, api, pending, setPending],
  );

  // "Change window": the same stream, another pick. Its sound may come or go.
  const [isChanging, setChanging] = useState(false);
  const changeScreen = useCallback(async () => {
    setChanging(true);
    try {
      const changed = await lk.changeScreen(prefs.screen);
      if (changed) setNoSound(!changed.hasSound);
    } finally {
      setChanging(false);
    }
  }, [lk, prefs]);

  const cancelPending = useCallback(() => {
    if (pending) lk.discardCapture(pending);
    setPending(null);
  }, [lk, pending, setPending]);

  // The browser's own "Stop sharing" bar (or the camera going away) while the setup
  // window is open: stop the sound as well, and close the window.
  useEffect(() => {
    const capture = pending;
    const track = capture?.video.mediaStreamTrack;
    if (!capture || !track) return;
    const ended = () => {
      lk.discardCapture(capture);
      setPending(null);
    };
    track.addEventListener("ended", ended);
    return () => track.removeEventListener("ended", ended);
  }, [pending, lk, setPending]);

  // Leaving the page with the setup window open: nothing was sent, so stop capturing.
  const discardCapture = lk.discardCapture;
  useEffect(
    () => () => {
      if (pendingRef.current) discardCapture(pendingRef.current);
    },
    [discardCapture],
  );

  // While live, a new quality or mode applies at once: LiveKit right away, and the
  // API, which tells every viewer's app on its next poll. Changes go one after the
  // other; if the API refuses the latest one, the last accepted settings go back.
  const setPrefs = useCallback(
    (kind: StreamKind, next: SharePrefs) => {
      setPrefsState((prev) => ({ ...prev, [kind]: next }));
      savePrefs(kind, next);
      if (!(myLive[kind] && lk.publishing[kind])) return;
      const change = ++latestChange.current[kind];
      changes.current = changes.current.then(async () => {
        await lk.applySettings(kind, next);
        if (await api.changeSettings(kind, next)) {
          accepted.current = { ...accepted.current, [kind]: next };
          return;
        }
        if (change !== latestChange.current[kind]) return; // a newer change of this stream follows
        const back = accepted.current[kind];
        await lk.applySettings(kind, back);
        setPrefsState((prev) => ({ ...prev, [kind]: back }));
        savePrefs(kind, back);
      });
    },
    [myLive, lk, api],
  );

  const stop = useCallback(
    async (kind: StreamKind) => {
      await lk.stop(kind);
      await api.stop(kind);
    },
    [lk, api],
  );

  // The API lost a stream I'm still sending (it restarted, and every deploy restarts
  // it): register it again. If the places filled up meanwhile, stop sending it; any
  // other failure (the API still starting) is tried again on the next poll.
  const registering = useRef<Record<StreamKind, boolean>>({ screen: false, camera: false });
  useEffect(() => {
    if (!loaded || !seated) return;
    for (const kind of KINDS) {
      if (!lk.publishing[kind] || myLive[kind] || starting.current[kind] || registering.current[kind]) continue;
      const connection = lk.connectionOf(kind);
      if (!connection) continue;
      registering.current[kind] = true;
      void api
        .start(kind, connection, accepted.current[kind])
        .then((outcome) => (outcome === "full" ? lk.stop(kind) : undefined))
        .finally(() => {
          registering.current[kind] = false;
        });
    }
  }, [loaded, seated, lk, myLive, api]);

  // The API lists a stream of mine that nothing is sending (the browser's own "Stop
  // sharing" bar, the camera going away, or a page reload): end it.
  useEffect(() => {
    if (lk.connection !== "connected" || api.busy) return;
    for (const kind of KINDS) {
      if (myLive[kind] && !lk.publishing[kind] && !starting.current[kind]) void api.stop(kind);
    }
  }, [myLive, lk.connection, lk.publishing, api]);

  return {
    me,
    people,
    knownPeople,
    sharers,
    mine: myLive,
    free: api.state?.free ?? 6,
    prefs,
    setPrefs,
    pending,
    confirm: (chosen: SharePrefs) => void confirm(chosen),
    cancelPending,
    start: (kind: StreamKind) => void start(kind),
    stop: (kind: StreamKind) => void stop(kind),
    changeScreen: () => void changeScreen(),
    cameras: lk.cameras,
    cameraId: lk.cameraId,
    pickCamera: (deviceId: string) => void lk.pickCamera(deviceId, prefs.camera),
    // Only while my screen is actually going out.
    noSound: noSound && myLive.screen && lk.publishing.screen,
    seated,
    participantSid: lk.participantSid,
    activity,
    seats: api.state?.seats ?? null,
    watchingOf,
    connection: lk.connection,
    error: api.error ?? lk.error,
    busy: api.busy || isStarting || isChanging,
  };
}
