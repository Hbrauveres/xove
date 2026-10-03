import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSharePrefs, saveSharePrefs, type SharePrefs } from "../media/preferences";
import type { ActivityEvent, ActivityKind, ConnectionState, Friend, MediaTrack, ScreenTracks, ShareState } from "../types";
import type { StreamSettings } from "../api/types";
import { useLiveKitRoom, type ScreenCapture } from "./useLiveKitRoom";
import { useScreenSlot } from "./useScreenSlot";

/**
 * Everything the room page shows, from two sources:
 * - the API decides who holds the screen slot (useScreenSlot);
 * - LiveKit carries the video and knows who is connected (useLiveKitRoom).
 */
export type RoomSession = {
  me: Friend;
  /** Me first, then everyone connected to the room. */
  people: Friend[];
  /** Everyone the feed may mention, including people who already left. */
  knownPeople: Friend[];
  share: ShareState;
  sharer: Friend | null;
  isMeSharing: boolean;
  /** The sharer's video and audio, when it's someone else and it has arrived. */
  screen: ScreenTracks | null;
  /** My own screen while I share, for the preview. */
  myScreen: MediaTrack | undefined;
  /** The quality and mode I send (remembered); changing them while sharing applies live. */
  sharePrefs: SharePrefs;
  setSharePrefs: (prefs: SharePrefs) => void;
  /** What the current share is sent with, as the API says (for viewers' quality menus). */
  streamSettings: StreamSettings | null;
  /** A screen I picked but haven't started sending: the setup window shows it. */
  pendingShare: ScreenCapture | null;
  /** Starts sending the picked screen with these settings. */
  confirmShare: (prefs: SharePrefs) => void;
  /** Drops the picked screen without sending it. */
  cancelShare: () => void;
  /** I'm sharing, but my browser gave no sound with the screen. */
  noSound: boolean;
  activity: ActivityEvent[];
  connection: ConnectionState;
  startSharing: () => void;
  stop: () => void;
  error: string | null;
  busy: boolean;
};

export const identityOf = (userId: number) => `user-${userId}`;

/** Same person, same colour, in every browser. */
const hueOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || "Someone";

const person = (id: string, name: string | null | undefined): Friend => ({
  id,
  name: firstName(name),
  hue: hueOf(id),
  online: true,
});

let slotSeq = 0;
const slotEvent = (kind: ActivityKind, actorId: string, targetId?: string): ActivityEvent => ({
  id: `slot${++slotSeq}`,
  at: Date.now(),
  kind,
  actorId,
  targetId,
});

export function useRoomSession(me: Friend, pollMs?: number): RoomSession {
  const slot = useScreenSlot(pollMs);
  const lk = useLiveKitRoom();

  // Every poll returns a new object, so memos key on the plain values inside it.
  const holder = slot.state?.holder ?? null;
  const mine = slot.state?.mine ?? false;
  const holderId = holder?.userId ?? null;
  const holderName = holder?.name ?? null;
  const since = holder?.since ?? null;
  const holderIdentity = holderId === null ? null : identityOf(holderId);

  const sharer = useMemo<Friend | null>(() => {
    if (holderIdentity === null) return null;
    return mine ? me : person(holderIdentity, holderName);
  }, [holderIdentity, holderName, mine, me]);

  const share = useMemo<ShareState>(
    () => (sharer && since ? { sharerId: sharer.id, startedAt: Date.parse(since) } : null),
    [sharer, since],
  );

  const people = useMemo(() => [me, ...lk.others.map((o) => person(o.identity, o.name))], [me, lk.others]);

  // People who were here or shared earlier, so the feed can still name them.
  const [seen, setSeen] = useState<Friend[]>([]);
  useEffect(() => {
    const fresh = [...people.slice(1), ...(sharer && !mine ? [sharer] : [])];
    setSeen((prev) => {
      const missing = fresh.filter((f) => !prev.some((p) => p.id === f.id));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, [people, sharer, mine]);
  const knownPeople = useMemo(
    () => [...people, ...seen.filter((s) => !people.some((p) => p.id === s.id))],
    [people, seen],
  );

  // Turn changes of the slot into feed events. The first answer is the
  // starting point, not a change, so it logs nothing.
  const [slotEvents, setSlotEvents] = useState<ActivityEvent[]>([]);
  const previous = useRef<string | null | undefined>(undefined);
  const loaded = slot.state !== null;
  const sharerId = sharer?.id ?? null;
  useEffect(() => {
    if (!loaded) return;
    const before = previous.current;
    previous.current = sharerId;
    if (before === undefined || before === sharerId) return;

    let event: ActivityEvent;
    if (before === null && sharerId) event = slotEvent("started", sharerId);
    else if (before && sharerId === null) event = slotEvent("stopped", before);
    else event = slotEvent("took", sharerId as string, before as string);
    setSlotEvents((prev) => [...prev.slice(-29), event]);
  }, [loaded, sharerId]);

  const activity = useMemo(
    () => [...lk.presence, ...slotEvents].sort((a, b) => a.at - b.at),
    [lk.presence, slotEvents],
  );

  // ---- keeping the slot and the video in step ----

  // True between opening the picker and the API confirming the slot.
  const starting = useRef(false);
  const [isStarting, setStarting] = useState(false);
  const [sharePrefs, setPrefsState] = useState<SharePrefs>(loadSharePrefs);
  const [noSound, setNoSound] = useState(false);

  const [pendingShare, setPendingState] = useState<ScreenCapture | null>(null);
  // Also kept in a ref, so leaving the page can stop a capture that was never sent.
  const pendingRef = useRef<ScreenCapture | null>(null);
  const setPendingShare = useCallback((capture: ScreenCapture | null) => {
    pendingRef.current = capture;
    setPendingState(capture);
  }, []);

  // The settings the API last accepted for my share: what a refused change goes back to.
  const accepted = useRef<SharePrefs>(sharePrefs);
  // Changes made while sharing run one after the other, in the order they were made.
  const changes = useRef<Promise<void>>(Promise.resolve());
  const latestChange = useRef(0);

  // Step 1, from the click: the browser's picker. The screen is captured, not sent.
  const shareScreen = useCallback(async () => {
    starting.current = true;
    setStarting(true);
    try {
      const capture = await lk.captureScreen(sharePrefs.mode);
      if (capture) setPendingShare(capture);
    } finally {
      starting.current = false;
      setStarting(false);
    }
  }, [lk, sharePrefs.mode, setPendingShare]);

  // Step 2, from the setup window: send it with the chosen settings, then take the slot.
  const confirmShare = useCallback(
    async (prefs: SharePrefs) => {
      const capture = pendingShare;
      if (!capture) return;
      setPendingShare(null);
      setPrefsState(prefs);
      saveSharePrefs(prefs);
      starting.current = true;
      setStarting(true);
      try {
        const sharing = await lk.publishCapture(capture, prefs);
        if (!sharing) return;
        const { hasSound, ...connection } = sharing;
        const ok = await slot.take(connection, prefs);
        if (!ok) {
          await lk.stopScreenShare();
          return;
        }
        accepted.current = prefs;
        setNoSound(!hasSound);
      } finally {
        starting.current = false;
        setStarting(false);
      }
    },
    [lk, slot, pendingShare, setPendingShare],
  );

  const cancelShare = useCallback(() => {
    if (pendingShare) lk.discardCapture(pendingShare);
    setPendingShare(null);
  }, [lk, pendingShare, setPendingShare]);

  // The browser's own "Stop sharing" bar while the setup window is open: stop the
  // sound as well, and close the window.
  useEffect(() => {
    const capture = pendingShare;
    const track = capture?.video.mediaStreamTrack;
    if (!capture || !track) return;
    const ended = () => {
      lk.discardCapture(capture);
      setPendingShare(null);
    };
    track.addEventListener("ended", ended);
    return () => track.removeEventListener("ended", ended);
  }, [pendingShare, lk, setPendingShare]);

  // Leaving the page with the setup window open: nothing was sent, so stop capturing.
  const discardCapture = lk.discardCapture;
  useEffect(
    () => () => {
      if (pendingRef.current) discardCapture(pendingRef.current);
    },
    [discardCapture],
  );

  // While sharing, a new quality or mode applies live: LiveKit right away, and the
  // API, which tells every viewer's app on its next poll. Changes go one after the
  // other; if the API refuses the latest one, the last accepted settings go back.
  const setSharePrefs = useCallback(
    (prefs: SharePrefs) => {
      setPrefsState(prefs);
      saveSharePrefs(prefs);
      if (!(mine && lk.publishing)) return;
      const change = ++latestChange.current;
      changes.current = changes.current.then(async () => {
        await lk.applyShareSettings(prefs);
        if (await slot.changeSettings(prefs)) {
          accepted.current = prefs;
          return;
        }
        if (change !== latestChange.current) return; // a newer change follows
        await lk.applyShareSettings(accepted.current);
        setPrefsState(accepted.current);
        saveSharePrefs(accepted.current);
      });
    },
    [mine, lk, slot],
  );

  const stop = useCallback(async () => {
    await lk.stopScreenShare();
    await slot.release();
  }, [lk, slot]);

  // Someone took the screen from me: stop sending mine.
  useEffect(() => {
    if (loaded && lk.publishing && !mine && !starting.current) void lk.stopScreenShare();
  }, [loaded, lk.publishing, mine, lk]);

  // The slot says I'm sharing but nothing is being sent (the browser's own
  // "Stop sharing" bar, or a page reload): give the slot back.
  useEffect(() => {
    if (mine && lk.connection === "connected" && !lk.publishing && !starting.current && !slot.busy) {
      void slot.release();
    }
  }, [mine, lk.connection, lk.publishing, slot]);

  return {
    me,
    people,
    knownPeople,
    share,
    sharer,
    isMeSharing: mine,
    screen: holderIdentity && !mine ? lk.screens[holderIdentity] ?? null : null,
    myScreen: mine ? lk.localScreen : undefined,
    sharePrefs,
    setSharePrefs,
    streamSettings: slot.state?.settings ?? null,
    pendingShare,
    confirmShare: (prefs: SharePrefs) => void confirmShare(prefs),
    cancelShare,
    // Only while my screen is actually going out.
    noSound: noSound && mine && lk.publishing,
    activity,
    connection: lk.connection,
    startSharing: () => void shareScreen(),
    stop: () => void stop(),
    error: slot.error ?? lk.error,
    busy: slot.busy || isStarting,
  };
}
