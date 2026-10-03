import { vi } from "vitest";
import type { AccessRequestView, LiveStream, Me, MemberView, StreamKind, StreamSettings } from "../api/types";

type Reply = { status: number; body?: unknown };
export type Call = { method: string; path: string; headers: Record<string, string>; body: unknown; keepalive?: boolean };

/** The signed-in user's id inside the fake API. /api/me doesn't expose ids, so tests never need it. */
export const MY_USER_ID = 999;

/**
 * A tiny in-memory version of the Java API, installed as window.fetch.
 * Tests change `server.me`, `server.requests`... and assert on `server.calls`.
 */
export function installFakeApi(initial: { me?: Me | null; requests?: AccessRequestView[]; members?: MemberView[] } = {}) {
  const server = {
    me: initial.me ?? null,
    requests: initial.requests ?? [],
    members: initial.members ?? [],
    /** The live streams, oldest first. Tests set them directly to play other people sharing. */
    streams: [] as FakeStream[],
    /** False plays an API that restarted and forgot this person's seat. */
    seated: true,
    /** What POST /api/room/enter answers: tests set "waiting" or "offered" to play a full room. */
    seat: { status: "in" } as SeatAnswer,
    calls: [] as Call[],
    /** Force the next matching request to fail: key is "POST /api/access-requests". */
    failures: new Map<string, Reply>(),
  };

  const route = (method: string, path: string, body: unknown): Reply => {
    const key = `${method} ${path}`;
    const failure = server.failures.get(key);
    if (failure) return failure;

    if (key === "GET /api/me") return server.me ? { status: 200, body: server.me } : { status: 401 };
    if (key === "POST /api/auth/logout") {
      server.me = null;
      return { status: 204 };
    }
    if (key === "POST /api/access-requests") {
      if (server.me) server.me = { ...server.me, status: "PENDING" };
      void body;
      return { status: 201 };
    }
    const streamsState = () => ({
      status: 200,
      body: {
        streams: server.streams.map((st) => ({ ...st, mine: st.userId === MY_USER_ID })),
        free: 6 - server.streams.length,
        seated: server.seated,
      },
    });
    const conflict = (detail: string, reason?: string) => ({ status: 409, body: { status: 409, detail, reason } });
    const isMine = (kind: string) => (st: FakeStream) => st.userId === MY_USER_ID && st.kind === kind;

    if (key === "GET /api/streams") return streamsState();
    if (key === "POST /api/livekit/token") {
      return {
        status: 200,
        body: { url: "wss://rtc.test", room: "xove", identity: `user-${MY_USER_ID}`, token: "test-token" },
      };
    }
    if (key === "POST /api/streams") {
      const wanted = body as { kind: StreamKind } & Partial<StreamSettings>;
      if (!server.seated) return conflict("Enter the room first.");
      const settings: StreamSettings = {
        quality: wanted.quality ?? (wanted.kind === "camera" ? "720p" : "1080p"),
        mode: wanted.mode ?? "smooth",
      };
      const own = server.streams.find(isMine(wanted.kind));
      if (own) {
        own.settings = settings;
        return streamsState();
      }
      if (server.streams.length >= 6) return conflict("The room already has 6 streams.", "full");
      server.streams = [...server.streams, myStream(wanted.kind, server.me?.name ?? null, settings)];
      return streamsState();
    }
    const perKind = path.match(/^\/api\/streams\/(screen|camera)\/(settings|stop)$/);
    if (method === "POST" && perKind) {
      const [, kind, action] = perKind;
      const own = server.streams.find(isMine(kind));
      if (action === "stop") {
        server.streams = server.streams.filter((st) => !isMine(kind)(st));
        return streamsState();
      }
      if (!own) return conflict("Only the person sharing can change how their stream is sent.");
      own.settings = body as StreamSettings;
      return streamsState();
    }

    if (key === "POST /api/room/enter") {
      // A page connected to the video room confirms its seat (after an API restart).
      if ((body as { participantSid?: string } | undefined)?.participantSid && server.seat.status === "in") {
        server.seated = true;
      }
      if (server.seat.status === "in") server.seated = true;
      return { status: 200, body: server.seat };
    }
    if (key === "POST /api/room/accept") {
      if (server.seat.status !== "offered") {
        return conflict("There's no seat waiting for you. Keep this page open: you'll get one when it's your turn.");
      }
      server.seat = { status: "in" };
      server.seated = true;
      return { status: 200, body: server.seat };
    }
    if (key === "POST /api/room/cancel" || key === "POST /api/room/leave") return { status: 204 };

    if (key === "GET /api/admin/access-requests") return { status: 200, body: server.requests };
    if (key === "GET /api/admin/members") return { status: 200, body: server.members };

    const decide = path.match(/^\/api\/admin\/access-requests\/(\d+)\/(approve|decline)$/);
    if (method === "POST" && decide) {
      server.requests = server.requests.filter((r) => r.id !== Number(decide[1]));
      return { status: 204 };
    }
    const remove = path.match(/^\/api\/admin\/members\/(\d+)$/);
    if (method === "DELETE" && remove) {
      server.members = server.members.filter((m) => m.id !== Number(remove[1]));
      return { status: 204 };
    }
    return { status: 404 };
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    server.calls.push({ method, path, headers, body, keepalive: init?.keepalive });

    const reply = route(method, path, body);
    const text = reply.body === undefined ? "" : JSON.stringify(reply.body);
    return new Response(text || null, {
      status: reply.status,
      headers: text ? { "Content-Type": "application/json" } : {},
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  return server;
}

/** One live stream as the fake API keeps it. */
export type FakeStream = Omit<LiveStream, "mine">;

export type SeatAnswer =
  | { status: "in" }
  | { status: "waiting"; place: number }
  | { status: "offered"; until: string; seconds: number };

/** Someone else's live stream: a screen at 1080p Smooth unless said otherwise, started a minute ago. */
export const someoneSharing = (
  name: string,
  userId = 7,
  kind: StreamKind = "screen",
  settings: StreamSettings = { quality: kind === "camera" ? "720p" : "1080p", mode: "smooth" },
  since = new Date(Date.now() - 60_000),
): FakeStream => ({ kind, userId, name, avatarUrl: null, since: since.toISOString(), settings });

const myStream = (kind: StreamKind, name: string | null, settings: StreamSettings): FakeStream => ({
  kind,
  userId: MY_USER_ID,
  name,
  avatarUrl: null,
  since: new Date().toISOString(),
  settings,
});

/** My stream of this kind, as the fake API has it. */
export const myLiveStream = (server: { streams: FakeStream[] }, kind: StreamKind = "screen") =>
  server.streams.find((st) => st.userId === MY_USER_ID && st.kind === kind);

export const aUser = (overrides: Partial<Me> = {}): Me => ({
  email: "friend@example.com",
  name: "Friend Person",
  avatarUrl: null,
  status: "NONE",
  admin: false,
  ...overrides,
});
