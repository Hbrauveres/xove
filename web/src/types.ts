/** A person allowed into the app. In the real app this comes from Google login. */
export type Friend = {
  id: string;
  name: string;
  /** Hue for the avatar background, 0–360. */
  hue: number;
  online: boolean;
};

/** What the mock screen draws. The real app shows a LiveKit video track instead. */
export type ScreenScene = "editor" | "game" | "desktop";

/** The one screen slot. Null means nobody is sharing. */
export type ShareState = {
  sharerId: string;
  startedAt: number;
  scene: ScreenScene;
} | null;

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

export type ConnectionState = "connected" | "reconnecting";
