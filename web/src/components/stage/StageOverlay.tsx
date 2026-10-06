import type { Friend, StreamStats } from "../../types";
import { useElapsed } from "../../hooks/useElapsed";
import { Avatar } from "../ui/Avatar";
import { LiveDot } from "../ui/LiveDot";
import styles from "./StageOverlay.module.css";

type Props = {
  sharer: Friend;
  startedAt: number;
  stats: StreamStats | null;
  isMeSharing: boolean;
  /** The player is fullscreen: the button leaves it. */
  fullscreen: boolean;
  onFullscreen: () => void;
};

/** Who's live, for how long, and the stream numbers, drawn over the video. */
export function StageOverlay({ sharer, startedAt, stats, isMeSharing, fullscreen, onFullscreen }: Props) {
  const elapsed = useElapsed(startedAt);

  return (
    <div className={styles.overlay}>
      <div className={styles.top}>
        <div className={styles.who}>
          <span className={styles.live}>
            <LiveDot />
            LIVE
          </span>
          <Avatar person={sharer} size={24} onAir={isMeSharing} />
          <span className={styles.name}>{isMeSharing ? "You are sharing" : `${sharer.name} is sharing`}</span>
          <span className={styles.elapsed}>{elapsed}</span>
        </div>
        <button
          type="button"
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

      {stats && (
        <dl className={styles.stats} aria-label="Stream quality">
          <div>
            <dt>Resolution</dt>
            <dd>
              {stats.width}×{stats.height}
            </dd>
          </div>
          <div>
            <dt>Frame rate</dt>
            <dd>{stats.fps} fps</dd>
          </div>
          <div>
            <dt>Codec</dt>
            <dd>{stats.codec}</dd>
          </div>
          <div>
            <dt>Bitrate</dt>
            <dd>{stats.bitrateMbps.toFixed(1)} Mbps</dd>
          </div>
          <div>
            <dt>Delay</dt>
            <dd>{stats.latencyMs} ms</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
