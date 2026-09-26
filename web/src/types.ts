/** A person in the room. `id` is their LiveKit identity ("user-42"), or "me". */
export type Friend = {
  id: string;
  name: string;
  /** Hue for the avatar background, 0–360. */
  hue: number;
  online: boolean;
};

/** The one screen slot. Null means nobody is sharing. */
export type ShareState = {
  sharerId: string;
  startedAt: number;
} | null;

/** A LiveKit track, reduced to what the stage needs: put it in a <video>/<audio> and take it out. */
export type MediaTrack = {
  attach(element: HTMLMediaElement): HTMLMediaElement;
  detach(element: HTMLMediaElement): HTMLMediaElement;
};

/** Someone's shared screen, as received from LiveKit. */
export type ScreenTracks = {
  video?: MediaTrack;
  audio?: MediaTrack;
};

/** Numbers the real app would read from LiveKit's track stats. */
export type StreamStats = {
  width: number;
  height: number;
  fps: number;
  codec: "VP9" | "VP8" | "H.264" | "AV1";
  bitrateMbps: number;
  latencyMs: number;
};

export type ActivityKind = "joined" | "left" | "started" | "stopped" | "took";

export type ActivityEvent = {
  id: string;
  at: number;
  kind: ActivityKind;
  actorId: string;
  /** For "took": whose share was replaced. */
  targetId?: string;
};

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";
