import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { aUser, installFakeApi } from "../test/fakeApi";
import { renderApp } from "../test/renderApp";

describe("request access page", () => {
  it("sends the request with the message and shows the waiting state", async () => {
    const server = installFakeApi({ me: aUser({ status: "NONE" }) });
    renderApp("/request-access");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/message/i), "it's me, Bruno");
    await user.click(screen.getByRole("button", { name: /request access/i }));

    expect(await screen.findByRole("heading", { name: /request sent/i })).toBeInTheDocument();
    const post = server.calls.find((c) => c.method === "POST" && c.path === "/api/access-requests");
    expect(post?.body).toEqual({ message: "it's me, Bruno" });
  });

  it("shows who is signed in", async () => {
    installFakeApi({ me: aUser({ email: "bruno@example.com" }) });
    renderApp("/request-access");

    expect(await screen.findByText("bruno@example.com")).toBeInTheDocument();
  });

  it("tells declined users and lets them ask again", async () => {
    installFakeApi({ me: aUser({ status: "DECLINED" }) });
    renderApp("/request-access");

    expect(await screen.findByRole("heading", { name: /declined/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask again/i })).toBeInTheDocument();
  });

  it("shows the API's error message", async () => {
    const server = installFakeApi({ me: aUser({ status: "NONE" }) });
    server.failures.set("POST /api/access-requests", {
      status: 400,
      body: { detail: "Message is too long (max 500 characters)" },
    });
    renderApp("/request-access");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /request access/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Message is too long (max 500 characters)");
  });

  it("moves a waiting user into the room once approved", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const server = installFakeApi({ me: aUser({ status: "PENDING" }) });
    renderApp("/request-access");
    expect(await screen.findByRole("heading", { name: /request sent/i })).toBeInTheDocument();

    server.me = aUser({ status: "MEMBER" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    await waitFor(() => expect(screen.getByRole("button", { name: /(people|person) here/i })).toBeInTheDocument());
  });
});
