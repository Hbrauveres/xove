import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AccessRequestView, MemberView } from "../api/types";
import { aUser, installFakeApi } from "../test/fakeApi";
import { renderApp } from "../test/renderApp";

const admin = aUser({ email: "admin@example.com", name: "Admin", status: "MEMBER", admin: true });

const request: AccessRequestView = {
  id: 7,
  email: "bruno@example.com",
  name: "Bruno",
  avatarUrl: null,
  message: "it's me",
  createdAt: new Date().toISOString(),
};

const members: MemberView[] = [
  { id: 1, email: "admin@example.com", name: "Admin", avatarUrl: null, admin: true },
  { id: 2, email: "ana@example.com", name: "Ana Souza", avatarUrl: null, admin: false },
];

describe("admin page", () => {
  it("lists pending requests with their message", async () => {
    installFakeApi({ me: admin, requests: [request], members });
    renderApp("/admin");

    expect(await screen.findByText("bruno@example.com")).toBeInTheDocument();
    expect(screen.getByText(/it's me/)).toBeInTheDocument();
  });

  it("approves a request and refreshes the list", async () => {
    const server = installFakeApi({ me: admin, requests: [request], members });
    renderApp("/admin");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /approve/i }));

    expect(await screen.findByText(/no one is waiting/i)).toBeInTheDocument();
    expect(server.calls.some((c) => c.method === "POST" && c.path === "/api/admin/access-requests/7/approve")).toBe(true);
  });

  it("declines a request", async () => {
    const server = installFakeApi({ me: admin, requests: [request], members });
    renderApp("/admin");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /decline/i }));

    expect(await screen.findByText(/no one is waiting/i)).toBeInTheDocument();
    expect(server.calls.some((c) => c.path === "/api/admin/access-requests/7/decline")).toBe(true);
  });

  it("asks for confirmation before removing a member", async () => {
    const server = installFakeApi({ me: admin, requests: [], members });
    renderApp("/admin");
    const user = userEvent.setup();

    const anaRow = (await screen.findByText("ana@example.com")).closest("li")!;
    await user.click(within(anaRow).getByRole("button", { name: /^remove$/i }));
    expect(server.calls.some((c) => c.method === "DELETE")).toBe(false);

    await user.click(within(anaRow).getByRole("button", { name: /remove ana/i }));

    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
    expect(screen.queryByText("ana@example.com")).not.toBeInTheDocument();
    expect(server.calls.some((c) => c.method === "DELETE" && c.path === "/api/admin/members/2")).toBe(true);
  });

  it("never offers to remove an admin", async () => {
    installFakeApi({ me: admin, requests: [], members });
    renderApp("/admin");

    const adminRow = (await screen.findByText("admin@example.com")).closest("li")!;
    expect(adminRow.querySelector(".badge")).toHaveTextContent("Admin");
    expect(within(adminRow).queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("shows the API's error when an action fails", async () => {
    const server = installFakeApi({ me: admin, requests: [request], members });
    server.failures.set("POST /api/admin/access-requests/7/approve", {
      status: 409,
      body: { detail: "This request was already decided" },
    });
    renderApp("/admin");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /approve/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This request was already decided");
  });
});
