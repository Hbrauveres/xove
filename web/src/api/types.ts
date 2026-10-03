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

/** Who holds the screen slot. `since` is an ISO timestamp. */
export type ScreenHolder = {
  userId: number;
  name: string | null;
  avatarUrl: string | null;
  since: string;
};

/** What the sharer's stream is sent with (spec 0086); the sharer can change it while sharing. */
export type StreamSettings = {
  quality: "1080p" | "720p" | "480p";
  mode: "smooth" | "sharp";
};

/** GET /api/screen, and what take/release answer with. */
export type ScreenState = {
  holder: ScreenHolder | null;
  /** Null when nobody is sharing. */
  settings: StreamSettings | null;
  /** True when the holder is the person asking. */
  mine: boolean;
};

/** Which LiveKit connection and screen track a share comes from. Required to take the screen. */
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
