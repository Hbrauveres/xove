import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { capOf } from "../media/shareSettings";
import { aUser, installFakeApi } from "../test/fakeApi";
import { FakeLocalCameraTrack, FakeLocalScreenTrack, FakeMediaStreamTrack, lastRoom } from "../test/fakeLiveKit";
import { useLiveKitRoom, type Capture } from "./useLiveKitRoom";

const member = aUser({ name: "Henrique Brauveres", status: "MEMBER" });
const PREFS = { quality: "720p", mode: "sharp" } as const;

afterEach(() => localStorage.clear());

async function connected() {
  installFakeApi({ me: member });
  const hook = renderHook(() => useLiveKitRoom());
  await waitFor(() => expect(hook.result.current.connection).toBe("connected"));
  return hook;
}

/** Captures and sends my screen (with or without sound), as a start does. */
async function shareScreen(hook: Awaited<ReturnType<typeof connected>>, withSound: boolean) {
  lastRoom().localParticipant.nextPickerAudio = withSound;
  let capture: Capture | null = null;
  await act(async () => {
    capture = await hook.result.current.capture("screen", "smooth");
  });
  await act(async () => {
    await hook.result.current.publishCapture(capture!, { quality: "1080p", mode: "smooth" });
  });
  return lastRoom().localParticipant;
}

async function change(hook: Awaited<ReturnType<typeof connected>>) {
  let result: { hasSound: boolean } | null = null;
  await act(async () => {
    result = await hook.result.current.changeScreen(PREFS);
  });
  return result as { hasSound: boolean } | null;
}

describe("change window (spec 0098)", () => {
  it("swaps the new pick into the same published screen, with the sharer's settings", async () => {
    const hook = await connected();
    const local = await shareScreen(hook, true);
    const [published] = local.screens;
    const video = published.track as FakeLocalScreenTrack;
    const before = video.mediaStreamTrack;

    expect(await change(hook)).toEqual({ hasSound: true });

    // Same publication and track id: the API and viewers see the same stream.
    expect(local.screens).toEqual([published]);
    expect(published.trackSid).toBe("TR_my_screen");
    expect(video.replaceTrack).toHaveBeenCalledWith(expect.any(FakeMediaStreamTrack), { userProvidedTrack: false });
    expect(before.stopped).toBe(true);
    expect(video.mediaStreamTrack).not.toBe(before);
    expect(video.mediaStreamTrack.contentHint).toBe("detail");
    expect(video.setPublishingQuality).toHaveBeenLastCalledWith(capOf("720p"));
    expect(local.unpublishTrack).not.toHaveBeenCalled();
  });

  it("swaps the sound too when both have it", async () => {
    const hook = await connected();
    const local = await shareScreen(hook, true);
    const sound = local.screenAudio!.track;

    await change(hook);

    expect(sound.replaceTrack).toHaveBeenCalledWith(expect.any(FakeMediaStreamTrack), { userProvidedTrack: false });
    expect(local.screenAudio?.track).toBe(sound);
  });

  it("adds the sound when the new pick has it and the old one didn't", async () => {
    const hook = await connected();
    const local = await shareScreen(hook, false);
    expect(local.screenAudio).toBeNull();
    local.nextPickerAudio = true;

    expect(await change(hook)).toEqual({ hasSound: true });

    expect(local.screenAudio?.track.source).toBe("screen_share_audio");
    expect(local.publishTrack).toHaveBeenLastCalledWith(
      local.screenAudio?.track,
      expect.objectContaining({ source: "screen_share_audio" }),
    );
    expect(lastRoom().localParticipant.screens).toHaveLength(1);
  });

  it("drops the sound when the new pick has none, keeping the screen", async () => {
    const hook = await connected();
    const local = await shareScreen(hook, true);
    const sound = local.screenAudio!.track;
    local.nextPickerAudio = false;

    expect(await change(hook)).toEqual({ hasSound: false });

    expect(local.unpublishTrack).toHaveBeenCalledWith(sound, true);
    expect(local.screenAudio).toBeNull();
    expect(local.screens).toHaveLength(1);
  });

  it("stops the new pick when the share ended while the picker was open", async () => {
    const hook = await connected();
    const local = await shareScreen(hook, true);
    const video = local.screens[0].track as FakeLocalScreenTrack;
    // The browser's own "Stop sharing" bar, used while the picker is open.
    local.duringPicker = () => lastRoom().browserStopsMyShare();

    expect(await change(hook)).toBeNull();

    expect(video.replaceTrack).not.toHaveBeenCalled();
    expect(local.lastPicked.length).toBeGreaterThan(0);
    expect(local.lastPicked.every((t) => t.stopped)).toBe(true);
  });

  it("stops the new pick when the swap fails", async () => {
    const hook = await connected();
    const local = await shareScreen(hook, true);
    const video = local.screens[0].track as FakeLocalScreenTrack;
    video.replaceTrack.mockRejectedValueOnce(new Error("unable to replace an unpublished track"));

    expect(await change(hook)).toBeNull();

    expect(local.lastPicked.every((t) => t.stopped)).toBe(true);
    expect(hook.result.current.error).toBe("Couldn't change what you share.");
  });

  it("keeps the current share when the picker is closed", async () => {
    const hook = await connected();
    const local = await shareScreen(hook, true);
    const video = local.screens[0].track as FakeLocalScreenTrack;
    local.nextPicker = "cancel";

    expect(await change(hook)).toBeNull();

    expect(video.replaceTrack).not.toHaveBeenCalled();
    expect(video.stopped).toBe(false);
    expect(hook.result.current.error).toBeNull();
  });
});

describe("staying on Xovê after the picker (spec 0101)", () => {
  const behaviours: string[] = [];
  class FakeCaptureController {
    setFocusBehavior(behaviour: string) {
      behaviours.push(behaviour);
    }
  }
  afterEach(() => {
    behaviours.length = 0;
    vi.unstubAllGlobals();
  });

  it("asks the browser to stay on Xovê when a screen is picked, and when it's changed", async () => {
    vi.stubGlobal("CaptureController", FakeCaptureController);
    const hook = await connected();
    const local = await shareScreen(hook, true);

    expect(local.getDisplayMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({ controller: expect.any(FakeCaptureController), windowAudio: "window" }),
    );
    expect(behaviours).toEqual(["no-focus-change"]);

    await change(hook);
    expect(behaviours).toEqual(["no-focus-change", "no-focus-change"]);
  });

  it("still shares when the browser refuses (a whole screen can't keep the focus)", async () => {
    vi.stubGlobal(
      "CaptureController",
      class {
        setFocusBehavior() {
          throw new DOMException("Not a tab or window", "InvalidStateError");
        }
      },
    );
    const hook = await connected();
    const local = await shareScreen(hook, true);

    expect(local.screens).toHaveLength(1);
    expect(hook.result.current.error).toBeNull();
  });
});

describe("pick a camera (spec 0098)", () => {
  async function cameraOn(hook: Awaited<ReturnType<typeof connected>>) {
    let capture: Capture | null = null;
    await act(async () => {
      capture = await hook.result.current.capture("camera", "smooth");
    });
    await act(async () => {
      await hook.result.current.publishCapture(capture!, { quality: "720p", mode: "smooth" });
    });
    return lastRoom().localParticipant.camera!.track;
  }

  it("lists the browser's cameras and the one being sent", async () => {
    const hook = await connected();
    await cameraOn(hook);

    await waitFor(() =>
      expect(hook.result.current.cameras).toEqual([
        { deviceId: "cam-1", label: "Logitech C920" },
        { deviceId: "cam-2", label: "Integrated Webcam" },
      ]),
    );
    expect(hook.result.current.cameraId).toBe("cam-1");
  });

  it("switches the camera being sent without stopping it, and uses it next time", async () => {
    const hook = await connected();
    const camera = (await cameraOn(hook)) as FakeLocalCameraTrack;

    await act(async () => {
      await hook.result.current.pickCamera("cam-2", { quality: "720p", mode: "sharp" });
    });

    expect(camera.restartTrack).toHaveBeenCalledWith(expect.objectContaining({ deviceId: { exact: "cam-2" } }));
    // The new browser track keeps the stream's mode.
    expect(camera.mediaStreamTrack.contentHint).toBe("detail");
    expect(lastRoom().localParticipant.camera?.track).toBe(camera);
    expect(lastRoom().localParticipant.unpublishTrack).not.toHaveBeenCalled();
    expect(hook.result.current.cameraId).toBe("cam-2");
    expect(localStorage.getItem("xove.camera.device")).toBe("cam-2");

    // The next start asks for it.
    await act(async () => {
      await hook.result.current.stop("camera");
    });
    await cameraOn(hook);
    expect(lastRoom().localParticipant.createTracks).toHaveBeenLastCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ deviceId: { ideal: "cam-2" } }) }),
    );
  });

  it("goes back to the previous camera when the new one fails, and doesn't remember it", async () => {
    const hook = await connected();
    const camera = (await cameraOn(hook)) as FakeLocalCameraTrack;
    camera.restartTrack.mockRejectedValueOnce(new DOMException("Device in use", "NotReadableError"));

    await act(async () => {
      await hook.result.current.pickCamera("cam-2", { quality: "720p", mode: "smooth" });
    });

    expect(camera.restartTrack).toHaveBeenLastCalledWith(expect.objectContaining({ deviceId: { exact: "cam-1" } }));
    expect(lastRoom().localParticipant.camera?.track).toBe(camera);
    expect(hook.result.current.error).toBe("Couldn't switch to that camera.");
    expect(localStorage.getItem("xove.camera.device")).toBeNull();
    expect(hook.result.current.cameraId).toBe("cam-1");
  });

  it("stops the camera when neither the new one nor the old one comes back", async () => {
    const hook = await connected();
    const camera = (await cameraOn(hook)) as FakeLocalCameraTrack;
    camera.restartTrack.mockRejectedValue(new DOMException("Device in use", "NotReadableError"));

    await act(async () => {
      await hook.result.current.pickCamera("cam-2", { quality: "720p", mode: "smooth" });
    });

    expect(lastRoom().localParticipant.camera).toBeNull();
  });

  it("still stops the camera when a switched camera is unplugged", async () => {
    const hook = await connected();
    const camera = (await cameraOn(hook)) as FakeLocalCameraTrack;
    await act(async () => {
      await hook.result.current.pickCamera("cam-2", { quality: "720p", mode: "sharp" });
    });

    await act(async () => {
      camera.mediaStreamTrack.end();
    });

    await waitFor(() => expect(lastRoom().localParticipant.camera).toBeNull());
  });
});
