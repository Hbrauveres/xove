import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { aUser, installFakeApi, MY_USER_ID, someoneSharing } from "../test/fakeApi";
import { lastRoom } from "../test/fakeLiveKit";
import { RoomPage } from "./RoomPage";

const member = aUser({ name: "Henrique Brauveres", status: "MEMBER" });
const FAST_POLL = 50;
const mySlot = () => ({ ...someoneSharing("Henrique"), userId: MY_USER_ID });

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
const connected = () => screen.findByText("Connected");

describe("room: joining the video room", () => {
  it("connects to LiveKit with the address and token from the API", async () => {
    installFakeApi({ me: member });
    renderRoom();

    await connected();
    expect(lastRoom().connectedWith).toEqual({ url: "wss://rtc.test", token: "test-token" });
  });

  it("says so when video isn't available, and the rest of the room still works", async () => {
    const server = installFakeApi({ me: member });
    server.failures.set("POST /api/livekit/token", {
      status: 503,
      body: { status: 503, detail: "Video isn't set up on this server yet." },
    });
    renderRoom();

    expect(await screen.findByRole("alert")).toHaveTextContent("Video isn't set up on this server yet.");
    expect(screen.getByText("Video offline")).toBeInTheDocument();
    expect(screen.getByText(/the stage is free/i)).toBeInTheDocument();
  });

  it("lists the people connected, and notes who joins and leaves", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();

    act(() => {
      lastRoom().join("user-7", "Bruno Lima");
    });
    const here = screen.getByRole("region", { name: /here now/i });
    expect(within(here).getByText("Bruno")).toBeInTheDocument();
    expect(screen.getByText(/bruno joined/i)).toBeInTheDocument();

    act(() => {
      lastRoom().leave("user-7");
    });
    expect(within(here).queryByText("Bruno")).not.toBeInTheDocument();
    expect(screen.getByText(/bruno left/i)).toBeInTheDocument();
  });
});

describe("room: watching", () => {
  it("shows a free stage when nobody is sharing", async () => {
    installFakeApi({ me: member });
    renderRoom();

    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();
  });

  it("plays the sharer's screen once their video arrives", async () => {
    const server = installFakeApi({ me: member });
    server.screenHolder = someoneSharing("Bruno Lima", 7);
    renderRoom();
    await connected();

    expect(await screen.findByText("Bruno is sharing")).toBeInTheDocument();
    expect(screen.getByText(/loading bruno's screen/i)).toBeInTheDocument();

    let track!: ReturnType<ReturnType<typeof lastRoom>["publishScreen"]>;
    act(() => {
      track = lastRoom().publishScreen("user-7");
    });

    const video = await screen.findByLabelText("Bruno's shared screen");
    expect(track.attached).toContain(video);
  });

  it("picks up a new sharer from the API without reloading", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();

    act(() => {
      server.screenHolder = someoneSharing("Duda", 9);
    });

    expect(await screen.findByText("Duda is sharing")).toBeInTheDocument();
    expect(await screen.findByText(/duda started sharing/i)).toBeInTheDocument();
  });
});

describe("room: sharing", () => {
  it("opens the browser's picker, then takes the slot with the CSRF token", async () => {
    document.cookie = "XSRF-TOKEN=abc123";
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();

    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));

    expect(await screen.findByText("You are sharing")).toBeInTheDocument();
    expect(lastRoom().localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(true, expect.anything());
    const take = server.calls.find((c) => c.method === "POST" && c.path === "/api/screen/take");
    expect(take?.headers["X-XSRF-TOKEN"]).toBe("abc123");
  });

  it("does nothing if the picker is closed without choosing", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    lastRoom().localParticipant.nextPicker = "cancel";
    const user = userEvent.setup();

    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));

    expect(screen.getByText(/the stage is free/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(server.calls.some((c) => c.path === "/api/screen/take")).toBe(false);
  });

  it("asks before taking the screen from someone else", async () => {
    const server = installFakeApi({ me: member });
    server.screenHolder = someoneSharing("Bruno", 7);
    renderRoom();
    await connected();
    await screen.findByText("Bruno is sharing");
    const user = userEvent.setup();

    await user.click(within(controls()).getByRole("button", { name: /take the screen/i }));
    const confirm = screen.getByRole("alertdialog");
    expect(confirm).toHaveTextContent(/bruno is sharing right now/i);
    await user.click(within(confirm).getByRole("button", { name: /take the screen/i }));

    expect(await screen.findByText("You are sharing")).toBeInTheDocument();
    expect(server.screenHolder?.userId).toBe(MY_USER_ID);
  });

  it("stops the video and frees the slot", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");

    await user.click(within(controls()).getByRole("button", { name: /stop sharing/i }));

    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false);
    expect(server.screenHolder).toBeNull();
  });

  it("frees the slot when the browser's own Stop sharing bar is used", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");

    act(() => {
      lastRoom().browserStopsMyShare();
    });

    await waitFor(() => expect(server.screenHolder).toBeNull());
    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();
  });

  it("stops sending my screen when someone takes it from me", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");

    act(() => {
      server.screenHolder = someoneSharing("Duda", 9);
    });

    expect(await screen.findByText("Duda is sharing")).toBeInTheDocument();
    await waitFor(() => expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false));
    expect(screen.getByText(/duda took the screen from you/i)).toBeInTheDocument();
  });

  it("gives the slot back after a reload, when nothing is being sent", async () => {
    const server = installFakeApi({ me: member });
    server.screenHolder = mySlot();
    renderRoom();

    await waitFor(() => expect(server.screenHolder).toBeNull());
    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();
  });

  it("shows the API's message when taking the slot fails, and stops the video", async () => {
    const server = installFakeApi({ me: member });
    server.failures.set("POST /api/screen/take", {
      status: 403,
      body: { status: 403, detail: "Members only" },
    });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();

    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Members only");
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false);
  });
});
