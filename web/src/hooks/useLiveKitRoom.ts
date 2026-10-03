import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState as LkState,
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  type LocalAudioTrack,
  type LocalVideoTrack,
  type Participant,
  type RemoteTrackPublication,
} from "livekit-client";
import { ApiError, api } from "../api/client";
import type { SharingConnection } from "../api/types";
import type { SharePrefs } from "../media/preferences";
import {
  SHARE_QUALITIES,
  capOf,
  contentHintOf,
  degradationOf,
  screenCaptureOptions,
  screenPublishOptions,
  type ShareMode,
} from "../media/shareSettings";
import type { ActivityEvent, ConnectionState, MediaTrack, ScreenTracks } from "../types";

export type RoomPerson = { identity: string; name: string };

/** A share that just started: where it comes from, and whether the browser gave its sound. */
export type StartedShare = SharingConnection & { hasSound: boolean };

/** A screen the browser is capturing but not sending yet: the sharer is choosing how to send it. */
export type ScreenCapture = {
  video: LocalVideoTrack;
  /** Missing when the browser gave no sound. */
  audio?: LocalAudioTrack;
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
   * Opens the browser's screen picker and captures the screen, without sending it.
   * Resolves null if the person closed the picker.
   */
  captureScreen: (mode: ShareMode) => Promise<ScreenCapture | null>;
  /**
   * Sends a captured screen with these settings. Resolves with the connection and
   * track that are now sharing, or null if it couldn't (and then nothing is sent).
   */
  publishCapture: (capture: ScreenCapture, prefs: SharePrefs) => Promise<StartedShare | null>;
  /** Stops a capture that was never sent. */
  discardCapture: (capture: ScreenCapture) => void;
  /** Changes the quality cap and the mode of the screen being sent, live: no reload for viewers. */
  applyShareSettings: (prefs: SharePrefs) => Promise<void>;
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
          layers: publication?.trackInfo?.layers?.length || undefined,
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

  const captureScreen = useCallback(async (mode: ShareMode): Promise<ScreenCapture | null> => {
    const room = roomRef.current;
    if (!room) {
      setError("Not connected to the video server yet.");
      return null;
    }
    try {
      setError(null);
      // Always the best quality: the sharer can lower it, or raise it back, while sharing.
      const tracks = await room.localParticipant.createScreenTracks(screenCaptureOptions(mode));
      const video = tracks.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
      const audio = tracks.find((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;
      if (!video) {
        tracks.forEach((t) => t.stop());
        setError("Couldn't start sharing your screen.");
        return null;
      }
      return { video, audio };
    } catch (e) {
      // Closing the browser's picker is a choice, not an error.
      if (e instanceof DOMException && e.name === "NotAllowedError") return null;
      setError("Couldn't start sharing your screen.");
      return null;
    }
  }, []);

  const discardCapture = useCallback((capture: ScreenCapture) => {
    capture.video.stop();
    capture.audio?.stop();
  }, []);

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(false);
    sync();
  }, [sync]);

  const publishCapture = useCallback(
    async (capture: ScreenCapture, prefs: SharePrefs): Promise<StartedShare | null> => {
      const room = roomRef.current;
      if (!room) {
        discardCapture(capture);
        setError("Not connected to the video server yet.");
        return null;
      }
      const local = room.localParticipant;
      try {
        const options = screenPublishOptions(prefs.mode);
        capture.video.mediaStreamTrack.contentHint = contentHintOf(prefs.mode);
        const video = await local.publishTrack(capture.video, { ...options, source: Track.Source.ScreenShare });
        if (capture.audio) await local.publishTrack(capture.audio, { ...options, source: Track.Source.ScreenShareAudio });
        capture.video.setPublishingQuality(capOf(prefs.quality));
        sync();
        if (!local.sid || !video.trackSid) {
          // The API needs both to free the slot when this share ends.
          await stopScreenShare();
          setError("Couldn't start sharing your screen.");
          return null;
        }
        return { participantSid: local.sid, trackSid: video.trackSid, hasSound: capture.audio !== undefined };
      } catch {
        await stopScreenShare();
        discardCapture(capture);
        setError("Couldn't start sharing your screen.");
        return null;
      }
    },
    [sync, stopScreenShare, discardCapture],
  );

  const applyShareSettings = useCallback(async (prefs: SharePrefs) => {
    const track = roomRef.current?.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as
      | LocalVideoTrack
      | undefined;
    if (!track) return;
    track.mediaStreamTrack.contentHint = contentHintOf(prefs.mode);
    // Viewers' apps also stop asking for more than the cap (they read it from the
    // API), so LiveKit stops sending the layers above it (dynacast).
    track.setPublishingQuality(capOf(prefs.quality));
    await track.setDegradationPreference(degradationOf(prefs.mode)).catch(() => {
      /* An older browser keeps the previous preference; the content hint still applies. */
    });
  }, []);

  return {
    connection,
    others,
    screens,
    publishing,
    localScreen,
    presence,
    error,
    captureScreen,
    publishCapture,
    discardCapture,
    applyShareSettings,
    stopScreenShare,
  };
}
