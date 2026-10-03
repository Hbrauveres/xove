import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState as LkState,
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  type LocalTrack,
  type Participant,
  type RemoteTrackPublication,
} from "livekit-client";
import { ApiError, api } from "../api/client";
import type { SharingConnection } from "../api/types";
import type { SharePrefs } from "../media/preferences";
import { SHARE_QUALITIES, screenCaptureOptions, screenPublishOptions } from "../media/shareSettings";
import type { ActivityEvent, ConnectionState, MediaTrack, ScreenTracks } from "../types";

export type RoomPerson = { identity: string; name: string };

/** A share that just started: where it comes from, and whether the browser gave its sound. */
export type StartedShare = SharingConnection & { hasSound: boolean };

/**
 * A quality change in progress: the screen is already being sent again with the new
 * settings (`connection`). `finish` stops the old one; `cancel` drops the new one.
 */
export type ShareChange = {
  connection: SharingConnection;
  finish: () => Promise<void>;
  cancel: () => Promise<void>;
};

export type LiveKitRoom = {
  connection: ConnectionState;
  /** Everyone else in the room, in the order they arrived. */
  others: RoomPerson[];
  /** Shared screens by identity ("user-42"). */
  screens: Record<string, ScreenTracks>;
  /** True while this browser is sending its screen. */
  publishing: boolean;
  /** This browser's own screen, for the sharer's preview. */
  localScreen: MediaTrack | undefined;
  /** Joins and leaves seen since this page connected. */
  presence: ActivityEvent[];
  error: string | null;
  /**
   * Opens the browser's screen picker and sends the screen with these settings.
   * Resolves with the connection and track that are now sharing, or null if the
   * person cancelled.
   */
  startScreenShare: (prefs: SharePrefs) => Promise<StartedShare | null>;
  /**
   * Sends the same captured screen again with new settings, without opening the
   * picker. Resolves with the change to finish once the API knows the new track,
   * or null if there's nothing being shared or it failed.
   */
  changeScreenShare: (prefs: SharePrefs) => Promise<ShareChange | null>;
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
  const [localScreen, setLocalScreen] = useState<MediaTrack | undefined>(undefined);
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
      const publication = p.getTrackPublication(Track.Source.ScreenShare) as RemoteTrackPublication | undefined;
      const video = publication?.track;
      const audio = p.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
      if (video || audio) {
        next[p.identity] = {
          video,
          audio,
          height: publication?.dimensions?.height,
          setQuality: (quality) => {
            if (!publication) return;
            const preset = SHARE_QUALITIES.find((q) => q.id === quality);
            // A fixed quality caps what the server sends this viewer; Auto lets adaptive
            // stream pick what fits the player and the connection.
            if (preset) publication.setVideoDimensions({ width: preset.width, height: preset.height });
            else publication.setVideoQuality(VideoQuality.HIGH);
          },
        };
      }
    }
    setScreens(next);
    setPublishing(room.localParticipant.isScreenShareEnabled);
    setLocalScreen(room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track);
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

  const startScreenShare = useCallback(async (prefs: SharePrefs) => {
    const room = roomRef.current;
    if (!room) {
      setError("Not connected to the video server yet.");
      return null;
    }
    try {
      setError(null);
      await room.localParticipant.setScreenShareEnabled(
        true,
        screenCaptureOptions(prefs.quality, prefs.mode),
        screenPublishOptions(prefs.quality, prefs.mode),
      );
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
      const hasSound = local.getTrackPublication(Track.Source.ScreenShareAudio) !== undefined;
      return { participantSid: local.sid, trackSid, hasSound };
    } catch (e) {
      // Closing the browser's picker is a choice, not an error.
      if (e instanceof DOMException && e.name === "NotAllowedError") return null;
      setError("Couldn't start sharing your screen.");
      return null;
    }
  }, [sync]);

  const changeScreenShare = useCallback(
    async (prefs: SharePrefs): Promise<ShareChange | null> => {
      const room = roomRef.current;
      const local = room?.localParticipant;
      const current = local?.getTrackPublication(Track.Source.ScreenShare)?.track as LocalTrack | undefined;
      if (!room || !local || !current) return null;
      try {
        // A copy of the same capture keeps the screen alive while the old track goes,
        // and the browser's picker doesn't open again.
        const capture = current.mediaStreamTrack.clone();
        const preset = SHARE_QUALITIES.find((q) => q.id === prefs.quality) ?? SHARE_QUALITIES[0];
        capture.contentHint = prefs.mode === "smooth" ? "motion" : "detail";
        await capture.applyConstraints({ width: preset.width, height: preset.height, frameRate: preset.fps }).catch(() => {
          /* The browser keeps the old size: the new layers still cap what's sent. */
        });
        const next = await local.publishTrack(capture, {
          ...screenPublishOptions(prefs.quality, prefs.mode),
          source: Track.Source.ScreenShare,
          name: "screen",
        });
        sync();
        if (!local.sid || !next.trackSid) {
          await local.unpublishTrack(next.track as LocalTrack);
          sync();
          return null;
        }
        return {
          connection: { participantSid: local.sid, trackSid: next.trackSid },
          finish: async () => {
            await local.unpublishTrack(current);
            sync();
          },
          cancel: async () => {
            await local.unpublishTrack(next.track as LocalTrack);
            sync();
          },
        };
      } catch {
        setError("Couldn't change the quality. Your screen is still being shared as before.");
        return null;
      }
    },
    [sync],
  );

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(false);
    sync();
  }, [sync]);

  return {
    connection,
    others,
    screens,
    publishing,
    localScreen,
    presence,
    error,
    startScreenShare,
    changeScreenShare,
    stopScreenShare,
  };
}
