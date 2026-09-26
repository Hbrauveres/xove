import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { aUser, installFakeApi, MY_USER_ID, someoneSharing } from "../test/fakeApi";
import { RoomPage } from "./RoomPage";

const member = aUser({ name: "Henrique Brauveres", status: "MEMBER" });
const FAST_POLL = 50;

/** The room on its own, polling fast so tests don't wait 2 seconds. */
function renderRoom() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RoomPage pollMs={FAST_POLL} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const controls = () => screen.getByRole("region", { name: /screen sharing/i });

describe("room: the screen slot comes from the API", () => {
  it("shows a free stage when nobody is sharing", async () => {
    installFakeApi({ me: member });
    renderRoom();

    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();
  });

  it("shows who is sharing, as the API says", async () => {
    const server = installFakeApi({ me: member });
    server.screenHolder = someoneSharing("Bruno Lima");
    renderRoom();

    expect(await screen.findByText("Bruno is sharing")).toBeInTheDocument();
    expect(within(controls()).getByRole("button", { name: /take the screen/i })).toBeInTheDocument();
  });

  it("takes the screen through the API, with the CSRF token", async () => {
    document.cookie = "XSRF-TOKEN=abc123";
    const server = installFakeApi({ me: member });
    renderRoom();
    const user = userEvent.setup();

    await screen.findByText(/the stage is free/i);
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await user.click(screen.getByRole("button", { name: /^share$/i }));

    expect(await screen.findByText("You are sharing")).toBeInTheDocument();
    const take = server.calls.find((c) => c.method === "POST" && c.path === "/api/screen/take");
    expect(take?.headers["X-XSRF-TOKEN"]).toBe("abc123");
  });

  it("asks before taking the screen from someone else", async () => {
    const server = installFakeApi({ me: member });
    server.screenHolder = someoneSharing("Bruno");
    renderRoom();
    const user = userEvent.setup();

    await screen.findByText("Bruno is sharing");
    await user.click(within(controls()).getByRole("button", { name: /take the screen/i }));
    const confirm = screen.getByRole("alertdialog");
    expect(confirm).toHaveTextContent(/bruno is sharing right now/i);
    await user.click(within(confirm).getByRole("button", { name: /take the screen/i }));
    await user.click(screen.getByRole("button", { name: /^share$/i }));

    expect(await screen.findByText("You are sharing")).toBeInTheDocument();
    expect(server.screenHolder?.userId).toBe(MY_USER_ID);
  });

  it("stops sharing through the API", async () => {
    const server = installFakeApi({ me: member });
    server.screenHolder = { ...someoneSharing("Henrique"), userId: MY_USER_ID };
    renderRoom();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /stop sharing/i }));

    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();
    expect(server.screenHolder).toBeNull();
  });

  it("picks up changes made in another browser", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();

    // Someone else takes the screen elsewhere; the next poll brings it in.
    act(() => {
      server.screenHolder = someoneSharing("Duda");
    });

    expect(await screen.findByText("Duda is sharing")).toBeInTheDocument();
    expect(await screen.findByText(/duda started sharing/i)).toBeInTheDocument();
  });

  it("shows the API's message when an action fails", async () => {
    const server = installFakeApi({ me: member });
    server.screenHolder = { ...someoneSharing("Henrique"), userId: MY_USER_ID };
    server.failures.set("POST /api/screen/release", {
      status: 409,
      body: { status: 409, detail: "Only the person sharing can stop the share." },
    });
    renderRoom();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /stop sharing/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only the person sharing can stop the share.");
    expect(controls()).toBeInTheDocument();
  });
});
