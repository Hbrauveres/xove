import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState as LkState, Room, RoomEvent, Track, type Participant } from "livekit-client";
import { ApiError, api } from "../api/client";
import type { SharingConnection } from "../api/types";
import type { ActivityEvent, ConnectionState, ScreenTracks } from "../types";

export type RoomPerson = { identity: string; name: string };

export type LiveKitRoom = {
  connection: ConnectionState;
  /** Everyone else in the room, in the order they arrived. */
  others: RoomPerson[];
  /** Shared screens by identity ("user-42"). */
  screens: Record<string, ScreenTracks>;
  /** True while this browser is sending its screen. */
  publishing: boolean;
  /** Joins and leaves seen since this page connected. */
  presence: ActivityEvent[];
  error: string | null;
  /**
   * Opens the browser's screen picker. Resolves with the connection and track
   * that are now sharing, or null if the person cancelled.
   */
  startScreenShare: () => Promise<SharingConnection | null>;
  stopScreenShare: () => Promise<void>;
};

const CONNECTION: Record<LkState, ConnectionState> = {
  [LkState.Connecting]: "connecting",
  [LkState.Connected]: "connected",
  [LkState.Reconnecting]: "reconnecting",
  [LkState.SignalReconnecting]: "reconnecting",
  [LkState.Disconnected]: "disconnected",
};

let presenceSeq = 0;
const presenceEvent = (kind: "joined" | "left", actorId: string): ActivityEvent => ({
  id: `lk${++presenceSeq}`,
  at: Date.now(),
  kind,
  actorId,
});

const nameOf = (p: Participant) => p.name || p.identity;

/**
 * Joins the LiveKit room for as long as the component is mounted: gets a token
 * from the API, connects, and keeps React state in step with who is there and
 * which screens are being shared.
 */
export function useLiveKitRoom(): LiveKitRoom {
  const roomRef = useRef<Room | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [others, setOthers] = useState<RoomPerson[]>([]);
  const [screens, setScreens] = useState<Record<string, ScreenTracks>>({});
  const [publishing, setPublishing] = useState(false);
  const [presence, setPresence] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Read the whole picture from the Room after any change, instead of
  // patching state event by event. Simpler, and it can't drift.
  const sync = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const people = [...room.remoteParticipants.values()];
    setOthers(people.map((p) => ({ identity: p.identity, name: nameOf(p) })));

    const next: Record<string, ScreenTracks> = {};
    for (const p of people) {
      const video = p.getTrackPublication(Track.Source.ScreenShare)?.track;
      const audio = p.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
      if (video || audio) next[p.identity] = { video, audio };
    }
    setScreens(next);
    setPublishing(room.localParticipant.isScreenShareEnabled);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });

    room
      .on(RoomEvent.ConnectionStateChanged, (state: LkState) => setConnection(CONNECTION[state]))
      .on(RoomEvent.ParticipantConnected, (p: Participant) => {
        setPresence((prev) => [...prev.slice(-29), presenceEvent("joined", p.identity)]);
        sync();
      })
      .on(RoomEvent.ParticipantDisconnected, (p: Participant) => {
        setPresence((prev) => [...prev.slice(-29), presenceEvent("left", p.identity)]);
        sync();
      })
      .on(RoomEvent.TrackSubscribed, sync)
      .on(RoomEvent.TrackUnsubscribed, sync)
      .on(RoomEvent.LocalTrackPublished, sync)
      // Also fires when the person clicks the browser's own "Stop sharing" bar.
      .on(RoomEvent.LocalTrackUnpublished, sync);

    (async () => {
      try {
        const access = await api.liveKitToken();
        if (cancelled) return;
        roomRef.current = room;
        await room.connect(access.url, access.token);
        if (cancelled) return;
        setConnection("connected");
        sync();
      } catch (e) {
        if (cancelled) return;
        setConnection("disconnected");
        setError(e instanceof ApiError ? e.message : "Couldn't connect to the video server.");
      }
    })();

    return () => {
      cancelled = true;
      roomRef.current = null;
      void room.disconnect();
    };
  }, [sync]);

  const startScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      setError("Not connected to the video server yet.");
      return null;
    }
    try {
      setError(null);
      await room.localParticipant.setScreenShareEnabled(true, { audio: true, selfBrowserSurface: "exclude" });
      sync();
      const local = room.localParticipant;
      if (!local.isScreenShareEnabled) return null;
      const trackSid = local.getTrackPublication(Track.Source.ScreenShare)?.trackSid;
      if (!local.sid || !trackSid) {
        // The API needs both to free the slot when this share ends.
        await local.setScreenShareEnabled(false);
        sync();
        setError("Couldn't start sharing your screen.");
        return null;
      }
      return { participantSid: local.sid, trackSid };
    } catch (e) {
      // Closing the browser's picker is a choice, not an error.
      if (e instanceof DOMException && e.name === "NotAllowedError") return null;
      setError("Couldn't start sharing your screen.");
      return null;
    }
  }, [sync]);

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(false);
    sync();
  }, [sync]);

  return { connection, others, screens, publishing, presence, error, startScreenShare, stopScreenShare };
}
