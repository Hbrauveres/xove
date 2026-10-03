import type {
  AccessRequestView,
  LiveKitAccess,
  Me,
  MemberView,
  SeatStatus,
  SharingConnection,
  StreamKind,
  StreamSettings,
  StreamsState,
} from "./types";

/** An error the API answered with. `message` is safe to show to the user. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Where the browser goes to start Google login. A full page navigation, not a fetch. */
export const GOOGLE_LOGIN_URL = "/api/oauth2/authorization/google";

/** Spring puts the CSRF token in a readable cookie; every non-GET request must echo it back. */
export function readCsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  401: "Your session ended. Sign in again.",
  403: "You don't have permission to do that.",
  404: "That no longer exists.",
  409: "That was already done.",
};

/** `keepalive`: the request still goes out while the page is closing. */
async function request<T>(method: string, path: string, body?: unknown, keepalive = false): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const token = readCsrfToken();
    if (token) headers["X-XSRF-TOKEN"] = token;
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(keepalive ? { keepalive: true } : {}),
  });

  if (!response.ok) {
    let message = FALLBACK_MESSAGES[response.status] ?? "Something went wrong. Try again.";
    try {
      // The API answers errors as RFC 9457 problem details: { status, title, detail, ... }
      const data = await response.json();
      if (typeof data?.detail === "string" && data.detail.length > 0) message = data.detail;
    } catch {
      // empty or non-JSON body: keep the fallback message
    }
    throw new ApiError(response.status, message);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  me: () => request<Me>("GET", "/api/me"),
  logout: () => request<void>("POST", "/api/auth/logout"),
  requestAccess: (message: string) =>
    request<void>("POST", "/api/access-requests", { message: message.trim() || null }),

  streams: {
    current: () => request<StreamsState>("GET", "/api/streams"),
    start: (kind: StreamKind, connection: SharingConnection, settings: StreamSettings) =>
      request<StreamsState>("POST", "/api/streams", { kind, ...connection, ...settings }),
    settings: (kind: StreamKind, settings: StreamSettings) =>
      request<StreamsState>("POST", `/api/streams/${kind}/settings`, settings),
    stop: (kind: StreamKind) => request<StreamsState>("POST", `/api/streams/${kind}/stop`),
  },

  room: {
    /** Asks for a seat, or polls the queue. */
    enter: () => request<SeatStatus>("POST", "/api/room/enter"),
    /** Takes the seat held for me. */
    accept: () => request<SeatStatus>("POST", "/api/room/accept"),
    /** Leaves the queue, or turns the seat down. */
    cancel: () => request<void>("POST", "/api/room/cancel"),
    /** The waiting page is closing: keep my place for 30 seconds. */
    leave: () => request<void>("POST", "/api/room/leave", undefined, true),
  },

  liveKitToken: () => request<LiveKitAccess>("POST", "/api/livekit/token"),

  admin: {
    pendingRequests: () => request<AccessRequestView[]>("GET", "/api/admin/access-requests"),
    approve: (id: number) => request<void>("POST", `/api/admin/access-requests/${id}/approve`),
    decline: (id: number) => request<void>("POST", `/api/admin/access-requests/${id}/decline`),
    members: () => request<MemberView[]>("GET", "/api/admin/members"),
    removeMember: (id: number) => request<void>("DELETE", `/api/admin/members/${id}`),
  },
};
