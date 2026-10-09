/** Chrome's install prompt (spec 0171): offered once, early, often before the page has rendered. */
export type InstallPrompt = Event & { prompt: () => Promise<void> };

let kept: InstallPrompt | null = null;
const installed = new Set<() => void>();
let listening = false;

/** Starts listening, once, as early as the page loads (`main.tsx`). */
export function listenForInstall() {
  if (listening) return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    // Kept for the "Get Xovê" button, instead of the browser's own mini bar.
    e.preventDefault();
    kept = e as InstallPrompt;
  });
  window.addEventListener("appinstalled", () => {
    kept = null;
    installed.forEach((f) => f());
  });
}

/** The prompt the browser offered, if any. */
export const installPrompt = () => kept;

/** Calls `f` when the app gets installed; returns how to stop. */
export function onInstalled(f: () => void) {
  installed.add(f);
  return () => {
    installed.delete(f);
  };
}

/** Only for tests. */
export function forgetPrompt() {
  kept = null;
}
