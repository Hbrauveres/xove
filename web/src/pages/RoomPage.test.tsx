import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { screenCaptureOptions, screenPublishOptions } from "../media/shareSettings";
import { AuthProvider } from "../auth/AuthProvider";
import { aUser, installFakeApi, MY_USER_ID, someoneSharing } from "../test/fakeApi";
import { FakeMediaStreamTrack, lastRoom } from "../test/fakeLiveKit";
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
const stage = () => screen.getByRole("region", { name: /shared screen/i });

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

  // Spec 0038, AC-8: the API frees the slot when LiveKit says the sharer left.
  it("logs 'stopped sharing' when the slot is freed from outside", async () => {
    const server = installFakeApi({ me: member });
    server.screenHolder = someoneSharing("Ana Souza", 7);
    renderRoom();
    expect(await screen.findByText("Ana is sharing")).toBeInTheDocument();

    act(() => {
      server.screenHolder = null;
    });

    expect(await screen.findByText(/nobody is sharing right now/i)).toBeInTheDocument();
    expect(await screen.findByText(/ana stopped sharing/i)).toBeInTheDocument();
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
    expect(lastRoom().localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(true, expect.anything(), expect.anything());
    const take = server.calls.find((c) => c.method === "POST" && c.path === "/api/screen/take");
    expect(take?.headers["X-XSRF-TOKEN"]).toBe("abc123");
  });

  it("sends the connection and track ids when taking the screen", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();

    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));

    expect(await screen.findByText("You are sharing")).toBeInTheDocument();
    const take = server.calls.find((c) => c.method === "POST" && c.path === "/api/screen/take");
    expect(take?.body).toEqual({ participantSid: "PA_me", trackSid: "TR_my_screen" });
  });

  it("stops sharing and says so when the screen track can't be identified", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    lastRoom().localParticipant.screenTrackSid = undefined;
    const user = userEvent.setup();

    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));

    expect(await screen.findByText(/couldn't start sharing your screen/i)).toBeInTheDocument();
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false);
    expect(server.calls.some((c) => c.path === "/api/screen/take")).toBe(false);
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

// Spec 0086: smooth video and clear sound.
describe("room: what the screen is sent with", () => {
  afterEach(() => localStorage.clear());

  const shareMyScreen = async () => {
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");
    return user;
  };

  it("sends 1080p Smooth, with the sound as played, by default", async () => {
    installFakeApi({ me: member });
    await shareMyScreen();

    expect(lastRoom().localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(
      true,
      screenCaptureOptions("1080p", "smooth"),
      screenPublishOptions("1080p", "smooth"),
    );
  });

  it("sends the quality and mode chosen last time", async () => {
    localStorage.setItem("xove.share.quality", "720p");
    localStorage.setItem("xove.share.mode", "sharp");
    installFakeApi({ me: member });
    await shareMyScreen();

    expect(lastRoom().localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(
      true,
      screenCaptureOptions("720p", "sharp"),
      screenPublishOptions("720p", "sharp"),
    );
  });
});

describe("room: the sharer's quality and mode", () => {
  afterEach(() => localStorage.clear());

  it("sends the quality and mode picked before sharing, and remembers them", async () => {
    installFakeApi({ me: member });
    const view = renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();

    await user.selectOptions(within(controls()).getByLabelText("Send quality"), "720p");
    await user.selectOptions(within(controls()).getByLabelText("Mode"), "sharp");
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");

    expect(lastRoom().localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(
      true,
      screenCaptureOptions("720p", "sharp"),
      screenPublishOptions("720p", "sharp"),
    );

    view.unmount();
    renderRoom();
    expect(await screen.findByLabelText("Send quality")).toHaveValue("720p");
    expect(screen.getByLabelText("Mode")).toHaveValue("sharp");
  });

  it("changes the quality while sharing without stopping, and the API follows the new track", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");
    const local = lastRoom().localParticipant;
    const first = local.screens[0].track;

    await user.selectOptions(within(controls()).getByLabelText("Send quality"), "480p");

    await waitFor(() => expect(local.unpublishTrack).toHaveBeenCalledWith(first));
    expect(local.publishTrack).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ...screenPublishOptions("480p", "smooth"), source: "screen_share" }),
    );
    // The new track was registered before the old one went away.
    const takes = server.calls.filter((c) => c.path === "/api/screen/take");
    expect(takes.at(-1)?.body).toEqual({ participantSid: "PA_me", trackSid: local.screens[0].trackSid });
    expect(local.screens).toHaveLength(1);
    expect(server.screenHolder?.userId).toBe(MY_USER_ID);
    expect(screen.getByText("You are sharing")).toBeInTheDocument();
  });

  it("tells the sharer when their browser gave no sound", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    lastRoom().localParticipant.nextPickerAudio = false;
    const user = userEvent.setup();

    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));

    expect(await screen.findByText(/no sound is being shared/i)).toBeInTheDocument();
  });

  it("says nothing about sound when it is being shared", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();

    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");

    expect(screen.queryByText(/no sound is being shared/i)).not.toBeInTheDocument();
  });
  it("changes the mode while sharing: the new track is marked for detail", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");
    const local = lastRoom().localParticipant;

    await user.selectOptions(within(controls()).getByLabelText("Mode"), "sharp");

    await waitFor(() => expect(local.screens).toHaveLength(1));
    const capture = local.screens[0].track.mediaStreamTrack;
    expect(capture.contentHint).toBe("detail");
    expect(capture.constraints).toEqual({ width: 1920, height: 1080, frameRate: 30 });
    expect(local.publishTrack).toHaveBeenCalledWith(
      capture,
      expect.objectContaining({ ...screenPublishOptions("1080p", "sharp"), source: "screen_share" }),
    );
  });

  it("stops everything when Stop is pressed after a change", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");
    const local = lastRoom().localParticipant;
    await user.selectOptions(within(controls()).getByLabelText("Send quality"), "720p");
    await waitFor(() => expect(local.unpublishTrack).toHaveBeenCalled());

    await user.click(within(controls()).getByRole("button", { name: /stop sharing/i }));

    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();
    expect(local.screens).toHaveLength(0);
    expect(local.screenAudio).toBeNull();
    expect(server.screenHolder).toBeNull();
  });

  it("keeps showing and sending the old quality when a change fails", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");
    const local = lastRoom().localParticipant;
    const original = local.screens[0];
    const failingClone = new FakeMediaStreamTrack();
    original.track.mediaStreamTrack.clone = () => failingClone;
    local.publishTrack.mockRejectedValueOnce(new Error("publish failed"));

    await user.selectOptions(within(controls()).getByLabelText("Send quality"), "480p");

    expect(await screen.findByText(/couldn't change the quality/i)).toBeInTheDocument();
    expect(within(controls()).getByLabelText("Send quality")).toHaveValue("1080p");
    expect(localStorage.getItem("xove.share.quality")).not.toBe("480p");
    expect(local.screens).toEqual([original]);
    // The copy of the capture is stopped, so the browser's sharing indicator doesn't linger.
    expect(failingClone.stopped).toBe(true);
  });
});

describe("room: the sharer sees what they send", () => {
  it("plays my own screen on the stage, without its sound", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();

    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByText("You are sharing");

    const video = await screen.findByLabelText("Your shared screen");
    const local = lastRoom().localParticipant;
    expect(local.screens[0].track.attached).toContain(video);
    expect(video).toHaveProperty("muted", true);
    // My own sound would echo: it isn't played back to me.
    expect(local.screenAudio?.track.attached ?? []).toHaveLength(0);
  });
});

describe("room: the viewer's quality and volume", () => {
  afterEach(() => localStorage.clear());

  const watchBruno = async (options: { height?: number; withSound?: boolean; layers?: number } = {}) => {
    const server = installFakeApi({ me: member });
    server.screenHolder = someoneSharing("Bruno Lima", 7);
    const view = renderRoom();
    await connected();
    await screen.findByText("Bruno is sharing");
    act(() => {
      lastRoom().publishScreen("user-7", options);
    });
    await screen.findByLabelText("Bruno's shared screen");
    return view;
  };

  it("asks the server for less when a lower quality is picked, and for the best again on Auto", async () => {
    await watchBruno();
    const user = userEvent.setup();
    const publication = lastRoom().screenPublication("user-7")!;

    await user.selectOptions(within(stage()).getByLabelText("Quality"), "480p");
    expect(publication.setVideoDimensions).toHaveBeenLastCalledWith({ width: 854, height: 480 });

    await user.selectOptions(within(stage()).getByLabelText("Quality"), "auto");
    expect(publication.setVideoQuality).toHaveBeenLastCalledWith(2);
  });

  it("only offers what the sharer sends", async () => {
    await watchBruno({ height: 720 });
    const options = [...(within(stage()).getByLabelText("Quality") as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toEqual(["auto", "720p", "480p"]);
  });

  it("offers no lower quality when the sharer sends only one (Firefox, Safari)", async () => {
    await watchBruno({ height: 1080, layers: 1 });
    const options = [...(within(stage()).getByLabelText("Quality") as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toEqual(["auto", "1080p"]);
  });

  it("asks for Auto when the remembered quality isn't offered by this sharer", async () => {
    localStorage.setItem("xove.watch.quality", "1080p");
    await watchBruno({ height: 720 });

    expect(within(stage()).getByLabelText("Quality")).toHaveValue("auto");
    expect(lastRoom().screenPublication("user-7")!.setVideoQuality).toHaveBeenLastCalledWith(2);
  });

  it("plays the sound at the chosen volume, mutes it, and remembers both", async () => {
    const view = await watchBruno({ withSound: true });
    const user = userEvent.setup();
    const sound = lastRoom().remoteParticipants.get("user-7")!.tracks.get("screen_share_audio")!;
    const audio = () => sound.attached[0] as HTMLAudioElement;

    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.3" } });
    expect(audio().volume).toBeCloseTo(0.3);
    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(audio().muted).toBe(true);

    view.unmount();
    await watchBruno({ withSound: true });
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
    expect(screen.getByLabelText("Volume")).toHaveValue("0");
    await user.click(screen.getByRole("button", { name: "Unmute" }));
    expect(screen.getByLabelText("Volume")).toHaveValue("0.3");
  });

  it("asks for the remembered quality as soon as the screen arrives", async () => {
    localStorage.setItem("xove.watch.quality", "720p");
    await watchBruno();

    expect(lastRoom().screenPublication("user-7")!.setVideoDimensions).toHaveBeenLastCalledWith({ width: 1280, height: 720 });
    expect(within(stage()).getByLabelText("Quality")).toHaveValue("720p");
  });

  it("doesn't show the viewer's bar to the sharer", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText(/the stage is free/i);
    const user = userEvent.setup();
    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));
    await screen.findByLabelText("Your shared screen");

    expect(screen.queryByRole("button", { name: "Mute" })).not.toBeInTheDocument();
  });
});
