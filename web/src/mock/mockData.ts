import type { Friend, ScreenScene, StreamStats } from "../types";

/** You, as the logged-in user. The real app reads this from the session. */
export const ME: Friend = { id: "me", name: "Henrique", hue: 36, online: true };

/** Example friends on the allowlist. Replace with real Google accounts later. */
export const FRIENDS: Friend[] = [
  { id: "ana", name: "Ana", hue: 200, online: true },
  { id: "bruno", name: "Bruno", hue: 150, online: true },
  { id: "caio", name: "Caio", hue: 280, online: true },
  { id: "duda", name: "Duda", hue: 330, online: true },
  { id: "leo", name: "Léo", hue: 100, online: false },
];

export const SCENE_LABEL: Record<ScreenScene, string> = {
  editor: "Code editor",
  game: "Game",
  desktop: "Your screen",
};

/** Plausible stats per scene: games push frames, editors push detail. */
export const BASE_STATS: Record<ScreenScene, StreamStats> = {
  editor: { width: 2560, height: 1440, fps: 30, codec: "VP9", bitrateMbps: 2.4, latencyMs: 38 },
  game: { width: 1920, height: 1080, fps: 60, codec: "VP9", bitrateMbps: 5.8, latencyMs: 44 },
  desktop: { width: 1920, height: 1080, fps: 30, codec: "VP9", bitrateMbps: 2.1, latencyMs: 12 },
};

/** Limit from config in the real app (MAX_SCREENS). Version 1 = one screen. */
export const MAX_SCREENS = 1;
