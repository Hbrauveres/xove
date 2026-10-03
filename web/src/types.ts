/** A person in the room. `id` is their LiveKit identity ("user-42"), or "me". */
export type Friend = {
  id: string;
  name: string;
  /** Hue for the avatar background, 0–360. */
  hue: number;
  online: boolean;
};

/** A LiveKit track, reduced to what the stage needs: put it in a <video>/<audio> and take it out. */
export type MediaTrack = {
  attach(element: HTMLMediaElement): HTMLMediaElement;
  detach(element: HTMLMediaElement): HTMLMediaElement;
};

/** What a stream shows: a shared screen or a camera (spec 0060). */
export type StreamKind = "screen" | "camera";

/** A quality a viewer asks for: "auto" lets the server send what fits. */
export type ViewQuality = "auto" | "1080p" | "720p" | "480p";

/** Someone's screen or camera, as received from LiveKit. */
export type RemoteVideo = {
  video: MediaTrack;
  /** Height of the best quality the sharer sends, when LiveKit knows it. */
  height?: number;
  /** How many qualities the sharer sends (1 from Firefox and Safari). */
  layers?: number;
  /** Asks the server for this quality ("auto": whatever fits the player). */
  setQuality: (quality: ViewQuality) => void;
};

/** One live stream on the stage: what the API says about it, and its video once it arrives. */
export type LiveFeed = {
  kind: StreamKind;
  startedAt: number;
  /** The quality and mode it's sent with: caps what viewers can pick. */
  settings: { quality: "1080p" | "720p" | "480p"; mode: "smooth" | "sharp" };
  /** Someone else's video, once it arrives. */
  remote?: RemoteVideo;
  /** My own video, for my preview. */
  local?: MediaTrack;
};

/** A person with at least one live stream. */
export type Sharer = {
  person: Friend;
  isMe: boolean;
  /** When their oldest live stream started: the longest sharing comes first. */
  since: number;
  screen?: LiveFeed;
  camera?: LiveFeed;
  /** The sound of their screen, when it's someone else's and it arrived. */
  sound?: MediaTrack;
  /** Downloads their sound, or not (a muted thumbnail's isn't downloaded). Only for someone else. */
  setSoundOn?: (on: boolean) => void;
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

export type ActivityKind = "joined" | "left" | "started" | "stopped";

export type ActivityEvent = {
  id: string;
  at: number;
  kind: ActivityKind;
  actorId: string;
  /** For "started" and "stopped": which stream. */
  stream?: StreamKind;
};

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";
