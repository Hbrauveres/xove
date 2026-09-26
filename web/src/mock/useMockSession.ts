import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActivityEvent,
  ActivityKind,
  ConnectionState,
  Friend,
  ScreenScene,
  ShareState,
  StreamStats,
} from "../types";
import { BASE_STATS, FRIENDS, ME } from "./mockData";

/**
 * Fake version of what the real app gets from the API + LiveKit.
 *
 * The component tree only talks to this hook's return value. When the real
 * backend exists, write a `useLiveSession` hook with the same shape and swap
 * it in App.tsx; no component needs to change.
 */
export type Session = {
  me: Friend;
  people: Friend[];
  share: ShareState;
  stats: StreamStats | null;
  activity: ActivityEvent[];
  connection: ConnectionState;
  isMeSharing: boolean;
  sharer: Friend | null;
  startSharing: () => void;
  takeScreen: () => void;
  stopSharing: () => void;
  simulate: {
    friendStarts: () => void;
    friendTakesFromMe: () => void;
    friendLeaves: () => void;
    friendJoins: () => void;
    connectionDrop: () => void;
  };
};

let eventSeq = 0;
const makeEvent = (kind: ActivityKind, actorId: string, targetId?: string): ActivityEvent => ({
  id: `e${++eventSeq}`,
  at: Date.now(),
  kind,
  actorId,
  targetId,
});

const pick = <T,>(items: T[]): T | undefined => items[Math.floor(Math.random() * items.length)];

const jitter = (base: StreamStats): StreamStats => ({
  ...base,
  bitrateMbps: Math.max(0.4, +(base.bitrateMbps * (0.85 + Math.random() * 0.3)).toFixed(1)),
  latencyMs: Math.round(base.latencyMs * (0.8 + Math.random() * 0.45)),
});

export function useMockSession(me: Friend = ME): Session {
  const [friends, setFriends] = useState<Friend[]>(FRIENDS);
  const [share, setShare] = useState<ShareState>(() => ({
    sharerId: "bruno",
    startedAt: Date.now() - 7 * 60 * 1000 - 12 * 1000,
    scene: "editor",
  }));
  const [stats, setStats] = useState<StreamStats | null>(() => jitter(BASE_STATS.editor));
  const [connection, setConnection] = useState<ConnectionState>("connected");
  const [activity, setActivity] = useState<ActivityEvent[]>(() => {
    const now = Date.now();
    return [
      { ...makeEvent("started", "bruno"), at: now - 7 * 60 * 1000 - 12 * 1000 },
      { ...makeEvent("joined", "duda"), at: now - 3 * 60 * 1000 },
      { ...makeEvent("joined", "me"), at: now - 20 * 1000 },
    ];
  });

  const shareRef = useRef(share);
  shareRef.current = share;

  const log = useCallback((kind: ActivityKind, actorId: string, targetId?: string) => {
    setActivity((prev) => [...prev.slice(-29), makeEvent(kind, actorId, targetId)]);
  }, []);

  const beginShare = useCallback(
    (sharerId: string, scene: ScreenScene) => {
      const current = shareRef.current;
      if (current && current.sharerId !== sharerId) log("took", sharerId, current.sharerId);
      else log("started", sharerId);
      setShare({ sharerId, startedAt: Date.now(), scene });
      setStats(jitter(BASE_STATS[scene]));
    },
    [log],
  );

  const endShare = useCallback(() => {
    const current = shareRef.current;
    if (!current) return;
    log("stopped", current.sharerId);
    setShare(null);
    setStats(null);
  }, [log]);

  // Stats wobble every 2 seconds while something is on stage, like real track stats.
  useEffect(() => {
    if (!share) return;
    const scene = share.scene;
    const timer = window.setInterval(() => setStats(jitter(BASE_STATS[scene])), 2000);
    return () => window.clearInterval(timer);
  }, [share]);

  const people = useMemo(() => [me, ...friends], [me, friends]);
  const sharer = share ? people.find((p) => p.id === share.sharerId) ?? null : null;
  const isMeSharing = share?.sharerId === me.id;

  const simulate = useMemo(
    () => ({
      friendStarts: () => {
        const candidate = pick(friends.filter((f) => f.online && f.id !== shareRef.current?.sharerId));
        if (candidate) beginShare(candidate.id, Math.random() < 0.5 ? "editor" : "game");
      },
      friendTakesFromMe: () => {
        if (shareRef.current?.sharerId !== me.id) return;
        const candidate = pick(friends.filter((f) => f.online));
        if (candidate) beginShare(candidate.id, "game");
      },
      friendLeaves: () => {
        const candidate = pick(friends.filter((f) => f.online));
        if (!candidate) return;
        if (shareRef.current?.sharerId === candidate.id) endShare();
        setFriends((prev) => prev.map((f) => (f.id === candidate.id ? { ...f, online: false } : f)));
        log("left", candidate.id);
      },
      friendJoins: () => {
        const candidate = pick(friends.filter((f) => !f.online));
        if (!candidate) return;
        setFriends((prev) => prev.map((f) => (f.id === candidate.id ? { ...f, online: true } : f)));
        log("joined", candidate.id);
      },
      connectionDrop: () => {
        setConnection("reconnecting");
        window.setTimeout(() => setConnection("connected"), 3000);
      },
    }),
    [friends, beginShare, endShare, log],
  );

  return {
    me,
    people,
    share,
    stats,
    activity,
    connection,
    isMeSharing,
    sharer,
    startSharing: () => beginShare(me.id, "desktop"),
    takeScreen: () => beginShare(me.id, "desktop"),
    stopSharing: endShare,
    simulate,
  };
}
