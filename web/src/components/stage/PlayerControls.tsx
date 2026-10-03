import type { WatchPrefs, WatchQuality } from "../../media/preferences";
import { viewerQualities } from "../../media/shareSettings";
import styles from "./PlayerControls.module.css";

type Props = {
  /** Height of the sharer's best layer, to know which qualities exist. */
  sharerHeight: number;
  prefs: WatchPrefs;
  onChange: (prefs: WatchPrefs) => void;
  /** False where the page can't set the volume (iPhones and iPads): only mute is shown. */
  canSetVolume: boolean;
};

/** The viewer's bar over the player, like YouTube's: volume and quality. Only changes this browser. */
export function PlayerControls({ sharerHeight, prefs, onChange, canSetVolume }: Props) {
  const qualities = viewerQualities(sharerHeight);
  const silent = prefs.muted || prefs.volume === 0;

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.icon}
        aria-label={prefs.muted ? "Unmute" : "Mute"}
        onClick={() => onChange({ ...prefs, muted: !prefs.muted })}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
          {silent ? (
            <path d="M13 8l4 4M17 8l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M13 7.5a3.5 3.5 0 0 1 0 5M15 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {canSetVolume && (
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={1}
          step={0.05}
          aria-label="Volume"
          value={prefs.muted ? 0 : prefs.volume}
          // Moving the slider means "I want to hear it": it also unmutes.
          onChange={(e) => onChange({ ...prefs, volume: Number(e.target.value), muted: false })}
        />
      )}

      <label className={styles.quality}>
        <span className={styles.label}>Quality</span>
        <select
          aria-label="Quality"
          value={qualities.includes(prefs.quality as never) || prefs.quality === "auto" ? prefs.quality : "auto"}
          onChange={(e) => onChange({ ...prefs, quality: e.target.value as WatchQuality })}
        >
          <option value="auto">Auto</option>
          {qualities.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
