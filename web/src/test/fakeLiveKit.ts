/**
 * Stand-in for the "livekit-client" package in tests (jsdom has no WebRTC).
 * Same names the app imports; each Room remembers itself in `rooms` so a test
 * can play the other people: `lastRoom().join("user-7", "Bruno")`.
 */
import { vi } from "vitest";

export const RoomEvent = {
  ConnectionStateChanged: "connectionStateChanged",
  ParticipantConnected: "participantConnected",
  ParticipantDisconnected: "participantDisconnected",
  TrackPublished: "trackPublished",
  TrackUnpublished: "trackUnpublished",
  TrackSubscribed: "trackSubscribed",
  TrackUnsubscribed: "trackUnsubscribed",
  LocalTrackPublished: "localTrackPublished",
  LocalTrackUnpublished: "localTrackUnpublished",
} as const;

export const VideoQuality = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

export const ConnectionState = {
  Disconnected: "disconnected",
  Connecting: "connecting",
  Connected: "connected",
  Reconnecting: "reconnecting",
  SignalReconnecting: "signalReconnecting",
} as const;

export const Track = {
  Kind: { Video: "video", Audio: "audio" },
  Source: {
    Camera: "camera",
    Microphone: "microphone",
    ScreenShare: "screen_share",
    ScreenShareAudio: "screen_share_audio",
    Unknown: "unknown",
  },
} as const;

export class FakeTrack {
  readonly attached: HTMLMediaElement[] = [];
  attach(element: HTMLMediaElement) {
    this.attached.push(element);
    return element;
  }
  detach(element: HTMLMediaElement) {
    this.attached.splice(this.attached.indexOf(element), 1);
    return element;
  }
}

/** The browser's captured screen, as a MediaStreamTrack. */
export class FakeMediaStreamTrack {
  contentHint = "";
  stopped = false;
  readonly listeners: (() => void)[] = [];
  addEventListener(event: string, listener: () => void) {
    if (event === "ended") this.listeners.push(listener);
  }
  removeEventListener(event: string, listener: () => void) {
    if (event === "ended") this.listeners.splice(this.listeners.indexOf(listener), 1);
  }
  /** The browser ended the capture (its own "Stop sharing" bar). */
  end() {
    this.stopped = true;
    for (const listener of [...this.listeners]) listener();
  }
  stop() {
    this.stopped = true;
  }
}

/** A track this browser captured: the screen, or its sound. */
export class FakeLocalTrack extends FakeTrack {
  readonly mediaStreamTrack: FakeMediaStreamTrack;
  readonly kind: "video" | "audio";
  source: string;
  stopped = false;
  constructor(kind: "video" | "audio", source: string, mediaStreamTrack = new FakeMediaStreamTrack()) {
    super();
    this.kind = kind;
    this.source = source;
    this.mediaStreamTrack = mediaStreamTrack;
  }
  stop() {
    this.stopped = true;
    this.mediaStreamTrack.stop();
  }
}

/** The captured screen. */
export class FakeLocalScreenTrack extends FakeLocalTrack {
  readonly setPublishingQuality = vi.fn();
  readonly setDegradationPreference = vi.fn(async () => undefined);
  constructor(mediaStreamTrack = new FakeMediaStreamTrack(), source: string = Track.Source.ScreenShare) {
    super("video", source, mediaStreamTrack);
  }
}

/** The captured camera: a video track like the screen's, from another source. */
export class FakeLocalCameraTrack extends FakeLocalScreenTrack {
  constructor() {
    super(new FakeMediaStreamTrack(), Track.Source.Camera);
  }
}

/** The screen's video, wrapped by the app after the browser's picker. */
export class LocalVideoTrack extends FakeLocalScreenTrack {
  constructor(mediaStreamTrack: FakeMediaStreamTrack) {
    super(mediaStreamTrack, Track.Source.Unknown);
    rooms[rooms.length - 1]?.localParticipant.lastCapture.push(this);
  }
}

/** The screen's sound, wrapped by the app after the browser's picker. */
export class LocalAudioTrack extends FakeLocalTrack {
  constructor(mediaStreamTrack: FakeMediaStreamTrack) {
    super("audio", Track.Source.Unknown, mediaStreamTrack);
    rooms[rooms.length - 1]?.localParticipant.lastCapture.push(this);
  }
}

let publishSeq = 0;

/** What a viewer asks the server for, per screen or camera; and whether it downloads a sound. */
export type FakeRemotePublication = {
  track?: FakeTrack;
  dimensions?: { width: number; height: number };
  trackInfo?: { layers: unknown[] };
  setVideoQuality: ReturnType<typeof vi.fn>;
  setVideoDimensions: ReturnType<typeof vi.fn>;
  isSubscribed: boolean;
  setSubscribed: ReturnType<typeof vi.fn>;
};

export class FakeParticipant {
  readonly tracks = new Map<string, FakeTrack>();
  readonly publications = new Map<string, FakeRemotePublication>();
  readonly identity: string;
  readonly name: string;

  constructor(identity: string, name: string) {
    this.identity = identity;
    this.name = name;
  }
  getTrackPublication(source: string) {
    const publication = this.publications.get(source);
    if (publication) return publication;
    const track = this.tracks.get(source);
    return track ? { track } : undefined;
  }
}

type Handler = (...args: unknown[]) => void;

export class Room {
  readonly remoteParticipants = new Map<string, FakeParticipant>();
  readonly handlers = new Map<string, Handler[]>();
  connectedWith: { url: string; token: string } | null = null;
  disconnected = false;

  readonly localParticipant = {
    sid: "PA_me",
    /** The screen tracks this browser publishes. */
    screens: [] as { trackSid: string | undefined; track: FakeLocalScreenTrack; options?: unknown }[],
    /** Published with the screen when the picker gave sound. */
    screenAudio: null as { trackSid: string; track: FakeLocalTrack; options?: unknown } | null,
    /** The camera this browser publishes. */
    camera: null as { trackSid: string; track: FakeLocalCameraTrack; options?: unknown } | null,
    /** Tests set this to an error name ("NotAllowedError", "NotFoundError") to play the camera refused or missing. */
    nextCamera: "allow" as "allow" | "NotAllowedError" | "NotFoundError",
    /** The last camera captured (whether it was published or not). */
    lastCamera: null as FakeLocalCameraTrack | null,
    get isScreenShareEnabled() {
      return this.screens.length > 0;
    },
    /** Tests set this to undefined to play LiveKit not reporting the screen track. */
    screenTrackSid: "TR_my_screen" as string | undefined,
    /** Tests set this to false to play a browser or surface that gives no sound. */
    nextPickerAudio: true,
    /** Tests set this to "cancel" to play someone closing the browser's picker, "no-video" for a capture without a screen. */
    nextPicker: "share" as "share" | "cancel" | "no-video",
    /** The last screen captured (whether it was published or not). */
    lastCapture: [] as FakeLocalTrack[],
    getTrackPublication: (source: string) => {
      const local = this.localParticipant;
      if (source === Track.Source.ScreenShare) return local.screens[0];
      if (source === Track.Source.ScreenShareAudio) return local.screenAudio ?? undefined;
      if (source === Track.Source.Camera) return local.camera ?? undefined;
      return undefined;
    },
    /** The camera (never asked with a microphone by the app: tests check `audio: false`). */
    createTracks: vi.fn(async (_options?: { video?: unknown; audio?: unknown }) => {
      const local = this.localParticipant;
      if (local.nextCamera !== "allow") throw new DOMException("No camera", local.nextCamera);
      local.lastCamera = new FakeLocalCameraTrack();
      return [local.lastCamera];
    }),
    /**
     * The browser's picker (`navigator.mediaDevices.getDisplayMedia`, see setup.ts):
     * captures the screen (and its sound), sends nothing yet.
     */
    getDisplayMedia: vi.fn(async (_request?: unknown) => {
      const local = this.localParticipant;
      if (local.nextPicker === "cancel") throw new DOMException("Permission denied", "NotAllowedError");
      local.lastCapture = [];
      const video = local.nextPicker === "no-video" ? [] : [new FakeMediaStreamTrack()];
      const audio = local.nextPickerAudio ? [new FakeMediaStreamTrack()] : [];
      return { getVideoTracks: () => video, getAudioTracks: () => audio, getTracks: () => [...video, ...audio] };
    }),
    publishTrack: vi.fn(async (track: FakeLocalTrack, options?: unknown) => {
      const local = this.localParticipant;
      if (track instanceof FakeLocalCameraTrack) {
        local.camera = { trackSid: "TR_my_camera", track, options };
        this.emit(RoomEvent.LocalTrackPublished);
        return local.camera;
      }
      if (track instanceof FakeLocalScreenTrack) {
        const publication = {
          trackSid: local.screens.length === 0 ? local.screenTrackSid : `TR_my_screen_${++publishSeq}`,
          track,
          options,
        };
        local.screens.push(publication);
        this.emit(RoomEvent.LocalTrackPublished);
        return publication;
      }
      local.screenAudio = { trackSid: "TR_my_sound", track, options };
      this.emit(RoomEvent.LocalTrackPublished);
      return local.screenAudio;
    }),
    unpublishTrack: vi.fn(async (track: FakeLocalTrack) => {
      const local = this.localParticipant;
      local.screens = local.screens.filter((s) => s.track !== track);
      if (local.screenAudio?.track === track) local.screenAudio = null;
      if (local.camera?.track === track) local.camera = null;
      track.stop();
      this.emit(RoomEvent.LocalTrackUnpublished);
      return undefined;
    }),
    setScreenShareEnabled: vi.fn(async (enabled: boolean) => {
      const local = this.localParticipant;
      if (!enabled) {
        for (const s of local.screens) s.track.stop();
        local.screenAudio?.track.stop();
        local.screens = [];
        local.screenAudio = null;
        this.emit(RoomEvent.LocalTrackUnpublished);
      }
      return undefined;
    }),
  };

  /** Unlocks the page's sound (LiveKit's own, after a click). */
  readonly startAudio = vi.fn(async () => undefined);

  constructor() {
    rooms.push(this);
  }

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }

  async connect(url: string, token: string) {
    this.connectedWith = { url, token };
    this.emit(RoomEvent.ConnectionStateChanged, ConnectionState.Connected);
  }

  async disconnect() {
    this.disconnected = true;
  }

  // ---- what other people do, driven by tests ----

  join(identity: string, name: string) {
    const p = new FakeParticipant(identity, name);
    this.remoteParticipants.set(identity, p);
    this.emit(RoomEvent.ParticipantConnected, p);
    return p;
  }

  leave(identity: string) {
    const p = this.remoteParticipants.get(identity);
    this.remoteParticipants.delete(identity);
    this.emit(RoomEvent.ParticipantDisconnected, p);
  }

  private publication(track: FakeTrack | undefined, height?: number, layers?: number): FakeRemotePublication {
    const publication: FakeRemotePublication = {
      track,
      dimensions: height ? { width: Math.round((height * 16) / 9), height } : undefined,
      trackInfo: layers ? { layers: Array.from({ length: layers }, () => ({})) } : undefined,
      setVideoQuality: vi.fn(),
      setVideoDimensions: vi.fn(),
      isSubscribed: true,
      setSubscribed: vi.fn(),
    };
    return publication;
  }

  /** `layers`: how many qualities the sharer sends (1 for Firefox and Safari sharers). */
  publishScreen(identity: string, options: { height?: number; withSound?: boolean; layers?: number } = {}) {
    const p = this.remoteParticipants.get(identity) ?? this.join(identity, identity);
    const track = new FakeTrack();
    p.tracks.set(Track.Source.ScreenShare, track);
    p.publications.set(Track.Source.ScreenShare, this.publication(track, options.height ?? 1080, options.layers ?? 3));
    if (options.withSound) {
      const sound = new FakeTrack();
      const publication = this.publication(sound);
      // Turning the sound off or on downloads it or not, like LiveKit does.
      publication.setSubscribed.mockImplementation((on: boolean) => {
        publication.isSubscribed = on;
        publication.track = on ? sound : undefined;
        this.emit(on ? RoomEvent.TrackSubscribed : RoomEvent.TrackUnsubscribed, sound, publication, p);
      });
      p.tracks.set(Track.Source.ScreenShareAudio, sound);
      p.publications.set(Track.Source.ScreenShareAudio, publication);
      this.emit(RoomEvent.TrackSubscribed, sound, publication, p);
    }
    this.emit(RoomEvent.TrackSubscribed, track, {}, p);
    return track;
  }

  /** Someone turns on their camera: 720p with two layers unless said otherwise. */
  publishCamera(identity: string, options: { height?: number; layers?: number } = {}) {
    const p = this.remoteParticipants.get(identity) ?? this.join(identity, identity);
    const track = new FakeTrack();
    p.tracks.set(Track.Source.Camera, track);
    p.publications.set(Track.Source.Camera, this.publication(track, options.height ?? 720, options.layers ?? 2));
    this.emit(RoomEvent.TrackSubscribed, track, {}, p);
    return track;
  }

  /** Someone stops a screen, its sound or a camera. */
  unpublish(identity: string, source: string) {
    const p = this.remoteParticipants.get(identity);
    if (!p) return;
    p.tracks.delete(source);
    p.publications.delete(source);
    this.emit(RoomEvent.TrackUnsubscribed, undefined, {}, p);
  }

  /** What this browser asked the server for, for someone's screen. */
  screenPublication(identity: string) {
    return this.remoteParticipants.get(identity)?.publications.get(Track.Source.ScreenShare);
  }

  /** What this browser asked the server for, for someone's camera. */
  cameraPublication(identity: string) {
    return this.remoteParticipants.get(identity)?.publications.get(Track.Source.Camera);
  }

  /** Whether this browser downloads someone's screen sound. */
  soundPublication(identity: string) {
    return this.remoteParticipants.get(identity)?.publications.get(Track.Source.ScreenShareAudio);
  }

  /** The person clicked the browser's own "Stop sharing" bar. */
  browserStopsMyShare() {
    const local = this.localParticipant;
    for (const track of local.lastCapture) track.mediaStreamTrack.end();
    local.screens = [];
    local.screenAudio = null;
    this.emit(RoomEvent.LocalTrackUnpublished);
  }
}

export const rooms: Room[] = [];
export const lastRoom = () => {
  const room = rooms.at(-1);
  if (!room) throw new Error("No LiveKit room was created");
  return room;
};
