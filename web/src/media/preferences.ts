import { CAMERA_QUALITIES, DEFAULT_CAMERA, DEFAULT_SHARE, SHARE_QUALITIES, type ShareMode, type ShareQuality } from "./shareSettings";

/**
 * Choices each browser remembers for next time (spec 0086). Only conveniences:
 * when the browser's storage is blocked or holds something odd, the defaults apply.
 */

export type SharePrefs = { quality: ShareQuality; mode: ShareMode };
/** "auto" lets the server send what fits; a quality caps what this viewer receives. */
export type WatchQuality = "auto" | ShareQuality;
export type WatchPrefs = { quality: WatchQuality; volume: number; muted: boolean };

const KEYS = {
  shareQuality: "xove.share.quality",
  shareMode: "xove.share.mode",
  cameraQuality: "xove.camera.quality",
  cameraMode: "xove.camera.mode",
  cameraDevice: "xove.camera.device",
  watchQuality: "xove.watch.quality",
  watchVolume: "xove.watch.volume",
  watchMuted: "xove.watch.muted",
} as const;

const qualities = SHARE_QUALITIES.map((q) => q.id as string);
const cameraQualities = CAMERA_QUALITIES.map((q) => q.id as string);

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private mode or blocked storage: the choice just isn't remembered. */
  }
}

export function loadSharePrefs(): SharePrefs {
  const quality = read(KEYS.shareQuality);
  const mode = read(KEYS.shareMode);
  return {
    quality: quality && qualities.includes(quality) ? (quality as ShareQuality) : DEFAULT_SHARE.quality,
    mode: mode === "smooth" || mode === "sharp" ? mode : DEFAULT_SHARE.mode,
  };
}

export function saveSharePrefs(prefs: SharePrefs) {
  write(KEYS.shareQuality, prefs.quality);
  write(KEYS.shareMode, prefs.mode);
}

/** The camera's quality and mode (spec 0060): 720p at most. */
export function loadCameraPrefs(): SharePrefs {
  const quality = read(KEYS.cameraQuality);
  const mode = read(KEYS.cameraMode);
  return {
    quality: quality && cameraQualities.includes(quality) ? (quality as ShareQuality) : DEFAULT_CAMERA.quality,
    mode: mode === "smooth" || mode === "sharp" ? mode : DEFAULT_CAMERA.mode,
  };
}

export function saveCameraPrefs(prefs: SharePrefs) {
  write(KEYS.cameraQuality, prefs.quality);
  write(KEYS.cameraMode, prefs.mode);
}

/** The camera picked in the camera's menu (spec 0098), or null for the browser's default. */
export function loadCameraDevice(): string | null {
  return read(KEYS.cameraDevice) || null;
}

export function saveCameraDevice(deviceId: string) {
  write(KEYS.cameraDevice, deviceId);
}

export function loadWatchPrefs(): WatchPrefs {
  const quality = read(KEYS.watchQuality);
  const volume = Number(read(KEYS.watchVolume) ?? 1);
  return {
    quality: quality === "auto" || (quality && qualities.includes(quality)) ? (quality as WatchQuality) : "auto",
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1,
    muted: read(KEYS.watchMuted) === "true",
  };
}

export function saveWatchPrefs(prefs: WatchPrefs) {
  write(KEYS.watchQuality, prefs.quality);
  write(KEYS.watchVolume, String(prefs.volume));
  write(KEYS.watchMuted, String(prefs.muted));
}
