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

  it("says which connection and track are sharing when taking the screen", async () => {
    const server = installFakeApi();

    await api.screen.take({ participantSid: "PA_me", trackSid: "TR_screen" });

    expect(server.calls.at(-1)!.body).toEqual({ participantSid: "PA_me", trackSid: "TR_screen" });
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
