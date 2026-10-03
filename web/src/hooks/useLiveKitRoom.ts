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
  type RemoteParticipant,
  type RemoteTrackPublication,
} from "livekit-client";
import { ApiError, api } from "../api/client";
import type { SharingConnection } from "../api/types";
import type { SharePrefs } from "../media/preferences";
import {
  SHARE_QUALITIES,
  cameraCaptureOptions,
  cameraPublishOptions,
  capOf,
  contentHintOf,
  degradationOf,
  screenCaptureOptions,
  screenPublishOptions,
  type ShareMode,
} from "../media/shareSettings";
import type { ActivityEvent, ConnectionState, MediaTrack, RemoteVideo, StreamKind } from "../types";

export type RoomPerson = { identity: string; name: string };

/** A stream that just started: where it comes from, and whether the browser gave its sound. */
export type StartedStream = SharingConnection & { hasSound: boolean };

/** A screen or camera the browser is capturing but not sending yet: its person is choosing how to send it. */
export type Capture = {
  kind: StreamKind;
  video: LocalVideoTrack;
  /** The screen's sound. Missing for a camera, or when the browser gave none. */
  audio?: LocalAudioTrack;
};

/** What this browser receives from someone else. */
export type RemoteMedia = {
  screen?: RemoteVideo;
  camera?: RemoteVideo;
  /** The sound of their screen, while it's downloaded. */
  sound?: MediaTrack;
  /** They share their screen's sound. */
  hasSound: boolean;
  /** Downloads the sound of their screen, or stops downloading it. */
  setSoundOn: (on: boolean) => void;
};

export type LiveKitRoom = {
  connection: ConnectionState;
  /** Everyone else in the room, in the order they arrived. */
  others: RoomPerson[];
  /** What others send, by identity ("user-42"). */
  remote: Record<string, RemoteMedia>;
  /** What this browser is sending. */
  publishing: Record<StreamKind, boolean>;
  /** This browser's own screen and camera, for the previews. */
  local: Partial<Record<StreamKind, MediaTrack>>;
  /** Joins and leaves seen since this page connected. */
  presence: ActivityEvent[];
  error: string | null;
  /**
   * Opens the browser's screen picker, or asks for the camera, and captures it without
   * sending it. Resolves null if the person closed the picker or refused.
   */
  capture: (kind: StreamKind, mode: ShareMode) => Promise<Capture | null>;
  /**
   * Sends a capture with these settings. Resolves with the connection and track that
   * are now sending, or null if it couldn't (and then nothing is sent).
   */
  publishCapture: (capture: Capture, prefs: SharePrefs) => Promise<StartedStream | null>;
  /** Stops a capture that was never sent. */
  discardCapture: (capture: Capture) => void;
  /** Changes the quality cap and the mode of a stream being sent, live: no reload for viewers. */
  applySettings: (kind: StreamKind, prefs: SharePrefs) => Promise<void>;
  stop: (kind: StreamKind) => Promise<void>;
  /** Where a stream I'm sending comes from, to register it again with the API. */
  connectionOf: (kind: StreamKind) => SharingConnection | null;
  /** This browser's connection to the room, once connected. */
  participantSid: () => string | undefined;
};

const CONNECTION: Record<LkState, ConnectionState> = {
  [LkState.Connecting]: "connecting",
  [LkState.Connected]: "connected",
  [LkState.Reconnecting]: "reconnecting",
  [LkState.SignalReconnecting]: "reconnecting",
  [LkState.Disconnected]: "disconnected",
};

const SOURCE = {
  screen: Track.Source.ScreenShare,
  camera: Track.Source.Camera,
} as const;

let presenceSeq = 0;
const presenceEvent = (kind: "joined" | "left", actorId: string): ActivityEvent => ({
  id: `lk${++presenceSeq}`,
  at: Date.now(),
  kind,
  actorId,
});

const nameOf = (p: Participant) => p.name || p.identity;

/** Someone's screen or camera, once its video arrives. */
function remoteVideo(p: RemoteParticipant, kind: StreamKind): RemoteVideo | undefined {
  const publication = p.getTrackPublication(SOURCE[kind]) as RemoteTrackPublication | undefined;
  const video = publication?.track;
  if (!publication || !video) return undefined;
  return {
    video,
    height: publication.dimensions?.height,
    layers: publication.trackInfo?.layers?.length || undefined,
    setQuality: (quality) => {
      const preset = SHARE_QUALITIES.find((q) => q.id === quality);
      // A fixed quality caps what the server sends this viewer; Auto lets adaptive
      // stream pick what fits the player and the connection.
      if (preset) publication.setVideoDimensions({ width: preset.width, height: preset.height });
      else publication.setVideoQuality(VideoQuality.HIGH);
    },
  };
}

/**
 * Joins the LiveKit room for as long as the component is mounted: gets a token
 * from the API, connects, and keeps React state in step with who is there and
 * which screens and cameras are being sent.
 */
export function useLiveKitRoom(): LiveKitRoom {
  const roomRef = useRef<Room | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [others, setOthers] = useState<RoomPerson[]>([]);
  const [remote, setRemote] = useState<Record<string, RemoteMedia>>({});
  const [publishing, setPublishing] = useState<Record<StreamKind, boolean>>({ screen: false, camera: false });
  const [local, setLocal] = useState<Partial<Record<StreamKind, MediaTrack>>>({});
  const [presence, setPresence] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Read the whole picture from the Room after any change, instead of
  // patching state event by event. Simpler, and it can't drift.
  const sync = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const people = [...room.remoteParticipants.values()];
    setOthers(people.map((p) => ({ identity: p.identity, name: nameOf(p) })));

    const next: Record<string, RemoteMedia> = {};
    for (const p of people) {
      const screen = remoteVideo(p, "screen");
      const camera = remoteVideo(p, "camera");
      const soundPublication = p.getTrackPublication(Track.Source.ScreenShareAudio) as RemoteTrackPublication | undefined;
      const sound = soundPublication?.track;
      if (screen || camera || soundPublication) {
        next[p.identity] = {
          screen,
          camera,
          sound,
          hasSound: Boolean(soundPublication),
          setSoundOn: (on) => {
            if (soundPublication && soundPublication.isSubscribed !== on) soundPublication.setSubscribed(on);
          },
        };
      }
    }
    setRemote(next);

    const me = room.localParticipant;
    const camera = me.getTrackPublication(Track.Source.Camera)?.track;
    setPublishing({ screen: me.isScreenShareEnabled, camera: Boolean(camera) });
    setLocal({ screen: me.getTrackPublication(Track.Source.ScreenShare)?.track, camera });
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
      .on(RoomEvent.TrackPublished, sync)
      .on(RoomEvent.TrackUnpublished, sync)
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

  const capture = useCallback(async (kind: StreamKind, mode: ShareMode): Promise<Capture | null> => {
    const room = roomRef.current;
    if (!room) {
      setError("Not connected to the video server yet.");
      return null;
    }
    const failed = kind === "screen" ? "Couldn't start sharing your screen." : "Couldn't turn on your camera.";
    try {
      setError(null);
      const tracks =
        kind === "screen"
          ? // Always the best quality: the sharer can lower it, or raise it back, while sharing.
            await room.localParticipant.createScreenTracks(screenCaptureOptions(mode))
          : await room.localParticipant.createTracks({ video: cameraCaptureOptions(), audio: false });
      const video = tracks.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
      const audio = tracks.find((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;
      if (!video) {
        tracks.forEach((t) => t.stop());
        setError(failed);
        return null;
      }
      return { kind, video, audio: kind === "screen" ? audio : undefined };
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        // Closing the browser's picker is a choice, not an error; a blocked camera needs a hint.
        if (kind === "camera") setError("Your browser didn't allow the camera. Allow it from the address bar and try again.");
        return null;
      }
      if (kind === "camera" && e instanceof DOMException && e.name === "NotFoundError") {
        setError("No camera found.");
        return null;
      }
      setError(failed);
      return null;
    }
  }, []);

  const discardCapture = useCallback((capture: Capture) => {
    capture.video.stop();
    capture.audio?.stop();
  }, []);

  const stop = useCallback(
    async (kind: StreamKind) => {
      const room = roomRef.current;
      if (!room) return;
      if (kind === "screen") {
        await room.localParticipant.setScreenShareEnabled(false);
      } else {
        // Turning a camera off unpublishes it (LiveKit's own "disable" only mutes it),
        // so the API hears that the stream ended.
        const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as
          | LocalVideoTrack
          | undefined;
        if (track) await room.localParticipant.unpublishTrack(track, true);
      }
      sync();
    },
    [sync],
  );

  const publishCapture = useCallback(
    async (capture: Capture, prefs: SharePrefs): Promise<StartedStream | null> => {
      const room = roomRef.current;
      const failed = capture.kind === "screen" ? "Couldn't start sharing your screen." : "Couldn't turn on your camera.";
      if (!room) {
        discardCapture(capture);
        setError("Not connected to the video server yet.");
        return null;
      }
      const me = room.localParticipant;
      try {
        const options = capture.kind === "screen" ? screenPublishOptions(prefs.mode) : cameraPublishOptions(prefs.mode);
        capture.video.mediaStreamTrack.contentHint = contentHintOf(prefs.mode);
        const video = await me.publishTrack(capture.video, { ...options, source: SOURCE[capture.kind] });
        if (capture.audio) await me.publishTrack(capture.audio, { ...options, source: Track.Source.ScreenShareAudio });
        capture.video.setPublishingQuality(capOf(prefs.quality));
        if (capture.kind === "camera") {
          // The camera unplugged or taken by another app: stop sending it.
          capture.video.mediaStreamTrack.addEventListener("ended", () => void stop("camera"));
        }
        sync();
        if (!me.sid || !video.trackSid) {
          // The API needs both to end the stream when it stops.
          await stop(capture.kind);
          setError(failed);
          return null;
        }
        return { participantSid: me.sid, trackSid: video.trackSid, hasSound: capture.audio !== undefined };
      } catch {
        await stop(capture.kind);
        discardCapture(capture);
        setError(failed);
        return null;
      }
    },
    [sync, stop, discardCapture],
  );

  const applySettings = useCallback(async (kind: StreamKind, prefs: SharePrefs) => {
    const track = roomRef.current?.localParticipant.getTrackPublication(SOURCE[kind])?.track as
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

  const connectionOf = useCallback((kind: StreamKind): SharingConnection | null => {
    const me = roomRef.current?.localParticipant;
    const trackSid = me?.getTrackPublication(SOURCE[kind])?.trackSid;
    return me?.sid && trackSid ? { participantSid: me.sid, trackSid } : null;
  }, []);

  const participantSid = useCallback(() => roomRef.current?.localParticipant.sid || undefined, []);

  return {
    connection,
    others,
    remote,
    publishing,
    local,
    presence,
    error,
    capture,
    publishCapture,
    discardCapture,
    applySettings,
    stop,
    connectionOf,
    participantSid,
  };
}
