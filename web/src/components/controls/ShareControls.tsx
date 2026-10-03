import type { StreamKind } from "../../types";
import { Button } from "../ui/Button";
import styles from "./ShareControls.module.css";

type Props = {
  /** Which of my streams are live. */
  mine: Record<StreamKind, boolean>;
  /** Stream places left of the 6. */
  free: number;
  onStart: (kind: StreamKind) => void;
  onStop: (kind: StreamKind) => void;
  /** I'm sharing my screen, but my browser gave no sound. */
  noSound?: boolean;
  /** A request is on its way: buttons wait. */
  busy?: boolean;
};

/**
 * Share my screen and turn on my camera, or stop them (spec 0060). Up to 6 streams
 * at once: nobody is pushed out, so when they're all taken the buttons wait.
 */
export function ShareControls({ mine, free, onStart, onStop, noSound = false, busy = false }: Props) {
  const full = free <= 0;
  const live = mine.screen || mine.camera;

  return (
    <section className={styles.controls} aria-label="Screen sharing">
      <div className={styles.row}>
        <p className={styles.hint}>
          {full && !(mine.screen && mine.camera)
            ? "6 streams are live, the most at once. You can start yours when one stops."
            : live
              ? "Everyone can watch you. Change the quality or mode from your player."
              : "Share a screen, window or tab, or turn on your camera."}
        </p>

        <div className={styles.buttons}>
          {mine.screen ? (
            <Button variant="danger" onClick={() => onStop("screen")} disabled={busy}>
              Stop sharing
            </Button>
          ) : (
            <Button onClick={() => onStart("screen")} disabled={busy || full}>
              Share my screen
            </Button>
          )}
          {mine.camera ? (
            <Button variant="danger" onClick={() => onStop("camera")} disabled={busy}>
              Turn off camera
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onStart("camera")} disabled={busy || full}>
              Turn on camera
            </Button>
          )}
        </div>
      </div>

      {mine.screen && noSound && (
        <p className={styles.notice} role="status">
          No sound is being shared. To share sound, share a browser tab (or your whole screen on Windows) and tick
          "Share audio" in the picker. Firefox and Safari can't share sound.
        </p>
      )}
    </section>
  );
}
