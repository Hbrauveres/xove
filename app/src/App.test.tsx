import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INSTALLED_QUERY } from "./hooks/useInstalled";
import { TOUCH_QUERY } from "./hooks/useRoomLayout";
import { aUser, installFakeApi } from "./test/fakeApi";
import { renderApp } from "./test/renderApp";

describe("who sees which screen", () => {
  it("shows the Google sign-in to signed-out visitors", async () => {
    installFakeApi({ me: null });
    renderApp("/");

    const link = await screen.findByRole("link", { name: /continue with google/i });
    expect(link).toHaveAttribute("href", "/api/oauth2/authorization/google");
  });

  it("explains a failed sign-in", async () => {
    installFakeApi({ me: null });
    renderApp("/?error=login-failed");

    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't complete/i);
  });

  it("sends signed-out visitors away from the room", async () => {
    installFakeApi({ me: null });
    renderApp("/room");

    expect(await screen.findByRole("link", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("sends signed-in non-members to request access", async () => {
    installFakeApi({ me: aUser({ status: "NONE" }) });
    renderApp("/room");

    expect(await screen.findByRole("heading", { name: /you need access/i })).toBeInTheDocument();
  });

  it("takes members from the home page straight to the room", async () => {
    installFakeApi({ me: aUser({ status: "MEMBER" }) });
    renderApp("/");

    expect(await screen.findByRole("button", { name: /(people|person) here/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
  });

  it("shows the admin link only to admins", async () => {
    installFakeApi({ me: aUser({ status: "MEMBER", admin: true }), requests: [], members: [] });
    renderApp("/room");

    // Admin is in the account menu (spec 0104).
    await userEvent.setup().click(await screen.findByRole("button", { name: /: account/ }));
    expect(screen.getByRole("link", { name: /^admin$/i })).toHaveAttribute("href", "/admin");
  });

  it("keeps non-admins out of the admin page", async () => {
    installFakeApi({ me: aUser({ status: "MEMBER", admin: false }) });
    renderApp("/admin");

    expect(await screen.findByRole("button", { name: /(people|person) here/i })).toBeInTheDocument();
  });

  it("sends members away from the request-access page", async () => {
    installFakeApi({ me: aUser({ status: "MEMBER" }) });
    renderApp("/request-access");

    expect(await screen.findByRole("button", { name: /(people|person) here/i })).toBeInTheDocument();
  });
});

describe("phones and tablets use the home-screen app (spec 0171)", () => {
  /** A touch-first device, opened from the home screen or in a browser tab. */
  function touchDevice(installed: boolean) {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q === TOUCH_QUERY || (q === INSTALLED_QUERY && installed),
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }));
  }
  afterEach(() => vi.unstubAllGlobals());

  it.each(["/", "/room", "/admin", "/request-access"])("shows only the install screen at %s in a browser tab", async (path) => {
    touchDevice(false);
    installFakeApi({ me: aUser({ status: "MEMBER", admin: true }) });
    renderApp(path);
    expect(await screen.findByRole("heading", { name: /works best from your home screen/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /continue with google/i })).toBeNull();
  });

  it("works as today from the home screen", async () => {
    touchDevice(true);
    installFakeApi({ me: null });
    renderApp("/");
    expect(await screen.findByRole("link", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /works best from your home screen/ })).toBeNull();
  });

  it("never shows it on a desktop", async () => {
    installFakeApi({ me: null });
    renderApp("/");
    expect(await screen.findByRole("link", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /works best from your home screen/ })).toBeNull();
  });
});
