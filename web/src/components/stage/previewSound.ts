/** One preview's sound, for this viewer: muted unless they unmuted it (spec 0060). */
export type PreviewSound = { muted: boolean; volume: number };

export const MUTED: PreviewSound = { muted: true, volume: 1 };
