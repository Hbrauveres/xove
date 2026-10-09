import styles from "./StageOverlay.module.css";

type Props = {
  /** The player is fullscreen (or, on a phone, in the full-screen view): the button leaves it. */
  fullscreen: boolean;
  onFullscreen: () => void;
  /** On a phone or tablet the button opens the full-screen view, not the player's fullscreen (spec 0171). */
  view?: boolean;
  /** Sideways on a phone the room is already in the full-screen view: no button. */
  hidden?: boolean;
};

/**
 * What sits over the video: the fullscreen button. Who is live, and for how long, is in the
 * info row under the stage (spec 0104).
 */
export function StageOverlay({ fullscreen, onFullscreen, view = false, hidden = false }: Props) {
  if (hidden) return null;
  const label = view
    ? fullscreen
      ? "Exit full-screen view"
      : "Full-screen view"
    : fullscreen
      ? "Exit fullscreen"
      : "Fullscreen";
  return (
    <div className={styles.overlay} data-overlay>
      <div className={styles.top}>
        <button
          type="button"
          // A button, never the start of a swipe (spec 0159).
          data-no-swipe
          className={styles.iconButton}
          onClick={onFullscreen}
          aria-label={label}
          title={label}
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
