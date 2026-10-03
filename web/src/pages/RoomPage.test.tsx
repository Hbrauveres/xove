import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { capOf, screenCaptureOptions, screenPublishOptions } from "../media/shareSettings";
import { AuthProvider } from "../auth/AuthProvider";
import { aUser, installFakeApi, MY_USER_ID, someoneSharing } from "../test/fakeApi";
import { FakeLocalScreenTrack, lastRoom } from "../test/fakeLiveKit";
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

// ---- sharing: pick a screen, set it up, start (spec 0086) ----

/** The room, connected, with a free stage. */
async function readyRoom() {
  renderRoom();
  await connected();
  await screen.findByText(/the stage is free/i);
  return userEvent.setup();
}

type User = ReturnType<typeof userEvent.setup>;
const setupWindow = () => screen.findByRole("dialog", { name: /start sharing/i });

/** Clicks "Share my screen": the browser's picker, then the setup window. */
async function pickScreen(user: User, button: RegExp = /share my screen/i) {
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
    expect(local.createScreenTracks).toHaveBeenCalled();
    expect(local.lastCapture[0].attached).toContain(within(setup).getByLabelText("Preview of your screen"));
    expect(within(setup).getByLabelText("Send quality")).toHaveValue("1080p");
    expect(within(setup).getByLabelText("Mode")).toHaveValue("smooth");
    expect(local.publishTrack).not.toHaveBeenCalled();
    expect(server.calls.some((c) => c.path === "/api/screen/take")).toBe(false);
  });

  it("starts with the settings chosen, taking the slot with the CSRF token, the connection and the settings", async () => {
    document.cookie = "XSRF-TOKEN=abc123";
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    const setup = await pickScreen(user);

    await user.selectOptions(within(setup).getByLabelText("Send quality"), "720p");
    await user.selectOptions(within(setup).getByLabelText("Mode"), "sharp");
    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));

    expect(await screen.findByText("You are sharing")).toBeInTheDocument();
    const take = server.calls.find((c) => c.method === "POST" && c.path === "/api/screen/take");
    expect(take?.headers["X-XSRF-TOKEN"]).toBe("abc123");
    expect(take?.body).toEqual({ participantSid: "PA_me", trackSid: "TR_my_screen", quality: "720p", mode: "sharp" });
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
    expect(server.calls.some((c) => c.path === "/api/screen/take")).toBe(false);
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

    await user.click(within(controls()).getByRole("button", { name: /share my screen/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/the stage is free/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(server.calls.some((c) => c.path === "/api/screen/take")).toBe(false);
  });

  it("stops sharing and says so when the screen track can't be identified", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    lastRoom().localParticipant.screenTrackSid = undefined;
    const setup = await pickScreen(user);

    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));

    expect(await screen.findByText(/couldn't start sharing your screen/i)).toBeInTheDocument();
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false);
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
    const setup = await setupWindow();
    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));

    expect(await screen.findByText("You are sharing")).toBeInTheDocument();
    expect(server.screenHolder?.userId).toBe(MY_USER_ID);
  });

  it("stops the video and frees the slot", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);

    await user.click(within(controls()).getByRole("button", { name: /stop sharing/i }));

    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();
    expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false);
    expect(server.screenHolder).toBeNull();
  });

  it("frees the slot when the browser's own Stop sharing bar is used", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);

    act(() => {
      lastRoom().browserStopsMyShare();
    });

    await waitFor(() => expect(server.screenHolder).toBeNull());
    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();
  });

  it("stops sending my screen when someone takes it from me", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);

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
    expect(local.createScreenTracks).toHaveBeenCalledWith(screenCaptureOptions("smooth"));
    const [video, sound] = local.lastCapture;
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
    expect(lastRoom().localParticipant.createScreenTracks).toHaveBeenCalledWith(screenCaptureOptions("sharp"));
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

    await waitFor(() => expect(server.screenSettings).toEqual({ quality: "480p", mode: "smooth" }));
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

    await waitFor(() => expect(server.screenSettings.quality).toBe("1080p"));
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("1080p"));
  });

  it("changes the mode live: marked for detail, keeping sharpness", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const video = lastRoom().localParticipant.screens[0].track;

    await user.selectOptions(sharerBar().getByLabelText("Mode"), "sharp");

    await waitFor(() => expect(server.screenSettings).toEqual({ quality: "1080p", mode: "sharp" }));
    expect(video.mediaStreamTrack.contentHint).toBe("detail");
    expect(video.setDegradationPreference).toHaveBeenLastCalledWith("maintain-resolution");
  });

  it("puts the old settings back when the API refuses the change", async () => {
    const server = installFakeApi({ me: member });
    server.failures.set("POST /api/screen/settings", {
      status: 409,
      body: { status: 409, detail: "Only the person sharing can change how their screen is sent." },
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
    await waitFor(() => expect(server.screenSettings.quality).toBe("720p"));

    await user.click(within(controls()).getByRole("button", { name: /stop sharing/i }));

    expect(await screen.findByText(/the stage is free/i)).toBeInTheDocument();
    expect(local.screens).toHaveLength(0);
    expect(local.screenAudio).toBeNull();
    expect(local.lastCapture.every((t) => t.stopped)).toBe(true);
    expect(server.screenHolder).toBeNull();
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
    server.screenHolder = someoneSharing("Bruno Lima", 7);
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
      server.screenSettings = { quality: "720p", mode: "smooth" };
    });

    await waitFor(() => expect(offered()).toEqual(["auto", "720p", "480p"]));
    expect(publication.setVideoDimensions).toHaveBeenLastCalledWith({ width: 1280, height: 720 });

    // And raises it back.
    act(() => {
      server.screenSettings = { quality: "1080p", mode: "smooth" };
    });

    await waitFor(() => expect(offered()).toEqual(["auto", "1080p", "720p", "480p"]));
    expect(publication.setVideoQuality).toHaveBeenLastCalledWith(2);
  });

  it("keeps a viewer's own lower choice when the sharer lowers theirs", async () => {
    localStorage.setItem("xove.watch.quality", "480p");
    const server = installFakeApi({ me: member });
    server.screenHolder = someoneSharing("Bruno Lima", 7);
    renderRoom();
    await connected();
    await screen.findByText("Bruno is sharing");
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    await screen.findByLabelText("Bruno's shared screen");

    act(() => {
      server.screenSettings = { quality: "720p", mode: "sharp" };
    });

    await waitFor(() => expect(within(stage()).getByLabelText("Quality")).toHaveValue("480p"));
    expect(lastRoom().screenPublication("user-7")!.setVideoDimensions).toHaveBeenLastCalledWith({ width: 854, height: 480 });
  });
});

describe("room: the player's labels and bars", () => {
  it("show while the mouse moves over the player, and fade when it stops or leaves", async () => {
    const server = installFakeApi({ me: member });
    server.screenHolder = someoneSharing("Bruno Lima", 7);
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

describe("room: the player on touch screens and keyboards", () => {
  const watchBruno = async () => {
    const server = installFakeApi({ me: member });
    server.screenHolder = someoneSharing("Bruno Lima", 7);
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
    await screen.findByText(/the stage is free/i);

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

    await waitFor(() => expect(server.screenSettings.quality).toBe("480p"));
    const sent = server.calls.filter((c) => c.path === "/api/screen/settings").map((c) => (c.body as { quality: string }).quality);
    expect(sent).toEqual(["720p", "480p"]);
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("480p"));
    expect(select).toHaveValue("480p");
  });
});

describe("room: the setup window and the keyboard", () => {
  it("keeps the focus inside while open, and gives it back when closed", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    const shareButton = within(controls()).getByRole("button", { name: /share my screen/i });
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
    expect(within(controls()).getByRole("button", { name: /share my screen/i })).toHaveFocus();
  });
});
