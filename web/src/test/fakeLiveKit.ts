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
  constraints: MediaTrackConstraints | null = null;
  stopped = false;
  clone() {
    return new FakeMediaStreamTrack();
  }
  async applyConstraints(constraints: MediaTrackConstraints) {
    this.constraints = constraints;
  }
  stop() {
    this.stopped = true;
  }
}

/** A screen track this browser publishes. */
export class FakeLocalScreenTrack extends FakeTrack {
  readonly mediaStreamTrack: FakeMediaStreamTrack;
  constructor(mediaStreamTrack = new FakeMediaStreamTrack()) {
    super();
    this.mediaStreamTrack = mediaStreamTrack;
  }
}

let publishSeq = 0;

/** What a viewer asks the server for, per screen. */
export type FakeRemotePublication = {
  track: FakeTrack;
  dimensions?: { width: number; height: number };
  setVideoQuality: ReturnType<typeof vi.fn>;
  setVideoDimensions: ReturnType<typeof vi.fn>;
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
    const track = this.tracks.get(source);
    if (!track) return undefined;
    return this.publications.get(source) ?? { track };
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
    /** The screen tracks this browser is publishing (two for a moment while the quality changes). */
    screens: [] as { trackSid: string | undefined; track: FakeLocalScreenTrack; options?: unknown }[],
    /** Published with the screen when the picker gives sound. */
    screenAudio: null as { trackSid: string; track: FakeTrack } | null,
    get isScreenShareEnabled() {
      return this.screens.length > 0;
    },
    /** Tests set this to undefined to play LiveKit not reporting the screen track. */
    screenTrackSid: "TR_my_screen" as string | undefined,
    /** Tests set this to false to play a browser or surface that gives no sound. */
    nextPickerAudio: true,
    getTrackPublication: (source: string) => {
      const local = this.localParticipant;
      if (source === Track.Source.ScreenShare) return local.screens[0];
      if (source === Track.Source.ScreenShareAudio) return local.screenAudio ?? undefined;
      return undefined;
    },
    /** Tests set this to "cancel" to play someone closing the browser's picker. */
    nextPicker: "share" as "share" | "cancel",
    setScreenShareEnabled: vi.fn(async (enabled: boolean, _capture?: unknown, publish?: unknown) => {
      const local = this.localParticipant;
      if (enabled && local.nextPicker === "cancel") {
        throw new DOMException("Permission denied", "NotAllowedError");
      }
      if (enabled) {
        local.screens = [{ trackSid: local.screenTrackSid, track: new FakeLocalScreenTrack(), options: publish }];
        local.screenAudio = local.nextPickerAudio ? { trackSid: "TR_my_sound", track: new FakeTrack() } : null;
      } else {
        local.screens = [];
        local.screenAudio = null;
      }
      this.emit(enabled ? RoomEvent.LocalTrackPublished : RoomEvent.LocalTrackUnpublished);
      return undefined;
    }),
    /** Publishing another screen track: what a quality change does. */
    publishTrack: vi.fn(async (mediaStreamTrack: FakeMediaStreamTrack, options?: unknown) => {
      const local = this.localParticipant;
      const publication = {
        trackSid: `TR_my_screen_${++publishSeq}`,
        track: new FakeLocalScreenTrack(mediaStreamTrack),
        options,
      };
      local.screens.push(publication);
      this.emit(RoomEvent.LocalTrackPublished);
      return publication;
    }),
    unpublishTrack: vi.fn(async (track: FakeLocalScreenTrack) => {
      const local = this.localParticipant;
      local.screens = local.screens.filter((s) => s.track !== track);
      this.emit(RoomEvent.LocalTrackUnpublished);
      return undefined;
    }),
  };

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

  publishScreen(identity: string, options: { height?: number; withSound?: boolean } = {}) {
    const p = this.remoteParticipants.get(identity) ?? this.join(identity, identity);
    const track = new FakeTrack();
    const height = options.height ?? 1080;
    p.tracks.set(Track.Source.ScreenShare, track);
    p.publications.set(Track.Source.ScreenShare, {
      track,
      dimensions: { width: Math.round((height * 16) / 9), height },
      setVideoQuality: vi.fn(),
      setVideoDimensions: vi.fn(),
    });
    if (options.withSound) {
      const sound = new FakeTrack();
      p.tracks.set(Track.Source.ScreenShareAudio, sound);
      this.emit(RoomEvent.TrackSubscribed, sound, {}, p);
    }
    this.emit(RoomEvent.TrackSubscribed, track, {}, p);
    return track;
  }

  /** What this browser asked the server for, for someone's screen. */
  screenPublication(identity: string) {
    return this.remoteParticipants.get(identity)?.publications.get(Track.Source.ScreenShare);
  }

  /** The person clicked the browser's own "Stop sharing" bar. */
  browserStopsMyShare() {
    this.localParticipant.screens = [];
    this.localParticipant.screenAudio = null;
    this.emit(RoomEvent.LocalTrackUnpublished);
  }
}

export const rooms: Room[] = [];
export const lastRoom = () => {
  const room = rooms.at(-1);
  if (!room) throw new Error("No LiveKit room was created");
  return room;
};
