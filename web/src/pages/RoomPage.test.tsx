import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cameraCaptureOptions, cameraPublishOptions, capOf, screenCaptureRequest, screenPublishOptions } from "../media/shareSettings";
import { AuthProvider } from "../auth/AuthProvider";
import { aUser, installFakeApi, MY_USER_ID, myLiveStream, someoneSharing } from "../test/fakeApi";
import { FakeLocalScreenTrack, lastRoom } from "../test/fakeLiveKit";
import { NARROW_UPRIGHT_QUERY, PORTRAIT_QUERY, SMALL_QUERY, TOUCH_QUERY } from "../hooks/useRoomLayout";
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
// The account button's dot says the connection (spec 0104).
const connected = () => screen.findByRole("button", { name: /: account, connected$/ });
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
    // The account button's dot and name say it (spec 0104).
    expect(screen.getByRole("button", { name: /: account, disconnected$/ })).toBeInTheDocument();
    expect(screen.getByText("0 of 6 live")).toBeInTheDocument();
  });

  it("lists the people connected, and notes who joins and leaves", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();

    act(() => {
      lastRoom().join("user-7", "Bruno Lima");
    });
    // The people button counts them; its panel names them (spec 0104).
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "2 people here" }));
    expect(within(screen.getByRole("dialog", { name: "Here now" })).getByText("Bruno")).toBeInTheDocument();
    // The activity pill shows the latest event.
    expect(screen.getByRole("button", { name: /^Activity: Bruno joined/ })).toBeInTheDocument();

    act(() => {
      lastRoom().leave("user-7");
    });
    expect(screen.getByRole("button", { name: "1 person here" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Activity: Bruno left/ })).toBeInTheDocument();
  });
});

describe("room: watching", () => {
  it("shows a free stage when nobody is sharing", async () => {
    installFakeApi({ me: member });
    renderRoom();

    expect(await screen.findByRole("heading", { name: "The stage is yours." })).toBeInTheDocument();
  });

  it("plays the sharer's screen once their video arrives", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();

    expect(await screen.findByRole("heading", { name: "Bruno" })).toBeInTheDocument();
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
    expect(await screen.findByText("0 of 6 live")).toBeInTheDocument();

    act(() => {
      server.streams = [someoneSharing("Duda", 9)];
    });

    expect(await screen.findByRole("heading", { name: "Duda" })).toBeInTheDocument();
    expect(await screen.findByText(/duda started sharing/i)).toBeInTheDocument();
  });

  // Spec 0038, AC-8: the API ends the stream when LiveKit says the sharer left.
  it("logs 'stopped sharing' when the stream ends from outside", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Ana Souza", 7)];
    renderRoom();
    expect(await screen.findByRole("heading", { name: "Ana" })).toBeInTheDocument();

    act(() => {
      server.streams = [];
    });

    expect(await screen.findByText("0 of 6 live")).toBeInTheDocument();
    expect(await screen.findByText(/ana stopped sharing/i)).toBeInTheDocument();
  });
});

// ---- sharing: pick a screen, set it up, start (spec 0086) ----

/** The room, connected, with a free stage ("0 of 6 live": a text lookup, quicker than a heading by role). */
async function readyRoom() {
  renderRoom();
  await connected();
  await screen.findByText("0 of 6 live");
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
  await screen.findByRole("heading", { name: "You" });
}

type MenuKind = "Screen" | "Camera";

/** My stream's menu, from the arrow on its button (spec 0098). Opened when it isn't. */
async function openMenu(user: User, kind: MenuKind = "Screen") {
  const name = `${kind} options`;
  if (!screen.queryByRole("menu", { name })) await user.click(within(stage()).getByRole("button", { name }));
  return within(screen.getByRole("menu", { name }));
}

/** Picks a quality or mode in my stream's menu. */
async function pickInMenu(user: User, option: string, kind: MenuKind = "Screen") {
  await user.click((await openMenu(user, kind)).getByRole("menuitemradio", { name: option }));
}

/** The viewer's settings menu (spec 0101): opened from the gear when it isn't. */
function watchSettings() {
  if (!screen.queryByRole("menu", { name: "Settings" })) {
    fireEvent.click(within(stage()).getByRole("button", { name: "Settings" }));
  }
  return within(screen.getByRole("menu", { name: "Settings" }));
}

const qualityValue = (item: HTMLElement) => (item.textContent === "Auto" ? "auto" : item.textContent);

/** The qualities the viewer's settings offer, as values ("auto", "1080p", …). */
const offeredQualities = () => watchSettings().getAllByRole("menuitemradio").map(qualityValue);

/** The quality ticked in the viewer's settings. */
const watchedQuality = () =>
  qualityValue(watchSettings().getAllByRole("menuitemradio").find((i) => i.getAttribute("aria-checked") === "true")!);

/** Picks a quality in the viewer's settings ("auto" for Auto). */
const pickWatchQuality = (value: string) =>
  fireEvent.click(watchSettings().getByRole("menuitemradio", { name: value === "auto" ? "Auto" : value }));

/** The quality ticked in my stream's open menu. */
const tickedQuality = (kind: MenuKind = "Screen") =>
  within(screen.getByRole("menu", { name: `${kind} options` }))
    .getAllByRole("menuitemradio")
    .find((item) => /^\d+p$/.test(item.textContent ?? "") && item.getAttribute("aria-checked") === "true")?.textContent;

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

    expect(await screen.findByRole("heading", { name: "You" })).toBeInTheDocument();
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
    expect(screen.getByText("0 of 6 live")).toBeInTheDocument();
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

  // A browser without a picker at all never shows the button (StreamButtons.test); here the
  // picker is there but fails. Removing the picker instead raced the room's next render,
  // which hides the button (it failed on CI's slower machine).
  it("says so when the browser's picker fails", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    lastRoom().localParticipant.getDisplayMedia.mockImplementation(async () => {
      throw new TypeError("getDisplayMedia is not supported here");
    });

    await user.click(within(controls()).getByRole("button", { name: /share your screen/i }));

    expect(await screen.findByText("Couldn't start sharing your screen.")).toBeInTheDocument();
    expect(lastRoom().localParticipant.publishTrack).not.toHaveBeenCalled();
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
    await screen.findByRole("heading", { name: "Bruno" });
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

    expect(await screen.findByText("0 of 6 live")).toBeInTheDocument();
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
    expect(await screen.findByText("0 of 6 live")).toBeInTheDocument();
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
    expect(await screen.findByText("0 of 6 live")).toBeInTheDocument();
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
    await screen.findByRole("heading", { name: "You" });

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
    await screen.findByRole("heading", { name: "You" });

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
    await screen.findByRole("heading", { name: "You" });

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

    await pickInMenu(user, "480p");

    await waitFor(() => expect(myLiveStream(server)?.settings).toEqual({ quality: "480p", mode: "smooth" }));
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("480p"));
    // No new track and no reload for viewers.
    expect(local.publishTrack).toHaveBeenCalledTimes(2);
    expect(local.unpublishTrack).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "You" })).toBeInTheDocument();
    expect(localStorage.getItem("xove.share.quality")).toBe("480p");
  });

  it("can raise the quality again while sharing", async () => {
    localStorage.setItem("xove.share.quality", "480p");
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const video = lastRoom().localParticipant.screens[0].track;

    await pickInMenu(user, "1080p");

    await waitFor(() => expect(myLiveStream(server)?.settings.quality).toBe("1080p"));
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("1080p"));
  });

  it("changes the mode live: marked for detail, keeping sharpness", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const video = lastRoom().localParticipant.screens[0].track;

    await pickInMenu(user, "Sharp (text, code)");

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

    await pickInMenu(user, "480p");

    expect(await screen.findByRole("alert")).toHaveTextContent(/only the person sharing/i);
    await waitFor(() => expect(tickedQuality()).toBe("1080p"));
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("1080p"));
    expect(localStorage.getItem("xove.share.quality")).not.toBe("480p");
  });

  it("stops everything when Stop is pressed after a change", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const local = lastRoom().localParticipant;
    await pickInMenu(user, "720p");
    await waitFor(() => expect(myLiveStream(server)?.settings.quality).toBe("720p"));

    await user.click(within(controls()).getByRole("button", { name: /stop sharing/i }));

    expect(await screen.findByText("0 of 6 live")).toBeInTheDocument();
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
    await screen.findByRole("heading", { name: "Bruno" });
    act(() => {
      lastRoom().publishScreen("user-7", options);
    });
    await screen.findByLabelText("Bruno's shared screen");
    return view;
  };

  it("asks the server for less when a lower quality is picked, and for the best again on Auto", async () => {
    await watchBruno();
    const publication = lastRoom().screenPublication("user-7")!;

    pickWatchQuality("480p");
    expect(publication.setVideoDimensions).toHaveBeenLastCalledWith({ width: 854, height: 480 });

    pickWatchQuality("auto");
    expect(publication.setVideoQuality).toHaveBeenLastCalledWith(2);
  });

  it("only offers what the sharer sends", async () => {
    await watchBruno({ height: 720 });
    expect(offeredQualities()).toEqual(["auto", "720p", "480p"]);
  });

  it("offers no lower quality when the sharer sends only one (Firefox, Safari)", async () => {
    await watchBruno({ height: 1080, layers: 1 });
    expect(offeredQualities()).toEqual(["auto", "1080p"]);
  });

  it("asks for Auto when the remembered quality isn't offered by this sharer", async () => {
    localStorage.setItem("xove.watch.quality", "1080p");
    await watchBruno({ height: 720 });

    expect(watchedQuality()).toBe("auto");
    expect(lastRoom().screenPublication("user-7")!.setVideoQuality).toHaveBeenLastCalledWith(2);
  });

  it("plays the sound at the chosen volume, mutes it, and remembers both", async () => {
    const view = await watchBruno({ withSound: true });
    const user = userEvent.setup();
    const sound = lastRoom().remoteParticipants.get("user-7")!.tracks.get("screen_share_audio")!;
    const audio = () => sound.attached[0] as HTMLAudioElement;

    // The slider shows on the volume button (spec 0101).
    await user.hover(within(stage()).getByRole("button", { name: "Mute" }));
    expect(screen.getByRole("slider", { name: "Volume" }).closest("[inert]")).toBeNull();
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "0.3" } });
    expect(audio().volume).toBeCloseTo(0.3);
    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(audio().muted).toBe(true);
    // Muted: no slider.
    expect(screen.queryByRole("slider", { name: "Volume" })).not.toBeInTheDocument();

    view.unmount();
    await watchBruno({ withSound: true });
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unmute" }));
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveValue("0.3");
  });

  it("asks for the remembered quality as soon as the screen arrives", async () => {
    localStorage.setItem("xove.watch.quality", "720p");
    await watchBruno();

    expect(lastRoom().screenPublication("user-7")!.setVideoDimensions).toHaveBeenLastCalledWith({ width: 1280, height: 720 });
    expect(watchedQuality()).toBe("720p");
  });

  it("gives the sharer's own player no viewer's bar and no settings: those are in the button's menu", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);

    expect(within(stage()).queryByRole("button", { name: "Mute" })).not.toBeInTheDocument();
    expect(within(stage()).queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    expect(within(stage()).queryByLabelText("Send quality")).not.toBeInTheDocument();
    expect(within(stage()).queryByLabelText("Mode")).not.toBeInTheDocument();
    expect(within(stage()).queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("room: viewers follow the sharer's changes", () => {
  afterEach(() => localStorage.clear());

  it("offers nothing above the sharer's quality, and Auto asks for at most that", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();
    await screen.findByRole("heading", { name: "Bruno" });
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    await screen.findByLabelText("Bruno's shared screen");
    const publication = lastRoom().screenPublication("user-7")!;
    const offered = offeredQualities;
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
    await screen.findByRole("heading", { name: "Bruno" });
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    await screen.findByLabelText("Bruno's shared screen");

    act(() => {
      server.streams[0].settings = { quality: "720p", mode: "sharp" };
    });

    await waitFor(() => expect(watchedQuality()).toBe("480p"));
    expect(lastRoom().screenPublication("user-7")!.setVideoDimensions).toHaveBeenLastCalledWith({ width: 854, height: 480 });
  });
});

describe("room: the player's labels and bars", () => {
  it("show while the mouse moves over the player, and fade when it stops or leaves", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();
    await screen.findByRole("heading", { name: "Bruno" });
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

  it("are one centred row: volume, screen, camera, settings while watching; only mine otherwise (spec 0101)", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    const row = () =>
      within(stage())
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label"))
        .filter((name) => name !== "Fullscreen" && name !== "Exit fullscreen" && !name?.startsWith("Watch "));
    expect(row()).toEqual(["Share your screen", "Turn on camera"]);

    act(() => {
      server.streams = [someoneSharing("Bruno Lima", 7)];
    });
    await screen.findByRole("heading", { name: "Bruno" });
    act(() => {
      lastRoom().publishScreen("user-7", { withSound: true });
    });
    await screen.findByLabelText("Bruno's shared screen");

    expect(row()).toEqual(["Mute", "Share your screen", "Turn on camera", "Settings"]);
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

    // Past the time the bars would fade: still shown while the menu is open.
    fireEvent.pointerMove(frame);
    (document.activeElement as HTMLElement).blur();
    await new Promise((resolve) => setTimeout(resolve, 2700));
    expect(frame).toHaveAttribute("data-chrome", "shown");
  });
});

describe("room: fullscreen (spec 0098)", () => {
  it("enters fullscreen, and leaves it with the same button", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    const frame = (await screen.findByLabelText("Bruno's shared screen")).closest("[data-chrome]") as HTMLElement;
    // jsdom has no fullscreen: play the browser's part.
    let current: Element | null = null;
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => current });
    const enter = vi.fn(async () => {
      current = frame;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    const exit = vi.fn(async () => {
      current = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    frame.requestFullscreen = enter;
    document.exitFullscreen = exit;
    const user = userEvent.setup();

    try {
      await user.click(within(stage()).getByRole("button", { name: "Fullscreen" }));
      expect(enter).toHaveBeenCalled();

      await user.click(await within(stage()).findByRole("button", { name: "Exit fullscreen" }));
      expect(exit).toHaveBeenCalled();
      expect(enter).toHaveBeenCalledTimes(1);
      expect(await within(stage()).findByRole("button", { name: "Fullscreen" })).toBeInTheDocument();
    } finally {
      delete (document as { fullscreenElement?: unknown }).fullscreenElement;
    }
  });
});

describe("room: the player's fullscreen while the whole page is fullscreen (spec 0160)", () => {
  it("puts the player fullscreen instead of leaving the page's", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    const frame = (await screen.findByLabelText("Bruno's shared screen")).closest("[data-chrome]") as HTMLElement;
    let current: Element | null = document.documentElement;
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => current });
    const enter = vi.fn(async () => {
      current = frame;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    const exit = vi.fn(async () => {});
    frame.requestFullscreen = enter;
    document.exitFullscreen = exit;
    try {
      await userEvent.setup().click(within(stage()).getByRole("button", { name: "Fullscreen" }));
      expect(enter).toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();
    } finally {
      delete (document as { fullscreenElement?: unknown }).fullscreenElement;
    }
  });
});

describe("room: the setup window's texts (spec 0101)", () => {
  it("points to the button's menu, and gives today's sound hint", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    lastRoom().localParticipant.nextPickerAudio = false;

    const setup = await pickScreen(user);

    expect(within(setup).getByText("You can change both while sharing, from the button's menu.")).toBeInTheDocument();
    expect(
      within(setup).getByText(
        "No sound with this screen. To share sound, pick a tab, or a window with “Share this app's audio too”. Firefox and Safari can't share sound.",
      ),
    ).toBeInTheDocument();
  });
});

describe("room: starting from fullscreen (spec 0101)", () => {
  /** Plays the browser putting the stage's player in fullscreen (jsdom has none). */
  function enterFullscreen() {
    const frame = stage().querySelector("[class*='frame']") as HTMLElement;
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => frame });
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    return frame;
  }
  afterEach(() => {
    delete (document as { fullscreenElement?: unknown }).fullscreenElement;
  });

  it("shows the setup window over the fullscreen player, and keeps it fullscreen", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    const frame = enterFullscreen();

    await user.click(within(controls()).getByRole("button", { name: /share your screen/i }));

    const setup = await setupWindow();
    expect(frame).toContainElement(setup);
    expect(document.fullscreenElement).toBe(frame);
    await user.click(within(setup).getByRole("button", { name: /start sharing/i }));
    expect(await screen.findByRole("heading", { name: "You" })).toBeInTheDocument();
  });

  it("keeps the setup window's choices, and gives the focus back, when fullscreen ends while it's open", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    enterFullscreen();
    const share = within(controls()).getByRole("button", { name: /share your screen/i });
    await user.click(share);
    const setup = await setupWindow();
    await user.selectOptions(within(setup).getByLabelText("Send quality"), "720p");

    // The browser leaves fullscreen (Esc does, in Chrome).
    delete (document as { fullscreenElement?: unknown }).fullscreenElement;
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    const after = await setupWindow();
    expect(within(after).getByLabelText("Send quality")).toHaveValue("720p");
    await user.click(within(after).getByRole("button", { name: /cancel/i }));
    expect(share).toHaveFocus();
  });

  it("shows a failed start over the fullscreen player too", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    const frame = enterFullscreen();
    lastRoom().localParticipant.nextPicker = "no-video";

    await user.click(within(controls()).getByRole("button", { name: /share your screen/i }));

    expect(frame).toContainElement(await screen.findByRole("alert"));
  });
});

describe("room: change window and pick a camera (spec 0098)", () => {
  afterEach(() => localStorage.clear());

  it("swaps what my screen shares from its menu, on the same stream", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    const local = lastRoom().localParticipant;
    local.nextPickerAudio = false;
    await startSharing(user);
    const started = myLiveStream(server);
    const video = local.screens[0].track;
    expect(within(stage()).getByRole("button", { name: "Stop sharing" })).toHaveAccessibleDescription(
      expect.stringMatching(/no sound is being shared/i),
    );

    local.nextPickerAudio = true;
    await user.click((await openMenu(user)).getByRole("menuitem", { name: "Change window" }));

    await waitFor(() => expect(video.replaceTrack).toHaveBeenCalled());
    expect(local.getDisplayMedia).toHaveBeenCalledTimes(2);
    // No setup window, no new stream: the API's stream is the same one.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(myLiveStream(server)).toEqual(started);
    expect(server.calls.filter((c) => c.path === "/api/streams" && c.method === "POST")).toHaveLength(1);
    expect(local.screens).toHaveLength(1);
    // The new pick has sound: it's sent, and the badge goes.
    await waitFor(() =>
      expect(within(stage()).getByRole("button", { name: "Stop sharing" })).toHaveAccessibleDescription("Stop sharing"),
    );
    expect(local.screenAudio?.track.source).toBe("screen_share_audio");
  });

  it("keeps my share when the picker is closed", async () => {
    installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    const local = lastRoom().localParticipant;
    local.nextPicker = "cancel";

    await user.click((await openMenu(user)).getByRole("menuitem", { name: "Change window" }));

    expect(local.screens[0].track.replaceTrack).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "You" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("switches my camera from its menu without stopping it", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await user.click(within(controls()).getByRole("button", { name: /turn on camera/i }));
    const setup = await screen.findByRole("dialog", { name: /turn on your camera/i });
    await user.click(within(setup).getByRole("button", { name: /start camera/i }));
    await waitFor(() => expect(myLiveStream(server, "camera")).toBeDefined());
    const camera = lastRoom().localParticipant.lastCamera!;

    const menu = await openMenu(user, "Camera");
    await waitFor(() => expect(menu.getByRole("menuitemradio", { name: "Logitech C920" })).toHaveAttribute("aria-checked", "true"));
    await user.click(menu.getByRole("menuitemradio", { name: "Integrated Webcam" }));

    await waitFor(() => expect(camera.restartTrack).toHaveBeenCalled());
    expect(lastRoom().localParticipant.camera?.track).toBe(camera);
    expect(myLiveStream(server, "camera")).toBeDefined();
    await waitFor(() =>
      expect(menu.getByRole("menuitemradio", { name: "Integrated Webcam" })).toHaveAttribute("aria-checked", "true"),
    );
  });
});

describe("room: the player on touch screens and keyboards", () => {
  const watchBruno = async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    const view = renderRoom();
    await connected();
    await screen.findByRole("heading", { name: "Bruno" });
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
      within(stage()).getByRole("button", { name: "Fullscreen" }).focus();
    });
    expect(frame).toHaveAttribute("data-chrome", "shown");

    await new Promise((resolve) => setTimeout(resolve, 2700));
    expect(frame).toHaveAttribute("data-chrome", "shown");
  });

  it("doesn't hide anything over an empty stage", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await screen.findByText("0 of 6 live");

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
    const menu = await openMenu(user);

    fireEvent.click(menu.getByRole("menuitemradio", { name: "720p" }));
    fireEvent.click(menu.getByRole("menuitemradio", { name: "480p" }));

    await waitFor(() => expect(myLiveStream(server)?.settings.quality).toBe("480p"));
    const sent = server.calls.filter((c) => c.path === "/api/streams/screen/settings").map((c) => (c.body as { quality: string }).quality);
    expect(sent).toEqual(["720p", "480p"]);
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("480p"));
    expect(tickedQuality()).toBe("480p");
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
    expect(screen.getByRole("button", { name: /: account, connected$/ })).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Bruno" })).toBeInTheDocument();
    expect(screen.getByText("Camera")).toBeInTheDocument();
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

    expect(screen.getByRole("heading", { name: "Ana" })).toBeInTheDocument();
    const items = within(thumbnails()).getAllByRole("button", { name: /watch/i });
    expect(items.map((b) => b.getAttribute("aria-label"))).toEqual(["Watch Bruno's screen", "Watch Caio's camera"]);
    expect(within(thumbnails()).getByLabelText("Bruno's shared screen")).toBeInTheDocument();
    expect(within(thumbnails()).getByLabelText("Caio's camera")).toBeInTheDocument();
  });

  it("makes a thumbnail big on click, and the big one goes back to the thumbnails", async () => {
    await threeSharing();
    const user = userEvent.setup();

    await user.click(within(thumbnails()).getByRole("button", { name: /^Watch Bruno/ }));

    expect(screen.getByRole("heading", { name: "Bruno" })).toBeInTheDocument();
    expect(within(stage()).getByLabelText("Bruno's shared screen")).toBeInTheDocument();
    const names = within(thumbnails()).getAllByRole("button", { name: /watch/i }).map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["Watch Ana's screen", "Watch Caio's camera"]);
  });

  it("gives the big place to the longest sharing when the big one stops", async () => {
    const server = await threeSharing();
    const user = userEvent.setup();
    await user.click(within(thumbnails()).getByRole("button", { name: /^Watch Caio/ }));
    expect(screen.getByRole("heading", { name: "Caio" })).toBeInTheDocument();

    act(() => {
      server.streams = server.streams.filter((st) => st.userId !== 9);
    });

    expect(await screen.findByRole("heading", { name: "Ana" })).toBeInTheDocument();
    expect(within(thumbnails()).getAllByRole("button", { name: /watch/i })).toHaveLength(1);
  });

  it("shows no previews with one sharer, just the free places", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Ana Souza", 3)];
    renderRoom();
    await screen.findByRole("heading", { name: "Ana" });

    expect(within(screen.getByRole("list", { name: /other streams/i })).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 6 live")).toBeInTheDocument();
    expect(screen.getByText("5 free · share yours")).toBeInTheDocument();
  });

  it("puts a stream back to Auto when it leaves the big player", async () => {
    localStorage.setItem("xove.watch.quality", "480p");
    await threeSharing();
    const ana = lastRoom().screenPublication("user-3")!;
    expect(ana.setVideoDimensions).toHaveBeenLastCalledWith({ width: 854, height: 480 });

    await userEvent.setup().click(within(thumbnails()).getByRole("button", { name: /^Watch Bruno/ }));

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
    expect(offeredQualities()).toEqual(["auto", "720p", "480p"]);
    fireEvent.keyDown(screen.getByRole("menu", { name: "Settings" }), { key: "Escape" });

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

describe("room: theater mode (spec 0104)", () => {
  it("has no sidebar or old header: a logo, the activity pill, people and account up top, and the footer", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();

    const header = screen.getByRole("banner");
    // The drawn mark (spec 0111), not the old typed "xovê.".
    expect(within(header).getByRole("img", { name: "Xovê" })).toBeInTheDocument();
    expect(within(header).queryByText(/xovê/)).not.toBeInTheDocument();
    expect(within(header).getByRole("button", { name: /^Activity/ })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "1 person here" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: /: account, connected$/ })).toBeInTheDocument();
    expect(screen.queryByText("xove.app")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /here now/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("xovê · Made by Hbrauveres");
    expect(footer).toHaveTextContent(/Buy me a coffee.*GitHub.*LinkedIn/);
    expect(within(footer).queryByRole("link")).not.toBeInTheDocument();
  });

  it("with nobody live: the empty stage, no light, and the info row says so", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();

    expect(screen.getByRole("heading", { name: "The stage is yours." })).toBeInTheDocument();
    expect(screen.getByText("0 of 6 live")).toBeInTheDocument();
    expect(screen.getByText("6 free · share yours")).toBeInTheDocument();
    expect(screen.getByText(/share your screen or turn on your camera/i)).toBeInTheDocument();
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("puts a stream from the activity list on the stage, a camera event with the camera big", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    act(() => {
      server.streams = [someoneSharing("Bruno Lima", 7, "screen"), someoneSharing("Bruno Lima", 7, "camera")];
    });
    await screen.findByRole("heading", { name: "Bruno" });
    act(() => {
      lastRoom().join("user-7", "Bruno Lima");
      lastRoom().publishScreen("user-7");
      lastRoom().publishCamera("user-7");
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^Activity/ }));
    await user.click(screen.getByRole("button", { name: "Bruno turned on their camera: watch" }));

    // Camera big, screen in the facecam.
    await waitFor(() => expect(stage().querySelector("[data-facecam]")).not.toBeNull());
    expect(within(stage().querySelector("[data-facecam]") as HTMLElement).getByLabelText("Bruno's shared screen")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Activity" })).not.toBeInTheDocument());
  });

  it("shows who watches what in the people panel", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    server.watching = [{ userId: 3, sharerId: 7, kind: "screen", mine: false }];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().join("user-3", "Ana Souza");
      lastRoom().join("user-7", "Bruno Lima");
      lastRoom().publishScreen("user-7");
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /people here/ }));

    const panel = screen.getByRole("dialog", { name: "Here now" });
    await waitFor(() => expect(within(panel).getByText("Watching Bruno", { selector: "small" })).toBeInTheDocument());
  });
});

describe("room: what's on my stage is reported (spec 0104)", () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
  async function anaAndBruno() {
    const server = installFakeApi({ me: member });
    server.streams = [
      someoneSharing("Ana Souza", 3, "screen", undefined, minutesAgo(10)),
      someoneSharing("Bruno Lima", 7, "screen", undefined, minutesAgo(5)),
    ];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-3");
      lastRoom().publishScreen("user-7");
    });
    await screen.findByLabelText("Ana's shared screen");
    return server;
  }
  const watchCalls = (server: { calls: { method: string; path: string }[] }) =>
    server.calls.filter((c) => c.method === "PUT" && c.path === "/api/streams/watching");

  it("reports whose stream is on my stage, once it settles", async () => {
    const server = await anaAndBruno();

    await waitFor(() => expect(server.myWatch).toEqual({ sharerId: 3, kind: "screen" }), { timeout: 3000 });
    expect(watchCalls(server)).toHaveLength(1);
  });

  it("sends one report for quick changes, the last one", async () => {
    const server = await anaAndBruno();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^Watch Bruno/ }));
    await user.click(screen.getByRole("button", { name: /^Watch Ana/ }));
    await user.click(screen.getByRole("button", { name: /^Watch Bruno/ }));

    await waitFor(() => expect(server.myWatch).toEqual({ sharerId: 7, kind: "screen" }), { timeout: 3000 });
    expect(watchCalls(server)).toHaveLength(1);
  });

  it("tries a failed report again a moment later", async () => {
    const server = installFakeApi({ me: member });
    server.failures.set("PUT /api/streams/watching", { status: 503, body: { status: 503, detail: "Deploying" } });
    server.streams = [someoneSharing("Ana Souza", 3)];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-3");
    });
    await waitFor(() => expect(watchCalls(server)).toHaveLength(1), { timeout: 3000 });

    server.failures.delete("PUT /api/streams/watching");

    await waitFor(() => expect(server.myWatch).toEqual({ sharerId: 3, kind: "screen" }), { timeout: 5000 });
  }, 12000);

  it("reports nothing while the stream is still loading", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Ana Souza", 3)];
    renderRoom();
    await connected();
    await screen.findByRole("heading", { name: "Ana" });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(watchCalls(server)).toHaveLength(0);

    act(() => {
      lastRoom().publishScreen("user-3");
    });
    await waitFor(() => expect(server.myWatch).toEqual({ sharerId: 3, kind: "screen" }), { timeout: 3000 });
  }, 10000);

  it("reports it again when the API forgot it (a restart)", async () => {
    const server = await anaAndBruno();
    await waitFor(() => expect(server.myWatch).not.toBeNull(), { timeout: 3000 });
    // A poll or two, so the room sees the API has it.
    await new Promise((resolve) => setTimeout(resolve, FAST_POLL * 3));

    act(() => {
      server.myWatch = null;
    });

    // The next poll (every 2 s) shows it's gone; the report follows after 1 s.
    await waitFor(() => expect(watchCalls(server)).toHaveLength(2), { timeout: 5000 });
    expect(server.myWatch).toEqual({ sharerId: 3, kind: "screen" });
  }, 12000);
});

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

  it("locks a screen without sound on mute, for the big player and a thumbnail, until it gets sound (spec 0098)", async () => {
    localStorage.setItem("xove.watch.volume", "0.6");
    const server = installFakeApi({ me: member });
    server.streams = [
      someoneSharing("Ana Souza", 3, "screen", undefined, minutesAgo(10)),
      someoneSharing("Bruno Lima", 7, "screen", undefined, minutesAgo(5)),
    ];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-3");
      lastRoom().publishScreen("user-7");
    });
    await screen.findByLabelText("Ana's shared screen");

    expect(within(stage()).getByRole("button", { name: "No sound in this stream" })).toHaveAttribute("aria-disabled", "true");
    expect(within(stage()).queryByRole("slider", { name: "Volume" })).not.toBeInTheDocument();
    // A preview without sound has no speaker at all (spec 0104).
    expect(within(thumbnails()).queryByRole("button", { name: /mute bruno/i })).not.toBeInTheDocument();

    // Ana changes to a window with sound: her volume works again, at mine.
    act(() => {
      lastRoom().publishSound("user-3");
    });
    const mute = await within(stage()).findByRole("button", { name: "Mute" });
    expect(mute).not.toHaveAttribute("aria-disabled");
    await userEvent.setup().hover(mute);
    const slider = within(stage()).getByRole("slider", { name: "Volume" });
    expect(slider.closest("[inert]")).toBeNull();
    expect(slider).toHaveValue("0.6");
    expect(within(thumbnails()).queryByRole("button", { name: /mute bruno/i })).not.toBeInTheDocument();
    localStorage.clear();
  });

  it("doesn't lock a camera's volume: a camera never has sound to share", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [
      someoneSharing("Ana Souza", 3, "camera", undefined, minutesAgo(10)),
      someoneSharing("Bruno Lima", 7, "camera", undefined, minutesAgo(5)),
    ];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishCamera("user-3");
      lastRoom().publishCamera("user-7");
    });
    await screen.findByLabelText("Ana's camera");

    expect(within(stage()).queryByRole("button", { name: "No sound in this stream" })).not.toBeInTheDocument();
    expect(within(thumbnails()).queryByRole("button", { name: /mute/i })).not.toBeInTheDocument();
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

    await user.click(within(thumbnails()).getByRole("button", { name: /^Watch Bruno/ }));

    await waitFor(() => expect(sound("user-7").attached).toHaveLength(1));
    expect(room.soundPublication("user-3")!.setSubscribed).toHaveBeenLastCalledWith(false);
  });
});

describe("room: my settings for each of my streams", () => {
  afterEach(() => localStorage.clear());

  it("changes the camera's quality live from its menu, apart from the screen's", async () => {
    const server = installFakeApi({ me: member });
    const user = await readyRoom();
    await startSharing(user);
    await user.click(within(controls()).getByRole("button", { name: /turn on camera/i }));
    const setup = await screen.findByRole("dialog", { name: /turn on your camera/i });
    await user.click(within(setup).getByRole("button", { name: /start camera/i }));
    await waitFor(() => expect(myLiveStream(server, "camera")).toBeDefined());
    const camera = lastRoom().localParticipant.lastCamera!;

    const menu = await openMenu(user, "Camera");
    expect(menu.queryByRole("menuitemradio", { name: "1080p" })).not.toBeInTheDocument();
    await pickInMenu(user, "480p", "Camera");

    await waitFor(() => expect(myLiveStream(server, "camera")?.settings.quality).toBe("480p"));
    expect(camera.setPublishingQuality).toHaveBeenLastCalledWith(capOf("480p"));
    expect(myLiveStream(server, "screen")?.settings.quality).toBe("1080p");
    await openMenu(user, "Screen");
    expect(tickedQuality()).toBe("1080p");
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

    // Both changes go out before either answer comes back.
    fireEvent.click((await openMenu(user, "Screen")).getByRole("menuitemradio", { name: "480p" }));
    fireEvent.click((await openMenu(user, "Camera")).getByRole("menuitemradio", { name: "480p" }));

    await waitFor(() => expect(myLiveStream(server, "camera")?.settings.quality).toBe("480p"));
    await openMenu(user, "Screen");
    await waitFor(() => expect(tickedQuality()).toBe("1080p"));
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
    await screen.findByRole("heading", { name: "Ana" });
    await userEvent.setup().click(within(thumbnails()).getByRole("button", { name: /^Watch Bruno/ }));
    expect(screen.getByRole("heading", { name: "Bruno" })).toBeInTheDocument();

    act(() => {
      server.streams = server.streams.filter((st) => st.userId !== 7);
    });
    expect(await screen.findByRole("heading", { name: "Ana" })).toBeInTheDocument();
    act(() => {
      server.streams = [...server.streams, someoneSharing("Bruno Lima", 7)];
    });

    await within(stage()).findByRole("button", { name: /^Watch Bruno/ });
    expect(screen.getByRole("heading", { name: "Ana" })).toBeInTheDocument();
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

    await user.click(within(thumbnails()).getByRole("button", { name: /^Watch Bruno/ }));
    expect(within(facecam()).getByLabelText("Bruno's camera")).toBeInTheDocument();
  });
});

describe("room: the stage hugs the picture (spec 0107)", () => {
  const shapeOfStage = () =>
    Number(screen.getByRole("region", { name: "Shared screen" }).querySelector("[data-shape]")?.getAttribute("data-shape"));

  /** The browser learns the picture's size, or a new one when the sharer resizes the window. */
  const pictureSize = (video: HTMLElement, width: number, height: number) =>
    act(() => {
      Object.defineProperty(video, "videoWidth", { configurable: true, get: () => width });
      Object.defineProperty(video, "videoHeight", { configurable: true, get: () => height });
      video.dispatchEvent(new Event("resize"));
    });

  it("is 16:9 while empty and while a stream loads, then takes the picture's shape", async () => {
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    await screen.findByText("0 of 6 live");
    expect(shapeOfStage()).toBeCloseTo(16 / 9);

    server.streams = [someoneSharing("Bruno Lima", 7)];
    await screen.findByText(/loading bruno's screen/i);
    expect(shapeOfStage()).toBeCloseTo(16 / 9);

    act(() => {
      lastRoom().publishScreen("user-7");
    });
    const video = await screen.findByLabelText("Bruno's shared screen");
    pictureSize(video, 1840, 1000);
    expect(shapeOfStage()).toBeCloseTo(1.84);

    // A portrait monitor: taller than 16:9.
    pictureSize(video, 1080, 1920);
    expect(shapeOfStage()).toBeCloseTo(0.5625);
  });
});

describe("room: under the stage (spec 0107)", () => {
  it("shows who's watching the stage: me included, never the sharer", async () => {
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    // Ana watches Bruno; Bruno's own stage shows himself, which doesn't count.
    server.watching = [
      { userId: 3, sharerId: 7, kind: "screen", mine: false },
      { userId: 7, sharerId: 7, kind: "screen", mine: false },
    ];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().join("user-3", "Ana Souza");
      lastRoom().join("user-7", "Bruno Lima");
      lastRoom().publishScreen("user-7");
    });

    expect(await screen.findByText("1 watching")).toBeInTheDocument();
    // Once my stage is reported (after a second of stillness), I count too.
    expect(await screen.findByText("2 watching", undefined, { timeout: 4000 })).toBeInTheDocument();
  });

  it("invites someone to go live on an empty stage, naming who's here", async () => {
    installFakeApi({ me: member });
    renderRoom();
    await connected();
    expect(await screen.findByText("Nobody else is here yet.")).toBeInTheDocument();

    act(() => {
      lastRoom().join("user-3", "Ana Souza");
      lastRoom().join("user-7", "Bruno Lima");
    });

    expect(screen.getByRole("heading", { name: "The stage is yours." })).toBeInTheDocument();
    expect(await screen.findByText("Ana and Bruno are here, waiting for someone to go live.")).toBeInTheDocument();
  });
});

/** The window as a phone held upright (spec 0158), and turning it. */
function phoneWindow(upright = true) {
  const listeners = new Set<() => void>();
  let phone = upright;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === NARROW_UPRIGHT_QUERY && phone;
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    turn(upright: boolean) {
      phone = upright;
      act(() => listeners.forEach((l) => l()));
    },
  };
}

describe("room: on a phone held upright (spec 0158)", () => {
  const desktopMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = desktopMatchMedia;
  });

  it("has the wordmark, then people, the bell and my account at the far right, and no footer", async () => {
    phoneWindow();
    installFakeApi({ me: member });
    const { container } = renderRoom();
    await connected();

    const header = container.querySelector("header")!;
    const buttons = within(header).getAllByRole("button");
    const names = buttons.map((b) => b.getAttribute("aria-label") ?? "");
    const people = names.findIndex((n) => /people here|person here/.test(n));
    const bell = names.indexOf("Activity");
    const account = names.findIndex((n) => /: account,/.test(n));
    expect(people).toBeGreaterThanOrEqual(0);
    expect(bell).toBeGreaterThan(people);
    expect(account).toBeGreaterThan(bell);
    expect(within(header).getByRole("img", { name: "Xovê" })).toBeInTheDocument();
    // The desktop's activity pill and footer aren't there; the footer's items are in my menu.
    expect(within(header).queryByRole("button", { name: /^Activity:/ })).toBeNull();
    expect(container.querySelector("footer")).toBeNull();
  });

  it("puts the footer's items at the end of my account menu", async () => {
    phoneWindow();
    installFakeApi({ me: member });
    renderRoom();
    const user = userEvent.setup();
    await user.click(await connected());
    expect(screen.getByText(/Made by Hbrauveres/)).toBeInTheDocument();
  });

  it("with nobody live, says so and lists who's here as cards", async () => {
    phoneWindow();
    const server = installFakeApi({ me: member });
    server.here = [{ userId: MY_USER_ID, since: new Date(Date.now() - 5 * 60_000).toISOString(), mine: true }];
    renderRoom();
    await connected();

    expect(screen.getByRole("heading", { name: "Nobody live" })).toBeInTheDocument();
    expect(screen.getByText("0 of 6 · 6 free")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Here/ })).toBeInTheDocument();
    expect(await screen.findByText("here 5 min")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Live now/ })).toBeNull();
  });

  it("with someone live, shows them under the stage and the others in the feed, which stays silent", async () => {
    phoneWindow();
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7), someoneSharing("Ana Souza", 3)];
    renderRoom();
    await connected();
    const room = lastRoom();
    act(() => {
      room.publishScreen("user-7", { withSound: true });
      room.publishScreen("user-3", { withSound: true });
    });

    expect(await screen.findByRole("heading", { level: 2, name: "Bruno · Screen" })).toBeInTheDocument();
    const feed = screen.getByRole("region", { name: /Live now/ });
    expect(within(feed).getByRole("heading", { level: 3, name: "Ana · Screen" })).toBeInTheDocument();
    expect(within(feed).queryByRole("heading", { name: /Bruno/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^Here/ })).toBeNull();
    // Only the stage's sound is downloaded.
    await waitFor(() => expect(room.soundPublication("user-3")!.isSubscribed).toBe(false));
    expect(room.soundPublication("user-7")!.isSubscribed).toBe(true);

    // A tap puts Ana on the stage.
    await userEvent.setup().click(within(feed).getByRole("button", { name: "Watch Ana's screen" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Ana · Screen" })).toBeInTheDocument();
  });

  it("stops downloading a preview's sound unmuted on desktop when the phone turns upright", async () => {
    const win = phoneWindow(false);
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7), someoneSharing("Ana Souza", 3)];
    renderRoom();
    await connected();
    const room = lastRoom();
    act(() => {
      room.publishScreen("user-7", { withSound: true });
      room.publishScreen("user-3", { withSound: true });
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Unmute Ana" }));
    await waitFor(() => expect(room.soundPublication("user-3")!.isSubscribed).toBe(true));

    win.turn(true);
    await waitFor(() => expect(room.soundPublication("user-3")!.isSubscribed).toBe(false));
    expect(room.soundPublication("user-7")!.isSubscribed).toBe(true);
  });

  it("has no LIVE badge over the stage: LIVE is in the line under it", async () => {
    phoneWindow();
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    const video = await screen.findByLabelText("Bruno's shared screen");
    const frame = video.closest("[data-chrome]") as HTMLElement;
    expect(within(frame).queryByText("LIVE")).toBeNull();
    const info = screen.getByRole("heading", { level: 2, name: "Bruno · Screen" }).closest("[data-compact]") as HTMLElement;
    expect(within(info).getByText("LIVE")).toBeInTheDocument();
  });

  it("keeps the same video playing when the phone turns", async () => {
    const win = phoneWindow();
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Bruno Lima", 7)];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-7");
    });
    const video = await screen.findByLabelText("Bruno's shared screen");

    win.turn(false);
    expect(await screen.findByRole("heading", { name: "Bruno" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bruno's shared screen")).toBe(video);

    win.turn(true);
    expect(await screen.findByRole("heading", { name: "Bruno · Screen" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bruno's shared screen")).toBe(video);
  });
});

/** A canvas that draws nothing, so the ambilight runs in jsdom (which has no canvas). */
function fakeCanvas() {
  const ctx = {
    fillRect: () => {},
    drawImage: () => {},
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {},
    set fillStyle(_: string) {},
    set filter(_: string) {},
    set globalAlpha(_: number) {},
    set globalCompositeOperation(_: string) {},
  };
  return vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctx) as never);
}

describe("room: the empty stage glows (spec 0158)", () => {
  const desktopMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = desktopMatchMedia;
    vi.restoreAllMocks();
  });

  it.each([
    ["on desktop", false],
    ["on a phone", true],
  ])("lights the colour bars with the ambilight %s", async (_, upright) => {
    fakeCanvas();
    if (upright) phoneWindow();
    installFakeApi({ me: member });
    const { container } = renderRoom();
    await connected();
    const light = await waitFor(() => {
      const c = container.querySelector("canvas[data-on]") as HTMLCanvasElement | null;
      expect(c).not.toBeNull();
      return c!;
    });
    expect(Number(light.style.opacity)).toBeGreaterThan(0);
  });
});

describe("room: swiping the phone's stage (spec 0159)", () => {
  const desktopMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = desktopMatchMedia;
    vi.restoreAllMocks();
  });

  /** Three people sharing their screens, in this order (the longest first), on a phone. */
  async function threeLive(withSound = false) {
    phoneWindow();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 400, height: 225 } as DOMRect);
    const server = installFakeApi({ me: member });
    const ago = (s: number) => new Date(Date.now() - s * 1000);
    server.streams = [
      someoneSharing("Marina", 2, "screen", undefined, ago(300)),
      someoneSharing("Rafa", 3, "screen", undefined, ago(200)),
      someoneSharing("Duda", 4, "screen", undefined, ago(100)),
    ];
    renderRoom();
    await connected();
    const room = lastRoom();
    act(() => {
      for (const id of ["user-2", "user-3", "user-4"]) room.publishScreen(id, { withSound });
    });
    await screen.findByRole("heading", { level: 2, name: "Marina · Screen" });
    return { server, room };
  }

  const onStage = (name: string) => screen.findByRole("heading", { level: 2, name: `${name} · Screen` });
  /** A drag on the stage's picture, quick, of `dx` pixels. */
  function swipe(dx: number, on?: Element) {
    const target = on ?? screen.getByRole("region", { name: /shared screen/i }).querySelector("video")!;
    fireEvent.pointerDown(target, { pointerId: 1, clientX: 200, clientY: 100, button: 0 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 200 + dx, clientY: 102 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 200 + dx, clientY: 102 });
  }

  it("goes to the next person on a swipe left, the previous on a swipe right, wrapping around", async () => {
    await threeLive();
    // Each swipe slides the next one in; the next swipe waits until it's in place.
    const slidIn = () => new Promise((r) => setTimeout(r, 250));
    swipe(-200);
    await onStage("Rafa");
    await slidIn();
    swipe(-200);
    await onStage("Duda");
    await slidIn();
    swipe(-200);
    await onStage("Marina");
    await slidIn();
    swipe(200);
    await onStage("Duda");
  });

  it("changes nothing on a short drag", async () => {
    await threeLive();
    swipe(-20);
    await new Promise((r) => setTimeout(r, 450));
    expect(screen.getByRole("heading", { level: 2, name: "Marina · Screen" })).toBeInTheDocument();
  });

  it("leaves the stage alone when the drag starts on a round button or the fullscreen button", async () => {
    await threeLive();
    const stageRegion = screen.getByRole("region", { name: /shared screen/i });
    swipe(-200, stageRegion.querySelector("[data-no-swipe] button[aria-label*=camera i]")!);
    swipe(-200, within(stageRegion).getByRole("button", { name: "Fullscreen" }));
    await new Promise((r) => setTimeout(r, 450));
    expect(screen.getByRole("heading", { level: 2, name: "Marina · Screen" })).toBeInTheDocument();
  });

  it("leaves the stage alone when the drag starts on the facecam", async () => {
    phoneWindow();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 400, height: 225 } as DOMRect);
    const server = installFakeApi({ me: member });
    server.streams = [
      someoneSharing("Bruno", 7, "screen", undefined, new Date(Date.now() - 300_000)),
      someoneSharing("Bruno", 7, "camera", undefined, new Date(Date.now() - 300_000)),
      someoneSharing("Ana", 3, "screen"),
    ];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-7");
      lastRoom().publishCamera("user-7");
      lastRoom().publishScreen("user-3");
    });
    const facecam = await waitFor(() => {
      const f = document.querySelector("[data-facecam]");
      expect(f).not.toBeNull();
      return f!;
    });
    swipe(-200, facecam);
    await new Promise((r) => setTimeout(r, 450));
    expect(screen.getByRole("heading", { level: 2, name: "Bruno · Screen with camera" })).toBeInTheDocument();
  });

  it("moves the sound, the feed and what I watch with the stage", async () => {
    const { server, room } = await threeLive(true);
    swipe(-200);
    await onStage("Rafa");
    await waitFor(() => expect(room.soundPublication("user-3")!.isSubscribed).toBe(true));
    expect(room.soundPublication("user-2")!.isSubscribed).toBe(false);
    const feed = screen.getByRole("region", { name: /Live now/ });
    expect(within(feed).getByRole("heading", { name: "Marina · Screen" })).toBeInTheDocument();
    await waitFor(
      () =>
        expect(server.calls.filter((c) => c.method === "PUT" && c.path === "/api/streams/watching").at(-1)?.body).toEqual({
          sharerId: 3,
          kind: "screen",
        }),
      { timeout: 3000 },
    );
  });

  it("ignores a mostly up-and-down drag", async () => {
    await threeLive();
    const video = screen.getByRole("region", { name: /shared screen/i }).querySelector("video")!;
    fireEvent.pointerDown(video, { pointerId: 1, clientX: 200, clientY: 100, button: 0 });
    fireEvent.pointerMove(video, { pointerId: 1, clientX: 140, clientY: 220 });
    fireEvent.pointerUp(video, { pointerId: 1, clientX: 140, clientY: 220 });
    await new Promise((r) => setTimeout(r, 450));
    expect(screen.getByRole("heading", { level: 2, name: "Marina · Screen" })).toBeInTheDocument();
  });

  it("doesn't swipe on the desktop layout", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 400, height: 225 } as DOMRect);
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Marina", 2, "screen", undefined, new Date(Date.now() - 300_000)), someoneSharing("Rafa", 3)];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-2");
      lastRoom().publishScreen("user-3");
    });
    await screen.findByRole("heading", { name: "Marina" });
    swipe(-200);
    await new Promise((r) => setTimeout(r, 450));
    expect(screen.getByRole("heading", { name: "Marina" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Watch Rafa" })).toBeNull();
  });

  it("has a dot per person live, and a tap on one puts them on the stage", async () => {
    await threeLive();
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Watch Marina" })).toHaveAttribute("aria-current", "true");
    await user.click(screen.getByRole("button", { name: "Watch Duda" }));
    await onStage("Duda");
    expect(screen.getByRole("button", { name: "Watch Duda" })).toHaveAttribute("aria-current", "true");
  });
});

/** A phone (touch, small), sideways at first; `turn()` holds it upright or sideways again. */
function phoneSideways() {
  const listeners = new Set<() => void>();
  let portrait = false;
  const answer = (q: string) =>
    q === TOUCH_QUERY || q === SMALL_QUERY ? true : q === PORTRAIT_QUERY || q === NARROW_UPRIGHT_QUERY ? portrait : false;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return answer(query);
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    turn() {
      portrait = !portrait;
      act(() => listeners.forEach((l) => l()));
    },
  };
}

describe("room: on a phone sideways (spec 0160)", () => {
  const desktopMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = desktopMatchMedia;
    vi.restoreAllMocks();
  });

  async function sidewaysWith(names: string[], withSound = false) {
    const phone = phoneSideways();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 732, height: 412 } as DOMRect);
    const server = installFakeApi({ me: member });
    server.streams = names.map((n, i) => someoneSharing(n, i + 2, "screen", undefined, new Date(Date.now() - (300 - i * 50) * 1000)));
    const view = renderRoom();
    await connected();
    const room = lastRoom();
    act(() => {
      names.forEach((_, i) => room.publishScreen(`user-${i + 2}`, { withSound }));
    });
    return { phone, server, room, view };
  }
  const stageLayer = () => screen.getByRole("region", { name: /shared screen/i });
  /** A quick drag on the picture. */
  function drag(dx: number, dy: number, on?: Element) {
    const target = on ?? stageLayer().querySelector("video")!;
    fireEvent.pointerDown(target, { pointerId: 1, clientX: 400, clientY: 250, button: 0 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 400 + dx, clientY: 250 + dy });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 400 + dx, clientY: 250 + dy });
  }
  const row = () => screen.queryByRole("region", { name: /Live now/ });

  it("has no header, logo or footer; the top line has who's on the stage and my buttons", async () => {
    const { view } = await sidewaysWith(["Marina", "Rafa"]);
    expect(await screen.findByRole("heading", { level: 2, name: "Marina · Screen" })).toBeInTheDocument();
    expect(view.container.querySelector("header")).toBeNull();
    expect(view.container.querySelector("footer")).toBeNull();
    expect(screen.queryByRole("img", { name: "Xovê" })).toBeNull();
    const top = stageLayer().querySelector("[data-fades]") as HTMLElement;
    expect(within(top).getByText("LIVE")).toBeInTheDocument();
    expect(within(top).getByRole("button", { name: /people here/ })).toBeInTheDocument();
    expect(within(top).getByRole("button", { name: "Activity" })).toBeInTheDocument();
    expect(within(top).getByRole("button", { name: /: account,/ })).toBeInTheDocument();
    // No feed or cards under the stage: the row replaces them.
    expect(screen.queryByRole("heading", { name: /^Here/ })).toBeNull();
  });

  it("with nobody live, shows the bars, Nobody live and the places, and the camera button", async () => {
    phoneSideways();
    installFakeApi({ me: member });
    renderRoom();
    await connected();
    expect(screen.getByRole("heading", { name: "Nobody live" })).toBeInTheDocument();
    expect(screen.getByText("0 of 6 · 6 free")).toBeInTheDocument();
    expect(stageLayer().querySelectorAll("[data-bar]").length).toBeGreaterThan(0);
    expect(within(stageLayer()).getByRole("button", { name: /camera/i })).toBeInTheDocument();
    // Over the empty stage nothing fades.
    expect(stageLayer()).not.toHaveAttribute("data-chrome");
  });

  it("keeps the same video when the phone turns upright and back", async () => {
    const { phone } = await sidewaysWith(["Marina"]);
    const video = await screen.findByLabelText("Marina's shared screen");
    phone.turn();
    // Upright: the info row under the stage, and the feed.
    expect(await screen.findByRole("heading", { name: /^Live now/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Marina's shared screen")).toBe(video);
    phone.turn();
    expect(screen.getByLabelText("Marina's shared screen")).toBe(video);
  });

  it("fades the controls after a while without a touch, closing an open row; a touch brings them back", async () => {
    await sidewaysWith(["Marina", "Rafa"]);
    await screen.findByLabelText("Marina's shared screen");
    drag(0, -150);
    await waitFor(() => expect(row()?.closest("[data-open]") ?? row()).toHaveAttribute("data-open"));
    expect(stageLayer()).toHaveAttribute("data-chrome", "shown");
    await waitFor(() => expect(stageLayer()).toHaveAttribute("data-chrome", "hidden"), { timeout: 4000 });
    expect(row()).toBeNull();
    fireEvent.pointerDown(stageLayer(), { pointerId: 2, clientX: 10, clientY: 10, button: 0 });
    expect(stageLayer()).toHaveAttribute("data-chrome", "shown");
  });

  it("opens the row with a swipe up and closes it with a swipe down; a tap in it changes the stage, silently", async () => {
    const { room } = await sidewaysWith(["Marina", "Rafa"], true);
    await screen.findByLabelText("Marina's shared screen");
    expect(row()).toBeNull();
    drag(0, -150);
    const open = await waitFor(() => {
      const r = row();
      expect(r).not.toBeNull();
      return r!;
    });
    expect(open).toHaveTextContent("2 of 6");
    drag(0, 150);
    await waitFor(() => expect(row()).toBeNull());
    await userEvent.setup().click(screen.getByRole("button", { name: "Show the other streams" }));
    const again = await waitFor(() => row()!);
    await userEvent.setup().click(within(again).getByRole("button", { name: "Watch Rafa's screen" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Rafa · Screen" })).toBeInTheDocument();
    await waitFor(() => expect(room.soundPublication("user-2")!.isSubscribed).toBe(false));
  });

  it("keeps an open panel, and the bar it hangs from, past the idle time", async () => {
    await sidewaysWith(["Marina", "Rafa"]);
    await screen.findByLabelText("Marina's shared screen");
    fireEvent.pointerDown(stageLayer(), { pointerId: 3, clientX: 10, clientY: 10, button: 0 });
    await userEvent.setup().click(within(stageLayer()).getByRole("button", { name: "Activity" }));
    expect(screen.getByRole("dialog", { name: "Activity" })).toBeInTheDocument();
    // A tap on a phone may not focus the button: only the open panel holds the bar.
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    await new Promise((r) => setTimeout(r, 3200));
    expect(stageLayer()).toHaveAttribute("data-chrome", "shown");
    expect(screen.getByRole("dialog", { name: "Activity" })).toBeInTheDocument();
  }, 8000);

  it("opens the row only from a drag on the picture, not the black sides or the facecam", async () => {
    phoneSideways();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 732, height: 412 } as DOMRect);
    const server = installFakeApi({ me: member });
    server.streams = [
      someoneSharing("Bruno", 7, "screen", undefined, new Date(Date.now() - 300_000)),
      someoneSharing("Bruno", 7, "camera", undefined, new Date(Date.now() - 300_000)),
      someoneSharing("Ana", 3, "screen"),
    ];
    renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-7");
      lastRoom().publishCamera("user-7");
      lastRoom().publishScreen("user-3");
    });
    const facecam = await waitFor(() => document.querySelector("[data-facecam]")!);
    drag(0, -150, facecam);
    drag(0, -150, stageLayer());
    await new Promise((r) => setTimeout(r, 100));
    expect(row()).toBeNull();
  });

  it("doesn't open the row from the empty stage, and has no tab with nobody else live", async () => {
    phoneSideways();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 732, height: 412 } as DOMRect);
    const server = installFakeApi({ me: member });
    renderRoom();
    await connected();
    const bars = stageLayer().querySelector("[data-bars]")!;
    drag(0, -150, bars);
    act(() => {
      server.streams = [someoneSharing("Marina", 2)];
    });
    act(() => {
      lastRoom().publishScreen("user-2");
    });
    await screen.findByRole("heading", { level: 2, name: "Marina · Screen" });
    expect(row()).toBeNull();
    expect(screen.queryByRole("button", { name: "Show the other streams" })).toBeNull();
  });

  it("shows the dots too, one per person live, and a tap on one changes the stage", async () => {
    await sidewaysWith(["Marina", "Rafa"]);
    await screen.findByLabelText("Marina's shared screen");
    expect(within(stageLayer()).getByRole("button", { name: "Watch Marina" })).toHaveAttribute("aria-current", "true");
    await userEvent.setup().click(within(stageLayer()).getByRole("button", { name: "Watch Rafa" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Rafa · Screen" })).toBeInTheDocument();
  });

  it("changes the stream on a left or right drag, as upright, and drags on the buttons don't open the row", async () => {
    await sidewaysWith(["Marina", "Rafa"]);
    await screen.findByLabelText("Marina's shared screen");
    drag(-300, 0);
    expect(await screen.findByRole("heading", { level: 2, name: "Rafa · Screen" })).toBeInTheDocument();
    expect(row()).toBeNull();
    await new Promise((r) => setTimeout(r, 450));
    drag(300, 0);
    expect(await screen.findByRole("heading", { level: 2, name: "Marina · Screen" })).toBeInTheDocument();
    // On a phone sideways there's no fullscreen button (spec 0171): the round buttons are the controls.
    drag(0, -150, stageLayer().querySelector("[data-no-swipe] button[aria-label*=camera i]")!);
    await new Promise((r) => setTimeout(r, 100));
    expect(row()).toBeNull();
  });
});

describe("room: the full-screen view on a phone (spec 0171)", () => {
  const desktopMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = desktopMatchMedia;
    vi.restoreAllMocks();
  });

  /** A phone held upright, someone live. */
  async function upright() {
    const phone = phoneSideways();
    phone.turn();
    const server = installFakeApi({ me: member });
    server.streams = [someoneSharing("Marina", 2), someoneSharing("Rafa", 3)];
    const view = renderRoom();
    await connected();
    act(() => {
      lastRoom().publishScreen("user-2");
      lastRoom().publishScreen("user-3");
    });
    const video = await screen.findByLabelText("Marina's shared screen");
    return { phone, view, video };
  }
  const layoutOf = (view: ReturnType<typeof renderRoom>) =>
    view.container.querySelector("[data-layout]")?.getAttribute("data-layout");

  it("the button opens the sideways layout without turning, and leaves it, with the same video", async () => {
    const { view, video } = await upright();
    expect(layoutOf(view)).toBe("phone");
    const user = userEvent.setup();
    await user.click(within(stage()).getByRole("button", { name: "Full-screen view" }));
    expect(layoutOf(view)).toBe("sideways");
    expect(screen.getByLabelText("Marina's shared screen")).toBe(video);
    await user.click(within(stage()).getByRole("button", { name: "Exit full-screen view" }));
    expect(layoutOf(view)).toBe("phone");
    expect(screen.getByLabelText("Marina's shared screen")).toBe(video);
  });

  it("sideways there's no button; turning back returns to where it was", async () => {
    const { phone, view } = await upright();
    await userEvent.setup().click(within(stage()).getByRole("button", { name: "Full-screen view" }));
    phone.turn();
    expect(layoutOf(view)).toBe("sideways");
    expect(within(stage()).queryByRole("button", { name: /full-screen view|fullscreen/i })).toBeNull();
    phone.turn();
    expect(layoutOf(view)).toBe("sideways");
    await userEvent.setup().click(within(stage()).getByRole("button", { name: "Exit full-screen view" }));
    phone.turn();
    phone.turn();
    expect(layoutOf(view)).toBe("phone");
  });

  it("never asks the browser for the player's fullscreen on a phone", async () => {
    await upright();
    const frame = screen.getByLabelText("Marina's shared screen").closest("[data-chrome]") as HTMLElement;
    frame.requestFullscreen = vi.fn(async () => {});
    await userEvent.setup().click(within(stage()).getByRole("button", { name: "Full-screen view" }));
    expect(frame.requestFullscreen).not.toHaveBeenCalled();
  });
});
