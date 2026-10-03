import { useEffect, useRef, useState } from "react";
import type { SharePrefs } from "../../media/preferences";
import type { MediaTrack } from "../../types";
import { Button } from "../ui/Button";
import { ShareSettingsFields } from "./ShareSettingsFields";
import styles from "./ShareSetup.module.css";

type Props = {
  /** The screen just picked in the browser, not sent yet. */
  preview: MediaTrack;
  /** Where the choices start: what was used last time. */
  initial: SharePrefs;
  hasSound: boolean;
  onStart: (prefs: SharePrefs) => void;
  onCancel: () => void;
};

/**
 * After the browser's picker: a small preview of what will be shared, and how to
 * send it. Nothing reaches anyone until "Start sharing".
 */
export function ShareSetup({ preview, initial, hasSound, onStart, onCancel }: Props) {
  const [prefs, setPrefs] = useState(initial);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    preview.attach(el);
    return () => {
      preview.detach(el);
    };
  }, [preview]);

  return (
    <div className={styles.backdrop} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <div className={styles.window} role="dialog" aria-modal="true" aria-labelledby="share-setup-title">
        <h2 id="share-setup-title" className={styles.title}>
          Start sharing
        </h2>
        <video ref={videoRef} className={styles.preview} aria-label="Preview of your screen" autoPlay playsInline muted />
        {!hasSound && (
          <p className={styles.notice}>
            No sound with this screen. To share sound, pick a browser tab (or your whole screen on Windows) and tick
            "Share audio". Firefox and Safari can't share sound.
          </p>
        )}
        <ShareSettingsFields prefs={prefs} onChange={setPrefs} />
        <p className={styles.hint}>You can change both while sharing, from your player.</p>
        <div className={styles.actions}>
          <Button autoFocus onClick={() => onStart(prefs)}>
            Start sharing
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
