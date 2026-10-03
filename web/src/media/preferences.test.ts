import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCameraPrefs, loadSharePrefs, loadWatchPrefs, saveCameraPrefs, saveSharePrefs, saveWatchPrefs } from "./preferences";

afterEach(() => localStorage.clear());

describe("the sharer's choices", () => {
  it("default to 1080p Smooth", () => {
    expect(loadSharePrefs()).toEqual({ quality: "1080p", mode: "smooth" });
  });

  it("are remembered", () => {
    saveSharePrefs({ quality: "720p", mode: "sharp" });
    expect(loadSharePrefs()).toEqual({ quality: "720p", mode: "sharp" });
  });

  it("ignore a value that isn't one of the choices", () => {
    localStorage.setItem("xove.share.quality", "4k");
    localStorage.setItem("xove.share.mode", "blurry");
    expect(loadSharePrefs()).toEqual({ quality: "1080p", mode: "smooth" });
  });
});

describe("the camera's choices (spec 0060)", () => {
  it("default to 720p Smooth", () => {
    expect(loadCameraPrefs()).toEqual({ quality: "720p", mode: "smooth" });
  });

  it("are remembered apart from the screen's", () => {
    saveSharePrefs({ quality: "1080p", mode: "sharp" });
    saveCameraPrefs({ quality: "480p", mode: "smooth" });
    expect(loadCameraPrefs()).toEqual({ quality: "480p", mode: "smooth" });
    expect(loadSharePrefs()).toEqual({ quality: "1080p", mode: "sharp" });
  });

  it("never go above 720p", () => {
    localStorage.setItem("xove.camera.quality", "1080p");
    expect(loadCameraPrefs().quality).toBe("720p");
  });
});

describe("the viewer's choices", () => {
  it("default to Auto, full volume, not muted", () => {
    expect(loadWatchPrefs()).toEqual({ quality: "auto", volume: 1, muted: false });
  });

  it("are remembered", () => {
    saveWatchPrefs({ quality: "480p", volume: 0.35, muted: true });
    expect(loadWatchPrefs()).toEqual({ quality: "480p", volume: 0.35, muted: true });
  });

  it("keep the volume between 0 and 1", () => {
    localStorage.setItem("xove.watch.volume", "7");
    expect(loadWatchPrefs().volume).toBe(1);
    localStorage.setItem("xove.watch.volume", "nonsense");
    expect(loadWatchPrefs().volume).toBe(1);
  });
});

describe("when the browser's storage fails", () => {
  it("uses the defaults and doesn't break the page", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => saveSharePrefs({ quality: "480p", mode: "sharp" })).not.toThrow();
    expect(() => saveWatchPrefs({ quality: "720p", volume: 0.5, muted: false })).not.toThrow();
    expect(loadSharePrefs()).toEqual({ quality: "1080p", mode: "smooth" });
    expect(loadWatchPrefs()).toEqual({ quality: "auto", volume: 1, muted: false });
    vi.restoreAllMocks();
  });
});
