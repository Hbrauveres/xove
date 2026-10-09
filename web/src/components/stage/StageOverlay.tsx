import styles from "./StageOverlay.module.css";

type Props = {
  /** The player is fullscreen: the button leaves it. */
  fullscreen: boolean;
  onFullscreen: () => void;
};

/**
 * What sits over the video: the fullscreen button. Who is live, and for how long, is in the
 * info row under the stage (spec 0104).
 */
export function StageOverlay({ fullscreen, onFullscreen }: Props) {
  return (
    <div className={styles.overlay}>
      <div className={styles.top}>
        <button
          type="button"
          // A button, never the start of a swipe (spec 0159).
          data-no-swipe
          className={styles.iconButton}
          onClick={onFullscreen}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path
              // Corners pointing out to enter, pointing in to leave.
              d={fullscreen ? "M8 3v5H3M17 8h-5V3M12 17v-5h5M3 12h5v5" : "M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5"}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
