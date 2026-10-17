import type { ReactNode } from "react";

/** How long a toast stays before it fades out. */
export const TOAST_MS = 3000;

export type ToastMessage = {
  /** Counts up with every toast, so the same message shown again starts over. */
  id: number;
  text: string;
  /** What it's about, as an icon: the control that was touched, crossed out. */
  icon?: ReactNode;
};

let current: ToastMessage | null = null;
let next = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());

/**
 * A short message to the user (design decision 10): one at a time, the newest replacing it,
 * gone by itself after 3 s. Any component can call it; the stage draws it.
 */
export function showToast(text: string, icon?: ReactNode) {
  current = { id: ++next, text, icon };
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    tell();
  }, TOAST_MS);
  tell();
}

export function subscribeToast(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const currentToast = () => current;

/** Clears the toast at once (tests, and leaving the room). */
export function clearToast() {
  clearTimeout(timer);
  current = null;
  tell();
}
