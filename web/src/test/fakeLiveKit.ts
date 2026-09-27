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

export class FakeParticipant {
  readonly tracks = new Map<string, FakeTrack>();
  readonly identity: string;
  readonly name: string;

  constructor(identity: string, name: string) {
    this.identity = identity;
    this.name = name;
  }
  getTrackPublication(source: string) {
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
    isScreenShareEnabled: false,
    getTrackPublication: (source: string) =>
      source === Track.Source.ScreenShare && this.localParticipant.isScreenShareEnabled
        ? { trackSid: "TR_my_screen" }
        : undefined,
    /** Tests set this to "cancel" to play someone closing the browser's picker. */
    nextPicker: "share" as "share" | "cancel",
    setScreenShareEnabled: vi.fn(async (enabled: boolean) => {
      const local = this.localParticipant;
      if (enabled && local.nextPicker === "cancel") {
        throw new DOMException("Permission denied", "NotAllowedError");
      }
      local.isScreenShareEnabled = enabled;
      this.emit(enabled ? RoomEvent.LocalTrackPublished : RoomEvent.LocalTrackUnpublished);
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

  publishScreen(identity: string) {
    const p = this.remoteParticipants.get(identity) ?? this.join(identity, identity);
    const track = new FakeTrack();
    p.tracks.set(Track.Source.ScreenShare, track);
    this.emit(RoomEvent.TrackSubscribed, track, {}, p);
    return track;
  }

  /** The person clicked the browser's own "Stop sharing" bar. */
  browserStopsMyShare() {
    this.localParticipant.isScreenShareEnabled = false;
    this.emit(RoomEvent.LocalTrackUnpublished);
  }
}

export const rooms: Room[] = [];
export const lastRoom = () => {
  const room = rooms.at(-1);
  if (!room) throw new Error("No LiveKit room was created");
  return room;
};
