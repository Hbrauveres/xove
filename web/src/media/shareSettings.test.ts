import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHARE,
  SHARE_QUALITIES,
  screenCaptureOptions,
  screenPublishOptions,
  viewerQualities,
  type ShareMode,
  type ShareQuality,
} from "./shareSettings";

const qualities: ShareQuality[] = ["1080p", "720p", "480p"];
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

  it.each(qualities.flatMap((q) => modes.map((m) => [q, m] as const)))(
    "%s %s: captures at that size and 30 fps, with the mode's content hint",
    (quality, mode) => {
      const capture = screenCaptureOptions(quality, mode);
      const preset = SHARE_QUALITIES.find((q) => q.id === quality)!;
      expect(capture.resolution).toEqual({ width: preset.width, height: preset.height, frameRate: 30 });
      expect(capture.contentHint).toBe(mode === "smooth" ? "motion" : "detail");
      expect(capture.selfBrowserSurface).toBe("exclude");
    },
  );

  it.each(qualities.flatMap((q) => modes.map((m) => [q, m] as const)))(
    "%s %s: VP9 with a VP8 fallback, layers down to 480p, within the budget",
    (quality, mode) => {
      const publish = screenPublishOptions(quality, mode);
      const index = qualities.indexOf(quality);
      const preset = SHARE_QUALITIES[index];

      expect(publish.videoCodec).toBe("vp9");
      expect(publish.backupCodec).toEqual({ codec: "vp8" });
      // VP9 as real layers (one stream per quality), so viewers get exactly 1080p, 720p or 480p.
      expect(publish.simulcast).toBe(true);
      expect(publish.scalabilityMode).toBe("L1T3");

      expect(publish.screenShareEncoding).toEqual({ maxBitrate: preset.maxBitrate, maxFramerate: 30 });
      const lower = SHARE_QUALITIES.slice(index + 1);
      expect(publish.screenShareSimulcastLayers?.map((l) => [l.height, l.encoding.maxBitrate, l.encoding.maxFramerate])).toEqual(
        lower.map((l) => [l.height, l.maxBitrate, 30]),
      );
      expect(publish.degradationPreference).toBe(mode === "smooth" ? "maintain-framerate" : "maintain-resolution");
    },
  );

  it("sets ceilings high enough that only the connection limits the picture", () => {
    // Well above LiveKit's own presets (1080p at 30 fps is 5 Mbit/s there).
    expect(SHARE_QUALITIES.map((q) => q.maxBitrate)).toEqual([8_000_000, 4_000_000, 2_000_000]);
    for (const q of SHARE_QUALITIES) expect(q.maxBitrate).toBeGreaterThanOrEqual(q.height * 4_000);
  });
});

describe("screen sound", () => {
  it("is captured as played: no voice filters, stereo", () => {
    expect(screenCaptureOptions("1080p", "smooth").audio).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
    });
  });

  it("is sent in stereo at music quality, without silence skipping", () => {
    const publish = screenPublishOptions("720p", "sharp");
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
});
