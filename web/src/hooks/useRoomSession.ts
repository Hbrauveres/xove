import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSharePrefs, saveSharePrefs, type SharePrefs } from "../media/preferences";
import type { ActivityEvent, ActivityKind, ConnectionState, Friend, MediaTrack, ScreenTracks, ShareState } from "../types";
import { useLiveKitRoom } from "./useLiveKitRoom";
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
  /** The quality and mode I send (remembered); changing them while sharing resends the screen. */
  sharePrefs: SharePrefs;
  setSharePrefs: (prefs: SharePrefs) => void;
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

  const shareScreen = useCallback(async () => {
    starting.current = true;
    setStarting(true);
    try {
      // The picker first: browsers only open it straight from a click.
      const sharing = await lk.startScreenShare(sharePrefs);
      if (!sharing) return;
      const { hasSound, ...connection } = sharing;
      const ok = await slot.take(connection);
      if (!ok) await lk.stopScreenShare();
      else setNoSound(!hasSound);
    } finally {
      starting.current = false;
      setStarting(false);
    }
  }, [lk, slot, sharePrefs]);

  // A new quality or mode while sharing: send the screen again with it, tell the
  // API the new track (so the old one going away doesn't free the slot), then
  // stop the old one. Viewers see a short reload.
  // Resolves true when the screen now goes out with the new settings.
  const changeShare = useCallback(
    async (prefs: SharePrefs) => {
      starting.current = true;
      setStarting(true);
      try {
        const change = await lk.changeScreenShare(prefs);
        if (!change) return false;
        const ok = await slot.take(change.connection);
        if (ok) await change.finish();
        else await change.cancel();
        return ok;
      } finally {
        starting.current = false;
        setStarting(false);
      }
    },
    [lk, slot],
  );

  const setSharePrefs = useCallback(
    (prefs: SharePrefs) => {
      const before = sharePrefs;
      setPrefsState(prefs);
      saveSharePrefs(prefs);
      if (!(mine && lk.publishing)) return;
      void changeShare(prefs).then((ok) => {
        // The old settings are still the ones going out: show and keep those.
        if (ok) return;
        setPrefsState(before);
        saveSharePrefs(before);
      });
    },
    [mine, lk.publishing, changeShare, sharePrefs],
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
