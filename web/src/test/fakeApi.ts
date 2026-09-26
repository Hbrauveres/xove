import { vi } from "vitest";
import type { AccessRequestView, Me, MemberView } from "../api/types";

type Reply = { status: number; body?: unknown };
export type Call = { method: string; path: string; headers: Record<string, string>; body: unknown };

/**
 * A tiny in-memory version of the Java API, installed as window.fetch.
 * Tests change `server.me`, `server.requests`... and assert on `server.calls`.
 */
export function installFakeApi(initial: { me?: Me | null; requests?: AccessRequestView[]; members?: MemberView[] } = {}) {
  const server = {
    me: initial.me ?? null,
    requests: initial.requests ?? [],
    members: initial.members ?? [],
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

export const aUser = (overrides: Partial<Me> = {}): Me => ({
  email: "friend@example.com",
  name: "Friend Person",
  avatarUrl: null,
  status: "NONE",
  admin: false,
  ...overrides,
});
