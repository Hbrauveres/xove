import { vi } from "vitest";
import type { AccessRequestView, Me, MemberView, ScreenHolder } from "../api/types";

type Reply = { status: number; body?: unknown };
export type Call = { method: string; path: string; headers: Record<string, string>; body: unknown };

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
    /** Who holds the screen slot. Tests set it directly to play "someone else". */
    screenHolder: null as ScreenHolder | null,
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
    const screenState = () => ({
      status: 200,
      body: { holder: server.screenHolder, mine: server.screenHolder?.userId === MY_USER_ID },
    });
    if (key === "GET /api/screen") return screenState();
    if (key === "POST /api/livekit/token") {
      return {
        status: 200,
        body: { url: "wss://rtc.test", room: "xove", identity: `user-${MY_USER_ID}`, token: "test-token" },
      };
    }
    if (key === "POST /api/screen/take") {
      if (server.screenHolder?.userId !== MY_USER_ID) {
        const since = new Date().toISOString();
        server.screenHolder = { userId: MY_USER_ID, name: server.me?.name ?? null, avatarUrl: null, since };
      }
      return screenState();
    }
    if (key === "POST /api/screen/release") {
      if (server.screenHolder && server.screenHolder.userId !== MY_USER_ID) {
        return { status: 409, body: { status: 409, detail: "Only the person sharing can stop the share." } };
      }
      server.screenHolder = null;
      return screenState();
    }

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
    server.calls.push({ method, path, headers, body });

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

export const someoneSharing = (name: string, userId = 7): ScreenHolder => ({
  userId,
  name,
  avatarUrl: null,
  since: new Date(Date.now() - 60_000).toISOString(),
});

export const aUser = (overrides: Partial<Me> = {}): Me => ({
  email: "friend@example.com",
  name: "Friend Person",
  avatarUrl: null,
  status: "NONE",
  admin: false,
  ...overrides,
});
