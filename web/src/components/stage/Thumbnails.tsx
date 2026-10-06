import type { LiveFeed, Sharer } from "../../types";
import { ScreenVideo } from "./ScreenVideo";
import styles from "./Thumbnails.module.css";

/** One thumbnail's sound, for this viewer: muted unless they unmuted it. */
export type ThumbnailSound = { muted: boolean; volume: number };

export const MUTED: ThumbnailSound = { muted: true, volume: 1 };

type Props = {
  /** Everyone sharing except the person shown big. */
  sharers: Sharer[];
  onPick: (id: string) => void;
  sound: Record<string, ThumbnailSound>;
  onSoundChange: (id: string, sound: ThumbnailSound) => void;
  /** False where the page can't set the volume (iPhones and iPads): only mute is shown. */
  canSetVolume: boolean;
};

const what = (feed: LiveFeed) => (feed.kind === "camera" ? "camera" : "shared screen");

/**
 * Small live views of the other people sharing (spec 0060). Each shows their screen,
 * or their camera when that's all they share; a click makes them big. They're small,
 * so LiveKit sends them in low quality (adaptive stream). They're muted, and a muted
 * one's sound isn't downloaded; each can be unmuted, at its own volume.
 */
export function Thumbnails({ sharers, onPick, sound, onSoundChange, canSetVolume }: Props) {
  if (sharers.length === 0) return null;

  return (
    <ul className={styles.strip} aria-label="Other streams">
      {sharers.map((s) => {
        const id = s.person.id;
        const feed = s.screen ?? s.camera;
        const video = s.isMe ? feed?.local : feed?.remote?.video;
        const name = s.isMe ? "You" : s.person.name;
        const mine = sound[id] ?? MUTED;
        return (
          <li key={id} className={styles.item}>
            <button type="button" className={styles.pick} aria-label={`Watch ${name}`} onClick={() => onPick(id)}>
              <span className={styles.video}>
                {feed && video ? (
                  <ScreenVideo
                    video={video}
                    sound={mine.muted ? undefined : s.sound}
                    volume={mine.volume}
                    label={s.isMe ? `Your ${what(feed)}` : `${name}'s ${what(feed)}`}
                  />
                ) : (
                  <span className={styles.loading}>Loading…</span>
                )}
              </span>
              <span className={styles.name}>{name}</span>
            </button>

            {/* Without sound: shown muted, and nothing to unmute (spec 0098). */}
            {!s.isMe && !s.hasSound && (
              <div className={styles.sound}>
                <button type="button" className={styles.icon} aria-label={`${name} shares no sound`} disabled>
                  <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
                    <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
                    <path d="M13 8l4 4M17 8l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            {!s.isMe && s.hasSound && (
              <div className={styles.sound}>
                <button
                  type="button"
                  className={styles.icon}
                  aria-label={`${mine.muted ? "Unmute" : "Mute"} ${name}`}
                  title={mine.muted ? "Unmute" : "Mute"}
                  onClick={() => onSoundChange(id, { ...mine, muted: !mine.muted })}
                >
                  <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
                    <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
                    {mine.muted ? (
                      <path d="M13 8l4 4M17 8l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    ) : (
                      <path d="M13 7.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    )}
                  </svg>
                </button>
                {canSetVolume && !mine.muted && (
                  <input
                    className={styles.slider}
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    aria-label={`${name}'s volume`}
                    value={mine.volume}
                    onChange={(e) => onSoundChange(id, { muted: false, volume: Number(e.target.value) })}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
