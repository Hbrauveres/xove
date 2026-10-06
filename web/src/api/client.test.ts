import { describe, expect, it } from "vitest";
import { installFakeApi } from "../test/fakeApi";
import { api, ApiError } from "./client";

describe("api client", () => {
  it("sends the CSRF token from the cookie on POST", async () => {
    const server = installFakeApi();
    document.cookie = "XSRF-TOKEN=abc-123";

    await api.requestAccess("hi");

    const call = server.calls.at(-1)!;
    expect(call.headers["X-XSRF-TOKEN"]).toBe("abc-123");
    expect(call.body).toEqual({ message: "hi" });
  });

  it("does not send the CSRF header on GET", async () => {
    const server = installFakeApi({ members: [] });
    document.cookie = "XSRF-TOKEN=abc-123";

    await api.admin.members();

    expect(server.calls.at(-1)!.headers["X-XSRF-TOKEN"]).toBeUndefined();
  });

  it("says what a stream shows and which connection and track send it when starting one", async () => {
    const server = installFakeApi();

    await api.streams.start("screen", { participantSid: "PA_me", trackSid: "TR_screen" }, { quality: "720p", mode: "sharp" });

    expect(server.calls.at(-1)!.path).toBe("/api/streams");
    expect(server.calls.at(-1)!.body).toEqual({
      kind: "screen",
      participantSid: "PA_me",
      trackSid: "TR_screen",
      quality: "720p",
      mode: "sharp",
    });
  });

  it("reports what's on my stage, or an empty stage as {} (spec 0104)", async () => {
    const server = installFakeApi();
    document.cookie = "XSRF-TOKEN=abc-123";

    await api.streams.watching({ sharerId: 7, kind: "camera" });
    expect(server.calls.at(-1)).toMatchObject({ method: "PUT", path: "/api/streams/watching", body: { sharerId: 7, kind: "camera" } });
    expect(server.calls.at(-1)!.headers["X-XSRF-TOKEN"]).toBe("abc-123");

    await api.streams.watching(null);
    expect(server.calls.at(-1)!.body).toEqual({});
  });

  it("sends an empty message as null", async () => {
    const server = installFakeApi();
    await api.requestAccess("   ");
    expect(server.calls.at(-1)!.body).toEqual({ message: null });
  });

  it("uses the API's message when a request fails", async () => {
    const server = installFakeApi();
    server.failures.set("POST /api/access-requests", {
      status: 409,
      body: { detail: "Your request is already waiting for approval" },
    });

    await expect(api.requestAccess("again")).rejects.toMatchObject({
      status: 409,
      message: "Your request is already waiting for approval",
    });
  });

  it("falls back to a readable message when the body is empty", async () => {
    installFakeApi();
    const error = await api.me().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.message).toBe("Your session ended. Sign in again.");
  });
});
