import { useEffect, useState, useSyncExternalStore } from "react";
import { currentToast, subscribeToast, type ToastMessage } from "./toast";
import styles from "./Toast.module.css";

/** How long it takes to fade out; the last message stays drawn until then. */
const FADE_MS = 200;

/**
 * The toast (design decision 10): a frosted pill at the top centre of what holds it, with an
 * icon and a short message, read once by screen readers. The live region is always there,
 * so a message that arrives is announced.
 */
export function Toast() {
  const message = useSyncExternalStore(subscribeToast, currentToast, currentToast);
  // Keeps the last message drawn while it fades out.
  const [shown, setShown] = useState<ToastMessage | null>(message);
  if (message && message !== shown) setShown(message);
  useEffect(() => {
    if (message) return;
    const gone = window.setTimeout(() => setShown(null), FADE_MS);
    return () => window.clearTimeout(gone);
  }, [message]);

  return (
    <div className={styles.toast} role="status" aria-live="polite" data-show={message ? true : undefined}>
      {shown && (
        <>
          {shown.icon && (
            <span className={styles.icon} aria-hidden="true">
              {shown.icon}
            </span>
          )}
          <span key={shown.id} className={styles.text}>
            {shown.text}
          </span>
        </>
      )}
    </div>
  );
}
