import { useEffect, useMemo, useRef, useState } from "react";
import { BASE_STATS } from "../mock/mockData";
import { useMockSession, type Session } from "../mock/useMockSession";
import type { ActivityEvent, ActivityKind, Friend, ShareState } from "../types";
import { useScreenSlot } from "./useScreenSlot";

/**
 * What the room shows. The screen slot is real (the API decides who shares);
 * the people list, connection and video are still the mock until LiveKit.
 */
export type RoomSession = Pick<Session, "me" | "people" | "share" | "stats" | "connection" | "isMeSharing" | "sharer"> & {
  activity: ActivityEvent[];
  /** Everyone the feed may mention, including past sharers no longer in `people`. */
  knownPeople: Friend[];
  take: () => void;
  stop: () => void;
  error: string | null;
  busy: boolean;
  simulate: Pick<Session["simulate"], "friendJoins" | "friendLeaves" | "connectionDrop">;
};

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || "Someone";

let eventSeq = 0;
const slotEvent = (kind: ActivityKind, actorId: string, targetId?: string): ActivityEvent => ({
  id: `slot${++eventSeq}`,
  at: Date.now(),
  kind,
  actorId,
  targetId,
});

export function useRoomSession(me: Friend, pollMs?: number): RoomSession {
  const mock = useMockSession(me);
  const slot = useScreenSlot(pollMs);

  // Every poll returns a new object, so memos key on the plain values inside it.
  const holder = slot.state?.holder ?? null;
  const mine = slot.state?.mine ?? false;
  const holderId = holder?.userId ?? null;
  const holderName = holder?.name ?? null;
  const since = holder?.since ?? null;

  const sharer = useMemo<Friend | null>(() => {
    if (holderId === null) return null;
    if (mine) return me;
    return { id: `user-${holderId}`, name: firstName(holderName), hue: (holderId * 67) % 360, online: true };
  }, [holderId, holderName, mine, me]);

  const share = useMemo<ShareState>(
    () =>
      sharer && since
        ? { sharerId: sharer.id, startedAt: Date.parse(since), scene: mine ? "desktop" : "editor" }
        : null,
    [sharer, since, mine],
  );

  // Past sharers, so "Bruno stopped sharing" still has a name after Bruno is gone.
  const [seen, setSeen] = useState<Friend[]>([]);
  useEffect(() => {
    if (sharer && sharer.id !== me.id) {
      setSeen((prev) => [...prev.filter((p) => p.id !== sharer.id), sharer]);
    }
  }, [sharer, me.id]);

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

  const people = useMemo(
    () => (sharer && !mine && !mock.people.some((p) => p.id === sharer.id) ? [mock.people[0], sharer, ...mock.people.slice(1)] : mock.people),
    [sharer, mine, mock.people],
  );

  const knownPeople = useMemo(
    () => [...people, ...seen.filter((s) => !people.some((p) => p.id === s.id))],
    [people, seen],
  );

  // Only joins and leaves come from the mock; sharing events come from the API.
  const activity = useMemo(
    () =>
      [...mock.activity.filter((e) => e.kind === "joined" || e.kind === "left"), ...slotEvents].sort(
        (a, b) => a.at - b.at,
      ),
    [mock.activity, slotEvents],
  );

  return {
    me: mock.me,
    people,
    knownPeople,
    share,
    stats: share ? BASE_STATS[share.scene] : null,
    activity,
    connection: mock.connection,
    isMeSharing: mine,
    sharer,
    take: () => void slot.take(),
    stop: () => void slot.release(),
    error: slot.error,
    busy: slot.busy,
    simulate: {
      friendJoins: mock.simulate.friendJoins,
      friendLeaves: mock.simulate.friendLeaves,
      connectionDrop: mock.simulate.connectionDrop,
    },
  };
}
