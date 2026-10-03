import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHARE,
  SHARE_QUALITIES,
  capOf,
  effectiveQuality,
  screenCaptureOptions,
  screenPublishOptions,
  viewerQualities,
  type ShareMode,
} from "./shareSettings";

const modes: ShareMode[] = ["smooth", "sharp"];

describe("share presets", () => {
  it("offers 1080p, 720p and 480p at 30 fps, 1080p Smooth by default", () => {
    expect(SHARE_QUALITIES.map((q) => [q.id, q.height, q.fps])).toEqual([
      ["1080p", 1080, 30],
      ["720p", 720, 30],
      ["480p", 480, 30],
    ]);
    expect(DEFAULT_SHARE).toEqual({ quality: "1080p", mode: "smooth" });
  });

  it.each(modes)("%s: always captures the best quality at 30 fps, with the mode's content hint", (mode) => {
    const capture = screenCaptureOptions(mode);
    expect(capture.resolution).toEqual({ width: 1920, height: 1080, frameRate: 30 });
    expect(capture.contentHint).toBe(mode === "smooth" ? "motion" : "detail");
    expect(capture.selfBrowserSurface).toBe("exclude");
  });

  it.each(modes)("%s: VP9 with a VP8 fallback, always 1080p, 720p and 480p layers", (mode) => {
    const publish = screenPublishOptions(mode);

    expect(publish.videoCodec).toBe("vp9");
    expect(publish.backupCodec).toEqual({ codec: "vp8" });
    // VP9 as real layers (one stream per quality), so viewers get exactly 1080p, 720p or 480p.
    expect(publish.simulcast).toBe(true);
    expect(publish.scalabilityMode).toBe("L1T3");
    expect(publish.screenShareEncoding).toEqual({ maxBitrate: 8_000_000, maxFramerate: 30 });
    expect(publish.screenShareSimulcastLayers?.map((l) => [l.height, l.encoding.maxBitrate, l.encoding.maxFramerate])).toEqual([
      [720, 4_000_000, 30],
      [480, 2_000_000, 30],
    ]);
    expect(publish.degradationPreference).toBe(mode === "smooth" ? "maintain-framerate" : "maintain-resolution");
  });

  it("sets ceilings high enough that only the connection limits the picture", () => {
    // Well above LiveKit's own presets (1080p at 30 fps is 5 Mbit/s there).
    expect(SHARE_QUALITIES.map((q) => q.maxBitrate)).toEqual([8_000_000, 4_000_000, 2_000_000]);
  });

  it("turns the chosen quality into the highest layer sent", () => {
    expect([capOf("1080p"), capOf("720p"), capOf("480p")]).toEqual([2, 1, 0]);
  });
});

describe("screen sound", () => {
  it("is captured as played: no voice filters, stereo", () => {
    expect(screenCaptureOptions("smooth").audio).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
    });
  });

  it("is sent in stereo at music quality, without silence skipping", () => {
    const publish = screenPublishOptions("sharp");
    expect(publish.audioPreset).toEqual({ maxBitrate: 128_000 });
    expect(publish.forceStereo).toBe(true);
    expect(publish.dtx).toBe(false);
  });
});

describe("what a viewer can pick", () => {
  it("offers the sharer's quality and the ones below it, down to 480p", () => {
    expect(viewerQualities(1080)).toEqual(["1080p", "720p", "480p"]);
    expect(viewerQualities(720)).toEqual(["720p", "480p"]);
    expect(viewerQualities(480)).toEqual(["480p"]);
  });

  it("goes by the sharer's real height, which can be a bit smaller than the preset", () => {
    // A 16:10 or ultrawide screen captured into 1920x1080 comes out shorter.
    expect(viewerQualities(1012)).toEqual(["1080p", "720p", "480p"]);
    expect(viewerQualities(700)).toEqual(["720p", "480p"]);
    expect(viewerQualities(0)).toEqual(["480p"]);
  });

  it("never offers more than the sharer's chosen quality", () => {
    expect(viewerQualities(1080, 3, "720p")).toEqual(["720p", "480p"]);
    expect(viewerQualities(1080, 3, "480p")).toEqual(["480p"]);
    expect(viewerQualities(720, 3, "1080p")).toEqual(["720p", "480p"]);
  });

  it("offers only one quality when the sharer sends one layer", () => {
    expect(viewerQualities(1080, 1)).toEqual(["1080p"]);
  });

  it("treats a remembered quality that isn't offered as Auto", () => {
    expect(effectiveQuality("1080p", ["720p", "480p"])).toBe("auto");
    expect(effectiveQuality("720p", ["720p", "480p"])).toBe("720p");
  });
});
