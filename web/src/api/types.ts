/** Shapes returned by the Java API. Keep in sync with the records in api/. */

export type UserStatus = "NONE" | "PENDING" | "MEMBER" | "DECLINED";

export type Me = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  admin: boolean;
};

export type AccessRequestView = {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  message: string | null;
  createdAt: string;
};

export type MemberView = {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  admin: boolean;
};

/** What a stream shows (spec 0060). Never a microphone. */
export type StreamKind = "screen" | "camera";

/** What a stream is sent with (spec 0086); its person can change it while sharing. A camera goes up to 720p. */
export type StreamSettings = {
  quality: "1080p" | "720p" | "480p";
  mode: "smooth" | "sharp";
};

/** One live stream, as GET /api/streams lists it. `since` is an ISO timestamp. */
export type LiveStream = {
  kind: StreamKind;
  userId: number;
  name: string | null;
  avatarUrl: string | null;
  since: string;
  settings: StreamSettings;
  /** True when it's the asking person's. */
  mine: boolean;
};

/** GET /api/streams, and what start/settings/stop answer with. */
export type StreamsState = {
  /** Oldest first. */
  streams: LiveStream[];
  /** Places left of the 6. */
  free: number;
  /** False when the API doesn't know this person is in the room (after a restart): enter again. */
  seated: boolean;
};

/** Which LiveKit connection and track a stream comes from. Required to start one. */
export type SharingConnection = {
  participantSid: string;
  trackSid: string;
};

/** POST /api/livekit/token: where and how to join the video room. */
export type LiveKitAccess = {
  url: string;
  room: string;
  identity: string;
  token: string;
};
