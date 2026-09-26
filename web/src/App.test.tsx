import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

    expect(await screen.findByRole("heading", { name: /here now/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
  });

  it("shows the admin link only to admins", async () => {
    installFakeApi({ me: aUser({ status: "MEMBER", admin: true }), requests: [], members: [] });
    renderApp("/room");

    expect(await screen.findByRole("link", { name: /^admin$/i })).toHaveAttribute("href", "/admin");
  });

  it("keeps non-admins out of the admin page", async () => {
    installFakeApi({ me: aUser({ status: "MEMBER", admin: false }) });
    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: /here now/i })).toBeInTheDocument();
  });

  it("sends members away from the request-access page", async () => {
    installFakeApi({ me: aUser({ status: "MEMBER" }) });
    renderApp("/request-access");

    expect(await screen.findByRole("heading", { name: /here now/i })).toBeInTheDocument();
  });
});
