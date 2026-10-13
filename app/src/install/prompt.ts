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

/**
 * Opens the kept prompt. A browser's prompt can be shown only once: after that (installed or
 * dismissed) there's none, and the screen points to the browser's menu instead. False when
 * there was none to open.
 */
export function openInstallPrompt(): boolean {
  const prompt = kept;
  if (!prompt) return false;
  kept = null;
  prompt.prompt().catch(() => {
    /* Already used, or refused: the menu is the way. */
  });
  return true;
}

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
