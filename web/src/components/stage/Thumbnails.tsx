import type { LiveFeed, Sharer } from "../../types";
import { ScreenVideo } from "./ScreenVideo";
import styles from "./Thumbnails.module.css";

type Props = {
  /** Everyone sharing except the person shown big. */
  sharers: Sharer[];
  onPick: (id: string) => void;
};

const what = (feed: LiveFeed) => (feed.kind === "camera" ? "camera" : "shared screen");

/**
 * Small live views of the other people sharing (spec 0060). Each shows their screen,
 * or their camera when that's all they share; a click makes them big. They're small,
 * so LiveKit sends them in low quality (adaptive stream).
 */
export function Thumbnails({ sharers, onPick }: Props) {
  if (sharers.length === 0) return null;

  return (
    <ul className={styles.strip} aria-label="Other streams">
      {sharers.map((s) => {
        const feed = s.screen ?? s.camera;
        const video = s.isMe ? feed?.local : feed?.remote?.video;
        const name = s.isMe ? "You" : s.person.name;
        return (
          <li key={s.person.id} className={styles.item}>
            <button type="button" className={styles.pick} aria-label={`Watch ${name}`} onClick={() => onPick(s.person.id)}>
              <span className={styles.video}>
                {feed && video ? (
                  <ScreenVideo video={video} label={s.isMe ? `Your ${what(feed)}` : `${name}'s ${what(feed)}`} />
                ) : (
                  <span className={styles.loading}>Loading…</span>
                )}
              </span>
              <span className={styles.name}>{name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
