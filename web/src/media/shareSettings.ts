import type { ScreenShareCaptureOptions, TrackPublishOptions, VideoPreset } from "livekit-client";

/**
 * How a shared screen is captured and sent (spec 0086). LiveKit's defaults are
 * tuned for slides and voice calls (15 fps, sharpness first, voice filters on the
 * sound); these are tuned for games and videos, within a bandwidth budget.
 */

export type ShareQuality = "1080p" | "720p" | "480p";

/** Smooth keeps motion fluid when the connection is tight; Sharp keeps text readable. */
export type ShareMode = "smooth" | "sharp";

export type SharePreset = {
  id: ShareQuality;
  width: number;
  height: number;
  fps: number;
  /** The most this quality may use, in bits per second (VP9). */
  maxBitrate: number;
};

/** From best to lowest. The bitrates keep a full room within the VPS's traffic (#60). */
export const SHARE_QUALITIES: readonly SharePreset[] = [
  { id: "1080p", width: 1920, height: 1080, fps: 30, maxBitrate: 2_500_000 },
  { id: "720p", width: 1280, height: 720, fps: 30, maxBitrate: 1_200_000 },
  { id: "480p", width: 854, height: 480, fps: 30, maxBitrate: 600_000 },
];

export const DEFAULT_SHARE: { quality: ShareQuality; mode: ShareMode } = { quality: "1080p", mode: "smooth" };

const presetOf = (quality: ShareQuality) => SHARE_QUALITIES.find((q) => q.id === quality) ?? SHARE_QUALITIES[0];

/** What the browser's screen picker captures: the size, the content hint and the sound, as played. */
export function screenCaptureOptions(quality: ShareQuality, mode: ShareMode): ScreenShareCaptureOptions {
  const preset = presetOf(quality);
  return {
    resolution: { width: preset.width, height: preset.height, frameRate: preset.fps },
    contentHint: mode === "smooth" ? "motion" : "detail",
    // Sharing this very tab would show the room inside the room.
    selfBrowserSurface: "exclude",
    // Music and game sound, not a voice: no microphone filters, both channels.
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 },
  };
}

/** How the screen is sent: VP9 (VP8 where the browser can't), one layer per quality from the chosen one down to 480p. */
export function screenPublishOptions(quality: ShareQuality, mode: ShareMode): TrackPublishOptions {
  const index = SHARE_QUALITIES.findIndex((q) => q.id === quality);
  const preset = SHARE_QUALITIES[Math.max(index, 0)];
  const lower = SHARE_QUALITIES.slice(Math.max(index, 0) + 1);
  return {
    videoCodec: "vp9",
    backupCodec: { codec: "vp8" },
    // VP9 as real layers ("L1T3" per layer), so a viewer gets exactly 1080p, 720p or 480p.
    simulcast: true,
    scalabilityMode: "L1T3",
    screenShareEncoding: { maxBitrate: preset.maxBitrate, maxFramerate: preset.fps },
    screenShareSimulcastLayers: lower.map(
      (l) => ({ width: l.width, height: l.height, encoding: { maxBitrate: l.maxBitrate, maxFramerate: l.fps } }) as VideoPreset,
    ),
    // Smooth: lower the resolution before the frame rate. Sharp: the other way round.
    degradationPreference: mode === "smooth" ? "maintain-framerate" : "maintain-resolution",
    // Stereo at music quality, and no silence skipping (it chops quiet moments).
    audioPreset: { maxBitrate: 128_000 },
    forceStereo: true,
    dtx: false,
  };
}

/**
 * The qualities a viewer can pick for a screen whose top layer is `height` pixels
 * tall: the sharer's quality and the ones below it, never above. A screen that
 * isn't 16:9 comes out a bit shorter than its preset, so it counts as the preset
 * just above.
 */
export function viewerQualities(height: number): ShareQuality[] {
  const ascending = [...SHARE_QUALITIES].reverse();
  const top = ascending.find((q) => height <= q.height) ?? SHARE_QUALITIES[0];
  return SHARE_QUALITIES.filter((q) => q.height <= top.height).map((q) => q.id);
}
