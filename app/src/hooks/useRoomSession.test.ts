import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { aUser, installFakeApi, MY_USER_ID, someoneSharing } from "../test/fakeApi";
import { ConnectionState, lastRoom, RoomEvent } from "../test/fakeLiveKit";
import type { Friend } from "../types";
import { useRoomSession } from "./useRoomSession";

const me: Friend = { id: "me", name: "Henrique", hue: 36, online: true };
const member = aUser({ name: "Henrique Brauveres", status: "MEMBER" });

async function session() {
  const server = installFakeApi({ me: member });
  const hook = renderHook(() => useRoomSession(me, 50));
  await waitFor(() => expect(hook.result.current.connection).toBe("connected"));
  return { server, hook };
}

describe("the room session: seats and who watches what (spec 0104)", () => {
  it("has no seats or watches until the API says so, and copes with an API without them", async () => {
    const { server, hook } = await session();
    server.seatsInfo = undefined;
    server.watching = undefined;
    await waitFor(() => expect(hook.result.current.seats).toBeNull());
    expect(hook.result.current.watchingOf).toEqual({});
  });

  it("gives the seats and, per person, whose stream they watch", async () => {
    const { server, hook } = await session();
    act(() => {
      server.streams = [someoneSharing("Bruno Lima", 7), someoneSharing("Ana Souza", 3, "camera")];
      server.seatsInfo = { total: 20, taken: 4, waiting: 1 };
      server.watching = [
        { userId: 3, sharerId: 7, kind: "screen", mine: false },
        { userId: MY_USER_ID, sharerId: 3, kind: "camera", mine: true },
      ];
    });

    await waitFor(() => expect(hook.result.current.seats).toEqual({ total: 20, taken: 4, waiting: 1 }));
    expect(hook.result.current.watchingOf).toEqual({
      "user-3": { sharerId: "user-7", kind: "screen" },
      me: { sharerId: "user-3", kind: "camera" },
    });
  });
});

describe("the room session: the connection in the activity (spec 0104)", () => {
  it("adds a Reconnected event when the connection comes back", async () => {
    const { hook } = await session();

    act(() => {
      lastRoom().emit(RoomEvent.ConnectionStateChanged, ConnectionState.Reconnecting);
    });
    expect(hook.result.current.connection).toBe("reconnecting");
    act(() => {
      lastRoom().emit(RoomEvent.ConnectionStateChanged, ConnectionState.Connected);
    });

    await waitFor(() =>
      expect(hook.result.current.activity.at(-1)).toMatchObject({ kind: "reconnected", actorId: "me" }),
    );
  });
});

describe("the room session: when each person arrived (spec 0158)", () => {
  it("has no arrivals from an API without them", async () => {
    const { hook } = await session();
    expect(hook.result.current.arrivedAt).toEqual({});
  });

  it("gives, per person, when they arrived", async () => {
    const { server, hook } = await session();
    act(() => {
      server.here = [
        { userId: MY_USER_ID, since: "2026-10-09T10:00:00Z", mine: true },
        { userId: 7, since: "2026-10-09T10:05:00Z", mine: false },
      ];
    });

    await waitFor(() =>
      expect(hook.result.current.arrivedAt).toEqual({
        me: Date.parse("2026-10-09T10:00:00Z"),
        "user-7": Date.parse("2026-10-09T10:05:00Z"),
      }),
    );
  });
});
