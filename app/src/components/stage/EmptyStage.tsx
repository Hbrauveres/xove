import styles from "./EmptyStage.module.css";
import { BARS } from "./bars";

/**
 * Nobody is sharing: the colour bars, at full colour and lit by the ambilight (spec 0158), with
 * the round buttons over the stage to start a share (spec 0098). Only the camera where the
 * browser can't share a screen (phones).
 */
export function EmptyStage({ canShareScreen = true }: { canShareScreen?: boolean }) {
  return (
    <div className={styles.empty}>
      <div className={styles.test} data-bars aria-hidden="true">
        {BARS.map((c) => (
          <span key={c} data-bar style={{ background: c }} />
        ))}
      </div>
      <div className={styles.body}>
        <p className={styles.copy}>
          {canShareScreen
            ? "Share your screen or turn on your camera with the buttons below."
            : "Turn on your camera with the button below."}
        </p>
      </div>
    </div>
  );
}
