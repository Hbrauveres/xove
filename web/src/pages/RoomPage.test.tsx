import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { cameraCaptureOptions, cameraPublishOptions, capOf, screenCaptureRequest, screenPublishOptions } from "../media/shareSettings";
import { AuthProvider } from "../auth/AuthProvider";
import { aUser, installFakeApi, MY_USER_ID, myLiveStream, someoneSharing } from "../test/fakeApi";
import { FakeLocalScreenTrack, lastRoom } from "../test/fakeLiveKit";
import { RoomPage } from "./RoomPage";

const member = aUser({ name: "Henrique Brauveres", status: "MEMBER" });
const FAST_POLL = 50;
const myOldStream = () => ({ ...someoneSharing("Henrique"), userId: MY_USER_ID });

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

// My screen and camera buttons sit on the stage (spec 0098).
const controls = () => screen.getByRole("region", { name: /shared screen/i });
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
    expect(screen.getByText(/nobody is sharing right now/i)).toBeInTheDocument();
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

    expect(await screen.findByText(/nobody is sharing right now/i)).toBeInTheDocument();
  });

  it("plays the sharer's screen once their video arrives", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
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
    expect(await screen.findByText(/nobody is sharing right now/i)).toBeInTheDocument();

    act(() => {
      server.streams = [someoneSharing("Duda", 9)];
    });

    expect(await screen.findByText("Duda is sharing")).toBeInTheDocument();
    expect(await screen.findByText(/duda started sharing/i)).toBeInTheDocument();
  });

  // Spec 0038, AC-8: the API ends the stream when LiveKit says the sharer left.
  it("logs 'stopped sharing' when the stream ends from outside", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Ana Souza", 7)];
    renderRoom();
    expect(await screen.findByText("Ana is sharing")).toBeInTheDocument();

    act(() => {
      server.streams = [];
    });

    expect(await screen.findByText(/nobody is sharing right now/i)).toBeInTheDocument();
    expect(await screen.findByText(/ana stopped sharing/i)).toBeInTheDocument();
  });
});

// ---- sharing: pick a screen, set it up, start (spec 0086) ----

/** The room, connected, with a free stage. */
async function readyRoom() {
  renderRoom();
  await connected();
  await screen.findByText(/nobody is sharing right now/i);
  return userEvent.setup();
}

type User = ReturnType<typeof userEvent.setup>;
const setupWindow = () => screen.findByRole("dialog", { name: /start sharing/i });

/** Clicks "Share my screen": the browser's picker, then the setup window. */
async function pickScreen(user: User, button: RegExp = /share your screen/i) {
  await user.click(within(controls()).getByRole("button", { name: button }));
  return setupWindow();
}

/** Picks a screen and starts sharing it with the settings in the setup window. */
async function startSharing(user: User) {
  const setup = await pickScreen(user);
  await user.click(within(setup).getByRole("button", { name: /start sharing/i }));
  await screen.findByText("You are sharing");
}

const sharerBar = () => within(stage());

describe("room: sharing", () => {
  afterEach(() => localStorage.clear());

  it("shows the picked screen and its settings before anything is sent", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();

    const setup = await pickScreen(user);

    const local = lastRoom().localParticipant;
    expect(local.getDisplayMedia).toHaveBeenCalled();
    expect(local.lastCapture[0].attached).toContain(within(setup).getByLabelText("Preview of your screen"));
    expect(within(setup).getByLabelText("Send quality")).toHaveValue("1080p");
    expect(within(setup).getByLabelText("Mode")).toHaveValue("smooth");
    expect(local.publishTrack).not.toHaveBeenCalled();
    expect(server.calls.some((c) => c.path === "/api/streams" && c.method === "POST")).toBe(false);
  });

  it("starts with the settings chosen, sending the CSRF token, the kind, the connection and the settings", async () => {
    document.cookie = "XSRF-TOKEN=abc123";
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    const setup = await pickScreen(user);

    await user.selectOptions(within(setup).getByLabelText("Send quality"), "720p");
    await user.selectOptions(within(setup).getByLabelText("Mode"), "sharp");
    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));

    expect(await screen.findByText("You are sharing")).toBeInTheDocument();
    const take = server.calls.find((c) => c.method === "POST" && c.path === "/api/streams" && c.method === "POST");
    expect(take?.headers["X-XSRF-TOKEN"]).toBe("abc123");
    expect(take?.body).toEqual({ kind: "screen", participantSid: "PA_me", trackSid: "TR_my_screen", quality: "720p", mode: "sharp" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends nothing and stops the capture when the setup is cancelled", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    const setup = await pickScreen(user);
    const local = lastRoom().localParticipant;

    await user.click(within(setup).getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(local.lastCapture.every((t) => t.stopped)).toBe(true);
    expect(local.publishTrack).not.toHaveBeenCalled();
    expect(server.calls.some((c) => c.path === "/api/streams" && c.method === "POST")).toBe(false);
  });

  it("closes the setup when the browser's own Stop sharing bar is used", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    await pickScreen(user);

    act(() => {
      lastRoom().browserStopsMyShare();
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(lastRoom().localParticipant.publishTrack).not.toHaveBeenCalled();
  });

  it("does nothing if the picker is closed without choosing", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    lastRoom().localParticipant.nextPicker = "cancel";

    await user.click(within(controls()).getByRole("button", { name: /share your screen/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/nobody is sharing right now/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(server.calls.some((c) => c.path === "/api/streams" && c.method === "POST")).toBe(false);
  });

  it("says so when the browser gives no screen", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    lastRoom().localParticipant.nextPicker = "no-video";

    await user.click(within(controls()).getByRole("button", { name: /share your screen/i }));

    expect(await screen.findByText("Couldn't start sharing your screen.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(lastRoom().localParticipant.publishTrack).not.toHaveBeenCalled();
  });

  it("says so when the browser can't share a screen at all", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    const devices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices")!;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {} });
    try {
      await user.click(within(controls()).getByRole("button", { name: /share your screen/i }));

      expect(await screen.findByText("Couldn't start sharing your screen.")).toBeInTheDocument();
      expect(lastRoom().localParticipant.publishTrack).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, "mediaDevices", devices);
    }
  });

  it("stops sharing and says so when the screen track can't be identified", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    lastRoom().localParticipant.screenTrackSid = undefined;
    const setup = await pickScreen(user);

    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));

    expect(await screen.findByText(/couldn't start sharing your screen/i)).toBeInTheDocument();
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false);
    expect(server.calls.some((c) => c.path === "/api/streams" && c.method === "POST")).toBe(false);
  });

  // Spec 0060: several screens at once, nobody is pushed out.
  it("shares alongside someone else, without asking anyone to stop", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno", 7)];
    renderRoom();
    await connected();
    await screen.findByText("Bruno is sharing");
    const user = userEvent.setup();

    await user.click(within(controls()).getByRole("button", { name: /share your screen/i }));
    const setup = await setupWindow();
    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));

    await waitFor(() => expect(myLiveStream(server)).toBeDefined());
    expect(server.streams.map((st) => st.userId)).toEqual([7, MY_USER_ID]);
  });

  it("stops the video and ends the stream", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);

    await user.click(within(controls()).getByRole("button", { name: /stop sharing/i }));

    expect(await screen.findByText(/nobody is sharing right now/i)).toBeInTheDocument();
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false);
    expect(myLiveStream(server)).toBeUndefined();
  });

  it("ends the stream when the browser's own Stop sharing bar is used", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);

    act(() => {
      lastRoom().browserStopsMyShare();
    });

    await waitFor(() => expect(myLiveStream(server)).toBeUndefined());
    expect(await screen.findByText(/nobody is sharing right now/i)).toBeInTheDocument();
  });

  // AC-1: six streams at once; a seventh can't start, and the buttons say why.
  it("says the room is full of streams, and waits for a free place", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [1, 2, 3].flatMap((id) => [
      someoneSharing(`P${id}`, id, "screen"),
      someoneSharing(`P${id}`, id, "camera"),
    ]);
    renderRoom();
    await connected();

    // Greyed out, still focusable, with the reason in their tooltip.
    const share = within(controls()).getByRole("button", { name: /share your screen/i });
    await waitFor(() => expect(share).toHaveAttribute("aria-disabled", "true"));
    expect(share).toHaveAccessibleDescription(expect.stringMatching(/6 streams are live/i));
    expect(within(controls()).getByRole("button", { name: /turn on camera/i })).toHaveAttribute("aria-disabled", "true");

    act(() => {
      server.streams = server.streams.slice(1);
    });

    await waitFor(() =>
      expect(within(controls()).getByRole("button", { name: /share your screen/i })).not.toHaveAttribute("aria-disabled"),
    );
  });

  // Every deploy restarts the API, which forgets the streams: mine is registered again.
  it("registers my screen again when the API forgot it", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);

    act(() => {
      server.streams = [];
    });

    await waitFor(() => expect(server.calls.filter((c) => c.method === "POST" && c.path === "/api/streams")).toHaveLength(2));
    const again = server.calls.filter((c) => c.method === "POST" && c.path === "/api/streams").at(-1);
    expect(again?.body).toEqual({ kind: "screen", participantSid: "PA_me", trackSid: "TR_my_screen", quality: "1080p", mode: "smooth" });
    expect(myLiveStream(server)).toBeDefined();
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(true);
  });

  it("stops my screen when the places filled up while the API forgot it", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);

    act(() => {
      server.streams = [1, 2, 3, 4, 5, 6].map((id) => someoneSharing(`P${id}`, id));
    });

    await waitFor(() => expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false));
    expect(await screen.findByRole("alert")).toHaveTextContent("The room already has 6 streams.");
  });

  it("ends my stream after a reload, when nothing is being sent", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [myOldStream()];
    renderRoom();

    await waitFor(() => expect(myLiveStream(server)).toBeUndefined());
    expect(await screen.findByText(/nobody is sharing right now/i)).toBeInTheDocument();
  });

  it("shows the API's message when starting the stream fails, and stops the video", async () => {
    const server = installFakeApi({ me: member });
    server.failures.set("POST /api/streams", {
      status: 403,
      body: { status: 403, detail: "Members only" },
    });
    const user = await readyRoom();
    const setup = await pickScreen(user);

    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Members only");
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false);
  });
});

describe("room: what the screen is sent with", () => {
  afterEach(() => localStorage.clear());

  it("captures the best quality and sends it with the mode's settings, capped at the chosen quality", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    const setup = await pickScreen(user);
    await user.selectOptions(within(setup).getByLabelText("Send quality"), "720p");
    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));
    await screen.findByText("You are sharing");

    const local = lastRoom().localParticipant;
    // The browser is asked directly: livekit-client would drop `windowAudio` (spec 0095).
    expect(local.getDisplayMedia).toHaveBeenCalledWith(screenCaptureRequest());
    const [video, sound] = local.lastCapture;
    expect([video.source, sound.source]).toEqual(["screen_share", "screen_share_audio"]);
    expect(lastRoom().startAudio).toHaveBeenCalled();
    expect(local.publishTrack).toHaveBeenCalledWith(video, { ...screenPublishOptions("smooth"), source: "screen_share" });
    expect(local.publishTrack).toHaveBeenCalledWith(sound, { ...screenPublishOptions("smooth"), source: "screen_share_audio" });
    expect(video.mediaStreamTrack.contentHint).toBe("motion");
    expect((video as FakeLocalScreenTrack).setPublishingQuality).toHaveBeenLastCalledWith(capOf("720p"));
  });

  it("starts the setup with the choices used last time, and remembers the ones confirmed", async () => {
    localStorage.setItem("xove.share.quality", "480p");
    localStorage.setItem("xove.share.mode", "sharp");
    installFakeApi({ me: member });
    const user = await readyRoom();
    const setup = await pickScreen(user);

    expect(within(setup).getByLabelText("Send quality")).toHaveValue("480p");
    expect(within(setup).getByLabelText("Mode")).toHaveValue("sharp");
    await user.selectOptions(within(setup).getByLabelText("Send quality"), "720p");
    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));
    await screen.findByText("You are sharing");

    expect(localStorage.getItem("xove.share.quality")).toBe("720p");
    expect(lastRoom().localParticipant.getDisplayMedia).toHaveBeenCalledWith(screenCaptureRequest());
    expect(lastRoom().localParticipant.lastCapture[0].mediaStreamTrack.contentHint).toBe("detail");
  });

  it("tells the sharer when their browser gave no sound, in the setup and while sharing", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    lastRoom().localParticipant.nextPickerAudio = false;

    const setup = await pickScreen(user);
    expect(within(setup).getByText(/no sound with this screen/i)).toBeInTheDocument();
    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));

    expect(await screen.findByText(/no sound is being shared/i)).toBeInTheDocument();
  });

  it("says nothing about sound when it is being shared", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    const setup = await pickScreen(user);
    expect(within(setup).queryByText(/no sound with this screen/i)).not.toBeInTheDocument();

    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));
    await screen.findByText("You are sharing");

    expect(screen.queryByText(/no sound is being shared/i)).not.toBeInTheDocument();
  });
});

describe("room: changing the stream while sharing", () => {
  afterEach(() => localStorage.clear());

  it("changes the quality live from my player: same stream, and the API tells everyone", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const local = lastRoom().localParticipant;
    const video = local.screens[0].track;

    await user.selectOptions(sharerBar().getByLabelText("Send quality"), "480p");

    await waitFor(() => expect(myLiveStream(server)?.settings).toEqual({ quality: "480p", mode: "smooth" }));
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("480p"));
    // No new track and no reload for viewers.
    expect(local.publishTrack).toHaveBeenCalledTimes(2);
    expect(local.unpublishTrack).not.toHaveBeenCalled();
    expect(screen.getByText("You are sharing")).toBeInTheDocument();
    expect(localStorage.getItem("xove.share.quality")).toBe("480p");
  });

  it("can raise the quality again while sharing", async () => {
    localStorage.setItem("xove.share.quality", "480p");
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const video = lastRoom().localParticipant.screens[0].track;

    await user.selectOptions(sharerBar().getByLabelText("Send quality"), "1080p");

    await waitFor(() => expect(myLiveStream(server)?.settings.quality).toBe("1080p"));
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("1080p"));
  });

  it("changes the mode live: marked for detail, keeping sharpness", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const video = lastRoom().localParticipant.screens[0].track;

    await user.selectOptions(sharerBar().getByLabelText("Mode"), "sharp");

    await waitFor(() => expect(myLiveStream(server)?.settings).toEqual({ quality: "1080p", mode: "sharp" }));
    expect(video.mediaStreamTrack.contentHint).toBe("detail");
    expect(video.setDegradationPreference).toHaveBeenLastCalledWith("maintain-resolution");
  });

  it("puts the old settings back when the API refuses the change", async () => {
    const server = installFakeApi({ me: member });
    server.failures.set("POST /api/streams/screen/settings", {
      status: 409,
      body: { status: 409, detail: "Only the person sharing can change how their stream is sent." },
    });
    const user = await readyRoom();
    await startSharing(user);
    const video = lastRoom().localParticipant.screens[0].track;

    await user.selectOptions(sharerBar().getByLabelText("Send quality"), "480p");

    expect(await screen.findByRole("alert")).toHaveTextContent(/only the person sharing/i);
    await waitFor(() => expect(sharerBar().getByLabelText("Send quality")).toHaveValue("1080p"));
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("1080p"));
    expect(localStorage.getItem("xove.share.quality")).not.toBe("480p");
  });

  it("stops everything when Stop is pressed after a change", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const local = lastRoom().localParticipant;
    await user.selectOptions(sharerBar().getByLabelText("Send quality"), "720p");
    await waitFor(() => expect(myLiveStream(server)?.settings.quality).toBe("720p"));

    await user.click(within(controls()).getByRole("button", { name: /stop sharing/i }));

    expect(await screen.findByText(/nobody is sharing right now/i)).toBeInTheDocument();
    expect(local.screens).toHaveLength(0);
    expect(local.screenAudio).toBeNull();
    expect(local.lastCapture.every((t) => t.stopped)).toBe(true);
    expect(myLiveStream(server)).toBeUndefined();
  });
});

describe("room: the sharer sees what they send", () => {
  it("plays my own screen on the stage, without its sound", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();

    await startSharing(user);

    const video = await screen.findByLabelText("Your shared screen");
    const local = lastRoom().localParticipant;
    expect(local.screens[0].track.attached).toContain(video);
    // No browser picture-in-picture button over the player (Edge adds one).
    expect(video).toHaveAttribute("disablepictureinpicture");
    expect(video).toHaveProperty("muted", true);
    // My own sound would echo: it isn't played back to me.
    expect(local.screenAudio?.track.attached ?? []).toHaveLength(0);
  });
});

describe("room: the viewer's quality and volume", () => {
  afterEach(() => localStorage.clear());

  const watchBruno = async (options: { height?: number; withSound?: boolean; layers?: number } = {}) => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
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

  it("shows the sharer their own settings instead of the viewer's bar", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);

    expect(within(stage()).queryByRole("button", { name: "Mute" })).not.toBeInTheDocument();
    expect(within(stage()).getByLabelText("Send quality")).toBeInTheDocument();
  });
});

describe("room: viewers follow the sharer's changes", () => {
  afterEach(() => localStorage.clear());

  it("offers nothing above the sharer's quality, and Auto asks for at most that", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();
    await screen.findByText("Bruno is sharing");
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    await screen.findByLabelText("Bruno's shared screen");
    const publication = lastRoom().screenPublication("user-7")!;
    const offered = () => [...(within(stage()).getByLabelText("Quality") as HTMLSelectElement).options].map((o) => o.value);
    expect(offered()).toEqual(["auto", "1080p", "720p", "480p"]);

    // Bruno lowers his quality; the API says so on the next poll.
    act(() => {
      server.streams[0].settings = { quality: "720p", mode: "smooth" };
    });

    await waitFor(() => expect(offered()).toEqual(["auto", "720p", "480p"]));
    expect(publication.setVideoDimensions).toHaveBeenLastCalledWith({ width: 1280, height: 720 });

    // And raises it back.
    act(() => {
      server.streams[0].settings = { quality: "1080p", mode: "smooth" };
    });

    await waitFor(() => expect(offered()).toEqual(["auto", "1080p", "720p", "480p"]));
    expect(publication.setVideoQuality).toHaveBeenLastCalledWith(2);
  });

  it("keeps a viewer's own lower choice when the sharer lowers theirs", async () => {
    localStorage.setItem("xove.watch.quality", "480p");
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();
    await screen.findByText("Bruno is sharing");
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    await screen.findByLabelText("Bruno's shared screen");

    act(() => {
      server.streams[0].settings = { quality: "720p", mode: "sharp" };
    });

    await waitFor(() => expect(within(stage()).getByLabelText("Quality")).toHaveValue("480p"));
    expect(lastRoom().screenPublication("user-7")!.setVideoDimensions).toHaveBeenLastCalledWith({ width: 854, height: 480 });
  });
});

describe("room: the player's labels and bars", () => {
  it("show while the mouse moves over the player, and fade when it stops or leaves", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();
    await screen.findByText("Bruno is sharing");
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    const video = await screen.findByLabelText("Bruno's shared screen");
    const frame = video.closest("[data-chrome]")!;
    expect(frame).toHaveAttribute("data-chrome", "hidden");

    fireEvent.pointerMove(frame);
    expect(frame).toHaveAttribute("data-chrome", "shown");

    fireEvent.pointerLeave(frame);
    expect(frame).toHaveAttribute("data-chrome", "hidden");

    fireEvent.pointerMove(frame);
    await waitFor(() => expect(frame).toHaveAttribute("data-chrome", "hidden"), { timeout: 4000 });
  });
});

describe("room: my screen and camera buttons on the player (spec 0098)", () => {
  it("has no bar under the player: the buttons are on the stage, and never fade over an empty one", async () => {
    installFakeApi({ me: member });
    await readyRoom();

    expect(screen.queryByRole("region", { name: /screen sharing/i })).not.toBeInTheDocument();
    const share = within(stage()).getByRole("button", { name: "Share your screen" });
    expect(within(stage()).getByRole("button", { name: "Turn on camera" })).toBeInTheDocument();
    expect(share.closest("[data-chrome]")).toBeNull();
    expect(screen.queryByRole("button", { name: /share my screen/i })).not.toBeInTheDocument();
  });

  it("fade with the player's bars over a stream", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    const frame = (await screen.findByLabelText("Bruno's shared screen")).closest("[data-chrome]")!;

    expect(frame).toContainElement(within(stage()).getByRole("button", { name: "Share your screen" }));
    expect(frame).toHaveAttribute("data-chrome", "hidden");
    fireEvent.pointerMove(frame);
    expect(frame).toHaveAttribute("data-chrome", "shown");
  });

  it("stay while a stream's menu is open", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const frame = (await screen.findByLabelText("Your shared screen")).closest("[data-chrome]")!;

    await user.click(within(stage()).getByRole("button", { name: "Screen options" }));
    (document.activeElement as HTMLElement).blur();
    fireEvent.pointerLeave(frame);

    expect(frame).toHaveAttribute("data-chrome", "shown");
    expect(screen.getByRole("menu", { name: "Screen options" })).toBeInTheDocument();
  });
});

describe("room: the player on touch screens and keyboards", () => {
  const watchBruno = async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    const view = renderRoom();
    await connected();
    await screen.findByText("Bruno is sharing");
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    const video = await screen.findByLabelText("Bruno's shared screen");
    return { view, frame: video.closest("[data-chrome]")! };
  };

  it("keeps the controls after a tap, so they can be tapped", async () => {
    const { frame } = await watchBruno();

    // A finger lifting off fires pointerleave right away.
    fireEvent.pointerDown(frame, { pointerType: "touch" });
    fireEvent.pointerLeave(frame, { pointerType: "touch" });

    expect(frame).toHaveAttribute("data-chrome", "shown");
  });

  it("keeps the controls while one of them has the keyboard focus", async () => {
    const { frame } = await watchBruno();

    act(() => {
      within(stage()).getByRole("button", { name: "Full screen" }).focus();
    });
    expect(frame).toHaveAttribute("data-chrome", "shown");

    await new Promise((resolve) => setTimeout(resolve, 2700));
    expect(frame).toHaveAttribute("data-chrome", "shown");
  });

  it("doesn't hide anything over an empty stage", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await screen.findByText(/nobody is sharing right now/i);

    expect(stage().querySelector("[data-chrome]")).toBeNull();
  });
});

describe("room: a picked screen that's never sent", () => {
  it("stops being captured when the page is left with the setup window open", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    await pickScreen(user);
    const capture = lastRoom().localParticipant.lastCapture;

    cleanup();

    expect(capture.every((t) => t.stopped)).toBe(true);
  });

  it("stops the sound too when the browser's bar ends the screen during the setup", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    await pickScreen(user);
    const capture = lastRoom().localParticipant.lastCapture;

    act(() => {
      lastRoom().browserStopsMyShare();
    });

    await waitFor(() => expect(capture.every((t) => t.stopped)).toBe(true));
  });
});

describe("room: quick changes while sharing", () => {
  afterEach(() => localStorage.clear());

  it("applies changes in order, and the last one wins everywhere", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const video = lastRoom().localParticipant.screens[0].track;
    const select = sharerBar().getByLabelText("Send quality");

    fireEvent.change(select, { target: { value: "720p" } });
    fireEvent.change(select, { target: { value: "480p" } });

    await waitFor(() => expect(myLiveStream(server)?.settings.quality).toBe("480p"));
    const sent = server.calls.filter((c) => c.path === "/api/streams/screen/settings").map((c) => (c.body as { quality: string }).quality);
    expect(sent).toEqual(["720p", "480p"]);
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("480p"));
    expect(select).toHaveValue("480p");
  });
});

describe("room: the setup window and the keyboard", () => {
  it("keeps the focus inside while open, and gives it back when closed", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    const shareButton = within(controls()).getByRole("button", { name: /share your screen/i });
    await user.click(shareButton);
    const setup = await setupWindow();

    expect(within(setup).getByRole("button", { name: /start sharing/i })).toHaveFocus();
    await user.tab(); // Cancel
    await user.tab(); // past the last control: back to the first one
    expect(within(setup).getByLabelText("Send quality")).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(setup).getByRole("button", { name: /cancel/i })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(controls()).getByRole("button", { name: /share your screen/i })).toHaveFocus();
  });
});

// ---- a full room: the queue and the seat offer (spec 0060) ----

describe("room: waiting for a seat", () => {
  const offered = (seconds: number) =>
    ({ status: "offered", until: new Date(Date.now() + seconds * 1000).toISOString(), seconds }) as const;

  it("waits with its place in the queue when the room is full, without joining the video", async () => {
    const server = installFakeApi({ me: member });
    server.seat = { status: "waiting", place: 3 };
    renderRoom();

    expect(await screen.findByText(/you're number 3 in line/i)).toBeInTheDocument();
    expect(server.calls.some((c) => c.path === "/api/livekit/token")).toBe(false);

    act(() => {
      server.seat = { status: "waiting", place: 1 };
    });
    expect(await screen.findByText(/you're next/i)).toBeInTheDocument();
  });

  it("offers the seat in a popup with a countdown, and Enter room takes it", async () => {
    const server = installFakeApi({ me: member });
    server.seat = { status: "waiting", place: 1 };
    renderRoom();
    await screen.findByText(/you're next/i);

    act(() => {
      server.seat = offered(60);
    });

    const offer = await screen.findByRole("dialog", { name: /it's your turn/i });
    expect(offer).toHaveTextContent("60 seconds");
    expect(document.title).toBe("Your turn — Xovê");
    expect(within(offer).getByRole("button", { name: /enter room/i })).toHaveFocus();

    await userEvent.setup().click(within(offer).getByRole("button", { name: /enter room/i }));

    await connected();
    expect(server.calls.some((c) => c.method === "POST" && c.path === "/api/room/accept")).toBe(true);
    expect(document.title).not.toBe("Your turn — Xovê");
  });

  it("leaves the queue on Cancel, and can join it again", async () => {
    const server = installFakeApi({ me: member });
    server.seat = offered(60);
    renderRoom();
    const offer = await screen.findByRole("dialog", { name: /it's your turn/i });
    const user = userEvent.setup();

    await user.click(within(offer).getByRole("button", { name: /cancel/i }));

    expect(await screen.findByText(/you left the queue/i)).toBeInTheDocument();
    expect(server.calls.some((c) => c.method === "POST" && c.path === "/api/room/cancel")).toBe(true);
    const polls = server.calls.filter((c) => c.path === "/api/room/enter").length;
    await new Promise((resolve) => setTimeout(resolve, FAST_POLL * 3));
    expect(server.calls.filter((c) => c.path === "/api/room/enter")).toHaveLength(polls);

    server.seat = { status: "waiting", place: 4 };
    await user.click(screen.getByRole("button", { name: /join the queue again/i }));
    expect(await screen.findByText(/you're number 4 in line/i)).toBeInTheDocument();
  });

  it("goes back to waiting when the offer runs out", async () => {
    const server = installFakeApi({ me: member });
    server.seat = offered(1);
    renderRoom();
    await screen.findByRole("dialog", { name: /it's your turn/i });

    act(() => {
      server.seat = { status: "waiting", place: 2 };
    });

    expect(await screen.findByText(/you're number 2 in line/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tells the API when the waiting tab closes, so the place is kept for a while", async () => {
    const server = installFakeApi({ me: member });
    server.seat = { status: "waiting", place: 2 };
    renderRoom();
    await screen.findByText(/you're number 2 in line/i);

    const leave = () => server.calls.find((c) => c.method === "POST" && c.path === "/api/room/leave");
    await waitFor(() => {
      act(() => {
        window.dispatchEvent(new Event("pagehide"));
      });
      expect(leave()).toBeDefined();
    });
    expect(leave()?.keepalive).toBe(true);
  });

  it("enters again when the API forgot the seat (after a restart), staying in the room", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    const room = lastRoom();
    const enters = () => server.calls.filter((c) => c.path === "/api/room/enter").length;
    const before = enters();

    act(() => {
      server.seated = false;
    });

    await waitFor(() => expect(enters()).toBeGreaterThan(before));
    await waitFor(() => expect(server.seated).toBe(true));
    // My video connection goes with it: that confirms the seat.
    expect(server.calls.filter((c) => c.path === "/api/room/enter").at(-1)?.body).toEqual({ participantSid: "PA_me" });
    expect(room.disconnected).toBe(false);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("goes to the queue when the API forgot the seat and the room filled up", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    const room = lastRoom();

    act(() => {
      server.seated = false;
      server.seat = { status: "waiting", place: 1 };
    });

    expect(await screen.findByText(/you're next/i)).toBeInTheDocument();
    expect(room.disconnected).toBe(true);
  });
});

// ---- cameras (spec 0060) ----

describe("room: my camera", () => {
  afterEach(() => localStorage.clear());

  const cameraWindow = () => screen.findByRole("dialog", { name: /turn on your camera/i });

  /** Clicks "Turn on camera" and starts it from the setup window. */
  async function turnOnCamera(user: User) {
    await user.click(within(controls()).getByRole("button", { name: /turn on camera/i }));
    const setup = await cameraWindow();
    await user.click(within(setup).getByRole("button", { name: /start camera/i }));
    await waitFor(() => expect(within(controls()).getByRole("button", { name: /turn off camera/i })).toBeInTheDocument());
  }

  // AC-3
  it("asks for the camera only after the click, and never for a microphone", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    const local = lastRoom().localParticipant;
    expect(local.createTracks).not.toHaveBeenCalled();

    await user.click(within(controls()).getByRole("button", { name: /turn on camera/i }));
    const setup = await cameraWindow();

    expect(local.createTracks).toHaveBeenCalledTimes(1);
    expect(local.createTracks).toHaveBeenCalledWith({ video: cameraCaptureOptions(), audio: false });
    expect(local.getDisplayMedia).not.toHaveBeenCalled();
    expect(local.lastCamera!.attached).toContain(within(setup).getByLabelText("Preview of your camera"));
    expect(local.publishTrack).not.toHaveBeenCalled();
  });

  it("offers 720p and 480p, starts at 720p, and sends the camera with its settings", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await user.click(within(controls()).getByRole("button", { name: /turn on camera/i }));
    const setup = await cameraWindow();
    const quality = within(setup).getByLabelText("Send quality") as HTMLSelectElement;

    expect([...quality.options].map((o) => o.value)).toEqual(["720p", "480p"]);
    expect(quality).toHaveValue("720p");
    await user.selectOptions(quality, "480p");
    await user.click(within(setup).getByRole("button", { name: /start camera/i }));

    await waitFor(() => expect(myLiveStream(server, "camera")).toBeDefined());
    const local = lastRoom().localParticipant;
    const camera = local.lastCamera!;
    expect(local.publishTrack).toHaveBeenCalledWith(camera, { ...cameraPublishOptions("smooth"), source: "camera" });
    expect(camera.setPublishingQuality).toHaveBeenLastCalledWith(capOf("480p"));
    const start = server.calls.find((c) => c.method === "POST" && c.path === "/api/streams");
    expect(start?.body).toEqual({ kind: "camera", participantSid: "PA_me", trackSid: "TR_my_camera", quality: "480p", mode: "smooth" });
    expect(localStorage.getItem("xove.camera.quality")).toBe("480p");
  });

  // AC-2
  it("shares the screen and the camera together, as 2 of the 6 places", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();

    await startSharing(user);
    await turnOnCamera(user);

    expect(server.streams.map((st) => st.kind)).toEqual(["screen", "camera"]);
    expect(6 - server.streams.length).toBe(4);
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(true);
  });

  it("turns the camera off: stops sending it and ends its stream, the screen stays", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    await turnOnCamera(user);
    const local = lastRoom().localParticipant;
    const camera = local.lastCamera!;

    await user.click(within(controls()).getByRole("button", { name: /turn off camera/i }));

    await waitFor(() => expect(myLiveStream(server, "camera")).toBeUndefined());
    expect(local.unpublishTrack).toHaveBeenCalledWith(camera, true);
    expect(camera.stopped).toBe(true);
    expect(myLiveStream(server, "screen")).toBeDefined();
  });

  it("says so when the browser blocks the camera, and sends nothing", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    lastRoom().localParticipant.nextCamera = "NotAllowedError";

    await user.click(within(controls()).getByRole("button", { name: /turn on camera/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't allow the camera/i);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(server.streams).toHaveLength(0);
  });

  it("says so when there's no camera", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    lastRoom().localParticipant.nextCamera = "NotFoundError";

    await user.click(within(controls()).getByRole("button", { name: /turn on camera/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No camera found.");
  });

  it("shows someone's camera on the stage when that's all they share", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7, "camera")];
    renderRoom();
    await connected();

    act(() => {
      lastRoom().publishCamera("user-7");
    });

    expect(await screen.findByLabelText("Bruno's camera")).toBeInTheDocument();
    expect(screen.getByText(/bruno turned on their camera|bruno is sharing/i)).toBeInTheDocument();
  });
});

// ---- who is big, and the thumbnails (spec 0060, AC-5) ----

describe("room: several people sharing", () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
  const thumbnails = () => screen.getByRole("list", { name: /other streams/i });

  async function threeSharing() {
    const server = installFakeApi({ me: member });
    server.streams = [
      someoneSharing("Ana Souza", 3, "screen", undefined, minutesAgo(10)),
      someoneSharing("Bruno Lima", 7, "screen", undefined, minutesAgo(5)),
      someoneSharing("Caio Reis", 9, "camera", undefined, minutesAgo(1)),
    ];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-3");
      lastRoom().publishScreen("user-7");
      lastRoom().publishCamera("user-9");
    });
    await screen.findByLabelText("Ana's shared screen");
    return server;
  }

  it("shows the first sharer big, and the others as thumbnails", async () => {
    await threeSharing();

    expect(screen.getByText("Ana is sharing")).toBeInTheDocument();
    const items = within(thumbnails()).getAllByRole("button", { name: /watch/i });
    expect(items.map((b) => b.getAttribute("aria-label"))).toEqual(["Watch Bruno", "Watch Caio"]);
    expect(within(thumbnails()).getByLabelText("Bruno's shared screen")).toBeInTheDocument();
    expect(within(thumbnails()).getByLabelText("Caio's camera")).toBeInTheDocument();
  });

  it("makes a thumbnail big on click, and the big one goes back to the thumbnails", async () => {
    await threeSharing();
    const user = userEvent.setup();

    await user.click(within(thumbnails()).getByRole("button", { name: "Watch Bruno" }));

    expect(screen.getByText("Bruno is sharing")).toBeInTheDocument();
    expect(within(stage()).getByLabelText("Bruno's shared screen")).toBeInTheDocument();
    const names = within(thumbnails()).getAllByRole("button", { name: /watch/i }).map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["Watch Ana", "Watch Caio"]);
  });

  it("gives the big place to the longest sharing when the big one stops", async () => {
    const server = await threeSharing();
    const user = userEvent.setup();
    await user.click(within(thumbnails()).getByRole("button", { name: "Watch Caio" }));
    expect(screen.getByText("Caio is sharing")).toBeInTheDocument();

    act(() => {
      server.streams = server.streams.filter((st) => st.userId !== 9);
    });

    expect(await screen.findByText("Ana is sharing")).toBeInTheDocument();
    expect(within(thumbnails()).getAllByRole("button", { name: /watch/i })).toHaveLength(1);
  });

  it("shows no thumbnails with one sharer", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Ana Souza", 3)];
    renderRoom();
    await screen.findByText("Ana is sharing");

    expect(screen.queryByRole("list", { name: /other streams/i })).not.toBeInTheDocument();
  });

  it("puts a stream back to Auto when it leaves the big player", async () => {
    localStorage.setItem("xove.watch.quality", "480p");
    await threeSharing();
    const ana = lastRoom().screenPublication("user-3")!;
    expect(ana.setVideoDimensions).toHaveBeenLastCalledWith({ width: 854, height: 480 });

    await userEvent.setup().click(within(thumbnails()).getByRole("button", { name: "Watch Bruno" }));

    expect(ana.setVideoQuality).toHaveBeenLastCalledWith(2);
    expect(lastRoom().screenPublication("user-7")!.setVideoDimensions).toHaveBeenLastCalledWith({ width: 854, height: 480 });
    localStorage.clear();
  });
});

// ---- screen and camera together: the facecam (spec 0060, AC-6) ----

describe("room: the facecam", () => {
  async function brunoWithBoth() {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7, "screen"), someoneSharing("Bruno Lima", 7, "camera")];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-7");
      lastRoom().publishCamera("user-7");
    });
    await screen.findByLabelText("Bruno's shared screen");
    return server;
  }

  const facecam = () => stage().querySelector("[data-facecam]") as HTMLElement | null;

  it("shows the screen big and the camera in the facecam on top of it", async () => {
    await brunoWithBoth();

    expect(facecam()).not.toBeNull();
    expect(within(facecam()!).getByLabelText("Bruno's camera")).toBeInTheDocument();
    expect(within(stage()).getAllByLabelText("Bruno's shared screen")).toHaveLength(1);
    expect(facecam()!.contains(within(stage()).getByLabelText("Bruno's shared screen"))).toBe(false);
  });

  it("swaps them with the button, and back", async () => {
    await brunoWithBoth();
    const user = userEvent.setup();

    await user.click(within(facecam()!).getByRole("button", { name: "Swap views" }));

    expect(within(facecam()!).getByLabelText("Bruno's shared screen")).toBeInTheDocument();
    expect(facecam()!.contains(within(stage()).getByLabelText("Bruno's camera"))).toBe(false);
    // The quality menu now picks the camera's quality: it offers 720p at most.
    const offered = [...(within(stage()).getByLabelText("Quality") as HTMLSelectElement).options].map((o) => o.value);
    expect(offered).toEqual(["auto", "720p", "480p"]);

    await user.click(within(facecam()!).getByRole("button", { name: "Swap views" }));
    expect(within(facecam()!).getByLabelText("Bruno's camera")).toBeInTheDocument();
  });

  it("collapses to a tab and expands again", async () => {
    await brunoWithBoth();
    const user = userEvent.setup();

    await user.click(within(facecam()!).getByRole("button", { name: "Hide facecam" }));
    expect(facecam()).toBeNull();
    expect(within(stage()).queryByLabelText("Bruno's camera")).not.toBeInTheDocument();

    await user.click(within(stage()).getByRole("button", { name: "Show facecam" }));
    expect(within(facecam()!).getByLabelText("Bruno's camera")).toBeInTheDocument();
  });

  it("goes away when the camera stops", async () => {
    const server = await brunoWithBoth();

    act(() => {
      server.streams = server.streams.filter((st) => st.kind === "screen");
      lastRoom().unpublish("user-7", "camera");
    });

    await waitFor(() => expect(facecam()).toBeNull());
    expect(within(stage()).getByLabelText("Bruno's shared screen")).toBeInTheDocument();
  });

  it("works on the sharer's own preview too", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    await user.click(within(controls()).getByRole("button", { name: /turn on camera/i }));
    const setup = await screen.findByRole("dialog", { name: /turn on your camera/i });
    await user.click(within(setup).getByRole("button", { name: /start camera/i }));

    await waitFor(() => expect(facecam()).not.toBeNull());
    expect(within(facecam()!).getByLabelText("Your camera")).toBeInTheDocument();
    await user.click(within(facecam()!).getByRole("button", { name: "Swap views" }));
    expect(within(facecam()!).getByLabelText("Your shared screen")).toBeInTheDocument();
  });
});

// ---- sound and settings for each stream (spec 0060, AC-7, FR-11) ----

describe("room: whose sound plays", () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
  const thumbnails = () => screen.getByRole("list", { name: /other streams/i });

  async function anaAndBrunoWithSound() {
    const server = installFakeApi({ me: member });
    server.streams = [
      someoneSharing("Ana Souza", 3, "screen", undefined, minutesAgo(10)),
      someoneSharing("Bruno Lima", 7, "screen", undefined, minutesAgo(5)),
    ];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-3", { withSound: true });
      lastRoom().publishScreen("user-7", { withSound: true });
    });
    await screen.findByLabelText("Ana's shared screen");
    const room = lastRoom();
    const sound = (id: string) => room.remoteParticipants.get(id)!.tracks.get("screen_share_audio")!;
    return { server, room, sound };
  }

  it("plays only the big person's sound; a muted thumbnail's isn't even downloaded", async () => {
    const { room, sound } = await anaAndBrunoWithSound();

    expect(sound("user-3").attached).toHaveLength(1);
    await waitFor(() => expect(room.soundPublication("user-7")!.setSubscribed).toHaveBeenLastCalledWith(false));
    expect(sound("user-7").attached).toHaveLength(0);
    expect(within(thumbnails()).getByRole("button", { name: "Unmute Bruno" })).toBeInTheDocument();
  });

  it("plays a thumbnail's sound too when it's unmuted, at its own volume", async () => {
    const { room, sound } = await anaAndBrunoWithSound();
    const user = userEvent.setup();
    await waitFor(() => expect(room.soundPublication("user-7")!.isSubscribed).toBe(false));

    await user.click(within(thumbnails()).getByRole("button", { name: "Unmute Bruno" }));

    expect(room.soundPublication("user-7")!.setSubscribed).toHaveBeenLastCalledWith(true);
    await waitFor(() => expect(sound("user-7").attached).toHaveLength(1));
    fireEvent.change(within(thumbnails()).getByLabelText("Bruno's volume"), { target: { value: "0.4" } });
    expect((sound("user-7").attached[0] as HTMLAudioElement).volume).toBeCloseTo(0.4);
    expect(sound("user-3").attached).toHaveLength(1);

    await user.click(within(thumbnails()).getByRole("button", { name: "Mute Bruno" }));
    expect(room.soundPublication("user-7")!.setSubscribed).toHaveBeenLastCalledWith(false);
  });

  it("plays the new big person's sound after a swap, and mutes the one that left", async () => {
    const { room, sound } = await anaAndBrunoWithSound();
    const user = userEvent.setup();

    await user.click(within(thumbnails()).getByRole("button", { name: "Watch Bruno" }));

    await waitFor(() => expect(sound("user-7").attached).toHaveLength(1));
    expect(room.soundPublication("user-3")!.setSubscribed).toHaveBeenLastCalledWith(false);
  });
});

describe("room: my settings for each of my streams", () => {
  afterEach(() => localStorage.clear());

  it("changes the camera's quality live from my player, apart from the screen's", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    await user.click(within(controls()).getByRole("button", { name: /turn on camera/i }));
    const setup = await screen.findByRole("dialog", { name: /turn on your camera/i });
    await user.click(within(setup).getByRole("button", { name: /start camera/i }));
    await waitFor(() => expect(myLiveStream(server, "camera")).toBeDefined());
    const camera = lastRoom().localParticipant.lastCamera!;

    const cameraQuality = within(stage()).getByLabelText("Camera quality") as HTMLSelectElement;
    expect([...cameraQuality.options].map((o) => o.value)).toEqual(["720p", "480p"]);
    await user.selectOptions(cameraQuality, "480p");

    await waitFor(() => expect(myLiveStream(server, "camera")?.settings.quality).toBe("480p"));
    expect(camera.setPublishingQuality).toHaveBeenLastCalledWith(capOf("480p"));
    expect(myLiveStream(server, "screen")?.settings.quality).toBe("1080p");
    expect(within(stage()).getByLabelText("Send quality")).toHaveValue("1080p");
    expect(localStorage.getItem("xove.camera.quality")).toBe("480p");
  });
});

describe("room: the feed names each stream", () => {
  it("says when someone turns their camera on and off", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();

    act(() => {
      server.streams = [someoneSharing("Bruno Lima", 7, "camera")];
    });
    expect(await screen.findByText(/bruno turned on their camera/i)).toBeInTheDocument();

    act(() => {
      server.streams = [];
    });
    expect(await screen.findByText(/bruno turned off their camera/i)).toBeInTheDocument();
  });
});

// ---- found in review (spec 0060) ----

describe("room: after the review", () => {
  afterEach(() => localStorage.clear());
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
  const thumbnails = () => screen.getByRole("list", { name: /other streams/i });

  it("keeps sending my screen when registering it again fails for another reason, and tries again", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    server.failures.set("POST /api/streams", { status: 503, body: { status: 503, detail: "Starting up" } });

    act(() => {
      server.streams = [];
    });
    await waitFor(() => expect(server.calls.filter((c) => c.method === "POST" && c.path === "/api/streams").length).toBeGreaterThan(1));
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(true);

    server.failures.delete("POST /api/streams");
    await waitFor(() => expect(myLiveStream(server)).toBeDefined());
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(true);
  });

  it("puts a refused screen change back even when the camera changes right after", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    await user.click(within(controls()).getByRole("button", { name: /turn on camera/i }));
    const setup = await screen.findByRole("dialog", { name: /turn on your camera/i });
    await user.click(within(setup).getByRole("button", { name: /start camera/i }));
    await waitFor(() => expect(myLiveStream(server, "camera")).toBeDefined());
    server.failures.set("POST /api/streams/screen/settings", {
      status: 409,
      body: { status: 409, detail: "Only the person sharing can change how their stream is sent." },
    });

    fireEvent.change(within(stage()).getByLabelText("Send quality"), { target: { value: "480p" } });
    fireEvent.change(within(stage()).getByLabelText("Camera quality"), { target: { value: "480p" } });

    await waitFor(() => expect(myLiveStream(server, "camera")?.settings.quality).toBe("480p"));
    await waitFor(() => expect(within(stage()).getByLabelText("Send quality")).toHaveValue("1080p"));
    expect(lastRoom().localParticipant.screens[0].track.setPublishingQuality).toHaveBeenLastCalledWith(capOf("1080p"));
  });

  it("forgets a viewer's pick once that person stops, even if they share again later", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [
      someoneSharing("Ana Souza", 3, "screen", undefined, minutesAgo(10)),
      someoneSharing("Bruno Lima", 7, "screen", undefined, minutesAgo(5)),
    ];
    renderRoom();
    await connected();
    await screen.findByText("Ana is sharing");
    await userEvent.setup().click(within(thumbnails()).getByRole("button", { name: "Watch Bruno" }));
    expect(screen.getByText("Bruno is sharing")).toBeInTheDocument();

    act(() => {
      server.streams = server.streams.filter((st) => st.userId !== 7);
    });
    expect(await screen.findByText("Ana is sharing")).toBeInTheDocument();
    act(() => {
      server.streams = [...server.streams, someoneSharing("Bruno Lima", 7)];
    });

    await within(stage()).findByRole("button", { name: "Watch Bruno" });
    expect(screen.getByText("Ana is sharing")).toBeInTheDocument();
  });

  it("swaps the facecam for one person only", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [
      someoneSharing("Ana Souza", 3, "screen", undefined, minutesAgo(10)),
      someoneSharing("Ana Souza", 3, "camera", undefined, minutesAgo(10)),
      someoneSharing("Bruno Lima", 7, "screen", undefined, minutesAgo(5)),
      someoneSharing("Bruno Lima", 7, "camera", undefined, minutesAgo(5)),
    ];
    renderRoom();
    await connected();
    act(() => {
      for (const id of ["user-3", "user-7"]) {
        lastRoom().publishScreen(id);
        lastRoom().publishCamera(id);
      }
    });
    await screen.findByLabelText("Ana's shared screen");
    const user = userEvent.setup();
    const facecam = () => stage().querySelector("[data-facecam]") as HTMLElement;

    await user.click(within(facecam()).getByRole("button", { name: "Swap views" }));
    expect(within(facecam()).getByLabelText("Ana's shared screen")).toBeInTheDocument();

    await user.click(within(thumbnails()).getByRole("button", { name: "Watch Bruno" }));
    expect(within(facecam()).getByLabelText("Bruno's camera")).toBeInTheDocument();
  });
});
