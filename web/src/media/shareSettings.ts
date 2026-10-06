import type { TrackPublishOptions, VideoCaptureOptions, VideoPreset } from "livekit-client";

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
  /**
   * The most this quality may use, in bits per second. Set high on purpose: each
   * connection uses what the sharer's computer and network allow, up to this.
   */
  maxBitrate: number;
};

/**
 * From best to lowest. The ceilings are well above what a screen usually needs, so
 * nobody is held back by them, only by their own connection; the browser and LiveKit
 * lower the bitrate by themselves when a connection can't keep up. The VPS's monthly
 * traffic is watched in Hostinger's panel (decided with Henrique, 2026-10-03).
 */
export const SHARE_QUALITIES: readonly SharePreset[] = [
  { id: "1080p", width: 1920, height: 1080, fps: 30, maxBitrate: 8_000_000 },
  { id: "720p", width: 1280, height: 720, fps: 30, maxBitrate: 4_000_000 },
  { id: "480p", width: 854, height: 480, fps: 30, maxBitrate: 2_000_000 },
];

export const DEFAULT_SHARE: { quality: ShareQuality; mode: ShareMode } = { quality: "1080p", mode: "smooth" };

const presetOf = (quality: ShareQuality) => SHARE_QUALITIES.find((q) => q.id === quality) ?? SHARE_QUALITIES[0];

/** The content hint for a mode: how the browser encodes the screen. */
export const contentHintOf = (mode: ShareMode) => (mode === "smooth" ? "motion" : "detail");

/** How the browser trades quality when the connection is tight, for a mode. */
export const degradationOf = (mode: ShareMode): RTCDegradationPreference =>
  mode === "smooth" ? "maintain-framerate" : "maintain-resolution";

/**
 * What Xovê asks the browser for when sharing a screen (spec 0095). Xovê opens the
 * picker itself, since livekit-client drops `windowAudio`.
 */
export type ScreenCaptureRequest = DisplayMediaStreamOptions & {
  audio: MediaTrackConstraints & { restrictOwnAudio: boolean };
  video: MediaTrackConstraints;
  selfBrowserSurface: "include" | "exclude";
  windowAudio: "exclude" | "window" | "system";
};

const isSafari = () => /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);

/**
 * The browser's screen picker: always the best quality (so the sharer can raise it
 * later without picking again), and the sound as played.
 */
export function screenCaptureRequest(safari = isSafari()): ScreenCaptureRequest {
  const preset = SHARE_QUALITIES[0];
  // As LiveKit does: Safari needs `max`, the others take `ideal`.
  const size = (px: number) => (safari ? { max: px } : { ideal: px });
  return {
    video: { width: size(preset.width), height: size(preset.height), frameRate: preset.fps },
    // Sharing this very tab would show the room inside the room.
    selfBrowserSurface: "exclude",
    // Music and game sound, not a voice: no microphone filters, both channels. Without
    // Xovê's own sound, so a whole-screen share doesn't send viewers their own streams back.
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
      restrictOwnAudio: true,
    },
    // A picked window shares its app's sound, not the whole system's (Discord included).
    windowAudio: "window",
  };
}

/**
 * How the screen is sent: VP9 (VP8 where the browser can't), always with one layer
 * per quality (1080p, 720p, 480p). The sharer's chosen quality is a cap on top of
 * that (`capOf`), so it can go up or down while sharing, with no reload.
 */
export function screenPublishOptions(mode: ShareMode): TrackPublishOptions {
  const [preset, ...lower] = SHARE_QUALITIES;
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
    degradationPreference: degradationOf(mode),
    // Stereo at music quality, and no silence skipping (it chops quiet moments).
    audioPreset: { maxBitrate: 128_000 },
    forceStereo: true,
    dtx: false,
  };
}

/**
 * A camera (spec 0060) goes up to 720p: no need for more, and it spares the upload of
 * someone sending a screen and a camera together.
 */
export const CAMERA_QUALITIES: readonly SharePreset[] = SHARE_QUALITIES.filter((q) => q.height <= 720);

export const DEFAULT_CAMERA: { quality: ShareQuality; mode: ShareMode } = { quality: "720p", mode: "smooth" };

/**
 * What the browser asks the camera for: 720p at 30 fps (the mode's content hint is set
 * on the track when it's sent). The microphone is never asked for.
 */
export function cameraCaptureOptions(deviceId?: string | null): VideoCaptureOptions {
  const preset = CAMERA_QUALITIES[0];
  return {
    resolution: { width: preset.width, height: preset.height, frameRate: preset.fps },
    // `ideal`: when the camera picked is gone, the browser uses another instead of failing.
    ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
  };
}

/** How a camera is sent: like a screen (VP9, VP8 fallback), with a 720p and a 480p layer. */
export function cameraPublishOptions(mode: ShareMode): TrackPublishOptions {
  const [preset, ...lower] = CAMERA_QUALITIES;
  return {
    videoCodec: "vp9",
    backupCodec: { codec: "vp8" },
    simulcast: true,
    scalabilityMode: "L1T3",
    videoEncoding: { maxBitrate: preset.maxBitrate, maxFramerate: preset.fps },
    videoSimulcastLayers: lower.map(
      (l) => ({ width: l.width, height: l.height, encoding: { maxBitrate: l.maxBitrate, maxFramerate: l.fps } }) as VideoPreset,
    ),
    degradationPreference: degradationOf(mode),
  };
}

/**
 * The highest layer to send for a chosen quality, as LiveKit counts them (0 = lowest).
 * A screen has three layers (480p, 720p, 1080p), a camera two (480p, 720p): the
 * numbers line up for both.
 */
export function capOf(quality: ShareQuality): 0 | 1 | 2 {
  return quality === "1080p" ? 2 : quality === "720p" ? 1 : 0;
}

/** The size a quality asks the server for. */
export const sizeOf = (quality: ShareQuality) => {
  const preset = presetOf(quality);
  return { width: preset.width, height: preset.height };
};

/**
 * The qualities a viewer can pick for a screen whose top layer is `height` pixels
 * tall: the sharer's quality and the ones below it, never above. A screen that
 * isn't 16:9 comes out a bit shorter than its preset, so it counts as the preset
 * just above.
 */
export function viewerQualities(height: number, layers?: number, cap?: ShareQuality): ShareQuality[] {
  const ascending = [...SHARE_QUALITIES].reverse();
  const top = ascending.find((q) => height <= q.height) ?? SHARE_QUALITIES[0];
  // The sharer's chosen quality caps what anyone can pick (it can change while sharing).
  const capHeight = presetOf(cap ?? "1080p").height;
  const offered = SHARE_QUALITIES.filter((q) => q.height <= Math.min(top.height, capHeight)).map((q) => q.id);
  // Firefox and Safari sharers send one quality only: picking a lower one would change nothing.
  return layers === 1 ? offered.slice(0, 1) : offered;
}

/** The quality to ask the server for: a remembered choice this sharer doesn't offer counts as Auto. */
export function effectiveQuality<Q extends string>(wanted: Q | "auto", offered: readonly string[]): Q | "auto" {
  return wanted !== "auto" && offered.includes(wanted) ? wanted : "auto";
}
